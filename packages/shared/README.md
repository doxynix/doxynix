<div align="center">

# 📦 @doxynix/shared

### Universal Domain Models, Zod Schemas & Platform Contracts

**The single source of truth for pure domain logic, schemas, and data contracts across the Doxynix monorepo.**

[![Language: TypeScript](https://img.shields.io/badge/language-typescript%20strict-24292e?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Validation: Zod](https://img.shields.io/badge/validation-zod%203.x-24292e?style=flat-square&logo=zod)](https://zod.dev/)
[![Linter: Oxlint](https://img.shields.io/badge/linter-oxlint-24292e?style=flat-square&logo=oxc)](https://oxc.rs)
[![Formatter: Biome](https://img.shields.io/badge/formatter-biome-24292e?style=flat-square&logo=biome)](https://biomejs.dev)

[Invariants](#-purpose--invariants) · [Contracts & Schemas](#-contracts--schemas) · [Directory Structure](#-directory-structure) · [Usage](#-usage-examples)

</div>

---

## 🎯 Purpose & Invariants

`@doxynix/shared` provides isomorphic, platform-agnostic types, schemas, and contracts shared between `apps/web`, `packages/cli`, `apps/siem-server`, and `apps/siem-client`.

> [!IMPORTANT]  
> **Zero Runtime Dependency Rule:** This package must strictly contain **pure TypeScript logic, constants, and Zod schemas**. No React, DOM APIs (`window`/`document`), Node.js built-ins (`fs`/`path`), Prisma, or heavy runtime dependencies are allowed.

---

## 📦 Contracts & Schemas

The package exports shared validation schemas and system enums:

| Module | Exports | Purpose |
| :--- | :--- | :--- |
| `enums` | System & domain enums | Canonical shared statuses, roles, and event categories |
| `schemas/core` | Core platform contracts | Common entity schemas, identifiers, and payload validators |
| `schemas/agent-tools` | Agent tool call schemas | Parameter definitions and contracts for contextual AI agent tools |

---

## 📁 Directory Structure

```
src/
├── enums/                # Platform enums and constant definitions
│   └── index.ts
├── schemas/              # Zod validation schemas
│   ├── agent-tools.schema.ts
│   └── core.schema.ts
└── index.ts              # Master contract export barrel
```

---

## 💻 Usage Examples

### 1. Agent Tool Definitions

```typescript
import { agentToolSchema } from "@doxynix/shared";

const validatedCall = agentToolSchema.parse(payload);
```

### 2. Universal Enums & Types

```typescript
import type { CoreSchemaType } from "@doxynix/shared";
```

---

<div align="center">
<sub>Crafted with ❤️ by the Doxynix Engineering Team.</sub>
</div>
