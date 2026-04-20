# Doppler — Production Vision & Implementation Plan

> CS2 Skin Market Intelligence Platform powered by AI Agents

---

## 1. Product Vision

Doppler is a full-stack AI-powered platform that gives CS2 traders and investors a decisive edge in the skin market. It combines real-time market data from Steam and CSFloat, autonomous deal-hunting agents, patch-note intelligence, and portfolio analytics — all orchestrated through a custom agentic framework built on the Vercel AI SDK.

The core promise: **your inventory is always working for you, even when you're not.**

### 1.1 Target Users

| Segment             | Description                                                 | Key Need                                |
| ------------------- | ----------------------------------------------------------- | --------------------------------------- |
| **Casual Trader**   | Plays CS2, has a small inventory, wants occasional tips     | Deal alerts, simple invest suggestions  |
| **Active Investor** | Actively buys/sells skins for profit, tracks multiple items | Arbitrage finder, patch impact analysis |
| **Power User**      | Wants full control — custom agents, auto-execution          | Custom flows, auto-approve buy/sell     |

### 1.2 Core Value Pillars

- **Intelligence** — AI agents that understand patch notes, meta shifts, and market history
- **Speed** — Real-time deal alerts before the market corrects
- **Autonomy** — Agents that can act on your behalf within defined safety limits
- **Transparency** — Every recommendation explains its reasoning

---

## 2. Tech Stack

### 2.1 Full Stack Overview

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                       │
│          Next.js 15 (App Router) + Tailwind CSS         │
│              shadcn/ui  +  Recharts / D3                │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                     API LAYER                           │
│              Express.js (Node 20+)                      │
│         REST endpoints  +  WebSocket (Socket.io)        │
└──────┬─────────────────┬──────────────────┬─────────────┘
       │                 │                  │
┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──────────────┐
│  Agent Core │  │  Job Queue   │  │  External APIs       │
│ Vercel AI   │  │  BullMQ +    │  │  Steam Market API    │
│ SDK +       │  │  Redis       │  │  CSFloat API         │
│ Custom      │  │              │  │  Web Search          │
│ Framework   │  └──────────────┘  │  Patch Note Scraper  │
└──────┬──────┘                    └──────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────┐
│                    DATA LAYER                           │
│          PostgreSQL (Supabase)  +  Redis (Cache)        │
│                Prisma ORM                               │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Technology Decisions

| Layer                       | Choice                                  | Why                                                 |
| --------------------------- | --------------------------------------- | --------------------------------------------------- |
| Frontend                    | Next.js 15 (App Router)                 | React-based (familiar), SSR, API routes             |
| Backend                     | Express.js on Node 20                   | You know it, great ecosystem, WebSocket support     |
| Agent Framework             | **Vercel AI SDK + custom orchestrator** | Native streaming, tool use, multi-step agents in JS |
| Database                    | PostgreSQL via Supabase                 | Relational data (portfolios, alerts, trade history) |
| Caching                     | Redis (Upstash)                         | Price data cache, job queue backend                 |
| Job Queue                   | BullMQ                                  | Scheduled agent runs, deal polling                  |
| Auth                        | Supabase Auth                           | OAuth (Steam login), magic links, sessions          |
| Real-time                   | Socket.io                               | Push deal alerts to browser instantly               |
| Push Notifications (mobile) | Firebase Cloud Messaging                | Cross-platform push alerts                          |
| Hosting — Frontend          | Vercel                                  | Zero-config Next.js deploy                          |
| Hosting — Backend           | Railway                                 | Express + BullMQ workers, persistent                |
| Hosting — DB                | Supabase                                | Managed Postgres + auth + realtime                  |

### 2.3 Monorepo Structure (Turborepo)

