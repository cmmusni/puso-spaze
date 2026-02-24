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

module.exports = config;
