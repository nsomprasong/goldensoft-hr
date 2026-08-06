import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * Customer App proxies HR HTML at /hr/* and rewrites /__hr_assets/_next/* → HR.
 * Without this prefix, client chunk loads hit Customer App /_next and 404.
 * Set HR_ASSET_PREFIX="" only for rare standalone debugging without the shell.
 */
const rawPrefix = process.env.HR_ASSET_PREFIX;
const assetPrefix =
  rawPrefix === "" ? undefined : (rawPrefix?.trim() || "/__hr_assets");

export default function nextConfig(phase: string): NextConfig {
  return {
    reactStrictMode: true,
    output: "standalone",
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    assetPrefix,
    async rewrites() {
      if (!assetPrefix) return [];
      // Standalone HR (e.g. :3001): browser still requests /__hr_assets/_next/*
      return [
        {
          source: `${assetPrefix}/_next/:path*`,
          destination: "/_next/:path*",
        },
      ];
    },
  };
}
