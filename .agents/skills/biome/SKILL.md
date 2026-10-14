---
name: biome
description: Biome 2.5.14 in this repo — formatter and assist actions only; Oxlint is the linter. Covers biome.json structure (`assist.actions.source.organizeImports`, `files.includes`), the import group order Biome enforces on write, what it will silently rewrite, and the `format` / `format:check` scripts. Use when editing biome.json, fighting an import-order or sorted-keys diff, or deciding whether a rule belongs in Biome or Oxlint.
---

# Biome

Biome **2.5.14**, configured once at the repo root. It is the **formatter and assist engine**.
**Oxlint is the linter.** Biome's `linter` block is deliberately almost empty — do not add lint
rules there; add them to `.oxlintrc.json` instead.

ESLint and Prettier are banned repo-wide. See `.agents/skills/turborepo/` for the full tool table.

## Division of labour

| Job | Tool | Config |
| --- | --- | --- |
| Formatting | Biome | `biome.json` |
| Import order, sorted keys/props/enums | Biome **assist** | `biome.json` → `assist.actions.source` |
| Linting (correctness, type-aware) | Oxlint + `oxlint-tsgolint` | `.oxlintrc.json` |
| FSD boundaries (client) | steiger | `apps/web` `lint:fsd` |
| Architecture boundaries | dependency-cruiser | `bun run arch:check` |

## Scripts

Root `package.json`:

```bash
bun run format        # turbo format  -> biome check --write .
bun run format:check  # biome check .
```

Per workspace (`apps/web`, `apps/siem-server`, …):

```jsonc
"format": "biome check --write .",
"format:check": "biome check .",
"lint": "oxlint",
"lint:fix": "oxlint --fix"
```

`biome check` runs formatter, linter and assists together. Do not reach for `biome format` or
`biome lint` separately — `check` is what the scripts and the CI jobs call.

Lefthook pre-commit runs Biome on staged files only:

```yaml
- name: biome-format-and-check
  glob: "**/*.{js,jsx,ts,tsx,json,jsonc,css,md,mdx}"
  run: bunx @biomejs/biome check --write --no-errors-on-unmatched {staged_files}
  stage_fixed: true
```

`--no-errors-on-unmatched` stops the hook failing on a commit that stages no matching file;
`stage_fixed: true` re-stages what Biome rewrote.

## Biome 2.x config shape

Three things differ from Biome 1.x and are the usual source of stale advice:

1. **Import organisation lives under `assist.actions.source.organizeImports`.** There is no
   top-level `organizeImports` block.
2. **File selection is `files.includes`, not `files.ignore`.** Exclusions use the `!!` prefix
   inside `includes`.
3. **The `--organize-imports-enabled` CLI flag is gone.** Organising imports is part of
   `biome check`; there is no flag to toggle.

Likewise, `noNonNullAssertion` moved from the `style` group to **`suspicious`** in Biome 2.

The repo's actual configuration:

```jsonc
{
  "assist": {
    "actions": {
      "source": {
        "noDuplicateClasses": "on",
        "organizeImports": { "level": "on", "options": { "groups": [ /* see below */ ] } },
        "useSortedAttributes": "on",
        "useSortedEnumMembers": "on",
        "useSortedKeys": "on",
        "useSortedPackageJson": "on",
        "useSortedProperties": "on"
      }
    },
    "enabled": true
  },
  "files": {
    "includes": [
      "**",
      "!!**/node_modules",
      "!!**/.next",
      "!!**/dist",
      "!!**/.turbo",
      "!!**/drizzle",
      "!!**/prisma/generated",
      "!!**/bun.lock",
      "!!**/.agents"
    ]
  },
  "formatter": { "indentWidth": 2, "lineWidth": 100, "lineEnding": "lf", "useEditorconfig": true },
  "javascript": {
    "formatter": {
      "quoteStyle": "double", "semicolons": "always", "trailingCommas": "all",
      "jsxQuoteStyle": "double", "arrowParentheses": "always"
    }
  },
  "json": { "formatter": { "trailingCommas": "none" } },
  "linter": {
    "enabled": true,
    "rules": { "preset": "none", "style": { "useImportType": { "level": "error" } } }
  },
  "vcs": { "enabled": false }
}
```