```
Doppler/
├── apps/
│   ├── web/                  → Next.js 15 frontend
│   ├── api/                  → Express.js backend
│   └── mobile/               → Expo (React Native) — Phase 2
├── packages/
│   ├── agents/               → Custom agent framework + Vercel AI SDK tools
│   ├── db/                   → Prisma schema + migrations
│   ├── types/                → Shared TypeScript types
│   ├── steam-client/         → Steam API wrapper
│   ├── csfloat-client/       → CSFloat API wrapper
│   └── utils/                → Shared utilities (price formatters, etc.)
├── turbo.json
└── package.json
```

---

## 3. Agent Architecture

### 3.1 Custom Agentic Framework (JS/TS)

Built on top of the **Vercel AI SDK** (`ai` package). The SDK handles streaming, tool calling, and multi-step reasoning. We write a thin orchestration layer on top.

```typescript
// packages/agents/src/core/AgentRunner.ts

import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";

export class AgentRunner {
  constructor(
    private tools: Record<string, Tool>,
    private systemPrompt: string,
    private maxSteps: number = 10,
  ) {}

  async run(userInput: string, context: AgentContext) {
    return generateText({
      model: openai("gpt-4o"),
      system: this.systemPrompt,
      prompt: userInput,
      tools: this.tools,
      maxSteps: this.maxSteps, // Vercel AI SDK handles multi-step loops
      onStepFinish: (step) => {
        this.logStep(step, context); // Audit trail for every tool call
      },
    });
  }
}
```

### 3.2 Agent Types

| Agent                 | Trigger                        | Tools Used                                          | Output                      |
| --------------------- | ------------------------------ | --------------------------------------------------- | --------------------------- |
| **Deal Hunter**       | Every 5 min (BullMQ)           | `searchCSFloat`, `getSteamPrice`, `comparePrice`    | Deal alert via WebSocket    |
| **Patch Analyst**     | On new patch (webhook/scraper) | `webSearch`, `fetchPatchNotes`, `getPriceHistory`   | Patch impact report         |
| **Portfolio Advisor** | On demand / daily              | `getInventory`, `getPriceHistory`, `getMarketTrend` | Invest/sell recommendations |
| **Auction Sniper**    | Every 2 min                    | `searchCSFloatAuctions`, `evaluateDeal`             | Expiring auction alerts     |
| **Case Analyst**      | Weekly / on demand             | `webSearch`, `getCaseHistory`, `getPatchContext`    | Case investment outlook     |
| **Custom Agent**      | User-defined                   | Any combination                                     | User-defined                |

### 3.3 Tool Definitions (Vercel AI SDK pattern)

```typescript
// packages/agents/src/tools/steamTools.ts
import { tool } from "ai";
import { z } from "zod";

export const getSteamPrice = tool({
  description:
    "Get the current Steam Market price and 30-day price history for a CS2 skin",
  parameters: z.object({
    itemName: z.string().describe("The full market hash name of the CS2 item"),
    currency: z.number().default(1).describe("Steam currency code (1 = USD)"),
  }),
  execute: async ({ itemName, currency }) => {
    // Calls Steam Market API, returns cached data from Redis if fresh
    return await steamClient.getPriceHistory(itemName, currency);
  },
});

export const searchCSFloat = tool({
  description:
    "Search CSFloat marketplace for listings of a specific skin, optionally filtered by float range and price",
  parameters: z.object({
    itemName: z.string(),
    maxPrice: z.number().optional(),
    maxFloat: z.number().optional(),
    minFloat: z.number().optional(),
    sortBy: z.enum(["price", "float", "listed_at"]).default("price"),
  }),
  execute: async (params) => {
    return await csFloatClient.searchListings(params);
  },
});

export const webSearch = tool({
  description: "Search the web for CS2 news, patch notes, or market commentary",
  parameters: z.object({
    query: z.string(),
    dateFilter: z.enum(["day", "week", "month"]).optional(),
  }),
  execute: async ({ query, dateFilter }) => {
    return await searchService.search(query, dateFilter);
  },
});
```

### 3.4 Auto-Approve Safety System

