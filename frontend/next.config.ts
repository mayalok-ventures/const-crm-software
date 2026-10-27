import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "path";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

function baseConfig(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER || process.env.NODE_ENV === 'development';

  return {
    devIndicators: false,
    onDemandEntries: {
      maxInactiveAge: 1000 * 60 * 60 * 24, // Retain compiled pages in memory for 24h
      pagesBufferLength: 50, // Retain all 37 CRM routes in memory without discarding
    },
    outputFileTracingRoot: path.join(__dirname, '..'),
    experimental: {
      optimizePackageImports: ['lucide-react', 'recharts', 'date-fns', 'axios'],
    },
    turbopack: {},
    // Apply static export for production builds targeted for Cloudflare Pages / Workers
    ...(!isDev ? {
      output: 'export',
      trailingSlash: true,
    } : {}),
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
      ],
    },
  };
}

export default function nextConfig(phase: string): NextConfig {
  const config = baseConfig(phase);
  return withSerwist(config);
}
