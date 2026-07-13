/** In-interview emotion identification (UI modals at scenario boundaries). */

export type { PendingEmotionModalTransition } from './emotionModalTransitionOrchestration';

export {
  EMOTION_ITEM_CORRECT_ANSWERS,
  EMOTION_INTERVIEW_MODAL_ITEMS,
  EXPECTED_EMOTION_RECOGNITION_ITEMS,
  type EmotionInterviewChoice,
  type EmotionInterviewModalItem,
} from './emotionInterviewModalContent';

export {
  normalizeEmotionResponseLetters,
  hydrateEmotionResponsesFromStorage,
  countAnsweredEmotionItems,
  setEmotionResponseAtIndex,
  compactEmotionResponsesForStorage,
  emotionResponsesNeedFixedSlots,
  emotionResponsesForStorage,
  isEmotionRecognitionBatteryComplete,
  isEmotionItemAnsweredAt,
  mergeEmotionResponses,
  hydrateEmotionResponsesFromSources,
  listUnansweredEmotionModalIndices,
  emotionModalIndexForCompletedScenario,
  emotionResponsesUseFixedSlots,
} from './emotionResponseStorage';

export {
  emotionRecognitionCorrectCountFromResponses,
  emotionRecognitionProportionFromResponses,
  emotionRecognitionRawScoreFromResponses,
  isStoredEmotionCorrectCount,
  storedEmotionCorrectCountFromRaw,
  legacyEmotionProportionFromRaw,
  emotionRecognitionPercentScoreFromCorrectCount,
  emotionRecognitionPersistScoresFromResponses,
  emotionRecognitionDisplayPercentFromAttemptsRow,
  emotionRecognitionDisplayScoreFromRaw,
  type EmotionRecognitionPersistPayload,
  emptyEmotionRecognitionPersistPayload,
  buildEmotionRecognitionPersistPayload,
  emotionRecognitionPersistSpreadIfComplete,
  scoreEmotionItems,
  emotionRecognitionCorrectCount,
  resolveEmotionRecognitionRawScoreForGate,
  isLegacyEmotionRecognitionFloorOnlyFail,
  LEGACY_EMOTION_RECOGNITION_FLOOR_REVIEW_NOTE,
} from './emotionRecognitionScoring';

export {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
  reconcileCompletedScenarioForEmotionModal,
  completedScenarioForEmotionModalFromTransition,
} from './emotionScenarioTransitionInference';

export {
  splitScenarioTransitionForEmotionModal,
  shouldDeferEmotionModalForTransitionText,
  hasScenarioBoundaryWrapPhrase,
  isNaturalLanguageScenarioHandoffTransition,
  isScenarioThreeToMoment4EmotionModalHandoff,
  resolveNaturalLanguageEmotionModalGate,
  extractEmotionAfterModalForResumeCatchUp,
} from './emotionModalTransitionOrchestration';