```typescript
// packages/agents/src/core/ActionGuard.ts

interface AutoApproveConfig {
  maxBuyAmount: number; // e.g. $25 max per auto-buy
  maxSellDiscount: number; // e.g. won't sell for less than 85% of market price
  dailySpendLimit: number; // e.g. $100/day total
  requireConfirmAbove: number; // Always ask user if deal is above this value
}

export class ActionGuard {
  async evaluate(
    action: TradeAction,
    config: AutoApproveConfig,
  ): Promise<ApprovalResult> {
    if (action.value > config.requireConfirmAbove) {
      return {
        approved: false,
        reason: "above_confirm_threshold",
        requiresUserApproval: true,
      };
    }
    if (action.value > config.maxBuyAmount) {
      return { approved: false, reason: "exceeds_auto_buy_limit" };
    }
    const todaySpend = await this.getTodaySpend(action.userId);
    if (todaySpend + action.value > config.dailySpendLimit) {
      return { approved: false, reason: "daily_limit_reached" };
    }
    return { approved: true };
  }
}
```

---

## 4. Database Schema

```sql
-- Users & Auth
users (id, steam_id, email, created_at, plan)
user_settings (user_id, auto_approve_config jsonb, notification_prefs jsonb)

-- Portfolio & Inventory
inventory_snapshots (id, user_id, items jsonb, captured_at, total_value_usd)
watchlist (id, user_id, item_name, target_price, alert_type)

-- Market Data (cached, time-series)
price_history (id, item_name, platform, price_usd, float_value, recorded_at)
listings_cache (id, item_name, platform, listing_data jsonb, cached_at)

-- Agent System
agent_configs (id, user_id, name, type, tools jsonb, schedule, enabled)
agent_runs (id, agent_config_id, started_at, completed_at, status, output jsonb)
agent_actions (id, agent_run_id, action_type, payload jsonb, approval_status, executed_at)

-- Alerts & Notifications
alerts (id, user_id, type, payload jsonb, seen, created_at)
deals (id, user_id, item_name, platform, deal_data jsonb, expires_at, notified_at)

-- Market Intelligence
patch_reports (id, patch_version, published_at, analysis jsonb, affected_items jsonb)
investment_reports (id, generated_at, scope, recommendations jsonb)
```

---

## 5. Key Feature Flows

### 5.1 Deal Hunter Flow

```
BullMQ Job (every 5 min)
  → DealHunterAgent.run()
    → Tool: searchCSFloat({ sortBy: 'price', limit: 50 })
    → Tool: getSteamPrice(itemName) for each result
    → LLM evaluates: "Is this listing underpriced vs Steam? Factor in fees."
    → If deal score > threshold:
      → Save to deals table
      → Emit via Socket.io to connected user
      → Send FCM push notification (mobile)
      → If auto-approve enabled + within limits → ActionGuard.evaluate() → execute buy
```

### 5.2 Patch Intelligence Flow

```
Valve patch detected (scraper polls store.steampowered.com/news every hour)
  → New patch found → PatchAnalystAgent.run()
    → Tool: webSearch("CS2 patch [version] skin impact")
    → Tool: getPriceHistory(affectedItems[], lookback: '90d')
    → Tool: webSearch("CS2 [affected weapon] meta 2025")
    → LLM synthesizes: affected skins, predicted direction, confidence score
    → Save patch_report to DB
    → Notify all users with relevant items in inventory or watchlist
```

### 5.3 Custom Agent Flow (Power Users)

```
User defines agent in UI:
  - Name: "Karambit Doppler Sniper"
  - Tools: [searchCSFloat, getSteamPrice, sendAlert]
  - Prompt: "Find Karambit Doppler Phase 2 listings below $400 with float under 0.01"
  - Schedule: Every 10 minutes
  - Auto-approve: Buy if under $380

→ Saved as agent_config row
→ BullMQ picks up on schedule → runs AgentRunner with user config
→ ActionGuard evaluates any buy actions before execution
```

---

## 6. API Design

### 6.1 REST Endpoints (Express)

