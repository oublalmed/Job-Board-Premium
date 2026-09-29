import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for a lean Docker
  // runtime image. Only affects `next build` output — `next dev` is unchanged.
  output: "standalone",
  // Pin the file-tracing root to THIS package. Without it, Next walks up and
  // finds the backend's lockfile at the repo root, nesting the standalone
  // output under .next/standalone/frontend/. Pinning keeps server.js at
  // .next/standalone/server.js, which is what the Dockerfile copies.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
