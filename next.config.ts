import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
