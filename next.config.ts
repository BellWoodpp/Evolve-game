import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/photo/:path*",
        destination: "https://r2.evolvegame.org/photo/:path*",
        permanent: false,
      },
      {
        source: "/voice/:path*",
        destination: "https://r2.evolvegame.org/voice/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
