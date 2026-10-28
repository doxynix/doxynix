---
name: hono-rpc-endpoint
description: Standardized procedure for creating end-to-end type-safe Hono RPC API endpoints with Zod validation in apps/siem-server and consuming them from apps/web through its BFF. Covers router mounting in src/index.ts, the AppType/hcWithType contract in src/client.ts, shared DTOs in @doxynix/shared, and the dist/-based type-check order. Use when adding or modifying a SIEM backend endpoint.
---

# Hono RPC Endpoint Creation

## Overview
Doxynix SIEM uses Hono RPC to provide compile-time type safety inside `apps/siem-server`. The browser never calls it directly: `apps/web` proxies every SIEM request through its BFF and validates the contract with Zod DTOs from `@doxynix/shared`.

## The Iron Law
```
EVERY REQUEST PAYLOAD MUST BE VALIDATED BY ZOD. THE BROWSER NEVER CALLS siem-server DIRECTLY.
```

## Doxynix facts

| Fact | Value |
|------|-------|
| Hono | 4.13.9 (pinned by root `overrides`; the `catalog:` entry says 4.13.5) |
| Validator | `zValidator` from `@hono/zod-validator` |
| ORM | Drizzle — schema lives in `src/core/db/schema.ts`, UUIDv7 PKs |
| Zod | 4.5.4 |
| Slices | `admin`, `analytics`, `audit`, `incidents`, `rules`, `scan`, `stream-logs` |
| Mount prefix | `/api` |

Slice files live in `src/modules/<slice>/` and are named after the slice: `<slice>.router.ts`,
`<slice>.schema.ts`, `<slice>.service.ts`. Not all three exist in every slice — `admin` has no
service, `stream-logs` has no schema.

Services are **plain exported async functions**, not classes (`rules.service.ts` exports
`createRule`, `updateRule`, `deleteRule`, `getRulesList`).

Server modules are a modular monolith: a slice must not import another slice's internals, and
`core` / `utils` sit below slices. `bun --filter @doxynix/siem-server arch:check` is the gate.

---

## 5-Step Implementation Process

### Step 1: Define Zod Schema (`src/modules/<slice>/<slice>.schema.ts`)
```typescript
import { z } from "zod";

export const createRuleSchema = z.object({
  name: z.string().min(3).max(100),
  query: z.string().min(1),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
```

### Step 2: Implement Domain Service (`src/modules/<slice>/<slice>.service.ts`)
```typescript
import { db } from "@/core/db/db";
import { rules } from "@/core/db/schema";
import type { CreateRuleInput } from "./rules.schema";

export async function createRule(input: CreateRuleInput) {
  const [rule] = await db.insert(rules).values(input).returning();
  return rule;
}
```

### Step 3: Define Router (`src/modules/<slice>/<slice>.router.ts`)
Use `zValidator` from `@hono/zod-validator` and apply authentication. `rules.router.ts` shows the
house pattern: a blanket `requireAuth` via `.use("*", …)`, then per-route `requireRole(...)` plus a
validator.

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { requireAuth, requireRole } from "@/core/middleware/auth.middleware";

import { createRuleSchema } from "./rules.schema";
import { createRule } from "./rules.service";

export const rulesRouter = new Hono()
  .use("*", requireAuth)
  .post("/", requireRole("admin"), zValidator("json", createRuleSchema), async (c) => {
    const data = c.req.valid("json");
    const rule = await createRule(data);
    return c.json(rule, 201);
  });
```

Validate `query` with `zValidator("query", …)`, `json` with `zValidator("json", …)`, and `param`
with `zValidator("param", …)`. Always read the result through `c.req.valid(...)` so the handler gets
the inferred type.

### Step 4: Mount Router in `src/index.ts`
Chaining into `app` is required for `AppType` inference — a router that is created but never routed
is invisible to the client.

```typescript
// apps/siem-server/src/index.ts
export const app = new Hono()
  .basePath("/api")
  // …middleware…
  .route("/rules", rulesRouter)
  .notFound(/* … */)
  .onError(/* … */);

export type AppType = typeof app;
```

### Step 5: Expose through the web BFF (`apps/web`)
Define the request/response DTO in `packages/shared` first, validate it in the router, then call the
route from a server-side tRPC procedure in `apps/web/src/server/modules/siem/`:

```typescript
// apps/web/src/server/modules/siem/<slice>.router.ts
export const siemRouter = createTRPCRouter({
  list: adminProcedure
    .input(SiemQuerySchema)
    .query(({ input }) => siemClient.list(input)),
});
```

Server-side calls go through `hcWithType` from `@doxynix/siem-server/client`; browser components
consume the tRPC procedure. Never raw `fetch` from the browser, never a deep import into
`apps/siem-server/src`.

---

## The type contract

`AppType` and `hcWithType` are exported from **`apps/siem-server/src/client.ts`**, not from
`index.ts`:

```ts
// apps/siem-server/src/client.ts
import { hc } from "hono/client";
import type { app } from "./index";

export type AppType = typeof app;
export type Client = ReturnType<typeof hc<AppType>>;

export const hcWithType = (...args: Parameters<typeof hc>): Client => hc<AppType>(...args);
```

`package.json` exposes them through the `./client` subpath:

```json
"./client": { "types": "./dist/src/client.d.ts", "default": "./dist/src/client.js" }
```

**Both point at `dist/`, not `src/`.** `packages/cli` (types only) and the `apps/web` BFF therefore
type-check against the **built** output of `apps/siem-server` — a new field added to a response type
will not appear on the consumer until the server is rebuilt.

## Build order

```bash
# Build siem-server first, then check the consumers
bun --filter @doxynix/siem-server build      # tsc → dist/

# Or go through Turbo, which honours the dependsOn graph
bun run type-check
```

`bun --filter @doxynix/web type-check` against a stale `dist/` produces phantom "property
does not exist" errors that are not real bugs. When in doubt, rebuild the server before believing a
type error.

Never hand-edit anything under `dist/`. Never hand-edit generated Drizzle migration SQL — see the
`drizzle-migration` skill.

---

## Verification Checklist
- [ ] Every inbound payload goes through `zValidator(...)` and is read via `c.req.valid(...)`.
- [ ] Protected routes use `requireAuth` / `requireRole`.
- [ ] Router is `.route(...)`-mounted into `app` in `apps/siem-server/src/index.ts`.
- [ ] Server compiles: `bun --filter @doxynix/siem-server type-check`.
- [ ] `bun --filter @doxynix/siem-server arch:check` passes — no cross-slice imports.
- [ ] `bun --filter @doxynix/siem-server build` re-run if the client needs the new types.
- [ ] Client consumes via `hcWithType` from `@doxynix/siem-server/client`, never raw `fetch`.
- [ ] `bun run validate` is green before you claim the endpoint is done.