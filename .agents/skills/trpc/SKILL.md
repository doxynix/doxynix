---
name: trpc
description: tRPC 11 in apps/web — router/procedure authoring, `superjson` transformer, the custom `errorFormatter` and ZenStack `enhance` middleware in `core/trpc/init.ts`, the App Router `fetchRequestHandler` route, the `@trpc/tanstack-react-query` client (`useTRPC`, `queryOptions`/`mutationOptions`, `queryClient.invalidateQueries` with `queryFilter`/`pathFilter`), server-side callers, and Ably-backed realtime invalidation. Use when adding or changing a router, procedure, middleware, context field or client hook.
---

# tRPC

tRPC **11.19** (`@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query`) with
**@tanstack/react-query 5**, wired into **Next.js App Router** in `apps/web`. ZenStack 2.22
supplies the policy-aware database client.

## Versions at a glance

| Package | Version |
| --- | --- |
| `@trpc/server`, `@trpc/client` | `catalog:` → 11.19.0 |
| `@trpc/tanstack-react-query` | 11.19.0 |
| `@tanstack/react-query` | `catalog:` → 5.102.2 |
| `superjson` | `catalog:` → 2.2.6 |
| `@zenstackhq/runtime` / `zenstack` | 2.22.3 |

`@trpc/tanstack-react-query` peers on **exact** `@trpc/client` / `@trpc/server` versions. Bump all
three together or the install breaks. `@trpc/react-query` (the classic client) is gone — do not
reintroduce it.

## Client API: classic → options factory

The client moved off `createTRPCReact` hooks. Anything in the left column is **wrong** in this repo.

| Classic (removed) | Current |
| --- | --- |
| `createTRPCReact<AppRouter>()` | `createTRPCContext<AppRouter>()` |
| `trpc.createClient({...})` | `createTRPCClient<AppRouter>({...})` |
| `<trpc.Provider client qc>` | `<QueryClientProvider>` → `<TRPCProvider trpcClient qc>` |
| `trpc.foo.useQuery(input, opts)` | `useQuery(trpc.foo.queryOptions(input, opts))` |
| `trpc.foo.useMutation(opts)` | `useMutation(trpc.foo.mutationOptions(opts))` |
| `trpc.foo.useInfiniteQuery(input, opts)` | `useInfiniteQuery(trpc.foo.infiniteQueryOptions(input, opts))` |
| `const utils = trpc.useUtils()` | `const trpc = useTRPC()` + `const queryClient = useQueryClient()` |
| `utils.foo.invalidate(input)` | `queryClient.invalidateQueries(trpc.foo.queryFilter(input))` |
| `utils.foo.invalidate()` | `queryClient.invalidateQueries(trpc.foo.pathFilter())` |
| `utils.foo.setData(input, fn)` | `queryClient.setQueryData(trpc.foo.queryKey(input), fn)` |
| `utils.foo.getData(input)` | `queryClient.getQueryData(trpc.foo.queryKey(input))` |

Both clients produce **identical query keys**, so migration could be done incrementally. That
window has closed — do not mix the two.

### Invalidating every variant of a procedure

`queryFilter()` with no input builds a key **without** the `input` field, which TanStack's partial
key matching treats as "any input" — so both of these hit every input variant:

```ts
queryClient.invalidateQueries(trpc.foo.pathFilter()); // also matches mutations + plain useQuery
queryClient.invalidateQueries(trpc.foo.queryFilter()); // queries only
```

This repo uses `pathFilter()` for whole-procedure invalidation because that is what the classic
`utils.foo.invalidate()` did. Reach for `queryFilter()` only when you want to spare mutations.

## Server API migration table (v9/v10 → v11)

Anything below is **wrong** in v11. If you see it in this repo, it is a bug.

