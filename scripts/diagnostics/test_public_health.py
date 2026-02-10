#!/usr/bin/env python3
import argparse
import base64
import json
import os
import sys
from pathlib import Path
from urllib import request
from urllib.error import HTTPError, URLError

DEFAULT_GATEWAY = "https://api.public.com/userapigateway"


def load_env_file(path: Path):
    env = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def load_env(env_file: str | None):
    if env_file:
        path = Path(env_file)
        if path.exists():
            return load_env_file(path)
    path = Path(".env.local")
    if path.exists():
        return load_env_file(path)
    return {}


def read_env(env: dict, *names, default=None):
    for name in names:
        value = os.getenv(name) or env.get(name)
        if value:
            return value
    return default


def decode_jwt_scopes(token: str):
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return []
        payload = parts[1]
        padding = "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload + padding).decode("utf-8")
        data = json.loads(decoded)
        scopes = data.get("scope") or data.get("scopes") or []
        if isinstance(scopes, str):
            scopes = [scopes]
        return scopes
    except Exception:
        return []


def decode_jwt_exp(token: str):
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return None
        payload = parts[1]
        padding = "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload + padding).decode("utf-8")
        data = json.loads(decoded)
        exp = data.get("exp")
        if isinstance(exp, (int, float)):
            return int(exp)
        return None
    except Exception:
        return None


def is_jwt(token: str) -> bool:
    return token.count(".") >= 2


def request_json(url: str, api_key: str, body: dict | None = None, timeout: float = 20.0):
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    )
    with request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return resp.status, json.loads(raw)


def normalize_chain(payload: dict):
    chain = payload.get("optionChain") or payload.get("data", {}).get("optionChain") or payload
    options = chain.get("options") or chain.get("optionSeries") or []
    if isinstance(options, list) and len(options) > 0:
        return chain, options

    calls = chain.get("calls") or []
    puts = chain.get("puts") or []
    combined = []
    if isinstance(calls, list):
        combined.extend(calls)
    if isinstance(puts, list):
        combined.extend(puts)
    return chain, combined


def parse_osi_symbol(raw: str | None):
    if not raw:
        return None
    cleaned = str(raw).upper().replace(" ", "")
    import re
    match = re.match(r"^([A-Z0-9]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$", cleaned)
    if not match:
        return None
    root = match.group(1)
    year = int(match.group(2))
    exp_year = 1900 + year if year >= 70 else 2000 + year
    expiration = f"{exp_year}{match.group(3)}{match.group(4)}"
    strike = int(match.group(6)) / 1000
    return {
        "root": root,
        "expiration": expiration,
        "strike": strike,
        "right": "P" if match.group(5) == "P" else "C"
    }


