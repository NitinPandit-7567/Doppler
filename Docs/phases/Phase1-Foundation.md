# Phase 1 — Foundation (Weeks 1–3)

> **Goal:** Scaffold the monorepo, wire auth, connect external APIs, build the first usable screen.
> **Deliverable:** User can sign in with Steam, see their inventory with multi-platform prices.

---

## Sub-Phase Breakdown

Phase 1 has three distinct workstreams. Each builds on the previous.

| Sub-Phase | Focus | Depends On | Output |
|-----------|-------|-----------|--------|
| **1A** — Monorepo + Config | Project scaffolding, tooling, infrastructure accounts | Nothing | `turbo dev` runs, all packages compile, Prisma connected |
| **1B** — Auth + Steam Client | Steam login, Express API, inventory endpoint, Redis cache | 1A complete | User can sign in, API serves inventory data |
| **1C** — CSFloat Client + UI | CSFloat integration, dashboard UI, inventory page | 1B complete | User sees inventory with prices from both platforms |

---

## Sub-Phase 1A — Monorepo + Config + Infrastructure

**Goal:** Every app and package exists, compiles, and is wired together. `turbo dev` starts all services. Prisma connects to Supabase. Zero business logic — just infrastructure.

### Checklist

#### Project Init
- [ ] `npm init -y` in project root
- [ ] Install root dev dependencies: `turbo`, `typescript`, `prettier`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`
- [ ] Create `turbo.json` with Turbo v2 `tasks` syntax (build, dev, lint, test, type-check)

#### Strict TypeScript
- [ ] Create `tsconfig.base.json`:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "noImplicitOverride": true,
      "forceConsistentCasingInFileNames": true,
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "esModuleInterop": true,
      "skipLibCheck": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true
    },
    "exclude": ["node_modules", "dist"]
  }
  ```

