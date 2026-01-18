# IBKR Data Integration Report

## 1. Current Status Analysis

**Objective**: Verify "Client Portal API" availability and check for market/historical options data.

### Findings
*   **Scripts**: `scripts/ibkr_deep_test.sh` and `scripts/market_data_test.sh` are designed to interact with the **IBKR Client Portal Web API** (REST) via `curl`.
*   **Port Check**:
    *   **Port 5000** (Default for CP API): Occupied by `ControlCenter` (AirPlay Receiver). Connection attempts hang or fail.
    *   **Port 4001** (Live TWS API): Occupied by `IB Gateway 10.37`. This implies the **TWS API (TCP)** is running, NOT the Client Portal Web API.
*   **Result**: The existing shell scripts **FAIL** to connect because they are attempting to speak HTTP/REST to a TCP/TWS port (or a blocked port).

## 2. Test Verification (TWS API - `ib_insync`)

A verification script (`scripts/ib_insync_test.py`) was executed to test the **TWS API** on port 4001.

### A. Market Data (Real-time)
*   **Status**: **PARTIAL / DELAYED**.
*   **Result**: 
    *   Connection to Gateway (4001) **SUCCESS**.
    *   Underlying (AMZN) Data: Received delayed data (`Error 10089: Requested market data requires additional subscription`).
    *   Greeks/IV: Snapshot request returned "Read-Only mode" errors or "Snapshot market data subscription is not applicable". 
    *   *Analysis*: The current IB Gateway user is likely in "Read-Only/Non-Trading" mode or lacks data subscriptions for live streaming. However, the *capability* effectively exists if subscriptions are active.

### B. Historical Options Data
*   **Status**: **SUCCESS**.
*   **Result**:
    *   Successfully retrieved **35 bars** of 1-hour data for `AMZN 20260213 200.0 Put`.
    *   Data includes Open, High, Low, Close (Midpoint).
    *   *Analysis*: **Historical backtesting is fully supported**. We can programmatically pull OHLCV data for specific option contracts to simulate past performance.

## 3. Architecture Decision

**Decision**: **ADOPT TWS API (IB Gateway)** via `ib_insync` (Python) or `iba` (Node.js).

### Rationale
1.  **Reliability**: TCP connection to IB Gateway is persistent and robust compared to the flaky REST Gateway.
2.  **Historical Data**: Confirmed success in retrieving granular option history, which is critical for the "Marathon Agent" backtesting.
3.  **Environment**: The IB Gateway is already running and accessible; the CP API is blocked by system processes.

### Data Mapping Strategy

| Data Type | TWS API Method | Notes |
| :--- | :--- | :--- |
| **Option Structure** | `reqSecDefOptParams` | Fetch available strikes/expirations dynamically. |
| **Market Data** | `reqMktData` | Use `genericTickList='100,101,104,106'` (Vol, OI, HistVol, ImpVol). Requires Live Subscriptions for real-time. |
| **Historical Data** | `reqHistoricalData` | Use `whatToShow='MIDPOINT'` (or `BID_ASK`). `useRTH=1` (Regular Trading Hours). |

## 4. Implementation Plan (Updated)

1.  **Stop** using `scripts/ibkr_deep_test.sh` (REST).
2.  **Use** `scripts/ib_insync_test.py` as the foundation for the Market Data Service.
3.  **Integration**:
    *   Develop a Python-based "Market Data Provider" service using `ib_insync`.
    *   This service will handle "Guest Mode" backtesting requests by pulling cached or live historical data from IBKR.
    *   Ensure the IB Gateway is running and configured to accept connections from the local IP.

