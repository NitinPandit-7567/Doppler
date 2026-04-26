# Doppler

AI-powered CS2 skin market intelligence platform. Multi-agent orchestration over Steam and CSFloat APIs with real-time alerts, portfolio intelligence, and user-defined auto-trading workflows.

## Architecture

Turborepo monorepo with strict TypeScript across all packages.

```
apps/
  web/       → Next.js 15 (App Router) — Vercel
  api/       → Express.js REST + WebSocket — Railway
  worker/    → BullMQ agent job processor — Railway (separate service)
  mobile/    → Expo (React Native) — Phase 5, not yet created

packages/
  agents/        → AgentRunner + ActionGuard + tool definitions (Vercel AI SDK)
  db/            → Prisma schema, client, migrations, typed Json helpers
  steam-client/  → Steam API wrapper with Redis caching
  csfloat-client/→ CSFloat API wrapper
  types/         → All shared TypeScript interfaces + Zod schemas
```

The API server and BullMQ worker are **separate processes**. Never run agent jobs inside the API process — a slow agent run (20+ LLM round-trips) blocks API responsiveness.

## Tech Stack

- **Frontend:** Next.js 15 (App Router), Tailwind CSS, shadcn/ui (copied source, Radix primitives), TanStack Table, TanStack Query, Zustand, Recharts, Socket.io-client, React Hook Form + Zod, Framer Motion, Magic UI (landing page)
- **Backend:** Express.js, Socket.io, Prisma, Zod validation, Pino logging
- **Agents:** Vercel AI SDK (`ai` + `@ai-sdk/openai`), GPT-4o / GPT-4o-mini
- **Database:** PostgreSQL (Supabase) + Redis (Upstash)
- **Jobs:** BullMQ (Redis-backed, runs in apps/worker/)
- **Auth:** Steam OpenID 2.0 → Supabase Auth (custom flow)
- **Testing:** Vitest (unit/integration), Playwright (E2E)

---

## TypeScript Rules (CRITICAL)

These are non-negotiable. Every file, every package.

1. **Zero `any`** — never use `:any`, `as any`, or `@ts-ignore`. ESLint enforces `@typescript-eslint/no-explicit-any: error`.
2. **`unknown` at boundaries** — data from Steam API, CSFloat API, webhooks, and user input enters as `unknown` and must be validated through a Zod schema before use.
3. **Typed Prisma Json fields** — every `Json` column has a Zod schema in `@doppler/types`. Use `parseJsonField()` to read and `toJsonField()` to write. Never cast Json to a type directly.
4. **Discriminated unions** — when a value can be one of several shapes, use a literal `type` or `kind` tag field. Never use a bag of optional properties.
5. **`readonly` by default** — function parameters, return types, and interface properties should be `readonly` unless mutation is explicitly needed.
6. **`strict: true`** in `tsconfig.base.json` — includes `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `noUncheckedIndexedAccess`.
7. **No type assertions to silence errors** — `as const` is fine. `as SomeType` after a type guard is fine. `as SomeType` to bypass a compiler error is not.

### Type Patterns

```typescript
// Discriminated union — CORRECT
type AgentResult =
  | { readonly status: 'completed'; readonly summary: string; readonly dealsFound: number }
  | { readonly status: 'failed'; readonly error: string }
  | { readonly status: 'cancelled'; readonly reason: string };

// Bag of optionals — WRONG, do not do this
interface AgentResult {
  status: string;
  summary?: string;
  dealsFound?: number;
  error?: string;
  reason?: string;
}
```

```typescript
// Generic with constraint — CORRECT
function findById<T extends { readonly id: string }>(
  items: readonly T[],
  id: string,
): T | undefined {
  return items.find(item => item.id === id);
}

// Loose any — WRONG
function findById(items: any[], id: string): any { ... }
```

```typescript
// Narrow unknown at boundary — CORRECT
const response: unknown = await fetch('/api/deals').then(r => r.json());
const deals = DealArraySchema.parse(response);

