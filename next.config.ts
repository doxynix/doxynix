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
  compiler: {
    removeConsole: IS_PROD ? { exclude: ["error", "info"] } : false,
  },
  compress: true,
  experimental: {
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
      "@sentry/nextjs",
      "@sentry/react",
      "@sentry/browser",
      "@sentry/core",
      "@sentry-internal/replay",
      "@sentry-internal/browser-utils",
    ],
    serverComponentsHmrCache: true,
    taint: true,
    typedEnv: true,
  },
  async headers() {
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
              script-src 'self' 'unsafe-inline' blob: https://vercel.live https://va.vercel-scripts.com https://cdn.jsdelivr.net https://challenges.cloudflare.com;
              frame-src 'self' https://vercel.live https://challenges.cloudflare.com;
              worker-src 'self' blob:;
              base-uri 'none';
              form-action 'self';
              object-src 'none';
              style-src 'self' 'unsafe-inline';
              img-src 'self' blob: data:
                https://sun1-26.userapi.com
                https://ufs.sh
                https://*.ufs.sh
                https://utfs.io
                https://*.utfs.io
                https://avatars.githubusercontent.com
                https://*.googleusercontent.com
                https://avatars.yandex.net;
              font-src 'self' data:;
              media-src 'self';
              connect-src 'self'
                https://cdn.jsdelivr.net
                https://ufs.sh
                https://*.ufs.sh
                https://utfs.io
                https://*.utfs.io
                https://uploadthing.com
                https://*.uploadthing.com
                https://vitals.vercel-insights.com
                https://axiom.co
                https://challenges.cloudflare.com
                https://*.ably-realtime.com
                https://*.realtime.ably.net
                wss://*.ably-realtime.com
                https://*.ably.net
                wss://*.ably.net
                wss://*.realtime.ably.net
                https://*.ingest.sentry.io
                https://*.sentry.io;
              frame-ancestors 'none';
              manifest-src 'self';
              upgrade-insecure-requests;
            `
              .replace(/\s{2,}/g, " ")
              .trim(),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
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
        hostname: "sun1-26.userapi.com",
        pathname: "/**",
        protocol: "https",
      },
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
        hostname: "ufs.sh",
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
  poweredByHeader: false,
  reactCompiler: true, // аккуратно фича еще в бете (пока багов не обнаружено - 20.01.2026)
  // cacheComponents: true, // если будут баги выключить (// NOTE: обнаружен баг №418 с гидратацией выяснено что приходится оборачивать каждый чих в suspense так еще и юзать везде 'use cache' директиву ибо теперь кеширование руками надо делать слишком много переписывать пока PPR отложен на неопределенный срок)
  reactStrictMode: true,
  async redirects() {
    const shortcuts = [
      // --- CORE ---
      { d: "/dashboard", s: "/o" },
      { d: "/dashboard", s: "/dash" },
      { d: "/dashboard", s: "/home" },
      { d: "/dashboard/settings/profile", s: "/dashboard/settings" },

      // --- REPOS ---
      { d: "/dashboard/repo", s: "/r" },
      { d: "/dashboard/repo", s: "/repos" },
      { d: "/dashboard/repo", s: "/code" },

      // --- SETTINGS & PROFILE ---
      { d: "/dashboard/settings/profile", s: "/s" },
      { d: "/dashboard/settings/profile", s: "/settings" },
      { d: "/dashboard/settings/profile", s: "/me" },
      { d: "/dashboard/settings/profile", s: "/profile" },

      // --- API & DEVELOPER ---
      { d: "/dashboard/settings/api-keys", s: "/k" },
      { d: "/dashboard/settings/api-keys", s: "/keys" },
      { d: "/dashboard/settings/api-keys", s: "/token" },
      { d: "/dashboard/settings/api-keys", s: "/api" },

      // --- NOTIFICATIONS ---
      { d: "/dashboard/notifications", s: "/n" },
      { d: "/dashboard/notifications", s: "/notif" },
      { d: "/dashboard/notifications", s: "/inbox" },
      { d: "/dashboard/notifications", s: "/alerts" },

      // --- DANGER ZONE ---
      { d: "/dashboard/settings/danger-zone", s: "/d" },
      { d: "/dashboard/settings/danger-zone", s: "/danger" },
      { d: "/dashboard/settings/danger-zone", s: "/rip" },

      // --- AUTH / ONBOARDING ---
      { d: "/auth", s: "/in" },
      { d: "/auth", s: "/login" },
      { d: "/auth", s: "/join" },

      // --- SUPPORT ---
      { d: "/support", s: "/h" },

      // --- PRIVACY & TERMS ---
      { d: "/terms", s: "/tos" },
      { d: "/privacy", s: "/pp" },

      // --- EXTERNAL ---
      { d: "https://status.doxynix.space", s: "/status" },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];

    shortcuts.forEach(({ d, s }) => {
      const isExternal = d.startsWith("http");

      results.push({
        destination: d,
        permanent: false,
        source: s,
      });

      results.push({
        destination: isExternal ? d : `/:locale${d}`,
        permanent: false,
        source: `/:locale(${LOCALE_REGEX_STR})${s}`,
      });
    });

    return results;
  },
  typedRoutes: true,
  typescript: { ignoreBuildErrors: false },
  webpack: (config, { dev, isServer }) => {
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
};

const sentryOptions = {
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
  },

  org: "doxynix",

  project: "doxynix",

  silent: process.env.CI == null,

  tunnelRoute: "/api/v1/dxnx",

  webpack: {
    automaticVercelMonitors: true,

    treeshake: {
      removeDebugLogging: true,
    },
  },

  widenClientFileUpload: true,
};

export default withSentryConfig(withAxiom(bundleAnalyzer(withNextIntl(nextConfig))), sentryOptions);
