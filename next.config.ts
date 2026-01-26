import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withAxiom } from "next-axiom";
import createNextIntlPlugin from "next-intl/plugin";

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
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
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "info"] } : false,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  reactCompiler: true, // аккуратно фича еще в бете (пока багов не обнаружено - 20.01.2026)
  experimental: {
    typedEnv: true,
    taint: true,
    serverComponentsHmrCache: true,
    // useLightningcss: true, // отключен так-как ломает анализатор размера бандла
    authInterrupts: true,
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-avatar",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-scroll-area",
      "@headlessui/react",
      "recharts",
      "framer-motion",
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
    return [
      {
        source: "/dashboard/settings",
        destination: "/dashboard/settings/profile",
        permanent: true,
      },
      {
        source: "/o",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/r",
        destination: "/dashboard/repo",
        permanent: false,
      },
      {
        source: "/s",
        destination: "/dashboard/settings/profile",
        permanent: false,
      },
      {
        source: "/me",
        destination: "/dashboard/settings/profile",
        permanent: false,
      },
      {
        source: "/k",
        destination: "/dashboard/settings/api-keys",
        permanent: false,
      },
      {
        source: "/d",
        destination: "/dashboard/settings/danger-zone",
        permanent: false,
      },
      {
        source: "/n",
        destination: "/dashboard/notifications",
        permanent: false,
      },
    ];
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
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com https://cdn.jsdelivr.net;
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
                https://axiom.co;
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

export default withAxiom(bundleAnalyzer(withNextIntl(nextConfig)));
