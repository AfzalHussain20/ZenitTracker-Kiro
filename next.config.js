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
    config.externals.push(
      'usb',
      'node-hid',
      'serialport',
      'adb',
      'child_process',
      'fs',
      'path'
    );
    
    // Prevent file from being bundled
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      child_process: false,
    };
    
    return config;
  },
  experimental: {
    esmExternals: true,
  },
};

module.exports = nextConfig;
