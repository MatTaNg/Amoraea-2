import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import { looksLikeInterviewClosingAssistantMessage } from '@features/aria/elongatingProbe';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { remoteLog } from '@utilities/remoteLog';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  isScenarioABoundaryReflectionWithoutNextVignette,
  isTruncatedScenarioAHandoffFragment,
} from '@features/aria/scenarioAContemptProbeTextMatch';
import {
  prepareEmotionTransitionAfterModalForTts,
  prepareEmotionTransitionBeforeModalForTts,
} from '@features/aria/emotionTransitionModalTtsGuards';
import {
  streamAlreadySpokeScenarioBoundaryClosingLead,
  parallelStreamDeliveredBundledHandoffViaCanonicalCard,
  type ShowScenarioCardCanonicalPlaybackConfirmedKinds,
} from '@features/aria/showScenarioCardCanonicalTts';

export type PostClaudeNaturalLanguageEmotionTransitionSpeakArgs = {
  displayText: string;
  priorScenarioNum: 1 | 2 | 3;
  emotionSplit: { beforeModal: string; afterModal: string };
  deferEmotionModal: boolean;
  aiMsg: PostClaudeInterviewMessage;
  scenarioJustCompleted: 1 | 2 | 3;
};

/**
 * Speak a scenario transition with optional deferred or inline emotion-modal orchestration.
 */
export async function speakPostClaudeNaturalLanguageEmotionTransition(
  deps: PostClaudeAssistantTurnDeps,
  updatedMessages: PostClaudeInterviewMessage[],
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
  args: PostClaudeNaturalLanguageEmotionTransitionSpeakArgs,
): Promise<void> {
  const { beforeModal, afterModal } = args.emotionSplit;
  const { displayText, priorScenarioNum, deferEmotionModal, aiMsg, scenarioJustCompleted } = args;

  if (deferEmotionModal && afterModal.trim()) {
    deps.pendingEmotionModalTransitionRef.current = {
      completedScenario: scenarioJustCompleted,
      afterModal,
      transitionText: displayText,
      priorScenario: priorScenarioNum,
    };
    const base = (deps.currentMessagesRef.current.length > 0
      ? deps.currentMessagesRef.current
      : updatedMessages) as PostClaudeInterviewMessage[];
    const last = base[base.length - 1];
    const nextMessages =
      last?.role === 'assistant'
        ? [...base.slice(0, -1), { ...last, content: beforeModal }]
        : [...base, { ...aiMsg, content: beforeModal }];
    deps.setMessages(nextMessages);
    await speakAssistantTurn(beforeModal, {
      ...ASSISTANT_INTERVIEW_SPEECH,
      ...(streamAlreadySpokeScenarioBoundaryClosingLead(
        deps.parallelStreamingTtsRef.current.spokenCompleteText.trim(),
        scenarioJustCompleted,
      )
        ? {}
        : { forceSpeakDespiteParallelStream: true }),
    });
    return;
  }
  if (deferEmotionModal) {
    await speakAssistantTurn(displayText, ASSISTANT_INTERVIEW_SPEECH);
    return;
  }
  const streamAlreadySpokeBefore =
    deps.parallelStreamingTtsRef.current.spokenCompleteText.trim().length > 0;
  const streamSpokeText = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
  const playbackConfirmedKinds =
    deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current ?? {};
  const emotionModalTtsCtx = {
    scenarioJustCompleted,
    streamAlreadySpokeBefore,
    streamSpokeText,
    playbackConfirmedKinds,
    messages: updatedMessages,
    interviewMoment: deps.currentInterviewMomentRef.current,
  };
  const beforeModalForTts = prepareEmotionTransitionBeforeModalForTts(beforeModal, emotionModalTtsCtx);
  if (beforeModalForTts.trim()) {
    if (scenarioJustCompleted === 3) {
      void remoteLog('[S3_TO_M4_TRANSITION_BEFORE_MODAL]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: beforeModalForTts.slice(0, 200),
        streamSpokePreview: streamSpokeText.slice(0, 120),
      });
    } else if (scenarioJustCompleted === 2) {
      void remoteLog('[S2_TO_S3_TRANSITION_BEFORE_MODAL]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: beforeModalForTts.slice(0, 200),
        streamSpokePreview: streamSpokeText.slice(0, 120),
      });
    }
    await speakAssistantTurn(beforeModalForTts, {
      ...ASSISTANT_INTERVIEW_SPEECH,
      ...(streamAlreadySpokeScenarioBoundaryClosingLead(streamSpokeText, scenarioJustCompleted)
        ? {}
        : { forceSpeakDespiteParallelStream: true }),
    });
  }
  const afterModalForTts = prepareEmotionTransitionAfterModalForTts(afterModal, emotionModalTtsCtx);
  await deps.runEmotionModalAfterScenarioTransition(scenarioJustCompleted, {
    transitionText: displayText,
    priorScenario: priorScenarioNum,
    afterBeforeModalPlayback: true,
  });
  const nextScenarioAfterModal =
    scenarioJustCompleted < 3 ? ((scenarioJustCompleted + 1) as 2 | 3) : 3;
  if (deps.currentScenarioRef.current !== nextScenarioAfterModal) {
    for (let n = scenarioJustCompleted; n < nextScenarioAfterModal; n++) {
      if (n === 1 || n === 2 || n === 3) {
        deps.interviewMomentsCompleteRef.current[n] = true;
      }
    }
    if (deps.currentInterviewMomentRef.current < nextScenarioAfterModal) {
      deps.currentInterviewMomentRef.current = nextScenarioAfterModal;
    }
    deps.currentScenarioRef.current = nextScenarioAfterModal;
    deps.resumeActiveScenarioRef.current = nextScenarioAfterModal;
  }
  if (afterModal.trim() && !afterModalForTts.trim()) {
    const s3Skipped =
      scenarioJustCompleted === 3 && playbackConfirmedKinds.moment_4 === true;
    const s2Skipped =
      scenarioJustCompleted === 2 && playbackConfirmedKinds.situation_3 === true;
    void remoteLog(
      s3Skipped
        ? '[S3_AFTER_MODAL_SPEAK_SKIPPED]'
        : s2Skipped
          ? '[S2_AFTER_MODAL_SPEAK_SKIPPED]'
          : '[S2_AFTER_MODAL_SPEAK_SKIPPED]',
      {
      interviewSessionId: deps.interviewSessionIdRef.current,
      reason: s3Skipped
        ? 'canonical_m4_opening_already_played'
        : s2Skipped
          ? 'canonical_s3_opening_already_played'
          : streamAlreadySpokeBefore && playbackConfirmedKinds.situation_2 === true
            ? 'canonical_s2_opening_already_played'
            : 'premature_james_q2_stripped',
      afterModalPreview: afterModal.slice(0, 160),
      interviewMoment: deps.currentInterviewMomentRef.current,
    });
  }
  if (afterModalForTts.trim()) {
    if (streamAlreadySpokeBefore) {
      await deps.speakTextSafe(afterModalForTts, ASSISTANT_INTERVIEW_SPEECH);
    } else {
      await speakAssistantTurn(afterModalForTts, ASSISTANT_INTERVIEW_SPEECH);
    }
  } else if (__DEV__ && afterModal.trim()) {
    console.warn('[Amoraea] emotion modal natural transition: afterModal suppressed after transition guard');
  } else if (__DEV__ && !afterModal.trim()) {
    console.warn('[Amoraea] emotion modal natural transition: missing afterModal split');
  }
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
}

