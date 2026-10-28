import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reine Browser-App: statisches HTML/JS für Netlify oder einen anderen Static-Host.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: false,
};

export default nextConfig;
