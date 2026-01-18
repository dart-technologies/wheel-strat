# Wheel Strat 🛞

**Hackathon**: [Gemini 3 DevPost](https://gemini3.devpost.com/)

**Wheel Strat** is an AI-powered iOS app that continuously monitors your portfolio to orchestrate "The Wheel" options strategy. Powered by **Gemini 3 Pro**, the autonomous marathon agent that watches the market so you don't have to.

## Gemini 3 Integration

| Feature | How Gemini 3 Powers It |
| :--- | :--- |
| **🧠 Strategy Explainer** | Tap any option contract → Gemini 3 analyzes Greeks, IV, and risk/reward, generating a personalized plain-English explanation. |
| **🔄 Marathon Agent** | Scheduled scans at market open (9:30am) and close (3:30pm) → Gemini 3 evaluates volatility and recommends "Roll" or "Close" actions. |
| **🧪 Backtest Reasoning** | Ask "How would this put perform in a 2022-style correction?" → Gemini 3 simulates historical scenarios. |

## Tech Stack

- **AI**: Gemini 3 Pro (Vertex AI) — reasoning, strategy generation, natural language explanations
- **Frontend**: React Native (Expo), NativeWind
- **Persistence**: TinyBase (offline-first), Firestore (cloud sync)
- **Backend**: Firebase Cloud Functions (Agent orchestration)

## Quick Start

```bash
git clone https://github.com/dart-technologies/wheel-strat.git && cd wheel-strat
npm install && npx expo start
```

## Architecture

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed system design.

## Join the Revolution 🚀

Support the project and earn bonuses:
- **[Public.com](https://public.com/user-referral?referrer=chownation)**: Earn $20 after depositing $1k
- **[Interactive Brokers](https://ibkr.com/referral/michael2354)**: Earn up to $1,000 in IBKR Stock
