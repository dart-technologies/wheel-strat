# Wheel Strat Architecture

> **System Design for the "Marathon Agent" & iOS Trading Assistant**

## 1. System Overview

**Wheel Strat** is a local-first, AI-powered mobile app designed to orchestrate "The Wheel" trading strategy. The system is built around two core Gemini 3 features:

1. **Strategy Explainer**: On-demand AI analysis of any option trade
2. **Marathon Agent**: Scheduled market scans that push actionable alerts

```mermaid
graph TD
    subgraph "iOS App (Expo)"
        UI[Premium UI]
        TB[TinyBase State]
        SE[Strategy Explainer]
    end
    
    subgraph "Firebase Backend"
        CF[Cloud Functions]
        FS[Firestore]
        SCH[Cloud Scheduler]
    end
    
    subgraph "External Services"
        VA[Vertex AI - Gemini 3]
        MD[Market Data API]
    end
    
    UI --> TB
    SE --> CF
    CF --> VA
    CF --> MD
    SCH -->|9:30am & 3:30pm| CF
    CF --> FS
    FS --> TB
```

## 2. Gemini 3 Integration Points

### A. Strategy Explainer (User-Initiated)

**Purpose**: Transform complex options data into actionable insights.

**Flow**:
```mermaid
sequenceDiagram
    actor User
    participant App as iOS App
    participant CF as Cloud Function
    participant Gemini as Gemini 3 Pro
    
    User->>App: Tap "Explain TSLA 200P"
    App->>CF: POST /explainTrade
    Note right of CF: { contract, greeks, price }
    CF->>Gemini: Structured prompt with trade context
    Gemini-->>CF: Plain-English analysis
    CF-->>App: { explanation, riskLevel, recommendation }
    App->>User: Display in modal with animation
```

**Why Gemini 3?**
- **Enhanced reasoning**: Evaluates multi-factor risk (delta, theta decay, IV rank) in a single inference
- **Low latency**: Sub-second responses for real-time UX
- **Structured output**: Reliable JSON extraction for UI rendering

### B. Marathon Agent (Scheduled)

**Purpose**: Autonomous market monitoring that alerts users to opportunities.

**Schedule**: 
- **Market Open**: 9:30 AM EST
- **Market Close**: 3:30 PM EST

**Flow**:
```mermaid
sequenceDiagram
    participant SCH as Cloud Scheduler
    participant Agent as Agent Function
    participant MD as Market Data API
    participant Gemini as Gemini 3 Pro
    participant FS as Firestore
    participant App as iOS App
    
    SCH->>Agent: Trigger (9:30am / 3:30pm EST)
    Agent->>MD: Fetch Mag7 Option Chains
    MD-->>Agent: { chains: [...] }
    Agent->>Gemini: "Find high-IV wheel candidates"
    Gemini-->>Agent: { symbol: "TSLA", contract: "...", reason: "..." }
    Agent->>FS: Write Alert
    FS->>App: Real-time sync (TinyBase)
    App->>User: Push Notification
```

**Prompt Strategy**:
```
You are a "Wheel Strategy" scanner. Analyze these option chains:
- Identify puts with delta between -0.25 and -0.35
- Prioritize IV Rank > 50%
- Target 30-45 DTE expiration

Return the single best candidate with reasoning.
```

## 3. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **AI** | Gemini 3 Pro (Vertex AI) | Strategy reasoning & natural language |
| **Frontend** | React Native (Expo) | Native iOS experience |
| **Styling** | NativeWind | Premium glassmorphism UI |
| **State** | TinyBase | Offline-first reactivity |
| **Storage** | Expo SQLite | On-device persistence |
| **Cloud DB** | Firestore | Real-time sync & backup |
| **Compute** | Firebase Functions | AI proxy & Agent logic |
| **Scheduler** | Cloud Scheduler | Marathon Agent triggers |
| **Data** | Public.com / IBKR | Market data & Option chains |

## 4. Directory Structure

```
/
├── app/                    # Expo Router (Pages)
│   ├── (tabs)/
│   │   ├── index.tsx       # Dashboard (Home)
│   │   ├── lab.tsx         # Strategy Lab
│   │   └── journal.tsx     # Trade Journal
│   └── _layout.tsx
├── components/             # Reusable UI
│   ├── StrategyExplainer.tsx
│   └── AlertCard.tsx
├── services/
│   ├── gemini.ts           # Vertex AI client
│   ├── marketData.ts       # Public.com wrapper
│   └── tinybase.ts         # Store configuration
├── functions/              # Firebase Cloud Functions
│   └── src/
│       ├── explainTrade.ts # Strategy Explainer endpoint
│       ├── agent.ts        # Marathon Agent logic
│       └── prompts/
│           ├── explainer.ts
│           └── scanner.ts
└── store/                  # TinyBase schemas
```

## 5. Security

- **API Keys**: Stored in Google Secret Manager, accessed only by Cloud Functions
- **User Data**: Minimal PII; trades stored locally by default
- **Auth**: Firebase Auth (Guest mode for demo)

## 6. Deployment

- **iOS**: Expo Go / EAS Build
- **Backend**: Firebase Functions (Node.js 20)
- **Scheduler**: Cloud Scheduler (cron: `30 9,15 * * 1-5` EST)
