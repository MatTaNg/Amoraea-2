import type { SupabaseClient } from '@supabase/supabase-js';

import { applyElaborationAbsenceAfterNormalizeMoment4 } from '@features/aria/interviewElaborationAbsenceScoring';
import { personalMomentBundleWasScored } from '@features/aria/interviewCompletionGate';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { finalizePersonalMomentDepthSignals } from '@features/aria/personalMomentDepthSignals';
import { applyMoment4UnassessableNullRules } from '@features/aria/moment4UnassessableNullRules';
import { userTextFromTranscriptTurns } from '@features/aria/moment4AccountabilitySituationalExempt';
import { buildPersonalMomentScoringPrompt } from '@features/aria/personalMomentScoringPrompt';
import { inferPersonalMomentSlices } from '@features/aria/personalMomentSlices';
import {
  sanitizePersonalMomentScoresForAggregate,
  type PersonalMomentSliceForSanitize,
} from '@features/aria/personalMomentSliceSanitize';
import {
  applyMoment4PostParseCoercionAndSalvage,
  backfillMoment4KeyEvidenceIfScoresOtherwiseUnpersistable,
  fillMoment4KeyEvidenceWhenNumericScoreButMissingQuote,
  mergeMoment4PillarScoresAfterEvidenceNormalize,
  normalizeScoresByEvidence,
} from '@features/aria/probeAndScoringUtils';
import {
  DEFERRED_MOMENT_ANTHROPIC_TIMEOUT_MS,
  MOMENT_4_HANDOFF,
} from '@features/aria/scoreInterviewModuleConstants';
import {
  finalizePersonalMomentMentalizingOvercertaintyFromModel,
  normalizePersonalMomentContemptTierBreakdown,
  type PersonalMomentScoreResult,
} from '@features/aria/scoreInterviewScoringHelpers';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';
import { fetchWithTimeout } from '@utilities/fetchWithTimeout';
import { parseJsonObjectFromModelText } from '@utilities/parseHolisticModelJson';
import {
  persistMoment4ScoresImmediate,
  type AttemptScoringBaseline,
} from '@utilities/persistPersonalMomentScoresIncremental';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { withRetry } from '@utilities/withRetry';

function logM4Debug(msg: string, data?: Record<string, unknown>) {
  if (__DEV__) console.log(`[M4 Debug] ${msg}`, data ?? '');
}

export type ScoreAndPersistMoment4SliceParams = {
  apiUrl: string;
  headers: Record<string, string>;
  msgs: MessageWithScenario[];
  userId: string | undefined;
  attemptId: string | null;
  scoringBaseline: AttemptScoringBaseline;
  supabase: SupabaseClient;
  deferredMoment4Narrative: string | null;
  moment4SpecificityScoring: unknown;
  /** Log context label, e.g. `standard deferred moment 4` or `live m5-entry moment 4`. */
  retryContext: string;
  /**
   * Transcript used for elaboration / depth soft metrics.
   * Live M5-entry scoring should pass M4-only (or pre-M5) turns so M5 answers do not skew averages.
   */
  elaborationAvgTranscript?: MessageWithScenario[];
  clearDeferredMoment4Narrative?: () => void;
};

export type ScoreAndPersistMoment4SliceResult = {
  moment4ForAggregate: ReturnType<typeof sanitizePersonalMomentScoresForAggregate> | null;
  scoringBaseline: AttemptScoringBaseline;
  skippedNoUserTurns: boolean;
};

