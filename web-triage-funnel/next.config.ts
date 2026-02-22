import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['posthog-js', 'framer-motion'],
  async redirects() {
    const fs = require('fs');
    const path = require('path');

    // Read our generated redirects
    const redirectsPath = path.join(process.cwd(), '../redirects.json');
    if (fs.existsSync(redirectsPath)) {
      const redirectsData = JSON.parse(fs.readFileSync(redirectsPath, 'utf8'));
      const pseoRedirects = Object.entries(redirectsData).map(([dup, keep]) => {
        // Next.js regex routing fails on parentheses, encodeURI handles them cleanly
        const escapedDestination = encodeURI(String(keep));
        return {
          source: `/symptoms/${dup}`,
          destination: `/symptoms/${escapedDestination}`,
          permanent: true
        };
      });
      return pseoRedirects;
    }

    return [];
  }
};

export default nextConfig;