#### Code Quality Config
- [ ] Create `.prettierrc`:
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 100,
    "tabWidth": 2,
    "arrowParens": "always",
    "endOfLine": "lf",
    "plugins": ["prettier-plugin-tailwindcss"]
  }
  ```
- [ ] Create `.prettierignore` (node_modules, dist, .next, coverage, prisma/migrations)
- [ ] Create `.eslintrc.json` with `@typescript-eslint/strict-type-checked` and `no-explicit-any: error`
- [ ] Create `.eslintignore`

#### VS Code Config
- [ ] Create `.vscode/settings.json` — format on save, ESLint auto-fix, Tailwind IntelliSense
- [ ] Create `.vscode/extensions.json` — Prettier, ESLint, Tailwind CSS, Prisma, Playwright

#### Git Config
- [ ] Create `.gitignore` (node_modules, dist, .next, .env, coverage, .turbo)
- [ ] Create `.nvmrc` → `20`
- [ ] Create `.env.example` with all required environment variables (no real values)

#### Apps — Next.js Frontend
- [ ] `npx create-next-app@latest apps/web --typescript --tailwind --app --eslint`
- [ ] Create `apps/web/next.config.ts` with image remote patterns (Steam CDN, CSFloat)
- [ ] Set up `next/font` in `apps/web/app/layout.tsx` — Inter (sans) + JetBrains Mono (mono) with CSS variables
- [ ] Configure Tailwind to use font variables: `fontFamily: { sans: ['var(--font-inter)'], mono: ['var(--font-mono)'] }`
- [ ] Run `npx shadcn@latest init` in `apps/web/` — configure paths, style, components directory
- [ ] Install `next-themes`, set up `ThemeProvider` in root layout
- [ ] Create `apps/web/middleware.ts` for auth redirects
- [ ] Create route group structure:
  ```
  app/
    (auth)/login/page.tsx          → "Sign in with Steam" button
    (dashboard)/layout.tsx         → Placeholder sidebar + header
    (dashboard)/page.tsx           → Placeholder dashboard
    (dashboard)/deals/page.tsx     → Placeholder
    (dashboard)/alerts/page.tsx    → Placeholder
    (dashboard)/intelligence/page.tsx → Placeholder
    (dashboard)/agents/page.tsx    → Placeholder
    (dashboard)/settings/page.tsx  → Placeholder
    (marketing)/layout.tsx         → Placeholder public layout
    (marketing)/page.tsx           → Placeholder landing page
  ```
- [ ] Add `loading.tsx` skeleton files for each dashboard route
- [ ] Verify: `turbo dev --filter=web` starts Next.js on localhost:3000

#### Apps — Express API
- [ ] Create `apps/api/` with `package.json` (`name: "@doppler/api"`)
- [ ] Create `apps/api/tsconfig.json` extending `tsconfig.base.json`
- [ ] Install: `express`, `cors`, `helmet`, `pino`, `pino-http`, `socket.io`, `zod`
- [ ] Install dev: `@types/express`, `@types/cors`, `tsx`, `nodemon`
- [ ] Create `apps/api/src/server.ts` — minimal Express server with health check route
- [ ] Create `apps/api/src/types/express.d.ts` — typed `req.user` declaration merging
- [ ] Create `apps/api/src/lib/createRoute.ts` — validated route handler factory (see ImplementationPlan Section 5.0)
- [ ] Add `dev` script using `tsx watch src/server.ts`
- [ ] Verify: `turbo dev --filter=api` starts Express on localhost:4000

#### Apps — Worker (BullMQ)
- [ ] Create `apps/worker/` with `package.json` (`name: "@doppler/worker"`)
- [ ] Create `apps/worker/tsconfig.json` extending `tsconfig.base.json`
- [ ] Install: `bullmq`, `ioredis`
- [ ] Create `apps/worker/src/worker.ts` — minimal worker that logs "worker started"
- [ ] Add `dev` script using `tsx watch src/worker.ts`
- [ ] Verify: `turbo dev --filter=worker` starts without error

#### Packages — Types
- [ ] Create `packages/types/` with `package.json` (`name: "@doppler/types"`)
- [ ] Create `packages/types/tsconfig.json` extending `tsconfig.base.json`
- [ ] Create `packages/types/src/index.ts` — barrel export
- [ ] Create `packages/types/src/api.ts`:
  ```typescript
  export interface ApiResponse<T> { readonly success: true; readonly data: T }
  export interface ApiError { readonly success: false; readonly error: string; readonly code?: string }
  export interface PaginatedResponse<T> {
    readonly success: true;
    readonly data: readonly T[];
    readonly pagination: { readonly total: number; readonly page: number; readonly limit: number; readonly hasMore: boolean };
  }
  export type ApiResult<T> = ApiResponse<T> | ApiError;
  ```
- [ ] Create `packages/types/src/market.ts` — `SteamInventoryItemSchema`, `CSFloatListingSchema`, `SteamPriceResponseSchema` (Zod schemas + inferred types)
- [ ] Create `packages/types/src/agents.ts` — `AgentStepSchema`, `TradeActionPayloadSchema`, `PatchAnalysisSchema`, `AffectedItemSchema`
- [ ] Create `packages/types/src/socket-events.ts` — `ServerToClientEvents`, `ClientToServerEvents`, all event payload interfaces
- [ ] Create `packages/types/src/contracts/helpers.ts` — `RouteContract` interface, `InferContract<T>` type helper
- [ ] Create `packages/types/src/contracts/inventory.contracts.ts` — `GetInventoryContract`, `GetInventoryValueContract`, `SyncInventoryContract`
- [ ] Create `packages/types/src/contracts/auth.contracts.ts` — `SteamCallbackContract`
- [ ] Create `packages/types/src/contracts/market.contracts.ts` — `GetPriceContract`, `GetListingsContract`

#### Packages — DB (Prisma)
- [ ] Create `packages/db/` with `package.json` (`name: "@doppler/db"`)
- [ ] Create `packages/db/tsconfig.json` extending `tsconfig.base.json`
- [ ] Install: `prisma`, `@prisma/client`
- [ ] Create `packages/db/prisma/schema.prisma` — Phase 1 models only: `User`, `UserSettings`, `InventorySnapshot`, `PortfolioItem`, plus enums `Plan`, `ItemStatus`
- [ ] Create `packages/db/src/index.ts` — export Prisma client singleton
- [ ] Create `packages/db/src/json-helpers.ts` — `parseJsonField()` and `toJsonField()` helpers
- [ ] Verify: `npx prisma validate` passes

#### Packages — Steam Client (stub)
- [ ] Create `packages/steam-client/` with `package.json` (`name: "@doppler/steam-client"`)
- [ ] Create `packages/steam-client/tsconfig.json` extending `tsconfig.base.json`
- [ ] Install: `axios`, `ioredis`, `zod`
- [ ] Create `packages/steam-client/src/index.ts` — barrel export with placeholder functions
- [ ] Actual implementation in Sub-Phase 1B

#### Packages — CSFloat Client (stub)
- [ ] Create `packages/csfloat-client/` with `package.json` (`name: "@doppler/csfloat-client"`)
- [ ] Create `packages/csfloat-client/tsconfig.json` extending `tsconfig.base.json`
- [ ] Install: `axios`, `zod`
- [ ] Create `packages/csfloat-client/src/index.ts` — barrel export with placeholder functions
- [ ] Actual implementation in Sub-Phase 1C

#### Packages — Agents (stub)
- [ ] Create `packages/agents/` with `package.json` (`name: "@doppler/agents"`)
- [ ] Create `packages/agents/tsconfig.json` extending `tsconfig.base.json`
- [ ] Create `packages/agents/src/index.ts` — placeholder, actual implementation in Phase 2

#### Infrastructure Accounts
- [ ] Create Supabase project, get `DATABASE_URL`, `DIRECT_URL`, Supabase keys
- [ ] Create Upstash Redis instance, get `UPSTASH_REDIS_URL`
- [ ] Create `.env` from `.env.example` with real values (local dev only, gitignored)
- [ ] Run `npx prisma migrate dev --name init` — verify tables created in Supabase

#### Testing Setup
- [ ] Install `vitest` at root
- [ ] Create `vitest.workspace.ts` listing all packages
- [ ] Create `packages/types/vitest.config.ts` as the first test config
- [ ] Write smoke test: validate a Zod schema from `@doppler/types` — correct data passes, malformed rejects
- [ ] Write unit tests for `json-helpers`: `parseJsonField` returns typed data, throws on invalid shapes; `toJsonField` rejects invalid writes
- [ ] Verify: `turbo test` runs and passes

#### Final Verification
- [ ] `turbo dev` starts all three apps (web :3000, api :4000, worker)
- [ ] `turbo build` succeeds with zero errors
- [ ] `turbo type-check` passes with strict mode
- [ ] `turbo test` runs and passes
- [ ] `turbo lint` passes with no `any` violations
- [ ] Prisma Studio opens and shows empty User table
- [ ] Next.js loads on localhost:3000 showing placeholder dashboard

### Files Created (Sub-Phase 1A)

```
doppler/
├── .vscode/
│   ├── settings.json
│   └── extensions.json
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── layout.tsx            → Root layout with fonts, ThemeProvider
│   │   │   ├── (auth)/login/page.tsx
│   │   │   ├── (dashboard)/layout.tsx
│   │   │   ├── (dashboard)/page.tsx
│   │   │   ├── (dashboard)/deals/page.tsx
│   │   │   ├── (dashboard)/deals/loading.tsx
│   │   │   ├── (dashboard)/alerts/page.tsx
│   │   │   ├── (dashboard)/intelligence/page.tsx
│   │   │   ├── (dashboard)/agents/page.tsx
│   │   │   ├── (dashboard)/settings/page.tsx
│   │   │   ├── (marketing)/layout.tsx
│   │   │   └── (marketing)/page.tsx
│   │   ├── components/ui/            → shadcn/ui components
│   │   ├── middleware.ts
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── components.json           → shadcn/ui config
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── api/
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   └── types/express.d.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── worker/
│       ├── src/worker.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── types/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── api.ts
│   │   │   ├── market.ts
│   │   │   ├── agents.ts
│   │   │   ├── socket-events.ts
│   │   │   └── contracts/
│   │   │       ├── helpers.ts
│   │   │       ├── auth.contracts.ts
│   │   │       ├── inventory.contracts.ts
│   │   │       └── market.contracts.ts
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── db/
│   │   ├── prisma/schema.prisma
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── json-helpers.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── steam-client/
│   │   ├── src/index.ts              → Stub
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── csfloat-client/
│   │   ├── src/index.ts              → Stub
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── agents/
│       ├── src/index.ts              → Stub
│       ├── tsconfig.json
│       └── package.json
├── turbo.json
├── tsconfig.base.json
├── package.json
├── .prettierrc
├── .prettierignore
├── .eslintrc.json
├── .eslintignore
├── .gitignore
├── .nvmrc
├── .env.example
├── .env                              → Local only, gitignored
└── vitest.workspace.ts
```

### Acceptance Criteria (Sub-Phase 1A)

- [ ] `turbo dev` starts web (:3000) + api (:4000) + worker — all three running simultaneously
- [ ] `turbo build` — zero errors across all packages
- [ ] `turbo type-check` — zero errors with `strict: true` + `noUncheckedIndexedAccess`
- [ ] `turbo lint` — zero warnings, `no-explicit-any` enforced
- [ ] `turbo test` — at least one passing test (Zod schema smoke test)
- [ ] `npx prisma studio` opens browser, shows empty `users` table in Supabase
- [ ] localhost:3000 shows the placeholder dashboard page
- [ ] localhost:4000/health returns `{ status: "ok" }`
- [ ] No `any` in any file (verified by ESLint)
- [ ] Every package can import from `@doppler/types` without error

---

## Sub-Phase 1B — Auth + Steam Client

**Goal:** Users can sign in with Steam. API serves their inventory. Redis caches all Steam API calls. Auth middleware protects all routes.

**Prerequisites:** Sub-Phase 1A complete. Supabase + Redis connected. `@doppler/types` has market schemas.

### Key Decision

> **Price history data source** — Steam's price history API requires login cookies. Pick ONE before starting:
> 1. Current-price-only for MVP (recommended — simplest, no risk)
> 2. Third-party API (steamapis.com) — adds a dependency and potential cost
> 3. Authenticated Steam sessions — complex, fragile, risk of ToS issues
>
> Recommendation: Option 1 for now. Phase 2 agents need price history — solve it then.

### Checklist

#### Steam OpenID Auth Flow
- [ ] Install in `apps/api`: `openid`, `@supabase/supabase-js`
- [ ] Create `apps/api/src/routes/auth.ts`:
  - `GET /api/auth/steam` — generates Steam OpenID 2.0 redirect URL, sends 302 redirect
  - `GET /api/auth/callback` — receives Steam's OpenID assertion, validates signature
- [ ] On successful callback:
  - Call Steam `ISteamUser/GetPlayerSummaries` with Steam API key → get display name, avatar
  - Upsert user in Postgres via Prisma (`prisma.user.upsert`)
  - Create JWT (use `jsonwebtoken` or Supabase admin SDK)
  - Set JWT as httpOnly cookie + return in response body
  - Redirect to frontend dashboard URL
- [ ] Create `apps/api/src/middleware/auth.ts`:
  - Extract JWT from `Authorization: Bearer` header or cookie
  - Validate JWT
  - Look up user in Prisma
  - Populate typed `req.user` (`{ id, steamId, plan }`)
  - Return 401 with `ApiError` if invalid
- [ ] Wire auth middleware to all routes except `/api/auth/*` and `/api/health`
- [ ] Write unit tests for auth middleware: valid token, expired token, missing header, malformed header

#### Steam Client Package
- [ ] Implement `packages/steam-client/src/cache.ts`:
  - Redis connection using Upstash URL
  - `getOrFetch<T>(key, ttlSeconds, fetchFn)` — generic cache-through helper
- [ ] Implement `packages/steam-client/src/prices.ts`:
  - `getPriceOverview(itemName)` — calls Steam Market API, validates through `SteamPriceResponseSchema`, caches 15min
  - Parse Steam price strings (`"$38.50"`) to numbers
  - Handle rate limit (429) with exponential backoff
- [ ] Implement `packages/steam-client/src/inventory.ts`:
  - `getInventory(steamId)` — calls Steam inventory API
  - Validate through `SteamInventoryItemSchema` array
  - Cache 5 minutes
- [ ] Create `packages/steam-client/src/index.ts` — export all public functions
- [ ] Write unit tests:
  - Price string parsing: `"$38.50"` → `38.5`, `"$1,234.56"` → `1234.56`, missing price → null
  - Cache hit returns cached data without calling API
  - Cache miss calls API, stores result, returns it
  - Rate limit error triggers backoff (mock `setTimeout`)
  - Zod validation rejects malformed Steam responses

#### Inventory API Route
- [ ] Create `apps/api/src/routes/inventory.ts` — all routes use `createRoute()` with Zod contracts:
  - `GET /api/inventory` — uses `GetInventoryContract`, calls `steamClient.getInventory()`, params/query validated
  - `GET /api/inventory/value` — uses `GetInventoryValueContract`, calls inventory + price for each item, sums total USD
  - `POST /api/inventory/sync` — uses `SyncInventoryContract`, force-refresh (bypass cache)
- [ ] Write integration test: mock Steam API responses → verify correct response shape and status codes
- [ ] Write unit test for `createRoute`: valid body passes, invalid body returns 400 with `ApiError`, unhandled throw returns 500

#### Frontend Auth Integration
- [ ] Create `apps/web/lib/api-client.ts` — typed fetch wrapper that includes auth token
- [ ] Update `(auth)/login/page.tsx` — "Sign in with Steam" button that redirects to `/api/auth/steam`
- [ ] Create auth context/hook (`useAuth`) — stores token, provides `user` object, handles logout
- [ ] Update `middleware.ts` — check for auth cookie, redirect unauthenticated users to login

### Files Created (Sub-Phase 1B)

```
apps/api/src/
  routes/auth.ts
  routes/inventory.ts
  middleware/auth.ts

packages/steam-client/src/
  cache.ts
  prices.ts
  inventory.ts
  index.ts
  __tests__/
    prices.test.ts
    inventory.test.ts
    cache.test.ts

apps/web/
  lib/api-client.ts
  hooks/useAuth.ts
  app/(auth)/login/page.tsx          → Updated with Steam login button
```

### Acceptance Criteria (Sub-Phase 1B)

- [ ] Clicking "Sign in with Steam" redirects to Steam's login page
- [ ] After Steam login, user is redirected back to dashboard
- [ ] User record exists in Supabase Postgres (verify via Prisma Studio)
- [ ] `GET /api/inventory` returns the user's Steam inventory as JSON
- [ ] Second call to `GET /api/inventory` within 5 minutes returns cached data (verify via Redis)
- [ ] Unauthenticated request to `/api/inventory` returns 401
- [ ] `turbo test` — all Steam client tests pass, all auth middleware tests pass
- [ ] `turbo type-check` — zero errors
- [ ] No `any` in any new file

---

## Sub-Phase 1C — CSFloat Client + Dashboard UI

**Goal:** Build the first real UI. User sees their inventory with prices from both Steam and CSFloat. Dashboard has a real layout with sidebar navigation.

**Prerequisites:** Sub-Phase 1B complete. User can sign in. API serves inventory data.

### Checklist

#### CSFloat Client Package
- [ ] Implement `packages/csfloat-client/src/listings.ts`:
  - `searchListings(params)` — calls CSFloat API, validates through `CSFloatListingSchema` array
  - Price conversion: cents → USD (CSFloat API returns cents)
  - Float value validation: 0.0–1.0 range
- [ ] Implement `packages/csfloat-client/src/auctions.ts`:
  - `getExpiringAuctions(params)` — auctions expiring within N minutes
  - Parse `auctionEndsAt` datetime strings
- [ ] Create `packages/csfloat-client/src/index.ts` — export all public functions
- [ ] Write unit tests:
  - Cents to USD conversion: `2850` → `28.50`, `0` → `0`, `null` → error
  - Float validation: `0.15` passes, `1.5` rejects, `-0.1` rejects
  - Zod validation rejects malformed CSFloat responses
  - Auction expiry parsing handles timezone correctly

#### Market Price API Route
- [ ] Create `apps/api/src/routes/market.ts`:
  - `GET /api/market/price/:item` — returns Steam + CSFloat prices for an item
  - `GET /api/market/listings?item=...&maxPrice=...&maxFloat=...` — CSFloat listings with filters
- [ ] Write integration tests for market routes

#### Dashboard Layout
- [ ] Install shadcn/ui components: `npx shadcn@latest add table card badge button input select tabs dialog sheet avatar dropdown-menu separator skeleton`
- [ ] Build `(dashboard)/layout.tsx` as Server Component:
  - Sidebar: navigation links (Dashboard, Deals, Alerts, Intelligence, Agents, Settings)
  - Header: user avatar + name (from auth), theme toggle, notification bell placeholder
  - Main content area where `{children}` renders
- [ ] Extract interactive parts into Client Components:
  - `components/layout/MobileSidebarToggle.tsx` (`'use client'`) — hamburger menu for mobile
  - `components/layout/ThemeToggle.tsx` (`'use client'`) — dark/light mode switch using `next-themes`
  - `components/layout/UserMenu.tsx` (`'use client'`) — avatar dropdown with logout
- [ ] Sidebar navigation links use Next.js `<Link>` with active state highlighting

#### Inventory Page (Dashboard Home)
- [ ] Install TanStack Query: `@tanstack/react-query`
- [ ] Create `apps/web/providers/QueryProvider.tsx` (`'use client'`) — wraps `QueryClientProvider`
- [ ] Add `QueryProvider` to `(dashboard)/layout.tsx`
- [ ] Build `(dashboard)/page.tsx`:
  - Server Component shell with heading
  - `InventoryClient` Client Component for interactive data
- [ ] Build `components/inventory/InventoryClient.tsx` (`'use client'`):
  - `useQuery({ queryKey: ['inventory'], queryFn: ... })` to fetch inventory
  - Renders `InventoryTable` + `PortfolioValueCard`
- [ ] Build `components/inventory/InventoryTable.tsx`:
  - Uses shadcn/ui DataTable + TanStack Table
  - Columns: skin icon (`next/image`), item name, wear condition, float value, Steam price, CSFloat price, actions
  - Sortable by name, price, float
  - Loading state shows skeleton rows via `loading.tsx`
- [ ] Build `components/inventory/PortfolioValueCard.tsx`:
  - shadcn/ui Card showing total portfolio value in USD
  - Shows item count
- [ ] Style the CS2-inspired color palette:
  - CSS custom properties in `globals.css` for both light and dark themes
  - Colors that feel intentional and game-adjacent, not generic gray

#### Loading + Error States
- [ ] `(dashboard)/loading.tsx` — full page skeleton with sidebar + content area
- [ ] `(dashboard)/deals/loading.tsx` — card grid skeleton
- [ ] `(dashboard)/page.tsx` uses `<Suspense>` around the inventory table

### Files Created (Sub-Phase 1C)

```
packages/csfloat-client/src/
  listings.ts
  auctions.ts
  index.ts
  __tests__/
    listings.test.ts
    auctions.test.ts

apps/api/src/routes/
  market.ts

apps/web/
  providers/QueryProvider.tsx
  components/
    layout/
      Sidebar.tsx
      Header.tsx
      MobileSidebarToggle.tsx        → 'use client'
      ThemeToggle.tsx                → 'use client'
      UserMenu.tsx                   → 'use client'
    inventory/
      InventoryClient.tsx            → 'use client'
      InventoryTable.tsx
      PortfolioValueCard.tsx
  app/
    (dashboard)/layout.tsx           → Updated with real sidebar + header
    (dashboard)/page.tsx             → Updated with inventory view
    (dashboard)/loading.tsx
    globals.css                      → Updated with CS2 color palette
```

### Acceptance Criteria (Sub-Phase 1C)

- [ ] Dashboard loads with sidebar navigation and header
- [ ] Sidebar highlights the current active route
- [ ] Dark/light theme toggle works, persists across page refreshes
- [ ] Inventory table displays all user's CS2 items with skin icons
- [ ] Table is sortable by item name, Steam price, float value
- [ ] Portfolio value card shows total USD value
- [ ] Loading state shows skeleton placeholders while data fetches
- [ ] Skin icons load via `next/image` from Steam CDN (no layout shift)
- [ ] All CSFloat client tests pass
- [ ] `turbo build` — zero errors
- [ ] `turbo type-check` — zero errors
- [ ] No `any` in any file
- [ ] UI does not look like a generic template — has intentional colors, typography, hierarchy

---

## Phase 1 Complete — Final Verification

When all three sub-phases are done, verify the full end-to-end flow:

1. Open localhost:3000 → redirected to login page
2. Click "Sign in with Steam" → redirected to Steam
3. Log in on Steam → redirected back to dashboard
4. Dashboard shows: sidebar navigation, user avatar in header, dark mode toggle
5. Main area shows: portfolio value card ($X total) + inventory table with all items
6. Items show: skin icon, name, wear, float, Steam price
7. Table sorts by clicking column headers
8. Switch to dark mode → theme persists on refresh
9. Navigate to other dashboard pages → sidebar highlights correctly, placeholder pages load
10. Open browser DevTools → no console errors, no `any` type warnings in build output

---

## Reference Sections in ImplementationPlan.md

If you need deeper detail during implementation, these sections in the master doc are relevant:

| Topic | Section |
|-------|---------|
| Monorepo structure | 1.1 |
| turbo.json config | 1.3 |
| tsconfig.base.json | 1.4 |
| Prisma schema (User, UserSettings, Inventory) | 3 (first 100 lines) |
| TypeScript strategy + Zod schemas | 4B.1 through 4B.6 |
| Express server setup | 5.1 |
| Steam Market API details | 8.1 |
| CSFloat API details | 8.2 |
| Environment variables | 10 |
