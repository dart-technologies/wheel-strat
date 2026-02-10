# Wheel Strat Project Documentation

## Overview
**Wheel Strat** is an AI-powered iOS trading assistant designed to orchestrate "The Wheel" options strategy. It leverages **Gemini 3** (via Vertex AI) for trade reasoning and an autonomous "Marathon Agent" for market scanning. The app provides a premium, "Glassmorphic" UI built with Expo and React Native, supported by a containerized infrastructure for backend services.

## Technology Stack
- **Framework**: React Native (Expo SDK 54)
- **Language**: TypeScript
- **Routing**: Expo Router (File-based routing)
- **State Management**: TinyBase (Local-first, reactive SQLite store)
- **Backend**: Firebase (Auth, Firestore, Cloud Functions)
- **AI Engine**: Vertex AI (Gemini 3 Flash/Pro)
- **Visualization**: Victory Native (Skia-based) & @shopify/react-native-skia
- **Animation**: React Native Reanimated 4
- **Bridge**: Python Flask (`scripts/bridge/ibkr_bridge.py`) for IBKR TWS API
- **Infrastructure**: Docker & Caddy (Reverse Proxy/TLS) for the Bridge
- **Styling**: Standard `StyleSheet` with centralized tokens (`constants/theme.ts`)

## Directory Structure

### `/app`
Expo Router screens and layouts.
- `(tabs)`: Main navigation (Dashboard, Strategies, Journal, Settings).
- `opportunity/[symbol].tsx`: Trade detail & explanation modal.
- `position/[symbol].tsx`: Position detail & history.

### `/features`
Domain-specific modules containing components and hooks.
- `opportunities/`, `portfolio/`, `trades/`, `auth/`, `settings/`, `reports/`.

### `/components`
Shared, reusable UI primitives (`GlassCard`, `PageHeader`, `Skeleton`, etc.).

### `/services`
Business logic and external integrations.
- `store.ts`: TinyBase initialization & schema.
- `trading.ts`: IBKR Bridge HTTP client with health monitoring.
- `marketData/`, `analysis/`: Data aggregation and backtesting engines.

### `/functions`
Firebase Cloud Functions (Backend) with TypeScript support.
- `src/agent.ts`: Scheduled "Marathon Agent" logic.
- `src/explainTrade.ts`: On-demand AI trade analysis.
- `src/lib/`: Shared utilities (IBKR runtime, Vertex AI wrappers).

### `/infrastructure`
Deployment configuration and security.
- `Dockerfile`, `docker-compose.yml`, `Caddyfile`: IBKR Bridge orchestration.
- `firestore.rules`: Security rules for Firestore.

### `/shared`
Logic and schemas shared between app and functions.
- `schema.ts`: Single source of truth for domain types.
- `tinybase.ts`: Store configuration.

### `/hooks`, `/utils`, `/types`, `/constants`
- `hooks/`: Global React hooks (auth, bridge health).
- `utils/`: Helper functions (formatting, risk calculations).
- `types/`: Global TypeScript definitions.
- `constants/`: Theme tokens and app configuration.

### `/scripts`
Utilities for bridge management, diagnostics, and data simulation.

## Key Workflows

### 1. Market Scanning (Marathon Agent)
- **Trigger**: Cron job (Cloud Scheduler) or Manual Pull.
- **Flow**: `functions/src/agent.ts` fetches market data via IBKR Bridge -> Filters high IV Rank -> Gemini 3 analyzes technicals/news -> Saves to Firestore `opportunities` -> Syncs to TinyBase on device.

### 2. Trade Explanation (On-Demand)
- **Trigger**: User taps "Explain" on an opportunity.
- **Flow**: App calls `explainTrade` -> Function prompts Gemini 3 with trade context -> Returns structured explanation -> Cached in Firestore.

### 3. Contextual Intelligence
- **Goal**: Augment live data with historical pattern matching.
- **Flow**: Ingest 1-5 year history -> Calculate Euclidean distance on price arrays -> Grade "Richness" (Theta/Vega) -> UI displays "Historical Probability".

