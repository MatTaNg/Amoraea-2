import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { webAuthNoopLock } from './webAuthNoopLock';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

/**
 * Default auth-js uses `navigator.locks` + an AbortSignal timeout; when the lock cannot be acquired
 * in time, `abort()` surfaces as an uncaught `AbortError` in the console. Expo web / HMR can exacerbate
 * contention. A no-op lock is supported by GoTrue (see `lock` in auth options) and is acceptable when
 * only one tab is the primary session writer (typical for this app).
 */

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    /** Web only: parse email-confirm / OAuth tokens from the URL when user lands on redirect URL. */
    detectSessionInUrl: Platform.OS === 'web',
    ...(Platform.OS === 'web' ? { lock: webAuthNoopLock } : {}),
  },
});

