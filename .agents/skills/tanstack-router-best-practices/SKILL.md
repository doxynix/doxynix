---
name: tanstack-router-best-practices
description: TanStack Router 1 best practices for apps/siem-client only — file-based routing, routeTree.gen.ts, loaders/ensureQueryData, validated search params, navigation and code splitting in a Vite SPA. Use when adding or editing files under apps/siem-client/src/routes, the router setup in main.tsx, or search-param handling there. Does NOT apply to apps/web, which uses Next.js App Router.
---

# TanStack Router Best Practices

Guidelines for `@tanstack/react-router` **1.170.40**, as used in **`apps/siem-client`**.

## Scope — apps/siem-client only

TanStack Router exists in exactly one place in this monorepo: **`apps/siem-client`** (Vite 8 +
React 19). `apps/web` is a **Next.js 16 App Router** app and does **not** use TanStack Router at all —
do not apply these rules there, and do not introduce router concepts into `src/app`.

| Fact | Value |
|------|-------|
| Router | `@tanstack/react-router` 1.170.40 |
| Devtools | `@tanstack/react-router-devtools` 1.167.2 (DEV only) |
| Vite plugin | `@tanstack/router-plugin` 1.168.41 |
| Route tree | `apps/siem-client/src/routeTree.gen.ts` — **generated, never hand-edit** |
| Router setup | `apps/siem-client/src/main.tsx` (`createRouter({ routeTree })` + `Register` module) |
| Routes | `src/routes/{__root.tsx,index.tsx,auth.tsx}` |
| Layout | FSD layers `routes → widgets → features → entities → shared` |
| Server data | Hono RPC via `hcWithType` from `@doxynix/siem-server/client`, inside `queryFn` |

## When to Apply

- Adding or editing anything under `apps/siem-client/src/routes`
- Creating a route, pathless layout, or index route
- Adding or validating `validateSearch`
- Adding a loader (`loader`, `loaderDeps`, `beforeLoad`)
- Splitting a route with `.lazy.tsx`
- Preloading on intent

## Rule Categories by Priority

Counts below match the files that actually exist in `rules/`.

| Priority | Category | Rules | Impact |
|----------|----------|-------|--------|
| CRITICAL | Type Safety | 4 | Prevents runtime errors and enables refactoring |
| CRITICAL | Route Organization | 5 | Ensures maintainable route structure |
| HIGH | Router Config | 1 | Global router defaults |
| HIGH | Data Loading | 6 | Optimizes data fetching and caching |
| HIGH | Search Params | 5 | Enables type-safe URL state |
| HIGH | Error Handling | 1 | Handles 404 and errors gracefully |
| MEDIUM | Navigation | 5 | Improves UX and accessibility |
| MEDIUM | Code Splitting | 3 | Reduces bundle size |
| MEDIUM | Preloading | 3 | Improves perceived performance |
| LOW | Route Context | 3 | Enables dependency injection |

## Quick Reference

### Type Safety (Prefix: `ts-`)

- [ts-register-router](rules/ts-register-router.md) — Register router type for global inference
- [ts-use-from-param](rules/ts-use-from-param.md) — Use `from` parameter for type narrowing
- [ts-route-context-typing](rules/ts-route-context-typing.md) — Type route context with `createRootRouteWithContext`
- [ts-query-options-loader](rules/ts-query-options-loader.md) — Use `queryOptions` in loaders for type inference

### Router Config (Prefix: `router-`)

- [router-default-options](rules/router-default-options.md) — Configure router defaults

### Route Organization (Prefix: `org-`)

- [org-file-based-routing](rules/org-file-based-routing.md) — Prefer file-based routing for conventions
- [org-route-tree-structure](rules/org-route-tree-structure.md) — Follow hierarchical route tree patterns
- [org-pathless-layouts](rules/org-pathless-layouts.md) — Use pathless routes for shared layouts
- [org-index-routes](rules/org-index-routes.md) — Index vs layout routes
- [org-virtual-routes](rules/org-virtual-routes.md) — Virtual file routes

### Data Loading (Prefix: `load-`)

- [load-use-loaders](rules/load-use-loaders.md) — Use route loaders for data fetching
- [load-loader-deps](rules/load-loader-deps.md) — Define `loaderDeps` for cache control
- [load-ensure-query-data](rules/load-ensure-query-data.md) — Use `ensureQueryData` with TanStack Query
- [load-deferred-data](rules/load-deferred-data.md) — Split critical and non-critical data
- [load-error-handling](rules/load-error-handling.md) — Handle loader errors appropriately
- [load-parallel](rules/load-parallel.md) — Leverage parallel route loading

### Search Params (Prefix: `search-`)

- [search-validation](rules/search-validation.md) — Always validate search params
- [search-type-inheritance](rules/search-type-inheritance.md) — Leverage parent search param types
- [search-middleware](rules/search-middleware.md) — Use search param middleware
- [search-defaults](rules/search-defaults.md) — Provide sensible defaults
- [search-custom-serializer](rules/search-custom-serializer.md) — Custom search param serializers

### Error Handling (Prefix: `err-`)

- [err-not-found](rules/err-not-found.md) — Handle not-found routes properly

### Navigation (Prefix: `nav-`)

- [nav-link-component](rules/nav-link-component.md) — Prefer `Link` component for navigation
- [nav-active-states](rules/nav-active-states.md) — Configure active link states
- [nav-use-navigate](rules/nav-use-navigate.md) — Use `useNavigate` for programmatic navigation
- [nav-relative-paths](rules/nav-relative-paths.md) — Relative path navigation
- [nav-route-masks](rules/nav-route-masks.md) — Use route masks for modal URLs

### Code Splitting (Prefix: `split-`)

- [split-lazy-routes](rules/split-lazy-routes.md) — Use `.lazy.tsx` for code splitting
- [split-critical-path](rules/split-critical-path.md) — Keep critical config in the main route file
- [split-auto-splitting](rules/split-auto-splitting.md) — Enable `autoCodeSplitting` when possible

### Preloading (Prefix: `preload-`)

- [preload-intent](rules/preload-intent.md) — Enable intent-based preloading
- [preload-stale-time](rules/preload-stale-time.md) — Configure preload stale time
- [preload-manual](rules/preload-manual.md) — Use manual preloading strategically

### Route Context (Prefix: `ctx-`)

- [ctx-root-context](rules/ctx-root-context.md) — Define context at the root route
- [ctx-before-load](rules/ctx-before-load.md) — Extend context in `beforeLoad`
- [ctx-dependency-injection](rules/ctx-dependency-injection.md) — Use context for dependency injection

## Repo notes

- **`routeTree.gen.ts` is generated.** Edit files under `src/routes/`; the Vite plugin regenerates the
  tree. Never hand-edit the generated file.
- **Route components stay thin.** A route file should render an `Outlet` or delegate to a `widgets/`
  slice — FSD imports flow `routes → widgets → features → entities → shared`, never sideways.
- **Server data** goes through `hcWithType` from `@doxynix/siem-server/client` in a `queryFn`, wired to
  `useQuery`/`ensureQueryData`. The client types come from the **built** `apps/siem-server/dist` — run
  `bun run type-check` (via Turbo) or build the server first after changing an endpoint.

## How to Use

Each rule file in `rules/` contains: explanation, a bad example, a good example, and when to apply.

## Full Reference

See individual rule files in `rules/` for detailed guidance and code examples.