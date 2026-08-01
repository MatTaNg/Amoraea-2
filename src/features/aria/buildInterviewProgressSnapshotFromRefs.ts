import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { mergeScenarioOpeningDeliveredFromPlaybackConfirmed, lastQuestionTextIndicatesScenarioOpeningDelivered, mergeScenarioOpeningDeliveredFor } from '@features/aria/scenarioDeliveryResumeCheckpoint';
import type { ShowScenarioCardCanonicalPlaybackConfirmedKinds } from '@features/aria/showScenarioCardCanonicalTts';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import { takeInterviewAudioInterruptedByBackground } from '@features/aria/interviewLocalPersistence';
import { getCurrentScenario } from '@utilities/storage/InterviewStorage';

export type InterviewProgressSnapshotRefs = {
  currentMessagesRef?: MutableRefObject<
    Array<{ role: string; content: string; isScoreCard?: boolean; isWelcomeBack?: boolean }>
  >;
  scoredScenariosRef?: MutableRefObject<Set<number>>;
  scenarioScoresRef?: MutableRefObject<Record<number, ScenarioScoreResult>>;
  currentScenarioRef?: MutableRefObject<number>;
  resumeActiveScenarioRef?: MutableRefObject<1 | 2 | 3 | null>;
  lastQuestionTextRef?: MutableRefObject<string | null>;
  showScenarioCardCanonicalPlaybackConfirmedKindsRef?: MutableRefObject<ShowScenarioCardCanonicalPlaybackConfirmedKinds>;
  scenarioSkipConfirmedCountRef?: MutableRefObject<number>;
};

function readRefCurrent<T>(ref: MutableRefObject<T> | undefined, fallback: T): T {
  return ref?.current ?? fallback;
}

export function buildInterviewProgressSnapshotFromRefs(
  refs: InterviewProgressSnapshotRefs,
): InterviewProgressSnapshotPayload {
  const messages = readRefCurrent(refs.currentMessagesRef, []).filter(
    (m) => !m.isScoreCard && !m.isWelcomeBack,
  );
  const scoredScenarios = readRefCurrent(refs.scoredScenariosRef, new Set<number>());
  const scenariosCompleted = Array.from(scoredScenarios);
  const scenarioScores: InterviewProgressSnapshotPayload['scenarioScores'] = {};
  const scenarioScoresByNumber = readRefCurrent(refs.scenarioScoresRef, {} as Record<number, ScenarioScoreResult>);
  [1, 2, 3].forEach((n) => {
    const s = scenarioScoresByNumber[n];
    if (s) {
      scenarioScores[n] = {
        pillarScores: s.pillarScores,
        pillarConfidence: s.pillarConfidence,
        keyEvidence: s.keyEvidence,
        scenarioName: s.scenarioName,
      };
    }
  });
  const currentScenarioValue = readRefCurrent(refs.currentScenarioRef, 0);
  const resumeActiveScenarioValue = readRefCurrent(refs.resumeActiveScenarioRef, null);
  const lastQuestionText = readRefCurrent(refs.lastQuestionTextRef, null)?.trim() || null;
  const scenarioOpeningDeliveredFor = mergeScenarioOpeningDeliveredFromPlaybackConfirmed(
    undefined,
    readRefCurrent(refs.showScenarioCardCanonicalPlaybackConfirmedKindsRef, undefined),
  );
  const skipRefCount = readRefCurrent(refs.scenarioSkipConfirmedCountRef, 0);
  return {
    messages,
    scenariosCompleted,
    scenarioScores,
    currentScenario:
      currentScenarioValue === 1 || currentScenarioValue === 2 || currentScenarioValue === 3
        ? currentScenarioValue
        : getCurrentScenario(scoredScenarios),
    resumeActiveScenario:
      resumeActiveScenarioValue ??
      (currentScenarioValue === 1 || currentScenarioValue === 2 || currentScenarioValue === 3
        ? (currentScenarioValue as 1 | 2 | 3)
        : null),
    lastQuestionText,
    scenarioOpeningDeliveredFor:
      scenarioOpeningDeliveredFor.length > 0 ? scenarioOpeningDeliveredFor : undefined,
    scenarioSkipConfirmedCount: skipRefCount > 0 ? skipRefCount : undefined,
  };
}

export type InterviewProgressSaveFn = (
  userId: string,
  data: Record<string, unknown>,
) => void | Promise<void>;

export type InterviewProgressSnapshotPayload = {
  messages: Array<{ role: string; content: string }>;
  scenariosCompleted: number[];
  scenarioScores: Record<
    number,
    {
      pillarScores: Record<string, number | null>;
      pillarConfidence: Record<string, string>;
      keyEvidence: Record<string, string>;
      scenarioName?: string;
    }
  >;
  currentScenario: ReturnType<typeof getCurrentScenario>;
  resumeActiveScenario: 1 | 2 | 3 | null;
  lastQuestionText?: string | null;
  scenarioOpeningDeliveredFor?: Array<1 | 2 | 3>;
  scenarioSkipConfirmedCount?: number;
};

