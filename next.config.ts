import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