// Trust external data — WRONG
const deals = (await fetch('/api/deals').then(r => r.json())) as Deal[];
```

---

## React Rules (CRITICAL)

### useEffect — You Probably Don't Need It

Most `useEffect` usage is a code smell. Before writing `useEffect`, check if one of these patterns applies.

**1. Deriving state from props or other state — compute during render, don't sync with effects.**

```tsx
// WRONG — unnecessary effect + extra re-render
function DealCard({ deal }: { readonly deal: Deal }) {
  const [discountLabel, setDiscountLabel] = useState('');
  useEffect(() => {
    setDiscountLabel(deal.discountPct > 0.25 ? 'Great Deal' : 'Good Deal');
  }, [deal.discountPct]);
  return <span>{discountLabel}</span>;
}

// CORRECT — derive during render
function DealCard({ deal }: { readonly deal: Deal }) {
  const discountLabel = deal.discountPct > 0.25 ? 'Great Deal' : 'Good Deal';
  return <span>{discountLabel}</span>;
}
```

**2. Expensive calculations — use `useMemo`, not effects.**

```tsx
// WRONG
function DealFeed({ deals, filter }: Props) {
  const [filtered, setFiltered] = useState<readonly Deal[]>([]);
  useEffect(() => {
    setFiltered(deals.filter(d => d.discountPct >= filter.minDiscount));
  }, [deals, filter]);
}

// CORRECT
function DealFeed({ deals, filter }: Props) {
  const filtered = useMemo(
    () => deals.filter(d => d.discountPct >= filter.minDiscount),
    [deals, filter],
  );
}
```

**3. Resetting state when a prop changes — use `key`, not effects.**

```tsx
// WRONG
function AgentRunViewer({ runId }: { readonly runId: string }) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  useEffect(() => {
    setExpandedStep(null);
  }, [runId]);
}

// CORRECT — parent resets the component via key
<AgentRunViewer runId={runId} key={runId} />
```

**4. Event responses (form submit, button click, navigation) — use event handlers, not effects.**

```tsx
// WRONG — POST in an effect triggered by state
function AgentForm() {
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (submitted) {
      fetch('/api/agents', { method: 'POST', body: JSON.stringify(config) });
    }
  }, [submitted]);
  return <button onClick={() => setSubmitted(true)}>Create</button>;
}

// CORRECT — POST in the event handler
function AgentForm() {
  async function handleCreate() {
    await fetch('/api/agents', { method: 'POST', body: JSON.stringify(config) });
  }
  return <button onClick={handleCreate}>Create</button>;
}
```

**5. Data fetching — use TanStack Query, never raw effects.**

```tsx
// WRONG — manual fetch in effect, no caching, no loading state, no error handling, race conditions
function InventoryPage() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    fetch('/api/inventory').then(r => r.json()).then(setItems);
  }, []);
}

// CORRECT — TanStack Query handles caching, background refresh, loading, errors
function InventoryPage() {
  const { data: items, isLoading, error } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiClient.getInventory(),
  });
}
```

**6. Chains of effects — compute in one place, don't cascade state updates.**

```tsx
// WRONG — effect chain: deal changes → score updates → label updates
useEffect(() => { setScore(calculateScore(deal)); }, [deal]);
useEffect(() => { setLabel(score > 80 ? 'Hot' : 'Normal'); }, [score]);

// CORRECT — derive both in render
const score = calculateScore(deal);
const label = score > 80 ? 'Hot' : 'Normal';
```

**7. Notifying parent of state changes — lift state up instead.**

```tsx
// WRONG — child syncs state to parent via effect
function WatchlistFilter({ onFilterChange }: Props) {
  const [filter, setFilter] = useState('all');
  useEffect(() => { onFilterChange(filter); }, [filter, onFilterChange]);
}