| Old | v11 | Notes |
| --- | --- | --- |
| `router.mergeRouters(a, b)` | `t.router({ a, b })` | removed in v11 |
| `appRouter.createCaller(ctx)` | `createCallerFactory(appRouter)(ctx)` | `createCaller` is gone |
| `cacheTime: 30_000` | `gcTime: 30_000` | React Query v4 → v5 rename |
| `keepPreviousData` | `placeholderData: prev => prev` | React Query v5 |
| `onError` returning `void` + `refetch` | `onSuccess` | v5 removed recovery-by-refetch |
| `status === 'loading'` | `status === 'pending'` | v5 |
| `@trpc/server/observable` | `httpSubscriptionLink` | WS transport reworked |
| `applyWSSHandler` | `httpSubscriptionLink` | |
| `createNextApiHandler`, `pages/api/**` | `fetchRequestHandler` in a `route.ts` | Pages Router is **not** used |
| `_app.tsx`, `_document.tsx` | `composition-root.tsx` providers | App Router only |

The `useQuery` result object is unchanged from the classic client — it was already a thin wrapper
over TanStack Query v5. `isPending` / `isLoading` / `isFetching` mean exactly what they did before.

## File map

```
apps/web/src/
├── server/core/trpc/
│   ├── init.ts          # initTRPC, errorFormatter, superjson, middleware chain
│   ├── context.ts       # createContext -> { prisma, redis, req, requestInfo, session }
│   ├── server.ts        # apiForUser() — server-side caller factory
│   └── init.test.ts     # middleware / errorFormatter tests
├── server/modules/
│   ├── index.ts         # createTRPCRouter({...}) -> appRouter + AppRouter type
│   └── <slice>/<name>.router.ts
├── app/api/trpc/[trpc]/route.ts   # fetchRequestHandler (GET + POST)
├── app/composition-root.tsx        # createTRPCClient, httpBatchLink, QueryClientProvider + TRPCProvider
└── shared/api/trpc.ts              # createTRPCContext<AppRouter>() -> TRPCProvider, useTRPC
```

## Server: `init.ts`

This is the file to read before touching any procedure. In order:

### 1. `transformer: superjson`

```ts
const t = initTRPC.context<Context>().create({
  errorFormatter({ ctx, error, shape }) { /* ... */ },
  transformer: superjson,
});
```

`superjson` serialises `Date`, `Map`, `Set`, `BigInt`, `RegExp`, `undefined` and class instances
across the wire. **The client link must declare the same transformer** or every rich type arrives
as a stringified blob:

```ts
httpBatchLink({ transformer: superjson, url: `${getBaseUrl()}${TRPC_PREFIX}` })
```

If you are not using superjson on the server, delete it from both sides — never leave one side
with it.

### 2. `errorFormatter`

The repo does **not** use the stock formatter. It normalises every thrown value into the wire
shape:

```ts
errorFormatter({ ctx, error, shape }) {
  const requestId =
    requestContext.getStore()?.requestId ?? resolveRequestId(ctx?.req) ?? "unknown";

  const normalized = normalizeError(error.cause ?? error);

  return {
    ...shape,
    data: {
      ...shape.data,
      code: normalized.code,
      httpStatus: normalized.status,
      requestId,
      stack: IS_PROD ? undefined : error.stack,
      zodError: normalized.code === "BAD_REQUEST" ? (normalized.zodIssues ?? null) : null,
    },
    message: normalized.clientMessage(),
  };
}
```

Three consequences worth internalising:

- **`error.cause`, not `error`.** tRPC hardcodes `INTERNAL_SERVER_ERROR` for any non-`TRPCError`
  throw and parks the original on `cause`. Re-normalising `cause` is what lets a Prisma or Zod
  error surface as its real code.
- **`data.httpStatus` must be written explicitly.** `getErrorShape` seeds `httpStatus` from the
  *pre-normalization* error, so without this the re-mapped code never reaches the client.
- **`stack` is stripped in production.** Keep it that way; it is not a stylistic choice.

