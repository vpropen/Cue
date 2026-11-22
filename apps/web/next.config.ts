import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are TypeScript sources, so Next must compile them.
  transpilePackages: ["@cue/availability", "@cue/db"],
};

export default nextConfig;
