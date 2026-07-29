import type { MutableRefObject } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { mergeScenarioOpeningDeliveredFromPlaybackConfirmed } from '@features/aria/scenarioDeliveryResumeCheckpoint';
import { buildTaggedInterviewTranscriptSnapshot } from '@features/aria/interviewTranscriptPersistenceHelpers';
import type { ShowScenarioCardCanonicalPlaybackConfirmedKinds } from '@features/aria/showScenarioCardCanonicalTts';
import { isGenuineScenarioTransitionSignal } from '@features/aria/interviewReferenceCardResumeHelpers';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import { getCurrentScenario } from '@utilities/storage/InterviewStorage';

export type SaveActiveInterviewProgressTrigger = {
  userId: string | undefined;
  isAdmin: boolean;
  status: string;
  messageCount: number;
  pendingCompletion: boolean;
};

export type SaveActiveInterviewProgressDeps = {
  messages: ReadonlyArray<{
    role: string;
    content: string;
    isScoreCard?: boolean;
    isWelcomeBack?: boolean;
    scenarioNumber?: number;
  }>;
  scenarioScores: Record<number, ScenarioScoreResult>;
  scoredScenariosRef: MutableRefObject<Set<number>>;
  currentScenarioRef: MutableRefObject<number>;
  resumeActiveScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  emotionItemResponsesRef: MutableRefObject<string[]>;
  interviewStatusRef: MutableRefObject<string>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  lastQuestionTextRef?: MutableRefObject<string | null>;
  showScenarioCardCanonicalPlaybackConfirmedKindsRef?: MutableRefObject<ShowScenarioCardCanonicalPlaybackConfirmedKinds>;
  saveInterviewProgress: (
    userId: string,
    data: Record<string, unknown>,
  ) => void | Promise<void>;
};

export type InterviewHandoffCheckpointDeps = {
  userId: string | undefined;
  isAdmin: boolean;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  scoredScenariosRef: MutableRefObject<Set<number>>;
  scenarioScoresRef: MutableRefObject<Record<number, ScenarioScoreResult>>;
  resumeActiveScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  saveInterviewProgress: SaveActiveInterviewProgressDeps['saveInterviewProgress'];
  messages: SaveActiveInterviewProgressDeps['messages'];
};

/** Persist resume cursor immediately on scenario handoff so refresh mid-transition lands on the next scenario. */
export function persistInterviewHandoffCheckpoint(
  deps: InterviewHandoffCheckpointDeps,
  resumeScenario: 1 | 2 | 3,
): void {
  if (!deps.userId || deps.isAdmin) return;
  deps.resumeActiveScenarioRef.current = resumeScenario;
  const completed = Array.from(deps.scoredScenariosRef.current);
  const scenarioScoresPayload: Record<
    number,
    {
      pillarScores: Record<string, number | null>;
      pillarConfidence: Record<string, string>;
      keyEvidence: Record<string, string>;
      scenarioName?: string;
    }
  > = {};
  [1, 2, 3].forEach((n) => {
    const s = deps.scenarioScoresRef.current[n];
    if (s) {
      scenarioScoresPayload[n] = {
        pillarScores: s.pillarScores,
        pillarConfidence: s.pillarConfidence,
        keyEvidence: s.keyEvidence,
        scenarioName: s.scenarioName,
      };
    }
  });
  void deps.saveInterviewProgress(deps.userId, {
    messages: buildTaggedInterviewTranscriptSnapshot(deps.messages),
    scenariosCompleted: completed,
    scenarioScores: scenarioScoresPayload,
    currentScenario: resumeScenario,
    resumeActiveScenario: resumeScenario,
    sessionAttemptId: deps.interviewSessionAttemptIdRef.current ?? undefined,
  });
}

export function runSaveActiveInterviewProgress(
  deps: SaveActiveInterviewProgressDeps,
  trigger: SaveActiveInterviewProgressTrigger,
): void {
  if (!trigger.userId || trigger.isAdmin || trigger.status !== 'active' || trigger.messageCount === 0) {
    return;
  }
  const completed = Array.from(deps.scoredScenariosRef.current);
  const scenarioScoresPayload: Record<
    number,
    {
      pillarScores: Record<string, number | null>;
      pillarConfidence: Record<string, string>;
      keyEvidence: Record<string, string>;
      scenarioName?: string;
    }
  > = {};
  [1, 2, 3].forEach((n) => {
    const s = deps.scenarioScores[n];
    if (s) {
      scenarioScoresPayload[n] = {
        pillarScores: s.pillarScores,
        pillarConfidence: s.pillarConfidence,
        keyEvidence: s.keyEvidence,
        scenarioName: s.scenarioName,
      };
    }
  });
  void deps.saveInterviewProgress(trigger.userId, {
    messages: buildTaggedInterviewTranscriptSnapshot(deps.messages),
    scenariosCompleted: completed,
    scenarioScores: scenarioScoresPayload,
    currentScenario: resolvePersistedCurrentScenario(deps),
    resumeActiveScenario: resolvePersistedResumeActiveScenario(deps),
    emotionItemResponses: [...deps.emotionItemResponsesRef.current],
    pendingCompletion:
      trigger.pendingCompletion || deps.interviewStatusRef.current === 'preparing_results',
    sessionAttemptId: deps.interviewSessionAttemptIdRef.current ?? undefined,
    lastQuestionText: deps.lastQuestionTextRef?.current?.trim() || null,
    scenarioOpeningDeliveredFor: mergeScenarioOpeningDeliveredFromPlaybackConfirmed(
      undefined,
      deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current,
    ),
  });
}

