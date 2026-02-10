import os
import sys
import requests
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.ibkr_bridge_config import get_bridge_url, get_bridge_api_key

env = dict(os.environ)
BRIDGE_URL = get_bridge_url(env) or os.environ.get("IBKR_BRIDGE_URL", "http://127.0.0.1:5050")
API_KEY = get_bridge_api_key(env) or os.environ.get("IBKR_BRIDGE_API_KEY", "")

def test_market_data(symbol):
    print(f"Testing Market Data for {symbol}...")
    headers = {"X-API-KEY": API_KEY}
    try:
        resp = requests.get(f"{BRIDGE_URL}/market-data/{symbol}", headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            print(f"  Result: {data.get('last')} (Source: {data.get('source')})")
        else:
            print(f"  Failed: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"  Error: {e}")

def test_option_quote(symbol, strike, expiration, right):
    print(f"Testing Option Quote for {symbol} {expiration} {strike}{right}...")
    headers = {"X-API-KEY": API_KEY, "Content-Type": "application/json"}
    payload = {
        "symbol": symbol,
        "strike": strike,
        "expiration": expiration,
        "right": right
    }
    try:
        resp = requests.post(f"{BRIDGE_URL}/option-quote", headers=headers, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            print(f"  Price: {data.get('bid')} / {data.get('ask')} (Source: {data.get('source')})")
            print(f"  Greeks: Delta: {data.get('delta')}, IV: {data.get('impliedVol')}")
        else:
            print(f"  Failed: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"  Error: {e}")

if __name__ == "__main__":
    test_market_data("AAPL")
    test_market_data("NVDA")
    # Using a near-dated option
    test_option_quote("AAPL", 230, "20260130", "P")
