import { supabase } from '@data/supabase/client';
import { GATE_PASS_WEIGHTED_MIN, REFERRAL_WEIGHTED_PASS_MIN } from '@features/aria/computeGateResult';

export const REFERRAL_BASE_DISCOUNT = 40;
export const REFERRAL_STEP_DISCOUNT = 20;
export const REFERRAL_MAX_DISCOUNT = 100;
export const REFERRAL_SIGNUP_BONUS_DISCOUNT = REFERRAL_STEP_DISCOUNT;

/** Discount unlocked by finishing the interview + psychometrics (no referral signup bonus). */
export function resolveBaseCompletionDiscount(): number {
  return REFERRAL_BASE_DISCOUNT;
}

/** Total completion discount when the user signed up with a valid referral code. */
export function resolveProspectiveCompletionDiscount(signedUpWithReferral: boolean): number {
  return signedUpWithReferral
    ? REFERRAL_BASE_DISCOUNT + REFERRAL_SIGNUP_BONUS_DISCOUNT
    : REFERRAL_BASE_DISCOUNT;
}

/** Applies referral fulfillment after interview + psychometric completion (best-effort). */
export async function applyReferralCompletionEffects(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  try {
    const { error: rpcErr } = await supabase.rpc('apply_referral_completion_effects', {
      p_user_id: userId,
    });
    if (rpcErr && __DEV__) {
      console.warn('[referral] apply_referral_completion_effects', rpcErr.message);
    }
  } catch (e) {
    if (__DEV__) console.warn('[referral] fulfill RPC failed', e);
  }
}

/**
 * Returns the weighted pass threshold to use for gate scoring based on referral flags.
 * Referral discount fulfillment runs only after psychometrics via {@link applyReferralCompletionEffects}.
 */
export async function resolveWeightedPassMinAfterReferralEffects(
  userId: string | null | undefined
): Promise<number> {
  if (!userId) return GATE_PASS_WEIGHTED_MIN;

  const { data, error } = await supabase
    .from('users')
    .select('referral_boost_active, referred_by_id')
    .eq('id', userId)
    .maybeSingle();

  if (error && __DEV__) {
    console.warn('[referral] fetch referral weighting flags', error.message);
  }
  return data?.referral_boost_active === true || !!data?.referred_by_id
    ? REFERRAL_WEIGHTED_PASS_MIN
    : GATE_PASS_WEIGHTED_MIN;
}

export type ReferralDiscountStatus = {
  referralCode: string | null;
  signedUpWithReferral: boolean;
  completedReferrals: number;
  progressCurrent: number;
  progressTotal: number;
  remainingReferralsToCap: number;
  totalDiscount: number;
  atCap: boolean;
  fullyComplete: boolean;
};

export function buildReferralShareMessage(referralCode: string): string {
  return `I just completed my relationship assessment on Amoraea. Use my code ${referralCode} when you sign up — when you finish the interview and psychometric assessments, we both get an extra 20% off. amoraea.com`;
}

/** Canonical referral status for post-interview discount UI. */
export async function fetchReferralDiscountStatus(
  userId: string | null | undefined,
): Promise<ReferralDiscountStatus | null> {
  if (!userId) return null;
  const { data, error } = await supabase.rpc('get_referral_discount_status', {
    p_user_id: userId,
  });
  if (error) {
    if (__DEV__) console.warn('[referral] get_referral_discount_status', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  return {
    referralCode: typeof record.referral_code === 'string' ? record.referral_code : null,
    signedUpWithReferral: record.signed_up_with_referral === true,
    completedReferrals:
      typeof record.completed_referrals === 'number' ? record.completed_referrals : 0,
    progressCurrent: typeof record.progress_current === 'number' ? record.progress_current : 0,
    progressTotal: typeof record.progress_total === 'number' ? record.progress_total : 3,
    remainingReferralsToCap:
      typeof record.remaining_referrals_to_cap === 'number'
        ? record.remaining_referrals_to_cap
        : 0,
    totalDiscount: typeof record.total_discount === 'number' ? record.total_discount : 0,
    atCap: record.at_cap === true,
    fullyComplete: record.fully_complete === true,
  };
}
