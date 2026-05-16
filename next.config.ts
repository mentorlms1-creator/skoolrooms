import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  // Include lesson plan PDF font files in serverless function bundles so
  // fs.readFileSync('public/fonts/...') works on Vercel (public/ is normally
  // served via the static CDN, NOT included in function bundles by default).
  outputFileTracingIncludes: {
    '/api/lesson-plans/**': ['./public/fonts/**'],
  },
};

export default nextConfig;
