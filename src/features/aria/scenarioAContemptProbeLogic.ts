export {
  normalizeInterviewApostrophesForMatching,
  normalizeScenarioAThatLineAsrTypos,
  userReferencesEmmaClosingLineQuote,
  scenarioAEmmaVeryClearClosingLineMentioned,
  scenarioAEmmaVeryClearContemptReask,
  looksLikeScenarioAContemptProbeQuestion,
  isIncompleteScenarioAContemptProbeLeadSentence,
  isIncompleteScenarioABoundaryClosureLeadSentence,
  isScenarioABoundaryReflectionWithoutNextVignette,
} from './scenarioAContemptProbeTextMatch';

export {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY,
  SCENARIO_A_CONTEMPT_PROBE_RESUME_REPEAT_TTS_COPY,
  coerceScenarioAContemptProbeToDeliveredCopy,
  coerceScenarioAContemptProbeForTts,
  scenarioAContemptProbeTtsSpokenText,
  scenarioAContemptProbeResumeRepeatTtsText,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
  mergeDeferredScenarioAContemptProbeLeadWithNextSentence,
  stripScenarioAContemptProbeQuestion,
  stripEmbeddedScenarioAContemptProbeAsk,
  stripScenarioAContemptProbeStreamingEcho,
} from './scenarioAContemptProbeTtsStrip';

export {
  type Scenario1Moment1UserMessageLike,
  aggregateScenario1Moment1UserTextForContemptGate,
  type ScenarioAContemptProbeSkipReason,
  evaluateScenarioAQ1ContemptProbePreProbeSkip,
  hasScenarioAQ1ContemptProbeCoverage,
  debugScenarioAQ1ContemptProbeCoverageDetail,
  hasScenarioAQ1VignetteEngagement,
  isReplyingToScenarioAQ1AfterDelivery,
  isScenarioAQ1Prompt,
} from './scenarioAContemptProbeCoverage';
