import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
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
        hostname: 'api.sahyak.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'crm.sahyak.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '13.60.24.220',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