`normalizeError` (from `@/server/core/api-error`) is the single source of truth for
code/status/message. Adding a new error type means extending it, not throwing ad-hoc
`TRPCError`s with hand-written strings.

### 3. ZenStack middleware: `enhance`

```ts
const withZenStack = t.middleware(async ({ ctx, next }) => {
  const sessionUser = ctx.session?.user;
  const userId = sessionUser?.id;
  const userRole = sessionUser?.role == null ? undefined : (sessionUser.role as UserRole);

  const protectedDb = enhance(ctx.prisma, {
    user: userId == null ? undefined : { id: userId, role: userRole },
  }) satisfies DbClient;

  return next({ ctx: { ...ctx, db: protectedDb } });
});
```

**Use `ctx.db` inside procedures, not `ctx.prisma`.** `ctx.db` is the policy-enforcing client:
`@@allow` / `@@deny` rules in the ZenStack models are evaluated against the user you passed to
`enhance`. Reaching for `ctx.prisma` silently bypasses every access policy.

`enhance`'s declared return type is already assignable to `DbClient` — the `satisfies` keeps it
honest without widening by assertion. Do not replace it with `as DbClient`.

### 4. Context and logging middleware

`contextMiddleware` opens an `AsyncLocalStorage` request store (request id, user id, role) if the
caller did not already open one — the route handler and the server caller both open it upstream,
and this middleware reuses it rather than nesting a second store. `loggerMiddleware` times every
procedure and splits the log channel: expected 4xx goes to `appLogger.warn`, unexpected 5xx to
`appLogger.error` with a flush in production.

Do not log an expected rejection at `error`; that is what trains everyone to ignore the channel.

### 5. Procedure tiers

```ts
export const publicProcedure = t.procedure
  .use(contextMiddleware)
  .use(loggerMiddleware)
  .use(withZenStack);

export const protectedProcedure = publicProcedure.use(isAuthed);   // + session, ban check
export const adminProcedure = protectedProcedure.use(isAdmin);     // + role === "ADMIN" + 2FA
```

`isAuthed` throws `TRPCError({ code: "UNAUTHORIZED" })` when there is no session, and calls
`assertNotBanned` (ban flag + `banExpires`). `isAdmin` checks `role === "ADMIN"` **and**
`assertAdminSecondFactor` (needs `twoFactorEnabled` or at least one passkey) — do not "simplify"
that check away.

Pick the narrowest tier that works. `publicProcedure` on a route that reads user data is the
easiway mistake to make and the hardest to notice.

## Routers

### Composition

`createTRPCRouter` is `t.router`. Routers are composed in one place, `server/modules/index.ts`:

```ts
export const appRouter = createTRPCRouter({
  adminAudit: adminAuditRouter,
  analysis: analysisRouter,
  apikey: apiKeyRouter,
  // ...
});

export type AppRouter = typeof appRouter;
```

One slice can export several routers (`audit-logs/` exports `auditRouter` and
`adminAuditRouter`); the key here is the **client-facing path**, the export name is internal.
That is how `trpc.audit.*` and `trpc.adminAudit.*` coexist.

**Adding a router means editing `server/modules/index.ts`.** A router that is not registered there
is invisible to the client and to `openapi.spec.test.ts`.

### A slice router

```ts
import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/core/trpc/init";
import { handlePrismaError } from "@/server/utils/handle-error";

export const healthRouter = createTRPCRouter({
  check: publicProcedure
    .input(z.object({}).optional())
    .output(z.object({ status: z.string() }))
    .query(async ({ ctx }) => {
      try {
        await ctx.db.$queryRaw`SELECT 1`;
        return { status: "ok" };
      } catch (error) {
        handlePrismaError(error, { defaultConflict: "Service temporarily unavailable" });
      }
    }),
});
```

Conventions visible here and worth copying:

- **`zod` imported as `import * as z from "zod"`**, not `import { z }`. Biome and the rest of the
  repo use the namespace form.
