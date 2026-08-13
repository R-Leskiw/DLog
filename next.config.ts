import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": [
      "node_modules/shadcn/**",
      "node_modules/typescript/**",
      "node_modules/@swc/core*/**",
    ],
  },
};

export default nextConfig;
