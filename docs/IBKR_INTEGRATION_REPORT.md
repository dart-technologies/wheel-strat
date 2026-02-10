# IBKR Data Integration Report

## 1. Current Status Analysis

**Objective**: Verify "Client Portal API" availability and check for market/historical options data.

### Findings
*   **Scripts**: `scripts/ibkr_deep_test.sh` and `scripts/market_data_test.sh` are designed to interact with the **IBKR Client Portal Web API** (REST) via `curl`.
*   **Port Check**:
    *   **Port 5000** (Default for CP API): Occupied by `ControlCenter` (AirPlay Receiver). Connection attempts hang or fail.
*   **Port 4001/4002** (TWS API): Occupied by `IB Gateway 10.37`. This implies the **TWS API (TCP)** is running, NOT the Client Portal Web API.
    *   **Note**: In the dockerized bridge setup, the Bridge API connects via **socat on port 4004**.
*   **Result**: The existing shell scripts **FAIL** to connect because they are attempting to speak HTTP/REST to a TCP/TWS port (or a blocked port).

## 2. Test Verification (TWS API - `ib_insync`)

A verification script (`scripts/ib_insync_test.py`) was executed to test the **TWS API** on port 4004 (socat).

### A. Market Data (Real-time)
*   **Status**: **PARTIAL / DELAYED**.
*   **Result**: 
    *   Connection to Gateway (4004) **SUCCESS**.
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

## 4. Cloud Deployment Strategy (New)

To enable "always-on" market data for the iPhone TestFlight app without leaving a local Mac running, we will deploy the bridge to Google Cloud Platform (GCP).

### Architecture
We will use a **Dockerized** setup on **Google Compute Engine (GCE)**.
*   **Platform**: Google Compute Engine (e2-micro instance).
*   **Orchestration**: `docker-compose`.
*   **Cost**: **$0.00/month** (Free Tier eligible in us-central1/us-west1/us-east1).

### Components
1.  **IB Gateway (`gnzsnz/ib-gateway`)**:
    *   Image: `gnzsnz/ib-gateway:latest`
    *   Role: Runs the official IB Gateway application in a headless Docker container with built-in `xvfb`, `vnc`, and `socat`.
    *   Reasoning: Reliable headless support with IBC (IB Controller) integration.

2.  **Bridge API (`ibkr_bridge.py`)**:
    *   Image: Custom `Dockerfile` (Python 3.9)
    *   Role: Exposes the TWS API (served by `ibeam`) as a simple REST API for our React Native app and Cloud Functions.
    *   Security: Will enforce `X-API-KEY` authentication.

### Workflow
1.  **App/Functions** sends HTTP GET to `Bridge API`.
2.  **Bridge API** translates request to `ib_insync` calls.
3.  **ib_insync** talks to **IB Gateway (`ibeam`)** via socat port 4004 (forwarded to 4002 internally).
4.  **IB Gateway** talks to IBKR Servers.

## 5. Implementation Plan

1.  **Stop** using `scripts/ibkr_deep_test.sh` (REST).
2.  **Use** `scripts/ib_insync_test.py` as the foundation for the Market Data Service.
3.  **Integration**:
    *   Develop a Python-based "Market Data Provider" service using `ib_insync`.
    *   This service will handle "Guest Mode" backtesting requests by pulling cached or live historical data from IBKR.
    *   Ensure the IB Gateway is running and configured to accept connections from the local IP.
4.  **Deployment**:
    *   Dockerize `ibkr_bridge.py`.
    *   Deploy `docker-compose.yml` (ibeam + bridge) to GCP e2-micro.

## 6. Trade Execution & Synchronization (Phase 2)

**Objective**: Enable the "Act" phase of the Agentic Assistant by allowing users to execute trades directly and syncing those executions back to the app's journal.

### Bridge Enhancements (`ibkr_bridge.py`)

