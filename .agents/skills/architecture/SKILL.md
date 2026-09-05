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
Applies to: `apps/siem-server/src/modules` and `apps/web/src/server/modules`.

### Architectural Rules:
- **Slice Isolation**: `modules/incidents` MUST NOT import private services or routers from `modules/rules`.
- **Core Abstractions**: Only cross-cutting concerns (DB client, redis, bus, auth middleware) live in `core/`. Everything domain-specific stays inside the slice.
- **Client-Server Boundary**: Client code MUST NEVER import directly from server internals. Import shared schemas from `@doxynix/shared` or RPC contracts from `@doxynix/siem-server/client`.

---

## Verification & Auditing
Before finishing any structural changes, run:

```bash
# Verify specific modified file
bun scripts/arch-check.ts <path_to_file>

# Run full repository dependency audit
bun run arch:check
```