/** @type {import('next').NextConfig} */
const nextConfig = {
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
    // Skip problematic modules during build
    config.externals.push(
      'usb',
      'node-hid',
      'serialport',
      'adb'
    );
    return config;
  },
  experimental: {
    esmExternals: true,
  },
};

module.exports = nextConfig;
