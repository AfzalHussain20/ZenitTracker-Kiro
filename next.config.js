/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not set output: 'standalone' — OpenNext/Cloudflare Workers requires no output mode.
  output: undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Show full error details in production for debugging
  productionBrowserSourceMaps: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  compiler: {
    removeConsole: false,
  },
  webpack: (config, { isServer }) => {
    // Externalize modules that can't run in Cloudflare Workers environment
    if (isServer) {
      config.externals.push(
        'child_process',
        'fs',
        'path',
        'spawn',
        'usb',
        'node-hid', 
        'serialport',
        'adb',
        'node:sqlite'
      );
    }

    // Set fallbacks for browser bundle
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      child_process: false,
    };

    return config;
  },
};

module.exports = nextConfig;
