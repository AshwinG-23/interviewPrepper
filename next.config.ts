import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["fluent-ffmpeg", "@google-cloud/vertexai"],
};

export default nextConfig;
