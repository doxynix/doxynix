---
name: architecture
description: Enforces Feature-Sliced Design (FSD) for client apps and Vertical Slice Architecture (VSA) for server apps in Doxynix. Use when adding, moving, refactoring files, or when checking import boundaries, dependency cruiser errors, or Lefthook pre-commit failures.
---

# Architecture Compliance (FSD & VSA)

## Overview
Doxynix strictly isolates layers to prevent cyclic dependencies and spaghetti imports. Violations will fail CI and Lefthook pre-commit hooks.

## The Iron Law
```
IMPORTS FLOW DOWNWARD ONLY. CROSS-FEATURE AND CROSS-SLICE IMPORTS ARE STRICTLY FORBIDDEN.
```

---

## 1. Client Architecture: Feature-Sliced Design (FSD)
Applies to: `apps/siem-client` and `apps/web/src/app` / `entities` / `features` / `widgets`.

### Layer Hierarchy (Top to Bottom):
1. **`app` / `routes`** (Routing, providers, entrypoints)
2. **`widgets`** (Composition of features and entities into complex blocks)
3. **`features`** (User interactions, business actions, form submissions)
4. **`entities`** (Business domain objects: user, incident, repo, audit-log)
5. **`shared`** (UI primitives, low-level hooks, utils, api clients)

### Architectural Rules:
- **Forbidden Cross-Imports**: A feature CANNOT import another feature (`features/scan` cannot import `features/auth`). Move shared logic to `entities/` or `shared/`.
- **Entities Isolation**: An entity CANNOT import from `features`, `widgets`, or `routes`.
- **Public API Boundary**: Always import from the slice index file (`import { useIncident } from '@/entities/incident'`), never deep-import internal files.

### Incorrect vs Correct:
```typescript
// ❌ INCORRECT: Cross-feature import
// In apps/siem-client/src/features/scan/index.tsx
import { AuthForm } from '@/features/auth/auth-form';

// ✅ CORRECT: Compose in a widget or move shared logic down
// In apps/siem-client/src/widgets/scan-widget/index.tsx
import { ScanFeature } from '@/features/scan';
import { AuthForm } from '@/features/auth';
```

---

## 2. Server Architecture: Vertical Slice Architecture (VSA)
Applies to: `apps/siem-server/src/modules`, `apps/web/src/server/modules`, and `packages/cli/src/commands`.

### Architectural Rules:
- **Slice Isolation**: `modules/incidents` MUST NOT import private services or routers from `modules/rules`. Same for CLI command slices (`commands/staging` must not import from `commands/pr`).
- **Core Abstractions**: Only cross-cutting concerns (DB client, redis, bus, auth middleware, CLI `core/`/`ui/`) live outside slices. Everything domain-specific stays inside the slice. CLI `core/`/`ui/` MUST NOT import from command slices.
- **Client-Server Boundary**: Client code MUST NEVER import directly from server internals. Import shared schemas from `@doxynix/shared` or RPC contracts from `@doxynix/siem-server/client`.

---

## 3. Tooling Map

| Place | FSD/VSA methodology lint (warn) | Dependency gate (error + baseline) |
|---|---|---|
| `apps/web` | steiger (`lint:fsd`) | dep-cruiser: VSA server + FSD boundaries + shared-reuse + cycles + orphans |
| `apps/siem-client` | steiger (`lint:fsd`) | dep-cruiser: FSD layer order + cross-feature + shared-reuse + cycles + orphans |
| `apps/siem-server` | — (no FSD) | dep-cruiser: VSA slices + entry-reachability + cycles + orphans |
| `packages/cli` | — (no FSD) | dep-cruiser: VSA command slices + layering + entry-reachability + cycles + orphans |
| `packages/shared`, `packages/config` | — | — (leaf packages: pure types / configs, no meaningful graph) |

- **steiger** = FSD *methodology* (segment structure, public api, naming) — warns, never blocks.
- **dep-cruiser** = generic *graph* gate — hard rules (regex boundaries, cycles, orphans) with a known-violations baseline so WIP doesn't block the gate but new violations fail.
- Both run inside each app's `validate`; a repo-wide quick gate is wired into **Lefthook pre-commit** and the root `arch:check` script.

---

## Verification & Auditing
Before finishing any structural changes, run a dependency audit for the affected app (or the whole repo):

```bash
# Full-repo gate (root script) - also wired into Lefthook pre-commit
bun run arch:check

# Web (Next.js) - dep-cruiser: VSA (src/server/modules), FSD, cycles, orphans
bun --filter @doxynix/web arch:check

# SIEM server - dep-cruiser: VSA (src/modules), cycles, orphans
bun --filter @doxynix/siem-server arch:check

# SIEM client - dep-cruiser: FSD boundaries, cycles, orphans (+ steiger in validate)
bun --filter @doxynix/siem-client arch:check

# CLI - dep-cruiser: VSA for command slices (src/commands), cycles, orphans
bun --filter @doxynix/cli arch:check

# Refresh a known-violations baseline after deliberate changes
bun --filter @doxynix/<app> arch:baseline
```