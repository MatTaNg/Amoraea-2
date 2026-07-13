import { getCurrentScenario } from '@utilities/storage/InterviewStorage';
import type { StoredInterviewData } from '@utilities/storage/InterviewStorage';
import type {
  EnsureCompletedScenarioScoredParams,
  NotifyScenarioStartedParams,
  ScenarioBoundaryScoringDeps,
} from '@features/aria/scenarioBoundaryScoringTypes';
import { supabase } from '@data/supabase/client';
import { remoteLog } from '@utilities/remoteLog';

export type EnsureCompletedScenarioScoredFn = (
  completedScenario: 1 | 2 | 3,
  messagesForScoring: { role: string; content: string }[],
  trigger: string,
) => void;

/** Fire boundary scoring when a completed scenario is inferred (canonical card, handoff, etc.). */
export function triggerCompletedScenarioScoringIfNeeded(params: {
  completedScenario: 1 | 2 | 3 | null | undefined;
  messagesForScoring: ReadonlyArray<{ role: string; content: string }>;
  trigger: string;
  ensureCompletedScenarioScored?: EnsureCompletedScenarioScoredFn;
}): void {
  const { completedScenario, messagesForScoring, trigger, ensureCompletedScenarioScored } = params;
  if (completedScenario == null || !ensureCompletedScenarioScored) return;
  ensureCompletedScenarioScored(
    completedScenario,
    messagesForScoring.map((m) => ({ role: m.role, content: m.content })),
    trigger,
  );
}

