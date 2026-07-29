import { supabase } from '@data/supabase/client';

/** Dev-only scenario jump is gated to this account email. */
export const DEV_SCENARIO_JUMP_EMAIL = 'mattang5280@gmail.com';

export type DevScenarioJumpTarget = 1 | 2 | 3 | 4;

export function normalizeDevScenarioJumpEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isDevScenarioJumpEmail(email: string | null | undefined): boolean {
  return normalizeDevScenarioJumpEmail(email ?? '') === DEV_SCENARIO_JUMP_EMAIL;
}

/** True when the referral field is exactly "1", "2", "3", or "4" (any email). */
export function isBareDevScenarioJumpReferralCode(referralCode: string): boolean {
  const raw = referralCode.trim();
  if (!/^[1-4]$/.test(raw)) return false;
  return Number.parseInt(raw, 10) >= 1 && Number.parseInt(raw, 10) <= 4;
}

/**
 * Returns scenario jump target (1–4) when email + referral match the dev gate; otherwise null.
 * Referral codes 1–4 are not valid for any other email.
 */
export function parseDevScenarioJumpReferralCode(
  email: string | null | undefined,
  referralCode: string | null | undefined,
): DevScenarioJumpTarget | null {
  if (!isDevScenarioJumpEmail(email)) return null;
  const raw = (referralCode ?? '').trim();
  if (!isBareDevScenarioJumpReferralCode(raw)) return null;
  return Number.parseInt(raw, 10) as DevScenarioJumpTarget;
}

export async function resolveDevScenarioJumpTargetFromSession(
  userEmail: string | null | undefined,
): Promise<DevScenarioJumpTarget | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const email = userEmail ?? session?.user?.email ?? null;
  const meta = session?.user?.user_metadata as { referral_code?: string } | undefined;
  return parseDevScenarioJumpReferralCode(email, meta?.referral_code);
}