```
Authentication
  POST   /api/auth/steam          → Steam OpenID login
  POST   /api/auth/refresh        → Refresh JWT

Inventory
  GET    /api/inventory           → Fetch user's Steam inventory (cached)
  GET    /api/inventory/value     → Portfolio valuation across platforms
  POST   /api/inventory/sync      → Trigger fresh sync from Steam

Market
  GET    /api/market/price/:item  → Multi-platform price for an item
  GET    /api/market/listings     → CSFloat listings with filters
  GET    /api/market/auctions     → Expiring CSFloat auctions

Agents
  GET    /api/agents              → List user's agent configs
  POST   /api/agents              → Create new agent config
  PUT    /api/agents/:id          → Update agent config
  DELETE /api/agents/:id          → Delete agent config
  POST   /api/agents/:id/run      → Trigger manual run
  GET    /api/agents/:id/history  → Past run logs + outputs

Alerts & Deals
  GET    /api/alerts              → User's alerts (paginated)
  PATCH  /api/alerts/:id/seen    → Mark alert seen
  GET    /api/deals               → Active deal recommendations

Intelligence
  GET    /api/intelligence/patches        → Patch reports list
  GET    /api/intelligence/patches/:id    → Specific patch report
  GET    /api/intelligence/invest         → Investment recommendations
  POST   /api/intelligence/ask            → Freeform AI query (streaming)

Actions (Auto-trade)
  POST   /api/actions/approve/:id   → User approves pending action
  POST   /api/actions/reject/:id    → User rejects pending action
  GET    /api/actions/pending       → Pending actions awaiting approval

Settings
  GET    /api/settings/auto-approve  → Get auto-approve config
  PUT    /api/settings/auto-approve  → Update limits
  PUT    /api/settings/notifications → Notification preferences
```

### 6.2 WebSocket Events (Socket.io)

```typescript
// Server → Client
'deal:new'          → { dealId, itemName, platform, discount, expiresAt }
'deal:expired'      → { dealId }
'alert:new'         → { alertId, type, message, payload }
'agent:run:start'   → { agentId, runId }
'agent:run:finish'  → { agentId, runId, summary }
'action:pending'    → { actionId, type, item, value }  // requires user approval
'price:update'      → { itemName, platform, price }    // watchlist items only
```

---

## 7. External API Integrations

### 7.1 Steam APIs

| API                             | Usage           | Auth                |
| ------------------------------- | --------------- | ------------------- |
| Steam OpenID                    | User login      | Public              |
| `ISteamUser/GetPlayerSummaries` | Profile data    | API Key             |
| `IEconItems_730/GetPlayerItems` | Inventory fetch | User session        |
| Steam Market Price Overview     | Price lookups   | None (rate limited) |
| Steam Market Price History      | Historical data | Login cookie        |

> **Note:** Steam aggressively rate-limits unauthenticated price history calls. Cache all responses in Redis with a 15-min TTL minimum.

### 7.2 CSFloat API

| Endpoint                  | Usage                                              |
| ------------------------- | -------------------------------------------------- |
| `GET /listings`           | Search marketplace listings                        |
| `GET /auctions`           | Expiring auction listings                          |
| `GET /me/inventory`       | Authenticated user inventory on CSFloat            |
| `POST /listings/{id}/buy` | Execute buy (requires user API key)                |
| Webhooks                  | Real-time listing events (new, sold, price change) |

### 7.3 Web Search / Scraping

- **Tavily API** — best LLM-optimized web search API for agents
- **Cheerio + Axios** — scrape Valve's Steam news RSS for patch notes
- **Playwright** — headless browser fallback for JS-rendered pages if needed

---

## 8. Implementation Plan

### Phase 1 — Foundation (Weeks 1–3)

**Goal:** Monorepo scaffolded, auth working, basic price data flowing.

- [ ] Initialize Turborepo monorepo with `apps/web`, `apps/api`, `packages/*`
- [ ] Set up Next.js 15 with App Router + Tailwind + shadcn/ui
- [ ] Set up Express.js with TypeScript, Prisma, Supabase Postgres
- [ ] Implement Steam OpenID login (Supabase Auth + Steam provider)
- [ ] Create `packages/steam-client` — inventory fetch + price lookup + Redis caching
- [ ] Create `packages/csfloat-client` — listings search + auction fetch
- [ ] Set up BullMQ with Upstash Redis
- [ ] Basic dashboard UI: inventory list + current prices

