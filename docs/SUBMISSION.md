# DevPost Submission: Wheel Strat

**Your AI-Powered Options Trading Mentor**

🔗 **[TestFlight](https://testflight.apple.com/join/vK1pNwbs)**

---

## Elevator Pitch

> Agentic options mentor powered by Gemini 3. Wheel Strat scans markets, explains trades grounded with real-time search, and backtests strategies on decades of historical data all from your pocket.

---

## Inspiration

Options trading is complex. Beginners struggle to understand *why* they're entering a trade, and experienced traders lack time to monitor markets for volatility spikes. We built **Wheel Strat** to democratize "The Wheel" strategy—a disciplined approach to selling puts to acquire stocks and selling calls to harvest premium by providing an agentic mentor that sits right in your pocket.

The Wheel is one of the most consistent income-generating strategies, but it requires:
1. Constant market monitoring for optimal entry points
2. Understanding complex options mechanics (Greeks, IV, DTE)
3. Disciplined position management

We asked: *What if Gemini 3 could handle all of this automatically?*

---

## What It Does

**Wheel Strat** is a companion app for options traders with two core Gemini 3 integrations:

### 🧠 Strategy Explainer (On-Demand)
Tap any trade to get instant AI analysis. Gemini 3 evaluates the contract's Greeks, IV rank, and market context to explain the **Goal**, **Risk**, and **Outcome** in plain English. Perfect for learning or validating your thesis.

### 🏃 Marathon Agent (Scheduled)
An autonomous agent that scans the market at 9:30am and 3:30pm EST. It uses Gemini 3 to identify high-conviction opportunities, analyzes them against your risk profile, and pushes actionable alerts to your phone.

### Additional Features
- **Portfolio Dashboard** — Real-time Net Liquidity, Greeks, and P&L tracking
- **Scenario Backtesting** — Historical win probability using 20 years of price data  
- **Paper Trading** — Execute against IBKR paper accounts with full reconciliation
- **Demo Mode** — Pre-seeded "Mag7" portfolio

---

## How We Built It

### Gemini 3 Integration (40% Technical Execution)

**Strategy Explainer Flow:**
```
User taps "Explain" → Cloud Function → Gemini 3 Flash → Structured JSON → UI Modal
```
- Prompts include full trade context: symbol, strike, DTE, Greeks, IV rank
- Gemini 3's structured output ensures reliable parsing for UI rendering
- Sub-second latency enables real-time interaction

**Marathon Agent Flow:**
```
Cloud Scheduler (9:30am/3:30pm) → Agent Function → IBKR Option Chains → Gemini 3 Analysis → Firestore → Push Notification
```
- Agent fetches live option chains from IBKR bridge
- Gemini 3 evaluates each contract against Wheel criteria (delta -0.25 to -0.35, IV Rank >50%, 30-45 DTE)
- Results written to Firestore, synced to device via TinyBase

### Architecture Highlights
- **Local-First**: TinyBase + SQLite ensures the app works offline and syncs seamlessly
- **Production IBKR Bridge**: Python Flask server on GCP connects to real brokerage data
- **Glassmorphic UI**: Custom design system with 60fps Reanimated 4 animations

---

## Challenges We Ran Into

### 1. IBKR Bridge Reliability (Infrastructure)
Running IB Gateway (Java) on GCP's free-tier e2-micro (1GB RAM) required extensive JVM tuning:
- Reduced heap to 256MB with SerialGC
- Added 1GB swap file for memory pressure spikes
- Implemented clean crash-on-OOM for Docker restart recovery

### 2. Prompt Engineering for Finance (AI)
Balancing concise responses with educational depth for complex financial topics. We iterated on prompts to ensure Gemini 3 explains *why* a trade is risky, not just *that* it's risky.

### 3. Offline-First Sync (Mobile)
Ensuring TinyBase ↔ Firestore sync remained conflict-free across sessions, especially when trades execute while the app is backgrounded.

---

## Accomplishments We're Proud Of

### 🏆 Production-Ready AI Integration
Both Gemini 3 features work end-to-end in production:
- Strategy Explainer analyzes real trades in <1 second
- Marathon Agent has generated 50+ daily reports with actionable opportunities

### 🎨 Premium Mobile Experience  
- Glassmorphic UI with consistent 60fps animations
- Interactive Skia charts for price/volatility visualization
- Haptic feedback on all user interactions

### 📱 TestFlight Deployment
The app is publicly available today: https://testflight.apple.com/join/vK1pNwbs

### 📊 20-Year Historical Backtesting
Pattern matching engine analyzes GOOGL data back to 2005 to calculate asymmetric win probabilities.

---

## What We Learned

### Gemini 3's Structured Output is a Game-Changer
The ability to request reliable JSON extraction means we can confidently render AI responses in production UI without parsing failures.

### Local-First is Worth the Investment
TinyBase's reactive architecture made the app feel instantaneous. Users never wait for network—data is always there.

### Financial AI Requires Guardrails
Options trading involves real money. We implemented multiple safety layers: paper trading only, confirmation modals, and clear risk disclosure.

---

## What's Next for Wheel Strat

### Phase 1: Expanded Universe
Support for additional tickers beyond the Mag7 focus for Pro plan.

### Phase 2: Live Account Trading
Graduate from paper to real execution with OAuth broker integration (IBKR, Public.com).

### Phase 3: Agentic Trading Mode
Agentic auto-suggest bot trading mode for Diamond plan.

---

## Built With

### Languages & Frameworks
- **TypeScript** — Primary language for app and Cloud Functions
- **Python** — IBKR Bridge server (Flask + ib_insync)
- **React Native** (Expo SDK 54) — Cross-platform mobile app

### AI & Cloud
- **Gemini 3 Flash** — Core reasoning engine via Google AI Studio
- **Firebase** — Cloud Functions (Gen 2), Firestore, Cloud Scheduler
- **Google Cloud Platform** — Compute Engine for IBKR Bridge

### Data & State
- **TinyBase 7.0** — Offline-first reactive store
- **SQLite** — Local persistence via expo-sqlite
- **Cloud SQL (PostgreSQL)** — 20-year historical market data

### Visualization & UX
- **Victory Native** (Skia) — Hardware-accelerated charts
- **React Native Reanimated 4** — 60fps animations
- **Expo Haptics** — Tactile feedback

### Infrastructure
- **Docker + Caddy** — Containerized bridge with TLS termination
- **ngrok** — Secure tunnel for local development
- **Interactive Brokers TWS API** — Real-time market data and execution

---

## Demo Video Script (3 Minutes)

### Scene 1: Intro Hook (0:00-0:20)
> "Are you new to options trading and heard about the Wheel Strategy for generating yield on existing stocks? Or maybe you're a pro trader who doesn't have time to monitor the market for vol spikes? **Enter Wheel Strat** — your AI-powered options mentor."

### Scene 2: Dashboard & Positions (0:20-0:50)
- Open app to Portfolio Dashboard
- Walk through Net Liquidity and account metrics
- Scroll through Positions table (Mag7 holdings)
- Highlight per-position P&L and Greeks

### Scene 3: Marathon Agent Alert (0:50-1:30)
- Manually trigger push notification on **GOOGL**
- Phone receives alert: *"Marathon Agent found a high-conviction opportunity"*
- Tap notification → navigates to **Symbol View**
- **Key moment**: Show Gemini 3's contextual analysis

### Scene 4: CC Suggestion & Backtesting (1:30-2:15)
- Review suggested Covered Call with full AI context
- Highlight: aligns with user's **DTE** and **Risk Profile** settings
- Show **Scenario Backtesting**: historical asymmetric win probability
- Point out: "Gemini 3 analyzed 20 years of GOOGL data"

### Scene 5: Execute Paper Trade & Confirm (2:15-2:40)
- Tap "Execute" to place paper trade
- Show confirmation modal
- Navigate to **Journal Tab** → trade appears in history
- Highlight execution reconciliation

### Scene 6: The Wheel Cycle (2:40-3:00)
> "The Wheel keeps repeating: **Acquire** shares, **Hold** through assignment, **Harvest** premium, **Accumulate** capital. Wheel Strat helps you stay disciplined at every step."
- Wheel Strat beta available on TestFlight today

---

## Links

- 📱 **TestFlight**: https://testflight.apple.com/join/vK1pNwbs
- 📂 **GitHub**: https://github.com/dart-technologies/wheel-strat
- 🎬 **Video**: https://youtu.be/mQButnO7-7I (The Options Wheel Strategy)
