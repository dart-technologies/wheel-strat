#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(SCRIPT_ROOT / "lib"))

from ibkr_bridge_config import get_bridge_url, get_bridge_api_key  # noqa: E402


def load_env():
    try:
        from dotenv import load_dotenv  # type: ignore
        env_file = os.getenv("IBKR_BRIDGE_ENV_FILE") or os.getenv("BRIDGE_ENV_FILE")
        if env_file:
            load_dotenv(env_file)
        else:
            load_dotenv()
            load_dotenv(".env.local", override=True)
    except Exception:
        return


def http_json(url, method="GET", payload=None, headers=None, timeout=10):
    body = None
    request_headers = {"Accept": "application/json"}
    if headers:
        request_headers.update(headers)
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=request_headers, method=method)
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            elapsed = time.perf_counter() - start
            if raw:
                return json.loads(raw.decode("utf-8")), elapsed, None
            return None, elapsed, None
    except urllib.error.HTTPError as exc:
        elapsed = time.perf_counter() - start
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = str(exc)
        return None, elapsed, f"HTTP {exc.code}: {detail}"
    except Exception as exc:
        elapsed = time.perf_counter() - start
        return None, elapsed, str(exc)


def parse_expiration(raw):
    if not raw:
        return None
    if "-" in raw:
        fmt = "%Y-%m-%d"
    else:
        fmt = "%Y%m%d"
    try:
        return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
    except Exception:
        return None


