import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Suppress TypeScript build errors (strict checks done in CI separately)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Server-side packages that should not be bundled by webpack
  serverExternalPackages: ["nodemailer", "kiteconnect", "ioredis"],

  // Allow images from common financial data providers
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.yahoo.com" },
      { protocol: "https", hostname: "**.google.com" },
    ],
  },
};

export default nextConfig;
