/** Inject EXPO_PUBLIC_* into app extra so production `expo export -p web` bundles Supabase + proxy URLs. */
const appJson = require('./app.json');

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    anthropicProxyUrl: process.env.EXPO_PUBLIC_ANTHROPIC_PROXY_URL ?? '',
  },
});
