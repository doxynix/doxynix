import type { IConfiguration } from "dependency-cruiser";

/**
 * The one place in the server that is allowed to reach every slice: it builds the
 * tRPC caller out of the assembled routers, so importing modules is its purpose.
 * Kept as a named constant because two rules below must exempt the same file, and
 * an inline `pathNot` copy in each of them would silently rot on a rename.
 */
const CALLER_FACTORY = "^src/server/core/trpc/server[.]ts$";

const SERVER_SOURCE_ONLY = ["[.](?:spec|test)[.](?:ts|tsx)$"];

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
          "^src/sentry[.]edge[.]config[.]test[.]ts$",
          "^src/sentry[.]server[.]config[.]test[.]ts$",
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
        pathNot: SERVER_SOURCE_ONLY,
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
        pathNot: [...SERVER_SOURCE_ONLY, CALLER_FACTORY],
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
        pathNot: [...SERVER_SOURCE_ONLY, CALLER_FACTORY],
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
        pathNot: SERVER_SOURCE_ONLY,
      },
      name: "domain-must-not-reach-slices",
      severity: "error",
      to: {
        path: "^src/server/modules/",
      },
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
