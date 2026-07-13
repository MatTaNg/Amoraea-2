/**
 * Node preload for scoring/rescore scripts that transitively import RN/Expo modules
 * (via @data/supabase/client and interview storage). Must run before app imports.
 *
 * Usage: node --import ./scripts/nodeRnStubs.mjs --import tsx ...
 * Or:    npx tsx --import ./scripts/nodeRnStubs.mjs ...
 */
import Module from 'node:module';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const asyncStorageStub = {
  __esModule: true,
  default: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
    clear: async () => undefined,
    getAllKeys: async () => [],
    multiGet: async () => [],
    multiSet: async () => undefined,
    multiRemove: async () => undefined,
  },
};

const expoConstantsStub = {
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      },
    },
  },
};

const reactNativeStub = {
  Platform: { OS: 'web', select: (spec) => spec?.web ?? spec?.default },
  Alert: { alert: () => undefined },
  StyleSheet: { create: (s) => s, hairlineWidth: 1, flatten: (s) => s },
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  Dimensions: {
    get: () => ({ width: 1280, height: 720, scale: 1, fontScale: 1 }),
    addEventListener: () => ({ remove: () => undefined }),
  },
  useWindowDimensions: () => ({ width: 1280, height: 720, scale: 1, fontScale: 1 }),
};

const stubs = new Map([
  ['react-native', reactNativeStub],
  ['@react-native-async-storage/async-storage', asyncStorageStub],
  ['expo-constants', expoConstantsStub],
]);

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (stubs.has(request)) return stubs.get(request);
  return originalLoad.call(this, request, parent, isMain);
};

// Also cover ESM resolution via Module.register hooks when available
try {
  const { register } = Module;
  if (typeof register === 'function') {
    // Keep CJS patch as primary; ESM native RN packages still hit _load via tsx.
  }
} catch {
  /* ignore */
}

// Touch require so createRequire stays referenced under tree-shaking tools
void require;
