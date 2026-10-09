import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // Workspace packages ship TypeScript source rather than a build step, so
  // Next must transpile them.
  transpilePackages: ['@splendmed/domain', '@splendmed/juleb'],
  /*
   * Pin file tracing to the monorepo root. Without this, Next walks up and finds
   * an unrelated package-lock.json in the user's home directory and treats that
   * as the workspace root, which produces wrong standalone output traces.
   * pnpm runs package scripts with cwd set to the package directory.
   */
  outputFileTracingRoot: path.join(process.cwd(), '..', '..'),
};

export default nextConfig;