export type InterviewUnhandledRejectionSaveDeps = InterviewProgressSnapshotRefs & {
  userId: string | undefined;
  statusRef: MutableRefObject<string>;
  saveInterviewProgress: InterviewProgressSaveFn;
};

export function runHandleInterviewUnhandledRejection(
  deps: InterviewUnhandledRejectionSaveDeps,
  event: PromiseRejectionEvent,
): void {
  const err = event.reason;
  event.preventDefault();
  if (__DEV__) console.error('Unhandled rejection caught by safety net:', err);
  const active =
    deps.statusRef?.current === 'active' || deps.statusRef?.current === 'scoring';
  if (!active || !deps.userId) return;
  try {
    const snapshot = buildInterviewProgressSnapshotFromRefs(deps);
    deps.saveInterviewProgress(deps.userId, {
      ...snapshot,
      emergencySave: true,
      savedAt: new Date().toISOString(),
    });
  } catch {
    // emergency save failed
  }
}

export type InterviewAuthSignedOutSaveDeps = InterviewProgressSnapshotRefs & {
  userId: string | undefined;
  supabase: SupabaseClient;
  saveInterviewProgress: InterviewProgressSaveFn;
  setSessionExpired: Dispatch<SetStateAction<boolean>>;
};

export type InterviewNavigationAwayFlushDeps = InterviewProgressSnapshotRefs & {
  userId: string | undefined;
  isAdmin?: boolean;
  interviewStatusRef: MutableRefObject<string>;
  interviewSessionAttemptIdRef?: MutableRefObject<string | null>;
  currentScenarioRef?: MutableRefObject<number>;
  saveInterviewProgress: InterviewProgressSaveFn;
};

function stripScenarioOpeningCheckpointAfterTtsInterrupt(
  snapshot: InterviewProgressSnapshotPayload,
  deps: InterviewNavigationAwayFlushDeps,
): InterviewProgressSnapshotPayload {
  const scenario = deps.currentScenarioRef?.current;
  if (scenario !== 1 && scenario !== 2 && scenario !== 3) return snapshot;
  const nextOpening = snapshot.scenarioOpeningDeliveredFor?.filter((s) => s !== scenario);
  const kind =
    scenario === 1 ? 'situation_1' : scenario === 2 ? 'situation_2' : 'situation_3';
  if (deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current?.[kind]) {
    const confirmed = { ...deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current };
    delete confirmed[kind];
    deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = confirmed;
  }
  return {
    ...snapshot,
    scenarioOpeningDeliveredFor:
      nextOpening && nextOpening.length > 0 ? nextOpening : undefined,
  };
}

/** Best-effort checkpoint before Android back / navigation pops the interview screen. */
export function flushInterviewProgressForNavigationAway(
  deps: InterviewNavigationAwayFlushDeps,
): void {
  if (!deps.userId || deps.isAdmin) return;
  if (deps.interviewStatusRef.current !== 'in_progress') {
    return;
  }
  try {
    const interrupted = takeInterviewAudioInterruptedByBackground();
    let snapshot = buildInterviewProgressSnapshotFromRefs(deps);
    if (interrupted === 'tts') {
      snapshot = stripScenarioOpeningCheckpointAfterTtsInterrupt(snapshot, deps);
    } else {
      const scenario = deps.currentScenarioRef?.current;
      if (
        (scenario === 1 || scenario === 2 || scenario === 3) &&
        lastQuestionTextIndicatesScenarioOpeningDelivered(snapshot.lastQuestionText, scenario)
      ) {
        snapshot = {
          ...snapshot,
          scenarioOpeningDeliveredFor: mergeScenarioOpeningDeliveredFor(
            snapshot.scenarioOpeningDeliveredFor,
            scenario,
          ),
        };
      }
    }
    const playbackConfirmed =
      deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current ?? {};
    void deps.saveInterviewProgress(deps.userId, {
      ...snapshot,
      sessionAttemptId: deps.interviewSessionAttemptIdRef?.current ?? undefined,
      navigationAwayFlush: true,
      navigationAwayAudioInterrupt: interrupted ?? undefined,
      backgroundProgressFlush: interrupted != null,
    });
  } catch {
    // best-effort
  }
}

export function installInterviewAuthSignedOutSaveListener(
  depsRef: MutableRefObject<InterviewAuthSignedOutSaveDeps>,
): () => void {
  const {
    data: { subscription },
  } = depsRef.current.supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'TOKEN_REFRESHED') {
      if (__DEV__) console.log('Auth token refreshed');
    }
    if (event === 'SIGNED_OUT') {
      const deps = depsRef.current;
      try {
        const snapshot = buildInterviewProgressSnapshotFromRefs(deps);
        if (deps.userId) {
          await deps.saveInterviewProgress(deps.userId, {
            ...snapshot,
            sessionExpired: true,
          });
        }
        deps.setSessionExpired?.(true);
      } catch (err) {
        if (__DEV__) {
          console.warn('[Amoraea] Signed-out progress save skipped:', err);
        }
        try {
          depsRef.current.setSessionExpired?.(true);
        } catch {
          // listener may outlive the interview screen
        }
      }
    }
  });
  return () => subscription.unsubscribe();
}
