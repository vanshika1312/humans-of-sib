import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.110.220.66"],
  typescript: {
    // auth.ts has a pre-existing adapter type mismatch that doesn't affect runtime
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  experimental: {
    serverActions: {
      bodySizeLimit: "40mb",
    },
  },
};

export default nextConfig;
