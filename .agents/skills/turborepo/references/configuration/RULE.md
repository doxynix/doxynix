# turbo.json Configuration Overview

Configuration reference for Turborepo. Full docs: https://turborepo.dev/docs/reference/configuration

## File Location

Root `turbo.json` lives at repo root, sibling to root `package.json`:

```
my-monorepo/
├── turbo.json        # Root configuration
├── package.json
└── packages/
    └── web/
        ├── turbo.json  # Package Configuration (optional)
        └── package.json
```

## Always Prefer Package Tasks Over Root Tasks

**Always use package tasks. Only use Root Tasks if you cannot succeed with package tasks.**

Package tasks enable parallelization, individual caching, and filtering. Define scripts in each package's `package.json`:

```jsonc
// apps/web/package.json
{
  "scripts": {
    "build": "next build",
    "lint": "oxlint",
    "format": "biome check --write .",
    "test": "vitest",
    "type-check": "tsc --noEmit"
  }
}

// apps/siem-server/package.json
{
  "scripts": {
    "build": "tsc",
    "lint": "oxlint",
    "format": "biome check --write .",
    "type-check": "tsc -b"
  }
}
```

```jsonc
// Root package.json - delegates to turbo
{
  "scripts": {
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "type-check": "turbo type-check"
  }
}
```

When you run `turbo lint`, Turborepo finds every workspace with a `lint` script and runs them
**in parallel**.

**Root Tasks are a fallback**, not the default. Only use them for tasks that truly cannot run per-package (e.g., repo-level CI scripts, workspace-wide config generation).

```jsonc
// AVOID: Task logic in root defeats parallelization
{
  "scripts": {
    "lint": "cd apps/web && oxlint && cd ../../apps/siem-server && oxlint"
  }
}
```

## Basic Structure

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["CI"],
  "globalDependencies": ["tsconfig.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

The `$schema` key enables IDE autocompletion and validation.

### With `futureFlags.globalConfiguration`

When the `globalConfiguration` future flag is enabled, global options move under a `global` key with cleaner names:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "futureFlags": { "globalConfiguration": true },
  "global": {
    "inputs": ["tsconfig.json"],
    "env": ["CI"],
    "ui": "tui"
  },
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

See the [global options reference](./global-options.md) for the full rename mapping and behavior changes.

## Configuration Sections

**Global options** - Settings affecting all tasks:

- Without flag: `globalEnv`, `globalDependencies`, `globalPassThroughEnv`, `cacheDir`, `daemon`, `envMode`, `ui`, `remoteCache`
- With `globalConfiguration` flag: all of the above move under the `global` key (see [global options](./global-options.md))

**Task definitions** - Per-task settings in `tasks` object:

- `dependsOn`, `outputs`, `inputs`, `env`
- `cache`, `persistent`, `interactive`, `outputLogs`

## Package Configurations

Use `turbo.json` in individual packages to override root settings:

```json
// packages/web/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "outputs": [".next/**", "!.next/cache/**", "!.next/dev/**"]
    }
  }
}
```

The `"extends": ["//"]` is required - it references the root configuration.

**When to use Package Configurations:**

- Framework-specific outputs (Next.js, Vite, etc.)
- Package-specific env vars
- Different caching rules for specific packages
- Keeping framework config close to the framework code

### Extending from Other Packages

You can extend from config packages instead of just root:

```json
// packages/web/turbo.json
{
  "extends": ["//", "@doxynix/turbo-config"]
}
```

### Adding to Inherited Arrays with `$TURBO_EXTENDS$`

By default, array fields in Package Configurations **replace** root values. Use `$TURBO_EXTENDS$` to **append** instead:

```json
// Root turbo.json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"]
    }
  }
}
```

```json
// packages/web/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      // Inherits "dist/**" from root, adds ".next/**"
      "outputs": [
        "$TURBO_EXTENDS$",
        ".next/**",
        "!.next/cache/**",
        "!.next/dev/**"
      ]
    }
  }
}
```

Without `$TURBO_EXTENDS$`, outputs would only be `[".next/**", "!.next/cache/**", "!.next/dev/**"]`.

**Works with:**

- `dependsOn`
- `env`
- `inputs`
- `outputs`
- `passThroughEnv`
- `with`

### Excluding Tasks from Packages

Use `extends: false` to exclude a task from a package:

```json
// packages/ui/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "e2e": {
      "extends": false // UI package doesn't have e2e tests
    }
  }
}
```

## `turbo.jsonc` for Comments

Use `turbo.jsonc` extension to add comments with IDE support:

```jsonc
// turbo.jsonc
{
  "tasks": {
    "build": {
      // Next.js outputs
      "outputs": [".next/**", "!.next/cache/**", "!.next/dev/**"]
    }
  }
}
```
