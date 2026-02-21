import path from "node:path";
import type { NextConfig } from "next";
import filterWebpackStats from "@bundle-stats/plugin-webpack-filter";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import { withAxiom } from "next-axiom";
import createNextIntlPlugin from "next-intl/plugin";
import { StatsWriterPlugin } from "webpack-stats-plugin";

import { IS_ANALYZE, IS_PROD } from "@/shared/constants/env.client";
import { LOCALE_REGEX_STR } from "@/shared/constants/locales";

const bundleAnalyzer = withBundleAnalyzer({
  enabled: IS_ANALYZE,
});

const withNextIntl = createNextIntlPlugin({
  experimental: {
    createMessagesDeclaration: "./messages/en.json",
  },
});

const nextConfig: NextConfig = {
  onDemandEntries: {
    maxInactiveAge: 15 * 1000,
    pagesBufferLength: 2,
  },
  // cacheComponents: true, // если будут баги выключить (// NOTE: обнаружен баг №418 с гидратацией выяснено что приходится оборачивать каждый чих в suspense так еще и юзать везде 'use cache' директиву ибо теперь кеширование руками надо делать слишком много переписывать пока PPR отложен на неопределенный срок)
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: IS_PROD ? { exclude: ["error", "info"] } : false,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  reactCompiler: true, // аккуратно фича еще в бете (пока багов не обнаружено - 20.01.2026)
  webpack: (config, { isServer, dev }) => {
    if (!dev && !isServer) {
      const outputPath = config.output?.path ?? path.join(process.cwd(), ".next");

      const targetPath = path.join(process.cwd(), ".next", "webpack-stats.json");

      const relativeStatsPath = path.relative(outputPath, targetPath);

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
        })
      );
    }
    return config;
  },
  experimental: {
    typedEnv: true,
    taint: true,
    serverComponentsHmrCache: true,
    // useLightningcss: true, // отключен так-как ломает анализатор размера бандла
    authInterrupts: true,
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
    ],
  },
  typedRoutes: true,
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "sun1-26.userapi.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.yandex.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ufs.sh",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    const shortcuts = [
      // --- CORE ---
      { s: "/o", d: "/dashboard" },
      { s: "/dash", d: "/dashboard" },
      { s: "/home", d: "/dashboard" },
      { s: "/dashboard/settings", d: "/dashboard/settings/profile" },

      // --- REPOS ---
      { s: "/r", d: "/dashboard/repo" },
      { s: "/repos", d: "/dashboard/repo" },
      { s: "/code", d: "/dashboard/repo" },

      // --- SETTINGS & PROFILE ---
      { s: "/s", d: "/dashboard/settings/profile" },
      { s: "/settings", d: "/dashboard/settings/profile" },
      { s: "/me", d: "/dashboard/settings/profile" },
      { s: "/profile", d: "/dashboard/settings/profile" },

      // --- API & DEVELOPER ---
      { s: "/k", d: "/dashboard/settings/api-keys" },
      { s: "/keys", d: "/dashboard/settings/api-keys" },
      { s: "/token", d: "/dashboard/settings/api-keys" },
      { s: "/api", d: "/dashboard/settings/api-keys" },

      // --- NOTIFICATIONS ---
      { s: "/n", d: "/dashboard/notifications" },
      { s: "/notif", d: "/dashboard/notifications" },
      { s: "/inbox", d: "/dashboard/notifications" },
      { s: "/alerts", d: "/dashboard/notifications" },

      // --- DANGER ZONE ---
      { s: "/d", d: "/dashboard/settings/danger-zone" },
      { s: "/danger", d: "/dashboard/settings/danger-zone" },
      { s: "/rip", d: "/dashboard/settings/danger-zone" },

      // --- AUTH / ONBOARDING ---
      { s: "/in", d: "/auth" },
      { s: "/login", d: "/auth" },
      { s: "/join", d: "/auth" },

      // --- SUPPORT ---
      { s: "/h", d: "/support" },

      // --- PRIVACY & TERMS ---
      { s: "/tos", d: "/terms" },
      { s: "/pp", d: "/privacy" },

      // --- EXTERNAL ---
      { s: "/status", d: "https://status.doxynix.space" },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];

    shortcuts.forEach(({ s, d }) => {
      const isExternal = d.startsWith("http");

      results.push({
        source: s,
        destination: d,
        permanent: false,
      });

      results.push({
        source: `/:locale(${LOCALE_REGEX_STR})${s}`,
        destination: isExternal ? d : `/:locale${d}`,
        permanent: false,
      });
    });

    return results;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com https://cdn.jsdelivr.net https://challenges.cloudflare.com;
              frame-src 'self' https://challenges.cloudflare.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' blob: data:
                https://sun1-26.userapi.com
                https://ufs.sh
                https://*.ufs.sh
                https://utfs.io
                https://avatars.githubusercontent.com
                https://lh3.googleusercontent.com
                https://avatars.yandex.net;
              font-src 'self' data:;
              connect-src 'self'
                https://cdn.jsdelivr.net
                https://ufs.sh
                https://utfs.io
                https://uploadthing.com
                https://*.uploadthing.com
                https://vitals.vercel-insights.com
                https://axiom.co
                https://challenges.cloudflare.com
                https://*.ably-realtime.com
                https://*.realtime.ably.net
                wss://*.ably-realtime.com
                wss://*.realtime.ably.net;
              frame-ancestors 'none';
              upgrade-insecure-requests;
            `
              .replace(/\s{2,}/g, " ")
              .trim(),
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

const sentryOptions = {
  org: "doxynix",

  project: "doxynix",

  silent: process.env.CI == null,

  widenClientFileUpload: true,

  tunnelRoute: "/monitoring",

  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
  },

  webpack: {
    automaticVercelMonitors: true,

    treeshake: {
      removeDebugLogging: true,
    },
  },
};

export default withSentryConfig(withAxiom(bundleAnalyzer(withNextIntl(nextConfig))), sentryOptions);
