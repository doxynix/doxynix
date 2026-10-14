# Types: Schema Validators (Zod)

## Why It Matters

Your Drizzle table already encodes column types, nullability, and which columns are generated.
Re-declaring that shape by hand in a Zod schema for request/response validation duplicates the
source of truth and drifts over time. Drizzle can derive validation schemas directly from a table
so an API stays in sync with the database automatically.

> **This repo uses `drizzle-orm@0.45.3` + `drizzle-zod@0.8.3`.** Import from **`drizzle-zod`**.
> `drizzle-orm@0.45.3` has no `/zod` subpath — `import … from 'drizzle-orm/zod'` is a resolution
> error, not a style choice. Only Drizzle v1 (RC) ships the builders inside `drizzle-orm`, and this
> repo is not on v1.

## Usage (`drizzle-zod`)

Three builders cover the common cases:

- `createSelectSchema(table)` — shape of rows you read back (validate API responses).
- `createInsertSchema(table)` — shape required to insert (generated columns become optional/omitted,
  `.notNull()` columns are required).
- `createUpdateSchema(table)` — shape for updates (everything optional; generated columns rejected).

```typescript
import { uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const userInsertSchema = createInsertSchema(users);
// { name: string; createdAt?: Date } — `id` is DB-generated, so it is not required

const parsed = userInsertSchema.parse({ name: 'Jane' });
await db.insert(users).values(parsed);

const userSelectSchema = createSelectSchema(users);
const rows = await db.select().from(users).limit(1);
const row = userSelectSchema.parse(rows[0]); // { id: string; name: string; createdAt: Date }
```

Enums and views are supported too:

```typescript
const roles = pgEnum('roles', ['admin', 'basic']);
const rolesSchema = createSelectSchema(roles); // z.enum(['admin', 'basic'])
```

## Refinements

Pass a second argument to extend or overwrite individual fields. A **callback** extends the derived
schema; a **schema value** replaces the field entirely (including its nullability).

```typescript
import { z } from 'zod';
import { createSelectSchema } from 'drizzle-zod';

const userSelectSchema = createSelectSchema(users, {
  name: (schema) => schema.max(20),              // extend
  bio: (schema) => schema.max(1000),             // extend
  preferences: z.object({ theme: z.string() }),  // overwrite
});
```

## Where it goes in this repo

- Inline reusable shapes next to the table in `apps/siem-server/src/core/db/schema.ts`
  (`createInsertSchema(table)` re-exported per slice).
- Per-slice request bodies in `apps/siem-server/src/modules/<slice>/<slice>.schema.ts`, consumed by
  Hono via `zValidator("json", Schema)` — that is the `hono-rpc-endpoint` flow.
- The inferred TS types come from the same builders: `typeof userInsertSchema.$inferInput`.

## Incorrect / Correct

```typescript
// Wrong: the v1 import path — this package is not on 0.45.3 and has no such subpath
import { createInsertSchema } from 'drizzle-orm/zod'; // ❌ in this repo

// Right:
import { createInsertSchema } from 'drizzle-zod'; // ✅

// Wrong: hand-writing a Zod schema that mirrors the table — drifts when the table changes
const manualInsert = z.object({ name: z.string(), age: z.number() }); // ❌ duplicates the schema

// Right: derive it so it tracks the table
const userInsert = createInsertSchema(users); // ✅
```

## References

- https://orm.drizzle.team/docs/zod
- https://orm.drizzle.team/docs/upgrade-v1 (v1 folds `drizzle-zod` into `drizzle-orm/zod` — not used here)