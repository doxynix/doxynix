# AGENTS.md — Doxynix Monorepo Context & Rules

Welcome to the **Doxynix Monorepo**. This codebase is managed via **Bun**, **Turborepo**, and **TypeScript (Strict)**.

---

## 🌐 Global Monorepo Rules (Applies to ALL Code)

### 1. Package Manager & Runtimes

- **Package Manager**: **Bun ONLY** (`bun install`, `bun run`, `bun x turbo run`). NEVER use `pnpm`, `npm`, or `yarn`.
- **Global Scripts**:
  - Development: `bun run dev` (Runs Turbo across all apps)
  - Type Check: `bun run type-check` (Turbo typecheck across apps/packages)
  - Lint & Validate: `bun run lint` / `bun run validate`
  - Secret Scanning: `bun run secretlint`

### 2. Architectural Boundaries & Imports

- **Apps Isolation**: Code inside `apps/*` MUST NEVER directly import code from other `apps/*` (e.g., `apps/web` cannot import from `apps/siem-server`).
- **Shared Packages**: Apps MUST import shared domain code, schemas, and utils ONLY from `@doxynix/packages/*` using workspace protocol (`workspace:*`).
- **Import Rules**:
  - **Path operations**: Use `pathe` for ALL path manipulations (`join`, `resolve`, `normalize`). NO `node:path`.
  - **Utilities**: Use `es-toolkit` for array/object manipulation (`uniq`, `compact`, `groupBy`). Avoid manual loops.
  - **File discovery**: Use `fast-glob` for file searches.

### 3. Git Protocol

- **Conventional Commits**: Format `feat(scope): msg`, `fix(scope): msg`, `refactor(scope): msg`. Max 72 chars subject.
- **Branch Naming**: Include app or issue scope (e.g., `web/feat-pr-analysis`, `siem/fix-ingestion`).
- **Secrets**: NEVER commit raw API keys. Use environment variables and Doppler.

---

## 🎯 App Scope 1: Web Platform (`apps/web`)

**Role**: AI-powered repository analysis, automatic PR generation, interactive documentation, and developer platform.

### Stack & Technologies

- **Framework**: Next.js 15 (App Router) + TypeScript
- **API Layer**: tRPC + REST
- **Database**: PostgreSQL 17 + Prisma ORM + ZenStack (`schema.zmodel`)
- **Background Tasks**: Trigger.dev (long-running analysis jobs)
- **GitHub Integration**: Octokit, GitHub App webhooks
- **Architecture**: Feature-Sliced Design (FSD - strictly enforced on both Client and Server modules)

### Strict Guidelines for `apps/web`

1. **Type Safety**: Zero `any`. All schemas generated via ZenStack/Zod.
2. **File Budget**: Max 400 lines per file (SRP). Break down large modules.
3. **PR Analysis Logic**: When detecting code issues, always generate diffs and actionable PR fixes.
4. **Graph Synergy**: Every dependency graph node must anchor to a specific documentation section.

---

## 🎯 App Scope 2: SIEM Server (`apps/siem-server`)

**Role**: High-throughput log intelligence, event ingestion worker, and security anomaly detection system.

### Stack & Technologies

- **Framework**: Hono (Node.js/Bun) with End-to-End RPC (`AppType`)
- **Database**: PostgreSQL + Drizzle ORM (`server/src/core/db/schema.ts`)
- **Primary Keys**: UUIDv7 (`sql`uuidv7()``)
- **Architecture**: **Vertical Slice Architecture** (`src/modules/<slice>`)

### Strict Guidelines for `apps/siem-server`

1. **Slice Isolation**: Modules inside `src/modules/<slice>` must be completely self-contained. Do not leak internal module logic into other slices.
2. **Input Validation**: Every inbound request/payload MUST be validated using a Zod schema (`.schema.ts`).
3. **Authentication**: Routers (`.router.ts`) MUST apply `requireAuth` / `requireRole` middleware.
4. **Database Executions**: Use Drizzle Kit for migrations (`bun --filter @doxynix/siem-server db:migrate`).

---

## 🎯 App Scope 3: SIEM Client (`apps/siem-client`)

**Role**: Real-time security incident dashboard and log streaming interface.

### Stack & Technologies

- **Framework**: Vite + React 19 + TypeScript
- **Routing**: TanStack Router (File-based routing)
- **RPC Client**: Hono RPC Client (`hcWithType` from `@doxynix/siem-server`)
- **Architecture**: Feature-Sliced Design (FSD: `shared` -> `entities` -> `features` -> `widgets` -> `routes`)

### Strict Guidelines for `apps/siem-client`

1. **FSD Imports**: Imports MUST flow downwards ONLY (`routes` -> `widgets` -> `features` -> `entities` -> `shared`). Cross-feature imports are FORBIDDEN.
2. **Generated Route Tree**: NEVER manually edit `src/routeTree.gen.ts`. It is managed by TanStack Router Vite plugin.
3. **Type Import Only**: Client can ONLY import types from `@doxynix/siem-shared` or `AppType` from `siem-server`. Deep imports from server files are forbidden.

---

## 📦 Scope 4: Shared Packages (`packages/*`)

- **`packages/siem-shared`**: Pure domain types, Zod schemas, and auth contracts shared between `siem-server` and `siem-client`. NO runtime server/client dependencies allowed.
- **`packages/config`**: Base configuration files for TypeScript (`tsconfig.json`), Biome (`biome.json`), and ESLint.
- **`packages/cli`**: Doxynix Command Line Interface tool.