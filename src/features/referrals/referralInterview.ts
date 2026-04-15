import { supabase } from '@data/supabase/client';
import { GATE_PASS_WEIGHTED_MIN, REFERRAL_WEIGHTED_PASS_MIN } from '@features/aria/computeGateResult';
import { generateShareableReferralCode } from './shareableReferralCode';

/**
 * Runs referral fulfillment (referred user completed interview), then returns the weighted
 * pass threshold to use for this completion's gate scoring.
 */
export async function resolveWeightedPassMinAfterReferralFulfillment(
  userId: string | null | undefined
): Promise<number> {
  if (!userId) return GATE_PASS_WEIGHTED_MIN;
  try {
    const { error: rpcErr } = await supabase.rpc('fulfill_referral_after_interview', {
      p_user_id: userId,
    });
    if (rpcErr && __DEV__) {
      console.warn('[referral] fulfill_referral_after_interview', rpcErr.message);
    }
  } catch (e) {
    if (__DEV__) console.warn('[referral] fulfill RPC failed', e);
  }

  const { data, error } = await supabase
    .from('users')
    .select('referral_boost_active')
    .eq('id', userId)
    .maybeSingle();

  if (error && __DEV__) {
    console.warn('[referral] fetch referral_boost_active', error.message);
  }
  return data?.referral_boost_active === true ? REFERRAL_WEIGHTED_PASS_MIN : GATE_PASS_WEIGHTED_MIN;
}

/** After a standard applicant finishes the interview, ensure they have one shareable referral row. */
export async function ensureShareableReferralCodeForReferrer(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  const { data: existing, error: selErr } = await supabase
    .from('referral_codes')
    .select('id')
    .eq('referrer_user_id', userId)
    .maybeSingle();

  if (selErr) {
    if (__DEV__) console.warn('[referral] select referral_codes', selErr.message);
    return;
  }
  if (existing?.id) return;

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateShareableReferralCode();
    const { error: insErr } = await supabase.from('referral_codes').insert({
      code,
      referrer_user_id: userId,
      fulfilled: false,
    });
    if (!insErr) return;
    if (insErr.code !== '23505' && __DEV__) {
      console.warn('[referral] insert referral_codes', insErr.message);
      return;
    }
  }
}
