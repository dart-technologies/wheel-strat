#!/bin/bash

# Market Data Test Script (Public.com vs IBKR)
# Usage: ./market_data_test.sh
# 
# Note: You must replace 'YOUR_TOKEN' and 'YOUR_ACCOUNT_ID' with valid credentials.

# ==========================================
# 1. Public.com API Examples
# Docs: https://public.com/developers/api
# ==========================================

PUBLIC_API_KEY="eyJraWQiOiI2NmVmYWY0Yi1mZWViLTRmYWYtYmE5NS03Y2E4YTc0M2NmZDEiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJkMWU2N2JmOS00MWYyLTQ1YzMtODIyMi1hMmViMDljMjc0NGYiLCJhdWQiOiJwZXJzb25hbCIsIm5iZiI6MTc3MDIzNzQwMSwic2NvcGUiOlsidHJhZGluZy5yZWFkIiwidHJhZGluZy53cml0ZSIsIm1hcmtldGRhdGEiXSwiaXNzIjoiaHR0cHM6Ly9wdWJsaWMuY29tIiwiZXhwIjoxNzcwMzIzODAxLCJpYXQiOjE3NzAyMzc0MDEsImp0aSI6IjM5RGpCbG5NenE0QzZ4Y3QzekNpdzBTWm9WSSJ9.Rewn1KOxUgYnDsTw4SKK79RKAbf-okPMb3F1sr5hMf7xSbkuSeDvEhCHrmOuV-iTeqAimnFvy3JNvoG47XqhtNSlz7iSuaHX23J4AIv6ubmgV3UHEN9tHZu7ubblWp3qwgsY8k1ijDQ6tKZHWQfhsx4gyo5Boo0vfKNEM2kjtCff0yJIqSUIXEZcy2C7gMBCkRlxajgc3SFZ5UzTh8jAFZj_hbud0vuoX739KE8j3XQkrMT1TfGAqgURdcDVdpI4f5NLa-Yy7S7oSDhH3RVdGUYMSoROdUTDVmH-MKLNKglYnJuwrTagYNZW3M_zYA1HBx-Jh6bDBd1IjZ5Oc9aUbQ"
PUBLIC_BASE_URL="https://api.public.com/v1"

echo "Testing Public.com API..."

# Account ID from previous successful call
ACCOUNT_ID="5LM56815"
PUBLIC_GATEWAY="https://api.public.com/userapigateway"

echo "=== 1. Public.com: Instrument Details (AMZN) ==="
# Endpoint: GET /trading/instruments/{symbol}/{type}
# Validated: SUCCESS
curl -X GET "$PUBLIC_GATEWAY/trading/instruments/AMZN/EQUITY" \
     -H "Authorization: Bearer $PUBLIC_API_KEY"

echo -e "\n\n=== 2. Public.com: Option Chain (AMZN) ==="
# Fix: Error said "instrument ... is null", wrapping in proper object structure.
# Endpoint: POST /marketdata/{accountId}/option-chain
curl -X POST "$PUBLIC_GATEWAY/marketdata/$ACCOUNT_ID/option-chain" \
     -H "Authorization: Bearer $PUBLIC_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"instrument": {"symbol": "AMZN", "type": "EQUITY"}}'

echo -e "\n\n=== 3. Public.com: Real-Time Greeks (Sample) ==="
# Fix: Error said "Required request parameter 'osiSymbols' ... is not present"
# Endpoint: GET /option-details/{accountId}/greeks
curl -X GET "$PUBLIC_GATEWAY/option-details/$ACCOUNT_ID/greeks?osiSymbols=AMZN260116C00200000" \
     -H "Authorization: Bearer $PUBLIC_API_KEY"

echo -e "\n\n=== 4. Polygon.io: Historical Seed Data (AMZN on 7/17/2025) ==="
# Fix: Ensure Key is visible
POLYGON_KEY_FIXED="GYS9uHaeBD6bceM_QdFoBLgupq9h9W4Z"
curl -X GET "https://api.polygon.io/v2/aggs/ticker/AMZN/range/1/day/2025-07-17/2025-07-17?adjusted=true&sort=asc&limit=1&apiKey=$POLYGON_KEY_FIXED"


# ==========================================
# 2. Interactive Brokers (Client Portal API)
# Docs: https://interactivebrokers.github.io/cpwebapi/
# Data: Requires running local Client Portal Gateway (Java)
# ==========================================

IBKR_BASE_URL="https://localhost:5000/v1/api"
# Note: IBKR uses a session cookie, so we simulate typical endpoint structure below.
# In production, you'd perform the auth handshake first.

echo "Testing IBKR Client Portal API (Local Gateway)..."

# A. Real-time Market Data Snapshot (requires conid)
# conid 76792991 = TSLA
# curl -k -X GET "$IBKR_BASE_URL/iserver/marketdata/snapshot?conids=76792991&fields=31,55,83,84,86,85"

# B. Historical Data (Backtesting Support)
# curl -k -X GET "$IBKR_BASE_URL/iserver/marketdata/history?conid=76792991&period=1y&bar=1d"

# C. Option Chain (Strikes)
# curl -k -X GET "$IBKR_BASE_URL/iserver/secdef/strikes?conid=76792991&sectype=OPT&month=MAR26"

# ==========================================
# 3. Polygon.io (Alternative for Historical)
# Docs: https://polygon.io/docs/options/getting-started
# ==========================================

POLYGON_KEY="GYS9uHaeBD6bceM_QdFoBLgupq9h9W4Z"

echo "Testing Polygon.io (Historical Options)..."

# Historical Option Candle (Aggregates)
curl -X GET "https://api.polygon.io/v2/aggs/ticker/O:TSLA250117C00200000/range/1/day/2023-01-01/2023-12-31?adjusted=true&sort=asc&limit=120&apiKey=$POLYGON_KEY"
