import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output produces a minimal self-contained server bundle that
  // Railway's Docker runner can ship. Replaces Vercel's outputFileTracing —
  // standalone copies public/ and node_modules dependencies automatically,
  // so the previous outputFileTracingIncludes for PDF fonts is no longer needed.
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
};

export default nextConfig;