1.  **Order Placement Endpoint (`POST /order`)**
    *   **Input**: JSON payload containing `symbol`, `action` (BUY/SELL), `quantity`, `orderType` (LMT/MKT), `limitPrice`, `secType` (STK/OPT), `strike`, `right`, `expiration`.
    *   **Logic**:
        *   Construct `ib_insync.Contract` (Stock or Option).
        *   Qualify the contract with IBKR to ensure it exists.
        *   Construct `ib_insync.Order` (Limit or Market).
        *   **Safety**: Enforce hard checks (e.g., no Market orders on options, max quantity limits) if needed.
        *   Submit via `ib.placeOrder()`.
    *   **Output**: Order ID and initial status (PreSubmitted, Submitted, Filled).

2.  **Execution History Endpoint (`GET /executions`)**
    *   **Input**: Optional time range filter.
    *   **Logic**:
        *   Call `ib.reqExecutions()` to retrieve filled orders.
        *   Map IBKR execution objects to the app's `Trade` schema.
    *   **Output**: JSON list of trades including timestamp, price, quantity, and commission.

### Frontend Integration

1.  **Trade Service Update**
    *   Extend `services/api.ts` (or create `services/trading.ts`) to consume the new endpoints.
    *   Implement `executeTrade(opportunity)` to map `Opportunity` objects to order payloads.
    *   Implement `syncTradeHistory()` to fetch executions and upsert them into the TinyBase store.

2.  **UI Components**
    *   **Opportunity Card**: Add "Execute" button.
    *   **Order Preview**: Modal to confirm details before submission.
    *   **Journal**: "Sync" button to pull latest fills.

### Verification Strategy (Paper Trading)
*   **Environment**: For the dockerized bridge in this repo, connect `ib_insync` to **4004** (socat). For direct IB Gateway/TWS, use 4001/4002 or 7497/7496.
*   **Test Case 1**: Place a Limit Buy for a liquid stock (e.g., AAPL) far below market to verify "Submitted" status.
*   **Test Case 2**: Place a Market Buy (Stock) to verify "Filled" status and subsequent `GET /executions` retrieval.
*   **Test Case 3**: Place a Limit Sell (Option) matching an Opportunity to verify complex contract resolution.

## 7. Infrastructure Stabilization & Reliability (Jan 2026)

**Objective**: Ensure "always-on" availability and prevent silent failures in the GCP environment.

### A. Memory Management (OOM Prevention)
*   **Issue**: On the e2-micro (1GB RAM) instance, the IB Gateway (Java) was frequently killed by the Linux OOM killer during peak memory spikes.
*   **Solution**:
    *   **Swap File**: Added a **1GB swap file** to the GCE VM to provide a buffer for memory pressure.
    *   **Heap Tuning**: Set `JAVA_HEAP_SIZE=256` (MB) in `docker-compose.yml`. Reduced from 448MB to leave more headroom for Bridge API, Caddy, and OS on the constrained e2-micro.
    *   **JVM Flags** (`TWS_EXTRA_ARGS`):
        | Flag | Purpose |
        |------|---------|
        | `-XX:+UseSerialGC` | Single-threaded GC with lower memory overhead than G1GC |
        | `-XX:MaxMetaspaceSize=128m` | Caps class metadata memory to prevent unbounded growth |
        | `-XX:+AlwaysPreTouch` | Pre-allocates heap pages at startup for predictable memory |
        | `-XX:+ExitOnOutOfMemoryError` | Crashes cleanly on OOM so Docker can restart (vs. hanging) |

### B. Port Alignment (Paper Trading)
*   **Issue**: The `gnzsnz/ib-gateway` image has hardcoded internal port expectations for `TRADING_MODE=paper`. It overrides standard environment variables to use port **4002** internally.
*   **Solution**:
    *   Forced `TWS_API_PORT=4002` and `API_PORT=4002` in the container environment.
    *   Updated `jts.ini` to explicitly listen on `SocketPort=4002`.
    *   Configured the **Bridge API** to connect to `ib-gateway:4004` (the external port forwarded by `socat`).

