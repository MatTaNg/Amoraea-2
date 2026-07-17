import type { MutableRefObject } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { applyElaborationAbsenceAfterNormalizeMoment5 } from '@features/aria/interviewElaborationAbsenceScoring';
import { personalMomentBundleWasScored } from '@features/aria/interviewCompletionGate';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  buildMoment5AccountabilityScoringPrompt,
} from '@features/aria/moment5AccountabilityScoringPrompt';
import { resolveMoment5ClientScoringMeta } from '@features/aria/moment5ClientScoringMetaUtils';
import { moment5ScoringAllowed } from '@features/aria/moment5ScoringGuard';
import { logMoment5ScoringDiagnostics } from '@features/aria/moment5TranscriptHelpers';
import {
  diagnoseMoment5ScoringGuard,
} from '@features/aria/resolveInterviewTranscriptForCompletionScoring';
import { finalizePersonalMomentDepthSignals } from '@features/aria/personalMomentDepthSignals';
import {
  awaitLiveMoment4ScoringIfPending,
} from '@features/aria/liveMoment4ScoringOnM5Entry';
import { resolveMoment5ScoringSlice } from '@features/aria/personalMomentSlices';
import {
  promoteMoment5LegacyContemptForScoringResult,
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from '@features/aria/personalMomentSliceSanitize';
import type {
  PersonalMoment5SliceForSanitize,
} from '@features/aria/personalMomentSliceSanitize';
import {
  finalizeMoment5ParsedModelScore,
  mergeMoment5PillarScoresAfterEvidenceNormalize,
  normalizeScoresByEvidence,
  stampMoment5ScoringMetadata,
} from '@features/aria/probeAndScoringUtils';
import {
  DEFERRED_MOMENT_ANTHROPIC_TIMEOUT_MS,
} from '@features/aria/scoreInterviewModuleConstants';
import {
  finalizePersonalMomentMentalizingOvercertaintyFromModel,
  normalizePersonalMomentContemptTierBreakdown,
} from '@features/aria/scoreInterviewScoringHelpers';
import type { PersonalMomentScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import {
  moment4AggregateFromBaselinePatterns,
  scoreAndPersistMoment4Slice,
} from '@features/aria/scoreAndPersistMoment4Slice';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';
import { fetchWithTimeout } from '@utilities/fetchWithTimeout';
import { parseJsonObjectFromModelText } from '@utilities/parseHolisticModelJson';
import {
  fetchAttemptScoringBaseline,
  persistMoment5ScoresImmediate,
} from '@utilities/persistPersonalMomentScoresIncremental';
import type { AttemptScoringBaseline } from '@utilities/persistPersonalMomentScoresIncremental';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { withRetry } from '@utilities/withRetry';

function logM4Debug(msg: string, data?: Record<string, unknown>) {
  if (__DEV__) console.log(`[M4 Debug] ${msg}`, data ?? '');
}

export type ScoreStandardDeferredPersonalMomentsParams = {
  apiUrl: string;
  headers: Record<string, string>;
  msgsDeferred: MessageWithScenario[];
  userId: string | undefined;
  attemptIdForIncremental: string | null;
  interviewSessionAttemptId: string | null;
  scoringBaseline: AttemptScoringBaseline;
  supabase: SupabaseClient;
  deferredMoment4NarrativeRef: MutableRefObject<string | null>;
  moment4SpecificityScoringRef: MutableRefObject<unknown>;
  moment5ClientScoringMetaRef: MutableRefObject<unknown>;
  moment5AccountabilityProbeFiredRef: MutableRefObject<boolean>;
  probeLogRef?: MutableRefObject<unknown[]>;
};

export type ScoreStandardDeferredPersonalMomentsResult = {
  moment4ForAggregate: ReturnType<typeof sanitizePersonalMomentScoresForAggregate> | null;
  moment5ForAggregate: ReturnType<typeof sanitizeMoment5PersonalScoresForAggregate> | null;
  scoringBaseline: AttemptScoringBaseline;
};

/** Score Moments 4–5 on the standard onboarding deferred path (before completion gate). */
export async function scoreStandardDeferredPersonalMoments(
  params: ScoreStandardDeferredPersonalMomentsParams,
): Promise<ScoreStandardDeferredPersonalMomentsResult> {
  const {
    apiUrl,
    headers,
    msgsDeferred,
    userId,
    attemptIdForIncremental,
    interviewSessionAttemptId,
    supabase,
    deferredMoment4NarrativeRef,
    moment4SpecificityScoringRef,
    moment5ClientScoringMetaRef,
    moment5AccountabilityProbeFiredRef,
    probeLogRef,
  } = params;
  let scoringBaseline = params.scoringBaseline;
  let moment4ForAggregate: ReturnType<typeof sanitizePersonalMomentScoresForAggregate> | null = null;
  let moment5ForAggregate: ReturnType<typeof sanitizeMoment5PersonalScoresForAggregate> | null = null;

  await awaitLiveMoment4ScoringIfPending(attemptIdForIncremental);
  if (attemptIdForIncremental && userId) {
    scoringBaseline = await fetchAttemptScoringBaseline(supabase, attemptIdForIncremental, userId);
  }
  const hydratedLiveM4 = moment4AggregateFromBaselinePatterns(scoringBaseline.patterns);
  if (hydratedLiveM4) {
    moment4ForAggregate = hydratedLiveM4;
    logM4Debug('standard_deferred_m4_skipped_already_persisted', {
      attemptId: attemptIdForIncremental,
    });
    void remoteLog('[STANDARD] moment 4 already persisted (live m5-entry); skipping rescore', {
      attemptId: interviewSessionAttemptId ?? attemptIdForIncremental,
    });
  } else {
    const m4Result = await scoreAndPersistMoment4Slice({
      apiUrl,
      headers,
      msgs: msgsDeferred,
      userId,
      attemptId: attemptIdForIncremental,
      scoringBaseline,
      supabase,
      deferredMoment4Narrative: deferredMoment4NarrativeRef.current,
      moment4SpecificityScoring: moment4SpecificityScoringRef.current,
      retryContext: 'standard deferred moment 4',
      elaborationAvgTranscript: msgsDeferred,
      clearDeferredMoment4Narrative: () => {
        if (deferredMoment4NarrativeRef.current) deferredMoment4NarrativeRef.current = null;
      },
    });
    moment4ForAggregate = m4Result.moment4ForAggregate;
    scoringBaseline = m4Result.scoringBaseline;
  }

  const sliceM5 = resolveMoment5ScoringSlice(msgsDeferred);
  const m5ScoringGuard = { transcript: msgsDeferred, scoringSlice: sliceM5 };
  const m5GuardDiag = diagnoseMoment5ScoringGuard(msgsDeferred, sliceM5);
  const m5DiagPayload = logMoment5ScoringDiagnostics(
    interviewSessionAttemptId ?? attemptIdForIncremental,
    msgsDeferred,
    sliceM5,
    { ...m5GuardDiag, moment5ScoringAllowed: m5GuardDiag.allowed },
  );
  void remoteLog('[M5_SCORING_GUARD]', m5DiagPayload);
  if (moment5ScoringAllowed(msgsDeferred, sliceM5)) {
    console.log(`[M5] Primary path called for attempt ${interviewSessionAttemptId ?? attemptIdForIncremental ?? 'unknown'}`);
    const m5Meta = resolveMoment5ClientScoringMeta(
      moment5ClientScoringMetaRef,
      moment5AccountabilityProbeFiredRef,
      { includeWarmAckFallback: true },
    );
    try {
      const scoredM5 = await withRetry(
        async (): Promise<PersonalMomentScoreResult> => {
          const res = await fetchWithTimeout(apiUrl, {
            method: 'POST',
            headers,
            timeoutMs: DEFERRED_MOMENT_ANTHROPIC_TIMEOUT_MS,
            body: JSON.stringify({
              model: CLAUDE_SONNET_MODEL,
              // Match M4: keyEvidence + contempt_tier_breakdown routinely exceed 900 tokens and truncate mid-JSON.
              max_tokens: 2048,
              messages: [{ role: 'user', content: buildMoment5AccountabilityScoringPrompt(sliceM5, m5Meta) }],
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
          const parsedM5 = parseJsonObjectFromModelText(raw) as PersonalMomentScoreResult;
          const scoredVia = finalizeMoment5ParsedModelScore(raw, parsedM5 as unknown as Record<string, unknown>, m5ScoringGuard, {
            rawModelResponse: raw,
            parsedSnapshot: {
              pillarScores: parsedM5.pillarScores,
              keyEvidence: parsedM5.keyEvidence,
            },
            attemptId: interviewSessionAttemptId ?? attemptIdForIncremental ?? undefined,
          });
          void remoteLog('[M5_SCORING_PATH]', {
            attemptId: interviewSessionAttemptId,
            scoredVia,
            sliceUserTurns: sliceM5.filter((m) => m.role === 'user').length,
          });
          promoteMoment5LegacyContemptForScoringResult(parsedM5);
          parsedM5.pillarScores = mergeMoment5PillarScoresAfterEvidenceNormalize(
            normalizeScoresByEvidence(parsedM5.pillarScores, parsedM5.keyEvidence),
          ) as PersonalMomentScoreResult['pillarScores'];
          const depthModifierMeta = applyElaborationAbsenceAfterNormalizeMoment5(
            parsedM5,
            sliceM5,
            msgsDeferred,
            m5Meta,
          );
          void remoteLog('[SCORING_DEPTH_MODIFIER]', {
            scoring_slice: 'moment_5',
            ...depthModifierMeta,
          });
          normalizePersonalMomentContemptTierBreakdown(parsedM5);
          finalizePersonalMomentMentalizingOvercertaintyFromModel(parsedM5);
          finalizePersonalMomentDepthSignals(parsedM5, {
            rawModelText: raw,
            transcript: msgsDeferred,
            scoringSlice: sliceM5,
            moment: 5,
          });
          stampMoment5ScoringMetadata(parsedM5 as unknown as Record<string, unknown>, scoredVia, m5Meta);
          return parsedM5;
        },
        {
          retries: 1,
          baseDelay: 4000,
          maxDelay: 12000,
          context: 'standard deferred moment 5',
          sessionLog: userId
            ? {
                userId,
                attemptId: getSessionLogRuntime().attemptId,
                platform: getSessionLogRuntime().platform,
              }
            : undefined,
        },
      );
      moment5ForAggregate = sanitizeMoment5PersonalScoresForAggregate(
        scoredM5 as unknown as PersonalMoment5SliceForSanitize,
      );
      if (moment5ForAggregate && !personalMomentBundleWasScored(moment5ForAggregate)) {
        await remoteLog('[STANDARD] moment 5 slice not assessable after sanitize; storing null', {
          attemptId: interviewSessionAttemptId,
        });
        moment5ForAggregate = null;
      } else if (moment5ForAggregate && attemptIdForIncremental && userId) {
        const m5ScoringMetadata = {
          ...(resolveMoment5ClientScoringMeta(
            moment5ClientScoringMetaRef,
            moment5AccountabilityProbeFiredRef,
          ) as Record<string, unknown>),
          ...(moment5ForAggregate.scoringMetadata ?? {}),
        };
        const accountabilityScore =
          typeof moment5ForAggregate.pillarScores?.accountability === 'number'
            ? moment5ForAggregate.pillarScores.accountability
            : 0;
        if (probeLogRef?.current?.length) {
          for (const entry of probeLogRef.current) {
            if (
              entry &&
              typeof entry === 'object' &&
              (entry as { construct?: string }).construct === 'accountability' &&
              (entry as { probe_fired?: boolean }).probe_fired === true
            ) {
              const e = entry as {
                post_probe_score?: number;
                pre_probe_score?: number;
                score_delta?: number;
              };
              e.post_probe_score = accountabilityScore;
              e.score_delta =
                accountabilityScore - (typeof e.pre_probe_score === 'number' ? e.pre_probe_score : 0);
            }
          }
        }
        scoringBaseline = await persistMoment5ScoresImmediate(
          supabase,
          attemptIdForIncremental,
          userId,
          moment5ForAggregate,
          scoringBaseline,
          m5ScoringMetadata,
          probeLogRef?.current != null ? { probe_log: [...probeLogRef.current] } : undefined,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `Attempt ${interviewSessionAttemptId ?? attemptIdForIncremental ?? 'unknown'}: M5 primary scoring failed:`,
        err,
      );
      await remoteLog('[STANDARD] moment 5 scoring failed', { message });
    }
  } else {
    console.log(
      `[M5] RECOVERY path skipped — primary scoring not called for attempt ${interviewSessionAttemptId ?? attemptIdForIncremental ?? 'unknown'}`,
    );
    void remoteLog('[M5_SCORING_SKIPPED]', {
      attemptId: interviewSessionAttemptId ?? attemptIdForIncremental,
      reason: m5GuardDiag.skipReason ?? 'no_assessable_user_response',
      ...m5GuardDiag,
      transcriptLen: msgsDeferred.length,
      lastTurnPreviews: msgsDeferred.slice(-4).map((m) => ({
        role: m.role,
        moment: m.interviewMoment ?? null,
        preview: (m.content ?? '').slice(0, 64),
      })),
    });
    if (interviewSessionAttemptId ?? attemptIdForIncremental) {
      console.warn(
        `Attempt ${interviewSessionAttemptId ?? attemptIdForIncremental}: No M5 user response — skipping M5 scoring`,
      );
    }
  }

  return { moment4ForAggregate, moment5ForAggregate, scoringBaseline };
}
