<div align="center">

# 🛠️ @doxynix/config

### Shared Tooling & Compiler Configurations

**Centralized presets for TypeScript across the Doxynix monorepo workspaces.**

[![TypeScript: Strict](https://img.shields.io/badge/typescript-strict%20configs-24292e?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Linter: Oxlint](https://img.shields.io/badge/linter-oxlint-24292e?style=flat-square&logo=oxc)](https://oxc.rs)
[![Formatter: Biome](https://img.shields.io/badge/formatter-biome-24292e?style=flat-square&logo=biome)](https://biomejs.dev)

[Presets](#-available-presets) · [Extending Configs](#-how-to-extend)

</div>

---

## 📦 Available Presets

| Preset | Target Workspace | Purpose |
| :--- | :--- | :--- |
| `base.json` | Global / Base | Base strict TypeScript compiler options (`noImplicitAny`, `strictNullChecks`) |
| `nextjs.json` | `apps/web` | Extended TSConfig optimized for Next.js 16 App Router |
| `hono.json` | `apps/siem-server` | TSConfig preset for Hono Bun / Node backend services |
| `siem-client.json` | `apps/siem-client` | TSConfig preset for Vite + React 19 SPA bundling |
| `node.json` | `packages/cli` | TSConfig preset for standalone Node.js and CLI tools |
| `depcruise-base.json` | Global / Base | Shared dependency-cruiser "health" rules + options (extended by each workspace) |

> [!NOTE]  
>
> * **Linter:** Linting rules are defined using **Oxlint** (`.oxlintrc.json`).
> * **Formatter:** The formatting and sorting of imports are configured centrally in the root `biome.json` file.

---

## 💻 How to Extend

### Extending TypeScript Configs

In your workspace `tsconfig.json`:

```json
{
  "extends": "@doxynix/config/nextjs.json",
  "compilerOptions": {
    "baseUrl": "."
  }
}
```

### Extending Dependency Cruiser Configs

In your workspace `.dependency-cruiser.ts`:

```ts
import type { IConfiguration } from "dependency-cruiser";

const config: IConfiguration = {
  extends: "@doxynix/config/depcruise-base.json",
  // Only add app-specific rules here (no-orphans exceptions, VSA/FSD);
  // all "health" rules live in the base.
  forbidden: [],
};

module.exports = config;
```

---

<div align="center">
<sub>Crafted with ❤️ by the Doxynix Engineering Team.</sub>
</div>
