---
name: trpc
description: tRPC 11 in apps/web — router/procedure authoring, `superjson` transformer, the custom `errorFormatter` and ZenStack `enhance` middleware in `core/trpc/init.ts`, the App Router `fetchRequestHandler` route, `@trpc/react-query` hooks (`useUtils`, React Query v5 `gcTime`), server-side callers, and Ably-backed realtime invalidation. Use when adding or changing a router, procedure, middleware, context field or client hook.
---

# tRPC

tRPC **11.18** (`@trpc/server`, `@trpc/client`) with **@trpc/react-query 11.19** and
**@tanstack/react-query 5**, wired into **Next.js App Router** in `apps/web`. ZenStack 2.22
supplies the policy-aware database client.

## Versions at a glance

| Package | Version |
| --- | --- |
| `@trpc/server`, `@trpc/client` | `catalog:` → 11.18.0 |
| `@trpc/react-query` | 11.19.0 |
| `@tanstack/react-query` | `catalog:` → 5.102.2 |
| `superjson` | `catalog:` → 2.2.6 |
| `@zenstackhq/runtime` / `zenstack` | 2.22.3 |

## API migration table (v9/v10 → v11)

Anything below is **wrong** in v11. If you see it in this repo, it is a bug.

| Old | v11 | Notes |
| --- | --- | --- |
| `trpc.useContext()` | `trpc.useUtils()` | renamed in v10 |
| `router.mergeRouters(a, b)` | `t.router({ a, b })` | removed in v11 |
| `appRouter.createCaller(ctx)` | `createCallerFactory(appRouter)(ctx)` | `createCaller` is gone |
| `cacheTime: 30_000` | `gcTime: 30_000` | React Query v4 → v5 rename |
| `trpc.useContext().xyz.invalidate()` | `const utils = trpc.useUtils(); utils.xyz.invalidate()` | |
| `keepPreviousData` | `placeholderData: prev => prev` | React Query v5 |
| `onError` returning `void` + `refetch` | `onSuccess` | v5 removed recovery-by-refetch |
| `status === 'loading'` | `status === 'pending'` | v5 |
| `@trpc/server/observable` | `httpSubscriptionLink` | WS transport reworked |
| `applyWSSHandler` | `httpSubscriptionLink` | |
| `trpc.path.useSubscription()` | `trpc.path.useSubscription()` on `httpSubscriptionLink` | link must be wired |
| `createNextApiHandler`, `pages/api/**` | `fetchRequestHandler` in a `route.ts` | Pages Router is **not** used |
| `_app.tsx`, `_document.tsx` | `composition-root.tsx` providers | App Router only |

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
├── app/composition-root.tsx        # trpc.createClient, httpBatchLink, providers
└── shared/api/trpc.ts              # createTRPCReact<AppRouter>()
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

`shared/api/trpc.ts`:

```ts
import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/modules";

export const trpc = createTRPCReact<AppRouter>();

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
```

`app/composition-root.tsx` builds the client:

```tsx
const [trpcClient] = useState(() =>
  trpc.createClient({
    links: [
      loggerLink({
        enabled: (opts) => IS_DEV || (opts.direction === "down" && opts.result instanceof Error),
      }),
      httpBatchLink({ transformer: superjson, url: `${getBaseUrl()}${TRPC_PREFIX}` }),
    ],
  }),
);
```

Note: the client is created in `useState`, and `httpBatchLink` carries `transformer: superjson` —
matching the server. `trpc.Provider` wraps `QueryClientProvider` (same `QueryClient` instance
passed to both), and the client is memoised across renders (`browserQueryClient ??=`) so a
re-render does not throw away the cache.

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
const utils = trpc.useUtils();

const { data, isPending } = trpc.repo.list.useQuery({ limit: 20 });

const create = trpc.repo.create.useMutation({
  onSuccess: async () => {
    await utils.repo.list.invalidate();
  },
});
```

React Query v5 names in use across this codebase:

| v4 | v5 |
| --- | --- |
| `isLoading` (fetching) | `isPending` (no data yet) / `isFetching` (request in flight) |
| `cacheTime` | `gcTime` |
| `keepPreviousData: true` | `placeholderData: previous => previous` |
| `status === 'loading'` | `status === 'pending'` |
| `onError` + `refetch` for rollback | `onMutate` / `onError` / `onSettled` optimistic trio |

Invalidation goes through `utils`, never a hand-rolled `queryClient.invalidateQueries` with a
string key — the proxy knows the exact keys.

### Server components

Server components are **not** in the client React Query tree. Reach for the router directly or use
the server caller; `useQuery` hooks require the `"use client"` boundary.

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

In tests, build a caller the same way:

```ts
const caller = createCallerFactory(router)(makeCtx() as never);
```

## Realtime

**Realtime in this app is Ably, not tRPC subscriptions.** `app/_components/realtime-provider.tsx`
holds an `Ably.Realtime` client (`ably` 2.29.0, auth via `/api/realtime/auth`) and pushes
payloads that invalidate tRPC queries:

```ts
const utils = trpc.useUtils();
void utils.analysis.getById.invalidate({ fixId: payload.fixId });
utils.analytics.getDashboardStats.setData({}, (oldData) => /* patch */);
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
| `trpc.useContext()` | `trpc.useUtils()` |
| `cacheTime` | `gcTime` |
| `pages/api` handler | `fetchRequestHandler` in `route.ts` |
| Importing a sibling slice's internals | `core`/`utils`, checked by `arch:check` |
| A new router not registered in `server/modules/index.ts` | register it |

## Related

- Schema changes and policies: `.agents/skills/zenstack-migration/`
- Boundary rules: `.agents/skills/architecture/`
- Query patterns: `.agents/skills/tanstack-query-best-practices/`