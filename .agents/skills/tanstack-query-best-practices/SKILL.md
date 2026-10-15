---
name: tanstack-query-best-practices
description: TanStack Query 5 best practices for query keys, caching, mutations, error handling and prefetching, as used in apps/web (tRPC via @trpc/tanstack-react-query) and apps/siem-client (Hono RPC). Use when writing or reviewing useQuery/useSuspenseQuery/useMutation calls, query key factories, staleTime/gcTime defaults, invalidation, or optimistic updates.
---

# TanStack Query Best Practices

Guidelines for `@tanstack/react-query` **5.102.2**, as used in `apps/web` and `apps/siem-client`.

## Doxynix facts

| Fact | Value |
|------|-------|
| Version | `@tanstack/react-query` 5.102.2 (root `catalog:`) |
| `apps/web` | Data flows through **tRPC** — `@trpc/tanstack-react-query` 11.19.0 with `superjson` 2.2.6 |
| `apps/siem-client` | Data flows through **Hono RPC** via `hcWithType` from `@doxynix/siem-server/client` |
| Devtools | `@tanstack/react-query-devtools` 5.104.0 (dev only) |
| QueryClient | created in `apps/web/src/app/composition-root.tsx` |

Existing QueryClient defaults — extend these, do not re-declare them per hook:

```ts
new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
  },
});
```

A fresh client is created per server request and cached in the browser (the standard SSR pattern
described in [ssr-dehydration](rules/ssr-dehydration.md)).

## When to Apply

- Creating new data fetching logic
- Setting query-key factories or cache lifetimes
- Implementing mutations, invalidation and optimistic updates
- Prefetching on intent or before navigation
- Wiring dehydration/hydration in `apps/web`

## Rule Categories by Priority

Counts below match the files that actually exist in `rules/`.

| Priority | Category | Rules | Impact |
|----------|----------|-------|--------|
| CRITICAL | Query Keys | 5 | Prevents cache bugs and data inconsistencies |
| CRITICAL | Caching | 4 | Optimizes performance and data freshness |
| HIGH | Mutations | 3 | Ensures data integrity and UI consistency |
| HIGH | Error Handling | 1 | Prevents poor user experiences |
| MEDIUM | Prefetching | 1 | Improves perceived performance |
| MEDIUM | Infinite Queries | 1 | Prevents pagination bugs |
| MEDIUM | SSR Integration | 1 | Enables proper hydration |
| MEDIUM | Parallel Queries | 2 | Enables dynamic parallel fetching |
| LOW | Performance | 1 | Reduces unnecessary re-renders |
| LOW | Offline Support | 2 | Enables offline-first patterns |

## Quick Reference

### Query Keys (Prefix: `qk-`)

- [qk-array-structure](rules/qk-array-structure.md) — Always use arrays for query keys
- [qk-include-dependencies](rules/qk-include-dependencies.md) — Include all variables the query depends on
- [qk-hierarchical-organization](rules/qk-hierarchical-organization.md) — Organize keys hierarchically (entity → id → filters)
- [qk-factory-pattern](rules/qk-factory-pattern.md) — Use query key factories for complex applications
- [qk-serializable](rules/qk-serializable.md) — Ensure all key parts are JSON-serializable

### Caching (Prefix: `cache-`)

- [cache-stale-time](rules/cache-stale-time.md) — Set appropriate staleTime based on data volatility
- [cache-gc-time](rules/cache-gc-time.md) — Configure gcTime for inactive query retention
- [cache-invalidation](rules/cache-invalidation.md) — Use targeted invalidation over broad patterns
- [cache-placeholder-vs-initial](rules/cache-placeholder-vs-initial.md) — placeholderData vs initialData

### Mutations (Prefix: `mut-`)

- [mut-invalidate-queries](rules/mut-invalidate-queries.md) — Invalidate related queries after mutations
- [mut-optimistic-updates](rules/mut-optimistic-updates.md) — Optimistic updates for responsive UI
- [mut-mutation-state](rules/mut-mutation-state.md) — useMutationState for cross-component tracking

### Error Handling (Prefix: `err-`)

- [err-error-boundaries](rules/err-error-boundaries.md) — Error boundaries with useQueryErrorResetBoundary

### Prefetching (Prefix: `pf-`)

- [pf-intent-prefetch](rules/pf-intent-prefetch.md) — Prefetch on user intent (hover, focus)

### Infinite Queries (Prefix: `inf-`)

- [inf-page-params](rules/inf-page-params.md) — Always provide getNextPageParam

### SSR Integration (Prefix: `ssr-`)

- [ssr-dehydration](rules/ssr-dehydration.md) — dehydrate/hydrate for SSR

### Parallel Queries (Prefix: `parallel-`)

- [parallel-use-queries](rules/parallel-use-queries.md) — useQueries for dynamic parallel queries
- [query-cancellation](rules/query-cancellation.md) — Implement query cancellation properly

### Performance (Prefix: `perf-`)

- [perf-select-transform](rules/perf-select-transform.md) — Use select to transform/filter data

### Offline Support (Prefix: `offline-`)

- [network-mode](rules/network-mode.md) — Configure network mode for offline support
- [persist-queries](rules/persist-queries.md) — Configure query persistence for offline support

## Repo notes

- **tRPC in `apps/web`.** Query keys come from `@trpc/tanstack-react-query`'s factories; never
  hand-write a key for a tRPC procedure. Call `useTRPC()` inside the component, read with
  `useQuery(trpc.<router>.<proc>.queryOptions(input, opts))`, write with
  `useMutation(trpc.<router>.<proc>.mutationOptions(opts))`, and invalidate with
  `queryClient.invalidateQueries(trpc.<router>.<proc>.queryFilter(input))` — or `pathFilter()`
  when you do not know the input.
- **Hono RPC in `apps/siem-client`.** Calls go through `hcWithType` from `@doxynix/siem-server/client`
  inside `queryFn` — never raw `fetch`. Because the client types come from the **built**
  `apps/siem-server/dist`, rebuild the server before expecting a new field to type-check.
- **FSD.** Hooks that wrap a query live in a slice's `model/` layer, never in `ui/`.

## How to Use

Each rule file in `rules/` contains: explanation, a bad example, a good example, and when to apply.

## Full Reference

See individual rule files in `rules/` for detailed guidance and code examples.