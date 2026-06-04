const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package exports resolution (needed for expo-font and other SDK 54 packages)
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
