import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  ...(isDev ? {} : {
    output: 'export',
    trailingSlash: true,
  }),
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.coresetu.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'crm.coresetu.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '13.51.219.53',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
