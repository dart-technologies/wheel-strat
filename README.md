# Wheel Strat 🛞

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TestFlight](https://img.shields.io/badge/TestFlight-Available-blue)](https://testflight.apple.com/join/vK1pNwbs)

**Hackathon**: [Gemini 3 DevPost](https://gemini3.devpost.com/)

> Agentic options mentor powered by Gemini 3. Wheel Strat scans markets, explains trades grounded with real-time search, and backtests strategies on decades of historical data—all from your pocket.

📱 **[TestFlight](https://testflight.apple.com/join/vK1pNwbs)**

---

## Gemini 3 Integration

| Feature | How Gemini 3 Powers It |
| :--- | :--- |
| **🧠 Strategy Explainer** | Tap any option contract → Gemini 3 analyzes Greeks, IV, and risk/reward, generating a personalized plain-English explanation |
| **🏃 Marathon Agent** | Scheduled scans at market open (9:30am) and close (3:30pm) → Gemini 3 evaluates volatility and recommends high-conviction opportunities |
| **📊 Scenario Backtesting** | Historical win probability using 20 years of price data with pattern matching |

---

## Features

- **Portfolio Dashboard** — Real-time Net Liquidity, Greeks, and P&L tracking
- **Marathon Agent** — Autonomous market scanning with push notifications
- **Strategy Explainer** — One-tap AI trade analysis
- **Scenario Backtesting** — Historical asymmetric win probability
- **Paper Trading** — Execute against IBKR paper accounts
- **Demo Mode** — Pre-seeded "Mag7" portfolio

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **AI** | Gemini 3 Flash via Google AI Studio |
| **Frontend** | React Native (Expo SDK 54), Glassmorphic UI |
| **State** | TinyBase 7.0 (offline-first) + expo-sqlite |
| **Backend** | Firebase Cloud Functions (Gen 2) |
| **Visualization** | Victory Native (Skia) + Reanimated 4 |
| **Bridge** | Python Flask + ib_insync (IBKR TWS API) |
| **Infrastructure** | Docker + Caddy on GCP + ngrok |

---

## Quick Start

```bash
git clone https://github.com/dart-technologies/wheel-strat.git && cd wheel-strat
yarn install && yarn start
```

See [CLAUDE.md](./CLAUDE.md) for development guidelines and [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system design.

---

## What's Next

1. **Expanded Universe** — Additional tickers beyond Mag7 for Pro plan
2. **Live Account Trading** — OAuth broker integration (IBKR, Public.com)
3. **Agentic Trading Mode** — Auto-suggest bot trading for Diamond plan

---

## Join the Revolution 🚀

Support the project and earn bonuses:
- **[Public.com](https://public.com/user-referral?referrer=chownation)**: Earn $20 after depositing $1k
- **[Interactive Brokers](https://ibkr.com/referral/michael2354)**: Earn up to $1,000 in IBKR Stock
