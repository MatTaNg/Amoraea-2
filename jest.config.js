module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/fixtures/', 'GateTestHelpers\\.ts$'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@data/(.*)$': '<rootDir>/src/data/$1',
    '^@ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@utilities/(.*)$': '<rootDir>/src/utilities/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@config$': '<rootDir>/src/config/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'supabase/functions/_shared/computeGateResultCore.ts',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  /** Guardrails for high-value pure logic; full-app % stays low. */
  coverageThreshold: {
    'src/data/repositories/CompatibilityRepository.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    'src/features/aria/utils/elevenLabsEnvGating.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    'supabase/functions/_shared/computeGateResultCore.ts': {
      statements: 90,
      branches: 80,
      functions: 100,
      lines: 90,
    },
    'src/features/compatibility/styleCompatibilityScore.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};