function resolvePersistedCurrentScenario(deps: SaveActiveInterviewProgressDeps): 1 | 2 | 3 | null {
  const live = deps.currentScenarioRef?.current;
  if (live === 1 || live === 2 || live === 3) return live;
  return getCurrentScenario(deps.scoredScenariosRef.current);
}

function resolvePersistedResumeActiveScenario(
  deps: SaveActiveInterviewProgressDeps,
): 1 | 2 | 3 | null {
  if (deps.resumeActiveScenarioRef.current != null) {
    return deps.resumeActiveScenarioRef.current;
  }
  const live = resolvePersistedCurrentScenario(deps);
  if (live === 1 || live === 2 || live === 3) {
    deps.resumeActiveScenarioRef.current = live;
    return live;
  }
  return null;
}

export const LIVE_TRANSCRIPT_SYNC_DEBOUNCE_MS = 7000;

export type DebouncedLiveTranscriptSyncTrigger = {
  userId: string | undefined;
  isAdmin: boolean;
  status: string;
  interviewStatus: string;
  messages: DebouncedLiveTranscriptSyncDeps['messages'];
};

export type DebouncedLiveTranscriptSyncDeps = {
  messages: SaveActiveInterviewProgressDeps['messages'];
  interviewStatusRef: MutableRefObject<string>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  resumeActiveScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  supabase: SupabaseClient;
  syncLiveInterviewTranscriptToAttempt: typeof import('@utilities/syncLiveInterviewTranscript').syncLiveInterviewTranscriptToAttempt;
};

export function runDebouncedLiveTranscriptSync(
  deps: DebouncedLiveTranscriptSyncDeps,
  trigger: DebouncedLiveTranscriptSyncTrigger,
): void {
  if (!trigger.userId || trigger.isAdmin || trigger.status !== 'active') return;
  if (
    deps.interviewStatusRef.current !== 'in_progress' &&
    deps.interviewStatusRef.current !== 'preparing_results'
  ) {
    return;
  }
  if (trigger.messages.length === 0) return;
  const attemptId = deps.interviewSessionAttemptIdRef.current;
  if (!attemptId) return;
  if (
    deps.interviewStatusRef.current !== 'in_progress' &&
    deps.interviewStatusRef.current !== 'preparing_results'
  ) {
    return;
  }
  const transcriptSnapshot = buildTaggedInterviewTranscriptSnapshot(deps.messages);
  void deps.syncLiveInterviewTranscriptToAttempt(deps.supabase, {
    attemptId,
    userId: trigger.userId,
    transcript: transcriptSnapshot,
    resumeActiveScenario: deps.resumeActiveScenarioRef.current,
  });
}

export type InterviewScenarioTransitionUiTrigger = {
  status: string;
  isAdmin: boolean;
  messageCount: number;
};

export type InterviewScenarioTransitionUiDeps = {
  messages: ReadonlyArray<{ role: string; content?: string }>;
  committedScenarioRef: MutableRefObject<{ label: string; text: string } | null>;
  isAssistantBubbleForTranscript: (m: { role: string; content?: string }) => boolean;
  stripControlTokens: (text: string) => string;
  detectActiveScenarioFromMessage: (text: string) => { label: string; text: string } | null;
  setInterviewUiPhase: React.Dispatch<
    React.SetStateAction<'pre_scenario' | 'scenario_transitioning' | 'scenario_active'>
  >;
  setReferenceCardPrompt: React.Dispatch<React.SetStateAction<string | null>>;
  setReferenceCardScenario: React.Dispatch<
    React.SetStateAction<{ label: string; text: string } | null>
  >;
};

export function runClearReferenceCardOnScenarioTransition(
  deps: InterviewScenarioTransitionUiDeps,
  trigger: InterviewScenarioTransitionUiTrigger,
): void {
  if (trigger.status !== 'active' || trigger.isAdmin) return;
  const assistantOnly = deps.messages.filter(
    (m) => m.role === 'assistant' && deps.isAssistantBubbleForTranscript(m),
  );
  const latest = assistantOnly[assistantOnly.length - 1];
  if (!latest?.content) return;
  const cleaned = deps.stripControlTokens(latest.content).trim();
  const latestDetect = deps.detectActiveScenarioFromMessage(cleaned);
  if (!latestDetect) return;
  const committed = deps.committedScenarioRef.current;
  if (!committed) return;
  if (committed.label === latestDetect.label) return;
  if (!isGenuineScenarioTransitionSignal(cleaned)) return;
  deps.setInterviewUiPhase('scenario_transitioning');
  deps.setReferenceCardPrompt(null);
  deps.setReferenceCardScenario(null);
  deps.committedScenarioRef.current = null;
}

export function runResetInterviewUiPhaseWhenInactive(
  deps: InterviewScenarioTransitionUiDeps,
  trigger: Pick<InterviewScenarioTransitionUiTrigger, 'status' | 'isAdmin'>,
): void {
  if (trigger.status === 'active' && !trigger.isAdmin) return;
  deps.setInterviewUiPhase('pre_scenario');
  deps.setReferenceCardScenario(null);
  deps.setReferenceCardPrompt(null);
  deps.committedScenarioRef.current = null;
}
