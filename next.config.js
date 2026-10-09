const path = require('path');

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
        'node:sqlite',
        'sqlite',
        'sqlite3',
        'better-sqlite3',
        // Firebase Admin SDK - incompatible with Cloudflare Workers
        'firebase-admin',
        'firebase-admin/app',
        'firebase-admin/firestore',
        'firebase-admin/auth',
        'firebase-admin/storage',
        'google-auth-library',
        'googleapis',
        // undici uses process.versions.node at module init — crashes in Workers
        'undici',
        'cheerio',
        // Pattern matching for any sqlite-related modules
        ({ context, request }, callback) => {
          if (request && (
            request.includes('sqlite') || 
            request.includes('node:') ||
            request.startsWith('node:')
          )) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        }
      );

      // Force Firebase's browser (fetch-based) builds when compiling for the
      // server/SSR bundle. The Node builds pull in Node-only dependencies that
      // crash the Cloudflare Workers runtime:
      //   - `firebase/firestore` -> @grpc/proto-loader -> protobufjs/ext/descriptor
      //     -> `new Function()` => "EvalError: Code generation from strings disallowed"
      //   - `firebase/auth`, `firebase/storage`, `firebase/functions` -> undici
      //     => "ReferenceError: MessagePort is not defined"
      // The browser builds use the runtime's global `fetch` instead.
      const nodeModules = path.join(__dirname, 'node_modules');
      config.resolve.alias = {
        ...config.resolve.alias,
        '@firebase/firestore$': path.join(nodeModules, '@firebase/firestore/dist/index.esm2017.js'),
        '@firebase/firestore/lite$': path.join(nodeModules, '@firebase/firestore/dist/lite/index.browser.esm2017.js'),
        '@firebase/auth$': path.join(nodeModules, '@firebase/auth/dist/esm2017/index.js'),
        '@firebase/storage$': path.join(nodeModules, '@firebase/storage/dist/index.esm2017.js'),
        '@firebase/functions$': path.join(nodeModules, '@firebase/functions/dist/index.esm2017.js'),
        'firebase/firestore$': path.join(nodeModules, 'firebase/firestore/dist/esm/index.esm.js'),
        'firebase/firestore/lite$': path.join(nodeModules, 'firebase/firestore/lite/dist/esm/index.esm.js'),
        'firebase/auth$': path.join(nodeModules, 'firebase/auth/dist/esm/index.esm.js'),
        'firebase/storage$': path.join(nodeModules, 'firebase/storage/dist/esm/index.esm.js'),
        'firebase/functions$': path.join(nodeModules, 'firebase/functions/dist/esm/index.esm.js'),
      };
    }

    // Alias ajv to use a Workers-compatible stub that avoids new Function()
    config.resolve.alias = {
      ...config.resolve.alias,
      // Replace ajv's code-gen with safe interpreter-based version
    };

    // Set fallbacks for browser bundle
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      child_process: false,
      sqlite: false,
      'node:sqlite': false,
    };

    return config;
  },
};

module.exports = nextConfig;
