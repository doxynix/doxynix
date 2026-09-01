/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      comment:
        "This dependency is part of a circular relationship. You might want to revise " +
        "your solution (i.e. use dependency inversion, make sure the modules have a single responsibility) ",
      from: {},
      name: "no-circular",
      severity: "warn",
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
        ],
      },
      name: "no-orphans",
      severity: "warn",
      to: {},
    },
    {
      comment:
        "A module depends on a node core module that has been deprecated. Find an alternative - these are " +
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

    // rules you might want to tweak for your specific situation:

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
    // moduleSystems: ['cjs', 'es6'],

    detectProcessBuiltinModuleCalls: true,
    doNotFollow: {
      path: ["node_modules"],
    },

    // webpackConfig: {
    //  fileName: 'webpack.config.js',
    //  env: {},
    //  arguments: {}
    // },

    // babelConfig: {
    //   fileName: '.babelrc',
    // },

    // exoticRequireStrings: [],

    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default", "types"],
      exportsFields: ["exports"],

      // extensions: [".js", ".jsx", ".ts", ".tsx", ".d.ts"],

      // mainFields: ["module", "main", "types", "typings"],
      mainFields: ["main", "types", "typings"],

      // aliasFields: ['browser'],
    },

    // exclude : {
    //   // path: an array of regular expressions in strings to match against
    //   path: '',
    // },

    includeOnly: ["src"],

    reporterOptions: {
      archi: {
        collapsePattern:
          "^(?:packages|src|lib(s?)|app(s?)|bin|test(s?)|spec(s?))/[^/]+|node_modules/(?:@[^/]+/[^/]+|[^/]+)",

        // theme: { },
      },
      dot: {
        collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)",

        // theme: {
        //   graph: {
        //     // splines: 'ortho' - straight lines; slow on big graphs
        //     // splines: 'true' - bezier curves; fast but not as nice as ortho
        //     splines: 'true'
        //   },
        // },
      },
      text: {
        highlightFocused: true,
      },
    },

    skipAnalysisNotInRules: true,

    // extraExtensionsToScan: ['.json', '.jpg', '.png', '.svg', '.webp'],

    // combinedDependencies: false,

    // preserveSymlinks: false,

    tsConfig: {
      fileName: "tsconfig.json",
    },

    // prefix: `vscode://file/${process.cwd()}/`,

    // suffix: '.html',

    tsPreCompilationDeps: true,
  },
};
