import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['posthog-js', 'framer-motion'],
};

export default nextConfig;
