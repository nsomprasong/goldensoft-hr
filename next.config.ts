import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Multi-zone deployments must keep HR chunks separate from Customer App chunks.
  assetPrefix: process.env.HR_ASSET_PREFIX || undefined,
};

export default nextConfig;