### 4. Live Data Sync
- **Trigger**: App foreground or manual refresh.
- **Flow**: `services/sync.ts` listens to Firestore collections -> Updates TinyBase store -> UI components re-render reactively.

---

## Streamlining & Refactoring Status

### Completed
- **Repository Reorganization**: Centralized infrastructure-as-code (`firestore.rules` to `/infrastructure`) and diagnostic scripts (`/scripts`).
- **Test Coverage Expansion**: Achieved 70-90% coverage on critical services (Trading, API, Bridge) and Cloud Functions (Agent, Alerts, Reports).
- **Test Stability**: Resolved "Open Handle" leaks in `services/trading.ts` and implemented internal state resets for singleton hooks.
- **Git Hygiene**: Optimized `.gitignore` for `.firebase`, `.gcloud`, and `.env` masking; purged cached artifacts.
- **Feature-Based Architecture**: Reorganized codebase into `/features` (auth, opportunities, portfolio, trades) for better modularity.
- **Contextual Intelligence Engine**: Implemented `patternMatcher` (Euclidean distance) and `backtestEngine` in `packages/shared/src/analysis`.
- **UI Integration**: Updated `OpportunityCard` to display "Historical Edge" (Win Rate, Theta Grade) and "Analyst Outlook".
- **Extract TinyBase Queries**: Complex sorting (Market Value, Yields, Priority) moved to `services/store.ts` using `queries`.
- **Enforce Module Aliases**: Initial pass at converting relative imports (`../../`) to absolute aliases (`@/`) completed.
- **Service Layer Isolation**: Decoupled Firestore imports from feature hooks.
- **Consolidate Types**: Merged types into `packages/shared/src/schema` via `@wheel-strat/shared`.
- **Enhanced Bridge Monitoring**: Improved `BridgeStatus` with exponential backoff and health checks.
- **Skeleton Loading**: Implemented custom `Skeleton` layouts for smoother data fetching states.
- **Haptic Feedback Audit**: Standardized `expo-haptics` usage.
- **List Performance**: Migrated to `@shopify/flash-list`.
- **Micro-Interactions**: Added `Reanimated` layout transitions.
- **Testing Infrastructure**: Added `jest-setup.js` and comprehensive unit tests for `functions` and `services`.
- **Containerization**: Dockerized the IBKR Bridge with Caddy for secure deployment.

### Remaining Opportunities

#### 1. Data Pipeline Robustness
- **Historical Data Ingestion**: Fully automate the 5-year history ingestion (currently `fetch_data.js` is a manual script).
- **Bridge Reliability**: Implement "Always-On" keep-alive for the IBKR Gateway container to prevent session timeouts.

#### 2. Architecture & Code Quality
- **Deep Alias Refactor**: A comprehensive sweep to eliminate remaining relative imports (`../`) in favor of `@/` aliases, especially in `components/`, `hooks/`, and `services/`.
- **Service Layer Modularization**: Further decompose the large `services/` directory into domain-specific modules or move them into relevant `/features`.
- **Environment Config**: Fully migrate API keys to `expo-constants` (via `.env`).
- **Functions Alias Refactor**: Finalize alias usage in Cloud Functions.

#### 3. Polish: UI/UX Enhancements
- **Skeleton Expansion**: Apply `Skeleton` to `StrategyExplainer` and other modals.
- **Glassmorphism Consistency**: Standardize `intensity` and `tint` across `GlassCard`.
- **Advanced Animations**: Leverage Reanimated 4 features for more complex transitions in `TradePlaybackModal` and `GreeksDashboard`.
- **Interactive Charts**: Enhance Skia-based charts in `HistoricalChart` with gestures for price/date scrubbing.


## Known Issues
- **IBKR Bridge Latency**: The HTTP bridge may timeout on cold starts (mitigated by retries).
- **Token Usage**: Gemini 3 interactions can be verbose; aggressive caching is in place.
