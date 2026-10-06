import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/binary packages resolved at runtime (ffmpeg, the speech recognizer).
  serverExternalPackages: ["ffmpeg-static", "sherpa-onnx-node"],
  async redirects() {
    return [
      { source: "/board", destination: "/videos", permanent: false },
      { source: "/library", destination: "/videos", permanent: false },
      { source: "/studio", destination: "/videos", permanent: false },
      { source: "/performance", destination: "/analyze", permanent: false },
      { source: "/compliance", destination: "/approve", permanent: false },
      { source: "/profile", destination: "/settings", permanent: false },
    ];
  },
};

export default nextConfig;