/** Score Moment 4 from the frozen personal-moment slice and optionally persist immediately. */
export async function scoreAndPersistMoment4Slice(
  params: ScoreAndPersistMoment4SliceParams,
): Promise<ScoreAndPersistMoment4SliceResult> {
  const {
    apiUrl,
    headers,
    msgs,
    userId,
    attemptId,
    supabase,
    deferredMoment4Narrative,
    moment4SpecificityScoring,
    retryContext,
    clearDeferredMoment4Narrative,
  } = params;
  let scoringBaseline = params.scoringBaseline;
  const elaborationAvgTranscript = params.elaborationAvgTranscript ?? msgs;

  const personalSlices = inferPersonalMomentSlices(msgs);
  const slice = personalSlices.moment4;
  const userTurnsM4 = slice.filter((m) => m.role === 'user').length;
  logM4Debug('m4_infer', {
    retryContext,
    transcriptLen: msgs.length,
    m4Start: personalSlices.m4Start,
    m5Start: personalSlices.m5Start,
    moment4SliceLen: slice.length,
    moment4UserTurns: userTurnsM4,
  });

  if (userTurnsM4 < 1) {
    logM4Debug('m4_skipped_no_user_turns', { retryContext, userTurnsM4 });
    return { moment4ForAggregate: null, scoringBaseline, skippedNoUserTurns: true };
  }

  const scoringSlice = deferredMoment4Narrative
    ? [
        slice[0] ?? { role: 'assistant', content: MOMENT_4_HANDOFF },
        { role: 'user', content: deferredMoment4Narrative },
        ...slice.slice(1),
      ]
    : slice;
  const m4PromptBuilt = buildPersonalMomentScoringPrompt(scoringSlice, moment4SpecificityScoring);
  const m4ScoreStartedAt = Date.now();

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
            messages: [{ role: 'user', content: m4PromptBuilt }],
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
        const parsedM4 = parseJsonObjectFromModelText(raw) as PersonalMomentScoreResult;
        applyMoment4PostParseCoercionAndSalvage(raw, parsedM4 as unknown as Record<string, unknown>);
        parsedM4.pillarScores = mergeMoment4PillarScoresAfterEvidenceNormalize(
          normalizeScoresByEvidence(
            parsedM4.pillarScores as Record<string, unknown>,
            parsedM4.keyEvidence,
          ),
        ) as PersonalMomentScoreResult['pillarScores'];
        fillMoment4KeyEvidenceWhenNumericScoreButMissingQuote(parsedM4);
        const depthModifierMeta = applyElaborationAbsenceAfterNormalizeMoment4(
          parsedM4,
          scoringSlice,
          moment4SpecificityScoring as import('@features/aria/personalMomentScoringPrompt').Moment4ClientScoringMetadata | null,
          elaborationAvgTranscript,
        );
        void remoteLog('[SCORING_DEPTH_MODIFIER]', {
          scoring_slice: 'moment_4',
          ...depthModifierMeta,
        });
        normalizePersonalMomentContemptTierBreakdown(parsedM4);
        finalizePersonalMomentMentalizingOvercertaintyFromModel(parsedM4);
        finalizePersonalMomentDepthSignals(parsedM4, {
          rawModelText: raw,
          transcript: elaborationAvgTranscript,
          scoringSlice,
          moment: 4,
        });
        applyMoment4UnassessableNullRules({
          pillarScores: parsedM4.pillarScores as Record<string, number | null | undefined>,
          keyEvidence: parsedM4.keyEvidence ?? {},
          pillarConfidence: parsedM4.pillarConfidence as Record<string, string> | undefined,
          response_concreteness: parsedM4.response_concreteness,
          userText: userTextFromTranscriptTurns(scoringSlice),
          lowSpecificityAfterProbe: (
            moment4SpecificityScoring as { lowSpecificityAfterProbe?: boolean } | null | undefined
          )?.lowSpecificityAfterProbe,
        });
        backfillMoment4KeyEvidenceIfScoresOtherwiseUnpersistable(parsedM4, {
          rawModelResponse: raw,
          parsedSnapshot: {
            pillarScores: parsedM4.pillarScores,
            keyEvidence: parsedM4.keyEvidence,
          },
        });
        return parsedM4;
      },
      {
        retries: 1,
        baseDelay: 4000,
        maxDelay: 12000,
        context: retryContext,
        sessionLog: userId
          ? {
              userId,
              attemptId: getSessionLogRuntime().attemptId,
              platform: getSessionLogRuntime().platform,
            }
          : undefined,
      },
    );

    logM4Debug('m4_scoring_finished', {
      retryContext,
      elapsedMs: Date.now() - m4ScoreStartedAt,
    });
    clearDeferredMoment4Narrative?.();

    let moment4ForAggregate = sanitizePersonalMomentScoresForAggregate(
      scored as unknown as PersonalMomentSliceForSanitize,
    );
    if (moment4ForAggregate && !personalMomentBundleWasScored(moment4ForAggregate)) {
      await remoteLog('[STANDARD] moment 4 slice not assessable after sanitize; storing null', {
        attemptId,
        retryContext,
      });
      moment4ForAggregate = null;
    } else if (moment4ForAggregate && attemptId && userId) {
      scoringBaseline = await persistMoment4ScoresImmediate(
        supabase,
        attemptId,
        userId,
        moment4ForAggregate,
        scoringBaseline,
        moment4SpecificityScoring,
      );
    }
    return { moment4ForAggregate, scoringBaseline, skippedNoUserTurns: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.slice(0, 1200) : undefined;
    await remoteLog('[STANDARD] moment 4 scoring failed', { message, stack, retryContext });
    if (__DEV__) {
      console.error('[M4 Debug] moment 4 scoring threw:', err);
    }
    return { moment4ForAggregate: null, scoringBaseline, skippedNoUserTurns: false };
  }
}

/** Hydrate a scored M4 aggregate from an already-persisted attempt baseline row. */
export function moment4AggregateFromBaselinePatterns(
  patterns: Record<string, unknown>,
): ReturnType<typeof sanitizePersonalMomentScoresForAggregate> | null {
  const raw = patterns.moment_4_scores;
  if (!personalMomentBundleWasScored(raw)) return null;
  return sanitizePersonalMomentScoresForAggregate(raw as PersonalMomentSliceForSanitize);
}
