---
name: nextjs-app-router-patterns
description: Next.js 16 App Router patterns for apps/web — Server Components, streaming, parallel/intercepting routes, Server Actions and caching, in a `[locale]` next-intl layout. Use when working on files under apps/web/src/app, route segments, layouts, loading/error boundaries, route handlers, metadata, or "use client" boundaries.
---

# Next.js App Router Patterns

Patterns for the Next.js **16.3.8** / React **19.2.8** App Router, as used in `apps/web`.

## Doxynix facts

| Fact | Value |
|------|-------|
| Framework | `next` 16.3.8, `react` 19.2.8, `reactCompiler: true` |
| i18n | `next-intl` 4.14.7, 12 locales in `messages/`, `[locale]` dynamic segment |
| Network boundary | `src/proxy.ts` — Next 16 **renamed `middleware.ts` → `proxy.ts`**; do not recreate a `middleware.ts` |
| Route groups | `src/app/[locale]/{(admin),(private),(public)}` plus `[...rest]` |
| Auth boundaries | `experimental.authInterrupts: true` → `forbidden.tsx` / `unauthorized.tsx` under `[locale]/` |
| `cacheComponents` | **disabled** (commented out in `next.config.ts`) — `'use cache'` / `cacheLife` are not in play |
| Build | Turbopack by default; `build`/`analyze` scripts pass `--webpack` |

Never treat Pages Router, `getServerSideProps`, `_app.tsx` or the Next 13/14 API surface as current.

## When to Use This Skill

- Adding or editing anything under `apps/web/src/app`
- Choosing Server vs Client Components, or placing a `'use client'` boundary
- Setting up `loading.tsx` / `error.tsx` / `not-found.tsx` / `forbidden.tsx` boundaries
- Writing a `route.ts` handler, Server Action, or metadata
- Deciding how a route should fetch data (Server Component vs TanStack Query)

## Core Concepts

### 1. Rendering Modes

| Mode                  | Where        | When to Use                               |
| --------------------- | ------------ | ----------------------------------------- |
| **Server Components** | Server only  | Data fetching, heavy computation, secrets |
| **Client Components** | Browser      | Interactivity, hooks, browser APIs        |
| **Static**            | Build time   | Content that rarely changes               |
| **Dynamic**           | Request time | Personalized or real-time data            |
| **Streaming**         | Progressive  | Large pages, slow data sources            |

### 2. File Conventions

```
src/app/
├── [locale]/
│   ├── layout.tsx            # Locale + auth/session boundary
│   ├── error.tsx             # Segment error boundary
│   ├── not-found.tsx
│   ├── forbidden.tsx         # authInterrupts
│   ├── unauthorized.tsx      # authInterrupts
│   ├── opengraph-image.tsx
│   ├── (admin)/              # Route groups: URL-invisible
│   ├── (private)/
│   ├── (public)/
│   └── [...rest]/
├── api/
├── global-error.tsx          # Root error boundary (outside [locale])
├── manifest.ts
└── robots.ts
```

Route groups `(admin)` / `(private)` / `(public)` do not affect the URL. `global-error.tsx` must live at
`src/app/`, not inside `[locale]/`.

## Quick Start

```tsx
// src/app/[locale]/(public)/products/page.tsx
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";

type Props = { searchParams: Promise<{ sort?: string }> };

export default async function ProductsPage({ searchParams }: Props) {
  setRequestLocale(localeFromParams); // opt this route into static rendering
  const { sort } = await searchParams;

  return (
    <main>
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList sort={sort} />
      </Suspense>
    </main>
  );
}
```

## Caching in Next 16

`cacheComponents` is **off** in this repo, so the old ISR playbook does not apply:

- **`fetch` is not cached by default** (changed in Next 15). A bare `fetch(url)` re-fetches on every
  request; there is no implicit `force-cache`.
- There is no `'use cache'` / `cacheLife` without enabling `cacheComponents`, and enabling it is a
  deliberate, project-wide decision — do not flip it in `next.config.ts` as a side effect of a task.
- Opt in **explicitly** per call when you actually want a cached request:

```ts
// cached indefinitely until a tag is revalidated
const cached = await fetch(url, { cache: "force-cache", next: { tags: ["products"] } });

// cached with a lifetime — revalidates Data + Full Route Cache after N seconds
const timed = await fetch(url, { next: { revalidate: 60 } });

// fresh on every request
const fresh = await fetch(url, { cache: "no-store" });
```

- On-demand invalidation from a Server Action:

```ts
("use server");
import { revalidatePath, revalidateTag } from "next/cache";

export async function updateProduct(id: string, data: ProductData) {
  await db.product.update({ where: { id }, data });
  revalidateTag("products");
  revalidatePath("/[locale]/products");
}
```

`revalidatePath` takes a **route**, and in this app every route lives under `[locale]` — passing a
locale-less path silently revalidates nothing.

**Prefer tRPC + TanStack Query for user-facing data.** Server-side tRPC calls go through
`@/server/api/…`; client-side reads use the React Query hooks. Reach for the Next data cache only for
truly static, non-personalised fetches.

## Detailed patterns and worked examples

Detailed pattern documentation lives in `references/details.md`. Read that file when the summary
above is insufficient.

## Best Practices

### Do's

- **Start with Server Components** — add `'use client'` only at the leaf that needs interactivity
- **Colocate data fetching** — fetch where it is used
- **Use Suspense boundaries** — enable streaming for slow data
- **Leverage parallel routes** for independent loading states
- **Use Server Actions** for mutations with progressive enhancement
- **Call `setRequestLocale`** in locale-segment routes that should render statically

### Don'ts

- **Don't pass non-serializable data** across the Server → Client boundary
- **Don't use hooks in Server Components** — no `useState`, `useEffect`
- **Don't fetch in Client Components** — use a Server Component or TanStack Query
- **Don't reintroduce `middleware.ts`** — Next 16 uses `src/proxy.ts`
- **Don't enable `cacheComponents`** or `'use cache'` without an explicit decision
- **Don't add user-facing copy to only `en.json`** — `bun run lint:locales` checks all 12 locales, and
  `bun run lint:i18n` (eloqnt) runs in `validate`