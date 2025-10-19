import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2gb',
    },
    // Allow large file uploads through middleware (affects API routes)
    middlewareClientMaxBodySize: '2gb',
  },
};

export default nextConfig;
