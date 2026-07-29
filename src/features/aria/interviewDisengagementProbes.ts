/**
 * Client-enforced interview probes for thin / disengaged answers (repair + mentalizing + generic short).
 * One probe per user answer — caller must skip when the user is already answering a probe turn.
 */

export {
  CLIENT_REPAIR_REFUSAL_PROBE,
  CLIENT_MENTALIZING_SURFACE_PROBE,
  SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
  CLIENT_SHORT_ELABORATION_PROBE,
} from './interviewDisengagementProbeCopy';

export {
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairReAskQuestion,
  stripScenarioARepairQuestion,
  cleanupScenarioWrapAfterRepairStrip,
  stripEmbeddedScenarioARepairQuestionAsk,
  stripScenarioARepairQuestionStreamingEcho,
  isIncompleteScenarioARepairLeadSentence,
  looksLikeScenarioARepairStreamFragment,
  spokenTextContainsScenarioARepairQuestion,
  clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt,
  resolveInterviewQuestionRepeatTtsText,
  shouldAllowScenarioARepairAfterContemptAnswer,
  shouldSuppressScenarioARepairBeforeContemptAnswer,
} from './scenarioARepairQuestionHelpers';

export {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  looksLikeRepairInterviewQuestion,
  isScenarioCRepairPessimismRefusalSignal,
  isRepairRefusalProbeAssistantLine,
} from './interviewRepairQuestionDetection';

export {
  looksLikeMentalizingThinInterviewQuestion,
  repairAnswerShowsRefusalOrCharacterDeflection,
  looksLikeSurfaceOnlyEmotionalLabelAnswer,
  hasClearConciseDirectAnswer,
  userAnswerHasSophiePerspectiveLanguage,
  userAnswerAddressesDanielStateForScenarioCQ1,
  isInterviewHardStopUserTurn,
} from './interviewMentalizingAndAnswerSignals';

export {
  isClientOrElongatingInterviewProbeAssistant,
  isNonRepeatableAssistantLineForVerbatimReplay,
  isRepeatableMainInterviewQuestionLine,
  looksLikeNonQuestionScenarioTransitionLine,
  transcriptContainsMentalizingSurfaceProbe,
  transcriptContainsScenarioCSophiePerspectiveProbe,
  scenarioALastAssistantIsRepairProbeOrFollowUp,
  findLastMoment4RepeatableQuestionText,
  findLastRepeatableInterviewQuestionText,
} from './interviewDisengagementTranscriptHelpers';

export {
  type RepairRefusalTriggerReason,
  type RepairRefusalDetectionDetail,
  repairAnswerHasConcreteSuggestionActionOrStep,
  userAnswerSatisfiesScenarioARepairPrompt,
  userAnswerSatisfiesScenarioBJamesRepairPrompt,
  findLastUserWithPriorAssistantContent,
  findLastUserWithPriorScenarioARepairContext,
  findLastUserWithPriorScenarioBJamesRepairContext,
  scenarioARepairAnswerAlreadySatisfiedInTranscript,
  shouldSuppressScenarioAAssistantLineAfterSatisfiedRepair,
  shouldAdvanceScenarioAAfterSatisfiedRepair,
  shouldAdvanceScenarioBAfterSatisfiedRepair,
  streamMissedScenarioARepairSatisfiedHandoffDelivery,
  evaluateRepairRefusalDetection,
} from './interviewRepairRefusalDetection';

export {
  type ClientDisengagementProbePick,
  pickClientDisengagementProbe,
} from './pickClientDisengagementProbe';
