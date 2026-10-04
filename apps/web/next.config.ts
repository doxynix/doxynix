import type { NextConfig } from "next";
import filterWebpackStats from "@bundle-stats/plugin-webpack-filter";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { type SentryBuildOptions, withSentryConfig } from "@sentry/nextjs/config";
import createWithVercelToolbar from "@vercel/toolbar/plugins/next";
import { withAxiom } from "next-axiom";
import createNextIntlPlugin from "next-intl/plugin";
import { join, relative } from "pathe";
import { StatsWriterPlugin } from "webpack-stats-plugin";

import { API_PREFIX } from "@/shared/config/env.client";
import { IS_ANALYZE, IS_DEV, IS_PROD } from "@/shared/config/env.flags";
import { LOCALE_REGEX_STR } from "@/shared/config/locales";

import pkg from "./package.json" with { type: "json" };

// RelativeCI webpack stats; off unless STATS=true or ENABLE_RELATIVE_CI=true.
const IS_STATS_ENABLED = process.env.STATS === "true" || process.env.ENABLE_RELATIVE_CI === "true";

const bundleAnalyzer = withBundleAnalyzer({
  enabled: IS_ANALYZE,
});

const withNextIntl = createNextIntlPlugin({
  experimental: {
    createMessagesDeclaration: "./messages/en.json",
  },
  requestConfig: "./src/shared/i18n/request.ts",
});

