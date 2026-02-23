module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@app': './src/app',
            '@features': './src/features',
            '@domain': './src/domain',
            '@data': './src/data',
            '@ui': './src/ui',
            '@utilities': './src/utilities',
          },
        },
      ],
    ],
  };
};

