import {
  updateUserInterviewApplication,
} from '@data/repos/usersInterviewRepo';
import {
  supabase,
} from '@data/supabase/client';
import {
  computeGateResult,
} from '@features/aria/computeGateResult';
import {
  ADMIN_PASS_EMAIL,
  ADMIN_PASS_PHRASE,
} from '@features/aria/interviewAdminConfig';
import {
  FALLBACK_MARKER_SCORES_ALL_MARKERS,
} from '@features/aria/interviewSessionUtilities';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  showSimpleAlert,
} from '@utilities/alerts/confirmDialog';

export type PreClaudeAdminPassGateResult = {
  handled: boolean;
};

/** Admin secret pass: skip interview and auto-approve for configured email (onboarding only). */
export async function runPreClaudeAdminPassGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): Promise<PreClaudeAdminPassGateResult> {
  if (!deps.isInterviewAppRoute || trimmed !== ADMIN_PASS_PHRASE) {
    return { handled: false };
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const email = (session?.user?.email ?? '').toLowerCase();
    if (email !== ADMIN_PASS_EMAIL.toLowerCase()) {
      return { handled: false };
    }

    await updateUserInterviewApplication(deps.userId, {
      applicationStatus: 'approved',
      onboardingStage: 'complete',
    });
    deps.invalidateProfileQuery();
    deps.setVoiceState('idle');
    const adminPassGate = computeGateResult({ ...FALLBACK_MARKER_SCORES_ALL_MARKERS });
    deps.setResults({
      pillarScores: { ...FALLBACK_MARKER_SCORES_ALL_MARKERS },
      keyEvidence: {},
      narrativeCoherence: 'high',
      behavioralSpecificity: 'high',
      notableInconsistencies: [],
      interviewSummary: 'Admin pass — interview skipped. Scores are illustrative.',
      gateResult: adminPassGate,
    });
    deps.setInterviewStatus('congratulations');
    deps.setStatus('results');
    return { handled: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not skip interview.';
    showSimpleAlert('Admin pass failed', msg);
    deps.setVoiceState('idle');
    return { handled: true };
  }
}
