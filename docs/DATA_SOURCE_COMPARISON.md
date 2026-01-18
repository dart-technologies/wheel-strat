# Market Data Source Comparison: Public.com vs. IBKR TWS API

## Executive Summary

| Feature | **Public.com API** | **IBKR TWS API** |
| :--- | :--- | :--- |
| **Protocol** | REST (HTTP/JSON) | TCP Socket (Proprietary) |
| **Connection** | Stateless (Request/Response) | Persistent / Stateful |
| **Latency** | Polling-based (Slower) | Streaming (Real-time / ms) |
| **Greeks/IV** | Snapshot (Separate Call) | Streaming (Included in Ticks) |
| **Auth** | Bearer Token (Easy) | Complex Handshake (Requires Gateway) |
| **Best For** | Mobile App / UI Display | Algorithmic Trading / Backend Agents |

## 1. Public.com API
**Role**: Primary Source for **Frontend (iOS App)**.

### Pros
*   **Web-Friendly**: Standard REST/JSON structure makes it trivial to consume from React Native or Firebase Functions.
*   **Stateless**: Easy to handle intermittent mobile connectivity. No need to maintain a persistent socket connection on a phone.
*   **Schema**: Clean, human-readable JSON.

### Cons
*   **Polling Required**: To get "live" prices, the app must repeatedly ask (e.g., every 5 seconds). True "streaming" is not exposed via REST.
*   **Rate Limits**: Frequent polling for many tickers can hit API limits.
*   **Dual Calls needed**: Retrieving Price + Greeks often requires two separate endpoints (`/option-chain` and `/greeks`).

### Usage in Architecture
*   **User Quotes**: When the user opens the "Trade" screen, the App calls Cloud Functions -> Public.com to get the latest snapshot.

---

## 2. IBKR TWS API (via `ib_insync`)
**Role**: Primary Source for **Marathon Agent (Backend)**.

### Pros
*   **True Streaming**: Data is pushed to the client immediately upon change. No polling required.
*   **Data Richness**: A single subscription (`reqMktData`) streams Last, Bid, Ask, Volume, **Implied Volatility**, and **All Greeks** simultaneously.
*   **Historical Data**: Access to deep granularity (e.g., 1-minute bars for options from 6 months ago) which Public.com does not easily expose.

### Cons
*   **Infrastructure Heavy**: Requires a running Java process (IB Gateway) and a persistent TCP connection.
*   **Complexity**: Handling async socket events.
*   **Strict Auth**: Interface is often locked down or Read-Only unless specifically configured.

### Usage in Architecture
*   **Agent Scanning**: The Python agent runs on the desktop/server. It maintains a persistent link to IB Gateway.
*   **Strategy**: It watches 100+ option contracts in real-time, waiting for specific Greeks/IV thresholds to trigger an alert.

## Conclusion & Recommendation

**Adopt a Hybrid Approach:**

1.  **Frontend (iOS)**: Continue using **Public.com**. It's lightweight and perfect for "human speed" interaction.
    *   *Why?* You don't want to run a TCP socket to IBKR on a user's phone, nor proxy that heavy traffic.
2.  **Backend (Agent)**: Switch to **IBKR TWS API**.
    *   *Why?* The agent needs to process data faster than human speed and requires historical backtesting capabilities that Public.com limits.