export async function runNotifyScenarioStarted(
  deps: ScenarioBoundaryScoringDeps,
  params: NotifyScenarioStartedParams,
): Promise<void> {
  const {
    userId,
    isAdmin,
    currentScenarioRef,
    interviewSessionAttemptIdRef,
    currentMessagesRef,
    scoredScenariosRef,
    scenarioScoresRef,
    resumeActiveScenarioRef,
    scoreScenarioRef,
    interviewMomentsCompleteRef,
    currentInterviewMomentRef,
    tryRunEmotionModalFromScenarioTransitionRef,
    resetScenarioCClientGatesOnly,
    loadInterviewFromStorage,
    saveInterviewToStorage,
  } = deps;
  const { scenario, messagesSnapshot, opts } = params;

  if (!userId || isAdmin) return;
  currentScenarioRef.current = scenario;
  const attemptId = interviewSessionAttemptIdRef.current;
  const source = messagesSnapshot ?? currentMessagesRef.current;
  const transcript = source.filter(
    (m) => !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack,
  );
  const completed = Array.from(scoredScenariosRef.current);
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
    const s = scenarioScoresRef.current[n];
    if (s) {
      scenarioScoresPayload[n] = {
        pillarScores: s.pillarScores,
        pillarConfidence: s.pillarConfidence,
        keyEvidence: s.keyEvidence,
        scenarioName: s.scenarioName,
      };
    }
  });
  const persisted = await loadInterviewFromStorage(userId);
  const prevMsgs = persisted?.messages ?? [];
  const prevUserTurns = prevMsgs.filter((m) => m.role === 'user').length;
  const nextUserTurns = transcript.filter((m) => m.role === 'user').length;
  const allowShrink = opts?.allowMessageHistoryShrink === true;
  /** `startInterview` used to call this before `setMessages`, producing a 1-line transcript and wiping a resumed save (see debug-e43434.log resume_decision → scenario_boundary_persisted). */
  const wouldEraseMeaningfulInterview =
    !allowShrink &&
    prevUserTurns >= 2 &&
    transcript.length < prevMsgs.length &&
    nextUserTurns < prevUserTurns;
  const messagesForSave = wouldEraseMeaningfulInterview ? prevMsgs : transcript;
  const resumeToPersist = wouldEraseMeaningfulInterview
    ? (persisted?.resumeActiveScenario ?? null)
    : scenario;
  resumeActiveScenarioRef.current = resumeToPersist;
  if (attemptId) {
    await supabase
      .from('interview_attempts')
      .update({ resume_active_scenario: resumeToPersist })
      .eq('id', attemptId)
      .eq('user_id', userId);
  }
  if (wouldEraseMeaningfulInterview && persisted) {
    await saveInterviewToStorage(userId, {
      ...persisted,
      messages: messagesForSave,
      resumeActiveScenario: resumeToPersist,
      sessionAttemptId: attemptId ?? persisted.sessionAttemptId,
    });
  } else {
    const merged: Omit<StoredInterviewData, 'version' | 'userId' | 'lastSavedAt'> = {
      ...(persisted ?? {
        messages: [],
        scenariosCompleted: [],
        scenarioScores: {},
        currentScenario: 1,
        attemptNumber: 1,
      }),
      messages: messagesForSave,
      scenariosCompleted: completed,
      scenarioScores: { ...(persisted?.scenarioScores ?? {}), ...scenarioScoresPayload },
      currentScenario: getCurrentScenario(scoredScenariosRef.current),
      resumeActiveScenario: resumeToPersist,
      sessionAttemptId: attemptId ?? persisted?.sessionAttemptId,
      attemptNumber: persisted?.attemptNumber ?? 1,
    };
    await saveInterviewToStorage(userId, merged);
  }
  /** Only score when caller supplied a transcript snapshot — avoids scoring off a stale ref when `notifyScenarioStarted` is fire-and-forget without messages. */
  const scoreFn = scoreScenarioRef.current;
  if (scoreFn && scenario >= 2 && scenario <= 3 && messagesSnapshot != null && messagesSnapshot.length > 0) {
    const completedScenarioNum = (scenario - 1) as 1 | 2;
    if (!scoredScenariosRef.current.has(completedScenarioNum)) {
      scoredScenariosRef.current.add(completedScenarioNum);
      void remoteLog('[SCENARIO_SCORE_ON_TRANSITION]', {
        scenario_completed: completedScenarioNum,
        entering_scenario: scenario,
        transcript_turns: transcript.length,
      });
      void scoreFn(completedScenarioNum, transcript as { role: string; content: string }[]);
      const lastAssistant = [...messagesSnapshot]
        .reverse()
        .find((m) => m.role === 'assistant');
      const transitionText = String((lastAssistant as { content?: string })?.content ?? '');
      if (transitionText.trim()) {
        if (completedScenarioNum === 1) {
          interviewMomentsCompleteRef.current[1] = true;
          currentInterviewMomentRef.current = 2;
        } else if (completedScenarioNum === 2) {
          interviewMomentsCompleteRef.current[2] = true;
          currentInterviewMomentRef.current = 3;
          resetScenarioCClientGatesOnly();
        }
        void tryRunEmotionModalFromScenarioTransitionRef.current({
          completedScenario: completedScenarioNum,
          transitionText,
          priorScenario: completedScenarioNum,
          source: 'notifyScenarioStarted',
        });
      }
    }
  }
}

export function runEnsureCompletedScenarioScored(
  deps: ScenarioBoundaryScoringDeps,
  params: EnsureCompletedScenarioScoredParams,
): void {
  const { scoredScenariosRef, scoreScenario } = deps;
  const { completedScenario, messagesForScoring, trigger } = params;
  if (!scoredScenariosRef?.current) {
    void remoteLog('[ensureCompletedScenarioScored] missing scoredScenariosRef', {
      trigger,
      completedScenario,
    });
    return;
  }

  if (scoredScenariosRef.current.has(completedScenario)) {
    return;
  }
  scoredScenariosRef.current.add(completedScenario);
  void remoteLog('[SCENARIO_SCORE_ON_TRANSITION]', {
    scenario_completed: completedScenario,
    trigger,
    transcript_turns: messagesForScoring.length,
  });
  void scoreScenario(completedScenario, messagesForScoring);
}
