# AGENTS.md — SIEM Project Context & Agent Rules

This repository contains a Security Information and Event Management (SIEM) log intelligence system. It is structured as a monorepo powered by Bun, Hono RPC, Drizzle ORM, React 19, and TanStack Router.

## 🚀 Primary Commands

- Development: `bun run dev` (Launches client & server via Turbo)
- Type Check: `bun run type-check`
- Lint & Format: `bun lint / bun lint:fix`
- Architecture Validation: `bun arch:check`
- Execute DB Migrations: `bun run db:migrate` (via postgres-js)
- Generate DB Migrations: `bun run db:generate` (via Drizzle Kit)

## 🏗️ Architectural Boundaries (STRICT)

1. Client Layer (Feature-Sliced Design):
   - Layer Hierarchy: shared -> entities -> features -> widgets -> routes.
   - Rule: Lower layers MUST NOT import upper layers.
   - Rule: Cross-feature imports (features/A importing features/B) are STRICTLY FORBIDDEN. Features must remain completely isolated.
   - Rule: Client code MUST NOT perform deep imports from the server directory. Client can ONLY import types from server/src/index.ts or @doxynix/siem-shared.

2. Server Layer (Vertical Slice Architecture):
   - Modules located in server/src/modules/<slice> must remain completely isolated from each other.
   - All inbound payloads MUST be validated using Zod schemas (.schema.ts).
   - Routers (.router.ts) MUST be protected with authentication middleware (requireAuth, requireRole).

3. Shared Package (shared/):
   - Must contain pure domain models and types. MUST NOT import any client or server implementation code.

4. Generated Manifests:
   - NEVER edit client/src/routeTree.gen.ts manually. It is generated automatically by TanStack Router Vite plugin.

## 🌿 Git & Workflow Requirements

- Branch Naming: Branch names MUST include the siem prefix (e.g., siem/feat-add-scanner, feat/siem-123-rules).
- Commit Messages: MUST follow the Conventional Commits specification (feat(scope): msg, fix: msg). Subject line max 72 characters, no trailing period.
- Secrets: NEVER commit raw API keys or passwords. Use Doppler environment variables.

## 🛠️ Stack & End-to-End Type Safety

- Server-Client RPC: Endpoints are exposed via Hono (AppType) and consumed using hcWithType in client/src/routes/index.tsx.
- Database: PostgreSQL via Drizzle ORM (server/src/core/db/schema.ts). Primary keys use UUIDv7 (sql`uuidv7()`).