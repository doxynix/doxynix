---
name: better-auth-best-practices
description: Configure Better Auth server and client, set up database adapters, manage sessions, add plugins, and handle environment variables. Use when users mention Better Auth, betterauth, auth.ts, or need to set up TypeScript authentication with email/password, OAuth, or plugin configuration.
---

# Better Auth Integration Guide

Better Auth **1.6.30** (root `catalog:`), with `@better-auth/drizzle-adapter` 1.6.30 and
`@better-auth/passkey` 1.6.30. Bun only — never `npm`, `npx`, `pnpm` or `yarn`.

## Documentation Version

Use documentation that matches the Better Auth version installed in the project. APIs and plugin names can differ across maintained release lines.

1. Prefer a version explicitly named by the user.
2. Otherwise, inspect the resolved `better-auth` version in `bun.lock`, falling back to the root
   `catalog:` and the workspace `package.json`.
3. When the Better Auth MCP is available, call `get_doc` with `/llms.txt` to resolve that package version to a documentation identifier. Pass the identifier to every `search_docs` call and pass result paths to `get_doc` unchanged.
4. Without MCP, start at [better-auth.com/llms.txt](https://better-auth.com/llms.txt) and follow the matching version index.
5. Use the latest documentation only when the project version cannot be determined or the user explicitly asks about the latest release or an upgrade.

When planning an upgrade, separate guidance for the currently installed version from guidance for the target version.

---

## The two Better Auth instances in this repo

| | `apps/siem-server` | `apps/web` |
|---|---|---|
| Config | `src/core/auth/auth.ts` | `src/server/core/auth/index.ts` |
| Adapter | `@better-auth/drizzle-adapter` → `drizzleAdapter(db, { provider: "pg", usePlural: true })` | **Custom `DBAdapter`** (`auth-adapter.ts`) over Prisma/ZenStack |
| Schema | Drizzle tables `users`, `sessions`, `accounts`, `verifications` in `src/core/db/schema.ts` | Prisma/ZenStack models |
| Plugins | `twoFactor` | `admin`, `captcha`, `genericOAuth`, `lastLoginMethod`, `magicLink`, `twoFactor`, `passkey` |
| Mounted at | `auth.handler(c.req.raw)` in `src/index.ts` | `toNextJsHandler` in `src/app/api/auth/[...all]/route.ts` |
| Client | — | `createAuthClient` in `src/shared/lib/auth-client.ts` |

**Schema migrations differ per app.** `apps/siem-server` is Drizzle-only — see the
`drizzle-migration` skill. `apps/web` owns its schema through ZenStack/Prisma — see
`zenstack-migration`. Never point the Better Auth CLI at `prisma/schema.prisma` in
`apps/siem-server`, and never hand-edit a generated Drizzle migration.

## Setup Workflow

1. Install with Bun: `bun add better-auth @better-auth/drizzle-adapter`
2. Set env vars: `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`
3. Create the `betterAuth({ ... })` config next to the app's `db` instance
4. Mount the handler (`auth.handler(c.req.raw)` in Hono, `toNextJsHandler` in the App Router)
5. Create/refresh the schema:
   - **`apps/siem-server` (Drizzle):** add the Better Auth tables to `src/core/db/schema.ts`, then
     `bun --filter @doxynix/siem-server db:generate` (drizzle-kit) and `db:migrate`.
     The generated SQL is not hand-editable.
   - **`apps/web` (Prisma/ZenStack):** edit `prisma/models/*.zmodel` and run
     `bun --filter @doxynix/web db:generate`.
6. Verify: call the ok-health route — should return `{ status: "ok" }`

If you need the Better Auth CLI, run it through `bun x auth@latest ...` — `bun x` requires shell
approval in this session.

---

## Quick Reference

### Environment Variables
- `BETTER_AUTH_SECRET` - Encryption secret (min 32 chars). Generate: `openssl rand -base64 32`
- `BETTER_AUTH_URL` - Base URL (e.g., `https://example.com`)

In this repo both are read through validated env modules (`@/core/env` in siem-server,
`@/shared/config/env.server` in apps/web) — never read `process.env` directly.

Only define `baseURL`/`secret` in config if env vars are NOT set.

### File Location
The Better Auth CLI looks for `auth.ts` in `./`, `./lib`, `./utils`, or under `./src`. Use `--config` for custom path.

### CLI Commands
- `bun x auth@latest generate` - Generate the schema for the configured adapter
- `bun x auth@latest mcp` - Add MCP to AI tools

**Re-run after adding/changing plugins**, then regenerate the Drizzle/Prisma schema and migrate.

---

## Core Config Options

| Option | Notes |
|--------|-------|
| `appName` | Optional display name |
| `baseURL` | Only if `BETTER_AUTH_URL` not set |
| `basePath` | Default `/api/auth`. Set `/` for root. |
| `secret` | Only if `BETTER_AUTH_SECRET` not set |
| `database` | Required for most features. See adapters docs. |
| `secondaryStorage` | Redis/KV for sessions & rate limits |
| `emailAndPassword` | `{ enabled: true }` to activate |
| `socialProviders` | `{ google: { clientId, clientSecret }, ... }` |
| `plugins` | Array of plugins |
| `trustedOrigins` | CSRF whitelist |

---

## Database

**This repo: Drizzle in `apps/siem-server`, a custom Prisma-backed `DBAdapter` in `apps/web`.**

- `apps/siem-server` imports `drizzleAdapter` from **`@better-auth/drizzle-adapter`** (a separate
  package), not from `better-auth/adapters/drizzle`:
  ```ts
  import { drizzleAdapter } from "@better-auth/drizzle-adapter";
  database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
  ```
  The tables (`users`, `sessions`, `accounts`, `verifications`) live in
  `apps/siem-server/src/core/db/schema.ts` with `usePlural: true` matching the plural table names.
- `apps/web` passes a hand-written `DBAdapter` (see `src/server/core/auth/auth-adapter.ts`) that
  hashes `email`, `identifier`, `token` and `value` into `*Hash` columns before hitting Prisma.
  Changing a Better Auth field there means updating `HASH_FIELD_MAP` too.

**Direct connections:** `pg.Pool`, `mysql2` pool, `better-sqlite3`, or `bun:sqlite`. For Postgres also
`postgres` (postgres.js) and `@neondatabase/serverless`.

**Drizzle provider values:** `"pg"`, `"mysql"`, `"sqlite"` — must match the driver used.

**Critical:** Better Auth uses adapter **model names**, not table names. With `usePlural: true` the
adapter maps model `user` → table `users`; without it, expect a runtime "table not found".

---

## Session Management

**Storage priority:**
1. If `secondaryStorage` defined → sessions go there (not DB)
2. Set `session.storeSessionInDatabase: true` to also persist to DB
3. No database + `cookieCache` → fully stateless mode

**Cookie cache strategies:**
- `compact` (default) - Base64url + HMAC. Smallest.
- `jwt` - Standard JWT. Readable but signed.
- `jwe` - Encrypted. Maximum security.

**Key options:** `session.expiresIn` (default 7 days), `session.updateAge` (refresh interval), `session.cookieCache.maxAge`, `session.cookieCache.version` (change to invalidate all sessions).

---

## User & Account Config

**User:** `user.modelName`, `user.fields` (column mapping), `user.additionalFields`, `user.changeEmail.enabled` (disabled by default), `user.deleteUser.enabled` (disabled by default).

**Account:** `account.modelName`, `account.accountLinking.enabled`, `account.storeAccountCookie` (for stateless OAuth).

**Required for registration:** `email` and `name` fields.

---

## Email Flows

- `emailVerification.sendVerificationEmail` - Must be defined for verification to work
- `emailVerification.sendOnSignUp` / `sendOnSignIn` - Auto-send triggers
- `emailAndPassword.sendResetPassword` - Password reset email handler

---

## Security

**In `advanced`:**
- `useSecureCookies` - Force HTTPS cookies
- `disableCSRFCheck` - ⚠️ Security risk
- `disableOriginCheck` - ⚠️ Security risk  
- `crossSubDomainCookies.enabled` - Share cookies across subdomains
- `ipAddress.ipAddressHeaders` - Custom IP headers for proxies
- `database.generateId` - Custom ID generation or `"serial"`/`"uuid"`/`false`

**Rate limiting:** `rateLimit.enabled`, `rateLimit.window`, `rateLimit.max`, `rateLimit.storage` ("memory" | "database" | "secondary-storage").

---

## Hooks

**Endpoint hooks:** `hooks.before` / `hooks.after` - Array of `{ matcher, handler }`. Use `createAuthMiddleware`. Access `ctx.path`, `ctx.context.returned` (after), `ctx.context.session`.

**Database hooks:** `databaseHooks.user.create.before/after`, same for `session`, `account`. Useful for adding default values or post-creation actions.

**Hook context (`ctx.context`):** `session`, `secret`, `authCookies`, `password.hash()`/`verify()`, `adapter`, `internalAdapter`, `generateId()`, `tables`, `baseURL`.

---

## Plugins

Both configs import from `better-auth/plugins` (the barrel) — that is what the repo does today, so
follow it rather than switching to per-plugin paths mid-task:

```ts
import { twoFactor } from "better-auth/plugins";
```

**In use:** `twoFactor` (siem-server); `admin`, `captcha`, `genericOAuth`, `lastLoginMethod`,
`magicLink`, `twoFactor`, plus `passkey` from the separate `@better-auth/passkey` package (apps/web).

**Popular plugins:** `twoFactor`, `organization`, `passkey`, `magicLink`, `emailOtp`, `username`,
`phoneNumber`, `admin`, `apiKey`, `bearer`, `jwt`, `multiSession`, `sso`, `oauthProvider`,
`oidcProvider`, `openAPI`, `genericOAuth`.

Client plugins go in `createAuthClient({ plugins: [...] })` and live in
`apps/web/src/shared/lib/auth-client.ts` — the client plugin set must mirror the server's.

---

## Client

`apps/web` uses `createAuthClient` from **`better-auth/react`** in
`src/shared/lib/auth-client.ts`, typed against the server instance with
`inferAdditionalFields<typeof auth>()`.

Key methods: `signUp.email()`, `signIn.email()`, `signIn.social()`, `signOut()`, `useSession()`,
`getSession()`, `revokeSession()`, `revokeSessions()`.

---

## Type Safety

Infer types: `typeof auth.$Infer.Session`, `typeof auth.$Infer.Session.user`.

`apps/web` derives them from the client: `NonNullable<typeof authClient.$Infer.Session>` →
`Session`, `Session["user"]` → `User`. See the exports at the bottom of `auth-client.ts`.

---

## Common Gotchas

1. **Model vs table name** — the adapter maps model `user` → table `users` only when `usePlural: true`
2. **Plugin schema** — re-run the schema generation after adding a plugin, then migrate
3. **Secondary storage** — sessions go there by default, not the DB
4. **Cookie cache** — custom session fields are NOT cached and are always re-fetched
5. **Stateless mode** — no DB means the session lives only in the cookie
6. **Change email flow** — sends to the current email first, then the new one
7. **Drizzle: db not initialized** — `drizzleAdapter(db, ...)` needs a real `drizzle()` instance from
   `src/core/db/db.ts`
8. **Drizzle migrations** — run `bun --filter @doxynix/siem-server db:generate`; never hand-edit the
   generated SQL (see the `drizzle-migration` skill)
9. **Hashed columns in `apps/web`** — the custom adapter stores `emailHash` / `identifierHash` /
   `tokenHash` / `valueHash`, so plain equality queries on those columns will not match

---

## Resources

- [Docs](https://better-auth.com/docs)
- [Options Reference](https://better-auth.com/docs/reference/options)
- [LLMs.txt](https://better-auth.com/llms.txt)
- [GitHub](https://github.com/better-auth/better-auth)
- [Init Options Source](https://github.com/better-auth/better-auth/blob/main/packages/core/src/types/init-options.ts)
