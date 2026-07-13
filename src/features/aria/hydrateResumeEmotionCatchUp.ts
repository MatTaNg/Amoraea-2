import {
  EMOTION_INTERVIEW_MODAL_ITEMS,
  countAnsweredEmotionItems,
  extractEmotionAfterModalForResumeCatchUp,
  hydrateEmotionResponsesFromSources,
  listUnansweredEmotionModalIndices,
} from '@features/aria/emotionRecognitionInterview';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { HandleResumeDeps } from '@features/aria/sessionLifecycleTypes';
import {
  emotionModalCatchUpThroughScenarioFromResume,
  resumeShouldSpeakEmotionCatchUpAfterModal,
  type InterviewResumePlan,
} from '@utilities/interviewResumeCursor';
import type { SavedInterviewSnapshot } from '@utilities/storage/InterviewStorage';

type ResumeEmotionDeps = Pick<
  HandleResumeDeps,
  | 'emotionItemResponsesRef'
  | 'setEmotionItemResponses'
  | 'setEmotionItemsComplete'
  | 'resumeEmotionCatchUpIndicesRef'
  | 'resumeEmotionAfterModalTextRef'
>;

export function hydrateResumeEmotionCatchUp(params: {
  deps: ResumeEmotionDeps;
  saved: SavedInterviewSnapshot;
  resumePlan: InterviewResumePlan;
  transcriptMessages: MessageWithScenario[];
  resumeAttemptEmotionResponses: unknown;
}): void {
  const { deps, saved, resumePlan, transcriptMessages, resumeAttemptEmotionResponses } = params;

  const hydratedEmotion = hydrateEmotionResponsesFromSources(
    resumeAttemptEmotionResponses,
    saved.emotionItemResponses,
  );
  if (hydratedEmotion.length > 0) {
    deps.emotionItemResponsesRef.current = hydratedEmotion;
    deps.setEmotionItemResponses(hydratedEmotion);
    deps.setEmotionItemsComplete(
      countAnsweredEmotionItems(hydratedEmotion) >= EMOTION_INTERVIEW_MODAL_ITEMS.length,
    );
  }

  const emotionCatchUp = emotionModalCatchUpThroughScenarioFromResume({
    lastCompletedScenario: resumePlan.lastCompletedScenario,
    effectiveMoment: resumePlan.effectiveMoment,
    transcriptMessages,
  });
  const emotionCatchUpThrough = emotionCatchUp.through;
  const unansweredEmotionIndices = emotionCatchUpThrough
    ? listUnansweredEmotionModalIndices(deps.emotionItemResponsesRef.current, emotionCatchUpThrough)
    : [];
  if (unansweredEmotionIndices.length > 0) {
    deps.resumeEmotionCatchUpIndicesRef.current = unansweredEmotionIndices;
    const extractedAfterModal = extractEmotionAfterModalForResumeCatchUp(
      transcriptMessages,
      unansweredEmotionIndices,
    );
    deps.resumeEmotionAfterModalTextRef.current = resumeShouldSpeakEmotionCatchUpAfterModal(
      transcriptMessages,
      extractedAfterModal,
    )
      ? extractedAfterModal
      : null;
  } else {
    deps.resumeEmotionCatchUpIndicesRef.current = null;
    deps.resumeEmotionAfterModalTextRef.current = null;
  }
}
