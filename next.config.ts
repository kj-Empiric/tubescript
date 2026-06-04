import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.devtunnels.ms",
    "*.inc1.devtunnels.ms",
    "*.run.pinggy-free.link",
    "*.pinggy.online",
    "*.ngrok.io",
    "*.ngrok-free.app",
    "*.loca.lt",
  ],
};

export default nextConfig;
