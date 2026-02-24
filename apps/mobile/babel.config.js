module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated plugin MUST be last
    plugins: ['nativewind/babel', 'react-native-reanimated/plugin'],
  };
};
