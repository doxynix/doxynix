# Relations: Querying Related Data

## Why It Matters

The relational query API is one of Drizzle's most powerful features. It lets you fetch
nested data (users with their posts, posts with comments and authors) in a single query
without writing manual joins. But using it effectively requires understanding the options
for filtering, limiting, ordering, and selecting columns.

> **Version note:** This repo runs **`drizzle-orm@0.45.3`**, where relational `where` and `orderBy`
> take **callbacks / operator arrays**. The plain-object syntax (`where: { age: 15 }`,
> `orderBy: { createdAt: 'desc' }`) is **Drizzle v1 only** and does not work here. Everything below
> is the 0.45.x form. Relation definitions are in `relations-defining.md`.

## Basic Relational Queries

### Fetch all with related data

```typescript
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true },
});
// [{ id: 1, name: "Alice", posts: [{ id: 1, title: "Hello", ... }] }]
```

### Find a single record

`findFirst` adds `limit 1` automatically.

```typescript
const user = await db.query.users.findFirst({
  where: (users, { eq }) => eq(users.id, 1),
  with: { posts: true },
});
// { id: 1, name: "Alice", posts: [...] } | undefined
```

## Filtering (`where`)

`where` is a **callback** receiving the table and the operator helpers. Combine conditions with
`and` / `or` / `not`, and drop to raw SQL with `sql` for anything the operators do not cover
(JSONB paths, `BETWEEN`, function calls):

```typescript
await db.query.users.findMany({
  where: (users, { and, eq, gte, like }) =>
    and(eq(users.name, 'John'), gte(users.age, 18), like(users.email, '%@example.com')),
});

await db.query.users.findMany({
  where: (users, { or, gt, like }) =>
    or(gt(users.id, 10), like(users.name, 'John%')),
});

// Raw SQL
await db.query.users.findMany({
  where: (users, { and, sql }) =>
    and(
      sql`${users.preferences}->>'theme' = 'dark'`,
      sql`${users.age} BETWEEN 25 AND 35`
    ),
});
```

Available operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `like`, `ilike`,
`notLike`, `notIlike`, `isNull`, `isNotNull`, `arrayContains`, `arrayContained`, `arrayOverlaps`.

The same operator functions are imported from `drizzle-orm` and are identical to the ones used in
the SQL-like builder `db.select().from(t).where(eq(t.id, 1))`. The two APIs are separate — never
rewrite a `db.select()` filter into the relational form.

To filter parent rows by a condition on a **related** table, nest the relation inside `with` and
filter it there; there is no cross-relation filter in 0.45.x.

## Nested Relations

Nest `with` to fetch deeply related data:

```typescript
const result = await db.query.posts.findMany({
  with: {
    author: true,
    comments: { with: { author: true } },
  },
});
// [{ id: 1, title: "Hello", author: { ... }, comments: [{ content: "...", author: { ... } }] }]
```

## Ordering, Limiting, Paginating

`orderBy` takes an **array of operators**; `limit` and `offset` work at the top level and inside
nested `with`.

```typescript
const user = await db.query.users.findFirst({
  where: (users, { eq }) => eq(users.id, 1),
  with: {
    posts: {
      where: (posts, { eq }) => eq(posts.published, true),
      orderBy: (posts, { desc }) => [desc(posts.createdAt)],
      limit: 10,
      offset: 0,
      with: {
        comments: { limit: 3, orderBy: (comments, { desc }) => [desc(comments.createdAt)] },
      },
    },
  },
});
```

For a raw expression, `orderBy` also accepts a callback returning `sql`:

```typescript
await db.query.posts.findMany({
  orderBy: (posts, { sql }) => sql`${posts.id} asc`,
});
```

## Partial Column Selection

Only fetch the columns you need. Drizzle performs the projection in SQL — no extra data is
transferred.

```typescript
const result = await db.query.users.findMany({
  columns: { id: true, name: true }, // email is NOT fetched
  with: { posts: { columns: { title: true } } },
});
```

You can also exclude specific columns. When both `true` and `false` appear, the `false` entries
are ignored (you've already restricted the set by including).

```typescript
const result = await db.query.users.findMany({
  columns: { password: false }, // fetch everything except password
});
```

## Extras (Computed Fields)

Add computed SQL expressions to relational queries. Aggregations are **not** supported in `extras`
(use the SQL-like builder for `count`/`sum`/etc.), and any `.as('alias')` you add is ignored —
the object key is the alias.

```typescript
const result = await db.query.users.findMany({
  extras: {
    fullName: (users, { sql }) => sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
  },
});
// [{ id: 1, firstName: "Alice", lastName: "Smith", fullName: "Alice Smith" }]
```

## Incorrect Patterns

```typescript
// Wrong: the v1 plain-object filter — unsupported in 0.45.3
await db.query.users.findMany({ where: { age: 15 } }); // ❌

// Right: callback form
await db.query.users.findMany({ where: (users, { eq }) => eq(users.age, 15) }); // ✅

// Wrong: using the relational API for aggregations — it doesn't support COUNT, SUM, etc.
const count = await db.query.users.findMany(); // fetches ALL rows just to count them
// Better:
const [{ count }] = await db
  .select({ count: sql<number>`count(*)`.mapWith(Number) })
  .from(users);

// Wrong: deeply nesting without limits — fetches ALL related data at every level
const result = await db.query.users.findMany({
  with: { posts: { with: { comments: { with: { author: true, likes: true } } } } },
});
// Always add limits when nesting deeply.
```

## Not used here: Drizzle v1 relational queries

v1 replaces the callback `where`/`orderBy` with plain objects and adds cross-relation filters and
`.through()` for many-to-many. That is a different API on a different major line; this repo is not
on it.

## References

- https://orm.drizzle.team/docs/rqb
- https://orm.drizzle.team/docs/relations