- **`.input()` for the request, `.output()` for the response.** `.output()` is not optional
  ceremony — it is what makes the response contract checkable and what
  `openapi.spec.test.ts` validates.
- **Errors go through `handlePrismaError`**, which throws the right `TRPCError` for each Prisma
  code. Do not `catch` and re-throw hand-written errors.

### Imports must flow downward

`server/modules/<slice>/` may import from `core` and `utils`, never the reverse, and never from a
sibling slice's internals. `bun run arch:check` enforces it. See
`.agents/skills/architecture/SKILL.md`.

## Input and output validation

Zod 4.5 (`import * as z from "zod"`). Put reusable schemas in `packages/shared` so client and
server validate identically; a slice-local schema stays in the slice.

```ts
.input(
  z.object({
    limit: z.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid().optional(),
    orderBy: z.enum(["newest", "oldest"]).default("newest"),
  }),
)
.output(
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  }),
)
```

`.transform()` on the input moves mapping to the edge, so the handler receives the final shape
rather than raw wire values. Failed validation becomes `BAD_REQUEST` with `data.zodError` filled
in — the client gets structured issues, not a string.

## Context

`createContext({ req })` returns:

```ts
{
  prisma,       // raw client — policies NOT applied
  db,           // added by withZenStack — policies applied (this is the one to use)
  redis,        // Valkey / Upstash client
  req,          // NextRequest
  requestInfo,  // the AsyncLocalStorage request store
  session,      // better-auth session, or a synthetic one for a Bearer API key
}
```

**API keys.** A `Bearer` header is resolved through `verifyAndUseApiKey` and turned into a
synthetic better-auth session, so every procedure works identically for a CLI and a browser. That
is why `packages/cli` can import the `AppRouter` type and reuse the same server caller.

## Client

`shared/api/trpc.ts` — the only module that creates the React context:

```ts
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@/server/modules";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
```

`RouterInput` / `RouterOutput` are the type contract for the `entities` layer — six model files
derive their types from them. Keep re-exporting them when you touch this file.

`app/composition-root.tsx` builds the client and the provider stack:

```tsx
const [trpcClient] = useState(() =>
  createTRPCClient<AppRouter>({
    links: [
      loggerLink({
        enabled: (opts) => IS_DEV || (opts.direction === "down" && opts.result instanceof Error),
      }),
      httpBatchLink({ transformer: superjson, url: `${getBaseUrl()}${TRPC_PREFIX}` }),
    ],
  }),
);
```

```tsx
<QueryClientProvider client={queryClient}>
  <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
    ...
  </TRPCProvider>
</QueryClientProvider>
```

Three things that are easy to get wrong here:

- **The `<AppRouter>` generic on `createTRPCClient` is not optional.** Omit it and the client
  silently degrades to an untyped one — no error, just no inference downstream.
- **`httpBatchLink` must keep `transformer: superjson`** to match the server, or every rich type
  (`Date`, `Map`) arrives as a stringified blob.
- **`QueryClientProvider` wraps `TRPCProvider`.** `TRPCProvider` takes the `QueryClient` as a prop
  and never reads it from context, so the order is cosmetic today — but keep it canonical so code
  added directly under the provider keeps working.

The client is created in `useState` and the `QueryClient` is memoised across renders
(`browserQueryClient ??=`) so a re-render never throws away the cache.

QueryClient defaults: `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`. Change them
in `makeQueryClient()`, not per component.

## App Router route handler

`app/api/trpc/[trpc]/route.ts`:

```ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export { handler as GET, handler as POST };
```

- **`fetchRequestHandler`, not `createNextApiHandler`.** There is no Pages Router in this app —
  no `pages/`, no `_app.tsx`.
- `createContext` is called lazily inside the handler (`createContext: () => createContext({ req })`).
- The handler opens the request store (`buildRequestStore` / `requestContext.run`) so every log
  line and every `errorFormatter` call can resolve a request id.
- `onError` logs only in dev.

