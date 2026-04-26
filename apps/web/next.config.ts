import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'steamcommunity-a.akamaihd.net' },
      { protocol: 'https', hostname: 'community.cloudflare.steamstatic.com' },
      { protocol: 'https', hostname: 'csfloat.com' },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
