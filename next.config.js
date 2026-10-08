/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not set output: 'standalone' — OpenNext/Cloudflare Workers requires no output mode.
  output: undefined,
  swcMinify: true,
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
    // Externalize native/OS modules that can't run in Next.js build environment
    config.externals.push(
      'usb',
      'node-hid',
      'serialport',
      'adb',
      'node:sqlite',
    );

    // Prevent browser-only or OS-only modules from being bundled for the server
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
