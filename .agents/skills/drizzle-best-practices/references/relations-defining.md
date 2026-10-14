# Relations: Defining Relations

## Why It Matters

Relations let you describe how tables connect to each other. Once defined, you can use
the relational query API (`db.query`) to fetch nested data without writing manual joins.

**This repo runs `drizzle-orm@0.45.3`, where the only relations API is the `relations()` helper.**
`defineRelations` (RQB v2) is a Drizzle v1 API and does not exist here — importing it is a type
error. Write the form below; the v1 syntax at the end is reference only.

## Defining Relations (`relations()` — 0.45.x, this repo)

```typescript
import { relations } from 'drizzle-orm';
import { integer, pgTable, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: integer().primaryKey(),
  name: text().notNull(),
});

export const posts = pgTable('posts', {
  id: integer().primaryKey(),
  authorId: integer().notNull(),
  title: text().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

**In this repo** the relations live next to the tables in
`apps/siem-server/src/core/db/schema.ts` (`incidentsRelations`, `findingsRelations`, …), and
`src/core/db/db.ts` does:

```typescript
import * as schema from './schema';
import { drizzle } from 'drizzle-orm/node-postgres';

export const db = drizzle(client, { schema });
```

Passing the whole `schema` module is what populates `db.query` on 0.45.x. Do not pass a bare table
list.

**Key points:**

- `one()` needs explicit `fields` / `references`.
- `many()` infers the connection from the other side's `one()` definition.
- Both sides should be defined for full query support.

## Querying with `db.query`

```typescript
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true },
});
// [{ id: 1, name: 'Alice', posts: [{ id: 9, authorId: 1, title: '…' }] }]
```

Filtering in a relational query is a **callback** in 0.45.x, not a plain object:

```typescript
const alice = await db.query.users.findFirst({
  where: (users, { eq }) => eq(users.name, 'Alice'),
  with: { posts: { where: (posts, { gt }) => gt(posts.id, 10) } },
});
```

The same operator functions are imported from `drizzle-orm` and are identical to the ones used in
`db.select().from(...).where(...)`. Never rewrite a `db.select()` filter into the relational syntax —
they are two separate APIs.

## Self-Referencing Relations

```typescript
import { AnyPgColumn } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: integer().primaryKey(),
  name: text().notNull(),
  invitedBy: integer().references((): AnyPgColumn => users.id),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  invitedBy: one(users, {
    fields: [users.invitedBy],
    references: [users.id],
    relationName: 'invitedBy',
  }),
  invitees: many(users, { relationName: 'invitedBy' }),
}));
```

Note the `(): AnyPgColumn =>` return type annotation — this is needed for circular references, and
`relationName` disambiguates the two edges.

## Many-to-Many Relations

Define a `many` to the junction table on both sides, then traverse it explicitly in the query:

```typescript
// Schema — junction table
export const usersToGroups = pgTable(
  'users_to_groups',
  {
    userId: integer('user_id').notNull().references(() => users.id),
    groupId: integer('group_id').notNull().references(() => groups.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })]
);

export const usersRelations = relations(users, ({ many }) => ({
  usersToGroups: many(usersToGroups),
}));

// Query through the junction, mapping the rows out yourself
const usersWithGroups = await db.query.users.findMany({
  with: { usersToGroups: { columns: {}, with: { group: true } } },
});
```

## Incorrect

```typescript
// Forgetting to define the reverse side of a relation
export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));
// Missing: users.posts — users.findMany({ with: { posts: true } }) will not resolve
```

```typescript
// Forgetting the schema when constructing the client: db.query stays empty
const db = drizzle(client); // ❌
const db = drizzle(client, { schema }); // ✅
```

```typescript
// Drizzle v1 syntax — does not exist in 0.45.3
import { defineRelations } from 'drizzle-orm'; // ❌ in this repo
```

## Not used here: Drizzle v1 relations (`defineRelations`)

For reference only. Drizzle v1 RC replaces `relations()` with `defineRelations(schema, r => …)` and
changes relational `where`/`orderBy` from callbacks to plain objects. It is a breaking change that
also alters the migration folder format, and this repo is on 0.45.3 — do not migrate as a side effect
of another task. If a v1 migration is ever approved deliberately, re-read the v1 docs rather than
porting from the snippets above.

## References

- https://orm.drizzle.team/docs/relations
- https://orm.drizzle.team/docs/rqb
- https://orm.drizzle.team/docs/relations-v2 (v1 only)