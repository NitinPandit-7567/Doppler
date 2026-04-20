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
│   ├── api/                   → Express.js backend
│   └── mobile/                → Expo (React Native) — Phase 5
├── packages/
│   ├── agents/                → Agent framework + all agent definitions
│   ├── db/                    → Prisma schema, client, migrations
│   ├── steam-client/          → Steam API + Market wrapper
│   ├── csfloat-client/        → CSFloat API wrapper
│   ├── api-client/            → HTTP client shared by web + mobile
│   ├── store/                 → Zustand state (shared by web + mobile)
│   └── types/                 → All shared TypeScript interfaces
├── turbo.json
├── package.json               → Root workspace config
└── .env.example
```

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

### 1.3 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

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
  SKINPORT
  BUFF163
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

```typescript
// apps/api/src/jobs/queue.ts

import { Queue, Worker, QueueScheduler } from 'bullmq';
import { Redis } from 'ioredis';
import { runDealHunter } from './dealHunter.job';
import { runPatchScraper } from './patchScraper.job';
import { runAuctionSniper } from './auctionSniper.job';
import { runPortfolioAdvisor } from './portfolioAdvisor.job';

const connection = new Redis(process.env.UPSTASH_REDIS_URL!);

export const agentQueue = new Queue('agent-runs', { connection });
export const scheduler = new QueueScheduler('agent-runs', { connection });

// Register repeating jobs for system agents
export async function bootstrapSystemJobs() {
  // Deal Hunter — every 5 minutes for all users
  await agentQueue.add('deal-hunter', {}, {
    repeat: { every: 5 * 60 * 1000 },
    jobId: 'system-deal-hunter',
  });

  // Auction Sniper — every 2 minutes
  await agentQueue.add('auction-sniper', {}, {
    repeat: { every: 2 * 60 * 1000 },
    jobId: 'system-auction-sniper',
  });

  // Patch Scraper — every hour
  await agentQueue.add('patch-scraper', {}, {
    repeat: { every: 60 * 60 * 1000 },
    jobId: 'system-patch-scraper',
  });

  // Portfolio Advisor — every day at 9am
  await agentQueue.add('portfolio-advisor', {}, {
    repeat: { cron: '0 9 * * *' },
    jobId: 'system-portfolio-advisor',
  });
}

// Worker processes jobs
export const worker = new Worker('agent-runs', async (job) => {
  switch (job.name) {
    case 'deal-hunter':     return runDealHunter(job.data);
    case 'auction-sniper':  return runAuctionSniper(job.data);
    case 'patch-scraper':   return runPatchScraper(job.data);
    case 'portfolio-advisor': return runPortfolioAdvisor(job.data);
    case 'custom-agent':    return runCustomAgent(job.data);
    default: throw new Error(`Unknown job: ${job.name}`);
  }
}, { connection, concurrency: 5 });
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

**Week 1: Monorepo + Infrastructure**
- [ ] Initialize Turborepo monorepo with all apps and packages
- [ ] Configure TypeScript across all packages with shared tsconfig
- [ ] Set up Supabase project — Postgres + Auth
- [ ] Set up Upstash Redis instance
- [ ] Configure Railway project for API deployment
- [ ] Configure Vercel project for web deployment
- [ ] Set up environment variables across all environments
- [ ] Initialize Prisma with base schema (users, settings)
- [ ] Configure ESLint + Prettier across monorepo

**Week 2: Auth + Steam Integration**
- [ ] Implement Steam OpenID login via Supabase Auth custom provider
- [ ] Build `packages/steam-client`: inventory fetch, price overview, price history
- [ ] Implement Redis caching layer with TTL per endpoint
- [ ] Add JWT auth middleware to Express
- [ ] `GET /api/auth/steam` → redirect to Steam OpenID
- [ ] `GET /api/auth/callback` → exchange for Supabase session
- [ ] `GET /api/inventory` → fetch and cache user Steam inventory

**Week 3: Base UI + CSFloat Client**
- [ ] Build `packages/csfloat-client`: listings search, auction fetch
- [ ] Build dashboard layout in Next.js: sidebar nav, header, main area
- [ ] Inventory table component: item name, wear, float, Steam price, actions
- [ ] Basic portfolio value card (total USD value)
- [ ] shadcn/ui theme configuration (dark mode, CS2-inspired color palette)
- [ ] TanStack Query setup for all data fetching

**Phase 1 Deliverable:** User can log in with Steam, view their inventory with current multi-platform prices.

---

### Phase 2 — Core Agents (Weeks 4–6)

**Week 4: Agent Framework**
- [ ] Install Vercel AI SDK (`ai`, `@ai-sdk/openai`)
- [ ] Build `AgentRunner` class with tool registration and step logging
- [ ] Build `ActionGuard` with full limit evaluation logic
- [ ] Implement all tool definitions: Steam tools, CSFloat tools, research tools
- [ ] Set up BullMQ with job bootstrapper
- [ ] Add `agent_configs`, `agent_runs`, `agent_actions` to Prisma schema

**Week 5: Deal Hunter + Alerts**
- [ ] Build Deal Hunter agent with full prompt and tool set
- [ ] BullMQ job: run Deal Hunter every 5 minutes across all active users
- [ ] Deals evaluation logic: calculate effective discount, deal score
- [ ] Write deals to DB + emit via Socket.io to connected user
- [ ] Socket.io setup: auth middleware, user rooms
- [ ] Deal Feed UI: real-time card stream with discount badge, float, platform
- [ ] Browser push notification on new deal

**Week 6: Patch Analyst**
- [ ] Build patch scraper: poll Steam news RSS, detect new patches
- [ ] BullMQ job: check for patches every hour
- [ ] Build Patch Analyst agent
- [ ] Store patch reports to DB with structured `affectedItems` JSON
- [ ] Patch Intelligence Center UI: report list, detail view with item impact table
- [ ] Notify users with affected items in inventory or watchlist

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
```
