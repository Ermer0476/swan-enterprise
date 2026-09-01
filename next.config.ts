import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions body size limit — attachments are uploaded through
    // dedicated routes, so keep the action payload modest.
    serverActions: { bodySizeLimit: "2mb" },
    // Client-side Router Cache lifetimes. Next 15 defaults these to 0, so every
    // Back/Forward and revisit re-fetches the page from the server (feels slow
    // and janky). Caching dynamic pages for 30s and static for 3min makes
    // back/forward and re-navigation instant while data stays fresh enough.
    staleTimes: { dynamic: 30, static: 180 },
  },
  eslint: {
    // Lint is run explicitly in CI via `npm run lint`; don't block prod builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