### C. Verification
*   **Health Status**: `connected: true` and `status: ok` are now persistent over 24h+ cycles.
*   **DTE Accuracy**: Fixed stale expiration issues (e.g., META showing old dates) caused by fallback to local TinyBase data when the bridge was unreachable.

## 8. Diagnostics + Open Issues (Investigate Later)

### A. Manual Sync Timeouts
*   **Symptom**: `manualSyncIBKR` callable aborts on the client after 60s.
*   **Likely Causes**:
    *   Bridge `/executions` endpoint hangs (Caddy receives request but upstream never returns).
    *   Functions still running older code (no health preflight, slower execution sync).
*   **Notes**:
    *   New bridge code adds `/ping`, lock-timeout in `/health`, and defaults `connect=false`.
    *   New functions code preflights `/health?connect=false`, shortens execution fetch timeout, and batches Firestore writes.
    *   **Resolved**: VM updated with latest bridge code (including `/ping`) via `--prod-rebuild-bridge`.


### B. Bridge Health Hanging
*   **Symptom**: `curl https://.../health` and `.../health?connect=false` occasionally hang with 0 bytes returned.
*   **Hypothesis**: `ib_lock` held by a stuck IB request; Flask request thread blocks waiting for lock.
*   **Mitigation**:
    *   Add `/ping` endpoint (no IB lock).
    *   Add lock timeout in `/health` and return `status: "busy"`.
    *   Add Caddy upstream timeouts to avoid indefinite hangs.
    *   **Status**: **FIXED**. Bridge now supports `/ping` (no lock) and proper timeouts. Diagnostics confirm PING/HEALTH are OK.


### C. Deploy + Rebuild Pitfalls
*   **Issue**: `restart_ibkr_bridge.sh --prod-all` does not `git pull`; it rebuilds whatever is already on the VM.
*   **Action**: Ensure VM repo is updated before rebuild:
    *   `cd ~/wheel-strat && git pull`
    *   `cd infrastructure && sudo docker-compose down && sudo docker-compose up -d --build`
    *   **Solution**: Added `--prod-sync-bridge` and `--prod-rebuild-bridge` to `restart_ibkr_bridge.sh` to SC files directly and force-rebuild containers without needing a full git pull on the VM.


### D. API Key Auth
*   **Note**: `/executions` returns `{"error":"Unauthorized"}` without `X-API-KEY`.
*   **Ensure**: Bridge API key is configured in app + functions, and used in diagnostics.

### E. Diagnostics Script
*   **Script**: `scripts/bridge_diagnostics.sh`
*   **Checks**: `/ping`, `/health?connect=false`, optional `/health?connect=true`, optional `/executions`.
*   **Use**: Pass `--api-key` to validate the `/executions` path. Use `--connect-once` to perform a one-shot `/health?connect=true` without retries.

### F. Caddy Timeouts
*   **Status**: Added safe upstream timeouts in `infrastructure/Caddyfile` to fail fast if upstream stalls.
*   **Action**: Verify Caddy reloads with the updated config after deploy.

### G. Disconnect Root-Cause Diagnostics (NEW)
*   **Bridge now exposes** the following fields on `/health`:
    *   `lastDisconnectAt`, `lastDisconnectReason`
    *   `lastIbErrorAt`, `lastIbErrorCode`, `lastIbErrorMessage`
    *   `lastReconnectAttemptAt`, `lastReconnectError`, `reconnectAttempts`, `reconnectFailures`
    *   `lastHeartbeatAt`, `lastHeartbeatError`, `heartbeatFailures`
*   **Use**: Poll `/health?connect=false` to capture the last IBKR error code after a drop.
*   **Investigate**:
    *   IBKR error codes (e.g., 1100/1101 network loss, 10197 session issues).
    *   ClientId conflicts (other sessions using `clientId=1`).
    *   Gateway restarts or idle timeouts; verify heartbeat is keeping session alive.
    *   2FA / login prompts (IBC logs) or warnings that interrupt auto-login.
