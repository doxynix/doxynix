---
name: drizzle-best-practices
description: |
  Use this skill whenever the user is working with Drizzle ORM on PostgreSQL. This covers any mention of Drizzle, drizzle-orm, drizzle-kit, drizzle-zod, `pgTable`, `relations()`, `db.select()`, `db.query`, or insert/update/delete against Postgres.

  Typical intents to trigger on:
  - Designing or debugging Postgres table schemas, columns, UUID PKs, enums, JSONB, arrays
  - Modeling one-to-many or many-to-many relations and join tables in Drizzle
  - Writing, optimizing, or preparing Drizzle queries (placeholders, `.prepare()`)
  - Generating Zod validators from Drizzle tables
  - Setting up TypeScript + Postgres projects (Neon, Supabase, postgres.js, node-postgres) with Drizzle
  - Migrating from Prisma, TypeORM, or Sequelize **to Drizzle**
  - Resolving Drizzle type errors

  Do NOT trigger for Drizzle with MySQL/SQLite, raw SQL without an ORM, or other ORMs when Drizzle is not the target.
---

# Drizzle ORM Best Practices (PostgreSQL)

Comprehensive best practices guide for Drizzle ORM with PostgreSQL. Contains guidance across
8 categories, prioritized by impact to help you write correct, performant, and maintainable
database code.

## Version & API Detection (read this first)

**In this repo the answer is fixed: Drizzle `0.45.3` + `drizzle-kit` `0.31.11` +
`drizzle-zod` `0.8.3`, in `apps/siem-server`.** Write 0.45.x code and never upgrade to v1 as a
side effect of another task.

| Installed `drizzle-orm` | API to use | How to install |
|---|---|---|
| **`0.45.x` (this repo)** | **The default.** `relations()` from `drizzle-orm`, callback/operator `db.query`, validators from the separate `drizzle-zod` package, `drizzle-kit` `0.31.x` migration folders | already installed — do nothing |
| `^1.0.0-rc` / `^1.0.0-beta` | Not used here. `defineRelations`, object-syntax relational queries (`where: { … }`, `orderBy: { … }`), validators from `drizzle-orm/zod`, and a new migration folder format | `bun add drizzle-orm@rc && bun add -d drizzle-kit@rc` — only after an explicit decision to migrate |

Things that routinely trip up agents here:

- **`defineRelations` does not exist in `0.45.3`.** `apps/siem-server/node_modules/drizzle-orm`
  ships only `relations` (plus the core builder). Importing `defineRelations` is a type error.
  Relation definitions live in `src/core/db/schema.ts` as `relations(t, ({ one, many }) => …)`,
  exported next to the tables, and `src/core/db/db.ts` passes the whole `schema` module to
  `drizzle(client, { schema })` — that is what populates `db.query`.
- **Validators come from `drizzle-zod`, not `drizzle-orm/zod`.** `drizzle-orm@0.45.3` exports no
  `/zod` subpath. Import `createInsertSchema` / `createSelectSchema` from `drizzle-zod`.
- **Do not upgrade Drizzle opportunistically.** v1 is a breaking migration of the relations API
  *and* the migration folder format; it is not a drop-in. Never emit v1 syntax here.

Where a reference file shows both, the **0.45.x** form is the correct one for this repo and is
marked as the default; v1 forms appear only as clearly labelled forward-looking notes.

## When to Apply

Reference these guidelines when:

- Defining table schemas with `pgTable`
- Writing select, insert, update, or delete queries
- Setting up relations between tables with `relations()` (0.45.x, this repo)
- Configuring `drizzle-kit` for migrations (`generate`, `push`, `pull`)
- Inferring TypeScript types from your schema
- Choosing between the SQL-like API and the relational query API
- Optimizing query performance with prepared statements or batch operations
- Integrating Drizzle with serverless Postgres providers (Neon, Supabase, etc.)

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Schema Design | CRITICAL | `schema-` |
| 2 | Query Patterns | CRITICAL | `query-` |
| 3 | Relations | HIGH | `relations-` |
| 4 | Migrations | HIGH | `migrations-` |
| 5 | Type Safety | MEDIUM-HIGH | `types-` |
| 6 | Performance | MEDIUM | `perf-` |
| 7 | Database Drivers | MEDIUM | `driver-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

## How to Use

Read individual reference files for detailed explanations and code examples:

```
references/engine-postgres.md          # Postgres-specific types, features, and patterns
references/schema-table-definitions.md
references/query-select-patterns.md
references/relations-defining.md
references/_sections.md                # Full index of all references
```

Each reference file contains:

- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Links to official Drizzle documentation

## References

- https://orm.drizzle.team/docs/overview
- https://orm.drizzle.team/docs/sql-schema-declaration
- https://orm.drizzle.team/docs/relations-v2
- https://orm.drizzle.team/docs/perf-queries
- https://orm.drizzle.team/docs/kit-overview
- https://orm.drizzle.team/llms.txt
