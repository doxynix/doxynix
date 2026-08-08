---
name: db-migration
description: Workflow for modifying Drizzle ORM PostgreSQL database schemas, generating migrations, and applying them safely.
---

# Database Migration Workflow (Drizzle ORM)

All database structural changes must be accompanied by a valid SQL migration file.

## Execution Steps:

1. Modify Schema:
   - Edit server/src/core/db/schema.ts.
   - Primary keys MUST use uuid("id").primaryKey().default(sql`uuidv7()`).
   - Declare custom enums via pgEnum.
   - Add necessary indexes within the pgTable callback array.

2. Verify Zod Schemas:
   - Verify drizzle-zod schemas (createSelectSchema, createInsertSchema) reflect schema updates.

3. Generate Migration SQL:
   - Run: `bun run db:generate`
   - Inspect generated SQL file in server/src/core/db/migrations/.

4. Review & Apply Migration:
   - Verify SQL contains no unintended destructive statements.
   - Apply migration: `bun run db:migrate`