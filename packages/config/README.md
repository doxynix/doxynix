<div align="center">

# 🛠️ @doxynix/config

### Shared Tooling & Compiler Configurations

**Centralized presets for TypeScript, Biome, and build tooling across the Doxynix monorepo.**

[![Linter: Biome](https://img.shields.io/badge/linter-biome%202.5-24292e?style=flat-square&logo=biome)](https://biomejs.dev)
[![TypeScript: Strict](https://img.shields.io/badge/typescript-strict%20configs-24292e?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

[Presets](#-available-presets) · [Extending Configs](#-how-to-extend)

</div>

---

## 📦 Available Presets

| Preset | Target Workspace | Purpose |
| :--- | :--- | :--- |
| `base.json` | Global | Base strict TypeScript compiler options (`noImplicitAny`, `strictNullChecks`) |
| `nextjs.json` | `apps/web` | Extended TSConfig optimized for Next.js 16 App Router |
| `hono.json` | `apps/siem-server` | TSConfig preset for Hono Bun / Node backend services |
| `siem-client.json` | `apps/siem-client` | TSConfig preset for Vite + React 19 SPA bundling |
| `node.json` | `packages/cli` | TSConfig preset for standalone Node.js and CLI tools |
| `biome.json` | Monorepo Root | Master Biome linter, formatter, and import sorting configuration |

---

## 💻 How to Extend

### Extending TypeScript Configs

```json
{
  "extends": "@doxynix/config/nextjs.json",
  "compilerOptions": {
    "baseUrl": "."
  }
}
```

### Extending Biome Config

```json
{
  "extends": ["@doxynix/config/biome.json"]
}
```

---

<div align="center">
<sub>Crafted with ❤️ by the Doxynix Engineering Team.</sub>
</div>
