import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "img.clerk.com" },
      { hostname: "lh3.googleusercontent.com" },
    ],
  },
  webpack: (config) => {
    // Fix Jotai multiple instances warning
    config.resolve.alias = {
      ...config.resolve.alias,
      jotai: require.resolve('jotai'),
    };
    return config;
  },
};

export default nextConfig;
