# MVP Roadmap: Wheel Strat

**Target Deadline**: February 9, 2026 @ 8pm EST

---

## Phase 1: Foundation (Jan 18 - Jan 24) — 7 days

### Project Setup
- [ ] Initialize Expo project with TypeScript
- [ ] Configure NativeWind (TailwindCSS) for premium glassmorphism UI
- [ ] Set up directory structure per ARCHITECTURE.md

### Firebase & Vertex AI
- [ ] Initialize Firebase project (Functions, Firestore)
- [ ] Enable Vertex AI API on Google Cloud
- [ ] Configure Secret Manager for API keys

### Data Persistence
- [ ] Install TinyBase + `expo-sqlite`
- [ ] Define schemas (Portfolio, Journal, Watchlist)
- [ ] Seed "Magnificent 7" demo data

---

## Phase 2: Gemini 3 Integration (Jan 25 - Feb 2) — 9 days

### 🧠 Strategy Explainer (Primary Feature)
- [ ] Create `functions/src/explainTrade.ts` endpoint
- [ ] Build prompt template in `functions/src/prompts/explainer.ts`
- [ ] Implement `components/StrategyExplainer.tsx` modal
- [ ] Add "Explain This Trade" button to option cards
- [ ] Test end-to-end: Tap → Gemini 3 → Display explanation

### 🔄 Marathon Agent (Secondary Feature)
- [ ] Create `functions/src/agent.ts` scheduled function
- [ ] Configure Cloud Scheduler cron: `30 9,15 * * 1-5` (9:30am & 3:30pm EST)
- [ ] Build scanner prompt in `functions/src/prompts/scanner.ts`
- [ ] Write alerts to Firestore → sync to TinyBase
- [ ] Test push notification flow

---

## Phase 3: Feature Screens (Feb 3 - Feb 5) — 3 days

### Dashboard (Home)
- [ ] Build "Magnificent 7" seeded view
- [ ] Display real-time P&L summary
- [ ] Show recent Marathon Agent alerts

### Strategy Lab
- [ ] UI for AI-recommended trades
- [ ] "Explain" button triggering Strategy Explainer

### Trade Journal
- [ ] Reactive P&L view using TinyBase hooks
- [ ] Manual trade entry/editing

---

## Phase 4: Polish & Submission (Feb 6 - Feb 9) — 4 days

### Guest Mode
- [ ] Seamless onboarding for demo users
- [ ] Ensure seeded data looks realistic

### Demo Artifacts
- [ ] Record 3-minute demo video
- [ ] Export architecture diagram as PNG
- [ ] Generate screenshots & banner

### Deployment
- [ ] Deploy to TestFlight for public testing
- [ ] Deploy web share to Firebase Hosting

### Submission
- [ ] Write 200-word Gemini 3 integration description
- [ ] Submit to DevPost before 8pm EST

---

## Post-Hackathon (Future)

- [ ] Real-Broker OAuth (IBKR, Public.com)
- [ ] Live trade execution