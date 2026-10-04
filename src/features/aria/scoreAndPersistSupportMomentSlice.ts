import type { SupabaseClient } from '@supabase/supabase-js';

import { personalMomentBundleWasScored } from '@features/aria/interviewCompletionGate';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  sanitizeSupportMomentScoresForAggregate,
  type PersonalMomentSupportSliceForSanitize,
} from '@features/aria/personalMomentSliceSanitize';
import { normalizeScoresByEvidence } from '@features/aria/probeAndScoringUtils';
import { DEFERRED_MOMENT_ANTHROPIC_TIMEOUT_MS } from '@features/aria/scoreInterviewModuleConstants';
import {
  finalizePersonalMomentMentalizingOvercertaintyFromModel,
  type PersonalMomentScoreResult,
} from '@features/aria/scoreInterviewScoringHelpers';
import {
  buildSupportMomentScoringPrompt,
  extractSupportMomentTranscriptTurns,
} from '@features/aria/supportMomentScoringPrompt';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';
import { fetchWithTimeout } from '@utilities/fetchWithTimeout';
import { parseJsonObjectFromModelText } from '@utilities/parseHolisticModelJson';
import {
  persistMomentSupportScoresImmediate,
  type AttemptScoringBaseline,
} from '@utilities/persistPersonalMomentScoresIncremental';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { withRetry } from '@utilities/withRetry';

export type ScoreAndPersistSupportMomentSliceParams = {
  apiUrl: string;
  headers: Record<string, string>;
  msgs: MessageWithScenario[];
  userId: string | undefined;
  attemptId: string | null;
  scoringBaseline: AttemptScoringBaseline;
  supabase: SupabaseClient;
};

export type ScoreAndPersistSupportMomentSliceResult = {
  supportForAggregate: ReturnType<typeof sanitizeSupportMomentScoresForAggregate> | null;
  scoringBaseline: AttemptScoringBaseline;
  skippedNoUserTurns: boolean;
};

export function supportMomentAggregateFromBaselinePatterns(
  patterns: Record<string, unknown>,
): ReturnType<typeof sanitizeSupportMomentScoresForAggregate> | null {
  const raw = patterns.moment_support_scores;
  if (!personalMomentBundleWasScored(raw)) return null;
  return sanitizeSupportMomentScoresForAggregate(raw as PersonalMomentSupportSliceForSanitize);
}

/** Score the autobiographical support moment and persist into scenario_specific_patterns. */
export async function scoreAndPersistSupportMomentSlice(
  params: ScoreAndPersistSupportMomentSliceParams,
): Promise<ScoreAndPersistSupportMomentSliceResult> {
  const { apiUrl, headers, msgs, userId, attemptId, supabase } = params;
  let scoringBaseline = params.scoringBaseline;

  const hydrated = supportMomentAggregateFromBaselinePatterns(scoringBaseline.patterns);
  if (hydrated) {
    return { supportForAggregate: hydrated, scoringBaseline, skippedNoUserTurns: false };
  }

  const slice = extractSupportMomentTranscriptTurns(msgs);
  const userTurns = slice.filter((m) => m.role === 'user').length;
  if (userTurns < 1) {
    return { supportForAggregate: null, scoringBaseline, skippedNoUserTurns: true };
  }

  const prompt = buildSupportMomentScoringPrompt(slice);
  try {
    const scored = await withRetry(
      async (): Promise<PersonalMomentScoreResult> => {
        const res = await fetchWithTimeout(apiUrl, {
          method: 'POST',
          headers,
          timeoutMs: DEFERRED_MOMENT_ANTHROPIC_TIMEOUT_MS,
          body: JSON.stringify({
            model: CLAUDE_SONNET_MODEL,
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const e = new Error(
            (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`,
          );
          (e as Error & { status?: number }).status = res.status;
          throw e;
        }
        const raw = (data.content?.[0]?.text ?? '{}') as string;
        const parsed = parseJsonObjectFromModelText(raw) as PersonalMomentScoreResult;
        parsed.pillarScores = normalizeScoresByEvidence(
          parsed.pillarScores as Record<string, unknown>,
          parsed.keyEvidence,
        ) as PersonalMomentScoreResult['pillarScores'];
        finalizePersonalMomentMentalizingOvercertaintyFromModel(parsed);
        return parsed;
      },
      {
        retries: 1,
        baseDelay: 4000,
        maxDelay: 12000,
        context: 'standard deferred support moment',
        sessionLog: userId
          ? {
              userId,
              attemptId: getSessionLogRuntime().attemptId,
              platform: getSessionLogRuntime().platform,
            }
          : undefined,
      },
    );

    let supportForAggregate = sanitizeSupportMomentScoresForAggregate(
      scored as unknown as PersonalMomentSupportSliceForSanitize,
    );
    if (supportForAggregate && !personalMomentBundleWasScored(supportForAggregate)) {
      await remoteLog('[STANDARD] support moment slice not assessable after sanitize; storing null', {
        attemptId,
      });
      supportForAggregate = null;
    } else if (supportForAggregate && attemptId && userId) {
      scoringBaseline = await persistMomentSupportScoresImmediate(
        supabase,
        attemptId,
        userId,
        supportForAggregate,
        scoringBaseline,
      );
    }
    return { supportForAggregate, scoringBaseline, skippedNoUserTurns: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await remoteLog('[STANDARD] support moment scoring failed', { message, attemptId });
    return { supportForAggregate: null, scoringBaseline, skippedNoUserTurns: false };
  }
}
