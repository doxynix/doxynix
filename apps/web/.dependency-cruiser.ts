// dependency-cruiser config for apps/web (server module boundaries + dependency
// health gate).
//
// The server is a MODULAR MONOLITH: `src/server/modules/<slice>/` holds one
// folder per feature, and imports flow down only —
//     app/api  ->  modules  ->  core / utils
// Two rules enforce that, plus the layering rule below it:
//
//   1. no-cross-slice-imports      a slice must not import another slice
//   2. no-lower-layer-to-module-  core/ and utils/ must not import up into a
//      imports                   feature module
//
// It was previously labelled "VSA" (Vertical Slice Architecture). That was
// dropped on purpose: VSA is a .NET/MediatR pattern whose premise is that the
// service/repository layers melt away, and this server does have them. Naming it
// VSA promised a structure the code does not follow.
//
// Shared "dependency health" rules + options live in the base config
// `@doxynix/config/depcruise-base.json` (see `extends` below); only the
// app-specific rules (orphan exceptions, module boundaries) stay here.
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
          // Test harness files - loaded by vitest/playwright config, never imported:
          "^src/tests/",
          // Next.js convention entry points - picked up by the framework via file
          // location, not via imports, so they are legitimately 'orphan' to a static
          // dependency scan:
          "^src/instrumentation[.]ts$",
          "^src/instrumentation-client[.]ts$",
          // Structural test for the file above: vitest loads it, nothing imports
          // it, and it deliberately does not import the module it asserts on.
          "^src/instrumentation-client[.]test[.]ts$",
          "^src/app/\\[locale\\]/opengraph-image[.]tsx$",
          "^src/app/\\[locale\\]/\\(private\\)/dashboard/repo/\\[owner\\]/\\[name\\]/opengraph-image[.]tsx$",
          "^src/app/manifest[.]ts$",
          "^src/app/global-error[.]tsx$",
          "^src/app/api/\\[\\.\\.\\.[^\\]]+\\]/route[.]ts$", // catch-all API routes (e.g. [...all])
          "^src/app/\\[locale\\]/\\[\\.\\.\\.[^\\]]+\\]/page[.]tsx$", // catch-all page (e.g. [...rest])
        ],
      },
      name: "no-orphans",
      severity: "error",
      to: {},
    },
    // Server module boundary: a slice MUST NOT import from another slice's
    // internals. Group matching ($1) exempts the slice's own folder. Imports to
    // `src/server/core`, `src/server/utils`, node_modules, @/shared and
    // @doxynix/* are unaffected (they don't match `to.path`). Test files may
    // cross slices - that's test-only coupling and doesn't leak into the
    // runtime graph.
    {
      comment: "Server modules: no imports between slices.",
      from: {
        path: "^src/server/modules/([^/]+)/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$"],
      },
      name: "no-cross-slice-imports",
      severity: "error",
      to: {
        path: "^src/server/modules/[^/]+/",
        pathNot: "^src/server/modules/$1/",
      },
    },
    // Server layering: `core/` and `utils/` are the LOWER layers. Imports flow
    // down only — `app/api` -> `modules` -> `core`. A lower layer reaching back
    // up into a feature module inverts that, and it is how `utils/` ended up
    // importing `modules/analysis/*` and how three `repos` routers reached
    // `analysis/engine/` transitively through `core/github/`.
    //
    // The one sanctioned exception is `core/trpc/server.ts`: it is the
    // composition root that assembles the routers to build a caller, so
    // importing `modules` is its whole purpose.
    //
    // NOTE: this rule is deliberately NOT named "VSA" — see the header comment
    // explaining why the term was dropped.
    {
      comment:
        "Server layering: core/ and utils/ must not import from feature modules (imports flow down only).",
      from: {
        path: "^src/server/(?:core|utils)/",
        pathNot: [
          "[.](?:spec|test)[.](?:ts|tsx)$",
          // Composition root: builds a tRPC caller from the assembled routers.
          "^src/server/core/trpc/server[.]ts$",
        ],
      },
      name: "no-lower-layer-to-module-imports",
      severity: "error",
      to: {
        path: "^src/server/modules/",
      },
    },
    // FSD: a shared module used by fewer than 2 files in the layers above is
    // not really shared — consider moving it closer to its consumer. Advisory
    // (info): complements steiger (structure/naming), which cannot see usage.
    {
      comment: "FSD (web): shared module used once or never — move closer to the consumer.",
      from: {
        path: "^src/(?:app|widgets|features|entities)/",
      },
      module: {
        numberOfDependentsLessThan: 2,
        path: "^src/shared/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$"],
      },
      name: "no-unshared-in-shared",
      severity: "info",
    },
  ],
  options: {
    reporterOptions: {
      archi: {
        collapsePattern:
          "^(?:packages|src|lib(s?)|app(s?)|bin|test(s?)|spec(s?))/[^/]+|node_modules/(?:@[^/]+/[^/]+|[^/]+)",
      },
      dot: {
        collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)",
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};

export default config;
