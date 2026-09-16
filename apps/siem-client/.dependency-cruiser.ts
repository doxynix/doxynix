// dependency-cruiser config for apps/siem-client (FSD boundary gate).
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
  forbidden: [
    {
      comment:
        "This dependency is part of a circular relationship. You might want to revise " +
        "your solution (i.e. use dependency inversion, make sure the modules have a single responsibility) ",
      from: {},
      name: "no-circular",
      severity: "error",
      to: {
        circular: true,
      },
    },
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
    {
      comment:
        "This module depends on a node core module that has been deprecated. Find an alternative - these are " +
        "bound to exist - node doesn't deprecate lightly.",
      from: {},
      name: "no-deprecated-core",
      severity: "warn",
      to: {
        dependencyTypes: ["core"],
        path: [
          "^v8/tools/codemap$",
          "^v8/tools/consarray$",
          "^v8/tools/csvparser$",
          "^v8/tools/logreader$",
          "^v8/tools/profile_view$",
          "^v8/tools/profile$",
          "^v8/tools/SourceMap$",
          "^v8/tools/splaytree$",
          "^v8/tools/tickprocessor-driver$",
          "^v8/tools/tickprocessor$",
          "^node-inspect/lib/_inspect$",
          "^node-inspect/lib/internal/inspect_client$",
          "^node-inspect/lib/internal/inspect_repl$",
          "^async_hooks$",
          "^punycode$",
          "^domain$",
          "^constants$",
          "^sys$",
          "^_linklist$",
          "^_stream_wrap$",
        ],
      },
    },
    {
      comment:
        "This module uses a (version of an) npm module that has been deprecated. Either upgrade to a later " +
        "version of that module, or find an alternative. Deprecated modules are a security risk.",
      from: {},
      name: "not-to-deprecated",
      severity: "warn",
      to: {
        dependencyTypes: ["deprecated"],
      },
    },
    {
      comment:
        "This module depends on an npm package that isn't in the 'dependencies' section of your package.json. " +
        "That's problematic as the package either (1) won't be available on live (2 - worse) will be " +
        "available on live with an non-guaranteed version. Fix it by adding the package to the dependencies " +
        "in your package.json.",
      from: {},
      name: "no-non-package-json",
      severity: "error",
      to: {
        dependencyTypes: ["npm-no-pkg", "npm-unknown"],
      },
    },
    {
      comment:
        "This module depends on a module that cannot be found ('resolved to disk'). If it's an npm " +
        "module: add it to your package.json. In all other cases you likely already know what to do.",
      from: {},
      name: "not-to-unresolvable",
      severity: "error",
      to: {
        couldNotResolve: true,
      },
    },
    {
      comment:
        "Likely this module depends on an external ('npm') package that occurs more than once " +
        "in your package.json i.e. bot as a devDependencies and in dependencies. This will cause " +
        "maintenance problems later on.",
      from: {},
      name: "no-duplicate-dep-types",
      severity: "warn",
      to: {
        // as it's common to use a devDependency for type-only imports: don't
        // consider type-only dependencyTypes for this rule
        dependencyTypesNot: ["type-only"],
        moreThanOneDependencyType: true,
      },
    },
    {
      comment:
        "This module depends on a spec (test) file. The responsibility of a spec file is to test code. " +
        "If there's something in a spec that's of use to other modules, it doesn't have that single " +
        "responsibility anymore. Factor it out into (e.g.) a separate utility/ helper or a mock.",
      from: {},
      name: "not-to-spec",
      severity: "error",
      to: {
        path: "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
      },
    },
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
        // type only dependencies are not a problem as they don't end up in the
        // production code or are ignored by the runtime.
        dependencyTypesNot: ["type-only"],
        pathNot: ["node_modules/@types/"],
      },
    },
    {
      comment:
        "This module depends on an npm package that is declared as an optional dependency " +
        "in your package.json. As this makes sense in limited situations only, it's flagged here. " +
        "If you use an optional dependency here by design - add an exception to your " +
        "dependency-cruiser configuration.",
      from: {},
      name: "optional-deps-used",
      severity: "info",
      to: {
        dependencyTypes: ["npm-optional"],
      },
    },
    {
      comment:
        "This module depends on an npm package that is declared as a peer dependency " +
        "in your package.json. This makes sense if your package is e.g. a plugin, but in " +
        "other cases - maybe not so much. If the use of a peer dependency is intentional " +
        "add an exception to your dependency-cruiser configuration.",
      from: {},
      name: "peer-deps-used",
      severity: "warn",
      to: {
        dependencyTypes: ["npm-peer"],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules"],
    },
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default", "types"],
      exportsFields: ["exports"],
      mainFields: ["main", "types", "typings"],
    },
    includeOnly: ["src"],
    skipAnalysisNotInRules: true,
    tsConfig: {
      fileName: "tsconfig.app.json",
    },
    tsPreCompilationDeps: true,
  },
};

export default config;