// CORRECT — parent owns the state
function WatchlistPage() {
  const [filter, setFilter] = useState('all');
  return <WatchlistFilter filter={filter} onChange={setFilter} />;
}
```

### When useEffect IS Appropriate

- Connecting to a WebSocket (`socket.connect()` / cleanup `socket.disconnect()`)
- Setting up browser event listeners (resize, online/offline) with cleanup
- Synchronizing with a third-party library (chart initialization, map rendering)
- Browser API interactions (Notification permission, clipboard)

The rule: **effects are for synchronizing with external systems, not for reacting to state changes.**

### Component Rules

- **One component per file.** Exception: small internal helper components that are only used in that file.
- **Props interfaces co-located** with the component, exported if reused.
- **No inline object/array/function creation in JSX props** — these create new references every render and break `React.memo` / dependency arrays.

```tsx
// WRONG — new object every render
<DealCard style={{ marginTop: 8 }} onAction={() => handleAction(deal.id)} />

// CORRECT
const cardStyle = { marginTop: 8 } as const;
const handleDealAction = useCallback(() => handleAction(deal.id), [deal.id]);
<DealCard style={cardStyle} onAction={handleDealAction} />

// ALSO CORRECT — if DealCard is not memoized and this isn't a performance-critical list
// then the inline form is fine. Only optimize when there's a measured problem.
```

- **Prefer Server Components (default in App Router)** for pages that just display data. Only add `'use client'` when the component needs interactivity (state, effects, event handlers, browser APIs).
- **Never put `'use client'` on a layout or page** unless absolutely necessary. Push it down to the smallest interactive leaf component.

---

## State Management

State has four distinct categories. Never mix them.

| Category | Tool | Example |
|----------|------|---------|
| **Server state** | TanStack Query | Inventory data, deal feed, agent run history, patch reports |
| **Client state** | Zustand | UI state: sidebar open, selected tab, theme, expanded rows |
| **URL state** | `useSearchParams` / route segments | Active filters, sort order, pagination, search query |
| **Form state** | React Hook Form + Zod | Agent Studio form, settings form, watchlist target prices |

Rules:
- **Never duplicate server state into Zustand.** If data comes from the API, it lives in TanStack Query. Zustand stores UI-only state.
- **Derive values, don't store computed state.** If `filteredDeals` is derivable from `deals` + `filter`, compute it. Don't store it separately.
- **URL is the source of truth for shareable state.** Filters, sort order, pagination, active tab — anything a user might bookmark or share goes in the URL via `useSearchParams`.

```tsx
// WRONG — duplicating server data into client store
const useStore = create((set) => ({
  deals: [],
  setDeals: (deals) => set({ deals }),
}));

// CORRECT — server state in TanStack Query, UI state in Zustand
const { data: deals } = useQuery({ queryKey: ['deals'], queryFn: fetchDeals });
const expandedDealId = useStore((s) => s.expandedDealId);
```

---

## Next.js 15 Rules (CRITICAL)

### Server Components vs Client Components

Every component in `app/` is a **Server Component by default**. This is intentional. Follow these rules:

- **Server Components** — for pages that fetch and display data. They run on the server, produce zero client JS, and can directly `await` data.
- **Client Components** — only when the component needs: `useState`, `useEffect`, `useRef`, event handlers (`onClick`, `onChange`), browser APIs, or context providers. Mark with `'use client'` at the top of the file.
- **Push `'use client'` to the smallest leaf component.** Never put it on a layout or page unless absolutely necessary. Extract the interactive part into its own client component and import it into the server component.

```tsx
// WRONG — entire page is a client component because of one interactive element
'use client';
export default function DealsPage() {
  const [filter, setFilter] = useState('all');
  const deals = /* ... */;
  return (
    <div>
      <h1>Deals</h1>
      <DealFilter value={filter} onChange={setFilter} />
      <DealList deals={deals} />
    </div>
  );
}

// CORRECT — page is a server component, only the filter is client
// app/(dashboard)/deals/page.tsx (Server Component)
export default async function DealsPage() {
  return (
    <div>
      <h1>Deals</h1>
      <DealFeedClient />  {/* Only this is 'use client' */}
    </div>
  );
}

