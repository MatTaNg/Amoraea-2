import type { MutableRefObject } from 'react';

import { supabase } from '@data/supabase/client';
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_PROXY_URL,
  buildAnthropicMessagesHeaders,
  getAnthropicEndpoint,
} from '@features/aria/anthropicClientConfig';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { inferPersonalMomentSlices } from '@features/aria/personalMomentSlices';
import {
  moment4AggregateFromBaselinePatterns,
  scoreAndPersistMoment4Slice,
} from '@features/aria/scoreAndPersistMoment4Slice';
import {
  fetchAttemptScoringBaseline,
  type AttemptScoringBaseline,
} from '@utilities/persistPersonalMomentScoresIncremental';
import { remoteLog } from '@utilities/remoteLog';

const liveM4InFlightByAttempt = new Map<string, Promise<void>>();

/** Await an in-flight live M4 score for this attempt (no-op if none). */
export async function awaitLiveMoment4ScoringIfPending(attemptId: string | null | undefined): Promise<void> {
  if (!attemptId) return;
  const pending = liveM4InFlightByAttempt.get(attemptId);
  if (!pending) return;
  try {
    await pending;
  } catch {
    // Live scoring logs its own failures; deferred path may retry.
  }
}

/** Clears in-flight live M4 scoring registry (progress reset / tests). */
export function clearLiveMoment4ScoringRegistry(): void {
  liveM4InFlightByAttempt.clear();
}

/** @deprecated Use {@link clearLiveMoment4ScoringRegistry}. */
export function resetLiveMoment4ScoringRegistryForTests(): void {
  clearLiveMoment4ScoringRegistry();
}

export type TriggerLiveMoment4ScoringOnM5EntryParams = {
  trigger: string;
  userId: string | undefined | null;
  isAdmin: boolean;
  attemptId: string | null | undefined;
  messages: ReadonlyArray<MessageWithScenario | { role: string; content: string; interviewMoment?: number }>;
  deferredMoment4NarrativeRef: MutableRefObject<string | null>;
  moment4SpecificityScoringRef: MutableRefObject<unknown>;
};

/**
 * Fire-and-forget Moment 4 scoring when Moment 5 begins.
 * Deduped per attempt so inject / reconcile / resume paths can all call safely.
 */
export function triggerLiveMoment4ScoringOnM5Entry(params: TriggerLiveMoment4ScoringOnM5EntryParams): void {
  const {
    trigger,
    userId,
    isAdmin,
    attemptId,
    messages,
    deferredMoment4NarrativeRef,
    moment4SpecificityScoringRef,
  } = params;

  if (!userId || isAdmin || !attemptId) return;
  if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) return;
  if (liveM4InFlightByAttempt.has(attemptId)) return;

  const msgs = messages as MessageWithScenario[];
  const personalSlices = inferPersonalMomentSlices(msgs);
  const m4UserTurns = personalSlices.moment4.filter((m) => m.role === 'user').length;
  if (m4UserTurns < 1) {
    void remoteLog('[LIVE_M4_SCORE] skipped_no_user_turns', { attemptId, trigger });
    return;
  }

  const run = (async () => {
    void remoteLog('[LIVE_M4_SCORE] start', {
      attemptId,
      trigger,
      m4UserTurns,
      transcriptLen: msgs.length,
    });
    let scoringBaseline: AttemptScoringBaseline = await fetchAttemptScoringBaseline(
      supabase,
      attemptId,
      userId,
    );
    const already = moment4AggregateFromBaselinePatterns(scoringBaseline.patterns);
    if (already) {
      void remoteLog('[LIVE_M4_SCORE] already_persisted', { attemptId, trigger });
      return;
    }

    // Prefer the frozen M4 slice (excludes M5 user turns) for soft metrics.
    const elaborationAvgTranscript = personalSlices.moment4 as MessageWithScenario[];
    const apiUrl = getAnthropicEndpoint();
    const headers = buildAnthropicMessagesHeaders({ apiUrl });
    const result = await scoreAndPersistMoment4Slice({
      apiUrl,
      headers,
      msgs,
      userId,
      attemptId,
      scoringBaseline,
      supabase,
      deferredMoment4Narrative: deferredMoment4NarrativeRef.current,
      moment4SpecificityScoring: moment4SpecificityScoringRef.current,
      retryContext: 'live m5-entry moment 4',
      elaborationAvgTranscript,
      clearDeferredMoment4Narrative: () => {
        if (deferredMoment4NarrativeRef.current) deferredMoment4NarrativeRef.current = null;
      },
    });
    void remoteLog('[LIVE_M4_SCORE] done', {
      attemptId,
      trigger,
      persisted: !!result.moment4ForAggregate,
      skippedNoUserTurns: result.skippedNoUserTurns,
    });
  })().finally(() => {
    liveM4InFlightByAttempt.delete(attemptId);
  });

  liveM4InFlightByAttempt.set(attemptId, run);
  void run;
}
