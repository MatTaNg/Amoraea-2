import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import { getCurrentScenario } from '@utilities/storage/InterviewStorage';

export type InterviewProgressSnapshotRefs = {
  currentMessagesRef?: MutableRefObject<
    Array<{ role: string; content: string; isScoreCard?: boolean; isWelcomeBack?: boolean }>
  >;
  scoredScenariosRef?: MutableRefObject<Set<number>>;
  scenarioScoresRef?: MutableRefObject<Record<number, ScenarioScoreResult>>;
  currentScenarioRef?: MutableRefObject<number>;
  resumeActiveScenarioRef?: MutableRefObject<1 | 2 | 3 | null>;
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
