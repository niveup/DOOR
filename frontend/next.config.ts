import type { NextConfig } from "next";

const devOrigins = (process.env.NEXT_PUBLIC_DEV_ORIGINS || "localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  async headers() {
    const baseline = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    const privateJournal = [
      { key: "Cache-Control", value: "no-store, private, max-age=0" },
      { key: "Pragma", value: "no-cache" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, noarchive, nosnippet" },
    ];
    return [
      { source: "/(.*)", headers: baseline },
      { source: "/journal/:path*", headers: privateJournal },
      { source: "/api/journal/:path*", headers: privateJournal },
      { source: "/api/journal-auth/:path*", headers: privateJournal },
    ];
  },
};

export default nextConfig;
