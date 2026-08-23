<div align="center">

# 📦 @doxynix/siem-shared

### Domain Types, Zod Schemas & SIEM Protocol Contracts

**The single source of truth for contracts shared between SIEM server and client workspaces.**

[![Language: TypeScript](https://img.shields.io/badge/language-typescript%20strict-24292e?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Validation: Zod](https://img.shields.io/badge/validation-zod%204.4-24292e?style=flat-square&logo=zod)](https://zod.dev/)
[![Linter: Biome](https://img.shields.io/badge/linter-biome-24292e?style=flat-square&logo=biome)](https://biomejs.dev)

[Invariants](#-purpose--invariants) · [Structure](#-directory-structure) · [Usage](#-usage-examples)

</div>

---

## 🎯 Purpose & Invariants

`packages/siem-shared` guarantees data consistency across `apps/siem-server` and `apps/siem-client` without introducing circular workspace dependencies.

> [!WARNING]  
> **Zero Runtime Dependency Rule:** This package must contain **only pure types, constants, and Zod schemas**. No DOM, React, Node.js, database, or network runtime dependencies are permitted.

---

## 📁 Directory Structure

```
src/
├── schemas/              # Zod validation schemas
│   └── auth.schema.ts    # Authentication & credential input validation
├── types/                # Pure TypeScript domain interfaces
│   └── index.ts          # Incident, telemetry, and threat model types
└── index.ts              # Master contract export barrel
```

---

## 💻 Usage Examples

```typescript
// Importing validation schemas
import { authSchema, type AuthCredentials } from "@doxynix/siem-shared";

// Using schemas in Hono or React Hook Form resolvers
const validatedInput = authSchema.parse(payload);
```

---

<div align="center">
<sub>Crafted with ❤️ by the Doxynix Engineering Team.</sub>
</div>