const withVercelToolbar = createWithVercelToolbar();

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: IS_PROD ? { exclude: ["error", "info"] } : false,
  },
  compress: true,
  enablePrerenderSourceMaps: false, // Prevents conflicts with Sentry Debug IDs during SSG
  env: {
    APP_VERSION: pkg.version,
  },
  experimental: {
    authInterrupts: true,
    dynamicOnHover: true,
    optimisticRouting: true,
    optimizePackageImports: [
      "@radix-ui/react-avatar",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-accordion",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-tabs",
      "@radix-ui/react-progress",
      "@radix-ui/react-icons",
      "framer-motion",
      "motion",
      "react-hook-form",
      "@tanstack/react-query",
      "cmdk",
      "sonner",
      "@sentry/nextjs",
      "@sentry/react",
      "@sentry/browser",
      "@sentry/core",
      "@sentry/replay",
      "@sentry/browser-utils",
    ],
    optimizeServerReact: true,
    prefetchInlining: true,
    preloadEntriesOnStart: false,
    prerenderEarlyExit: false, // [DISABLED]: Known to cause premature build stalls on Next.js 16
    scrollRestoration: true,
    serverComponentsHmrCache: true,
    serverSourceMaps: false, // [DISABLED]: Avoid holding large server sourcemaps in memory during build
    taint: true,
    turbopackFileSystemCacheForBuild: true,
    turbopackFileSystemCacheForDev: true,
    typedEnv: true,
    webpackMemoryOptimizations: false,
    workerThreads: false, // [DISABLED]: Causes worker pool deadlocks during page data collection under Bun runtime
  },
  async headers() {
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      IS_DEV ? "'unsafe-eval'" : "",
      "blob:",
      "https://vercel.live",
      "https://va.vercel-scripts.com",
      "https://cdn.jsdelivr.net",
      "https://challenges.cloudflare.com",
      "https://accounts.google.com/gsi/client",
    ]
      .filter(Boolean)
      .join(" ");

    const connectSrc = [
      "'self'",
      IS_DEV ? "ws://localhost:*" : "",
      "https://api.trigger.dev",
      "wss://api.trigger.dev",
      "https://cdn.jsdelivr.net",
      "https://ufs.sh",
      "https://*.ufs.sh",
      "https://utfs.io",
      "https://*.utfs.io",
      "https://uploadthing.com",
      "https://*.uploadthing.com",
      "https://vitals.vercel-insights.com",
      "https://axiom.co",
      "https://challenges.cloudflare.com",
      "https://*.ably-realtime.com",
      "https://*.realtime.ably.net",
      "https://vercel.com",
      "https://*.vercel.com",
      "https://blob.vercel-storage.com",
      "https://*.blob.vercel-storage.com",
      "https://*.public.blob.vercel-storage.com",
      "https://vercel.live",
      IS_DEV ? "ws://localhost:25002" : "",
      "https://*.pusher.com",
      "wss://*.pusher.com",
      IS_DEV ? "http://localhost:25002" : "",
      "wss://*.ably-realtime.com",
      "https://*.ably.net",
      "wss://*.ably.net",
      "wss://*.realtime.ably.net",
      "https://*.ingest.sentry.io",
      "https://*.sentry.io",
      "https://us.i.posthog.com",
      "https://us-assets.i.posthog.com",
      "https://accounts.google.com",
      "https://accounts.google.com/gsi/",
    ]
      .filter(Boolean)
      .join(" ");

    return [
      {
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'none';
              script-src ${scriptSrc};
              frame-src 'self' https://vercel.live https://challenges.cloudflare.com https://accounts.google.com https://accounts.google.com/gsi/;
              worker-src 'self' blob:;
              base-uri 'none';
              form-action 'self';
              object-src 'none';
              style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style;
              img-src 'self' blob: data:
                https://img.shields.io
                https://cdn.jsdelivr.net
                https://sun1-26.userapi.com
                https://vercel.live
                https://vercel.com
                https://ufs.sh
                https://*.ufs.sh
                https://utfs.io
                https://*.utfs.io
                https://github.com
                https://avatars.githubusercontent.com
                https://*.googleusercontent.com
                https://avatars.yandex.net
                https://*.public.blob.vercel-storage.com
                https://ssl.gstatic.com;
              font-src 'self' https://vercel.live data:;
              media-src 'self';
              connect-src ${connectSrc};
              frame-ancestors 'self' https://vercel.live;
              manifest-src 'self';
              upgrade-insecure-requests;
            `
              .replaceAll(/\s{2,}/g, " ")
              .trim(),
          },
          { key: "X-Frame-Options", value: IS_DEV ? "SAMEORIGIN" : "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: IS_DEV ? "unsafe-none" : "credentialless" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
        ],
        source: "/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "avatars.yandex.net",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "utfs.io",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "*.utfs.io",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "ufs.sh",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "*.ufs.sh",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "github.com",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
        protocol: "https",
      },
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  onDemandEntries: {
    maxInactiveAge: 15 * 1000,
    pagesBufferLength: 2,
  },
  outputFileTracingExcludes: {
    "*": [
      "**/node_modules/tree-sitter-wasms/**",
      "**/.bun/**/tree-sitter-wasms/**",
      "./**/*.js.map",
      "./**/*.mjs.map",
    ],
  },
  poweredByHeader: false,
  productionBrowserSourceMaps: false, // Ensures clients cannot fetch raw sourcemaps from browser
  reactCompiler: true,
  // cacheComponents: true, // disable if bugs appear (// NOTE: bug #418 with hydration discovered — turns out everything must be wrapped in Suspense and the 'use cache' directive used everywhere, since caching is now manual; too much rewriting while PPR is deferred indefinitely)
  reactStrictMode: true,
  async redirects() {
    const shortcuts = [
      { d: "/dashboard", s: "/o" },
      { d: "/dashboard", s: "/dash" },
      { d: "/dashboard", s: "/home" },

      { d: "/dashboard/settings/profile", s: "/dashboard/settings" },
      { d: "/dashboard/repos", s: "/dashboard/repo" },
      { d: "/dashboard/repo/:owner/:name/pulls", s: "/dashboard/repo/:owner/:name/pull" },

      { d: "/dashboard/repos", s: "/r" },
      { d: "/dashboard/repos", s: "/repos" },
      { d: "/dashboard/repos", s: "/code" },

      { d: "/dashboard/settings/profile", s: "/s" },
      { d: "/dashboard/settings/profile", s: "/settings" },
      { d: "/dashboard/settings/profile", s: "/me" },
      { d: "/dashboard/settings/profile", s: "/profile" },

      { d: "/dashboard/settings/api-keys", s: "/k" },
      { d: "/dashboard/settings/api-keys", s: "/keys" },
      { d: "/dashboard/settings/api-keys", s: "/token" },
      { d: "/dashboard/settings/api-keys", s: "/api" },

      { d: "/dashboard/notifications", s: "/n" },
      { d: "/dashboard/notifications", s: "/notif" },
      { d: "/dashboard/notifications", s: "/inbox" },
      { d: "/dashboard/notifications", s: "/alerts" },

      { d: "/dashboard/settings/danger-zone", s: "/d" },
      { d: "/dashboard/settings/danger-zone", s: "/danger" },
      { d: "/dashboard/settings/danger-zone", s: "/rip" },

      { d: "/auth", s: "/in" },
      { d: "/auth", s: "/login" },
      { d: "/auth", s: "/join" },

      { d: "/support", s: "/h" },

      { d: "/terms", s: "/tos" },
      { d: "/privacy", s: "/pp" },

      { d: "https://status.doxynix.space", s: "/status" },
    ];

    const results: { destination: string; permanent: boolean; source: string }[] = [];

    shortcuts.forEach(({ d, s }) => {
      const isExternal = d.startsWith("http");

      results.push(
        {
          destination: d,
          permanent: false,
          source: s,
        },
        {
          destination: isExternal ? d : `/:locale${d}`,
          permanent: false,
          source: `/:locale(${LOCALE_REGEX_STR})${s}`,
        },
      );
    });

    return results;
  },
  async rewrites() {
    return [
      {
        destination: "https://us-assets.i.posthog.com/static/:path*",
        source: `${API_PREFIX}/dxnx/p/static/:path*`,
      },
      {
        destination: "https://us.i.posthog.com/array/:path*",
        source: `${API_PREFIX}/dxnx/p/array/:path*`,
      },
      {
        destination: "https://us.i.posthog.com/:path*",
        source: `${API_PREFIX}/dxnx/p/:path*`,
      },
    ];
  },
  serverExternalPackages: [
    "tree-sitter",
    "tree-sitter-c",
    "tree-sitter-c-sharp",
    "tree-sitter-cpp",
    "tree-sitter-go",
    "tree-sitter-java",
    "tree-sitter-json",
    "tree-sitter-php",
    "tree-sitter-python",
    "tree-sitter-ruby",
    "tree-sitter-rust",
    "tree-sitter-typescript",
    "tree-sitter-wasms",
    "web-tree-sitter",
  ],
  skipTrailingSlashRedirect: true,
  typedRoutes: false,
  typescript: { ignoreBuildErrors: false },

  webpack: (config, { dev, isServer }) => {
    // StatsWriterPlugin with 'modules: true' serialises the whole module graph into RAM, causing GC freezes.
    if (IS_STATS_ENABLED && !dev && !isServer) {
      const outputPath = config.output?.path ?? join(process.cwd(), ".next");

      const targetPath = join(process.cwd(), ".next", "webpack-stats.json");

      const relativeStatsPath = relative(outputPath, targetPath);

      config.plugins.push(
        new StatsWriterPlugin({
          filename: relativeStatsPath,
          stats: {
            assets: true,
            chunks: true,
            modules: true,
          },
          transform: (data) => {
            const filtered = filterWebpackStats(data);
            return JSON.stringify(filtered);
          },
        }),
      );
    }

    return config;
  },
};

const sentryOptions: SentryBuildOptions = {
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
  },

  org: "doxynix",
  project: "doxynix",

  silent: process.env.CI == null,

  // Do NOT delete source maps after upload to preserve Debug ID integrity during SSG
  sourcemaps: {
    deleteSourcemapsAfterUpload: false,
  },

  telemetry: false,

  tunnelRoute: `${API_PREFIX}/dxnx/s`,

  webpack: {
    automaticVercelMonitors: true,

    treeshake: {
      removeDebugLogging: true,
    },
  },

  // Crucial: uploads source maps for all client-side deps, keeping Sentry stack traces unmangled.
  widenClientFileUpload: true,
};

const baseConfig =
  IS_DEV && !IS_ANALYZE
    ? withVercelToolbar(withNextIntl(nextConfig))
    : withAxiom(bundleAnalyzer(withNextIntl(nextConfig)));

const IS_CI_OR_VERCEL = Boolean(process.env.VERCEL != null || process.env.CI != null);

const finalConfig = IS_CI_OR_VERCEL ? withSentryConfig(baseConfig, sentryOptions) : baseConfig;

export default finalConfig;
