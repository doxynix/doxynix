import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withAxiom } from "next-axiom";

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  cacheComponents: true, // если будут баги выключить
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  reactCompiler: true, // аккуратно фича еще в бете
  experimental: { typedEnv: true },
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
    ],
  },
  async redirects() {
    return [
      {
        source: "/dashboard/settings",
        destination: "/dashboard/settings/profile",
        permanent: true,
      },
      // {
      //   source: "/me", // если юзер введет /me его кинет на то что написано в destination
      //   destination: "/dashboard/settings/profile",
      //   permanent: false,
      // },
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
                https://utfs.io
                https://avatars.githubusercontent.com
                https://lh3.googleusercontent.com
                https://avatars.yandex.net;
              font-src 'self' data:;
              connect-src 'self'
                https://ufs.sh
                https://utfs.io
                https://uploadthing.com
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

export default withAxiom(bundleAnalyzer(nextConfig));
