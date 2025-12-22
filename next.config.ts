import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: false },
  images: {
    domains: ["sun1-26.userapi.com"],
  },
};

export default nextConfig;