**Deliverable:** A user can log in with Steam, see their inventory with current prices.

---

### Phase 2 — Core Agent System (Weeks 4–6)

**Goal:** Deal Hunter and Patch Analyst agents running end-to-end.

- [ ] Set up `packages/agents` with Vercel AI SDK (`ai`, `@ai-sdk/openai`)
- [ ] Build `AgentRunner` core class with tool registration + step logging
- [ ] Build `ActionGuard` with configurable limits
- [ ] Implement tools: `getSteamPrice`, `searchCSFloat`, `webSearch`, `getInventory`
- [ ] Build **Deal Hunter Agent** + BullMQ job (every 5 min)
- [ ] Build **Patch Analyst Agent** + Valve news scraper trigger
- [ ] Set up Socket.io for real-time deal push to browser
- [ ] Alerts UI: real-time deal feed, patch impact cards

**Deliverable:** Platform automatically surfaces underpriced CSFloat deals and explains patch impacts.

---

### Phase 3 — Intelligence Layer (Weeks 7–9)

**Goal:** Portfolio advisor, auction sniper, case analyst, and investment reports.

- [ ] Build **Portfolio Advisor Agent** — analyzes user inventory, suggests holds/sells
- [ ] Build **Auction Sniper Agent** — monitors expiring auctions every 2 min
- [ ] Build **Case Analyst Agent** — weekly report on which cases to buy/avoid
- [ ] Build freeform **AI Query endpoint** (`POST /api/intelligence/ask`) with streaming response
- [ ] Add Recharts-based price history charts per skin
- [ ] Investment report UI with confidence scores and reasoning chains
- [ ] Watchlist: user adds skins to watch, agents monitor them specifically

**Deliverable:** Full intelligence suite — users get daily briefings and on-demand AI analysis.

---

### Phase 4 — Power User Features (Weeks 10–12)

**Goal:** Custom agent builder, auto-approve execution, settings.

- [ ] **Custom Agent Builder UI** — drag-and-drop tool selection, prompt editor, schedule picker
- [ ] Save/load custom agents as `agent_configs` rows
- [ ] **Auto-approve settings UI** — set spend limits, per-item limits, daily cap
- [ ] Wire `ActionGuard` into execution flow — auto-execute or surface pending approval
- [ ] **Pending Actions UI** — approve/reject queue with deal context
- [ ] Agent run history UI — step-by-step reasoning viewer (what the agent thought + did)
- [ ] Notification settings — email, browser push, Discord webhook

**Deliverable:** Power users can define, schedule, and auto-execute their own agent strategies.

---

### Phase 5 — Mobile (Weeks 13–16)

**Goal:** Expo mobile app sharing all core logic from `packages/*`.

- [ ] Initialize `apps/mobile` with Expo + Expo Router
- [ ] Extract all API call logic into `packages/api-client` (shared by web + mobile)
- [ ] Extract state management into `packages/store` (Zustand)
- [ ] Mobile screens: Dashboard, Deals Feed, Alerts, Portfolio, Settings
- [ ] Firebase Cloud Messaging push notifications (deal alerts, pending actions)
- [ ] Biometric auth for action approval on mobile
- [ ] Submit to TestFlight + Google Play internal track

---

### Phase 6 — Polish & Launch (Weeks 17–18)

- [ ] Rate limiting on all API routes (express-rate-limit)
- [ ] Error monitoring (Sentry)
- [ ] Analytics (Posthog)
- [ ] Comprehensive README + architecture diagram
- [ ] Landing page with waitlist / pricing tiers
- [ ] Production hardening: API key rotation, secrets management, DB connection pooling

---

## 9. Project Folder Structure (Detailed)

