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
            '@/src/types': './src/datingProfile/types/index.ts',
            '@/data/services': './src/datingProfile/data/services',
            '@/data/assessments': './src/datingProfile/data/assessments',
            '@/screens/assessments': './src/datingProfile/screens/assessments',
            '@/screens/onboarding': './src/datingProfile/screens/onboarding',
            '@/screens/profile': './src/screens/profile',
            '@app': './src/app',
            '@features': './src/features',
            '@domain': './src/domain',
            '@data': './src/data',
            '@ui': './src/ui',
            '@utilities': './src/utilities',
            /** Must be last: prefix `@` otherwise steals `@/screens/...` → `src/screens/...` (missing). */
            '@': './src',
          },
        },
      ],
    ],
  };
};

