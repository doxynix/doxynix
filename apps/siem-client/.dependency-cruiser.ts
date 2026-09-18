// dependency-cruiser config for apps/siem-client (FSD boundary gate).
// Shared "dependency health" rules + options live in the base config
// `@doxynix/config/depcruise-base.json` (see `extends` below); only the
// app-specific rules (orphan exceptions, FSD layer constraints) stay here.
// - This package declares "type": "module", so the config is ESM (`export
//   default`). Requires Node >= 22.18 (type stripping) or any Bun runtime.
// - The "missing-typescript-transpiler" warning you may see on runs is benign:
//   dep-cruiser 18 resolves the monorepo root typescript@7 (outside its
//   supported <7.0.0 range), but .ts parsing still happens via @swc/core,
//   including type-only imports (verified). Results are identical to 17.4.3.
// - Import flow (FSD): routes -> widgets -> features -> entities -> shared.
//   Deep imports into @doxynix/siem-server are blocked at build time by that
//   package's "exports" map (only "." and "./client" are reachable), so the
//   client's server-type isolation is covered by not-to-unresolvable.
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
          // Vite entry point - started by the bundler, never imported:
          "^src/main[.]tsx$",
        ],
      },
      name: "no-orphans",
      severity: "error",
      to: {},
    },
    // FSD: a feature slice must not import from another feature slice.
    // Group matching ($1) exempts the slice's own folder. Cross-feature logic
    // belongs in entities or shared (or composed in widgets/routes).
    {
      comment: "FSD (siem-client): no imports between feature slices.",
      from: {
        path: "^src/features/([^/]+)/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$"],
      },
      name: "fsd-no-cross-feature-imports",
      severity: "error",
      to: {
        path: "^src/features/[^/]+/",
        pathNot: "^src/features/$1/",
      },
    },
    // FSD: imports flow downward only (routes -> widgets -> features ->
    // entities -> shared). Each rule forbids its FROM layer from importing any
    // layer above it.
    {
      comment: "FSD (siem-client): shared must not import from layers above it.",
      from: {
        path: "^src/shared/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$"],
      },
      name: "fsd-layer-order",
      severity: "error",
      to: {
        path: "^src/(?:entities|features|widgets|routes)/",
      },
    },
    {
      comment: "FSD (siem-client): entities must not import from layers above them.",
      from: {
        path: "^src/entities/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$"],
      },
      name: "fsd-layer-order",
      severity: "error",
      to: {
        path: "^src/(?:features|widgets|routes)/",
      },
    },
    {
      comment: "FSD (siem-client): features must not import from layers above them.",
      from: {
        path: "^src/features/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$"],
      },
      name: "fsd-layer-order",
      severity: "error",
      to: {
        path: "^src/(?:widgets|routes)/",
      },
    },
    {
      comment: "FSD (siem-client): widgets must not import from the routes layer.",
      from: {
        path: "^src/widgets/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$"],
      },
      name: "fsd-layer-order",
      severity: "error",
      to: {
        path: "^src/routes/",
      },
    },
    // FSD: a shared module used by fewer than 2 files in the layers above is
    // not really shared — consider moving it closer to its consumer. Advisory
    // (info): complements steiger (structure/naming), which cannot see usage.
    {
      comment: "FSD (siem-client): shared module used once or never — move closer to the consumer.",
      from: {
        path: "^src/(?:routes|widgets|features|entities)/",
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
    tsConfig: {
      fileName: "tsconfig.app.json",
    },
  },
};

export default config;
