---
name: hono-rpc-endpoint
description: Standardized procedure for creating end-to-end type-safe Hono RPC API endpoints with Zod validation in apps/siem-server and consuming them in apps/siem-client. Use when adding or modifying SIEM backend endpoints.
---

# Hono RPC Endpoint Creation

## Overview
Doxynix SIEM uses Hono RPC to provide compile-time end-to-end type safety between `siem-server` and `siem-client` without manual fetch or OpenAPI codegen steps.

## The Iron Law
```
EVERY REQUEST PAYLOAD MUST BE VALIDATED BY ZOD. CLIENT MUST CONSUME VIA hcWithType (NO RAW FETCH).
```

---

## 5-Step Implementation Process

### Step 1: Define Zod Schema (`src/modules/<slice>/<slice>.schema.ts`)
```typescript
import { z } from "zod";

export const CreateRuleInputSchema = z.object({
  name: z.string().min(3).max(100),
  severity: z.enum(["low", "medium", "high", "critical"]),
  query: z.string().min(1),
});

export type CreateRuleInput = z.infer<typeof CreateRuleInputSchema>;
```

### Step 2: Implement Domain Service (`src/modules/<slice>/<slice>.service.ts`)
```typescript
import { db } from "@/core/db/db";
import { rules } from "@/core/db/schema";
import type { CreateRuleInput } from "./rules.schema";

export class RulesService {
  static async createRule(input: CreateRuleInput, authorId: string) {
    const [rule] = await db.insert(rules).values({ ...input, createdBy: authorId }).returning();
    return rule;
  }
}
```

### Step 3: Define Router (`src/modules/<slice>/<slice>.router.ts`)
Use `zValidator` from `@hono/zod-validator` and apply authentication:
```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "@/core/middleware/auth.middleware";
import { CreateRuleInputSchema } from "./rules.schema";
import { RulesService } from "./rules.service";

export const rulesRouter = new Hono()
  .post("/", requireAuth, zValidator("json", CreateRuleInputSchema), async (c) => {
    const payload = c.req.valid("json");
    const user = c.get("user");
    const result = await RulesService.createRule(payload, user.id);
    return c.json(result, 201);
  });
```

### Step 4: Mount Router in `src/index.ts`
Chaining router definitions is required for `AppType` inference:
```typescript
const app = new Hono()
  .basePath("/api")
  .route("/rules", rulesRouter);

export type AppType = typeof app;
```

### Step 5: Consume in Client (`apps/siem-client`)
```typescript
import { hcWithType } from "@doxynix/siem-server/client";

// Call with full autocomplete and zero manual typing
const res = await hcWithType.api.rules.$post({
  json: { name: "Suspicious Login", severity: "high", query: "events where count > 5" }
});
const data = await res.json();
```

---

## Verification Checklist
- [ ] Router uses `zValidator("json", Schema)`.
- [ ] Router is chained into `AppType` in `apps/siem-server/src/index.ts`.
- [ ] Server compiles: `bun --filter @doxynix/siem-server type-check`.
- [ ] Client autocomplete resolves endpoint and return types cleanly.