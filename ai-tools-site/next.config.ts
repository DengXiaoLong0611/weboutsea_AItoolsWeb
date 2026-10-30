import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-local" : ".next",
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Cloud-sync placeholders can corrupt the local Turbopack cache database.
    turbopackFileSystemCacheForDev: false,
  },
  async rewrites() {
    return [
      { source: "/tools/pet-photo", destination: "/tools/pet-photo/index.html" },
      { source: "/tools/hand-drawn-photo", destination: "/tools/hand-drawn-photo/index.html" },
      { source: "/learn/langgraph", destination: "/learn/langgraph/index.html" },
      { source: "/learn/langgraph/zh", destination: "/learn/langgraph/zh/index.html" },
      { source: "/learn/langgraph/:path*", destination: "/learn/langgraph/:path*.html" },
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
