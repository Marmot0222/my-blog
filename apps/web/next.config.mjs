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
  ],
};

export default nextConfig;