```ts
export { handler as GET, handler as POST };
```

is the required export shape. Omitting `POST` breaks every mutation with a confusing 405.

## React Query integration

```ts
const trpc = useTRPC();
const queryClient = useQueryClient();

const { data, isPending } = useQuery(trpc.repo.list.queryOptions({ limit: 20 }));

const create = useMutation(
  trpc.repo.create.mutationOptions({
    onSuccess: async () => {
      await queryClient.invalidateQueries(trpc.repo.list.pathFilter());
    },
  }),
);
```

`useTRPC()` **must be called inside the component**. A component that reads `trpc.` without it is a
compile error, not a silent bug — good.

`queryOptions(input, options)` takes the procedure input first and TanStack options second. The
`enabled` flag moves from a separate hook argument into the second argument:

```ts
useQuery(trpc.agent.listSessions.queryOptions({ currentRepo }, { enabled: isOpen }));
```

React Query v5 names in use across this codebase:

| v4 | v5 |
| --- | --- |
| `isLoading` (fetching) | `isPending` (no data yet) / `isFetching` (request in flight) |
| `cacheTime` | `gcTime` |
| `keepPreviousData: true` | `placeholderData: previous => previous` |
| `status === 'loading'` | `status === 'pending'` |
| `onError` + `refetch` for rollback | `onMutate` / `onError` / `onSettled` optimistic trio |

**Never hand-roll a `queryClient.invalidateQueries({ queryKey: [...] })` with a string key.** Use
`queryFilter(input)` when you know the input and `pathFilter()` when you do not — the proxy derives
the exact key shape, and a string key that does not match silently invalidates nothing. This is not
hypothetical: `two-factor-card.tsx` carried a `["active-sessions"]` key that never matched the real
`["user","getActiveSessions"]` key, so the invalidation was a no-op.

### Server components and prefetch

Server components are **not** in the client React Query tree. Reach for the router directly or use
the server caller; `useQuery` hooks require the `"use client"` boundary.

Prefetching **is** wired up, via `core/trpc/prefetch.tsx`:

```tsx
import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

// in a page / layout
await prefetch(trpcProxy.apikey.list.queryOptions());

return <HydrateClient>{/* everything that reads that query */}</HydrateClient>;
```

Covered today (17 pages): the private layout (`notification.getStats`, `repo.getSlim`), the dashboard
(`analytics.getDashboardStats`, `analytics.getTrends`), repo overview / docs / map / pulls /
pull detail / settings (`analysis.getWorkspace`, `getDetailedMetrics`, `getAvailableDocs`,
`getStructureMap`, `listByRepository`, `getByPRNumber`, `getRepoConfig`), `/repos` (`repo.getAll`),
`/dashboard/notifications` (`notification.getAll`), and settings (`apikey.list`,
`user.getActiveSessions`, `user.getLinkedAccounts`, `audit.getActivityLogs`).

Not covered, deliberately: the four admin lists (5–8 URL filters plus debounced search each — the
input builders would have to be extracted from the containers first, and a mistake there breaks a
filter rather than merely losing a prefetch), and every query that sits behind `enabled` or behind
user input.

`/repos` and `/dashboard/notifications` show the pattern for filtered lists: prefetch **only the
untouched default state**, guarded by `hasAnySearchParam` from `shared/lib/url-state.ts`, so a filtered
visit skips the prefetch instead of guessing a filter set. Undefined-valued input keys are dropped
when TanStack hashes the key, so a minimal server-side input matches the full one the client builds —
but the constants behind it (`REPO_LIST_DEFAULT_LIMIT`, `NOTIFICATIONS_DEFAULT_LIMIT`) live next to
the parsers and are read by both the container and the page, so the two cannot drift apart.

Rules that are not obvious and were each learned the hard way:

- **`await` the prefetch.** A fire-and-forget prefetch dehydrates as a still-pending promise, so SSR
  renders without the data while the client hydrates with it. Any component that branches on the
  value then throws a hydration mismatch. tRPC's docs warn about this; the cost is TTFB.
