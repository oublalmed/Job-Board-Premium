import type { NextConfig } from "next";
import path from "node:path";

// Vercel uses its own packaging — standalone mode causes file-tracing ENOENT
// there. Only enable it for self-hosted (Docker) builds.
const selfHosted = !process.env.VERCEL;

const nextConfig: NextConfig = {
  ...(selfHosted && {
    output: "standalone",
    outputFileTracingRoot: path.join(__dirname),
  }),
};

export default nextConfig;
