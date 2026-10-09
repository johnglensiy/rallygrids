import type { NextConfig } from "next";

const sandbox = process.env.SANDBOX === "1";

const nextConfig: NextConfig = {
  /* config options here */
  pageExtensions: sandbox ? ["dev.tsx", "dev.ts", "tsx", "ts"] : ["tsx", "ts"]
};

export default nextConfig;
