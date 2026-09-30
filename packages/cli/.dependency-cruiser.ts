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
          "(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|cts|mts|json)$",
          "[.]d[.]ts$",
          "(^|/)tsconfig[.]json$",
          "(^|/)(?:babel|webpack)[.]config[.](?:js|cjs|mjs|ts|cts|mts|json)$",
          "^src/index[.]ts$",
        ],
      },
      name: "no-orphans",
      severity: "error",
      to: {},
    },
    {
      comment: "Command slices: no imports between slices.",
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
    {
      comment: "Command slices: core and ui must not import from command slices.",
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
    {
      comment: "Command slices: module unreachable from src/index.ts — dead code.",
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
        pathNot: ["node_modules/@types/", "node_modules/@doxynix/"],
      },
    },
  ],
  options: {
    doNotFollow: {
      dependencyTypes: ["type-only"],
      path: ["node_modules", "apps/web"],
    },
    includeOnly: ["^src"],
  },
};

export default config;