def days_to_expiration(raw):
    exp = parse_expiration(raw)
    if not exp:
        return None
    now = datetime.now(timezone.utc)
    delta = exp - now
    return max(0, int(delta.total_seconds() // 86400))


def pick_expiration(expirations, min_days, max_days):
    candidates = []
    for exp in expirations or []:
        dte = days_to_expiration(exp)
        if dte is None:
            continue
        if min_days <= dte <= max_days:
            candidates.append((dte, exp))
    if candidates:
        candidates.sort()
        return candidates[0][1]
    # fallback: nearest future
    fallback = []
    for exp in expirations or []:
        dte = days_to_expiration(exp)
        if dte is not None:
            fallback.append((dte, exp))
    if not fallback:
        return None
    fallback.sort()
    return fallback[0][1]


def pick_strike(strikes, price, right, otm_pct):
    if not strikes:
        return None
    strikes = sorted({float(s) for s in strikes if s is not None})
    if not strikes:
        return None
    if right == "C":
        target = price * (1.0 + otm_pct)
        higher = [s for s in strikes if s >= price]
        if not higher:
            return strikes[-1]
        for s in higher:
            if s >= target:
                return s
        return higher[-1]
    target = price * (1.0 - otm_pct)
    lower = [s for s in strikes if s <= price]
    if not lower:
        return strikes[0]
    for s in reversed(lower):
        if s <= target:
            return s
    return lower[0]


def pick_strike_window(strikes, target, count):
    if not strikes:
        return []
    strikes = sorted({float(s) for s in strikes if s is not None})
    if not strikes:
        return []
    if count <= 1:
        return [target]
    try:
        index = strikes.index(target)
    except ValueError:
        index = min(range(len(strikes)), key=lambda i: abs(strikes[i] - target))
    window = [strikes[index]]
    offset = 1
    while len(window) < count and (index - offset >= 0 or index + offset < len(strikes)):
        if index - offset >= 0:
            window.append(strikes[index - offset])
        if len(window) >= count:
            break
        if index + offset < len(strikes):
            window.append(strikes[index + offset])
        offset += 1
    return window[:count]


def summarize(label, values, errors):
    if not values:
        return f"{label}: no samples (errors={errors})"
    values_sorted = sorted(values)
    count = len(values_sorted)
    avg = sum(values_sorted) / count
    def pct(p):
        idx = int(round((p / 100.0) * (count - 1)))
        return values_sorted[idx]
    return (
        f"{label}: n={count} avg={avg:.3f}s min={values_sorted[0]:.3f}s "
        f"p50={pct(50):.3f}s p90={pct(90):.3f}s p95={pct(95):.3f}s max={values_sorted[-1]:.3f}s "
        f"errors={errors}"
    )


def main():
    load_env()
    parser = argparse.ArgumentParser(description="Measure IBKR Bridge latency for market/option endpoints.")
    parser.add_argument("--base-url", default=get_bridge_url(os.environ))
    parser.add_argument("--api-key", default=get_bridge_api_key(os.environ))
    parser.add_argument("--symbol", default="MSFT")
    parser.add_argument("--right", choices=["C", "P"], default="C")
    parser.add_argument("--iterations", type=int, default=10)
    parser.add_argument("--dte-min", type=int, default=14)
    parser.add_argument("--dte-max", type=int, default=28)
    parser.add_argument("--otm-pct", type=float, default=0.05)
    parser.add_argument("--timeout", type=int, default=10)
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--batch-size", type=int, default=0)
    parser.add_argument("--batch-iterations", type=int, default=5)
    parser.add_argument("--batch-parallel", type=int, default=1)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    headers = {}
    if args.api_key:
        headers["X-API-KEY"] = args.api_key

    print(f"Bridge URL: {base_url}")
    print(f"Symbol: {args.symbol} Right: {args.right} Iterations: {args.iterations}")

    market_times = []
    chain_times = []
    quote_times = []
    batch_times = []
    errors = {"market": 0, "chain": 0, "quote": 0, "batch": 0}

    market_url = f"{base_url}/market-data/{args.symbol}"
    chain_url = f"{base_url}/option-chain/{args.symbol}"

    market_data, elapsed, err = http_json(market_url, headers=headers, timeout=args.timeout)
    if err:
        errors["market"] += 1
        print(f"[market-data] error: {err}")
    else:
        market_times.append(elapsed)

    price = None
    if market_data:
        price = market_data.get("last") or market_data.get("bid") or market_data.get("close")

    chain_data, elapsed, err = http_json(chain_url, headers=headers, timeout=args.timeout)
    if err:
        errors["chain"] += 1
        print(f"[option-chain] error: {err}")
    else:
        chain_times.append(elapsed)

    expiration = None
    strike = None
    if chain_data:
        expiration = pick_expiration(chain_data.get("expirations"), args.dte_min, args.dte_max)
        if price is None:
            price = market_data.get("close") if market_data else None
        strike = pick_strike(chain_data.get("strikes"), price, args.right, args.otm_pct) if price else None

    if not expiration or strike is None:
        print("Failed to derive option contract. Check market-data/option-chain responses.")
        sys.exit(1)

    quote_payload = {
        "symbol": args.symbol,
        "expiration": expiration,
        "strike": strike,
        "right": args.right
    }
    quote_url = f"{base_url}/option-quote"
    batch_url = f"{base_url}/option-quote/batch"

    print(f"Selected contract: {args.symbol} {expiration} {args.right} {strike}")
    if args.batch_size > 0:
        print(f"Batch mode: size={args.batch_size} iterations={args.batch_iterations} parallel={args.batch_parallel}")

    for _ in range(args.iterations):
        _, elapsed, err = http_json(quote_url, method="POST", payload=quote_payload, headers=headers, timeout=args.timeout)
        if err:
            errors["quote"] += 1
        else:
            quote_times.append(elapsed)
        time.sleep(args.sleep)

    if args.batch_size > 0:
        strikes = pick_strike_window(chain_data.get("strikes"), strike, args.batch_size)
        batch_contracts = [{
            "symbol": args.symbol,
            "expiration": expiration,
            "strike": s,
            "right": args.right
        } for s in strikes]
        batch_payload = {"contracts": batch_contracts}

        def run_batch():
            return http_json(batch_url, method="POST", payload=batch_payload, headers=headers, timeout=args.timeout)

        for _ in range(args.batch_iterations):
            if args.batch_parallel > 1:
                with ThreadPoolExecutor(max_workers=args.batch_parallel) as executor:
                    futures = [executor.submit(run_batch) for _ in range(args.batch_parallel)]
                    for future in as_completed(futures):
                        _, elapsed, err = future.result()
                        if err:
                            errors["batch"] += 1
                        else:
                            batch_times.append(elapsed)
            else:
                _, elapsed, err = run_batch()
                if err:
                    errors["batch"] += 1
                else:
                    batch_times.append(elapsed)
            time.sleep(args.sleep)

    print(summarize("market-data", market_times, errors["market"]))
    print(summarize("option-chain", chain_times, errors["chain"]))
    print(summarize("option-quote", quote_times, errors["quote"]))
    if args.batch_size > 0:
        print(summarize(f"option-quote/batch size={args.batch_size} parallel={args.batch_parallel}", batch_times, errors["batch"]))


if __name__ == "__main__":
    main()
