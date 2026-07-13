import type { MutableRefObject } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  applyElaborationAbsenceAfterNormalizeMoment4,
  applyElaborationAbsenceAfterNormalizeMoment5,
} from '@features/aria/interviewElaborationAbsenceScoring';
import { personalMomentBundleWasScored } from '@features/aria/interviewCompletionGate';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  buildMoment5AccountabilityScoringPrompt,
} from '@features/aria/moment5AccountabilityScoringPrompt';
import { resolveMoment5ClientScoringMeta } from '@features/aria/moment5ClientScoringMetaUtils';
import { moment5ScoringAllowed } from '@features/aria/moment5ScoringGuard';
import { finalizePersonalMomentDepthSignals } from '@features/aria/personalMomentDepthSignals';
import { applyMoment4UnassessableNullRules } from '@features/aria/moment4UnassessableNullRules';
import { userTextFromTranscriptTurns } from '@features/aria/moment4AccountabilitySituationalExempt';
import { buildPersonalMomentScoringPrompt } from '@features/aria/personalMomentScoringPrompt';
import { inferPersonalMomentSlices, resolveMoment5ScoringSlice } from '@features/aria/personalMomentSlices';
import {
  promoteMoment5LegacyContemptForScoringResult,
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from '@features/aria/personalMomentSliceSanitize';
import type {
  PersonalMoment5SliceForSanitize,
  PersonalMomentSliceForSanitize,
} from '@features/aria/personalMomentSliceSanitize';
import {
  applyMoment4PostParseCoercionAndSalvage,
  backfillMoment4KeyEvidenceIfScoresOtherwiseUnpersistable,
  fillMoment4KeyEvidenceWhenNumericScoreButMissingQuote,
  finalizeMoment5ParsedModelScore,
  mergeMoment4PillarScoresAfterEvidenceNormalize,
  mergeMoment5PillarScoresAfterEvidenceNormalize,
  normalizeScoresByEvidence,
  stampMoment5ScoringMetadata,
} from '@features/aria/probeAndScoringUtils';
import { MOMENT_4_HANDOFF } from '@features/aria/scoreInterviewModuleConstants';
import {
  finalizePersonalMomentMentalizingOvercertaintyFromModel,
  normalizePersonalMomentContemptTierBreakdown,
} from '@features/aria/scoreInterviewScoringHelpers';
import type { PersonalMomentScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';
import { parseJsonObjectFromModelText } from '@utilities/parseHolisticModelJson';
import {
  persistMoment4ScoresImmediate,
  persistMoment5ScoresImmediate,
} from '@utilities/persistPersonalMomentScoresIncremental';
import type { AttemptScoringBaseline } from '@utilities/persistPersonalMomentScoresIncremental';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { withRetry } from '@utilities/withRetry';

function logM4Debug(msg: string, data?: Record<string, unknown>) {
  if (__DEV__) console.log(`[M4 Debug] ${msg}`, data ?? '');
}

export type ScoreAlphaPersonalMomentsParams = {
  apiUrl: string;
  headers: Record<string, string>;
  finalMessages: MessageWithScenario[];
  userId: string;
  attemptIdForIncremental: string | null;
  scoringBaseline: AttemptScoringBaseline;
  supabase: SupabaseClient;
  deferredMoment4NarrativeRef: MutableRefObject<string | null>;
  moment4SpecificityScoringRef: MutableRefObject<unknown>;
  moment5ClientScoringMetaRef: MutableRefObject<unknown>;
  moment5AccountabilityProbeFiredRef: MutableRefObject<boolean>;
  probeLogRef?: MutableRefObject<unknown[]>;
  personalSlices: ReturnType<typeof inferPersonalMomentSlices>;
};

export type ScoreAlphaPersonalMomentsResult = {
  moment4ForAggregate: ReturnType<typeof sanitizePersonalMomentScoresForAggregate> | null;
  moment5ForAggregate: ReturnType<typeof sanitizeMoment5PersonalScoresForAggregate> | null;
  scoringBaseline: AttemptScoringBaseline;
  moment4Scored: boolean;
};

/** Score Moments 4–5 on the ALPHA_MODE completion path (before contempt enrich + gate). */
export async function scoreAlphaPersonalMoments(
  params: ScoreAlphaPersonalMomentsParams,
): Promise<ScoreAlphaPersonalMomentsResult> {
  const {
    apiUrl,
    headers,
    finalMessages,
    userId,
    attemptIdForIncremental,
    supabase,
    deferredMoment4NarrativeRef,
    moment4SpecificityScoringRef,
    moment5ClientScoringMetaRef,
    moment5AccountabilityProbeFiredRef,
    probeLogRef,
    personalSlices,
  } = params;
  let scoringBaseline = params.scoringBaseline;

  const alphaM4Users = personalSlices.moment4.filter((m) => m.role === 'user').length;
  logM4Debug('alpha_m4_infer', {
    transcriptLen: finalMessages.length,
    m4Start: personalSlices.m4Start,
    m5Start: personalSlices.m5Start,
    moment4SliceLen: personalSlices.moment4.length,
    moment4UserTurns: alphaM4Users,
  });
  logM4Debug('alpha_last_10_moments', {
    turns: finalMessages.slice(-10).map((m) => ({
      role: m.role,
      moment: m.interviewMoment ?? null,
      scenario: m.scenarioNumber ?? null,
      preview: (m.content ?? '').slice(0, 48),
    })),
  });
  logM4Debug('alpha_m4_gate', {
    moment4UserTurnsLength: alphaM4Users,
    willCallScorePersonalMoment: alphaM4Users >= 1,
  });

  const scorePersonalMoment = async (
    slice: { role: string; content: string }[],
  ): Promise<PersonalMomentScoreResult | null> => {
    const ut = slice.filter((m) => m.role === 'user').length;
    if (ut < 1) {
      logM4Debug('alpha_m4_score_fn_skipped', { userTurnsInSlice: ut });
      return null;
    }
    const deferredMoment4Narrative = deferredMoment4NarrativeRef.current;
    const scoringSlice = deferredMoment4Narrative
      ? [
          slice[0] ?? { role: 'assistant', content: MOMENT_4_HANDOFF },
          { role: 'user', content: deferredMoment4Narrative },
          ...slice.slice(1),
        ]
      : slice;
    const m4PromptAlpha = buildPersonalMomentScoringPrompt(scoringSlice, moment4SpecificityScoringRef.current);
    logM4Debug('alpha_m4_prompt', {
      promptLen: m4PromptAlpha.length,
      scoringSliceTurns: scoringSlice.length,
      scoringSliceJsonLen: JSON.stringify(scoringSlice).length,
    });
    const m4AlphaStartedAt = Date.now();
    try {
      const scored = await withRetry(
        async (): Promise<PersonalMomentScoreResult> => {
          logM4Debug('alpha_m4_claude_request', { at: Date.now() });
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: CLAUDE_SONNET_MODEL,
              max_tokens: 2048,
              messages: [{ role: 'user', content: m4PromptAlpha }],
            }),
          });
          const data = await res.json();
          logM4Debug('alpha_m4_claude_response', {
            ok: res.ok,
            status: res.status,
            contentBlocks: Array.isArray((data as { content?: unknown[] })?.content)
              ? (data as { content: unknown[] }).content.length
              : 0,
          });
          if (!res.ok) {
            const e = new Error(
              (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`,
            );
            (e as Error & { status?: number }).status = res.status;
            throw e;
          }
          const raw = (data.content?.[0]?.text ?? '{}') as string;
          const parsed = parseJsonObjectFromModelText(raw) as PersonalMomentScoreResult;
          applyMoment4PostParseCoercionAndSalvage(raw, parsed as unknown as Record<string, unknown>);
          parsed.pillarScores = mergeMoment4PillarScoresAfterEvidenceNormalize(
            normalizeScoresByEvidence(
              parsed.pillarScores as Record<string, unknown>,
              parsed.keyEvidence,
            ),
          ) as PersonalMomentScoreResult['pillarScores'];
          fillMoment4KeyEvidenceWhenNumericScoreButMissingQuote(parsed);
          const depthModifierMeta = applyElaborationAbsenceAfterNormalizeMoment4(
            parsed,
            scoringSlice,
            moment4SpecificityScoringRef.current,
            finalMessages,
          );
          void remoteLog('[SCORING_DEPTH_MODIFIER]', {
            scoring_slice: 'moment_4',
            ...depthModifierMeta,
          });
          normalizePersonalMomentContemptTierBreakdown(parsed);
          finalizePersonalMomentMentalizingOvercertaintyFromModel(parsed);
          finalizePersonalMomentDepthSignals(parsed, {
            rawModelText: raw,
            transcript: finalMessages,
            scoringSlice,
            moment: 4,
          });
          applyMoment4UnassessableNullRules({
            pillarScores: parsed.pillarScores as Record<string, number | null | undefined>,
            keyEvidence: parsed.keyEvidence ?? {},
            pillarConfidence: parsed.pillarConfidence as Record<string, string> | undefined,
            response_concreteness: parsed.response_concreteness,
            userText: userTextFromTranscriptTurns(scoringSlice),
            lowSpecificityAfterProbe: moment4SpecificityScoringRef.current?.lowSpecificityAfterProbe,
          });
          backfillMoment4KeyEvidenceIfScoresOtherwiseUnpersistable(parsed, {
            rawModelResponse: raw,
            parsedSnapshot: {
              pillarScores: parsed.pillarScores,
              keyEvidence: parsed.keyEvidence,
            },
          });
          logM4Debug('alpha_m4_model_parsed', {
            pillarKeys: parsed.pillarScores ? Object.keys(parsed.pillarScores) : [],
            keyEvidenceKeys: parsed.keyEvidence ? Object.keys(parsed.keyEvidence) : [],
          });
          return parsed;
        },
        {
          retries: 2,
          baseDelay: 5000,
          maxDelay: 20000,
          context: 'scoring personal moment 4',
          sessionLog: {
            userId,
            attemptId: getSessionLogRuntime().attemptId,
            platform: getSessionLogRuntime().platform,
          },
        },
      );
      logM4Debug('alpha_m4_scoring_finished', { elapsedMs: Date.now() - m4AlphaStartedAt });
      if (deferredMoment4NarrativeRef.current) {
        deferredMoment4NarrativeRef.current = null;
      }
      return scored;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack?.slice(0, 1200) : undefined;
      void remoteLog('[Alpha] moment 4 scoring failed', { message, stack });
      if (__DEV__) {
        console.error('[M4 Debug] alpha moment 4 scoring threw:', err);
      }
      return null;
    }
  };

  const moment4Score = await scorePersonalMoment(personalSlices.moment4);
  logM4Debug('alpha_m4_await_score_personal_done', { hasMoment4Score: moment4Score != null });
  let moment4ForAggregate = sanitizePersonalMomentScoresForAggregate(
    moment4Score as unknown as PersonalMomentSliceForSanitize,
  );
  if (moment4ForAggregate && !personalMomentBundleWasScored(moment4ForAggregate)) {
    if (__DEV__) console.warn('[Alpha] moment 4: slice not assessable after sanitize; treating as null');
    moment4ForAggregate = null;
  } else if (moment4ForAggregate && attemptIdForIncremental) {
    scoringBaseline = await persistMoment4ScoresImmediate(
      supabase,
      attemptIdForIncremental,
      userId,
      moment4ForAggregate,
      scoringBaseline,
      moment4SpecificityScoringRef.current,
    );
  }

  const scorePersonalMoment5 = async (
    slice: { role: string; content: string }[],
  ): Promise<PersonalMomentScoreResult | null> => {
    const m5ScoringGuard = { transcript: finalMessages, scoringSlice: slice };
    if (!moment5ScoringAllowed(finalMessages, slice)) {
      return null;
    }
    const m5Meta = resolveMoment5ClientScoringMeta(
      moment5ClientScoringMetaRef,
      moment5AccountabilityProbeFiredRef,
      { includeWarmAckFallback: true },
    );
    try {
      const scored = await withRetry(
        async (): Promise<PersonalMomentScoreResult> => {
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: CLAUDE_SONNET_MODEL,
              max_tokens: 900,
              messages: [{ role: 'user', content: buildMoment5AccountabilityScoringPrompt(slice, m5Meta) }],
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
          const scoredVia = finalizeMoment5ParsedModelScore(raw, parsed as unknown as Record<string, unknown>, m5ScoringGuard, {
            rawModelResponse: raw,
            parsedSnapshot: {
              pillarScores: parsed.pillarScores,
              keyEvidence: parsed.keyEvidence,
            },
            attemptId: attemptIdForIncremental ?? undefined,
          });
          void remoteLog('[M5_SCORING_PATH]', {
            attemptId: attemptIdForIncremental,
            scoredVia,
            sliceUserTurns: slice.filter((m) => m.role === 'user').length,
          });
          promoteMoment5LegacyContemptForScoringResult(parsed);
          parsed.pillarScores = mergeMoment5PillarScoresAfterEvidenceNormalize(
            normalizeScoresByEvidence(parsed.pillarScores, parsed.keyEvidence),
          ) as PersonalMomentScoreResult['pillarScores'];
          const depthModifierMeta = applyElaborationAbsenceAfterNormalizeMoment5(
            parsed,
            slice,
            finalMessages,
            m5Meta,
          );
          void remoteLog('[SCORING_DEPTH_MODIFIER]', {
            scoring_slice: 'moment_5',
            ...depthModifierMeta,
          });
          normalizePersonalMomentContemptTierBreakdown(parsed);
          finalizePersonalMomentMentalizingOvercertaintyFromModel(parsed);
          finalizePersonalMomentDepthSignals(parsed, {
            rawModelText: raw,
            transcript: finalMessages,
            scoringSlice: slice,
            moment: 5,
          });
          stampMoment5ScoringMetadata(parsed as unknown as Record<string, unknown>, scoredVia, m5Meta);
          return parsed;
        },
        {
          retries: 2,
          baseDelay: 5000,
          maxDelay: 20000,
          context: 'scoring personal moment 5',
          sessionLog: {
            userId,
            attemptId: getSessionLogRuntime().attemptId,
            platform: getSessionLogRuntime().platform,
          },
        },
      );
      return scored;
    } catch (err) {
      if (__DEV__) console.warn('Personal moment 5 scoring failed:', err);
      return null;
    }
  };

  const moment5Score = await scorePersonalMoment5(resolveMoment5ScoringSlice(finalMessages));
  let moment5ForAggregate = sanitizeMoment5PersonalScoresForAggregate(
    moment5Score as unknown as PersonalMoment5SliceForSanitize,
  );
  if (moment5ForAggregate && !personalMomentBundleWasScored(moment5ForAggregate)) {
    if (__DEV__) console.warn('[Alpha] moment 5: slice not assessable after sanitize; treating as null');
    moment5ForAggregate = null;
  } else if (moment5ForAggregate && attemptIdForIncremental) {
    scoringBaseline = await persistMoment5ScoresImmediate(
      supabase,
      attemptIdForIncremental,
      userId,
      moment5ForAggregate,
      scoringBaseline,
      {
        ...(resolveMoment5ClientScoringMeta(
          moment5ClientScoringMetaRef,
          moment5AccountabilityProbeFiredRef,
        ) as Record<string, unknown>),
        ...(moment5ForAggregate.scoringMetadata ?? {}),
      },
      probeLogRef?.current != null ? { probe_log: [...probeLogRef.current] } : undefined,
    );
  }

  return {
    moment4ForAggregate,
    moment5ForAggregate,
    scoringBaseline,
    moment4Scored: moment4Score !== null,
  };
}
