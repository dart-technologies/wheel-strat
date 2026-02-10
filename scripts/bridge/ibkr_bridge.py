"""
IBKR Bridge Server - Exposes TWS API over HTTP
Run: python3 scripts/ibkr_bridge.py
Requires: pip3 install flask flask-cors ib_insync

Refactored for:
1. Deadlock avoidance (minimized lock contention during IO).
2. Robust connection management (centralized in monitor thread).
3. Detailed market data logging (debugging tier fallbacks).
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from ib_insync import IB, Stock, Option, LimitOrder, MarketOrder, Order, ExecutionFilter, util
import mibian
import math
import json
import nest_asyncio
import asyncio
import os
import logging
import threading
import queue
import urllib.request
import urllib.error
import random
import uuid
from datetime import datetime
from datetime import timedelta
import time
from contextlib import contextmanager
from dotenv import load_dotenv

# Load environment variables from .env/.env.local (override via IBKR_BRIDGE_ENV_FILE)
env_file = os.getenv('IBKR_BRIDGE_ENV_FILE') or os.getenv('BRIDGE_ENV_FILE')
if env_file:
    load_dotenv(env_file)
else:
    load_dotenv()
    load_dotenv('.env.local', override=True)

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# --- Configuration ---

def read_env(name, default=None):
    value = os.getenv(name)
    if value is None: return default
    value = value.strip()
    return default if value == '' else value

def env_float(name, default):
    raw = read_env(name)
    try: return float(raw) if raw is not None else default
    except ValueError: return default

def env_int(name, default):
    raw = read_env(name)
    try: return int(raw) if raw is not None else default
    except ValueError: return default

def env_bool(name, default=False):
    raw = read_env(name)
    if raw is None:
        return default
    return raw.strip().lower() in ('1', 'true', 'yes', 'y', 'on')

IB_TRADING_MODE = read_env('IB_TRADING_MODE', read_env('TRADING_MODE', 'paper')).lower()
if IB_TRADING_MODE not in ('paper', 'live'): IB_TRADING_MODE = 'paper'

IB_HOST = read_env('IB_HOST', '127.0.0.1')
raw_client_type = read_env('IB_CLIENT_TYPE', 'gateway')
IB_CLIENT_TYPE = (raw_client_type or 'gateway').strip().lower().replace('-', '_')
if IB_CLIENT_TYPE in ('ib_gateway', 'ibg'): IB_CLIENT_TYPE = 'gateway'
if IB_CLIENT_TYPE in ('tws_api', 'tws_client'): IB_CLIENT_TYPE = 'tws'
if IB_CLIENT_TYPE in ('docker', 'socat'): IB_CLIENT_TYPE = 'docker'

raw_port = read_env('IB_PORT')
def default_ib_port():
    if IB_CLIENT_TYPE == 'docker':
        return 4004
    if IB_CLIENT_TYPE == 'tws':
        return 7497 if IB_TRADING_MODE == 'paper' else 7496
    return 4002 if IB_TRADING_MODE == 'paper' else 4001

IB_PORT = env_int('IB_PORT', default_ib_port())
if raw_port is None:
    logger.info("IB_PORT not set; using %s for client=%s mode=%s", IB_PORT, IB_CLIENT_TYPE, IB_TRADING_MODE)
IB_CLIENT_ID = env_int('IB_CLIENT_ID', 1)
BRIDGE_API_KEY = read_env('IBKR_BRIDGE_API_KEY') or read_env('BRIDGE_API_KEY')
EXECUTION_WEBHOOK_URL = read_env('IBKR_EXECUTION_WEBHOOK_URL') or read_env('EXECUTION_WEBHOOK_URL')

if IB_TRADING_MODE == 'paper' and IB_PORT in (4001, 7496):
    logger.warning("IB_PORT=%s looks like a live port while IB_TRADING_MODE=paper. Expected 4002 (Gateway) or 7497 (TWS).", IB_PORT)
if IB_TRADING_MODE == 'live' and IB_PORT in (4002, 7497):
    logger.warning("IB_PORT=%s looks like a paper port while IB_TRADING_MODE=live. Expected 4001 (Gateway) or 7496 (TWS).", IB_PORT)

# Timeouts & intervals
IB_CONNECT_TIMEOUT = env_float('IB_CONNECT_TIMEOUT', 15.0)
IB_HEARTBEAT_INTERVAL = env_float('IB_HEARTBEAT_INTERVAL', 30.0)
IB_HEARTBEAT_TIMEOUT = env_float('IB_HEARTBEAT_TIMEOUT', 20.0)
IB_RECONNECT_INTERVAL = env_float('IB_RECONNECT_INTERVAL', 10.0)
IB_CONTRACT_QUALIFY_TIMEOUT = env_float('IB_CONTRACT_QUALIFY_TIMEOUT', 5.0)
IB_MARKET_DATA_CACHE_TTL = env_float('IB_MARKET_DATA_CACHE_TTL', 2.0)
IB_OPTION_CHAIN_CACHE_TTL = env_float('IB_OPTION_CHAIN_CACHE_TTL', 300.0)
IB_HISTORICAL_CACHE_TTL = env_float('IB_HISTORICAL_CACHE_TTL', 300.0)
IB_EXECUTIONS_TIMEOUT = env_float('IB_EXECUTIONS_TIMEOUT', 20.0)
IB_ORDERS_TIMEOUT = env_float('IB_ORDERS_TIMEOUT', 10.0)
IB_HEARTBEAT_FAILURES_BEFORE_EXIT = env_int('IB_HEARTBEAT_FAILURES_BEFORE_EXIT', 3)
IB_DATA_LOCK_TIMEOUT = env_float('IB_DATA_LOCK_TIMEOUT', 10.0)
IB_DATA_LOCK_RETRY_ATTEMPTS = env_int('IB_DATA_LOCK_RETRY_ATTEMPTS', 5)
IB_DATA_LOCK_RETRY_BACKOFF = env_float('IB_DATA_LOCK_RETRY_BACKOFF', 0.5)
IB_DEBUG_LOGGING = env_bool('IB_DEBUG_LOGGING', False)
IB_LOCK_DEFAULT_CONCURRENCY = env_int('IB_LOCK_DEFAULT_CONCURRENCY', 2)
IB_LOCK_MARKET_CONCURRENCY = env_int('IB_LOCK_MARKET_CONCURRENCY', IB_LOCK_DEFAULT_CONCURRENCY)
IB_LOCK_OPTIONS_CONCURRENCY = env_int('IB_LOCK_OPTIONS_CONCURRENCY', IB_LOCK_DEFAULT_CONCURRENCY)
IB_LOCK_HISTORICAL_CONCURRENCY = env_int('IB_LOCK_HISTORICAL_CONCURRENCY', 1)
IB_LOCK_PORTFOLIO_CONCURRENCY = env_int('IB_LOCK_PORTFOLIO_CONCURRENCY', 1)
IB_LOCK_EXECUTIONS_CONCURRENCY = env_int('IB_LOCK_EXECUTIONS_CONCURRENCY', 1)
IB_LOCK_ORDERS_CONCURRENCY = env_int('IB_LOCK_ORDERS_CONCURRENCY', 1)
IB_LOCK_WARN_THRESHOLD_MS = env_int('IB_LOCK_WARN_THRESHOLD_MS', 8000)
IB_EXECUTIONS_CACHE_TTL = env_float('IB_EXECUTIONS_CACHE_TTL', 10.0)
IB_ORDERS_CACHE_TTL = env_float('IB_ORDERS_CACHE_TTL', 5.0)
IB_PORTFOLIO_CACHE_TTL = env_float('IB_PORTFOLIO_CACHE_TTL', 5.0)
IB_ACCOUNT_SUMMARY_TIMEOUT = env_float('IB_ACCOUNT_SUMMARY_TIMEOUT', 10.0)
IB_CONTRACT_DETAILS_TIMEOUT = env_float('IB_CONTRACT_DETAILS_TIMEOUT', 5.0)
IB_CONTRACT_DETAILS_CACHE_TTL = env_float('IB_CONTRACT_DETAILS_CACHE_TTL', 86400.0)

if IB_DEBUG_LOGGING:
    logging.getLogger().setLevel(logging.DEBUG)
    logger.setLevel(logging.DEBUG)
    logging.getLogger('ib_insync').setLevel(logging.DEBUG)

# --- Global State ---

ib = None
ib_loop = None # Captured loop from the driver thread
loop_ready = threading.Event()
data_lock = threading.RLock()
connection_in_progress_lock = threading.Lock()
connection_ready = threading.Event()
connection_epoch = 0
bridge_start_time = time.time()

# Lock groups avoid one slow call blocking everything.
lock_registry = {}
lock_state = {}

def init_lock_registry():
    groups = {
        "default": IB_LOCK_DEFAULT_CONCURRENCY,
        "market": IB_LOCK_MARKET_CONCURRENCY,
        "options": IB_LOCK_OPTIONS_CONCURRENCY,
        "historical": IB_LOCK_HISTORICAL_CONCURRENCY,
        "portfolio": IB_LOCK_PORTFOLIO_CONCURRENCY,
        "executions": IB_LOCK_EXECUTIONS_CONCURRENCY,
        "orders": IB_LOCK_ORDERS_CONCURRENCY
    }
    for group, capacity in groups.items():
        cap = max(1, int(capacity))
        lock_registry[group] = threading.BoundedSemaphore(cap)
        lock_state[group] = {
            "capacity": cap,
            "inflight": 0,
            "lastAcquireAt": None,
            "lastAcquireMs": None,
            "lastHoldMs": None,
            "maxHoldMs": 0
        }

init_lock_registry()

diag_state = {
    "lastConnectAt": None,
    "lastDisconnectAt": None,
    "lastIbErrorAt": None,
    "lastIbErrorCode": None,
    "lastIbErrorMessage": None,
    "heartbeatFailures": 0,
    "reconnectAttempts": 0,
    "lastHeartbeatAt": None,
    "lastAccountSummaryAt": None,
    "lastAccountSummaryMs": None,
    "lastAccountSummaryCount": None,
    "lastAccountSummaryError": None,
    "lastPositionsAt": None,
    "lastPositionsMs": None,
    "lastPositionsCount": None,
    "lastPositionsError": None,
    "lastOrdersAt": None,
    "lastOrdersMs": None,
    "lastOrdersCount": None,
    "lastOrdersError": None,
}

# Caches
market_data_cache = {}
option_chain_cache = {}
historical_cache = {}
executions_cache = {}
orders_cache = {}
positions_cache = {}
account_summary_cache = {}
contract_details_cache = {}
pnl_cache = {}

# Webhook queue
execution_webhook_queue = queue.Queue()

# --- Utilities ---

def now_iso():
    return datetime.utcnow().isoformat() + "Z"

def update_diag(**updates):
    with data_lock:
        diag_state.update(updates)

def increment_diag(key, amount=1):
    with data_lock:
        diag_state[key] = diag_state.get(key, 0) + amount

def get_current_epoch():
    with data_lock:
        return connection_epoch

def bump_epoch():
    global connection_epoch
    with data_lock:
        connection_epoch += 1
        return connection_epoch

def safe_value(val):
    return val if val == val else None # Handle NaN

def safe_number(val):
    try:
        parsed = float(val)
        return parsed if parsed == parsed else None
    except Exception:
        return None

def is_valid_number(val):
    return val is not None and isinstance(val, (int, float)) and not math.isnan(val) and val > 0

def has_market_price(ticker):
    if not ticker: return False
    return (
        is_valid_number(safe_value(ticker.last)) or
        is_valid_number(safe_value(ticker.bid)) or
        is_valid_number(safe_value(ticker.close))
    )

def build_market_payload(symbol, ticker, source):
    return {
        "symbol": symbol,
        "last": safe_value(ticker.last),
        "bid": safe_value(ticker.bid),
        "ask": safe_value(ticker.ask),
        "high": safe_value(ticker.high),
        "low": safe_value(ticker.low),
        "volume": safe_value(ticker.volume),
        "close": safe_value(ticker.close),
        "source": source
    }

def cache_read(cache, key, ttl):
    with data_lock:
        entry = cache.get(key)
        if not entry: return None, None
        age = time.time() - entry["timestamp"]
        if age <= ttl: return entry["payload"], age
    return None, None

def cache_write(cache, key, payload):
    with data_lock:
        cache[key] = {"timestamp": time.time(), "payload": payload}

def cache_age(cache, key):
    with data_lock:
        entry = cache.get(key)
        if not entry: return None
        return max(0.0, time.time() - entry["timestamp"])

def contract_cache_key(contract):
    con_id = getattr(contract, "conId", None)
    if con_id:
        return f"conid:{con_id}"
    local_symbol = getattr(contract, "localSymbol", None)
    if local_symbol:
        return f"local:{local_symbol}"
    symbol = getattr(contract, "symbol", None)
    sec_type = getattr(contract, "secType", None)
    if symbol:
        return f"{(sec_type or 'UNK').upper()}:{symbol}"
    return None

def fetch_contract_company_name(contract, timeout, epoch):
    key = contract_cache_key(contract)
    if not key:
        return None
    cached, _ = cache_read(contract_details_cache, key, IB_CONTRACT_DETAILS_CACHE_TTL)
    if cached:
        return cached
    _ib = get_ib_instance()
    if not get_loop():
        return None
    if hasattr(_ib, "reqContractDetailsAsync"):
        f_details, err = submit_ib_call(_ib.reqContractDetailsAsync, contract, invoke_timeout=timeout)
        if err:
            return None
        details, err = wait_for_future(f_details, timeout, expected_epoch=epoch)
        if err or not details:
            return None
        detail = details[0]
    else:
        start = time.time()
        details = _ib.reqContractDetails(contract)
        if time.time() - start > timeout:
            return None
        detail = details[0] if details else None
    if not detail:
        return None
    name = getattr(detail, "longName", None)
    if name:
        cache_write(contract_details_cache, key, name)
    return name

def debug_log(message):
    if IB_DEBUG_LOGGING:
        logger.info(f"[debug] {message}")

request_context = threading.local()

def set_request_context(request_id, name):
    request_context.request_id = request_id
    request_context.name = name

def clear_request_context():
    request_context.request_id = None
    request_context.name = None

def log_ctx(level, message, **fields):
    request_id = getattr(request_context, "request_id", None)
    prefix = f"[req {request_id}] " if request_id else ""
    if fields:
        logger.log(level, f"{prefix}{message} | {fields}")
    else:
        logger.log(level, f"{prefix}{message}")

def new_request_id():
    return uuid.uuid4().hex[:8]

def get_lock_snapshot():
    with data_lock:
        return {k: dict(v) for k, v in lock_state.items()}

def get_health_snapshot():
    _ib = get_ib_instance()
    return {
        "ready": connection_ready.is_set(),
        "connected": _ib.isConnected(),
        "epoch": get_current_epoch(),
        "loop": get_loop_stats(get_loop()),
        "locks": get_lock_snapshot(),
        "diag": dict(diag_state)
    }

def acquire_bridge_lock(group, timeout, retries, backoff):
    lock = lock_registry.get(group, lock_registry["default"])
    start = time.time()
    acquired = acquire_lock(lock, timeout, retries, backoff)
    wait_ms = int((time.time() - start) * 1000)
    if acquired:
        with data_lock:
            state = lock_state.get(group)
            if state:
                state["inflight"] = max(0, state["inflight"]) + 1
                state["lastAcquireAt"] = now_iso()
                state["lastAcquireMs"] = wait_ms
    return acquired, wait_ms

def release_bridge_lock(group, hold_ms):
    lock = lock_registry.get(group, lock_registry["default"])
    try:
        lock.release()
    except RuntimeError:
        return
    with data_lock:
        state = lock_state.get(group)
        if state:
            state["inflight"] = max(0, state["inflight"] - 1)
            state["lastHoldMs"] = hold_ms
            state["maxHoldMs"] = max(state["maxHoldMs"], hold_ms)

class BridgeGuard:
    def __init__(self, name, group, timeout):
        self.name = name
        self.group = group
        self.timeout = timeout
        self.ok = False
        self.response = None
        self.status_code = None
        self.request_id = None
        self.start_time = None
        self.lock_start = None
        self.lock_wait_ms = None
        self.lock_hold_ms = None
        self.lock_acquired = False

    def __enter__(self):
        self.request_id = new_request_id()
        set_request_context(self.request_id, self.name)
        self.start_time = time.time()

        log_ctx(logging.INFO, f"{self.name} start", path=request.path, args=dict(request.args), ip=request.remote_addr)
        update_diag(lastRequestAt=now_iso(), lastRequestPath=request.path, lastRequestId=self.request_id)

        ready_start = time.time()
        if not wait_for_connection(self.timeout):
            ready_ms = int((time.time() - ready_start) * 1000)
            self.status_code = 503
            self.response = (jsonify({"error": "Bridge busy", "reason": "not-ready"}), 503)
            log_ctx(logging.WARNING, f"{self.name} not ready", waitMs=ready_ms, health=get_health_snapshot())
            return self

        ready_ms = int((time.time() - ready_start) * 1000)
        acquired, wait_ms = acquire_bridge_lock(self.group, self.timeout, IB_DATA_LOCK_RETRY_ATTEMPTS, IB_DATA_LOCK_RETRY_BACKOFF)
        if not acquired:
            self.status_code = 503
            self.response = (jsonify({"error": "Bridge busy", "reason": "lock-timeout"}), 503)
            log_ctx(logging.WARNING, f"{self.name} lock timeout", waitMs=wait_ms, readyMs=ready_ms, health=get_health_snapshot())
            return self

        self.lock_acquired = True
        self.lock_wait_ms = wait_ms
        self.lock_start = time.time()
        self.ok = True
        log_ctx(logging.INFO, f"{self.name} lock acquired", group=self.group, waitMs=wait_ms, readyMs=ready_ms)
        return self

    def respond(self, payload, status=200):
        self.status_code = status
        return jsonify(payload), status

    def error(self, status, message, **extra):
        self.status_code = status
        payload = {"error": message}
        payload.update(extra)
        return jsonify(payload), status

    def __exit__(self, exc_type, exc, tb):
        if self.lock_acquired:
            self.lock_hold_ms = int((time.time() - self.lock_start) * 1000)
            release_bridge_lock(self.group, self.lock_hold_ms)
            if self.lock_hold_ms >= IB_LOCK_WARN_THRESHOLD_MS:
                log_ctx(logging.WARNING, f"{self.name} long lock hold", holdMs=self.lock_hold_ms, group=self.group)

        duration_ms = int((time.time() - self.start_time) * 1000) if self.start_time else None
        status = self.status_code
        if status is None:
            status = 500 if exc else 200
        if exc:
            log_ctx(logging.ERROR, f"{self.name} exception", error=str(exc))
        log_ctx(logging.INFO, f"{self.name} done", status=status, durationMs=duration_ms, lockWaitMs=self.lock_wait_ms, lockHoldMs=self.lock_hold_ms)
        clear_request_context()
        return False

def get_loop_stats(loop):
    if not loop:
        return {"loop": "none"}
    stats = {}
    try:
        stats["running"] = loop.is_running()
    except Exception:
        stats["running"] = "unknown"
    try:
        stats["closed"] = loop.is_closed()
    except Exception:
        stats["closed"] = "unknown"
    try:
        stats["thread_id"] = getattr(loop, "_thread_id", None)
    except Exception:
        stats["thread_id"] = None
    try:
        tasks = asyncio.all_tasks(loop=loop)
        stats["tasks"] = len(tasks)
        stats["pending"] = sum(1 for t in tasks if not t.done())
    except Exception:
        stats["tasks"] = "unknown"
        stats["pending"] = "unknown"
    return stats

def submit_ib_call(fn, *args, invoke_timeout=None, **kwargs):
    loop = get_loop()
    if not loop:
        log_ctx(logging.WARNING, "submit_ib_call: no-loop", fn=getattr(fn, "__name__", "unknown"))
        return None, "no-loop"
    result_holder = {}
    done_event = threading.Event()
    def invoke():
        try:
            result_holder["result"] = fn(*args, **kwargs)
        except Exception as exc:
            result_holder["error"] = exc
        finally:
            done_event.set()
    loop.call_soon_threadsafe(invoke)
    timeout = invoke_timeout or IB_CONNECT_TIMEOUT
    if not done_event.wait(timeout=timeout):
        log_ctx(logging.WARNING, "submit_ib_call: invoke-timeout", fn=getattr(fn, "__name__", "unknown"), timeout=timeout)
        return None, "invoke-timeout"
    if "error" in result_holder:
        log_ctx(logging.ERROR, "submit_ib_call: invoke-error", fn=getattr(fn, "__name__", "unknown"), error=str(result_holder["error"]))
        return None, str(result_holder["error"])
    res = result_holder.get("result")
    if asyncio.iscoroutine(res):
        return asyncio.run_coroutine_threadsafe(res, loop), None
    if hasattr(res, "done"):
        return res, None
    return None, "unsupported-async-result"

def acquire_lock(lock, timeout, retries, backoff):
    attempts = max(1, retries)
    deadline = time.time() + timeout
    for attempt in range(attempts):
        remaining = max(0.0, deadline - time.time())
        if remaining <= 0:
            break
        if lock.acquire(timeout=remaining):
            return True
        if attempt < (attempts - 1) and backoff > 0:
            time.sleep(backoff)
    return False

@contextmanager
def ib_access(timeout=None, group="default"):
    start = time.time()
    acquired, _ = acquire_bridge_lock(
        group,
        timeout or IB_DATA_LOCK_TIMEOUT,
        IB_DATA_LOCK_RETRY_ATTEMPTS,
        IB_DATA_LOCK_RETRY_BACKOFF
    )
    try:
        yield acquired
    finally:
        if acquired:
            hold_ms = int((time.time() - start) * 1000)
            release_bridge_lock(group, hold_ms)

# --- Connection Management ---

def get_ib_instance():
    global ib
    with data_lock:
        if ib is None:
            ib = IB()
        return ib

def get_loop():
    global ib_loop
    with data_lock:
        return ib_loop

def set_loop(loop):
    global ib_loop
    with data_lock:
        ib_loop = loop
    loop_ready.set()

def wait_for_connection(timeout=None):
    return connection_ready.wait(timeout=timeout or IB_CONNECT_TIMEOUT)

def wait_for_future(future, timeout, expected_epoch=None):
    if asyncio.iscoroutine(future):
        try:
            return util.run(future, timeout=timeout), None
        except Exception as exc:
            log_ctx(logging.WARNING, "wait_for_future: coroutine error", error=str(exc), timeout=timeout)
            return None, "timeout" if "timeout" in str(exc).lower() else str(exc)
    
    start_time = time.time()
    while not future.done():
        if expected_epoch is not None and get_current_epoch() != expected_epoch:
            try: future.cancel()
            except: pass
            log_ctx(logging.WARNING, "wait_for_future: connection-reset", expectedEpoch=expected_epoch, currentEpoch=get_current_epoch())
            return None, "connection-reset"
        if time.time() - start_time > timeout:
            try: future.cancel()
            except: pass
            log_ctx(logging.WARNING, "wait_for_future: timeout", timeout=timeout)
            return None, "timeout"
        time.sleep(0.05)
    if future.cancelled(): return None, "cancelled"
    if future.exception(): return None, str(future.exception())
    return future.result(), None

# --- Listeners ---

def on_ib_error(req_id, error_code, error_message, contract):
    update_diag(
        lastIbErrorAt=now_iso(),
        lastIbErrorCode=error_code,
        lastIbErrorMessage=str(error_message)
    )
    if error_code in (2104, 2106, 2158):
        logger.debug(f"IB Status {error_code}: {error_message}")
    else:
        logger.warning(f"IB Error {error_code}: {error_message}")

def on_disconnect():
    logger.warning("IB Gateway disconnected.")
    connection_ready.clear()
    update_diag(lastDisconnectAt=now_iso())

def on_exec_details(trade, fill):
    if not EXECUTION_WEBHOOK_URL: return
    try:
        c = fill.contract
        e = fill.execution
        payload = {
            "executions": [{
                "execId": e.execId, "time": str(e.time), "symbol": c.symbol,
                "secType": c.secType, "side": e.side, "shares": e.shares,
                "price": e.price, "avgPrice": e.avgPrice, "orderRef": e.orderRef,
                "cumQty": e.cumQty, "strike": getattr(c, 'strike', None),
                "right": getattr(c, 'right', None), "expiration": getattr(c, 'lastTradeDateOrContractMonth', None),
            }]
        }
        execution_webhook_queue.put(payload)
    except Exception as e:
        logger.error(f"Exec detail processing failed: {e}")

# --- Background Tasks ---

def loop_driver():
    _ib = get_ib_instance()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    # Capture the loop associated with this thread
    set_loop(loop)
    logger.info(f"IB loop driver started with loop {get_loop()}")
    while True:
        try:
            if not loop.is_running():
                _ib.run()
            else:
                time.sleep(0.5)
        except Exception as e:
            logger.error(f"Loop driver exception: {e}")
            time.sleep(0.1)

def connection_monitor():
    _ib = get_ib_instance()
    _ib.errorEvent += on_ib_error
    _ib.disconnectedEvent += on_disconnect
    _ib.execDetailsEvent += on_exec_details
    logger.info(
        "Bridge config: host=%s port=%s clientId=%s tradingMode=%s heartbeatInterval=%s heartbeatTimeout=%s heartbeatFailuresBeforeExit=%s",
        IB_HOST, IB_PORT, IB_CLIENT_ID, IB_TRADING_MODE, IB_HEARTBEAT_INTERVAL, IB_HEARTBEAT_TIMEOUT, IB_HEARTBEAT_FAILURES_BEFORE_EXIT
    )
    
    last_hb = time.time()
    failures = 0
    while True:
        now = time.time()
        if not loop_ready.wait(timeout=1.0):
            time.sleep(0.5)
            continue
        if not _ib.isConnected():
            connection_ready.clear()
            if not connection_in_progress_lock.acquire(timeout=IB_CONNECT_TIMEOUT):
                time.sleep(1.0)
                continue
            # Use fixed ClientID for stability
            active_id = IB_CLIENT_ID
            logger.info(f"Connecting to {IB_HOST}:{IB_PORT} (clientId={active_id})")
            increment_diag("reconnectAttempts")
            try:
                loop = get_loop()
                if not loop:
                    raise RuntimeError("IB event loop not ready")
                fut = asyncio.run_coroutine_threadsafe(
                    _ib.connectAsync(IB_HOST, IB_PORT, clientId=active_id, timeout=IB_CONNECT_TIMEOUT),
                    loop
                )
                _, err = wait_for_future(fut, IB_CONNECT_TIMEOUT)
                if err:
                    raise RuntimeError(f"connect-async-failed: {err}")
                update_diag(lastConnectAt=now_iso())
                # Give it a moment to stabilize synchronization
                time.sleep(5.0)
                if _ib.isConnected():
                    logger.info("Connection established and synchronized. READY.")
                    bump_epoch()
                    connection_ready.set()
                    failures = 0
                last_hb = time.time()
            except Exception as e:
                logger.error(f"Connect failed: {e}")
                failures += 1
                time.sleep(IB_RECONNECT_INTERVAL)
                continue
            finally:
                try: connection_in_progress_lock.release()
                except RuntimeError: pass

        if (now - last_hb) >= IB_HEARTBEAT_INTERVAL:
            last_hb = now
            is_connected = _ib.isConnected()
            loop = get_loop()
            loop_ok = bool(loop and loop.is_running())
            
            logger.info(f"Heartbeat check: conn={is_connected}, loop={loop_ok}")
            success = is_connected and loop_ok
            
            if success:
                # Actual end-to-end check
                try:
                    hb_start = time.time()
                    debug_log(f"Heartbeat E2E start: epoch={get_current_epoch()} ready={connection_ready.is_set()} loop={get_loop_stats(loop)}")
                    # reqCurrentTimeAsync might return a Coroutine OR a Future
                    res_or_coro = _ib.reqCurrentTimeAsync()
                    if asyncio.iscoroutine(res_or_coro):
                        debug_log("Heartbeat E2E request returned coroutine.")
                        f = asyncio.run_coroutine_threadsafe(res_or_coro, loop)
                        _, err = wait_for_future(f, IB_HEARTBEAT_TIMEOUT)
                        if err:
                            logger.warning(f"Heartbeat E2E failed: {err}")
                            success = False
                    elif hasattr(res_or_coro, 'done'):
                        debug_log("Heartbeat E2E request returned future.")
                        # It's already a Future (likely from ib_insync internal logic)
                        _, err = wait_for_future(res_or_coro, IB_HEARTBEAT_TIMEOUT)
                        if err:
                            logger.warning(f"Heartbeat E2E future failed: {err}")
                            success = False
                    else:
                        debug_log(f"Heartbeat E2E request returned value: {res_or_coro}")
                        # It returned a result directly
                        if not res_or_coro: success = False
                    debug_log(f"Heartbeat E2E end: success={success} duration={time.time() - hb_start:.2f}s")
                except Exception as e:
                    logger.error(f"Heartbeat E2E exception: {e}")
                    success = False
            
            if success:
                update_diag(lastHeartbeatAt=now_iso(), heartbeatFailures=0)
                failures = 0
                if not connection_ready.is_set():
                    logger.info("Connection considered READY.")
                    bump_epoch()
                    connection_ready.set()
            else:
                failures += 1
                increment_diag("heartbeatFailures")
                connection_ready.clear()
                logger.warning(f"Heartbeat failed ({failures}/{IB_HEARTBEAT_FAILURES_BEFORE_EXIT})")
                if IB_HEARTBEAT_FAILURES_BEFORE_EXIT > 0 and failures >= IB_HEARTBEAT_FAILURES_BEFORE_EXIT:
                    logger.warning("Heartbeat failure threshold reached; disconnecting.")
                    try:
                        loop = get_loop()
                        if loop:
                            loop.call_soon_threadsafe(_ib.disconnect)
                        else:
                            _ib.disconnect()
                    except: pass
                    os._exit(1)
        time.sleep(1.0)

def webhook_worker():
    logger.info("Webhook worker started.")
    while True:
        payload = execution_webhook_queue.get()
        if not EXECUTION_WEBHOOK_URL:
            execution_webhook_queue.task_done()
            continue
        try:
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                EXECUTION_WEBHOOK_URL, data=data,
                headers={'Content-Type': 'application/json', 'X-API-KEY': BRIDGE_API_KEY or ''},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=10) as res: res.read()
        except Exception as e: logger.error(f"Webhook failed: {e}")
        finally: execution_webhook_queue.task_done()

# --- snapshot fetchers ---

def get_contract(symbol, sec_type='STK', exchange='SMART', currency='USD'):
    symbol = symbol.upper()
    if sec_type == 'STK':
        if symbol in ('VIX', 'SPX', 'NDX', 'RUT', 'VIXW'):
            return Index(symbol, 'CBOE' if symbol.startswith('VIX') else 'SMART', currency)
        return Stock(symbol, exchange, currency)
    return Stock(symbol, exchange, currency)

def fetch_market_data_snapshot(symbol, data_type, timeout):
    _ib = get_ib_instance()
    epoch = get_current_epoch()
    contract = get_contract(symbol)
    if not get_loop():
        debug_log(f"[{symbol}] Snapshot type={data_type} failed: no-loop")
        return None, "no-loop"
    
    logger.info(f"[{symbol}] Snapshot (type={data_type})")
    
    f_qual, err = submit_ib_call(_ib.qualifyContractsAsync, contract, invoke_timeout=IB_CONTRACT_QUALIFY_TIMEOUT)
    if err:
        debug_log(f"[{symbol}] Qualify submit failed type={data_type} err={err}")
        return None, f"qualify-submit-failed: {err}"
    _, err = wait_for_future(f_qual, IB_CONTRACT_QUALIFY_TIMEOUT, expected_epoch=epoch)
    if err:
        debug_log(f"[{symbol}] Qualify failed type={data_type} err={err}")
        return None, f"qualify-failed: {err}"
    
    _ib.reqMarketDataType(data_type)
    f_ticker, err = submit_ib_call(_ib.reqTickersAsync, contract, invoke_timeout=timeout)
    if err:
        debug_log(f"[{symbol}] Ticker submit failed type={data_type} err={err}")
        return None, f"tickers-submit-failed: {err}"
    res, err = wait_for_future(f_ticker, timeout, expected_epoch=epoch)
    
    if err:
        debug_log(f"[{symbol}] Snapshot type={data_type} error={err}")
        return None, err
    if res:
        ticker = res[0]
        if has_market_price(ticker):
            debug_log(f"[{symbol}] Snapshot type={data_type} ok last={ticker.last} bid={ticker.bid} ask={ticker.ask} close={ticker.close}")
            return ticker, None
        debug_log(f"[{symbol}] Snapshot type={data_type} no-price last={ticker.last} bid={ticker.bid} ask={ticker.ask} close={ticker.close}")
        return ticker, "no-price"
    return None, "empty"

def fetch_market_data_batch(symbols, data_type, timeout):
    if not symbols: return {}, None
    _ib = get_ib_instance()
    epoch = get_current_epoch()
    contracts = [get_contract(s) for s in symbols]
    if not get_loop(): return {}, "no-loop"
    
    f_qual, err = submit_ib_call(_ib.qualifyContractsAsync, *contracts, invoke_timeout=IB_CONTRACT_QUALIFY_TIMEOUT)
    if err: return None, f"qualify-submit-failed: {err}"
    wait_for_future(f_qual, IB_CONTRACT_QUALIFY_TIMEOUT, expected_epoch=epoch)
    
    _ib.reqMarketDataType(data_type)
    f_tickers, err = submit_ib_call(_ib.reqTickersAsync, *contracts, invoke_timeout=timeout)
    if err: return None, f"tickers-submit-failed: {err}"
    tickers, err = wait_for_future(f_tickers, timeout, expected_epoch=epoch)
    
    if err: return None, err
    return {t.contract.symbol: t for t in tickers if t.contract}, None

def fetch_underlying_price(symbol):
    cached, _ = cache_read(market_data_cache, symbol.upper(), IB_MARKET_DATA_CACHE_TTL)
    if cached: return cached.get("last") or cached.get("bid") or cached.get("close")
    ticker, _ = fetch_market_data_snapshot(symbol, 1, 2.0)
    if ticker: return safe_value(ticker.last) or safe_value(ticker.bid) or safe_value(ticker.close)
    return None

def extract_option_greeks(ticker):
    if not ticker:
        return {}
    greeks = None
    for attr in ("modelGreeks", "lastGreeks", "bidGreeks", "askGreeks"):
        candidate = getattr(ticker, attr, None)
        if candidate:
            greeks = candidate
            break
    if not greeks:
        return {}
    return {
        "delta": safe_number(getattr(greeks, "delta", None)),
        "gamma": safe_number(getattr(greeks, "gamma", None)),
        "theta": safe_number(getattr(greeks, "theta", None)),
        "vega": safe_number(getattr(greeks, "vega", None)),
        "impliedVol": safe_number(getattr(greeks, "impliedVol", None))
    }

def apply_option_fallbacks(response, req, und_price):
    if not is_valid_number(response.get('bid')):
        val = response.get('last') or response.get('close')
        if is_valid_number(val): response['bid'] = response['ask'] = val
    if response.get('delta') is None and is_valid_number(und_price) and is_valid_number(response.get('bid')):
        try:
            premium = (response['bid'] + (response.get('ask') or response['bid'])) / 2
            exp = datetime.strptime(req['expiration'], '%Y%m%d')
            dte = max(1, (exp - datetime.now()).days)
            if req['right'] == 'C':
                bs = mibian.BS([und_price, float(req['strike']), 4.5, dte], callPrice=premium)
                response['delta'] = bs.callDelta
                theta = getattr(bs, "callTheta", None)
            else:
                bs = mibian.BS([und_price, float(req['strike']), 4.5, dte], putPrice=premium)
                response['delta'] = bs.putDelta
                theta = getattr(bs, "putTheta", None)
            response['impliedVol'] = bs.impliedVolatility / 100
            if response.get('gamma') is None:
                response['gamma'] = safe_number(getattr(bs, "gamma", None))
            if response.get('vega') is None:
                response['vega'] = safe_number(getattr(bs, "vega", None))
            if response.get('theta') is None and theta is not None:
                response['theta'] = safe_number(theta)
            response['source'] = f"{response.get('source', 'realtime')}+calc"
        except: pass
    return response

def fetch_account_summary(timeout):
    _ib = get_ib_instance()
    if not get_loop():
        return None, "no-loop"
    if hasattr(_ib, "accountSummaryAsync"):
        f, err = submit_ib_call(_ib.accountSummaryAsync, invoke_timeout=timeout)
        if err:
            return None, err
        res, err = wait_for_future(f, timeout)
        return res, err
    if hasattr(_ib, "reqAccountSummaryAsync"):
        tags = "NetLiquidation,TotalCashValue,BuyingPower,AvailableFunds,ExcessLiquidity,DailyPnL,RealizedPnL,UnrealizedPnL"
        f, err = submit_ib_call(_ib.reqAccountSummaryAsync, "All", tags, invoke_timeout=timeout)
        if err:
            return None, err
        res, err = wait_for_future(f, timeout)
        return res, err
    # Fallback to sync call (may block).
    start = time.time()
    res = _ib.accountSummary()
    elapsed = time.time() - start
    if elapsed > timeout:
        return None, "timeout"
    return res, None

def request_option_chain_payload(symbol):
    _ib = get_ib_instance()
    epoch = get_current_epoch()
    stock = get_contract(symbol)
    if not get_loop():
        debug_log(f"[{symbol}] Option chain failed: no-loop")
        return None, "no-loop"
    
    f_qual, err = submit_ib_call(_ib.qualifyContractsAsync, stock, invoke_timeout=IB_CONTRACT_QUALIFY_TIMEOUT)
    if err:
        debug_log(f"[{symbol}] Option chain qualify submit failed err={err}")
        return None, f"qualify-submit-failed: {err}"
    _, err = wait_for_future(f_qual, 5.0, expected_epoch=epoch)
    
    f_chain, err = submit_ib_call(_ib.reqSecDefOptParamsAsync, stock.symbol, '', stock.secType, stock.conId, invoke_timeout=10.0)
    if err:
        debug_log(f"[{symbol}] Option chain submit failed err={err}")
        return None, f"chain-submit-failed: {err}"
    chains, err = wait_for_future(f_chain, 10.0, expected_epoch=epoch)
    if err or not chains:
        debug_log(f"[{symbol}] Option chain failed err={err} chains={len(chains) if chains else 0}")
        return None, err or "empty"
    
    sym_upper = symbol.upper()
    target = next(
        (c for c in chains if getattr(c, 'tradingClass', '').upper() == sym_upper),
        None
    )
    if not target:
        target = next((c for c in chains if c.exchange == 'SMART'), chains[0])
    return {
        "symbol": symbol,
        "expirations": sorted(target.expirations),
        "strikes": sorted(target.strikes),
        "multiplier": target.multiplier,
        "exchange": getattr(target, 'exchange', None),
        "currency": getattr(target, 'currency', None) or 'USD',
        "tradingClass": getattr(target, 'tradingClass', None),
        "underlyingConId": getattr(target, 'underlyingConId', None),
    }, None

# --- endpoints ---

@app.before_request
def auth():
    if request.method == 'OPTIONS': return
    if request.path in ('/health', '/ping', '/diag'): return
    if BRIDGE_API_KEY and request.headers.get('X-API-KEY') != BRIDGE_API_KEY:
        logger.warning("Unauthorized request", extra={"path": request.path, "ip": request.remote_addr})
        return jsonify({"error": "Unauthorized"}), 401

@app.route('/ping')
def ping():
    return jsonify({"status": "ok", "timestamp": int(time.time()*1000)})

@app.route('/health')
def health():
    ready = connection_ready.is_set()
    _ib = get_ib_instance()
    res = {
        "status": "ok" if ready else "disconnected",
        "connected": _ib.isConnected(),
        "ready": ready,
        "clientId": IB_CLIENT_ID,
        "host": IB_HOST,
        "port": IB_PORT,
        "clientType": IB_CLIENT_TYPE,
        "tradingMode": IB_TRADING_MODE
    }
    with data_lock: res.update(diag_state)
    return jsonify(res)

@app.route('/diag')
def diag():
    _ib = get_ib_instance()
    with data_lock: d = dict(diag_state)
    return jsonify({
        "timestamp": now_iso(), "uptimeSeconds": int(time.time() - bridge_start_time),
        "ibConnected": _ib.isConnected(), "ready": connection_ready.is_set(),
        "epoch": get_current_epoch(), "diag": d,
        "locks": get_lock_snapshot(),
        "caches": {
            "marketDataEntries": len(market_data_cache),
            "optionChainEntries": len(option_chain_cache),
            "historicalEntries": len(historical_cache),
            "executionsEntries": len(executions_cache),
            "positionsEntries": len(positions_cache),
            "accountSummaryEntries": len(account_summary_cache)
        }
    })

@app.route('/market-data/<symbol>')
def get_market_data(symbol):
    with BridgeGuard("market-data", group="market", timeout=2.0) as guard:
        if not guard.ok:
            return guard.response
        cached, _ = cache_read(market_data_cache, symbol.upper(), IB_MARKET_DATA_CACHE_TTL)
        if cached:
            return guard.respond(cached, 200)
        tier_debug = []
        for tier, dtype in [("realtime", 1), ("frozen", 2), ("delayed", 3)]:
            ticker, err = fetch_market_data_snapshot(symbol, dtype, 2.0)
            if not err and has_market_price(ticker):
                payload = build_market_payload(symbol, ticker, tier)
                cache_write(market_data_cache, symbol.upper(), payload)
                return guard.respond(payload, 200)
            tier_debug.append({
                "tier": tier,
                "err": err,
                "last": safe_value(ticker.last) if ticker else None,
                "bid": safe_value(ticker.bid) if ticker else None,
                "ask": safe_value(ticker.ask) if ticker else None,
                "close": safe_value(ticker.close) if ticker else None,
            })
        debug_log(f"[{symbol}] No market data. tiers={tier_debug} lastIbError={diag_state.get('lastIbErrorCode')}:{diag_state.get('lastIbErrorMessage')}")
        return guard.error(404, "No market data")

@app.route('/market-data/batch', methods=['POST'])
def get_market_data_batch():
    with BridgeGuard("market-data-batch", group="market", timeout=10.0) as guard:
        if not guard.ok:
            return guard.response
        data = request.json
        symbols = data.get('symbols', [])
        if not symbols:
            return guard.respond({"results": []}, 200)
        
        results = []
        remaining_symbols = []
        for s in symbols:
            s_upper = s.upper()
            cached, _ = cache_read(market_data_cache, s_upper, IB_MARKET_DATA_CACHE_TTL)
            if cached:
                results.append(cached)
            else:
                remaining_symbols.append(s_upper)
        
        if remaining_symbols:
            for tier, dtype in [("realtime", 1), ("frozen", 2), ("delayed", 3)]:
                tickers, err = fetch_market_data_batch(remaining_symbols, dtype, 5.0)
                if not err and tickers:
                    for s_upper in list(remaining_symbols):
                        ticker = tickers.get(s_upper)
                        if ticker and has_market_price(ticker):
                            payload = build_market_payload(s_upper, ticker, tier)
                            cache_write(market_data_cache, s_upper, payload)
                            results.append(payload)
                            remaining_symbols.remove(s_upper)
                if not remaining_symbols:
                    break
        
        return guard.respond({"results": results}, 200)

@app.route('/option-chain/<symbol>')
def get_option_chain(symbol):
    with BridgeGuard("option-chain", group="options", timeout=2.0) as guard:
        if not guard.ok:
            return guard.response
        cached, _ = cache_read(option_chain_cache, symbol.upper(), IB_OPTION_CHAIN_CACHE_TTL)
        if cached:
            return guard.respond(cached, 200)
        
        payload, err = request_option_chain_payload(symbol)
        if err:
            return guard.error(500, err)
        cache_write(option_chain_cache, symbol.upper(), payload)
        return guard.respond(payload, 200)

@app.route('/option-quote', methods=['POST'])
def get_option_quote():
    with BridgeGuard("option-quote", group="options", timeout=5.0) as guard:
        if not guard.ok:
            return guard.response
        data = request.json
        currency = data.get('currency') or 'USD'
        trading_class = data.get('tradingClass')
        exchange = data.get('exchange') or 'SMART'
        opt = Option(
            symbol=data['symbol'],
            lastTradeDateOrContractMonth=data['expiration'],
            strike=float(data['strike']),
            right=data['right'],
            exchange=exchange,
            multiplier=str(data.get('multiplier') or ''),
            currency=currency,
            tradingClass=trading_class or ''
        )
        if data.get('conId'):
            try:
                opt.conId = int(data['conId'])
            except Exception:
                pass
        _ib = get_ib_instance()
        if not get_loop():
            return guard.error(500, "no-loop")
        
        f_qual, err = submit_ib_call(_ib.qualifyContractsAsync, opt, invoke_timeout=IB_CONTRACT_QUALIFY_TIMEOUT)
        if err:
            return guard.error(500, f"qualify-submit-failed: {err}")
        _, err = wait_for_future(f_qual, 5.0)
        if err:
            return guard.error(500, f"qualify-failed: {err}")
        
        _ib.reqMarketDataType(3)
        f_ticker, err = submit_ib_call(_ib.reqTickersAsync, opt, invoke_timeout=5.0)
        if err:
            return guard.error(500, f"tickers-submit-failed: {err}")
        res, err = wait_for_future(f_ticker, 5.0)
        
        if not res:
            return guard.error(404, err or "No data")
        ticker = res[0]
        und = fetch_underlying_price(data['symbol'])
        greeks = extract_option_greeks(ticker)
        resp = {
            "symbol": data['symbol'],
            "bid": safe_value(ticker.bid),
            "ask": safe_value(ticker.ask),
            "last": safe_value(ticker.last),
            "close": safe_value(ticker.close),
            "undPrice": und,
            "source": "delayed"
        }
        for key, value in greeks.items():
            if value is not None:
                resp[key] = value
        resp = apply_option_fallbacks(resp, data, und)
        return guard.respond(resp, 200)

@app.route('/historical', methods=['POST'])
def get_historical():
    with BridgeGuard("historical", group="historical", timeout=5.0) as guard:
        if not guard.ok:
            return guard.response
        d = request.json
        sec_type = (d.get('secType') or d.get('sectype') or 'STK').upper()
        symbol = d.get('symbol')
        if not symbol:
            return guard.error(400, "missing-symbol")
        if sec_type in ('OPT', 'OPTION'):
            expiration = d.get('expiration') or d.get('lastTradeDateOrContractMonth')
            strike = d.get('strike')
            right = d.get('right')
            if not expiration or strike is None or not right:
                return guard.error(400, "missing-option-fields")
            exchange = d.get('exchange', 'SMART')
            currency = d.get('currency', 'USD')
            trading_class = d.get('tradingClass') or d.get('trading_class')
            multiplier = d.get('multiplier')
            contract = Option(
                symbol=symbol,
                lastTradeDateOrContractMonth=str(expiration),
                strike=float(strike),
                right=str(right).upper(),
                exchange=exchange,
                currency=currency,
                tradingClass=trading_class or None,
                multiplier=multiplier or None
            )
        else:
            contract = Stock(symbol, 'SMART', 'USD')
        _ib = get_ib_instance()
        if not get_loop():
            return guard.error(500, "no-loop")

        if sec_type in ('OPT', 'OPTION'):
            f_qual, err = submit_ib_call(_ib.qualifyContractsAsync, contract, invoke_timeout=IB_CONTRACT_QUALIFY_TIMEOUT)
            if err:
                return guard.error(500, f"qualify-submit-failed: {err}")
            qual, err = wait_for_future(f_qual, 5.0)
            if err:
                return guard.error(500, f"qualify-failed: {err}")
            if qual:
                contract = qual[0]
        
        f_hist, err = submit_ib_call(_ib.reqHistoricalDataAsync,
            contract, endDateTime=d.get('endDateTime', ''), durationStr=d.get('duration', '1 M'),
            barSizeSetting=d.get('barSize', '1 day'), whatToShow=d.get('whatToShow', 'TRADES'),
            useRTH=(str(d.get('useRTH', True)).lower() not in ('0', 'false', 'no')),
            invoke_timeout=20.0
        )
        if err:
            return guard.error(500, f"historical-submit-failed: {err}")
        bars, err = wait_for_future(f_hist, 20.0)
        if err:
            return guard.error(500, err)

        def build_bar_payload(bar):
            avg = safe_value(getattr(bar, 'average', None))
            if avg is None:
                avg = safe_value(getattr(bar, 'wap', None))
            return {
                "date": str(bar.date),
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume,
                "average": avg
            }

        return guard.respond({
            "symbol": d['symbol'],
            "bars": [build_bar_payload(b) for b in bars]
        }, 200)

@app.route('/order', methods=['POST'])
def place_order():
    with BridgeGuard("order", group="orders", timeout=5.0) as guard:
        if not guard.ok:
            return guard.response
        d = request.json
        if d.get('secType') == 'OPT':
            contract = Option(d['symbol'], d['expiration'], float(d['strike']), d['right'], 'SMART')
        else:
            contract = Stock(d['symbol'], 'SMART', 'USD')
        _ib = get_ib_instance()
        order = LimitOrder(d['action'], float(d['quantity']), float(d['limitPrice'])) if d.get('orderType', 'LMT') == 'LMT' else MarketOrder(d['action'], float(d['quantity']))
        order.orderRef = d.get('uid', 'anon')
        trade = _ib.placeOrder(contract, order)
        return guard.respond({"orderId": trade.order.orderId, "status": trade.orderStatus.status}, 200)

@app.route('/order/cancel', methods=['POST'])
def cancel_order():
    with BridgeGuard("order-cancel", group="orders", timeout=IB_ORDERS_TIMEOUT) as guard:
        if not guard.ok:
            return guard.response
        d = request.json or {}
        order_id = d.get('orderId')
        perm_id = d.get('permId')
        try:
            order_id = int(order_id) if order_id is not None else None
        except Exception:
            order_id = None
        try:
            perm_id = int(perm_id) if perm_id is not None else None
        except Exception:
            perm_id = None
        if order_id is None and perm_id is None:
            return guard.error(400, "missing-order-id")

        _ib = get_ib_instance()
        if not get_loop():
            update_diag(lastOrdersAt=now_iso(), lastOrdersError="no-loop")
            return guard.error(500, "no-loop")

        f, err = submit_ib_call(_ib.reqOpenOrdersAsync, invoke_timeout=IB_ORDERS_TIMEOUT)
        if err:
            update_diag(lastOrdersAt=now_iso(), lastOrdersError=err)
            return guard.error(500, f"orders-submit-failed: {err}")
        res, err = wait_for_future(f, IB_ORDERS_TIMEOUT)
        if err:
            update_diag(lastOrdersAt=now_iso(), lastOrdersError=err)
            return guard.error(500, err)

        trades = res if res is not None else []
        match = None
        for trade in trades:
            try:
                order = trade.order
            except Exception:
                continue
            oid = getattr(order, "orderId", None)
            pid = getattr(order, "permId", None)
            if order_id is not None and oid == order_id:
                match = trade
                break
            if perm_id is not None and pid == perm_id:
                match = trade
                break

        if not match:
            if order_id is not None:
                try:
                    _ib.client.cancelOrder(order_id)
                    with data_lock:
                        orders_cache.pop("orders", None)
                    return guard.respond({
                        "orderId": order_id,
                        "permId": perm_id,
                        "status": "CancelRequested",
                        "message": "cancel sent by orderId"
                    }, 200)
                except Exception as exc:
                    return guard.error(404, "order-not-found", detail=str(exc))
            return guard.error(404, "order-not-found")

        order = match.order
        try:
            _ib.cancelOrder(order)
        except Exception as exc:
            return guard.error(500, "cancel-failed", detail=str(exc))

        with data_lock:
            orders_cache.pop("orders", None)

        status = getattr(match.orderStatus, "status", None) or "CancelRequested"
        return guard.respond({
            "orderId": getattr(order, "orderId", None),
            "permId": getattr(order, "permId", None),
            "status": status,
            "message": "cancel requested"
        }, 200)

@app.route('/executions')
def get_executions():
    with BridgeGuard("executions", group="executions", timeout=IB_EXECUTIONS_TIMEOUT) as guard:
        if not guard.ok:
            days = float(request.args.get('lookbackDays', 7))
            cache_key = f"executions:{days}"
            cached, age = cache_read(executions_cache, cache_key, IB_EXECUTIONS_CACHE_TTL)
            if cached:
                log_ctx(logging.WARNING, "serving cached executions", age=age, lookbackDays=days)
                return guard.respond(cached, 200)
            return guard.response
        _ib = get_ib_instance()
        days = float(request.args.get('lookbackDays', 7))
        filt = ExecutionFilter(time=(datetime.utcnow() - timedelta(days=days)).strftime('%Y%m%d %H:%M:%S UTC'))
        if not get_loop():
            return guard.error(500, "no-loop")
        f, err = submit_ib_call(_ib.reqExecutionsAsync, filt, invoke_timeout=IB_EXECUTIONS_TIMEOUT)
        if err:
            return guard.error(500, f"executions-submit-failed: {err}")
        res, err = wait_for_future(f, IB_EXECUTIONS_TIMEOUT)
        if err:
            return guard.error(500, err)
        results = [{
            "execId": e.execution.execId,
            "symbol": e.contract.symbol,
            "side": e.execution.side,
            "shares": e.execution.shares,
            "price": e.execution.price,
            "commission": safe_number(getattr(getattr(e, "commissionReport", None), "commission", None)),
            "time": str(e.execution.time),
            "orderRef": e.execution.orderRef,
            "secType": getattr(e.contract, "secType", None),
            "right": getattr(e.contract, "right", None),
            "strike": getattr(e.contract, "strike", None),
            "expiration": getattr(e.contract, "lastTradeDateOrContractMonth", None),
            "localSymbol": getattr(e.contract, "localSymbol", None),
            "conId": getattr(e.contract, "conId", None),
            "multiplier": getattr(e.contract, "multiplier", None),
        } for e in res]
        payload = {"executions": results, "count": len(results)}
        cache_write(executions_cache, f"executions:{days}", payload)
        return guard.respond(payload, 200)

@app.route('/orders')
def get_orders():
    with BridgeGuard("orders", group="orders", timeout=IB_ORDERS_TIMEOUT) as guard:
        if not guard.ok:
            cached, age = cache_read(orders_cache, "orders", IB_ORDERS_CACHE_TTL)
            if cached:
                log_ctx(logging.WARNING, "serving cached orders", age=age)
                return guard.respond(cached, 200)
            return guard.response
        start = time.time()
        _ib = get_ib_instance()
        if not get_loop():
            update_diag(lastOrdersAt=now_iso(), lastOrdersError="no-loop")
            return guard.error(500, "no-loop")
        f, err = submit_ib_call(_ib.reqOpenOrdersAsync, invoke_timeout=IB_ORDERS_TIMEOUT)
        if err:
            update_diag(lastOrdersAt=now_iso(), lastOrdersError=err)
            return guard.error(500, f"orders-submit-failed: {err}")
        res, err = wait_for_future(f, IB_ORDERS_TIMEOUT)
        if err:
            update_diag(lastOrdersAt=now_iso(), lastOrdersError=err)
            return guard.error(500, err)

        trades = res if res is not None else []
        results = []
        for trade in trades:
            try:
                order = trade.order
                status = trade.orderStatus
                contract = trade.contract
                order_state = getattr(trade, "orderState", None)
            except Exception:
                continue
            results.append({
                "orderId": getattr(order, "orderId", None),
                "permId": getattr(order, "permId", None),
                "status": getattr(status, "status", None),
                "action": getattr(order, "action", None),
                "orderType": getattr(order, "orderType", None),
                "lmtPrice": safe_value(getattr(order, "lmtPrice", None)),
                "auxPrice": safe_value(getattr(order, "auxPrice", None)),
                "totalQuantity": safe_value(getattr(order, "totalQuantity", None)),
                "remaining": safe_value(getattr(status, "remaining", None)),
                "filled": safe_value(getattr(status, "filled", None)),
                "avgFillPrice": safe_value(getattr(status, "avgFillPrice", None)),
                "tif": getattr(order, "tif", None),
                "account": getattr(status, "account", None),
                "orderRef": getattr(order, "orderRef", None),
                "initMarginChange": safe_number(getattr(order_state, "initMarginChange", None)),
                "symbol": getattr(contract, "symbol", None),
                "secType": getattr(contract, "secType", None),
                "right": getattr(contract, "right", None),
                "strike": safe_value(getattr(contract, "strike", None)),
                "expiration": getattr(contract, "lastTradeDateOrContractMonth", None),
                "localSymbol": getattr(contract, "localSymbol", None),
                "conId": getattr(contract, "conId", None),
                "multiplier": safe_value(getattr(contract, "multiplier", None)),
                "currency": getattr(contract, "currency", None),
                "exchange": getattr(contract, "exchange", None)
            })

        duration_ms = int((time.time() - start) * 1000)
        update_diag(
            lastOrdersAt=now_iso(),
            lastOrdersMs=duration_ms,
            lastOrdersCount=len(results),
            lastOrdersError=None
        )
        payload = {"orders": results, "count": len(results)}
        cache_write(orders_cache, "orders", payload)
        return guard.respond(payload, 200)

@app.route('/positions')
def get_positions():
    with BridgeGuard("positions", group="portfolio", timeout=2.0) as guard:
        if not guard.ok:
            cached, age = cache_read(positions_cache, "positions", IB_PORTFOLIO_CACHE_TTL)
            if cached:
                log_ctx(logging.WARNING, "serving cached positions", age=age)
                return guard.respond(cached, 200)
            return guard.response
        start = time.time()
        try:
            pos = get_ib_instance().positions()
        except Exception as exc:
            update_diag(lastPositionsAt=now_iso(), lastPositionsError=str(exc))
            return guard.error(500, "positions-failed", detail=str(exc))
        duration_ms = int((time.time() - start) * 1000)
        epoch = get_current_epoch()
        payload = {
            "positions": [
                {
                    "account": p.account,
                    "symbol": p.contract.symbol,
                    "quantity": p.position,
                    "avgCost": p.avgCost,
                    "secType": getattr(p.contract, "secType", None),
                    "right": getattr(p.contract, "right", None),
                    "strike": getattr(p.contract, "strike", None),
                    "expiration": getattr(p.contract, "lastTradeDateOrContractMonth", None),
                    "localSymbol": getattr(p.contract, "localSymbol", None),
                    "conId": getattr(p.contract, "conId", None),
                    "multiplier": getattr(p.contract, "multiplier", None),
                    "companyName": fetch_contract_company_name(p.contract, IB_CONTRACT_DETAILS_TIMEOUT, epoch)
                        if getattr(p.contract, "secType", None) in ("STK", "ETF")
                        else None,
                }
                for p in pos
            ],
            "count": len(pos)
        }
        update_diag(
            lastPositionsAt=now_iso(),
            lastPositionsMs=duration_ms,
            lastPositionsCount=len(pos),
            lastPositionsError=None
        )
        cache_write(positions_cache, "positions", payload)
        return guard.respond(payload, 200)

@app.route('/portfolio')
def get_portfolio():
    with BridgeGuard("portfolio", group="portfolio", timeout=5.0) as guard:
        if not guard.ok:
            cached, age = cache_read(positions_cache, "portfolio", IB_PORTFOLIO_CACHE_TTL)
            if cached:
                log_ctx(logging.WARNING, "serving cached portfolio", age=age)
                return guard.respond(cached, 200)
            return guard.response
        
        start = time.time()
        try:
            port = get_ib_instance().portfolio()
        except Exception as exc:
            return guard.error(500, "portfolio-failed", detail=str(exc))
        
        duration_ms = int((time.time() - start) * 1000)
        
        payload = {
            "positions": [
                {
                    "account": p.account,
                    "symbol": p.contract.symbol,
                    "quantity": p.position,
                    "avgCost": p.averageCost,
                    "marketPrice": p.marketPrice,
                    "marketValue": p.marketValue,
                    "realizedPnl": p.realizedPNL,
                    "unrealizedPnl": p.unrealizedPNL,
                    "secType": getattr(p.contract, "secType", None),
                    "right": getattr(p.contract, "right", None),
                    "strike": getattr(p.contract, "strike", None),
                    "expiration": getattr(p.contract, "lastTradeDateOrContractMonth", None),
                    "localSymbol": getattr(p.contract, "localSymbol", None),
                    "conId": getattr(p.contract, "conId", None),
                    "multiplier": getattr(p.contract, "multiplier", None),
                }
                for p in port
            ],
            "count": len(port)
        }
        
        update_diag(
            lastPortfolioAt=now_iso(),
            lastPortfolioMs=duration_ms,
            lastPortfolioCount=len(port)
        )
        cache_write(positions_cache, "portfolio", payload)
        return guard.respond(payload, 200)

@app.route('/account-summary')
def get_account_summary():
    with BridgeGuard("account-summary", group="portfolio", timeout=2.0) as guard:
        if not guard.ok:
            cached, age = cache_read(account_summary_cache, "account-summary", IB_PORTFOLIO_CACHE_TTL)
            if cached:
                log_ctx(logging.WARNING, "serving cached account summary", age=age)
                return guard.respond(cached, 200)
            return guard.response
        start = time.time()
        summ, err = fetch_account_summary(IB_ACCOUNT_SUMMARY_TIMEOUT)
        duration_ms = int((time.time() - start) * 1000)
        if err:
            update_diag(lastAccountSummaryAt=now_iso(), lastAccountSummaryMs=duration_ms, lastAccountSummaryError=str(err))
            return guard.error(500, "account-summary-failed", detail=str(err))
        if summ is None:
            update_diag(lastAccountSummaryAt=now_iso(), lastAccountSummaryMs=duration_ms, lastAccountSummaryError="empty")
            return guard.error(500, "account-summary-empty")
        allowed_tags = (
            'NetLiquidation',
            'TotalCashValue',
            'BuyingPower',
            'AvailableFunds',
            'ExcessLiquidity',
            'DailyPnL',
            'RealizedPnL',
            'UnrealizedPnL',
            'AccountCode'
        )
        base_currency_tags = ('NetLiquidation', 'DailyPnL', 'RealizedPnL', 'UnrealizedPnL')
        payload = {}
        for s in summ:
            if s.tag not in allowed_tags:
                continue
            
            # AccountCode is a string, handle separately
            if s.tag == 'AccountCode':
                payload[s.tag] = str(s.value)
                continue

            currency = (s.currency or '').strip().upper()
            is_usd = currency == 'USD'
            is_base = currency in ('', 'BASE')
            if not (is_usd or (is_base and s.tag in base_currency_tags)):
                continue
            payload[s.tag] = safe_number(s.value)
        
        update_diag(lastAccountSummaryAt=now_iso(), lastAccountSummaryMs=duration_ms, lastAccountSummaryCount=len(payload))
        cache_write(account_summary_cache, "account-summary", payload)
        return guard.respond(payload, 200)

@app.route('/pnl')
def get_pnl():
    with BridgeGuard("pnl", group="portfolio", timeout=5.0) as guard:
        if not guard.ok:
            return guard.response
        acc = request.args.get('account') or ''
        model = request.args.get('model') or ''
        
        cache_key = f"acc:{acc}:mod:{model}"
        cached, age = cache_read(pnl_cache, cache_key, 5.0) # 5s TTL
        if cached:
            return guard.respond(cached, 200)

        _ib = get_ib_instance()
        pnl = _ib.reqPnL(acc, model)
        
        # Wait for update
        start = time.time()
        while time.time() - start < 3.0:
            if pnl.dailyPnL is not None or pnl.unrealizedPnL is not None:
                break
            time.sleep(0.1)
        
        res = {
            "dailyPnL": safe_value(pnl.dailyPnL),
            "unrealizedPnL": safe_value(pnl.unrealizedPnL),
            "realizedPnL": safe_value(pnl.realizedPnL),
            "value": safe_value(pnl.value)
        }
        _ib.cancelPnL(acc, model)
        cache_write(pnl_cache, cache_key, res)
        return guard.respond(res, 200)

@app.route('/pnl-single')
def get_pnl_single():
    with BridgeGuard("pnl-single", group="portfolio", timeout=5.0) as guard:
        if not guard.ok:
            return guard.response
        acc = request.args.get('account') or ''
        model = request.args.get('model') or ''
        con_id = request.args.get('conId')
        if not con_id:
            return guard.error(400, "missing-conId")
        
        cache_key = f"acc:{acc}:mod:{model}:con:{con_id}"
        cached, age = cache_read(pnl_cache, cache_key, 5.0) # 5s TTL
        if cached:
            return guard.respond(cached, 200)

        _ib = get_ib_instance()
        pnl = _ib.reqPnLSingle(acc, model, int(con_id))
        
        # Wait for update
        start = time.time()
        while time.time() - start < 3.0:
            if pnl.dailyPnL is not None or pnl.unrealizedPnL is not None:
                break
            time.sleep(0.1)
            
        res = {
            "dailyPnL": safe_value(pnl.dailyPnL),
            "unrealizedPnL": safe_value(pnl.unrealizedPnL),
            "realizedPnL": safe_value(pnl.realizedPnL),
            "value": safe_value(pnl.value),
            "marketValue": safe_value(pnl.marketValue)
        }
        _ib.cancelPnLSingle(acc, model, int(con_id))
        cache_write(pnl_cache, cache_key, res)
        return guard.respond(res, 200)

@app.route('/diag/logs')
def get_logs():
    limit = int(request.args.get('limit', 100))
    # This is a bit hacky but useful for remote debugging
    # We'll just return the last N lines of the log file if we can find it
    # For now, return diag state as a proxy
    return diag()

if __name__ == '__main__':
    threading.Thread(target=loop_driver, daemon=True).start()
    threading.Thread(target=connection_monitor, daemon=True).start()
    threading.Thread(target=webhook_worker, daemon=True).start()
    app.run(host='0.0.0.0', port=5050, debug=False)
