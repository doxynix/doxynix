<div align="center">

# 📦 @doxynix/shared

### Universal Domain Models, Zod Schemas & Platform Contracts

**The single source of truth for pure domain logic, scoring algorithms, and data contracts across the Doxynix monorepo.**

[![Language: TypeScript](https://img.shields.io/badge/language-typescript%20strict-24292e?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Validation: Zod](https://img.shields.io/badge/validation-zod%204.4-24292e?style=flat-square&logo=zod)](https://zod.dev/)
[![Linter: Biome](https://img.shields.io/badge/linter-biome-24292e?style=flat-square&logo=biome)](https://biomejs.dev)

[Invariants](#-purpose--invariants) · [Subpath Exports](#-subpath-exports) · [Directory Structure](#-directory-structure) · [Usage](#-usage-examples)

</div>

---

## 🎯 Purpose & Invariants

`@doxynix/shared` provides isomorphic, platform-agnostic types, schemas, and scoring calculation functions for `apps/web`, `packages/cli`, `apps/siem-server`, `apps/siem-client`, and future mobile clients (`apps/mobile`).

> [!IMPORTANT]  
> **Zero Runtime Dependency Rule:** This package must strictly contain **pure TypeScript logic, constants, and Zod schemas**. No React, DOM APIs (`window`/`document`), Node.js built-ins (`fs`/`path`), Prisma, or heavy runtime dependencies are allowed.

---

## 📦 Subpath Exports

Import only the modules you need via modern subpath exports:

| Subpath | Description |
| :--- | :--- |
| `@doxynix/shared` | Master barrel exporting all domain contracts |
| `@doxynix/shared/scoring` | Repository health levels, score thresholds, and formulas |
| `@doxynix/shared/siem` | Threat levels, secret leak findings, and scanner models |
| `@doxynix/shared/pagination` | Universal cursor and offset pagination metadata |
| `@doxynix/shared/auth` | User credential validation and authentication schemas |

---

## 📁 Directory Structure

```
src/
├── auth/                 # Authentication & credential Zod schemas
│   └── auth.schema.ts
├── pagination/           # Shared pagination meta & response wrappers
│   └── pagination.types.ts
├── scoring/              # Platform scoring formulas & health tier calculators
│   ├── scoring.ts
│   └── scoring.types.ts
├── siem/                 # SIEM event, telemetry, and vulnerability types
│   └── siem.types.ts
└── index.ts              # Master contract export barrel
```

---

## 💻 Usage Examples

### 1. Repository Health & Scoring

```typescript
import { getHealthLevel, SCORE_THRESHOLDS } from "@doxynix/shared/scoring";

const health = getHealthLevel(85); // 'healthy'
```

### 2. Authentication Validation

```typescript
import { authSchema, type AuthSchema } from "@doxynix/shared/auth";

const validated = authSchema.parse(payload);
```

### 3. SIEM Severity & Finding Contracts

```typescript
import type { LeakFinding, Severity } from "@doxynix/shared/siem";
```

---

<div align="center">
<sub>Crafted with ❤️ by the Doxynix Engineering Team.</sub>
</div>
