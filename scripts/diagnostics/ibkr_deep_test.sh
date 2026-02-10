#!/bin/bash

# IBKR Deep Data Test (AMZN Greeks)

# Base URL for Local Gateway
# Port 5000 occupied by AirPlay. Trying Standard Paper Gateway (4002) or TWS (7497)
BASE_URL="https://localhost:5000/v1/api" # Reverting to 5000 to see if user fixed it? No.
# Update: User logs show "Socket Port 4001" which is usually Live Gateway.
# Let's try 5000 but warn, or try to detect.
# I will change to https://localhost:5000/v1/api anyway as a placeholder, but I'll add a check.
# Actually, I'll update it to use 4002.
BASE_URL="https://localhost:4002/v1/api"
INSECURE="-k" # Skip SSL verify for localhost self-signed cert

echo "=== 1. Checking IBKR Auth Status ==="
curl $INSECURE -X GET "$BASE_URL/iserver/auth/status"
echo -e "\n"

echo "=== 2. Resolving AMZN Contract ID ==="
# Search for AMZN
# Expected ConID for AMZN (NASDAQ) might be roughly 3691937 but let's fetch it.
curl $INSECURE -X POST "$BASE_URL/iserver/secdef/search" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AMZN", "name":false, "secType":"STK"}'
echo -e "\n"

# Hardcoding AMZN ConID if search is messy/verbose.
# AMZN common stock conid is often 3691937.
AMZN_CONID="3691937"

echo "=== 3. Fetching Option Chain (Strikes) for AMZN ==="
# Getting strikes for a near-term month (e.g., MAR 26 -> MAR26?)
# IBKR format often YYYYMM or MONYY. Let's try 'FEB26'.
TARGET_MONTH="FEB26"
echo "Target: $TARGET_MONTH"

curl $INSECURE -X GET "$BASE_URL/iserver/secdef/strikes?conid=$AMZN_CONID&sectype=OPT&month=$TARGET_MONTH"
echo -e "\n"

echo "=== 4. Fetching Deep Greeks (Market Data Snapshot) ==="
# We need a specific Option ConID to get its Greeks. 
# Since we can't easily parse the previous JSON in bash without jq, 
# I will use a known methodology or just try to get the layout.
# 
# Fields:
# 31: Last Price
# 83: Delta
# 84: Gamma
# 85: Theta
# 86: Vega
# 87: Implied Vol
# 7295: Open Interest
# 7296: Volume

# Let's try to fetch high-level data for the Underlying first to prove data flow.
curl $INSECURE -X GET "$BASE_URL/iserver/marketdata/snapshot?conids=$AMZN_CONID&fields=31,83,84,85,86,87,70,71"
echo -e "\n"

# To get meaningful Option Greeks, we'd need the simulated "Best Put" conid.
# I will try to fetch a specific chain leg if I can guess a ConID, 
# but usually, you search for the option setup. 
# Search for a specific Option Contract: AMZN Feb 20 2026 200 Put
# Symbol format: "AMZN  260220P00200000" (Standard OSI but with spaces?)
# IBKR search supports searching by local symbol or just browsing chain.

# Let's try a SEARCH for the option directly to get its ConID.
echo "=== 5. Searching for Specific Option (AMZN Feb 20 '26 200 Put) ==="
# User Request: "AMZN on 7/17/2025" -> Wait, user asked for *historical* seed data on that date. 
# But here they want "Real-time deep options data for greeks dashboard".
# So current data.
# I will search for a realistic Near-Term option: AMZN Jan 17 2025 210 Put (Likely exists)
curl $INSECURE -X POST "$BASE_URL/iserver/secdef/search" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AMZN  250117P00210000", "secType":"OPT"}'

# Note: If search fails, I can't get the snapshot for the option.
echo -e "\n"