def main():
    parser = argparse.ArgumentParser(description="Public.com API health check")
    parser.add_argument("--env-file", default=None)
    parser.add_argument("--symbol", default="AAPL")
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--skip-instrument", action="store_true")
    args = parser.parse_args()

    env = load_env(args.env_file)
    api_key = read_env(env, "PUBLIC_API_KEY")
    gateway = read_env(env, "PUBLIC_API_GATEWAY", default=DEFAULT_GATEWAY)
    account_id = read_env(env, "PUBLIC_ACCOUNT_ID")

    if not api_key or not account_id:
        print("Missing PUBLIC_API_KEY or PUBLIC_ACCOUNT_ID.", file=sys.stderr)
        return 1

    print(f"Gateway: {gateway}")
    if is_jwt(api_key):
        scopes = decode_jwt_scopes(api_key)
        has_marketdata = "marketdata" in scopes
        print(f"Token scopes: {scopes}")
        print(f"marketdata scope: {'OK' if has_marketdata else 'MISSING'}")
        exp = decode_jwt_exp(api_key)
        if exp:
            import datetime
            exp_dt = datetime.datetime.fromtimestamp(exp, datetime.timezone.utc)
            now = datetime.datetime.now(datetime.timezone.utc)
            status = "OK" if exp_dt > now else "EXPIRED"
            print(f"Token exp: {exp_dt.isoformat()} ({status})")
    else:
        has_marketdata = False
        print("Token format: opaque (not a JWT). Scope/exp cannot be decoded locally.")

    symbol = args.symbol.upper()
    osi_symbol = None

    if not args.skip_instrument:
        try:
            status, payload = request_json(
                f"{gateway.rstrip('/')}/trading/instruments/{symbol}/EQUITY",
                api_key,
                body=None,
                timeout=args.timeout
            )
            print(f"Instrument status: {status}")
            if payload.get("error"):
                print(f"Instrument error: {payload.get('error')}")
        except HTTPError as err:
            detail = err.read().decode("utf-8")
            print(f"Instrument request failed: HTTP {err.code} {detail}", file=sys.stderr)
        except URLError as err:
            print(f"Instrument request failed: {err}", file=sys.stderr)

    expiration_date = None
    try:
        status, payload = request_json(
            f"{gateway.rstrip('/')}/marketdata/{account_id}/option-expirations",
            api_key,
            body={"instrument": {"symbol": symbol, "type": "EQUITY"}},
            timeout=args.timeout
        )
        expirations = payload.get("expirationDates") or payload.get("expirations") or payload.get("results") or []
        if isinstance(expirations, list) and expirations:
            expiration_date = str(expirations[0])
        print(f"Option expirations status: {status} (count={len(expirations) if isinstance(expirations, list) else 0})")
    except HTTPError as err:
        detail = err.read().decode("utf-8")
        print(f"Option expirations request failed: HTTP {err.code} {detail}", file=sys.stderr)
    except URLError as err:
        print(f"Option expirations request failed: {err}", file=sys.stderr)
        return 1

    if expiration_date and isinstance(expirations, list):
        chain_found = False
        for exp in expirations[:3]:
            try:
                status, payload = request_json(
                    f"{gateway.rstrip('/')}/marketdata/{account_id}/option-chain",
                    api_key,
                    body={"instrument": {"symbol": symbol, "type": "EQUITY"}, "expirationDate": exp},
                    timeout=args.timeout
                )
                chain, options = normalize_chain(payload)
                expirations_field = chain.get("expirationDates") or chain.get("expirations") or []
                strikes_field = chain.get("strikes") or []

                derived_exp = set()
                derived_strikes = set()
                for item in options:
                    osi_raw = item.get("instrument", {}).get("symbol") or item.get("symbol")
                    parsed = parse_osi_symbol(osi_raw)
                    if parsed:
                        derived_exp.add(parsed["expiration"])
                        derived_strikes.add(parsed["strike"])
                        if not osi_symbol:
                            osi_symbol = osi_raw

                print(f"Option chain status: {status} (expiration={exp})")
                print(f"Expirations: {len(expirations_field)} Strikes: {len(strikes_field)} Options: {len(options)} DerivedExp: {len(derived_exp)} DerivedStrikes: {len(derived_strikes)}")

                if options:
                    chain_found = True
                    break
            except HTTPError as err:
                detail = err.read().decode("utf-8")
                print(f"Option chain request failed: HTTP {err.code} {detail}", file=sys.stderr)
            except URLError as err:
                print(f"Option chain request failed: {err}", file=sys.stderr)
                return 1

        if not chain_found:
            print("Option chain returned no options for sampled expirations.")
    else:
        print("Option chain skipped (no expiration dates).")

    try:
        status, payload = request_json(
            f"{gateway.rstrip('/')}/marketdata/{account_id}/quotes",
            api_key,
            body={
                "symbols": [symbol],
                "instruments": [{"symbol": symbol, "type": "EQUITY"}]
            },
            timeout=args.timeout
        )
        print(f"Quotes status: {status}")
        if payload.get("error"):
            print(f"Quotes error: {payload.get('error')}")
    except HTTPError as err:
        detail = err.read().decode("utf-8")
        print(f"Quotes request failed: HTTP {err.code} {detail}", file=sys.stderr)
        return 1
    except URLError as err:
        print(f"Quotes request failed: {err}", file=sys.stderr)
        return 1

    if osi_symbol:
        try:
            status, payload = request_json(
                f"{gateway.rstrip('/')}/option-details/{account_id}/greeks?osiSymbols={osi_symbol}",
                api_key,
                body=None,
                timeout=args.timeout
            )
            print(f"Greeks status: {status}")
            if payload.get("error"):
                print(f"Greeks error: {payload.get('error')}")
        except HTTPError as err:
            detail = err.read().decode("utf-8")
            print(f"Greeks request failed: HTTP {err.code} {detail}", file=sys.stderr)
            return 1
        except URLError as err:
            print(f"Greeks request failed: {err}", file=sys.stderr)
            return 1
    else:
        print("Greeks check skipped (no osiSymbol available from chain).")

    if is_jwt(api_key) and not has_marketdata:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
