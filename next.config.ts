import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

// Single source of truth for the site's sub-path prefix. It must stay in sync
// with lib/base-path.ts so public-asset URLs are prefixed consistently. Leave
// unset (or empty) for local development or a custom domain served from the root.
const basePath = (
  process.env.NEXT_PUBLIC_BASE_PATH
  ?? (isGitHubPages ? "/econmind-os" : "")
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  ...(isGitHubPages
    ? {
        output: "export",
        basePath,
        assetPrefix: basePath ? `${basePath}/` : undefined,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