- **`HydrateClient` must wrap the consumers**, at the level that owns them. A layout's
  `HydrateClient` does not cover a page added by client-side navigation, because the layout does not
  re-render.
- **The prefetched key must match the one the browser builds**, or the prefetch silently does nothing
  and nothing errors. For URL-driven input that means parsing `searchParams` server-side through the
  same nuqs parsers — see `shared/lib/url-state.ts` and the per-feature input builders
  (`dashboardRangeInput` is the reference).
- **Parse parsers from `nuqs/server`, not `nuqs`**, in any module a server component imports. The
  client entry does not resolve its parser helpers server-side and throws at module evaluation;
  `type-check` and the unit suite both pass while the page 500s.
- **`.withDefault` lives on `useQueryStates`, not on `parse()`.** `parse(undefined)` returns
  `undefined` or `null`, never the default. The input builders re-apply defaults; without that the
  server key carries `undefined` while the client carries the default.
- **Never prefetch what is behind `enabled` or behind user input** — dropdown feeds, dialogs, the
  agent panel, and debounced search. The trigger is client intent the server cannot know, and a
  prefetch there pays for data that may never be displayed.
- **Check the gate before prefetching, not just the input.** `repo-map` gates `getStructureMap` on
  `?view=` being absent, so the prefetch there is conditional; the page shows a single node instead of
  the map when a view is selected.
- **Cascading queries are not prefetchable.** `pull/[n]` reads `getByPRNumber`, then derives an
  `analysisId` from its result to read `getComments`. Only the first hop can be prefetched.

## Server-side callers

```ts
// core/trpc/server.ts
export const apiForUser = cache(async (userId: string) => {
  const { appRouter } = await import("@/server/modules");
  const createCaller = createCallerFactory(appRouter);
  // ... build a synthetic session context ...
  return createCaller(ctx);
});
```

`createCallerFactory` is re-exported from `init.ts` (`export const createCallerFactory =
t.createCallerFactory`). `appRouter.createCaller(ctx)` **does not exist** in v11.

Two subtleties in `server.ts`:

- The `await import("@/server/modules")` is **dynamic on purpose**. Server slices import this file
  back for `apiForUser`; a static import closes the cycle. Keep it dynamic.
- `cache()` from React dedupes per-`userId`, so `apiForUser` is safe to call from several server
  slices in one render.

`server.ts` also exports `ctxForUser(userId)` and `ctxForRequest()`, which build the context and
leave the caller to the caller. `api()` and `apiForUser()` are thin wrappers over them. Use the
`ctxFor*` functions directly when you need a context but not a caller — that is what the RSC
prefetch proxy does.

`core/trpc/prefetch.tsx` is the **second** file allowed to reach into `modules/`. Unlike
`server.ts` its `import { appRouter }` is **static and must stay that way**: `HydrateClient` calls
`dehydrate()` in the same tick as the component that calls `prefetch()`, so awaiting a dynamic
import would let the dehydration run before the query even started and silently ship nothing. Both
files are exempted by `CALLER_FACTORY` in `.dependency-cruiser.ts`.

In tests, build a caller the same way:

```ts
const caller = createCallerFactory(router)(makeCtx() as never);
```

## Realtime

**Realtime in this app is Ably, not tRPC subscriptions.** `app/_components/realtime-provider.tsx`
holds an `Ably.Realtime` client (`ably` 2.29.0, auth via `/api/realtime/auth`) and pushes
payloads that invalidate tRPC queries:

```ts
const trpc = useTRPC();
const queryClient = useQueryClient();

void queryClient.invalidateQueries(trpc.analysis.getById.queryFilter({ fixId: payload.fixId }));
queryClient.setQueryData(trpc.analytics.getDashboardStats.queryKey({}), (oldData) => /* patch */);
```

