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
};

export default withAxiom(bundleAnalyzer(nextConfig));
