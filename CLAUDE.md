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

- **Frontend:** Next.js 15 (App Router), Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Recharts, Socket.io-client, React Hook Form + Zod, Framer Motion
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

## Next.js Patterns

### App Router Conventions

- `page.tsx` — route page (default: Server Component)
- `layout.tsx` — shared layout (wraps children, persists across navigations)
- `loading.tsx` — Suspense fallback for the route segment
- `error.tsx` — error boundary for the route segment (must be `'use client'`)
- `not-found.tsx` — 404 UI for the route segment

### Data Fetching

- **Server Components** fetch data directly (no TanStack Query needed, no `useEffect`). Use `async` component functions or call server actions.
- **Client Components** use TanStack Query for data that needs reactivity, background refresh, or optimistic updates.
- **Avoid waterfalls** — fetch independent data in parallel with `Promise.all()` in Server Components, or use multiple `useQuery` calls in Client Components (TanStack Query deduplicates and parallelizes).
- **Prefetch** likely next navigations using `router.prefetch()` or `<Link>` (which prefetches by default).

### Route Organization (Doppler)

```
app/
  (auth)/
    login/page.tsx
  (dashboard)/
    layout.tsx           → Sidebar + header layout, shared across dashboard pages
    page.tsx             → Portfolio overview (dashboard home)
    deals/page.tsx       → Live deal feed
    alerts/page.tsx      → Alert history
    intelligence/page.tsx → Patch reports + investment hub
    agents/page.tsx      → Agent Studio
    agents/[id]/page.tsx → Agent detail + run history
    settings/page.tsx    → User settings
```

Route groups `(auth)` and `(dashboard)` provide different layouts without affecting the URL.

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

- **Framework:** Vitest (unit/integration), Playwright (E2E)
- **Run:** `turbo test` (parallel across packages)
- **Coverage target:** 80%+ on `packages/agents`, `packages/steam-client`, `packages/csfloat-client`
- **Priority order:**
  1. ActionGuard — every branch (this code spends real money)
  2. Deal score math — discount after fees calculation
  3. External API parsers — Steam price string parsing, CSFloat cents-to-USD
  4. Zod schema validation — correct data passes, malformed data rejects
  5. Json helpers — `parseJsonField` / `toJsonField` type boundaries
- **E2E:** Playwright for critical user flows (login → dashboard, deal feed, agent studio, action center)
- **Test structure:** Arrange-Act-Assert pattern, descriptive test names that explain behavior

```typescript
test('rejects buy when daily spend would exceed limit', async () => {
  // Arrange
  const action: TradeAction = { type: 'BUY', valueUsd: 30, ... };
  const config: AutoApproveConfig = { dailySpendLimit: 50, ... };
  // Seed $25 of existing spend today
  await seedTodaySpend(userId, 25);

  // Act
  const result = await actionGuard.evaluate(action, config, userId);

  // Assert
  expect(result.approved).toBe(false);
  expect(result.reason).toBe('daily_limit_reached');
});
```

---

## Database

- **ORM:** Prisma — schema at `packages/db/prisma/schema.prisma`
- **Migrations:** `npx prisma migrate dev --name <description>` from `packages/db/`
- **Studio:** `npx prisma studio` for visual DB browsing
- **Key:** API and Worker share the same database and Prisma client
- **Json fields:** Always accessed through typed helpers, never raw

---

## Styling

- **Tailwind CSS** for all styling. No CSS modules, no styled-components, no inline style objects.
- **shadcn/ui** as the component library base. Customize, don't use raw defaults.
- **CSS custom properties** for design tokens (colors, spacing, typography) in a global CSS file.
- **Dark mode** via Tailwind's `dark:` variant. Both light and dark themes must feel intentional.
- **Animate compositor-friendly properties only:** `transform`, `opacity`, `clip-path`. Never animate `width`, `height`, `margin`, `padding`, `top`, `left`.
- **`prefers-reduced-motion`** — all motion must respect this media query. Use a `useReducedMotion` hook.

---

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
```

## File Size Limits

- Max 400 lines per file (split if larger)
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

- `Docs/ImplementationPlan.md` — full engineering reference (schema, code, phases, TypeScript strategy, testing strategy)
- `Docs/ProductVision.md` — product strategy, features, monetization, competitive landscape