If you genuinely need tRPC streaming, the v11 path is `httpSubscriptionLink` on the client plus a
subscription procedure on the server — `@trpc/server/observable`, `applyWSSHandler` and the old
`ws` link options are all removed. Do not add them. Prefer Ably: it is already wired, it survives
the App Router edge runtime, and channel-based fan-out maps better onto Trigger.dev run events.

## Testing

Procedures are unit-testable through the caller — no HTTP server:

```ts
import { createCallerFactory, createTRPCRouter } from "@/server/core/trpc/init";

const caller = createCallerFactory(router)(ctxFor({ banned: true }));
await expect(caller.someAdminProcedure()).rejects.toThrow(TRPCError);
```

`core/trpc/init.test.ts` is the reference: it builds a fake context and asserts that
`protectedProcedure` rejects a banned user, that `adminProcedure` enforces the second factor, and
that `errorFormatter` produces the expected shape.

## Testing a slice router

Build the router from the slice export, not from `appRouter` — a slice test that constructs
`appRouter` pulls in every other slice and its database access:

```ts
const router = createTRPCRouter(analysisRepoRouter);
const caller = createCallerFactory(router)(makeCtx());
```

## Testing components

Client components now call `useTRPC()` and a real `useQuery`, so a component test needs two mocks
plus a real `QueryClient`. The mock is shaped like this:

```ts
vi.mock("@/shared/api/trpc", () => ({
  useTRPC: () => ({
    adminUser: {
      getDetail: {
        queryOptions: (input: unknown, options: { enabled?: boolean } | undefined) => ({
          enabled: options?.enabled,
          queryFn: () => getDetail(input),
          queryKey: ["adminUser", "getDetail", input],
        }),
      },
    },
  }),
}));
```

Then wrap the tree in a fresh `QueryClientProvider` with `retry: false`, and assert with
`findBy*` instead of `getBy*` — the fetch is now async, so the old synchronous assertions on
rendered output would race.

A mock shaped like the classic client (`trpc: { adminUser: { getDetail: { useQuery: ... } } }`) is
wrong: `useTRPC` is not exported any more, so the component throws on the first render.

## OpenAPI

`server/modules/openapi.spec.test.ts` reads `public/openapi.json` and asserts it still matches the
router shape. Changing procedure paths or output schemas means regenerating the spec, or that test
fails. It is a gate, not documentation.

## Anti-patterns

| Don't | Do |
| --- | --- |
| `ctx.prisma` in a procedure | `ctx.db` (ZenStack policies) |
| `throw new Error("...")` | `TRPCError` with a code, or `handlePrismaError` |
| Hand-writing `shape.data.httpStatus` in a procedure | extend `normalizeError` |
| A hand-rolled error payload | rely on `errorFormatter` |
| `superjson` on only one side | both, or neither |
| Omitting `.output()` | declare the response schema |
| `createCaller(ctx)` | `createCallerFactory(appRouter)(ctx)` |
| `trpc.useUtils()` / `useContext()` | `useTRPC()` + `useQueryClient()` |
| `utils.foo.invalidate(input)` | `queryClient.invalidateQueries(trpc.foo.queryFilter(input))` |
| `invalidateQueries({ queryKey: ["foo"] })` | `queryFilter(input)` / `pathFilter()` — never a string key |
| `createTRPCClient({...})` without a generic | `createTRPCClient<AppRouter>({...})` |
| Reading `trpc.` without calling `useTRPC()` | call it inside the component |
| `cacheTime` | `gcTime` |
| `pages/api` handler | `fetchRequestHandler` in `route.ts` |
| Importing a sibling slice's internals | `core`/`utils`, checked by `arch:check` |
| A new router not registered in `server/modules/index.ts` | register it |

## Related

- Schema changes and policies: `.agents/skills/zenstack-migration/`
- Boundary rules: `.agents/skills/architecture/`
- Query patterns: `.agents/skills/tanstack-query-best-practices/`