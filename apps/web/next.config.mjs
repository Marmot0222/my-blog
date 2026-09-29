import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(currentDirectory, "../.."),
  transpilePackages: [
    "@ting-lab/ui",
    "@ting-lab/content",
    "@ting-lab/database",
    "@ting-lab/ai",
    "@ting-lab/retrieval",
    "@ting-lab/publishing",
  ],
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