// components/deals/DealFeedClient.tsx
'use client';
export function DealFeedClient() {
  const [filter, setFilter] = useState('all');
  const { data: deals } = useQuery({ queryKey: ['deals', filter], queryFn: ... });
  return (
    <>
      <DealFilter value={filter} onChange={setFilter} />
      <DealList deals={deals} />
    </>
  );
}
```

### Fetch Caching (v15 Breaking Change)

**In Next.js 15, `fetch()` in Server Components is NOT cached by default.** This changed from v14. You must explicitly opt in.

```tsx
// NOT cached (default in v15) — fresh data every request
const data = await fetch('https://api.example.com/data');

// Cached — opt in explicitly
const data = await fetch('https://api.example.com/data', {
  cache: 'force-cache',
});

// Time-based revalidation — cached but refreshed every 15 minutes
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 900 },
});

// Tag-based revalidation — cached until manually invalidated
const data = await fetch('https://api.example.com/data', {
  next: { tags: ['inventory'] },
});
// Then invalidate from a Server Action:
import { revalidateTag } from 'next/cache';
revalidateTag('inventory');
```

For Doppler: most dashboard data is real-time (deals, prices, alerts), so the default no-cache behavior is correct. Only cache static or slow-changing data like patch reports and investment reports.

### Data Fetching Strategy

| Where | How | When |
|-------|-----|------|
| **Server Component** | Direct `async/await` or `fetch()` | Static page data, SEO-critical content, data that doesn't change per interaction |
| **Client Component** | TanStack Query (`useQuery`) | Real-time data (deals, prices), data that refreshes in the background, paginated lists |
| **Mutations** | Server Actions or TanStack Query `useMutation` | Form submissions, approve/reject actions, settings updates |

```tsx
// Server Component — fetches at request time, no client JS
export default async function PatchReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await prisma.patchReport.findUnique({ where: { id } });
  if (!report) notFound();
  return <PatchReportView report={report} />;
}

// Client Component — real-time data with background refresh
'use client';
function DealFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => apiClient.getDeals(),
    refetchInterval: 30_000,
  });
}
```

**Avoid request waterfalls** — fetch independent data in parallel:

```tsx
// WRONG — sequential, slow
const inventory = await fetchInventory(userId);
const deals = await fetchDeals(userId);
const alerts = await fetchAlerts(userId);

// CORRECT — parallel
const [inventory, deals, alerts] = await Promise.all([
  fetchInventory(userId),
  fetchDeals(userId),
  fetchAlerts(userId),
]);
```

### Streaming and Suspense

Use `<Suspense>` boundaries to stream in slow content without blocking the entire page:

```tsx
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      {/* Portfolio value loads fast — show immediately */}
      <Suspense fallback={<PortfolioSkeleton />}>
        <PortfolioSummary />
      </Suspense>

      {/* Agent runs might be slow — stream in separately */}
      <Suspense fallback={<AgentRunsSkeleton />}>
        <RecentAgentRuns />
      </Suspense>
    </div>
  );
}
```

Use `loading.tsx` files for automatic route-level Suspense:

```
app/(dashboard)/deals/loading.tsx   → Shows while deals/page.tsx loads
app/(dashboard)/agents/loading.tsx  → Shows while agents/page.tsx loads
```

### Async Params and SearchParams (v15 Breaking Change)

In Next.js 15, `params` and `searchParams` in page/layout/route components are **Promises** that must be awaited:

```tsx
// v14 (OLD) — synchronous access
export default function Page({ params }: { params: { id: string } }) {
  return <div>{params.id}</div>;
}

// v15 (CORRECT) — params is a Promise
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>{id}</div>;
}

// Same for searchParams
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { filter, page } = await searchParams;
}
```

### Middleware (Auth Redirects)

```typescript
// middleware.ts (project root — NOT inside app/)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  const isDashboard = request.nextUrl.pathname.startsWith('/');
  const isPublicPath = ['/', '/login', '/api'].some(p =>
    request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith('/api/')
  );

  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

### Metadata (SEO)

Use the Metadata API in Server Components — not `<head>` tags:

