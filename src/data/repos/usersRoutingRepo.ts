import { supabase } from '@data/supabase/client';

/** Clear one-shot referral notice on `users`. */
export async function clearReferralNoticePending(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ referral_notice_pending: null })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

/** Legacy onboarding progress flags on `users` (not `profiles.profile_json`). */
export type UserOnboardingFlagsPatch = {
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  referralNoticePending?: string | null;
};

export async function updateUserOnboardingFlags(
  userId: string,
  patch: UserOnboardingFlagsPatch,
): Promise<void> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.onboardingStep !== undefined) row.onboarding_step = patch.onboardingStep;
  if (patch.onboardingCompleted !== undefined) row.onboarding_completed = patch.onboardingCompleted;
  if (patch.referralNoticePending !== undefined) {
    row.referral_notice_pending = patch.referralNoticePending;
  }
  if (Object.keys(row).length <= 1) return;
  const { error } = await supabase.from('users').update(row).eq('id', userId);
  if (error) throw new Error(`Failed to update onboarding flags: ${error.message}`);
}
