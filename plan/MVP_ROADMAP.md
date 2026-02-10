# MVP Roadmap: Wheel Strat

**Target Deadline**: February 9, 2026 @ 8pm EST

---

## Phase 1: Foundation (Jan 18 - Jan 24) — 7 days

### Project Setup
- [x] Initialize Expo project with TypeScript
- [x] Configure premium glassmorphism UI
- [x] Set up directory structure per ARCHITECTURE.md

### Firebase & Vertex AI
- [x] Initialize Firebase project (Functions, Firestore)
- [x] Enable Vertex AI API on Google Cloud
- [x] Configure Secret Manager for API keys

### Data Persistence
- [x] Install TinyBase + `expo-sqlite`
- [x] Define schemas (Portfolio, Journal, Watchlist)
- [x] Seed "Magnificent 7" demo data

---

## Phase 2: Gemini 3 Integration (Jan 25 - Feb 2) — 9 days

### 🧠 Strategy Explainer (Primary Feature)
- [x] Create `functions/src/explainTrade.ts` endpoint
- [x] Build prompt template in `functions/src/prompts/explainer.ts`
- [x] Implement `components/StrategyExplainer.tsx` modal
- [x] Add "Explain This Trade" button to option cards
- [x] Test end-to-end: Tap → Gemini 3 → Display explanation

### 🔄 Marathon Agent (Secondary Feature)
- [x] Create `functions/src/agent.ts` scheduled function
- [x] Configure Cloud Scheduler cron: `30 9,15 * * 1-5` (9:30am & 3:30pm EST)
- [x] Build scanner prompt in `functions/src/prompts/scanner.ts`
- [x] Write alerts to Firestore → sync to TinyBase
- [x] Test push notification flow

---

## Phase 3: Feature Screens & Contextual Intelligence (Feb 3 - Feb 5) — 3 days

### 🧠 Contextual Intelligence Engine (Local-first)
- [x] **Data Ingestion**: Expand `fetch_data.js` to ingest 5-year Mag7 history (OHLCV).
- [x] **Pattern Matcher**: Implement `packages/shared/src/analysis/patternMatcher.ts` (Euclidean distance on price arrays).
- [x] **Richness Grading**: Implement "Theta/Vega Grade" (IV vs Realized Volatility).
- [x] **UI Integration**: Update `OpportunityCard` with "Historical Probability" vs "Market Probability".

### Dashboard (Home)
- [x] Build "Magnificent 7" seeded view
- [x] Display real-time P&L summary
- [x] Show recent Marathon Agent alerts

### Strategy Lab
- [x] UI for AI-recommended trades
- [x] "Explain" button triggering Strategy Explainer

### Trade Journal
- [x] Reactive P&L view using TinyBase hooks
- [x] Synced with IBKR paper trading account

---

## Phase 4: Polish & Submission (Feb 6 - Feb 9) — 4 days

### Guest Mode
- [x] Seamless onboarding for demo users
- [x] Ensure seeded data looks realistic

### Demo Artifacts
- [x] Record 3-minute demo video
- [x] Export architecture diagram as PNG
- [x] Generate screenshots & banner

### Deployment
- [x] Deploy to TestFlight for public testing: https://testflight.apple.com/join/vK1pNwbs
- [x] Deploy web share to Firebase Hosting

### Submission
- [x] Write 200-word Gemini 3 integration description
- [x] Submit to DevPost before 8pm EST

---

## Post-Hackathon (Future)

- [ ] Real-Broker OAuth (IBKR, Public.com)
- [ ] Live trade execution