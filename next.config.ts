import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions body size limit — attachments are uploaded through
    // dedicated routes, so keep the action payload modest.
    serverActions: { bodySizeLimit: "2mb" },
  },
  eslint: {
    // Lint is run explicitly in CI via `npm run lint`; don't block prod builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