```tsx
// app/(dashboard)/deals/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deal Feed | Doppler',
  description: 'Real-time CS2 skin deals across Steam and CSFloat',
};

// Dynamic metadata for pages with params
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const agent = await prisma.agentConfig.findUnique({ where: { id } });
  return {
    title: `${agent?.name ?? 'Agent'} | Doppler`,
  };
}
```

### Image Optimization

Always use `next/image` — never raw `<img>` tags:

```tsx
import Image from 'next/image';

// Hero / above-the-fold — eager load with priority
<Image src="/hero.webp" alt="Doppler" width={1200} height={600} priority />

// Below-the-fold — lazy load (default)
<Image src={skin.iconUrl} alt={skin.name} width={128} height={128} />

// Remote images — configure allowed domains in next.config.ts
```

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'steamcommunity-a.akamaihd.net' },
      { protocol: 'https', hostname: 'community.cloudflare.steamstatic.com' },
      { protocol: 'https', hostname: 'csfloat.com' },
    ],
  },
};
```

### Font Optimization

Use `next/font` — never load fonts via `<link>` tags or CDN URLs:

```tsx
// app/layout.tsx
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

Max two font families. Use the CSS variables in Tailwind config:

```javascript
// tailwind.config.ts
fontFamily: {
  sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
  mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
},
```

### next.config.ts

