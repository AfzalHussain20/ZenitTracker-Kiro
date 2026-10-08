/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not set output: 'standalone' — OpenNext/Cloudflare Workers requires no output mode.
  // 'standalone' causes Next.js to emit a Pages Router manifest (_buildManifest.js with
  // only /_app and /_error) which breaks the App Router build on Cloudflare Workers.
  output: undefined,
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
