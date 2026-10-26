import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [
      { source: "/tools/pet-photo", destination: "/tools/pet-photo/index.html" },
      { source: "/tools/hand-drawn-photo", destination: "/tools/hand-drawn-photo/index.html" },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
