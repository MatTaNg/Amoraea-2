export {
  generateBriefAck,
  buildClosingLinePrompt,
  CLOSING_LINE_INSTRUCTIONS,
  PERSONAL_CLOSING_INSTRUCTION,
  SCENARIO_ONLY_CLOSING_INSTRUCTION,
} from './interviewClosingInstructions';

export {
  dedupeStackedInterviewThankYous,
  stripLeadingMirrorRecapBeforeThanks,
  sanitizeClosingLanguage,
} from './interviewClosingLanguageSanitize';

export {
  stripFlatReflectionAcknowledgmentOpeners,
  stripGenericReflectionFillersFirstParagraph,
  repairBrokenMoment5BridgeGrammar,
  stripHollowSystemInterviewerPhrases,
  collapseStackedEmpathyIHearYouInFirstParagraph,
  stripForbiddenReflectionLead,
  coerceMidScenarioRelationalReflectionToBriefAck,
  looksLikeInternalReflectionSchemaLeak,
  stripInternalReflectionSchemaLeak,
  isInternalReflectionSchemaStreamFragment,
} from './interviewReflectionTextStrips';

export {
  wrapMandatoryAckBodyWithValidationLead,
  enforceAcknowledgmentVariation,
  recentAssistantMessagesForAck,
} from './interviewReflectionAckVariation';

export { ensureScenario3VignetteOpening } from './interviewScenario3VignetteOpening';

export {
  wrapForcedProbeWithAck,
  prependBriefAckIfMissingBeforeMove,
  ensureAcknowledgmentBeforeMove,
  ensureAcknowledgmentBeforeClosing,
} from './interviewAcknowledgmentMoveGate';
