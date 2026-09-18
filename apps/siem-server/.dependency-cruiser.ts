// dependency-cruiser config for apps/siem-server (VSA + dependency health gate).
// Shared "dependency health" rules + options live in the base config
// `@doxynix/config/depcruise-base.json` (see `extends` below); only the
// app-specific rules (orphan exceptions, VSA) stay here.
// - `import type` + `module.exports` (NOT `export default`): keeps Node from
//   double-parsing this file (the package has no "type": "module"), so no
//   MODULE_TYPELESS_PACKAGE_JSON warning. Requires Node >= 22.18 (type
//   stripping) or any Bun runtime.
// - The "missing-typescript-transpiler" warning you may see on runs is benign:
//   dep-cruiser 18 resolves the monorepo root typescript@7 (outside its
//   supported <7.0.0 range), but .ts parsing still happens via @swc/core,
//   including type-only imports (verified). Results are identical to 17.4.3.
import type { IConfiguration } from "dependency-cruiser";

const config: IConfiguration = {
  // Merged with the base: named rules with the same name are overridden by
  // the local copy (attributes win per top-level key); options are assigned
  // shallowly ({ ...base.options, ...local.options }).
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
          // Process entry points - started by the runner, never imported:
          "^src/index[.]ts$",
          // Public RPC client contract - consumed by @doxynix/siem-client via
          // the package.json "exports" map, never imported in-process:
          "^src/client[.]ts$",
        ],
      },
      name: "no-orphans",
      severity: "error",
      to: {},
    },
    // Vertical Slice Architecture (VSA): a module inside a server slice MUST NOT
    // import from another slice's internals. Group matching ($1) exempts the
    // slice's own folder. Imports to `src/core`, `src/utils`, node_modules and
    // @doxynix/* are unaffected (they don't match `to.path`). Test files may
    // cross slices - that's test-only coupling and doesn't leak into the
    // runtime graph.
    {
      comment: "VSA (siem-server): no imports between server slices.",
      from: {
        path: "^src/modules/([^/]+)/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$"],
      },
      name: "vsa-no-cross-slice-imports",
      severity: "error",
      to: {
        path: "^src/modules/[^/]+/",
        pathNot: "^src/modules/$1/",
      },
    },
    // Dead-code gate: every src module must be reachable from the single
    // runtime entry (src/index.ts). Catches unmounted slice routers and code
    // imported only from dead branches. src/client.ts is the RPC contract
    // consumed by @doxynix/siem-client via the exports map — never imported
    // in-process, so exempt (same reasoning as the no-orphans exception).
    {
      comment:
        "VSA (siem-server): module unreachable from src/index.ts — dead code or unmounted slice.",
      from: {
        path: "^src/index[.]ts$",
      },
      name: "no-unreachable-from-entry",
      severity: "error",
      to: {
        path: "^src/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$", "[.]d[.]ts$", "^src/client[.]ts$"],
        reachable: false,
      },
    },
  ],
};

module.exports = config;
