import type {
  LoadStandardResultsReferralCodeDeps,
  LoadStandardResultsReferralCodeTrigger,
} from '@features/aria/interviewPostScoringEffectsTypes';

export type LoadStandardResultsReferralCodeSignal = {
  isCancelled: () => boolean;
};

export async function runLoadStandardResultsReferralCode(
  deps: LoadStandardResultsReferralCodeDeps,
  trigger: LoadStandardResultsReferralCodeTrigger,
  signal: LoadStandardResultsReferralCodeSignal,
): Promise<void> {
  if (trigger.status !== 'results' || !trigger.userId) {
    deps.setStandardResultsReferralCode(null);
    return;
  }
  if (trigger.isAdmin || deps.isAmoraeaAdminConsoleEmail(trigger.userEmail)) {
    deps.setStandardResultsReferralCode(null);
    return;
  }
  const { data } = await deps.supabase
    .from('users')
    .select('invite_code')
    .eq('id', trigger.userId)
    .maybeSingle();
  if (!signal.isCancelled()) {
    deps.setStandardResultsReferralCode(typeof data?.invite_code === 'string' ? data.invite_code : null);
  }
}