```
Doppler/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── page.tsx              → Portfolio overview
│   │   │   │   ├── deals/page.tsx        → Live deal feed
│   │   │   │   ├── alerts/page.tsx       → Alert history
│   │   │   │   ├── intelligence/page.tsx → Patch reports + investment
│   │   │   │   ├── agents/page.tsx       → Custom agent builder
│   │   │   │   └── settings/page.tsx
│   │   │   └── api/                      → Next.js API routes (thin proxy to Express)
│   │   └── components/
│   │       ├── deals/DealCard.tsx
│   │       ├── charts/PriceChart.tsx
│   │       ├── agents/AgentBuilder.tsx
│   │       └── inventory/InventoryTable.tsx
│   │
│   └── api/
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── inventory.ts
│       │   │   ├── market.ts
│       │   │   ├── agents.ts
│       │   │   ├── intelligence.ts
│       │   │   └── actions.ts
│       │   ├── jobs/
│       │   │   ├── dealHunter.job.ts
│       │   │   ├── patchScraper.job.ts
│       │   │   ├── auctionSniper.job.ts
│       │   │   └── portfolioAdvisor.job.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts
│       │   │   └── rateLimiter.ts
│       │   └── server.ts
│       └── package.json
│
├── packages/
│   ├── agents/
│   │   ├── src/
│   │   │   ├── core/
│   │   │   │   ├── AgentRunner.ts
│   │   │   │   └── ActionGuard.ts
│   │   │   ├── tools/
│   │   │   │   ├── steamTools.ts
│   │   │   │   ├── csFloatTools.ts
│   │   │   │   ├── webSearchTools.ts
│   │   │   │   └── portfolioTools.ts
│   │   │   └── agents/
│   │   │       ├── dealHunter.ts
│   │   │       ├── patchAnalyst.ts
│   │   │       ├── portfolioAdvisor.ts
│   │   │       ├── auctionSniper.ts
│   │   │       └── caseAnalyst.ts
│   │   └── package.json
│   │
│   ├── db/
│   │   ├── prisma/schema.prisma
│   │   └── src/index.ts              → Prisma client export
│   │
│   ├── steam-client/
│   │   └── src/
│   │       ├── inventory.ts
│   │       ├── prices.ts
│   │       └── cache.ts              → Redis caching layer
│   │
│   ├── csfloat-client/
│   │   └── src/
│   │       ├── listings.ts
│   │       ├── auctions.ts
│   │       └── webhooks.ts
│   │
│   └── types/
│       └── src/
│           ├── market.ts
│           ├── agents.ts
│           └── inventory.ts
│
├── turbo.json
├── package.json
└── .env.example
```

---

## 10. Environment Variables

```bash
# AI
OPENAI_API_KEY=

# Steam
STEAM_API_KEY=
STEAM_WEB_API_BASE=https://api.steampowered.com

# CSFloat
CSFLOAT_API_KEY=
CSFLOAT_WEBHOOK_SECRET=

# Search
TAVILY_API_KEY=

# Database
DATABASE_URL=                     # Supabase Postgres connection string
DIRECT_URL=                       # Supabase direct connection (for Prisma migrations)

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Auth (Supabase)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Firebase (push notifications)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# App
NEXT_PUBLIC_API_URL=http://localhost:4000
JWT_SECRET=
```

---

## 11. Resume-Worthy Talking Points

Once built, this project lets you speak confidently to:

- **Multi-agent orchestration** — designing stateful, tool-calling AI agents with safety guardrails
- **Real-time systems** — WebSocket push, BullMQ job queues, Redis caching under rate-limited APIs
- **Full-stack TypeScript** — monorepo architecture with shared packages across web, API, and mobile
- **Third-party API integration** — Steam, CSFloat, web search, webhooks
- **Agentic safety design** — ActionGuard pattern, user-defined spend limits, approval flows
- **Custom framework design** — building an abstraction on top of Vercel AI SDK
- **Turborepo monorepo** — shared types, clients, and business logic across multiple apps
- **Scalable scheduling** — BullMQ workers that handle concurrent agent runs independently