Use TypeScript config (supported in v15):

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'steamcommunity-a.akamaihd.net' },
      { protocol: 'https', hostname: 'community.cloudflare.steamstatic.com' },
      { protocol: 'https', hostname: 'csfloat.com' },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  logging: {
    fetches: { fullUrl: true },
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
```

### Route Organization (Doppler)

```
app/
  layout.tsx              → Root layout (fonts, providers, metadata)
  (auth)/
    login/page.tsx
  (dashboard)/
    layout.tsx            → Sidebar + header, shared across dashboard pages
    page.tsx              → Portfolio overview (dashboard home)
    deals/
      page.tsx            → Live deal feed
      loading.tsx         → Skeleton while deals load
    alerts/
      page.tsx            → Alert history
    intelligence/
      page.tsx            → Patch reports + investment hub
    agents/
      page.tsx            → Agent Studio (list all agents)
      [id]/page.tsx       → Agent detail + run history
    settings/
      page.tsx            → User settings
  (marketing)/
    layout.tsx            → Public layout (no sidebar, different header)
    page.tsx              → Landing page (hero, features, pricing)
```

Route groups `(auth)`, `(dashboard)`, and `(marketing)` provide different layouts without affecting the URL.

### App Router File Conventions

| File | Purpose | Must be Client? |
|------|---------|----------------|
| `page.tsx` | Route page | No (default Server) |
| `layout.tsx` | Shared layout wrapping children | No |
| `loading.tsx` | Suspense fallback for the segment | No |
| `error.tsx` | Error boundary for the segment | **Yes** (`'use client'`) |
| `not-found.tsx` | 404 UI for the segment | No |
| `template.tsx` | Like layout but re-mounts on navigation | No |
| `route.ts` | API Route Handler (GET, POST, etc.) | N/A (server only) |

---

## Code Patterns

### API Responses

All API endpoints use the typed envelope from `@doppler/types/api`:

```typescript
interface ApiResponse<T> { readonly success: true; readonly data: T }
interface ApiError { readonly success: false; readonly error: string }
interface PaginatedResponse<T> {
  readonly success: true;
  readonly data: readonly T[];
  readonly pagination: { readonly total: number; readonly page: number; readonly limit: number; readonly hasMore: boolean };
}
```

### External API Calls

Always validate external data through Zod:

```typescript
const validated = SteamPriceResponseSchema.parse(response.data);
```

### Prisma Json Fields

```typescript
// Reading — parse from untyped Json into typed object
const data = parseJsonField(DealDataSchema, row.dealData, 'Deal.dealData');
// Writing — validate before storing
await prisma.deal.create({ data: { dealData: toJsonField(DealDataSchema, value) } });
```

### WebSocket Events

Socket.io uses typed event maps from `@doppler/types/socket-events`. Wrong event names or payload shapes are compile errors.

```typescript
const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer);
```

### Express Request

`req.user` is typed via declaration merging in `apps/api/src/types/express.d.ts`. The `authenticate` middleware populates `{ id, steamId, plan }`.

### Error Handling

- **API routes:** try/catch at the route level, return typed `ApiError`. Never let unhandled exceptions crash the process.
- **Agent runs:** try/catch wraps the entire `AgentRunner.run()` call. Partial results (deals found before failure) are preserved. Failed runs are logged with the error message.
- **External API calls:** handle rate limit errors (429) with exponential backoff. Handle network errors with retry. Never silently swallow errors.

```typescript
// CORRECT — explicit error handling in route
router.get('/:id', async (req, res) => {
  const deal = await prisma.deal.findUnique({ where: { id: req.params.id, userId: req.user.id } });
  if (!deal) {
    res.status(404).json({ success: false, error: 'Deal not found' } satisfies ApiError);
    return;
  }
  res.json({ success: true, data: deal } satisfies ApiResponse<Deal>);
});
```

---

## Agent Framework

Agents are defined in `packages/agents/src/agents/`. Each agent:
- Has a system prompt defining its goal
- Declares which tools it can use (Zod-validated tool definitions)
- Specifies `maxSteps` and which LLM model to use
- Runs via `AgentRunner.run()` which wraps Vercel AI SDK's `generateText`

Model selection:
- `gpt-4o-mini` → Deal Hunter, Auction Sniper (arithmetic-heavy, frequent runs)
- `gpt-4o` → Patch Analyst, Portfolio Advisor, Case Analyst, freeform queries (reasoning-heavy)

ActionGuard checks (in order) before any auto-execution:
1. Value above confirm-always threshold → require manual approval
2. Value above per-transaction limit → reject
3. Daily spend would exceed cap → reject
4. Sell price below floor (% of Steam price) → reject
5. All checks pass → auto-approve

---

## Testing

### Frameworks

| Layer | Tool | Why |
|---|---|---|
| **Unit + Integration** | **Vitest** | Native ESM + TypeScript (no transformer needed). Jest-compatible API. Vite-powered watch mode. Turborepo workspace support. |
| **E2E** | **Playwright** | Tests Chrome + Firefox + Safari. Can mock WebSocket (critical for deal push). Free parallelism. API testing built-in. |

**Not used:** Jest (ESM issues, needs transformer), Cypress (no WebSocket testing, no Safari, paid parallelism), React Testing Library (dashboard components tested via E2E instead).

### Commands

```bash
turbo test                              # All unit/integration tests
turbo test --filter=agents              # Single package
npx playwright test                     # All E2E tests
npx playwright test --project=chromium  # Single browser
npx playwright test --ui                # Interactive debug mode
```

### Coverage Target

80%+ on `packages/agents`, `packages/steam-client`, `packages/csfloat-client`, `packages/types`, `packages/db`.
Frontend components covered by E2E (Playwright), not unit tests.

### Priority

1. ActionGuard — every branch (this code spends real money)
2. Deal score math — discount after fees calculation
3. External API parsers — Steam price string parsing, CSFloat cents-to-USD
4. Zod schema validation — correct data passes, malformed data rejects
5. Json helpers — `parseJsonField` / `toJsonField` type boundaries

### Test Structure

Arrange-Act-Assert pattern. Descriptive names that explain behavior.

```typescript
test('rejects buy when daily spend would exceed limit', async () => {
  // Arrange
  const action = { type: 'BUY' as const, valueUsd: 30 };
  const config = { dailySpendLimit: 50, confirmAbove: 100, maxBuyPerTransaction: 50, maxSellDiscountPct: 0.85 };
  vi.spyOn(guard as any, 'getTodaySpend').mockResolvedValue(25);

  // Act
  const result = await guard.evaluate(action, config, 'user-1');

  // Assert
  expect(result.approved).toBe(false);
  expect(result.reason).toBe('daily_limit_reached');
});
```

### File Organization

Tests in `__tests__/` directories adjacent to source code. E2E tests in `apps/web/e2e/`.

```
packages/agents/src/core/__tests__/actionGuard.test.ts
packages/steam-client/src/__tests__/prices.test.ts
apps/web/e2e/deal-feed.spec.ts
```

---

## Database

- **ORM:** Prisma — schema at `packages/db/prisma/schema.prisma`
- **Migrations:** `npx prisma migrate dev --name <description>` from `packages/db/`
- **Studio:** `npx prisma studio` for visual DB browsing
- **Key:** API and Worker share the same database and Prisma client
- **Json fields:** Always accessed through typed helpers, never raw

---

## UI Library: shadcn/ui

shadcn/ui is NOT an npm dependency. It's a CLI that copies component source code into your project. You own every line.

```bash
npx shadcn@latest init          # Initialize in apps/web/
npx shadcn@latest add button    # Copies Button.tsx into your components/ui/
npx shadcn@latest add dialog table card input select tabs
```

Components are built on **Radix UI** (headless accessible primitives) + **Tailwind CSS** (styling). You modify them freely — there's no upstream to break.

**What shadcn/ui provides:** Button, Card, Dialog, Sheet, Drawer, Table, Tabs, Select, Input, Textarea, Checkbox, Radio, Switch, Slider, Tooltip, Popover, DropdownMenu, Command (search palette), Toast, Form, Calendar, DatePicker, and ~70 more.

**What you supplement from other libraries:**

| Gap | Library | Notes |
|-----|---------|-------|
| Advanced data tables | `@tanstack/react-table` | shadcn/ui provides a DataTable pattern wrapping this. Add sorting, filtering, pagination, column pinning on top. |
| Charts | `recharts` | Already in stack. shadcn/ui ships a Chart component wrapping Recharts. |
| Landing page effects | `Magic UI` (`magicui`) | Animated hero sections, gradient backgrounds, particle effects. Copy-paste, Tailwind-native, free. |
| Date range pickers | `react-day-picker` | shadcn/ui DatePicker wraps this. |

### Why Not Other Libraries

- **MUI / Ant Design** — use CSS-in-JS (Emotion/cssinjs), conflict with Tailwind. Two styling systems = maintenance burden.
- **Mantine** — uses CSS Modules, not Tailwind. Running alongside Tailwind creates dual-system friction.
- **HeroUI (NextUI v2)** — pretty but thin on data-heavy components. No charts, basic tables. Better for marketing sites.

## Styling

- **Tailwind CSS** for all styling. No CSS modules, no styled-components, no inline style objects, no `sx` props.
- **shadcn/ui** as the component library base. Customize aggressively — do not ship default shadcn appearance.
- **CSS custom properties** for design tokens (colors, spacing, typography) in a global CSS file.
- **Dark mode** via Tailwind's `dark:` variant with `next-themes`. Both light and dark themes must feel intentional — not one theme with colors inverted.
- **Animate compositor-friendly properties only:** `transform`, `opacity`, `clip-path`. Never animate `width`, `height`, `margin`, `padding`, `top`, `left`.
- **`prefers-reduced-motion`** — all motion must respect this media query. Use a `useReducedMotion` hook.
- **No template aesthetics** — do not ship generic card grids, stock hero sections, or default component library appearance. Every surface should have intentional hierarchy, typography, and visual direction.

---

## Hooks (Automatic Quality Enforcement)

These hooks run automatically via `.claude/settings.json`. No manual invocation needed.

| Hook | Trigger | What it does |
|------|---------|-------------|
| **File size guard** | Before writing any file | Blocks writes exceeding 400 lines. Forces splitting into modules. |
| **Prettier** | After editing `.ts`/`.tsx` files | Auto-formats the file. Consistent style without manual work. |
| **Type check** | When session ends | Runs `tsc --noEmit` to catch type errors before moving on. |

## Agent Usage During Implementation

Use these specialized agents proactively — don't wait to be asked.

### Mandatory (use every time)

| Agent | When | How to invoke |
|-------|------|---------------|
| **code-reviewer** | After writing or modifying any code | Auto-invoked or `/code-review` |
| **typescript-reviewer** | After TypeScript changes | Catches `any` leaks, assertion abuse, missing generics, weak types |
| **build-error-resolver** | When `turbo build` or `turbo type-check` fails | Analyzes errors, applies minimal fixes to get green |

### Situational (use when relevant)

| Agent | When | What it catches |
|-------|------|----------------|
| **security-reviewer** | Touching auth, API routes, user input, CSFloat API keys, ActionGuard | OWASP Top 10, secrets in code, injection, CSRF, XSS in AI output |
| **tdd-guide** | Starting a new feature or fixing a bug | Enforces write-tests-first. RED → GREEN → REFACTOR. |
| **database-reviewer** | Changing Prisma schema, writing queries | N+1 queries, missing indexes, schema design issues, connection limits |
| **performance-optimizer** | Bundle size concerns, slow queries, render issues | Bottlenecks, unnecessary re-renders, unoptimized images |
| **planner** | Starting a new Phase or complex feature | Creates step-by-step implementation plan before coding |

### Parallel agent pattern

For independent work, launch agents in parallel:

```
# When reviewing a feature that touches multiple layers:
Agent 1: typescript-reviewer on packages/agents changes
Agent 2: security-reviewer on apps/api route changes
Agent 3: database-reviewer on Prisma schema changes
```

## Skills (Slash Commands)

| Command | When to use |
|---------|-------------|
| `/plan` | Before starting any Phase — creates implementation plan |
| `/tdd` | When building new features — write tests first |
| `/code-review` | After writing code — quality, security, patterns |
| `/build-fix` | When build fails — auto-fix errors |
| `/feature-dev` | Guided feature development with codebase analysis |
| `/security-review` | Before committing auth/API/payment code |
| `/e2e` | When writing Playwright tests |
| `/refactor-clean` | After finishing a Phase — remove dead code |

## Development

```bash
turbo dev                    # Run all apps
turbo dev --filter=web       # Frontend only
turbo dev --filter=api       # API only
turbo dev --filter=worker    # Worker only
turbo build                  # Build all
turbo test                   # Test all
turbo type-check             # Type-check all packages
npx prisma studio            # Visual DB browser (from packages/db/)
npx prisma migrate dev       # Run migrations (from packages/db/)
npx playwright test          # E2E tests
npx shadcn@latest add [name] # Add a shadcn/ui component
```

## File Size Limits

- Max 400 lines per file (split if larger — enforced by PreToolUse hook)
- Max 50 lines per function
- Organize by feature/domain, not by file type

## Naming Conventions

- **Components:** PascalCase (`DealCard`, `AgentBuilder`, `PriceChart`)
- **Hooks:** `use` prefix, camelCase (`useDeals`, `useReducedMotion`, `useSocket`)
- **Files:** match the primary export (`DealCard.tsx`, `useDeals.ts`, `actionGuard.ts`)
- **Types/Interfaces:** PascalCase (`Deal`, `AgentRunResult`, `ApiResponse<T>`)
- **Zod schemas:** PascalCase + `Schema` suffix (`DealDataSchema`, `SteamPriceResponseSchema`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_STEPS`, `CACHE_TTL_SECONDS`)
- **Packages:** `@doppler/` scope (`@doppler/types`, `@doppler/db`, `@doppler/agents`)

## Key Docs

- `Docs/ImplementationPlan.md` — master engineering reference (schema, code, architecture, TypeScript strategy, testing strategy)
- `Docs/ProductVision.md` — product strategy, features, monetization, competitive landscape
- `Docs/phases/Phase1-Foundation.md` — **current work order** (Weeks 1-3, Sub-Phases 1A/1B/1C)

Phase files are self-contained work orders with checklists, file lists, code patterns, and acceptance criteria. Read the relevant phase file instead of the full ImplementationPlan.md when executing.
