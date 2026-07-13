import { useCallback, useEffect, useLayoutEffect } from 'react';

import type { EmotionModalOrchestrationDeps } from '@features/aria/emotionModalOrchestrationTypes';
import type { InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import {
  runApplyEmotionResponsesToSession,
  runAwaitEmotionModalForIndex,
  runEmotionModalAfterScenarioTransition as runEmotionModalAfterScenarioTransitionImpl,
  runHandleEmotionInterviewAnswer,
  runLoadEmotionResponsesForCompletion,
  runMaybeAwaitEmotionAfterScenarioTransition,
  runTryRunEmotionModalFromScenarioTransition,
} from '@features/aria/runEmotionModalOrchestration';
export type EmotionModalOrchestrationEffectInputs = {
  emotionModalVisible: boolean;
  emotionModalItemIndex: number;
  emotionItemsComplete: boolean;
  status: InterviewSessionStatus;
  voiceState: VoiceState;
};

export function useInterviewEmotionModalOrchestration(
  depsRef: React.MutableRefObject<EmotionModalOrchestrationDeps>,
  effectInputs: EmotionModalOrchestrationEffectInputs,
) {
  const {
    emotionModalVisible,
    emotionModalItemIndex,
    emotionItemsComplete,
    status,
    voiceState,
  } = effectInputs;

  const loadEmotionResponsesForCompletion = useCallback(
    async (attemptId?: string | null) => runLoadEmotionResponsesForCompletion(depsRef.current, attemptId),
    [depsRef],
  );

  const applyEmotionResponsesToSession = useCallback(
    (hydrated: string[]) => runApplyEmotionResponsesToSession(depsRef.current, hydrated),
    [depsRef],
  );

  const handleEmotionInterviewAnswer = useCallback(
    (letter: string) => runHandleEmotionInterviewAnswer(depsRef.current, letter),
    [depsRef],
  );

  const awaitEmotionModalForIndex = useCallback(
    async (itemIndex: number) => runAwaitEmotionModalForIndex(depsRef.current, itemIndex),
    [depsRef],
  );

  const runEmotionModalAfterScenarioTransition = useCallback(
    async (scenarioNum: 1 | 2 | 3, opts?: import('@features/aria/emotionModalOrchestrationTypes').EmotionModalAfterScenarioTransitionOpts) =>
      runEmotionModalAfterScenarioTransitionImpl(depsRef.current, scenarioNum, opts),
    [depsRef],
  );

  const tryRunEmotionModalFromScenarioTransition = useCallback(
    async (params: {
      completedScenario: 1 | 2 | 3;
      transitionText: string;
      priorScenario: 1 | 2 | 3 | null;
      source: string;
    }) => runTryRunEmotionModalFromScenarioTransition(depsRef.current, params),
    [depsRef],
  );

  useLayoutEffect(() => {
    const deps = depsRef.current;
    if (deps.maybeAwaitEmotionAfterScenarioTransitionRef) {
      deps.maybeAwaitEmotionAfterScenarioTransitionRef.current = async (sn: 1 | 2 | 3) => {
        await runMaybeAwaitEmotionAfterScenarioTransition(depsRef.current, sn);
      };
    }
    if (deps.runEmotionModalAfterScenarioTransitionRef) {
      deps.runEmotionModalAfterScenarioTransitionRef.current = runEmotionModalAfterScenarioTransition;
    }
    if (deps.tryRunEmotionModalFromScenarioTransitionRef) {
      deps.tryRunEmotionModalFromScenarioTransitionRef.current = tryRunEmotionModalFromScenarioTransition;
    }
  }, [depsRef, runEmotionModalAfterScenarioTransition, tryRunEmotionModalFromScenarioTransition]);

  return {
    loadEmotionResponsesForCompletion,
    applyEmotionResponsesToSession,
    handleEmotionInterviewAnswer,
    awaitEmotionModalForIndex,
    runEmotionModalAfterScenarioTransition,
    tryRunEmotionModalFromScenarioTransition,
  };
}
