/** Backward-compatible barrel — implementation lives in focused modules below. */
export {
  hasScenarioCQ2OnTopicEngagement,
  scenarioCCommitmentThresholdMatchDetail,
  hasScenarioCCommitmentThresholdInUserAnswer,
  hasScenarioCVignetteCommitmentThresholdSignal,
  assistantContainsScenarioCCommitmentThresholdForcedLine,
  looksLikeScenarioCCommitmentThresholdAssistantPrompt,
  extractScenario3CommitmentThresholdUserAnswerAfterPrompt,
  isLikelyMisplacedPersonalNarrativeForScenarioCThreshold,
} from './scenarioCCommitmentThresholdLogic';

export {
  sliceTranscriptForScenario3Scoring,
  sliceTranscriptBeforeScenarioCToPersonalHandoff,
  type ScenarioCorpusMessageSlice,
  extractScenario3UserCorpusAfterLastRepairPrompt,
  extractScenario3UserCorpusBeforeRepairPrompt,
  extractScenario3UserCorpus,
  isScenarioCToPersonalHandoffAssistantContent,
} from './scenarioCTranscriptSlicing';

export {
  isScenarioCRepairAssistantPrompt,
  isScenarioCQ1Prompt,
  isScenarioCQ2Prompt,
  isMisplacedScenarioCQ1Answer,
  textContainsScenarioCVignetteBody,
  assistantTextBlocksMoment4ProgressInference,
  hasMoment4PersonalNarrativeEngagement,
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
} from './scenarioCPromptDetection';
