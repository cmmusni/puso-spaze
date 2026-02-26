// metro.config.js — Expo + NativeWind v2 Metro configuration
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Monorepo root (two levels up from apps/mobile)
const monorepoRoot = path.resolve(__dirname, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Watch the shared packages/ folder so Metro can resolve ../../../packages/types
config.watchFolders = [monorepoRoot];

// Resolve modules from both the app dir and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// NativeWind v2: ensure CSS/PostCSS transforms don't run through Babel on web
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// Prioritize React Native and browser versions over Node.js versions
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Force axios to use browser build instead of Node.js build
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'axios') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/axios/dist/browser/axios.cjs'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Provide empty shims for Node.js built-in modules that don't exist in React Native
// This forces packages like axios to use their browser/React Native compatible builds
// Note: crypto is NOT shimmed because we use react-native-get-random-values polyfill
const emptyShim = path.resolve(__dirname, 'metro-shims/empty.js');
config.resolver.extraNodeModules = {
  stream: emptyShim,
  http: emptyShim,
  https: emptyShim,
  http2: emptyShim,
  events: emptyShim,
  zlib: emptyShim,
  url: emptyShim,
  net: emptyShim,
  tls: emptyShim,
  fs: emptyShim,
  path: emptyShim,
  'form-data': emptyShim,
  'proxy-from-env': emptyShim,
};

module.exports = config;