`"preset": "none"` means: no recommended rule set, one hand-picked rule. Adding a Biome lint rule is
a deliberate decision, not a flip of `"recommended": true`.

`overrides` uses `includes` too:

```jsonc
"overrides": [
  {
    "includes": ["**/package.json"],
    "assist": { "actions": { "source": { "useSortedKeys": "off" } } }
  }
]
```

## Import group order

Biome rewrites your imports on every `check --write`. The order is:

1. `bun` / `node` builtins
2. blank line
3. `react`, `react/**`, `react-dom`, `react-dom/**`
4. `next`, `next/**`
5. `hono`, `hono/**`
6. all other packages
7. blank line
8. `@doxynix/**`
9. blank line
10. `@/shared/**`, `@/i18n/**`, `@/core/**`, `@/utils/**`
11. blank line
12. `@/entities/**`, `@/modules/**`
13. blank line
14. `@/features/**`
15. blank line
16. `@/widgets/**`, `@/ui/**`
17. blank line
18. `@/app/**`, `@/routes/**`, `@/commands/**`, `@/server/**`, `@/trigger/**`, `@/tests/**`
19. blank line
20. path aliases
21. blank line
22. relative paths
23. blank line
24. stylesheets (`*.css`, `*.scss`, `*.module.css`)

This is the FSD layering encoded in the formatter. If you import a widget before a feature, Biome
will reorder them and the diff will look unrelated to your change — re-read the file after running
`bun run format`.

## Assists that will rewrite your code

These run on `check --write` and mutate source even when you did not ask for formatting:

| Assist | Effect |
| --- | --- |
| `useSortedKeys` | object literal keys alphabetically |
| `useSortedProperties` | type/interface members alphabetically |
| `useSortedAttributes` | JSX attributes alphabetically |
| `useSortedEnumMembers` | enum members alphabetically |
| `useSortedPackageJson` | `package.json` keys in canonical order |
| `organizeImports` | regroups imports per the list above |

Expect to lose a hand-chosen key order. Write the object however you like and let Biome settle it.

## Excluded paths

Generated files are excluded and must not be edited by hand:

- `prisma/generated`, `prisma/json-schema`
- `messages/en.d.json.ts` (next-intl types)
- `routeTree.gen.ts` (TanStack Router)
- `bun.lock`
- `drizzle/` (generated migrations)
- `.agents/` (this skill tree)

## VS Code

```jsonc
// .vscode/settings.json
{
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "quickfix.biome": "explicit",
      "source.organizeImports.biome": "explicit"
    }
  },
  "[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
  "[javascript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[json]": { "editor.defaultFormatter": "biomejs.biome" }
}
```

Format on save in the editor **and** via Lefthook: the editor covers you while typing, the hook
covers everyone else and CI.

## CI

There is no separate Biome workflow. Formatting is checked inside the per-app quality jobs:

```yaml
- name: Check Formatting
  run: bun --filter @doxynix/web format:check
- name: Linting
  run: bun --filter @doxynix/web lint
```

The root `bun run format:check` (`biome check .`) is the whole-repo equivalent.

## Troubleshooting

**Biome ignores my file.** Check `files.includes` — exclusion is `!!path`, not a bare path, and
matching is glob-based (`!!**/dist`, not `!!dist`).

**My import order was rewritten.** It is the `organizeImports` group list. Reorder deliberately only
if the group order itself is wrong for a legitimate case; do not fight it per file.

**A rule I expected is not firing.** It is probably an Oxlint rule, not a Biome one — check
`.oxlintrc.json`. Biome's linter is `preset: none`.

**Config key rejected.** Biome validates strictly and reports unknown keys. Confirm you are on 2.x
key names (`files.includes`, `assist.actions.source`) before anything else.

**Formatting looks different after a dependency bump.** Check that no editor is still running
Prettier, and that `useEditorconfig: true` is not picking up an unexpected `.editorconfig`.

## Resources

- Docs: https://biomejs.dev
- Rules: https://biomejs.dev/linter/rules/
- Config schema: `./node_modules/@biomejs/biome/configuration_schema.json` (the `$schema` in
  `biome.json` points at the installed copy, so your editor validates against the exact version)