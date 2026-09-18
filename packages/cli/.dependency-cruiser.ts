// dependency-cruiser config for packages/cli (VSA for command slices + dep health gate).
// Shared "dependency health" rules + options live in the base config
// `@doxynix/config/depcruise-base.json` (see `extends` below); only the
// app-specific rules (orphan exceptions, VSA slices, cli not-to-dev-dep
// override) stay here.
// - This package declares "type": "module", so the config is ESM (`export
//   default`). Requires Node >= 22.18 (type stripping) or any Bun runtime.
// - The "missing-typescript-transpiler" warning you may see on runs is benign:
//   dep-cruiser 18 resolves the monorepo root typescript@7 (outside its
//   supported <7.0.0 range), but .ts parsing still happens via @swc/core,
//   including type-only imports (verified). Results are identical to 17.4.3.
// - not-to-dev-dep exempts workspace packages (@doxynix/*) because tsup
//   deliberately bundles devDependencies — standard CLI publishing pattern.
// - Cross-command imports (e.g. github→repos, staging→pr) are real coupling
//   that lives in the baseline; new ones will fail the gate.
import type { IConfiguration } from "dependency-cruiser";

const config: IConfiguration = {
  extends: "@doxynix/config/depcruise-base.json",
  forbidden: [
    {
      comment:
        "This is an orphan module - it's likely not used (anymore?). Either use it or " +
        "remove it. If it's logical this module is an orphan (i.e. it's a config file), " +
        "add an exception for it in your dependency-cruiser configuration. By default " +
        "this rule does not scrutinize dot-files (e.g. .eslintrc.js), TypeScript declaration " +
        "files (.d.ts), tsconfig.json and some of the babel and webpack configs.",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|cts|mts|json)$", // dot files
          "[.]d[.]ts$", // TypeScript declaration files
          "(^|/)tsconfig[.]json$", // TypeScript config
          "(^|/)(?:babel|webpack)[.]config[.](?:js|cjs|mjs|ts|cts|mts|json)$", // other configs
          // CLI entry point - started by the runner, never imported:
          "^src/index[.]ts$",
        ],
      },
      name: "no-orphans",
      severity: "error",
      to: {},
    },
    // VSA: a command slice must not import from another command slice's
    // internals. Group matching ($1) exempts the slice's own folder.
    {
      comment: "VSA (cli): no imports between command slices.",
      from: {
        path: "^src/commands/([^/]+)/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$"],
      },
      name: "cli-no-cross-command-imports",
      severity: "error",
      to: {
        path: "^src/commands/[^/]+/",
        pathNot: "^src/commands/$1/",
      },
    },
    // Layering: core/ and ui/ are shared infrastructure below commands.
    // Commands MAY import core/ui, but core/ui MUST NOT import commands.
    {
      comment: "VSA (cli): core and ui must not import from command slices.",
      from: {
        path: "^src/(?:core|ui)/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$"],
      },
      name: "cli-core-not-from-commands",
      severity: "error",
      to: {
        path: "^src/commands/",
      },
    },
    // Dead-code gate: every src module must be reachable from the CLI entry.
    {
      comment: "VSA (cli): module unreachable from src/index.ts — dead code.",
      from: {
        path: "^src/index[.]ts$",
      },
      name: "no-unreachable-from-entry",
      severity: "error",
      to: {
        path: "^src/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$", "[.]d[.]ts$"],
        reachable: false,
      },
    },
    // Override base not-to-dev-dep to add @doxynix workspace packages to the
    // exclusion list — tsup bundles devDependencies into the CLI dist, which
    // is the intended monorepo publishing pattern.
    {
      comment:
        "This module depends on an npm package from the 'devDependencies' section of your " +
        "package.json. It looks like something that ships to production, though. To prevent problems " +
        "with npm packages that aren't there on production declare it (only!) in the 'dependencies' " +
        "section of your package.json. If this module is development only - add it to the " +
        "from.pathNot re of the not-to-dev-dep rule in the dependency-cruiser configuration",
      from: {
        path: "^(src)",
        pathNot: "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
      },
      name: "not-to-dev-dep",
      severity: "error",
      to: {
        dependencyTypes: ["npm-dev"],
        dependencyTypesNot: ["type-only"],
        pathNot: [
          "node_modules/@types/",
          // Workspace packages are bundled by tsup into dist — intentional
          // devDependency pattern for monorepo CLI publishing:
          "node_modules/@doxynix/",
        ],
      },
    },
  ],
  options: {
    doNotFollow: {
      // @doxynix/web/trpc resolves through the "types" export straight into
      // web's raw src (outside node_modules); without this exclusion the whole
      // web graph gets pulled into the CLI scan.
      dependencyTypes: ["type-only"],
      path: ["node_modules", "apps/web"],
    },
    includeOnly: ["^src"],
  },
};

export default config;
