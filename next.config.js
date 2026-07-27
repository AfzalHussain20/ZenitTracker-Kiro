/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  swcMinify: true,
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
