# Doppler — Implementation Plan
> Engineering reference document. Living plan — update as decisions evolve.

---

## 1. Repository Setup

### 1.1 Monorepo with Turborepo

Doppler uses a Turborepo monorepo. All apps and shared packages live in a single repository. This means shared TypeScript types, API clients, and business logic are written once and consumed by both the web app and (later) the mobile app.

```
doppler/
├── apps/
│   ├── web/                   → Next.js 15 (App Router)
│   ├── api/                   → Express.js backend (REST + WebSocket)
│   ├── worker/                → BullMQ agent workers (separate process)
│   └── mobile/                → Expo (React Native) — Phase 5
├── packages/
│   ├── agents/                → Agent framework + all agent definitions
│   ├── db/                    → Prisma schema, client, migrations, typed Json helpers
│   ├── steam-client/          → Steam API + Market wrapper
│   ├── csfloat-client/        → CSFloat API wrapper
│   └── types/                 → All shared TypeScript interfaces + Zod schemas
├── turbo.json
├── package.json               → Root workspace config
├── tsconfig.base.json         → Shared strict TypeScript config
└── .env.example
```

> **Note:** `packages/api-client` and `packages/store` are created in Phase 5 (mobile)
> when shared client-side code is needed across web and mobile.


### 1.2 Bootstrapping Commands

```bash
# Initialize monorepo
npx create-turbo@latest doppler
cd doppler

# Create apps
cd apps
npx create-next-app@latest web --typescript --tailwind --app
mkdir api && cd api && npm init -y

# Initialize packages
cd ../../packages
mkdir agents db steam-client csfloat-client api-client store types
# Each gets its own package.json with name: "@doppler/package-name"

# Install shared dev dependencies at root
npm install -D typescript @types/node turbo prettier eslint
```

### 1.3 turbo.json (Turbo v2 syntax)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

### 1.4 Shared tsconfig.base.json

All packages and apps extend this base config. Strict mode is non-negotiable.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "exclude": ["node_modules", "dist"]
}
```

Key flags:
- `strict: true` — enables `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, and all other strict checks
- `noUncheckedIndexedAccess: true` — array/object index access returns `T | undefined` instead of `T`, prevents runtime crashes on missing keys
- `noImplicitOverride: true` — forces explicit `override` keyword on method overrides

---

## 2. Tech Stack — Detailed Decisions

### 2.1 Frontend — Next.js 15 (App Router)

| Decision | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 | App Router, RSC, built-in API routes, Vercel deploy |
| Styling | Tailwind CSS + shadcn/ui | Utility-first, great component library, customizable |
| State | Zustand | Lightweight, no boilerplate, works in shared packages |
| Data fetching | TanStack Query (React Query) | Caching, background refresh, loading states |
| Charts | Recharts | React-native, flexible, good for price history |
| Real-time | Socket.io-client | Deal push, agent run updates |
| Forms | React Hook Form + Zod | Type-safe, performant |
| Animation | Framer Motion | Deal card animations, agent run visualizer |

### 2.2 Backend — Express.js

| Decision | Choice | Reason |
|---|---|---|
| Runtime | Node.js 20+ | LTS, native fetch, good performance |
| Framework | Express.js | Familiar, flexible, huge ecosystem |
| Language | TypeScript | End-to-end type safety with shared packages |
| Auth middleware | express-jwt + Supabase | Validate JWT from Supabase Auth |
| Validation | Zod | Same schemas reused from agent tool definitions |
| Rate limiting | express-rate-limit + Redis | Per-user and per-endpoint limits |
| WebSocket | Socket.io | Rooms per user, deal push, agent events |
| HTTP client | Axios | Steam + CSFloat API calls |
| Logging | Pino | Fast structured JSON logging |

### 2.3 Agent Framework — Vercel AI SDK

| Decision | Choice | Reason |
|---|---|---|
| Core SDK | `ai` (Vercel AI SDK) | Native streaming, tool use, multi-step in JS |
| LLM Provider | OpenAI GPT-4o | Best tool-calling reliability; swap via SDK provider |
| Tool definitions | Zod schemas | Type-safe, auto-validated, reusable |
| Multi-step | `maxSteps` on `generateText` | SDK handles the loop natively |
| Streaming | `streamText` | Used for the freeform AI query endpoint |
| Custom layer | `AgentRunner` class | Wraps SDK, adds logging, context injection |

### 2.4 Data Layer

| Decision | Choice | Reason |
|---|---|---|
| Primary DB | PostgreSQL (Supabase) | Relational data, auth included, real-time subscriptions |
| ORM | Prisma | Type-safe queries, migrations, great DX |
| Cache | Redis (Upstash) | Price data TTL cache, BullMQ backend |
| Job queue | BullMQ | Reliable, Redis-backed, cron + one-off jobs |
| Search | Native Postgres full-text | For item name search; no separate search engine needed |

### 2.5 Infrastructure

| Service | Provider | Why |
|---|---|---|
| Frontend hosting | Vercel | Zero-config Next.js, Edge Network |
| API hosting | Railway | Persistent Node process, BullMQ workers, auto-deploy |
| Database | Supabase | Managed Postgres + Auth + real-time |
| Redis | Upstash | Serverless Redis, pay-per-request, global |
| Push notifications | Firebase (FCM) | Cross-platform mobile push |
| Error monitoring | Sentry | Full-stack error tracking |
| Analytics | PostHog | Product analytics, session replay |
| Secrets | Railway env + Vercel env | Per-environment secret management |

---

## 3. Database Schema — Full Definition

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─── USERS ───────────────────────────────────────────────

model User {
  id              String    @id @default(cuid())
  steamId         String    @unique
  email           String?   @unique
  displayName     String
  avatarUrl       String?
  plan            Plan      @default(FREE)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  settings        UserSettings?
  watchlistItems  WatchlistItem[]
  agentConfigs    AgentConfig[]
  agentRuns       AgentRun[]
  alerts          Alert[]
  deals           Deal[]
  actions         AgentAction[]
  inventorySnaps  InventorySnapshot[]
  portfolioItems  PortfolioItem[]

  @@map("users")
}

