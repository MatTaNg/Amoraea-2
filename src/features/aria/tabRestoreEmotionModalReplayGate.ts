import type { MutableRefObject } from 'react';

import {
  isNaturalLanguageScenarioHandoffTransition,
  splitScenarioTransitionForEmotionModal,
  type PendingEmotionModalTransition,
} from '@features/aria/emotionModalTransitionOrchestration';
import { completedScenarioForEmotionModalFromTransition } from '@features/aria/emotionScenarioTransitionInference';
import { remoteLog } from '@utilities/remoteLog';

export type TabRestoreEmotionModalGateDeps = {
  pendingEmotionModalTransitionRef: MutableRefObject<PendingEmotionModalTransition | null>;
  emotionModalShownForScenarioRef: MutableRefObject<Set<1 | 2 | 3>>;
};

/**
 * Tab-hide restore must not replay the post-modal vignette before the emotion modal runs.
 * Trim to `beforeModal` and stash `afterModal` for deferred replay after the modal.
 */
export function gateTabRestoreReplayTextForEmotionModal(
  utterance: string,
  deps: TabRestoreEmotionModalGateDeps,
): string {
  const raw = utterance.trim();
  if (!raw) return utterance;

  const existing = deps.pendingEmotionModalTransitionRef.current;
  if (existing?.afterModal.trim()) {
    const { beforeModal } = splitScenarioTransitionForEmotionModal(existing.transitionText);
    return beforeModal.trim() || utterance;
  }

  if (!isNaturalLanguageScenarioHandoffTransition(raw)) {
    return utterance;
  }

  const { beforeModal, afterModal } = splitScenarioTransitionForEmotionModal(raw);
  if (!afterModal.trim()) {
    return utterance;
  }

  const completed = completedScenarioForEmotionModalFromTransition({
    declaredComplete: 1,
    transitionText: raw,
    priorScenario: null,
  });
  if (deps.emotionModalShownForScenarioRef.current.has(completed)) {
    return utterance;
  }

  deps.pendingEmotionModalTransitionRef.current = {
    completedScenario: completed,
    afterModal,
    transitionText: raw,
    priorScenario: completed > 1 ? ((completed - 1) as 1 | 2) : null,
  };
  void remoteLog('[tab_restore] emotion_modal_gated_replay_trimmed', {
    completed,
    beforePreview: beforeModal.slice(0, 160),
  });
  return beforeModal.trim() || utterance;
}

export function tabRestoreReplayBlockedByPendingEmotionModal(deps: {
  emotionModalPendingTransitionRef: MutableRefObject<boolean>;
  pendingEmotionModalTransitionRef: MutableRefObject<PendingEmotionModalTransition | null>;
}): boolean {
  return (
    deps.emotionModalPendingTransitionRef.current ||
    deps.pendingEmotionModalTransitionRef.current != null
  );
}
