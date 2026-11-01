import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  // Server-only database drivers stay out of the bundle.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  // The demo cycle is read from disk at runtime; ship it with the function that loads it.
  outputFileTracingIncludes: { "/api/seed": ["./data/seed-cache.json"] },
};
export default config;
