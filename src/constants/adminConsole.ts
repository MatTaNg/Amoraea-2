/** Single account used for in-app admin dashboard (matches RLS migrations / edge functions). */
export const AMORAEA_ADMIN_CONSOLE_EMAIL = 'admin@amoraea.com' as const;

export function isAmoraeaAdminConsoleEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === AMORAEA_ADMIN_CONSOLE_EMAIL;
}

/** Alias for call sites that already use this name (e.g. edge function parity). */
export const ADMIN_CONSOLE_EMAIL = AMORAEA_ADMIN_CONSOLE_EMAIL;