/** Parallel stream may flush a truncated S1 handoff before post-processing injects the canonical bundle. */
export function parallelStreamMissedBundledHandoffPreModal(
  streamSpokenText: string,
  assistantContentToPersist: string,
  currentInterviewMoment: number,
  playbackConfirmedKinds?: ShowScenarioCardCanonicalPlaybackConfirmedKinds,
): boolean {
  const spoken = streamSpokenText.trim();
  const expected = assistantContentToPersist.trim();
  if (!expected) return false;
  if (
    playbackConfirmedKinds &&
    parallelStreamDeliveredBundledHandoffViaCanonicalCard(playbackConfirmedKinds, expected)
  ) {
    return false;
  }
  if (!spoken) return true;
  if (isTruncatedScenarioAHandoffFragment(spoken)) return true;
  if (isScenarioABoundaryReflectionWithoutNextVignette(spoken)) return true;
  if (currentInterviewMoment < 4 && looksLikeInterviewClosingAssistantMessage(spoken)) {
    return true;
  }
  const spokenNorm = spoken.toLowerCase().replace(/\s+/g, ' ');
  const expectedNorm = expected.toLowerCase().replace(/\s+/g, ' ');
  if (spokenNorm.length < expectedNorm.length * 0.55 && !expectedNorm.startsWith(spokenNorm)) {
    return true;
  }
  return false;
}

/**
 * Bundled S1→S2 (etc.) handoff: speak only the pre-modal segment now; emotion modal runs on a later turn.
 * Returns true when the caller should end the turn early.
 */
export async function handlePostClaudePendingBundledHandoffSpeak(
  deps: Pick<
    PostClaudeAssistantTurnDeps,
    'setVoiceState' | 'showScenarioCardCanonicalPlaybackConfirmedKindsRef'
  >,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
  args: {
    pendingBundledHandoff: boolean;
    parallelStreamingPlaybackUsed: boolean;
    assistantContentToPersist: string;
    streamSpokenCompleteText?: string;
    currentInterviewMoment?: number;
  },
): Promise<boolean> {
  if (!args.pendingBundledHandoff) {
    return false;
  }
  const expected = args.assistantContentToPersist.trim();
  const playbackConfirmedKinds =
    deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current ?? {};
  const shouldSpeakBundledPreModal =
    !!expected &&
    (!args.parallelStreamingPlaybackUsed ||
      parallelStreamMissedBundledHandoffPreModal(
        args.streamSpokenCompleteText ?? '',
        expected,
        args.currentInterviewMoment ?? 5,
        playbackConfirmedKinds,
      ));
  if (shouldSpeakBundledPreModal) {
    await speakAssistantTurn(expected, ASSISTANT_INTERVIEW_SPEECH);
  } else if (
    args.parallelStreamingPlaybackUsed &&
    parallelStreamDeliveredBundledHandoffViaCanonicalCard(playbackConfirmedKinds, expected)
  ) {
    void remoteLog('[S1_BUNDLED_HANDOFF_RESPEAK_SKIPPED_CANONICAL_CONFIRMED]', {
      preview: expected.slice(0, 220),
    });
  }
  deps.setVoiceState('idle');
  return true;
}
