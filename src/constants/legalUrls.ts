/** Public legal pages — override via env for staging if needed. */
export const LEGAL_PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://amoraea.com/privacy';
export const LEGAL_TERMS_OF_SERVICE_URL =
  process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL ?? 'https://amoraea.com/terms';
