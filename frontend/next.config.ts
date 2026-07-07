import type { NextConfig } from "next";

// Dev origins for Turbopack are env-driven so no machine-specific LAN IP is
// baked into source. Set NEXT_PUBLIC_DEV_ORIGINS as a comma-separated list,
// e.g. "192.168.1.42:3000,localhost:3000".
const devOrigins = (process.env.NEXT_PUBLIC_DEV_ORIGINS || "localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
