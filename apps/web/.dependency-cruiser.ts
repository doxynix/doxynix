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
          "^src/tests/",
          "^src/instrumentation[.]ts$",
          "^src/instrumentation-client[.]ts$",
          "^src/instrumentation-client[.]test[.]ts$",
          "^src/app/\\[locale\\]/opengraph-image[.]tsx$",
          "^src/app/\\[locale\\]/\\(private\\)/dashboard/repo/\\[owner\\]/\\[name\\]/opengraph-image[.]tsx$",
          "^src/app/manifest[.]ts$",
          "^src/app/global-error[.]tsx$",
          "^src/app/api/\\[\\.\\.\\.[^\\]]+\\]/route[.]ts$",
          "^src/app/\\[locale\\]/\\[\\.\\.\\.[^\\]]+\\]/page[.]tsx$",
        ],
      },
      name: "no-orphans",
      severity: "error",
      to: {},
    },
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
    {
      comment:
        "Server layering matrix. Rows may import columns. core/ and utils/ are peers on the infrastructure layer, domain/ sits above them holding concepts shared by several slices, and modules/ are the slices.\n" +
        "\n" +
        "               to:  core   utils  domain  modules\n" +
        "  from core/         -     yes      no      no\n" +
        "  from utils/       yes      -       no      no\n" +
        "  from domain/     yes     yes       -      no\n" +
        "  from modules/    yes     yes      yes    own slice only",
      from: {
        path: "^src/server/(?:core|domain|utils)/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$", "^src/server/core/trpc/server[.]ts$"],
      },
      name: "no-lower-layer-to-module-imports",
      severity: "error",
      to: {
        path: "^src/server/modules/",
      },
    },
    {
      comment:
        "Server layering: core/ and utils/ are peers on the infrastructure layer, and neither may import domain/.",
      from: {
        path: "^src/server/(?:core|utils)/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$", "^src/server/core/trpc/server[.]ts$"],
      },
      name: "infra-must-not-import-domain",
      severity: "error",
      to: {
        path: "^src/server/domain/",
      },
    },
    {
      comment:
        "Server layering: domain/ holds business concepts shared by several slices, so it must not import feature modules.",
      from: {
        path: "^src/server/domain/",
        pathNot: ["[.](?:spec|test)[.](?:ts|tsx)$"],
      },
      name: "domain-must-not-reach-slices",
      severity: "error",
      to: {
        path: "^src/server/modules/",
      },
    },
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
