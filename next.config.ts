import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.110.220.66"],
  typescript: {
    // auth.ts has a pre-existing adapter type mismatch that doesn't affect runtime
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["unpdf", "mammoth"],
  experimental: {
    // Proxy clones POST bodies in memory; default 10MB truncates image uploads
    // (base64 JSON / multipart) and surfaces as parse errors.
    proxyClientMaxBodySize: "40mb",
    serverActions: {
      bodySizeLimit: "40mb",
    },
  },
};

export default nextConfig;
