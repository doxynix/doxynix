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
          "^src/main[.]tsx$",
        ],
      },
      name: "no-orphans",
      severity: "error",
      to: {},
    },
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
