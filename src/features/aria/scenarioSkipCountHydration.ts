import type { MutableRefObject } from 'react';

import { SKIP_AUTO_FAIL_COUNT } from '@config/scoring/interviewSkipPenalties';
import { supabase } from '@data/supabase/client';
import { computeSkipPenaltyGateComputation } from '@features/aria/interviewSkipPenalties';
import {
  looksLikeFrustrationSkipConfirmationAffirmative,
  looksLikeSkipConfirmationAssistantPrompt,
  looksLikeSkipConfirmationDecline,
} from '@features/aria/metaCommentSkipFrustration';

export type ScenarioSkipTranscriptTurn = {
  role: string;
  content?: string;
  scenarioNumber?: number;
  interviewMoment?: number;
};

export function parseStoredScenarioSkipCount(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.min(SKIP_AUTO_FAIL_COUNT, Math.floor(raw)));
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(SKIP_AUTO_FAIL_COUNT, Math.floor(parsed)));
    }
  }
  return 0;
}

/** Confirmed skips (scenarios 1–3 and Moment 5) from skip-confirmation prompt + affirmative user reply. */
export function countConfirmedScenarioSkipsFromTranscript(
  messages: ReadonlyArray<ScenarioSkipTranscriptTurn>,
): number {
  let count = 0;
  for (let i = 0; i < messages.length - 1; i++) {
    const assistant = messages[i];
    const user = messages[i + 1];
    if (assistant?.role !== 'assistant' || user?.role !== 'user') continue;
    const assistantContent = typeof assistant.content === 'string' ? assistant.content : '';
    if (!looksLikeSkipConfirmationAssistantPrompt(assistantContent)) continue;
    const userContent = typeof user.content === 'string' ? user.content : '';
    if (looksLikeSkipConfirmationDecline(userContent)) continue;
    if (!looksLikeFrustrationSkipConfirmationAffirmative(userContent)) continue;
    const moment = user.interviewMoment ?? assistant.interviewMoment;
    // Moment 4 (grudge/threshold) does not use the scenario skip ladder.
    if (moment === 4) continue;
    count++;
  }
  return Math.min(SKIP_AUTO_FAIL_COUNT, count);
}

export function resolveScenarioSkipConfirmedCount(input: {
  refCount?: number;
  storedCount?: unknown;
  dbSkipCount?: unknown;
  transcriptMessages?: ReadonlyArray<ScenarioSkipTranscriptTurn>;
}): number {
  const fromTranscript = countConfirmedScenarioSkipsFromTranscript(input.transcriptMessages ?? []);
  const resolved = Math.max(
    parseStoredScenarioSkipCount(input.refCount),
    parseStoredScenarioSkipCount(input.storedCount),
    parseStoredScenarioSkipCount(input.dbSkipCount),
    fromTranscript,
  );
  return Math.max(0, Math.min(SKIP_AUTO_FAIL_COUNT, resolved));
}

export function applyScenarioSkipConfirmedCountToRefs(
  count: number,
  refs: {
    scenarioSkipConfirmedCountRef: MutableRefObject<number>;
    scenarioSkipPenaltySumRef?: MutableRefObject<number>;
  },
): number {
  const resolved = Math.max(0, Math.min(SKIP_AUTO_FAIL_COUNT, Math.floor(count)));
  refs.scenarioSkipConfirmedCountRef.current = resolved;
  if (refs.scenarioSkipPenaltySumRef) {
    refs.scenarioSkipPenaltySumRef.current =
      computeSkipPenaltyGateComputation(resolved).skip_penalty_total;
  }
  return resolved;
}

export async function hydrateScenarioSkipConfirmedCount(params: {
  scenarioSkipConfirmedCountRef: MutableRefObject<number>;
  scenarioSkipPenaltySumRef?: MutableRefObject<number>;
  transcriptMessages: ReadonlyArray<ScenarioSkipTranscriptTurn>;
  storedCount?: unknown;
  attemptId?: string | null;
  userId?: string | null;
}): Promise<number> {
  let dbSkipCount: unknown = null;
  if (params.attemptId && params.userId) {
    const { data } = await supabase
      .from('interview_attempts')
      .select('skip_count')
      .eq('id', params.attemptId)
      .eq('user_id', params.userId)
      .maybeSingle();
    dbSkipCount = data?.skip_count ?? null;
  }
  const resolved = resolveScenarioSkipConfirmedCount({
    refCount: params.scenarioSkipConfirmedCountRef.current,
    storedCount: params.storedCount,
    dbSkipCount,
    transcriptMessages: params.transcriptMessages,
  });
  return applyScenarioSkipConfirmedCountToRefs(resolved, params);
}

export function skipPenaltyPersistFieldsFromConfirmedCount(count: number): {
  skip_count: number;
  skip_penalties: (number | null)[];
  skip_penalty_total: number;
  auto_failed: boolean;
  auto_fail_reason: string | null;
} {
  const snap = computeSkipPenaltyGateComputation(count);
  return {
    skip_count: snap.skips_taken,
    skip_penalties: snap.skip_penalties,
    skip_penalty_total: snap.skip_penalty_total,
    auto_failed: snap.skipAutoFail,
    auto_fail_reason: snap.skipAutoFail ? 'exceeded_skip_limit' : null,
  };
}