model UserSettings {
  id                    String   @id @default(cuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Auto-approve configuration
  autoApproveEnabled    Boolean  @default(false)
  maxBuyPerTransaction  Float    @default(10.0)
  maxSellDiscountPct    Float    @default(0.85)  // Won't sell for less than 85% of market
  dailySpendLimit       Float    @default(50.0)
  confirmAbove          Float    @default(25.0)  // Always ask if deal above this

  // Notification preferences
  browserPushEnabled    Boolean  @default(true)
  mobilePushEnabled     Boolean  @default(false)
  discordWebhookUrl     String?
  emailEnabled          Boolean  @default(false)

  // API Keys (encrypted at rest)
  csFloatApiKey         String?
  fcmDeviceToken        String?

  updatedAt             DateTime @updatedAt

  @@map("user_settings")
}

enum Plan {
  FREE
  TRADER
  INVESTOR
  PRO
}

// ─── INVENTORY & PORTFOLIO ────────────────────────────────

model InventorySnapshot {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  items       Json     // Full inventory array from Steam API
  totalValue  Float    // USD value at time of snapshot
  capturedAt  DateTime @default(now())

  @@index([userId, capturedAt])
  @@map("inventory_snapshots")
}

model PortfolioItem {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemName        String    // Steam market hash name
  assetId         String    // Steam asset ID
  purchasePrice   Float?    // What user paid (manually entered or from trade history)
  purchasedAt     DateTime?
  currentValue    Float?    // Last known value
  status          ItemStatus @default(HOLDING)
  notes           String?
  updatedAt       DateTime  @updatedAt
  createdAt       DateTime  @default(now())

  @@unique([userId, assetId])
  @@map("portfolio_items")
}

enum ItemStatus {
  HOLDING
  WATCHING
  SELL_TARGET
  SOLD
}

// ─── MARKET DATA ─────────────────────────────────────────

model PriceHistory {
  id          String   @id @default(cuid())
  itemName    String
  platform    Platform
  priceUsd    Float
  volume      Int?
  recordedAt  DateTime @default(now())

  @@index([itemName, platform, recordedAt])
  @@map("price_history")
}

model ListingCache {
  id          String   @id @default(cuid())
  itemName    String
  platform    Platform
  listingData Json     // Raw listing object from platform API
  priceUsd    Float
  floatValue  Float?
  expiresAt   DateTime?
  cachedAt    DateTime @default(now())

  @@index([itemName, platform])
  @@map("listings_cache")
}

enum Platform {
  STEAM
  CSFLOAT
  // SKINPORT  — Phase 2+ (post-launch roadmap)
  // BUFF163   — Phase 2+ (post-launch roadmap)
}

// ─── WATCHLIST ────────────────────────────────────────────

model WatchlistItem {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemName        String
  targetPriceLow  Float?    // Alert if price drops below this
  targetPriceHigh Float?    // Alert if price rises above this
  targetFloat     Float?    // Alert if listing appears with float below this
  platform        Platform  @default(STEAM)
  createdAt       DateTime  @default(now())

  @@unique([userId, itemName, platform])
  @@map("watchlist_items")
}

// ─── AGENTS ──────────────────────────────────────────────

model AgentConfig {
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  name            String
  type            AgentType
  description     String?
  systemPrompt    String      // The goal prompt
  tools           String[]    // Tool names this agent can use
  scheduleType    ScheduleType @default(INTERVAL)
  scheduleValue   String      // Cron string or interval in ms
  enabled         Boolean     @default(true)
  isCustom        Boolean     @default(false)

  // Auto-approve overrides (inherits from UserSettings if null)
  autoApproveEnabled  Boolean? 
  maxBuyOverride      Float?
  dailyLimitOverride  Float?

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  runs            AgentRun[]

  @@map("agent_configs")
}

model AgentRun {
  id            String      @id @default(cuid())
  agentConfigId String
  agentConfig   AgentConfig @relation(fields: [agentConfigId], references: [id], onDelete: Cascade)
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  status        RunStatus   @default(RUNNING)
  steps         Json?       // Array of {tool, input, output, reasoning} per step
  summary       String?     // Human-readable summary of what the agent did
  dealsFound    Int         @default(0)
  actionsCount  Int         @default(0)
  errorMessage  String?
  startedAt     DateTime    @default(now())
  completedAt   DateTime?

  actions       AgentAction[]

  @@index([agentConfigId, startedAt])
  @@map("agent_runs")
}

model AgentAction {
  id            String        @id @default(cuid())
  agentRunId    String
  agentRun      AgentRun      @relation(fields: [agentRunId], references: [id], onDelete: Cascade)
  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  actionType    ActionType
  platform      Platform
  itemName      String
  valueUsd      Float
  payload       Json          // Full action details (listing id, offer id, etc.)
  reasoning     String        // Agent's explanation for this action
  approvalStatus ApprovalStatus @default(PENDING)
  approvedAt    DateTime?
  executedAt    DateTime?
  outcome       Json?         // Result of execution (success, error, final price)
  expiresAt     DateTime?     // If not approved by this time, auto-reject
  createdAt     DateTime      @default(now())

  @@index([userId, approvalStatus])
  @@map("agent_actions")
}

enum AgentType {
  DEAL_HUNTER
  AUCTION_SNIPER
  PATCH_ANALYST
  PORTFOLIO_ADVISOR
  CASE_ANALYST
  TOURNAMENT_TRACKER
  CUSTOM
}

enum ScheduleType {
  INTERVAL    // Run every N minutes
  CRON        // Cron expression
  EVENT       // Triggered by external event (new patch, etc.)
  MANUAL      // Only runs when user triggers
}

enum RunStatus {
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum ActionType {
  BUY
  SELL
  ALERT
}

enum ApprovalStatus {
  PENDING
  AUTO_APPROVED
  USER_APPROVED
  REJECTED
  EXPIRED
  EXECUTED
  FAILED
}

// ─── ALERTS & DEALS ──────────────────────────────────────

model Alert {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        AlertType
  title       String
  message     String
  payload     Json?     // Rich data (item name, price, platform, etc.)
  seen        Boolean   @default(false)
  seenAt      DateTime?
  createdAt   DateTime  @default(now())

  @@index([userId, seen, createdAt])
  @@map("alerts")
}

model Deal {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemName      String
  platform      Platform
  listingId     String    // Platform-specific listing ID
  listedPrice   Float
  steamPrice    Float
  discountPct   Float     // How much cheaper vs Steam
  floatValue    Float?
  dealScore     Float     // 0-100 composite deal quality score
  expiresAt     DateTime? // For auctions
  dealData      Json      // Full listing snapshot
  notifiedAt    DateTime  @default(now())
  actionTaken   Boolean   @default(false)
  actionId      String?

  @@index([userId, notifiedAt])
  @@map("deals")
}

enum AlertType {
  DEAL_FOUND
  AUCTION_EXPIRING
  PRICE_TARGET_HIT
  PATCH_IMPACT
  PORTFOLIO_ALERT
  ACTION_PENDING
  ACTION_EXECUTED
  AGENT_ERROR
}

// ─── INTELLIGENCE ─────────────────────────────────────────

model PatchReport {
  id              String    @id @default(cuid())
  patchVersion    String
  publishedAt     DateTime
  rawNotes        String    // Full patch note text
  analysis        Json      // Structured analysis from agent
  affectedItems   Json      // Array of {itemName, direction, confidence, reasoning}
  generatedAt     DateTime  @default(now())

  @@unique([patchVersion])
  @@map("patch_reports")
}

model InvestmentReport {
  id                String    @id @default(cuid())
  generatedAt       DateTime  @default(now())
  scope             String    // e.g. "cases", "rifles", "knives", "weekly"
  recommendations   Json      // Array of {itemName, action, rationale, timeHorizon, riskLevel}
  validUntil        DateTime

  @@map("investment_reports")
}
```

---

## 4. Agent Framework — Full Implementation

### 4.1 AgentRunner Core

```typescript
// packages/agents/src/core/AgentRunner.ts

import { generateText, streamText, CoreTool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { AgentContext, AgentStep, AgentRunResult } from '@doppler/types';

export interface AgentRunnerConfig {
  name: string;
  systemPrompt: string;
  tools: Record<string, CoreTool>;
  maxSteps?: number;
  model?: string;
  onStepFinish?: (step: AgentStep, context: AgentContext) => Promise<void>;
}

export class AgentRunner {
  constructor(private config: AgentRunnerConfig) {}

  async run(input: string, context: AgentContext): Promise<AgentRunResult> {
    const steps: AgentStep[] = [];

    const result = await generateText({
      model: openai(this.config.model ?? 'gpt-4o'),
      system: this.buildSystemPrompt(context),
      prompt: input,
      tools: this.config.tools,
      maxSteps: this.config.maxSteps ?? 10,

      onStepFinish: async (step) => {
        const agentStep: AgentStep = {
          stepNumber: steps.length + 1,
          text: step.text,
          toolCalls: step.toolCalls,
          toolResults: step.toolResults,
          usage: step.usage,
          finishReason: step.finishReason,
          timestamp: new Date(),
        };
        steps.push(agentStep);

        if (this.config.onStepFinish) {
          await this.config.onStepFinish(agentStep, context);
        }
      },
    });

    return {
      text: result.text,
      steps,
      totalTokens: result.usage.totalTokens,
      finishReason: result.finishReason,
    };
  }

  // For streaming to the browser (freeform AI query endpoint)
  stream(input: string, context: AgentContext) {
    return streamText({
      model: openai(this.config.model ?? 'gpt-4o'),
      system: this.buildSystemPrompt(context),
      prompt: input,
      tools: this.config.tools,
      maxSteps: this.config.maxSteps ?? 10,
    });
  }

  private buildSystemPrompt(context: AgentContext): string {
    const contextBlock = `
Current date: ${new Date().toISOString()}
User Steam ID: ${context.userId}
User plan: ${context.plan}
User's watchlist items: ${context.watchlistItems?.join(', ') ?? 'none'}
`.trim();

    return `${this.config.systemPrompt}\n\n---\nCONTEXT:\n${contextBlock}`;
  }
}
```

### 4.2 ActionGuard

```typescript
// packages/agents/src/core/ActionGuard.ts

import { prisma } from '@doppler/db';
import { TradeAction, ApprovalResult, AutoApproveConfig } from '@doppler/types';

export class ActionGuard {
  async evaluate(
    action: TradeAction,
    config: AutoApproveConfig,
    userId: string
  ): Promise<ApprovalResult> {

    // Always require confirmation above threshold
    if (action.valueUsd > config.confirmAbove) {
      return {
        approved: false,
        requiresUserApproval: true,
        reason: 'above_confirm_threshold',
        message: `Action value $${action.valueUsd} exceeds your confirm threshold of $${config.confirmAbove}`,
      };
    }

    // Check per-transaction limit
    if (action.type === 'BUY' && action.valueUsd > config.maxBuyPerTransaction) {
      return {
        approved: false,
        requiresUserApproval: false,
        reason: 'exceeds_per_transaction_limit',
        message: `Buy value $${action.valueUsd} exceeds your per-transaction limit of $${config.maxBuyPerTransaction}`,
      };
    }

    // Check daily spend limit
    const todaySpend = await this.getTodaySpend(userId);
    if (todaySpend + action.valueUsd > config.dailySpendLimit) {
      return {
        approved: false,
        requiresUserApproval: false,
        reason: 'daily_limit_reached',
        message: `Daily spend limit of $${config.dailySpendLimit} would be exceeded. Today's spend: $${todaySpend}`,
      };
    }

    // Check sell price floor
    if (action.type === 'SELL' && action.steamPriceUsd) {
      const minAcceptablePrice = action.steamPriceUsd * config.maxSellDiscountPct;
      if (action.valueUsd < minAcceptablePrice) {
        return {
          approved: false,
          requiresUserApproval: false,
          reason: 'below_sell_floor',
          message: `Sell price $${action.valueUsd} is below your floor of ${config.maxSellDiscountPct * 100}% of Steam price`,
        };
      }
    }

    return { approved: true, reason: 'within_limits' };
  }

  private async getTodaySpend(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await prisma.agentAction.aggregate({
      where: {
        userId,
        actionType: 'BUY',
        approvalStatus: { in: ['AUTO_APPROVED', 'USER_APPROVED', 'EXECUTED'] },
        createdAt: { gte: startOfDay },
      },
      _sum: { valueUsd: true },
    });

    return result._sum.valueUsd ?? 0;
  }
}
```

### 4.3 Tool Definitions

```typescript
// packages/agents/src/tools/steamTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import { steamClient } from '@doppler/steam-client';

export const getSteamPrice = tool({
  description: 'Get current Steam Market price and volume for a CS2 skin. Returns lowest listing price, median price, and 30-day volume.',
  parameters: z.object({
    itemName: z.string().describe('Full Steam market hash name e.g. "AK-47 | Redline (Field-Tested)"'),
  }),
  execute: async ({ itemName }) => steamClient.getPriceOverview(itemName),
});

export const getSteamPriceHistory = tool({
  description: 'Get historical price data for a CS2 skin on Steam Market. Returns daily price and volume over the past N days.',
  parameters: z.object({
    itemName: z.string(),
    days: z.number().default(90).describe('Number of days of history to return'),
  }),
  execute: async ({ itemName, days }) => steamClient.getPriceHistory(itemName, days),
});

export const getUserInventory = tool({
  description: 'Get the current Steam inventory for the authenticated user. Returns all tradable CS2 items.',
  parameters: z.object({
    includeNonTradable: z.boolean().default(false),
  }),
  execute: async ({ includeNonTradable }, { userId }) =>
    steamClient.getInventory(userId, includeNonTradable),
});
```

```typescript
// packages/agents/src/tools/csFloatTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import { csFloatClient } from '@doppler/csfloat-client';

export const searchCSFloatListings = tool({
  description: 'Search CSFloat marketplace for CS2 skin listings. Filter by price, float value, and sort order. Returns listings with price, float, pattern, and seller info.',
  parameters: z.object({
    itemName: z.string(),
    maxPrice: z.number().optional().describe('Maximum price in USD'),
    minFloat: z.number().optional().describe('Minimum float value 0.0-1.0'),
    maxFloat: z.number().optional().describe('Maximum float value 0.0-1.0'),
    sortBy: z.enum(['price_asc', 'price_desc', 'float_asc', 'float_desc', 'listed_at']).default('price_asc'),
    limit: z.number().default(20),
  }),
  execute: async (params) => csFloatClient.searchListings(params),
});

export const getExpiringAuctions = tool({
  description: 'Get CSFloat auctions that are expiring within the next N minutes. Useful for finding time-sensitive deals.',
  parameters: z.object({
    expiresWithinMinutes: z.number().default(30),
    maxPrice: z.number().optional(),
    limit: z.number().default(30),
  }),
  execute: async (params) => csFloatClient.getExpiringAuctions(params),
});

export const getCSFloatListing = tool({
  description: 'Get detailed info about a specific CSFloat listing by ID.',
  parameters: z.object({
    listingId: z.string(),
  }),
  execute: async ({ listingId }) => csFloatClient.getListing(listingId),
});
```

```typescript
// packages/agents/src/tools/researchTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import { searchService } from '../services/search';
import { patchScraper } from '../services/patchScraper';

export const webSearch = tool({
  description: 'Search the web for CS2 news, patch notes, meta analysis, or market commentary. Use this to understand context behind price movements.',
  parameters: z.object({
    query: z.string().describe('Search query — be specific, include "CS2" in the query'),
    recency: z.enum(['day', 'week', 'month', 'any']).default('week'),
  }),
  execute: async ({ query, recency }) => searchService.search(query, recency),
});

export const getLatestPatchNotes = tool({
  description: 'Fetch the latest CS2 patch notes from Valve. Returns the raw patch text and metadata.',
  parameters: z.object({
    limit: z.number().default(3).describe('Number of recent patches to retrieve'),
  }),
  execute: async ({ limit }) => patchScraper.getLatestPatches(limit),
});

export const getPatchReport = tool({
  description: 'Get a previously generated Doppler patch analysis report by patch version.',
  parameters: z.object({
    patchVersion: z.string().optional().describe('Leave empty for most recent patch'),
  }),
  execute: async ({ patchVersion }) => {
    const { prisma } = await import('@doppler/db');
    return prisma.patchReport.findFirst({
      where: patchVersion ? { patchVersion } : undefined,
      orderBy: { publishedAt: 'desc' },
    });
  },
});
```

### 4.4 Agent Definitions

```typescript
// packages/agents/src/agents/dealHunter.ts

import { AgentRunner } from '../core/AgentRunner';
import { getSteamPrice, getSteamPriceHistory } from '../tools/steamTools';
import { searchCSFloatListings } from '../tools/csFloatTools';

const DEAL_HUNTER_SYSTEM_PROMPT = `
You are Doppler's Deal Hunter agent. Your job is to find underpriced CS2 skin listings on CSFloat compared to Steam Market prices.

For each item you evaluate:
1. Search CSFloat for the cheapest listings
2. Get the current Steam Market price for the same item
3. Calculate the effective discount after CSFloat's 2% buyer fee and Steam's 15% fee
4. Score the deal: >15% discount = good, >25% = excellent, >35% = exceptional
5. Consider float value: lower float = more valuable, factor this in

Only surface deals with at least 12% effective discount after fees.
Format each deal clearly with: item name, float, CSFloat price, Steam price, effective discount, deal score, and your reasoning.
`.trim();

export function createDealHunterAgent() {
  return new AgentRunner({
    name: 'Deal Hunter',
    systemPrompt: DEAL_HUNTER_SYSTEM_PROMPT,
    tools: {
      searchCSFloatListings,
      getSteamPrice,
      getSteamPriceHistory,
    },
    maxSteps: 15,
  });
}
```

```typescript
// packages/agents/src/agents/patchAnalyst.ts

import { AgentRunner } from '../core/AgentRunner';
import { getSteamPriceHistory } from '../tools/steamTools';
import { webSearch, getLatestPatchNotes } from '../tools/researchTools';

const PATCH_ANALYST_SYSTEM_PROMPT = `
You are Doppler's Patch Analyst. When a new CS2 patch is released, you analyze its impact on the skin market.

Your analysis process:
1. Read the full patch notes carefully
2. Identify buffed and nerfed weapons, new content, and meta changes
3. For each affected weapon family, retrieve 90-day price history for popular skins
4. Search the web for community reaction and meta commentary
5. Compare to similar past patches — did similar buffs/nerfs move prices before?
6. Generate structured predictions: item name, direction (up/down/neutral), confidence (1-10), time horizon (immediate/1week/1month), reasoning

Be specific. Don't just say "AK-47 skins will go up" — say which AK-47 skins, by how much, why, and for how long.
Format output as structured JSON that can be stored in the database.
`.trim();

export function createPatchAnalystAgent() {
  return new AgentRunner({
    name: 'Patch Analyst',
    systemPrompt: PATCH_ANALYST_SYSTEM_PROMPT,
    tools: {
      getLatestPatchNotes,
      getSteamPriceHistory,
      webSearch,
    },
    maxSteps: 20,
  });
}
```

### 4.5 LLM Model Selection Per Agent

Not every agent needs GPT-4o. Use the cheapest model that produces reliable results.

| Agent | Model | Reasoning |
|---|---|---|
| Deal Hunter | `gpt-4o-mini` | Core logic is arithmetic (price comparison + fee calculation). LLM just formats output and handles edge cases. |
| Auction Sniper | `gpt-4o-mini` | Same as Deal Hunter — price comparison with time pressure. |
| Patch Analyst | `gpt-4o` | Needs deep reasoning: reading patch notes, cross-referencing history, predicting market impact. |
| Portfolio Advisor | `gpt-4o` | Needs nuanced judgment: hold/sell recommendations based on trends and context. |
| Case Analyst | `gpt-4o` | Supply/demand analysis with web search synthesis. |
| Custom Agents | User selects (default: `gpt-4o-mini`) | Power users can choose model; free/trader tiers locked to `gpt-4o-mini`. |
| Freeform AI Query | `gpt-4o` | User-facing conversational quality matters here. |

---

## 4B. TypeScript Strategy

### 4B.1 Rules

1. **Zero `any`** — the codebase must never use `:any`, `as any`, or `@ts-ignore`. Configure ESLint to enforce this:
   ```json
   {
     "@typescript-eslint/no-explicit-any": "error",
     "@typescript-eslint/no-unsafe-assignment": "error",
     "@typescript-eslint/no-unsafe-member-access": "error",
     "@typescript-eslint/no-unsafe-call": "error",
     "@typescript-eslint/no-unsafe-return": "error"
   }
   ```

2. **`unknown` over `any` at boundaries** — data from external APIs (Steam, CSFloat, webhooks) enters as `unknown` and is validated through Zod schemas before use. Never trust external data shapes.

3. **Discriminated unions over loose optional fields** — when a value can be one of several shapes, use discriminated unions with a literal tag field, not a bag of optional properties.

4. **`readonly` by default** — function parameters and return types should be `readonly` or `Readonly<T>` unless mutation is explicitly needed.

5. **No type assertions except narrowing** — `as const` and `as SomeType` after a type guard are fine. `as SomeType` to silence the compiler is not.

### 4B.2 Typed Prisma Json Fields

Every `Json` field in the Prisma schema gets a corresponding Zod schema and TypeScript type. Prisma's `Json` type is `JsonValue` (effectively `unknown`), so we wrap access in typed helpers.

```typescript
// packages/types/src/market.ts

import { z } from 'zod';

// ── Steam Inventory Item ─────────────────────────
export const SteamInventoryItemSchema = z.object({
  assetId: z.string(),
  classId: z.string(),
  instanceId: z.string(),
  marketHashName: z.string(),
  iconUrl: z.string(),
  tradable: z.boolean(),
  marketable: z.boolean(),
  tags: z.array(z.object({
    category: z.string(),
    internalName: z.string(),
    localizedCategoryName: z.string(),
    localizedTagName: z.string(),
  })),
});

export type SteamInventoryItem = z.infer<typeof SteamInventoryItemSchema>;

// ── CSFloat Listing ──────────────────────────────
export const CSFloatListingSchema = z.object({
  id: z.string(),
  marketHashName: z.string(),
  price: z.number(),
  floatValue: z.number().nullable(),
  paintSeed: z.number().nullable(),
  paintIndex: z.number().nullable(),
  dMarketLink: z.string().nullable(),
  screenshotUrl: z.string().nullable(),
  createdAt: z.string(),
  sellerSteamId: z.string(),
  isAuction: z.boolean(),
  auctionEndsAt: z.string().nullable(),
});

export type CSFloatListing = z.infer<typeof CSFloatListingSchema>;

// ── Deal Data ────────────────────────────────────
export const DealDataSchema = z.object({
  listing: CSFloatListingSchema,
  steamPrice: z.number(),
  effectiveDiscount: z.number(),
  feeAdjustedCost: z.number(),
  dealScore: z.number().min(0).max(100),
  reasoning: z.string(),
});

export type DealData = z.infer<typeof DealDataSchema>;
```

```typescript
// packages/types/src/agents.ts

import { z } from 'zod';

// ── Agent Step (stored in AgentRun.steps Json field) ─────
export const AgentStepSchema = z.object({
  stepNumber: z.number(),
  text: z.string(),
  toolCalls: z.array(z.object({
    toolName: z.string(),
    args: z.record(z.unknown()),
  })).optional(),
  toolResults: z.array(z.object({
    toolName: z.string(),
    result: z.unknown(),
  })).optional(),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }).optional(),
  finishReason: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type AgentStep = z.infer<typeof AgentStepSchema>;

// ── Agent Action Payload ─────────────────────────
export const TradeActionPayloadSchema = z.object({
  listingId: z.string(),
  platform: z.enum(['STEAM', 'CSFLOAT']),
  itemName: z.string(),
  priceUsd: z.number(),
  floatValue: z.number().nullable(),
  listingUrl: z.string(),
});

export type TradeActionPayload = z.infer<typeof TradeActionPayloadSchema>;

// ── Patch Report Analysis ────────────────────────
export const PatchAnalysisSchema = z.object({
  summary: z.string(),
  buffedWeapons: z.array(z.string()),
  nerfedWeapons: z.array(z.string()),
  newContent: z.array(z.string()),
  metaChanges: z.string(),
});

export type PatchAnalysis = z.infer<typeof PatchAnalysisSchema>;

export const AffectedItemSchema = z.object({
  itemName: z.string(),
  direction: z.enum(['up', 'down', 'neutral']),
  confidence: z.number().min(1).max(10),
  timeHorizon: z.enum(['immediate', '1week', '1month']),
  reasoning: z.string(),
});

export type AffectedItem = z.infer<typeof AffectedItemSchema>;
```

```typescript
// packages/db/src/json-helpers.ts
// Typed accessors for Prisma Json fields — parse at read time, validate at write time.

import { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Parse a Prisma Json field through a Zod schema.
 * Returns the typed value or throws with a descriptive error.
 */
export function parseJsonField<T>(
  schema: z.ZodType<T>,
  value: Prisma.JsonValue,
  fieldName: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid JSON in ${fieldName}: ${result.error.issues.map(i => i.message).join(', ')}`
    );
  }
  return result.data;
}

/**
 * Serialize a typed value for writing to a Prisma Json field.
 * Validates before writing — rejects invalid shapes at write time, not read time.
 */
export function toJsonField<T>(
  schema: z.ZodType<T>,
  value: T,
): Prisma.InputJsonValue {
  schema.parse(value);
  return value as unknown as Prisma.InputJsonValue;
}
```

Usage in practice:

```typescript
import { parseJsonField, toJsonField } from '@doppler/db';
import { DealDataSchema, type DealData } from '@doppler/types';

// READING — parse from Prisma's untyped Json into a typed object
const deal = await prisma.deal.findUnique({ where: { id: dealId } });
const dealData: DealData = parseJsonField(DealDataSchema, deal.dealData, 'Deal.dealData');
//    ^-- fully typed from here on, no `as any` needed

// WRITING — validate before storing
await prisma.deal.create({
  data: {
    ...otherFields,
    dealData: toJsonField(DealDataSchema, {
      listing: csFloatListing,
      steamPrice: 38.00,
      effectiveDiscount: 0.11,
      feeAdjustedCost: 29.07,
      dealScore: 72,
      reasoning: 'Listing is 11% below Steam after fees.',
    }),
  },
});
```

### 4B.3 Typed Express Request

Express's `Request` object has no `user` property. We augment it globally.

```typescript
// apps/api/src/types/express.d.ts

import { Plan } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        steamId: string;
        plan: Plan;
      };
    }
  }
}
```

The auth middleware populates this and narrows the type:

```typescript
// apps/api/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@doppler/db';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

  if (error || !supabaseUser) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, steamId: true, plan: true },
  });

  if (!dbUser) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  req.user = dbUser;
  next();
}
```

### 4B.4 Typed API Responses

All API endpoints use a consistent response envelope. No `res.json(data)` with an unknown shape.

```typescript
// packages/types/src/api.ts

// Success response
export interface ApiResponse<T> {
  readonly success: true;
  readonly data: T;
}

// Error response
export interface ApiError {
  readonly success: false;
  readonly error: string;
  readonly code?: string;
}

// Paginated response
export interface PaginatedResponse<T> {
  readonly success: true;
  readonly data: readonly T[];
  readonly pagination: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly hasMore: boolean;
  };
}

// Union type used in route handlers
export type ApiResult<T> = ApiResponse<T> | ApiError;
```

### 4B.5 Typed WebSocket Events

Socket.io supports typed events natively. Define all events in one place.

```typescript
// packages/types/src/socket-events.ts

import type { DealData, AgentStep, TradeActionPayload } from './agents';

export interface ServerToClientEvents {
  'deal:new': (payload: DealNewEvent) => void;
  'deal:expired': (payload: { dealId: string }) => void;
  'alert:new': (payload: AlertEvent) => void;
  'agent:run:start': (payload: AgentRunStartEvent) => void;
  'agent:run:finish': (payload: AgentRunFinishEvent) => void;
  'agent:step': (payload: AgentStepEvent) => void;
  'action:pending': (payload: ActionPendingEvent) => void;
  'price:update': (payload: PriceUpdateEvent) => void;
}

export interface ClientToServerEvents {
  'subscribe:watchlist': (itemNames: readonly string[]) => void;
  'unsubscribe:watchlist': (itemNames: readonly string[]) => void;
}

export interface DealNewEvent {
  readonly dealId: string;
  readonly itemName: string;
  readonly platform: 'STEAM' | 'CSFLOAT';
  readonly listedPrice: number;
  readonly steamPrice: number;
  readonly discountPct: number;
  readonly floatValue: number | null;
  readonly dealScore: number;
  readonly expiresAt: string | null;
  readonly listingUrl: string;
}

export interface AgentRunStartEvent {
  readonly agentId: string;
  readonly runId: string;
  readonly agentName: string;
}

export interface AgentRunFinishEvent {
  readonly agentId: string;
  readonly runId: string;
  readonly status: 'COMPLETED' | 'FAILED';
  readonly summary: string;
  readonly dealsFound: number;
  readonly actionsCount: number;
}

export interface AgentStepEvent {
  readonly runId: string;
  readonly step: number;
  readonly toolName: string | null;
  readonly reasoning: string;
}

export interface ActionPendingEvent {
  readonly actionId: string;
  readonly actionType: 'BUY' | 'SELL';
  readonly itemName: string;
  readonly valueUsd: number;
  readonly platform: string;
  readonly reasoning: string;
  readonly expiresAt: string;
}

export interface AlertEvent {
  readonly alertId: string;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly payload: Record<string, unknown> | null;
}

export interface PriceUpdateEvent {
  readonly itemName: string;
  readonly platform: string;
  readonly priceUsd: number;
  readonly changePercent: number;
}
```

Usage with typed Socket.io server:

```typescript
// apps/api/src/server.ts
import { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@doppler/types';

export const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: process.env.WEB_URL },
});

// Now io.emit('deal:new', payload) is fully type-checked —
// wrong event names or missing fields are compile errors.
```

### 4B.6 External API Response Validation

Data from Steam and CSFloat enters as `unknown` and must pass through Zod before use.

```typescript
// packages/steam-client/src/prices.ts

import { z } from 'zod';
import axios from 'axios';
import { redis } from './cache';

const SteamPriceResponseSchema = z.object({
  success: z.boolean(),
  lowest_price: z.string().optional(),
  median_price: z.string().optional(),
  volume: z.string().optional(),
});

export type SteamPriceResponse = z.infer<typeof SteamPriceResponseSchema>;

export async function getPriceOverview(itemName: string): Promise<SteamPriceResponse> {
  const cacheKey = `steam:price:${itemName}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return SteamPriceResponseSchema.parse(JSON.parse(cached));
  }

  const response = await axios.get(
    'https://steamcommunity.com/market/priceoverview/',
    {
      params: { appid: 730, currency: 1, market_hash_name: itemName },
    },
  );

  // Validate external data — never trust the shape
  const validated = SteamPriceResponseSchema.parse(response.data);

  await redis.setex(cacheKey, 15 * 60, JSON.stringify(validated));
  return validated;
}
```

---

## 5. API Routes — Full Specification

### 5.1 Express Router Setup

```typescript
// apps/api/src/server.ts

import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { authRouter } from './routes/auth';
import { inventoryRouter } from './routes/inventory';
import { marketRouter } from './routes/market';
import { agentsRouter } from './routes/agents';
import { intelligenceRouter } from './routes/intelligence';
import { actionsRouter } from './routes/actions';
import { settingsRouter } from './routes/settings';
import { alertsRouter } from './routes/alerts';
import { authenticate } from './middleware/auth';
import { rateLimiter } from './middleware/rateLimiter';

const app = express();
const httpServer = createServer(app);

export const io = new SocketServer(httpServer, {
  cors: { origin: process.env.WEB_URL }
});

app.use(express.json());
app.use('/api/auth', authRouter);

// All routes below require authentication
app.use('/api', authenticate);
app.use('/api', rateLimiter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/market', marketRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/actions', actionsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/alerts', alertsRouter);

// WebSocket auth
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // Validate JWT, attach userId to socket
  validateToken(token).then(user => {
    socket.data.userId = user.id;
    socket.join(`user:${user.id}`); // Each user gets their own room
    next();
  }).catch(next);
});
```

### 5.2 Agents Router

```typescript
// apps/api/src/routes/agents.ts

import { Router } from 'express';
import { prisma } from '@doppler/db';
import { jobQueue } from '../jobs/queue';

const router = Router();

// GET /api/agents — list all agent configs for user
router.get('/', async (req, res) => {
  const agents = await prisma.agentConfig.findMany({
    where: { userId: req.user.id },
    include: {
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: { status: true, startedAt: true, dealsFound: true }
      }
    }
  });
  res.json(agents);
});

// POST /api/agents — create custom agent config
router.post('/', async (req, res) => {
  const { name, systemPrompt, tools, scheduleType, scheduleValue, autoApproveEnabled, maxBuyOverride } = req.body;

  // Validate tools against allowed tool list for user's plan
  const allowedTools = getAllowedTools(req.user.plan);
  const invalidTools = tools.filter(t => !allowedTools.includes(t));
  if (invalidTools.length > 0) {
    return res.status(400).json({ error: `Tools not available on your plan: ${invalidTools.join(', ')}` });
  }

  const agent = await prisma.agentConfig.create({
    data: {
      userId: req.user.id,
      name,
      type: 'CUSTOM',
      systemPrompt,
      tools,
      scheduleType,
      scheduleValue,
      isCustom: true,
      autoApproveEnabled,
      maxBuyOverride,
    }
  });

  // Register with job queue
  await jobQueue.addRepeatingJob(agent);
  res.status(201).json(agent);
});

// POST /api/agents/:id/run — trigger manual run
router.post('/:id/run', async (req, res) => {
  const agent = await prisma.agentConfig.findFirst({
    where: { id: req.params.id, userId: req.user.id }
  });
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const job = await jobQueue.addOneOffJob(agent, req.user);
  res.json({ jobId: job.id, message: 'Agent run queued' });
});

// GET /api/agents/:id/history — run history with steps
router.get('/:id/history', async (req, res) => {
  const runs = await prisma.agentRun.findMany({
    where: { agentConfigId: req.params.id, userId: req.user.id },
    orderBy: { startedAt: 'desc' },
    take: Number(req.query.limit) || 20,
    include: { actions: true }
  });
  res.json(runs);
});

export { router as agentsRouter };
```

### 5.3 Intelligence Router (Streaming)

```typescript
// apps/api/src/routes/intelligence.ts — streaming AI query

router.post('/ask', async (req, res) => {
  const { question } = req.body;
  const context = await buildUserContext(req.user.id);

  const agent = createPortfolioAdvisorAgent();
  const stream = agent.stream(question, context);

  // Stream response using Vercel AI SDK's pipeline
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  for await (const chunk of stream.textStream) {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
});
```

---

## 6. Job Queue — BullMQ Setup

### 6.1 Process Separation

The API server and BullMQ workers run as **separate processes**. This prevents a slow agent run (20+ LLM round-trips) from blocking API request handling.

```
Railway deploys two services from the same repo:
  apps/api/    → Start command: node dist/server.js     (REST + WebSocket)
  apps/worker/ → Start command: node dist/worker.js     (BullMQ job processor)
```

Both services share the same `packages/*` code and connect to the same PostgreSQL and Redis.

### 6.2 Queue Definition (shared by API + Worker)

```typescript
// packages/agents/src/queue/connection.ts

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.UPSTASH_REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export const agentQueue = new Queue('agent-runs', { connection });
```

### 6.3 Job Bootstrapper (called by Worker on startup)

```typescript
// apps/worker/src/bootstrap.ts

import { agentQueue } from '@doppler/agents/queue';

export async function bootstrapSystemJobs() {
  // Deal Hunter — every 5 minutes
  await agentQueue.upsertJobScheduler('deal-hunter', {
    every: 5 * 60 * 1000,
  }, { name: 'deal-hunter', data: {} });

  // Auction Sniper — every 2 minutes
  await agentQueue.upsertJobScheduler('auction-sniper', {
    every: 2 * 60 * 1000,
  }, { name: 'auction-sniper', data: {} });

  // Patch Scraper — every hour
  await agentQueue.upsertJobScheduler('patch-scraper', {
    every: 60 * 60 * 1000,
  }, { name: 'patch-scraper', data: {} });

  // Portfolio Advisor — every day at 9am UTC
  await agentQueue.upsertJobScheduler('portfolio-advisor', {
    pattern: '0 9 * * *',
  }, { name: 'portfolio-advisor', data: {} });
}
```

### 6.4 Worker Process

```typescript
// apps/worker/src/worker.ts

import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { runDealHunter } from './jobs/dealHunter.job';
import { runPatchScraper } from './jobs/patchScraper.job';
import { runAuctionSniper } from './jobs/auctionSniper.job';
import { runPortfolioAdvisor } from './jobs/portfolioAdvisor.job';
import { runCustomAgent } from './jobs/customAgent.job';
import { bootstrapSystemJobs } from './bootstrap';

const connection = new Redis(process.env.UPSTASH_REDIS_URL!, {
  maxRetriesPerRequest: null,
});

const worker = new Worker('agent-runs', async (job) => {
  switch (job.name) {
    case 'deal-hunter':       return runDealHunter(job.data);
    case 'auction-sniper':    return runAuctionSniper(job.data);
    case 'patch-scraper':     return runPatchScraper(job.data);
    case 'portfolio-advisor': return runPortfolioAdvisor(job.data);
    case 'custom-agent':      return runCustomAgent(job.data);
    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}, {
  connection,
  concurrency: 5,
});

// Register system jobs on startup
bootstrapSystemJobs().catch(console.error);
```

### 6.5 Retry & Failure Strategy

All jobs use BullMQ's built-in retry with exponential backoff:

```typescript
// Default job options applied to all agent jobs
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,  // 5s → 10s → 20s
  },
  removeOnComplete: { count: 100 },   // Keep last 100 completed jobs
  removeOnFail: { count: 500 },       // Keep last 500 failed jobs for debugging
};
```

Agent runs handle partial success:

```typescript
// If the agent completed 5 steps and found 2 deals before failing on step 6,
// the deals from steps 1-5 are already saved to the database.
// The AgentRun record is updated with:
//   status: 'FAILED'
//   steps: [all steps up to failure]
//   dealsFound: 2  (partial count)
//   errorMessage: the error that caused the failure
// BullMQ retries the entire run on the next attempt.
```

---

## 7. WebSocket Events — Full Reference

### 7.1 Server → Client Events

```typescript
// Emit to a specific user's room
io.to(`user:${userId}`).emit(event, payload);

// Event payloads:

interface DealNewPayload {
  dealId: string;
  itemName: string;
  platform: 'CSFLOAT' | 'STEAM';
  listedPrice: number;
  steamPrice: number;
  discountPct: number;
  floatValue?: number;
  dealScore: number;
  expiresAt?: string;           // ISO string, for auctions
  listingUrl: string;
}

interface AgentRunStartPayload {
  agentId: string;
  runId: string;
  agentName: string;
}

interface AgentRunFinishPayload {
  agentId: string;
  runId: string;
  status: 'COMPLETED' | 'FAILED';
  summary: string;
  dealsFound: number;
  actionsCount: number;
}

interface AgentStepPayload {
  runId: string;
  step: number;
  toolName?: string;
  reasoning: string;
}

interface ActionPendingPayload {
  actionId: string;
  actionType: 'BUY' | 'SELL';
  itemName: string;
  valueUsd: number;
  platform: string;
  reasoning: string;
  expiresAt: string;
}

interface PriceUpdatePayload {
  itemName: string;
  platform: string;
  priceUsd: number;
  changePercent: number;
}
```

---

## 8. External API Integration Details

### 8.1 Steam Market API

```typescript
// packages/steam-client/src/prices.ts

import Axios from 'axios';
import { redis } from './cache';

const CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

export async function getPriceOverview(itemName: string) {
  const cacheKey = `steam:price:${itemName}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Steam Market API is unauthenticated but heavily rate-limited
  // Max ~20 requests/minute without auth
  const response = await axios.get('https://steamcommunity.com/market/priceoverview', {
    params: {
      appid: 730,        // CS2 app ID
      currency: 1,       // USD
      market_hash_name: itemName,
    },
    headers: {
      'User-Agent': 'Doppler/1.0 (+https://doppler.gg)',
    }
  });

  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(response.data));
  return response.data;
}
```

### 8.2 CSFloat API

```typescript
// packages/csfloat-client/src/listings.ts

const CSFLOAT_BASE = 'https://csfloat.com/api/v1';

export async function searchListings(params: ListingSearchParams) {
  const response = await axios.get(`${CSFLOAT_BASE}/listings`, {
    params: {
      market_hash_name: params.itemName,
      max_price: params.maxPrice ? Math.round(params.maxPrice * 100) : undefined, // API uses cents
      min_float: params.minFloat,
      max_float: params.maxFloat,
      sort_by: params.sortBy,
      limit: params.limit,
      type: 'buy_now',
    },
    headers: {
      Authorization: process.env.CSFLOAT_API_KEY,
    }
  });

  // Normalize prices from cents to USD
  return response.data.data.map(listing => ({
    ...listing,
    price: listing.price / 100,
  }));
}

// CSFloat Webhook handler
export function handleWebhook(payload: CSFloatWebhookPayload) {
  // CSFloat sends real-time events for new listings, sales, price changes
  switch (payload.type) {
    case 'new_listing':   return handleNewListing(payload.data);
    case 'listing_sold':  return handleListingSold(payload.data);
    case 'price_changed': return handlePriceChanged(payload.data);
  }
}
```

### 8.3 Patch Scraper

```typescript
// packages/agents/src/services/patchScraper.ts

import axios from 'axios';
import * as cheerio from 'cheerio';

const STEAM_NEWS_RSS = 'https://store.steampowered.com/feeds/news/app/730/?cc=us&l=english&snr=1_2108_9__2107';

export async function checkForNewPatch(): Promise<PatchNote | null> {
  const response = await axios.get(STEAM_NEWS_RSS);
  const $ = cheerio.load(response.data, { xmlMode: true });

  const latestItem = $('item').first();
  const title = latestItem.find('title').text();
  const publishedAt = new Date(latestItem.find('pubDate').text());
  const content = latestItem.find('description').text();

  // Check if we've already processed this patch
  const existing = await prisma.patchReport.findFirst({
    where: { publishedAt: { gte: new Date(publishedAt.getTime() - 60000) } }
  });

  if (existing || !isPatchNote(title)) return null;

  return { title, publishedAt, content };
}

function isPatchNote(title: string): boolean {
  const patchKeywords = ['release notes', 'update', 'patch'];
  return patchKeywords.some(k => title.toLowerCase().includes(k));
}
```

---

## 9. Implementation Phases — Detailed Breakdown

### Phase 1 — Foundation (Weeks 1–3)

**Week 1: Monorepo + Infrastructure + TypeScript**
- [ ] Initialize Turborepo monorepo with `apps/web`, `apps/api`, `apps/worker`
- [ ] Create all `packages/*` with package.json (`@doppler/types`, `@doppler/db`, etc.)
- [ ] Configure `tsconfig.base.json` with strict mode (see Section 1.4)
- [ ] Each package/app extends `tsconfig.base.json`
- [ ] Configure ESLint with `@typescript-eslint/no-explicit-any: error` across monorepo
- [ ] Configure Prettier across monorepo
- [ ] Set up Supabase project — Postgres + Auth
- [ ] Set up Upstash Redis instance
- [ ] Configure Railway project for API + Worker deployment (two services)
- [ ] Configure Vercel project for web deployment
- [ ] Set up environment variables across all environments (see Section 10)
- [ ] Initialize Prisma with base schema (users, settings)
- [ ] Define initial types in `@doppler/types`: API response envelope, market types, agent types
- [ ] Set up Vitest at root level (shared test config across packages)

**Week 2: Auth + Steam Integration**

Steam OpenID + Supabase is a custom flow (Supabase has no built-in Steam provider):
- [ ] Build `GET /api/auth/steam` — generates Steam OpenID 2.0 redirect URL, sends user to Steam login
- [ ] Build `GET /api/auth/callback` — receives Steam's OpenID response, validates signature
- [ ] Call `ISteamUser/GetPlayerSummaries` to get Steam profile (display name, avatar)
- [ ] Upsert Doppler user in Postgres via Prisma (create if new, update if returning)
- [ ] Generate Supabase session using `supabase.auth.admin.createUser()` + `generateLink()` or use custom JWT
- [ ] Return JWT to frontend, store in httpOnly cookie or localStorage
- [ ] Build `authenticate` Express middleware (see Section 4B.3) — validates JWT, populates typed `req.user`
- [ ] Build `packages/steam-client`: inventory fetch, price overview
- [ ] Implement Redis caching layer with TTL per endpoint (15min for prices)
- [ ] `GET /api/inventory` → fetch and cache user Steam inventory
- [ ] **Decision: Price history data source** — Steam's price history API requires login cookies. Options:
  - Use a third-party API (steamapis.com, csgobackpack.net) for historical data
  - Use CSFloat's historical data if their API supports it
  - Build authenticated Steam session management (complex, fragile)
  - Accept current-price-only for MVP, add history in Phase 2
- [ ] Write unit tests for Steam client: price parsing, cache hit/miss, error handling
- [ ] Write unit tests for auth middleware: valid token, expired token, missing header

**Week 3: Base UI + CSFloat Client**
- [ ] Build `packages/csfloat-client`: listings search, auction fetch
- [ ] Validate all CSFloat API responses through Zod schemas (see Section 4B.6)
- [ ] Build dashboard layout in Next.js: sidebar nav, header, main area
- [ ] Inventory table component: item name, wear, float, Steam price, actions
- [ ] Basic portfolio value card (total USD value)
- [ ] shadcn/ui theme configuration (dark mode, CS2-inspired color palette)
- [ ] TanStack Query setup for all data fetching with typed query keys
- [ ] Write unit tests for CSFloat client: listing parsing, price conversion (cents → USD), error handling

**Phase 1 Deliverable:** User can log in with Steam, view their inventory with current multi-platform prices. All TypeScript strict, all external API data validated through Zod.

---

### Phase 2 — Core Agents (Weeks 4–6)

**Week 4: Agent Framework**
- [ ] Install Vercel AI SDK (`ai`, `@ai-sdk/openai`)
- [ ] Build `AgentRunner` class with tool registration and step logging
- [ ] Build `ActionGuard` with full limit evaluation logic
- [ ] Implement all tool definitions: Steam tools, CSFloat tools, research tools
- [ ] Set up `apps/worker` as separate BullMQ worker process (see Section 6.1)
- [ ] Job bootstrapper with system agent schedules (see Section 6.3)
- [ ] Configure retry strategy: 3 attempts, exponential backoff (see Section 6.5)
- [ ] Add `agent_configs`, `agent_runs`, `agent_actions` to Prisma schema
- [ ] Write unit tests for `ActionGuard`: all 5 branch conditions, edge cases (exactly at limit, zero spend, sell below floor)
- [ ] Write unit tests for deal score calculation logic

**Week 5: Deal Hunter + Alerts**
- [ ] Build Deal Hunter agent with full prompt and tool set (model: `gpt-4o-mini`)
- [ ] BullMQ job: run Deal Hunter every 5 minutes across all active users
- [ ] Deals evaluation logic: calculate effective discount after platform fees, deal score
- [ ] Write deals to DB + emit via Socket.io to connected user
- [ ] Socket.io setup: typed events (see Section 4B.5), auth middleware, user rooms, token refresh on reconnect
- [ ] Deal Feed UI: real-time card stream with discount badge, float, platform
- [ ] Browser push notification on new deal
- [ ] Write integration test: mock LLM + mock CSFloat API → verify deal created in DB + WebSocket event emitted

**Week 6: Patch Analyst**
- [ ] Build patch scraper: poll Steam news RSS via Cheerio, detect new patches
- [ ] BullMQ job: check for patches every hour
- [ ] Build Patch Analyst agent (model: `gpt-4o`)
- [ ] Store patch reports to DB using typed Json helpers (`toJsonField(PatchAnalysisSchema, ...)`)
- [ ] Patch Intelligence Center UI: report list, detail view with item impact table
- [ ] Notify users with affected items in inventory or watchlist
- [ ] Write unit test for patch scraper: parse real RSS fixture, detect new vs already-processed patches

**Phase 2 Deliverable:** Platform automatically surfaces underpriced CSFloat deals in real time and generates patch impact reports.

---

### Phase 3 — Intelligence Suite (Weeks 7–9)

**Week 7: Portfolio Advisor + Auction Sniper**
- [ ] Build Portfolio Advisor agent with hold/sell recommendation logic
- [ ] Daily portfolio briefing job (9am via BullMQ cron)
- [ ] Portfolio dashboard: P&L chart (Recharts), top movers, recommendations panel
- [ ] Build Auction Sniper agent
- [ ] BullMQ job: scan expiring auctions every 2 minutes
- [ ] Auction alerts UI with countdown timers

**Week 8: Case Analyst + Investment Hub**
- [ ] Build Case Analyst agent with supply/demand + patch context logic
- [ ] Weekly case report job
- [ ] Investment Hub page: case tracker, buy recommendations, scenario modeler
- [ ] Historical price charts per skin (Recharts area chart with volume overlay)
- [ ] Individual item detail modal: chart, comparable listings, patch impact history

**Week 9: Freeform AI Query + Watchlist**
- [ ] `POST /api/intelligence/ask` streaming endpoint
- [ ] AI chat UI component with streaming response rendering
- [ ] Watchlist CRUD: add/remove/configure price alerts
- [ ] Price target alert system: check watchlist on price updates
- [ ] Watchlist UI page with active alerts

**Phase 3 Deliverable:** Full intelligence suite live. Users get daily briefings, on-demand AI analysis, and real-time watchlist alerts.

---

### Phase 4 — Power User Features (Weeks 10–12)

**Week 10: Agent Studio**
- [ ] Agent Studio UI: name, prompt editor (textarea), tool selector (checkboxes), schedule picker
- [ ] Template library: 5 pre-built agent templates
- [ ] `POST /api/agents`, `PUT /api/agents/:id` → save to DB + register with BullMQ
- [ ] Agent list page with status, last run, deals found metrics
- [ ] Agent run history page with step-by-step reasoning viewer (collapsible steps)

**Week 11: Auto-Execution**
- [ ] Wire ActionGuard into agent job execution flow
- [ ] Implement CSFloat buy via API (requires user CSFloat API key)
- [ ] Pending actions queue: surface actions needing approval via WebSocket
- [ ] Action Center UI: pending actions with approve/reject buttons and countdown
- [ ] Auto-approve settings UI with limit sliders and confirmation threshold
- [ ] Executed action history with outcome tracking

**Week 12: Integrations + Polish**
- [ ] Discord webhook integration: send deal alerts and patch reports to user's Discord channel
- [ ] Email notification via Resend (weekly portfolio briefing, major deal alerts)
- [ ] Settings page: all notification channels, API key management, auto-approve config
- [ ] Plan enforcement: tool access, agent count limits, alert delay for free tier
- [ ] Rate limiting on all routes (express-rate-limit backed by Redis)
- [ ] Sentry integration: error tracking across API and agent workers
- [ ] PostHog: product analytics, funnel tracking

**Phase 4 Deliverable:** Full power user feature set. Custom agents, auto-execution, multi-channel notifications.

---

### Phase 5 — Mobile (Weeks 13–16)

**Week 13: Monorepo Prep + Expo Setup**
- [ ] Extract API call logic into `packages/api-client` (used by web + mobile)
- [ ] Extract Zustand store into `packages/store`
- [ ] Initialize `apps/mobile` with Expo SDK 51 + Expo Router
- [ ] Configure Expo with shared packages via Turborepo
- [ ] Configure Firebase project for FCM push notifications

**Week 14: Core Mobile Screens**
- [ ] Mobile auth: Steam login via WebView + token exchange
- [ ] Bottom tab navigation: Dashboard, Deals, Alerts, Portfolio, Settings
- [ ] Dashboard screen: portfolio value, active deals count, recent alerts
- [ ] Deals feed screen: real-time deal cards (same data, mobile-optimized UI)
- [ ] Alerts screen: notification history with seen/unseen states

**Week 15: Mobile Features**
- [ ] Portfolio screen: inventory list with swipe-to-mark actions
- [ ] Item detail screen: price chart (Victory Native), CSFloat listings
- [ ] Settings screen: notification toggles, auto-approve limits
- [ ] FCM push notification registration + backend token storage
- [ ] Biometric auth gate for Action Center (approve/reject trades)

**Week 16: Mobile Polish + Submission**
- [ ] Action Center screen: pending actions with biometric confirmation
- [ ] Deep links: deal notification → opens deal card in app
- [ ] iOS App Store assets: screenshots, description, review build
- [ ] Google Play assets: screenshots, description, internal track upload
- [ ] TestFlight beta distribution

---

### Phase 6 — Launch (Weeks 17–18)

**Week 17: Hardening**
- [ ] Database connection pooling (PgBouncer via Supabase)
- [ ] API key rotation strategy and secrets management audit
- [ ] Load testing: simulate 100 concurrent users + 5 agent workers
- [ ] Redis cache audit: ensure all high-frequency endpoints are cached
- [ ] Steam API rate limit handling: exponential backoff, queue throttling
- [ ] Comprehensive error handling: all agent runs have try/catch + DB logging
- [ ] Security audit: SQL injection via Prisma (safe), XSS in AI output (sanitize), CSRF

**Week 18: Launch**
- [ ] Landing page: hero, features, pricing tiers, waitlist/signup CTA
- [ ] Stripe integration for plan subscriptions
- [ ] Onboarding flow: Steam connect → inventory import → first agent run
- [ ] Help documentation: what each agent does, how auto-approve works, API docs
- [ ] Production deploy: Vercel (web) + Railway (API + workers) + Supabase prod
- [ ] Announce in CS2 trading subreddits, Discord servers, Twitter/X

---

## 10. Environment Variables Reference

```bash
# ── AI ──────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── Steam ───────────────────────────────────────
STEAM_API_KEY=                          # From steamcommunity.com/dev/apikey
STEAM_WEB_API_BASE=https://api.steampowered.com
STEAM_APP_ID=730

# ── CSFloat ─────────────────────────────────────
CSFLOAT_API_KEY=                        # From csfloat.com/profile/developer
CSFLOAT_WEBHOOK_SECRET=                 # For validating incoming webhooks
CSFLOAT_BASE_URL=https://csfloat.com/api/v1

# ── Search ──────────────────────────────────────
TAVILY_API_KEY=                         # From tavily.com

# ── Database ────────────────────────────────────
DATABASE_URL=postgresql://...           # Supabase pooled connection
DIRECT_URL=postgresql://...            # Supabase direct (for Prisma migrations)

# ── Redis ───────────────────────────────────────
UPSTASH_REDIS_URL=rediss://...
UPSTASH_REDIS_TOKEN=

# ── Auth (Supabase) ─────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=             # Server-only, never expose to client

# ── Firebase (Push Notifications) ───────────────
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# ── Email ───────────────────────────────────────
RESEND_API_KEY=                        # From resend.com

# ── Payments ────────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# ── Monitoring ──────────────────────────────────
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=

# ── App URLs ────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WEB_URL=http://localhost:3000
JWT_SECRET=                            # Long random string for JWT signing
```

---

## 11. Development Scripts

```bash
# Root — run everything
turbo dev

# Run specific apps
turbo dev --filter=web
turbo dev --filter=api

# Database
cd packages/db
npx prisma migrate dev --name init
npx prisma studio                      # Visual DB browser

# Build all
turbo build

# Type check all packages
turbo type-check

# Add a new package dependency (from monorepo root)
npm install axios --workspace=packages/steam-client
```

---

## 12. Key Engineering Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Steam API rate limiting | Agent runs fail to get price data | Redis cache with 15-min TTL, exponential backoff, request queue |
| OpenAI API cost overrun | High bill from frequent agent runs | Per-user token budget, `maxSteps` limits, GPT-4o-mini for low-stakes agents |
| CSFloat API changes | Deal hunter breaks | Abstract behind client package, integration tests, error alerts |
| Auto-buy executing bad deals | User loses money | ActionGuard limits, confidence threshold, extensive logging |
| BullMQ job queue buildup | Agent runs delayed | Worker concurrency tuning, dead-letter queue, job TTL |
| Supabase Postgres connection limits | DB connection errors under load | PgBouncer pooling, Prisma connection limit config |
| Steam ToS violation | Account bans | Use official API only, no session scraping, respect rate limits |
| Prisma `Json` fields becoming `any` | Type safety collapses | Zod schemas + typed Json helpers for every Json field (see Section 4B.2) |
| WebSocket token expiry | Stale connections stop receiving events | Client-side token refresh + Socket.io reconnect with new token |
| Unbounded table growth | Slow queries, high storage cost | Data retention policy (see Section 13) |

---

## 13. Data Retention Policy

Tables that grow unbounded need cleanup or partitioning.

| Table | Growth Rate | Retention | Cleanup Strategy |
|---|---|---|---|
| `price_history` | ~5,000 rows/day (est. 100 items × 2 platforms × 24 snapshots) | 180 days | BullMQ cron job: delete rows older than 180 days, runs daily at 3am |
| `agent_runs` | ~300 rows/day (6 agents × ~50 runs) | 90 days | Delete completed runs older than 90 days (keep failed for debugging) |
| `listings_cache` | ~2,000 rows/day | 7 days | Delete where `cachedAt < NOW() - 7 days`, runs daily |
| `alerts` | ~100 rows/day per active user | 60 days | Delete seen alerts older than 60 days |
| `inventory_snapshots` | 1 per user per sync (~4/day) | 90 days | Keep one snapshot per day per user after 7 days (aggregate), delete after 90 |
| `deals` | ~50 rows/day | 30 days | Delete expired/actioned deals older than 30 days |

Implement as a BullMQ scheduled job (`data-cleanup`) that runs daily at 3am UTC.

---

## 14. Testing Strategy

### 14.1 Test Framework

- **Vitest** for unit and integration tests (fast, native ESM, works with TypeScript)
- **Playwright** for E2E tests (critical user flows)
- Run via `turbo test` (parallel across packages)

### 14.2 What to Test (By Priority)

**Unit Tests (every package):**

| Module | What to test | Why it matters |
|---|---|---|
| `ActionGuard` | All 5 branch conditions: confirm threshold, per-transaction limit, daily spend cap, sell price floor, and the happy path. Edge cases: exactly at limit, zero daily spend, sell with no Steam price. | This code decides whether to spend real money. Every branch must be verified. |
| Deal score calculation | Discount computation after platform fees, deal score formula, edge cases (zero Steam price, negative discount) | Core business logic — if this is wrong, every deal alert is wrong. |
| `steam-client` price parser | Parse Steam's price strings (`"$38.50"`) to numbers, handle missing fields, handle rate-limit error responses | Steam returns prices as strings with currency symbols — parsing errors are silent bugs. |
| `csfloat-client` price conversion | Cents to USD conversion, float value validation (0.0-1.0 range), auction expiry date parsing | CSFloat API returns prices in cents — off-by-100x bugs are easy to introduce. |
| Zod schemas | Each schema validates correct data and rejects malformed data | These are the boundary between trusted and untrusted data. |
| `json-helpers` | `parseJsonField` returns typed data, throws on invalid shapes. `toJsonField` rejects invalid writes. | Prevents `any` from leaking through Prisma Json fields. |
| Patch scraper parser | Parse real Steam news RSS fixture, identify patch notes vs non-patch posts | False positives trigger unnecessary agent runs (cost). False negatives miss real patches. |

**Integration Tests:**

| Flow | What to test |
|---|---|
| Auth flow | Steam callback → user creation → JWT issued → middleware accepts token |
| Deal Hunter job | Mock LLM responses + mock CSFloat/Steam APIs → verify deal created in DB → verify WebSocket event shape |
| Agent run lifecycle | Create run → log steps → handle failure → verify DB state matches expected status |
| API routes | Each CRUD route: correct response shape, auth required, proper error codes |

**E2E Tests (Playwright, Phase 3+):**

| Flow | What to verify |
|---|---|
| Login → Dashboard | Steam OAuth redirect → callback → dashboard loads with inventory |
| Deal Feed | Deal appears in real-time when WebSocket event fires |
| Agent Studio | Create agent → appears in list → trigger manual run → run appears in history |
| Action Center | Pending action appears → approve → status updates |

### 14.3 Coverage Target

80%+ on `packages/agents` and `packages/steam-client` and `packages/csfloat-client`. These packages contain the business logic and external API interfaces where bugs have the highest impact. Frontend components are tested via E2E flows rather than shallow unit tests.
