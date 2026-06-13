import { useEffect, useState } from 'react';

import {
  fetchLatestCompletedInterviewAttemptAt,
  formatInterviewRetakeEligibleDate,
  shouldShowPostInterviewRetake,
} from '@features/interview/interviewRetake';
import { isQaRetakeSignupCode } from '@features/onboarding/qaRetake';
import { supabase } from '@data/supabase/client';
import {
  USER_INTERVIEW_ROUTING_TABLE,
  USER_POST_INTERVIEW_CONTACT_SELECT,
} from '@data/supabase/userInterviewRoutingSelect';

type PostInterviewRetakeState = {
  showRetake: boolean;
  retakeEligibleOnLabel: string | null;
  loading: boolean;
};

export function usePostInterviewRetakeEligibility(userId: string | undefined): PostInterviewRetakeState {
  const [showRetake, setShowRetake] = useState(false);
  const [retakeEligibleOnLabel, setRetakeEligibleOnLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setShowRetake(false);
      setRetakeEligibleOnLabel(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? userId;
        const meta = auth.user?.user_metadata as { referral_code?: string } | undefined;

        const [{ data: userRow }, latestCompletedAttemptAt] = await Promise.all([
          supabase
            .from(USER_INTERVIEW_ROUTING_TABLE)
            .select(USER_POST_INTERVIEW_CONTACT_SELECT)
            .eq('id', uid)
            .maybeSingle(),
          fetchLatestCompletedInterviewAttemptAt(uid),
        ]);

        if (cancelled) return;

        const completedAtRaw =
          latestCompletedAttemptAt ??
          (typeof userRow?.interview_completed_at === 'string' ? userRow.interview_completed_at : null);

        setRetakeEligibleOnLabel(
          completedAtRaw ? formatInterviewRetakeEligibleDate(completedAtRaw) : null,
        );
        setShowRetake(
          shouldShowPostInterviewRetake({
            referralSignupCode: meta?.referral_code,
            interviewRetakeAdminAllowedAt:
              typeof userRow?.interview_retake_admin_allowed_at === 'string'
                ? userRow.interview_retake_admin_allowed_at
                : null,
            latestCompletedAttemptAt,
            interviewCompletedAt:
              typeof userRow?.interview_completed_at === 'string'
                ? userRow.interview_completed_at
                : null,
            isQaRetakeSignupCode,
          }),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { showRetake, retakeEligibleOnLabel, loading };
}
