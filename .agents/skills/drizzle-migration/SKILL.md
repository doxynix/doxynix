---
name: drizzle-migration
description: Workflow for modifying Drizzle ORM PostgreSQL schemas, generating migrations, and executing DB operations in apps/siem-server. Use when modifying server/src/core/db/schema.ts or running Drizzle Kit commands.
---

# Drizzle ORM Migration Workflow (`siem-server`)

## Overview
All relational database tables in `apps/siem-server` are managed by Drizzle ORM. Any schema change requires a generated and reviewed SQL migration.

## The Iron Law
```
PRIMARY KEYS MUST BE UUIDv7. NEVER MODIFY GENERATED MIGRATION SQL FILES WITHOUT RE-GENERATING.
```

---

## Execution Steps

### 1. Schema Definition (`apps/siem-server/src/core/db/schema.ts`)
- **Primary Keys**: Always use `uuid("id").primaryKey().default(sql`uuidv7()`)`.
- **Foreign Keys**: Declare explicit cascade or nullify behaviors (`onDelete: "cascade"`).
- **Indexes**: Add necessary indexes in the table's secondary callback array.
- **Enums**: Always declare enums using `pgEnum`.

```typescript
// ✅ Example Table Definition:
export const securityIncidents = pgTable("security_incidents", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  severity: incidentSeverityEnum("severity").notNull().default("medium"),
  targetHost: text("target_host").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("incident_host_idx").on(t.targetHost),
]);
```

### 2. Update Zod Schemas
Verify that `drizzle-zod` schemas (`createSelectSchema`, `createInsertSchema`) are updated and exported for request validation.

### 3. Generate Migration SQL
Run from repo root:
```bash
bun --filter @doxynix/siem-server db:generate
```
Inspect the newly generated SQL file in `apps/siem-server/src/core/db/migrations/` to verify:
- No accidental table drops.
- Column defaults and nullable constraints match expectations.

### 4. Apply Migration
```bash
bun --filter @doxynix/siem-server db:migrate
```

---

## Verification Checklist
- [ ] Schema in `apps/siem-server/src/core/db/schema.ts` compiles (`bun run type-check`).
- [ ] Migration generated in `apps/siem-server/src/core/db/migrations/`.
- [ ] Primary key uses `uuidv7()`.
- [ ] Zod schema exported and consumed in module router.