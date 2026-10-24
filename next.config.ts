import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Images go to the backend through Server Actions (1MB by default).
      // A task form carries two images of up to 2MB each (lib/upload-limits.ts)
      // plus its fields.
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
