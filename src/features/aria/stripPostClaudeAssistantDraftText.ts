import {
  transcriptContainsScenarioCSophiePerspectiveProbe,
} from '@features/aria/interviewDisengagementTranscriptHelpers';
import {
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCSophieRolePlayMisparaphraseQuestion,
  looksLikeScenarioCSophieReceiveMisparaphraseQuestion,
  looksLikeScenarioCSophiePerspectiveQuestion,
  isIncompleteScenarioCSophieReceiveLeadSentence,
  isIncompleteScenarioCBoundaryClosureLeadSentence,
  isScenarioCBoundaryReflectionWithoutMoment4Handoff,
  scenarioCUserAnswerHasSubstantiveRepairContent,
  scenarioCUserAnswerSatisfiesRepairQuestionAnswer,
  scenarioCQ1InterpretationSatisfiedInTranscript,
  shouldSuppressScenarioCQ1VerbatimReplay,
  resolveScenarioCNextProbeAfterSatisfiedQ1,
  looksLikeScenarioCDanielPrescriptiveQ1Paraphrase,
  looksLikeScenarioCNextStepsBetweenThemMisparaphraseQuestion,
  looksLikeScenarioCSophieSayToSophieMisparaphraseQuestion,
  coerceScenarioCSophiePerspectiveQuestionForTts,
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
  coerceScenarioCSophieRolePlayQuestionForTts,
  coerceScenarioCRepairQuestionForTts,
  looksLikeScenarioCRepairWithUserAnswerEcho,
  shouldSuppressScenarioCRepairReplay,
} from '@features/aria/scenarioCPromptDetection';
import { userAnswerHasSophiePerspectiveLanguage } from '@features/aria/interviewMentalizingAndAnswerSignals';
import { transcriptContainsScenarioCRepairQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { stripScenarioCThresholdQuestionFromText } from '@features/aria/interviewScenarioCTextHelpers';
import { coerceOpeningNamePromptForTts } from '@features/aria/interviewPreambleBriefing';
import { SCENARIO_2_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import {
  looksLikeInterviewClosingAssistantMessage,
  stripConsecutiveDuplicateSentencesWithinDraft,
  stripDuplicateInterviewClosingParagraphs,
  stripDuplicateInterviewClosingSentencesWithinDraft,
  stripPrematureInterviewClosingFromScenarioDraft,
} from '@features/aria/elongatingProbe';
import {
  hasScenarioBoundaryWrapPhrase,
  isNaturalLanguageScenarioHandoffTransition,
} from '@features/aria/emotionRecognitionInterview';
import {
  stripDuplicateMoment4SpecificityFollowUpParagraphs,
  stripDuplicateMoment5AccountabilityProbeParagraphs,
  stripDuplicateMoment5ConflictValidityClarificationParagraphs,
  stripDuplicateMoment5SpecificityRedirectParagraphs,
  stripDuplicateScenarioAContemptProbeParagraphs,
  stripDuplicateScenarioARepairQuestionParagraphs,
} from '@features/aria/interviewAssistantDuplicateStrip';
import {
  collapseStackedEmpathyIHearYouInFirstParagraph,
  enforceAcknowledgmentVariation,
  stripFlatReflectionAcknowledgmentOpeners,
  stripForbiddenReflectionLead,
  stripInternalReflectionSchemaLeak,
  stripGenericReflectionFillersFirstParagraph,
  stripHollowSystemInterviewerPhrases,
  coerceMidScenarioRelationalReflectionToBriefAck,
} from '@features/aria/interviewAssistantReflection';
import {
  cleanupScenarioWrapAfterRepairStrip,
  findLastUserWithPriorAssistantContent,
  findLastUserWithPriorScenarioARepairContext,
  findLastUserWithPriorScenarioBJamesRepairContext,
  looksLikeScenarioARepairQuestion,
  shouldAdvanceScenarioAAfterSatisfiedRepair,
  shouldAdvanceScenarioBAfterSatisfiedRepair,
  stripScenarioARepairQuestion,
  userAnswerSatisfiesScenarioARepairPrompt,
  userAnswerSatisfiesScenarioBJamesRepairPrompt,
} from '@features/aria/interviewDisengagementProbes';
import { textContainsScenarioBVignetteBody, textContainsScenarioCVignetteBody } from '@features/aria/emotionScenarioTransitionInference';
import {
  assistantTextLooksLikeScenarioBPrematureAnswerRedirect,
  coerceScenarioBPrematureRepairRedirectToJamesDifferently,
  coerceScenarioBJamesRepairQuestionForTts,
  isIncompleteScenarioBQ1LeadSentence,
  looksLikeScenarioBQ1Question,
  looksLikeScenarioBJamesDifferentlyQuestion,
  scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent,
  lastAssistantPromptIsScenarioBQ1OrPrematureRedirect,
  userAnswerLooksLikeAheadOfScheduleScenarioBOnQ1,
  userAnswerLooksLikeAheadOfScheduleScenarioBJamesDifferentlyOnQ1,
} from '@features/aria/scenarioBProbeLogic';
import { applyPostClaudeScenarioAdvanceBundleOverride } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import { assistantTextLooksLikeMoment4HandoffLead } from '@features/aria/interviewTransitionBundles';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { stripStandalonePersonalDisclosureAckOutsidePersonalMoments } from '@features/aria/personalDisclosureAckGate';
import { computeMoment5InterviewCloseGate } from '@features/aria/interviewProgressSync';
import { ensureScenario2BundleWhenOpeningWithoutVignette } from '@features/aria/interviewTransitionBundles';
import { logPostClaudeAssistantDraftSanitizeChange } from '@features/aria/postClaudeAssistantDraftSanitizeLog';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  isIncompleteScenarioAContemptProbeLeadSentence,
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  looksLikeScenarioAContemptProbeQuestion,
  scenarioAEmmaVeryClearContemptReask,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
  stripScenarioAContemptProbeQuestion,
} from '@features/aria/probeAndScoringUtils';
import { repairAnswerHasConcreteSuggestionActionOrStep } from '@features/aria/interviewRepairRefusalDetection';
import {
  isScenarioABoundaryReflectionWithoutNextVignette,
  isScenarioAHandoffWithoutNextVignette,
} from '@features/aria/scenarioAContemptProbeTextMatch';
import {
  isActiveScenarioAConstructProbeTurn,
  scenarioAMinimumEngagementForHandoff,
  shouldDeliverScenarioFollowUpQuestion,
  stripPrematureScenarioABoundaryFromDraft,
  transcriptContainsScenarioAContemptProbe,
  transcriptHasUserResponseAfterScenarioAContemptProbe,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import { stripScenarioModalFollowUpProbeParagraphs, isScenarioModalFollowUpProbe } from '@features/aria/interviewScenarioModalPrompt';
import { stripScenarioANonScriptedParaphraseParagraphs } from '@features/aria/situation1ExactModalPrompt';
import {
  normalizeScenarioARepairQuestionInAssistantDraft,
  shouldAllowScenarioARepairAfterContemptAnswer,
  shouldSkipScenarioARepairDraftNormalization,
} from '@features/aria/scenarioARepairQuestionHelpers';
import {
  looksLikeMoment5ResolutionFollowUpPrompt,
  stripInterviewClosingBundledWithMoment5ResolutionFollowUp,
} from '@features/aria/moment5SpecificityRedirect';
import { remoteLog } from '@utilities/remoteLog';

export type StripPostClaudeAssistantDraftResult = {
  strippedText: string;
  shouldInjectScenarioARepairAfterContemptAnswer: boolean;
  scenarioHandoffAssistantTurn: boolean;
};

function injectScenarioAdvanceIfRepairSatisfiedAndEmpty(
  strippedText: string,
  params: PostClaudeAssistantTurnParams,
  deps: PostClaudeAssistantTurnDeps,
  logEvent: string,
): string {
  if (strippedText.trim()) return strippedText;
  const advanceBundle = applyPostClaudeScenarioAdvanceBundleOverride(
    '',
    params.participantFirstNameForSpoken,
    params.messagesToUse,
    deps.currentInterviewMomentRef.current,
    deps.currentScenarioRef.current,
  );
  if (!advanceBundle) return strippedText;
  const injected = stripControlTokens(advanceBundle);
  void remoteLog(logEvent, {
    interviewSessionId: deps.interviewSessionIdRef.current,
    preview: injected.slice(0, 280),
  });
  return injected;
}

/** Reflection ack strips, duplicate-paragraph removal, and moment/scenario-specific text cleanup. */
export function stripPostClaudeAssistantDraftText(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  initialStrippedText: string,
): StripPostClaudeAssistantDraftResult {
  let strippedText = initialStrippedText;
  strippedText = coerceMidScenarioRelationalReflectionToBriefAck(
    strippedText,
    params.messagesToUse.filter((m) => m.role === 'assistant') as PostClaudeInterviewMessage[],
  );
  strippedText = stripFlatReflectionAcknowledgmentOpeners(strippedText);
  strippedText = stripGenericReflectionFillersFirstParagraph(strippedText);
  strippedText = stripStandalonePersonalDisclosureAckOutsidePersonalMoments(
    strippedText,
    deps.currentInterviewMomentRef.current,
  );
  strippedText = stripHollowSystemInterviewerPhrases(strippedText);
  strippedText = collapseStackedEmpathyIHearYouInFirstParagraph(strippedText);
  strippedText = enforceAcknowledgmentVariation(
    strippedText,
    params.messagesToUse.filter((m) => m.role === 'assistant') as PostClaudeInterviewMessage[],
    params.isPersonalOpening || deps.currentInterviewMomentRef.current >= 4,
  );
  strippedText = stripForbiddenReflectionLead(strippedText);
  strippedText = stripInternalReflectionSchemaLeak(strippedText);
  strippedText = ensureScenario2BundleWhenOpeningWithoutVignette(
    strippedText,
    deps.currentInterviewMomentRef.current,
    params.participantFirstNameForSpoken,
    SCENARIO_2_TEXT,
    deps.currentScenarioRef.current ?? 1,
  );

  const beforeM4SpecDupStrip = strippedText;
  strippedText = stripDuplicateMoment4SpecificityFollowUpParagraphs(
    strippedText,
    params.messagesToUse,
    deps.currentInterviewMomentRef.current,
  );
  logPostClaudeAssistantDraftSanitizeChange(
    '[M4_SPECIFICITY_FOLLOWUP_STRIPPED_DUPLICATE]',
    beforeM4SpecDupStrip,
    strippedText,
  );

  const beforeM5SpecDupStrip = strippedText;
  strippedText = stripDuplicateMoment5SpecificityRedirectParagraphs(
    strippedText,
    params.messagesToUse,
    deps.currentInterviewMomentRef.current,
  );
  logPostClaudeAssistantDraftSanitizeChange(
    '[M5_SPECIFICITY_REDIRECT_STRIPPED_DUPLICATE]',
    beforeM5SpecDupStrip,
    strippedText,
  );

  const beforeM5AccountabilityDupStrip = strippedText;
  strippedText = stripDuplicateMoment5AccountabilityProbeParagraphs(
    strippedText,
    params.messagesToUse,
    deps.currentInterviewMomentRef.current,
    deps.moment5AccountabilityProbeFiredRef.current,
  );
  logPostClaudeAssistantDraftSanitizeChange(
    '[M5_ACCOUNTABILITY_PROBE_STRIPPED_DUPLICATE]',
    beforeM5AccountabilityDupStrip,
    strippedText,
  );

  const beforeS1ContemptDupStrip = strippedText;
  strippedText = stripDuplicateScenarioAContemptProbeParagraphs(
    strippedText,
    params.messagesToUse,
    deps.currentInterviewMomentRef.current,
    deps.scenarioAContemptProbeAskedRef.current,
  );
  logPostClaudeAssistantDraftSanitizeChange(
    '[S1_CONTEMPT_PROBE_STRIPPED_DUPLICATE_PARAGRAPHS]',
    beforeS1ContemptDupStrip,
    strippedText,
  );

  const scenarioAConstructProbeTurn = isActiveScenarioAConstructProbeTurn(
    deps.currentScenarioRef.current,
    deps.currentInterviewMomentRef.current,
  );
  const { lastUserContent: lastUserForS1Advance, priorAssistantContent: priorAsstForS1Advance } =
    findLastUserWithPriorScenarioARepairContext(params.messagesToUse);
  const priorRepairContextForS1Advance =
    priorAsstForS1Advance ??
    findLastUserWithPriorAssistantContent(params.messagesToUse).priorAssistantContent;
  const repairSatisfiedForScenarioAAdvance =
    scenarioAConstructProbeTurn &&
    !!lastUserForS1Advance &&
    !!priorRepairContextForS1Advance &&
    userAnswerSatisfiesScenarioARepairPrompt(
      lastUserForS1Advance,
      priorRepairContextForS1Advance,
    );
  const contemptSatisfiedWithoutProbe =
    params.specificEmmaLineAlreadyAddressed &&
    deps.scenarioAContemptProbeAskedRef.current &&
    !transcriptContainsScenarioAContemptProbe(params.messagesToUse);
  const shouldInjectScenarioARepairAfterContemptAnswer = shouldAllowScenarioARepairAfterContemptAnswer({
    currentScenario: deps.currentScenarioRef.current,
    currentMoment: deps.currentInterviewMomentRef.current,
    scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
    scenarioARepairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
    replyingToScenarioAQ1: params.replyingToScenarioAQ1,
    specificEmmaLineAlreadyAddressed: params.specificEmmaLineAlreadyAddressed,
    shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
    messagesToUse: params.messagesToUse,
    lastDeliveredQuestionText: deps.lastQuestionTextRef.current,
  });
  if (
    !strippedText.trim() &&
    shouldInjectScenarioARepairAfterContemptAnswer &&
    !looksLikeScenarioARepairQuestion(strippedText)
  ) {
    if (shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY)) {
      strippedText = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
      void remoteLog('[S1_REPAIR_INJECTED_AFTER_DUPLICATE_CONTEMPT_STRIP]', {
        preview: strippedText.slice(0, 260),
        s1ContemptFixVersion: 9,
      });
    }
  }

  const scenarioHandoffAssistantTurn = isNaturalLanguageScenarioHandoffTransition(strippedText);
  if (!scenarioHandoffAssistantTurn) {
    const beforeS1RepairDupStrip = strippedText;
    strippedText = stripDuplicateScenarioARepairQuestionParagraphs(
      strippedText,
      params.messagesToUse,
      deps.currentInterviewMomentRef.current,
      deps.scenarioARepairQuestionAskedRef.current,
    );
    logPostClaudeAssistantDraftSanitizeChange(
      '[S1_REPAIR_QUESTION_STRIPPED_DUPLICATE_PARAGRAPHS]',
      beforeS1RepairDupStrip,
      strippedText,
    );
    if (
      !strippedText.trim() &&
      beforeS1RepairDupStrip.trim() &&
      !looksLikeScenarioARepairQuestion(beforeS1RepairDupStrip) &&
      shouldDeliverScenarioFollowUpQuestion(
        params.messagesToUse,
        SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
      )
    ) {
      strippedText = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
      void remoteLog('[S1_REPAIR_REINJECTED_AFTER_PHANTOM_DEDUP_STRIP]', {
        preview: strippedText.slice(0, 220),
        beforePreview: beforeS1RepairDupStrip.slice(0, 220),
      });
    }
  }

  const beforeClosingWithinTurnDupStrip = strippedText;
  strippedText = stripDuplicateInterviewClosingSentencesWithinDraft(strippedText);
  if (strippedText !== beforeClosingWithinTurnDupStrip) {
    void remoteLog('[INTERVIEW_CLOSING_STRIPPED_WITHIN_TURN_DUPLICATE]', {
      preview: beforeClosingWithinTurnDupStrip.slice(0, 260),
      afterPreview: strippedText.slice(0, 260),
    });
  }

  if (deps.currentInterviewMomentRef.current < 5) {
    const beforePrematureScenarioClosingStrip = strippedText;
    strippedText = stripPrematureInterviewClosingFromScenarioDraft(strippedText);
    if (strippedText !== beforePrematureScenarioClosingStrip) {
      void remoteLog('[INTERVIEW_CLOSING_STRIPPED_PRE_SCENARIO_GATE]', {
        interviewMoment: deps.currentInterviewMomentRef.current,
        preview: beforePrematureScenarioClosingStrip.slice(0, 260),
        afterPreview: strippedText.slice(0, 260),
      });
    }
  }

  const beforeConsecutiveSentenceDupStrip = strippedText;
  strippedText = stripConsecutiveDuplicateSentencesWithinDraft(strippedText);
  if (strippedText !== beforeConsecutiveSentenceDupStrip) {
    void remoteLog('[ASSISTANT_TURN_STRIPPED_CONSECUTIVE_DUPLICATE_SENTENCE]', {
      preview: beforeConsecutiveSentenceDupStrip.slice(0, 260),
      afterPreview: strippedText.slice(0, 260),
    });
  }

  const beforeClosingDupStrip = strippedText;
  strippedText = stripDuplicateInterviewClosingParagraphs(strippedText, params.messagesToUse);
  logPostClaudeAssistantDraftSanitizeChange(
    '[INTERVIEW_CLOSING_STRIPPED_DUPLICATE]',
    beforeClosingDupStrip,
    strippedText,
  );

  if (deps.currentInterviewMomentRef.current === 5) {
    const beforeM5ResolutionStrip = strippedText;
    if (looksLikeMoment5ResolutionFollowUpPrompt(strippedText)) {
      deps.moment5ResolutionFollowUpIssuedRef.current = true;
      strippedText = stripInterviewClosingBundledWithMoment5ResolutionFollowUp(strippedText);
      logPostClaudeAssistantDraftSanitizeChange(
        '[M5_RESOLUTION_FOLLOWUP_STRIPPED_BUNDLED_CLOSING]',
        beforeM5ResolutionStrip,
        strippedText,
      );
    }
    const closeGateForPrematureClosingStrip = computeMoment5InterviewCloseGate(params.messagesToUse, {
      moment5QuestionDelivered: deps.moment5QuestionDeliveredRef.current,
      moment5PrimaryAnchorSession: deps.moment5PrimaryAnchorDeliveredSessionRef.current,
      postM5UserTurnsRef: deps.moment5PostPromptUserTurnCountRef.current,
      accountabilityProbeFired: deps.moment5AccountabilityProbeFiredRef.current,
      currentInterviewMoment: deps.currentInterviewMomentRef.current,
      moment5ResolutionDelivered: deps.moment5ResolutionDeliveredRef.current,
    });
    if (
      !closeGateForPrematureClosingStrip.moment5CloseAllowed &&
      looksLikeInterviewClosingAssistantMessage(strippedText)
    ) {
      void remoteLog('[INTERVIEW_CLOSING_STRIPPED_PRE_M5_GATE]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        postM5UserTurns: closeGateForPrematureClosingStrip.postM5UserTurns,
        resolutionFollowUpStillRequired: closeGateForPrematureClosingStrip.resolutionFollowUpStillRequired,
        accountabilityProbeStillRequired: closeGateForPrematureClosingStrip.accountabilityProbeStillRequired,
        preview: strippedText.slice(0, 260),
      });
      strippedText = '';
    }
  }

  if (
    deps.currentInterviewMomentRef.current === 5 &&
    looksLikeMoment5AccountabilityProbeAssistantPrompt(strippedText)
  ) {
    deps.moment5AccountabilityProbeFiredRef.current = true;
    deps.moment5ClientScoringMetaRef.current = {
      ...(deps.moment5ClientScoringMetaRef.current ?? {}),
      accountabilityProbeFired: true,
      warmAckBeforeAccountabilityProbe:
        deps.moment5ClientScoringMetaRef.current?.warmAckBeforeAccountabilityProbe === true ||
        /\bappreciate you getting vulnerable\b/i.test(strippedText),
    };
  }

  const beforeM5ConflictClarDupStrip = strippedText;
  strippedText = stripDuplicateMoment5ConflictValidityClarificationParagraphs(
    strippedText,
    params.messagesToUse,
    deps.currentInterviewMomentRef.current,
    deps.moment5ConflictValidityClarificationIssuedRef.current,
  );
  logPostClaudeAssistantDraftSanitizeChange(
    '[M5_CONFLICT_VALIDITY_CLAR_STRIPPED_DUPLICATE]',
    beforeM5ConflictClarDupStrip,
    strippedText,
  );

  if (
    scenarioAConstructProbeTurn &&
    deps.scenarioAContemptProbeAskedRef.current &&
    !repairSatisfiedForScenarioAAdvance
  ) {
    const beforeProbeStrip = strippedText;
    strippedText = stripScenarioAContemptProbeQuestion(strippedText);
    if (strippedText !== beforeProbeStrip) {
      if (!strippedText && shouldInjectScenarioARepairAfterContemptAnswer) {
        strippedText = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
      } else if (
        !strippedText &&
        (shouldInjectScenarioARepairAfterContemptAnswer || params.specificEmmaLineAlreadyAddressed)
      ) {
        strippedText = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
      }
      void remoteLog('[S1_CONTEMPT_PROBE_STRIPPED_DUPLICATE]', { preview: strippedText.slice(0, 220) });
    }
  }

  const shouldReplaceContemptAnswerCoaching =
    scenarioAConstructProbeTurn &&
    deps.scenarioAContemptProbeAskedRef.current &&
    !deps.scenarioARepairQuestionAskedRef.current &&
    (params.specificEmmaLineAlreadyAddressed ||
      shouldInjectScenarioARepairAfterContemptAnswer ||
      transcriptHasUserResponseAfterScenarioAContemptProbe(params.messagesToUse));
  if (shouldReplaceContemptAnswerCoaching) {
    const beforeFollowUpStrip = strippedText;
    if (params.specificEmmaLineAlreadyAddressed) {
      strippedText = stripScenarioAContemptProbeQuestion(strippedText);
      strippedText = strippedText
        .split(/\n\n+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0 && !looksLikeScenarioAContemptProbeQuestion(part))
        .join('\n\n')
        .trim();
    }
    strippedText = stripScenarioModalFollowUpProbeParagraphs(strippedText);
    strippedText = stripScenarioANonScriptedParaphraseParagraphs(strippedText);
    if (
      !strippedText.trim() &&
      shouldDeliverScenarioFollowUpQuestion(
        params.messagesToUse,
        SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
      )
    ) {
      strippedText = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
    }
    if (
      !looksLikeScenarioARepairQuestion(strippedText) &&
      shouldDeliverScenarioFollowUpQuestion(
        params.messagesToUse,
        SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
      )
    ) {
      if (params.specificEmmaLineAlreadyAddressed && contemptSatisfiedWithoutProbe) {
        strippedText = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
      } else {
        strippedText = strippedText.trim()
          ? `${strippedText.trim()}\n\n${SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY}`
          : SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
      }
    }
    if (strippedText !== beforeFollowUpStrip) {
      void remoteLog('[S1_CONTEMPT_ANSWER_REPLACED_RYAN_COACHING]', {
        beforePreview: beforeFollowUpStrip.slice(0, 220),
        afterPreview: strippedText.slice(0, 220),
        s1ContemptFixVersion: 19,
      });
    }
  }

  const hasScenarioWrapPhrase = hasScenarioBoundaryWrapPhrase(strippedText);
  if (
    repairSatisfiedForScenarioAAdvance &&
    shouldAdvanceScenarioAAfterSatisfiedRepair(
      params.messagesToUse,
      strippedText,
      deps.currentInterviewMomentRef.current,
    )
  ) {
    const advanceBundle = applyPostClaudeScenarioAdvanceBundleOverride(
      strippedText,
      params.participantFirstNameForSpoken,
      params.messagesToUse,
      deps.currentInterviewMomentRef.current,
      deps.currentScenarioRef.current,
    );
    if (advanceBundle) {
      strippedText = stripControlTokens(advanceBundle);
      void remoteLog('[S1_REPAIR_SATISFIED_BUNDLE_INJECTED_AFTER_SANITIZE]', {
        preview: strippedText.slice(0, 280),
      });
    }
  }
  if (
    scenarioAConstructProbeTurn &&
    !repairSatisfiedForScenarioAAdvance &&
    !scenarioAMinimumEngagementForHandoff(params.messagesToUse) &&
    (hasScenarioWrapPhrase ||
      isScenarioABoundaryReflectionWithoutNextVignette(strippedText) ||
      isScenarioAHandoffWithoutNextVignette(strippedText) ||
      textContainsScenarioBVignetteBody(strippedText))
  ) {
    const beforePrematureS1BoundaryStrip = strippedText;
    strippedText = stripPrematureScenarioABoundaryFromDraft(strippedText);
    if (strippedText !== beforePrematureS1BoundaryStrip) {
      void remoteLog('[S1_PREMATURE_BOUNDARY_STRIPPED_FROM_DRAFT]', {
        beforePreview: beforePrematureS1BoundaryStrip.slice(0, 260),
        afterPreview: strippedText.slice(0, 260),
      });
    }
  }
  if (
    scenarioAConstructProbeTurn &&
    deps.scenarioARepairQuestionAskedRef.current &&
    !repairSatisfiedForScenarioAAdvance
  ) {
    const shouldStripRepairEcho =
      hasScenarioWrapPhrase || !scenarioHandoffAssistantTurn;
    if (shouldStripRepairEcho) {
      const beforeRepairStrip = strippedText;
      strippedText = hasScenarioWrapPhrase
        ? cleanupScenarioWrapAfterRepairStrip(stripScenarioARepairQuestion(strippedText))
        : stripScenarioARepairQuestion(strippedText);
      logPostClaudeAssistantDraftSanitizeChange('[S1_REPAIR_QUESTION_STRIPPED_DUPLICATE]', beforeRepairStrip, strippedText, {
        preview: strippedText.slice(0, 220),
        hasScenarioWrapPhrase,
        scenarioHandoffAssistantTurn,
      });
    }
  }

  const scenarioBConstructProbeTurn =
    deps.currentInterviewMomentRef.current === 2 && (deps.currentScenarioRef.current ?? 2) === 2;
  const lastScenarioBUserAnswer = [...params.messagesToUse]
    .reverse()
    .find((m) => m.role === 'user')
    ?.content?.trim();
  if (
    scenarioBConstructProbeTurn &&
    lastScenarioBUserAnswer &&
    lastAssistantPromptIsScenarioBQ1OrPrematureRedirect(
      findLastUserWithPriorAssistantContent(params.messagesToUse).priorAssistantContent ?? '',
    ) &&
    userAnswerLooksLikeAheadOfScheduleScenarioBOnQ1(lastScenarioBUserAnswer) &&
    (assistantTextLooksLikeScenarioBPrematureAnswerRedirect(strippedText) ||
      isIncompleteScenarioBQ1LeadSentence(strippedText) ||
      (looksLikeScenarioBQ1Question(strippedText) && !looksLikeScenarioBJamesDifferentlyQuestion(strippedText)))
  ) {
    const beforeAheadOfScheduleCoerce = strippedText;
    if (
      userAnswerLooksLikeAheadOfScheduleScenarioBJamesDifferentlyOnQ1(lastScenarioBUserAnswer) &&
      !scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(lastScenarioBUserAnswer)
    ) {
      strippedText = coerceScenarioBJamesRepairQuestionForTts(strippedText);
    } else {
      strippedText = coerceScenarioBPrematureRepairRedirectToJamesDifferently(strippedText);
    }
    if (strippedText !== beforeAheadOfScheduleCoerce) {
      void remoteLog('[S2_AHEAD_OF_SCHEDULE_REDIRECT_COERCED]', {
        beforePreview: beforeAheadOfScheduleCoerce.slice(0, 220),
        afterPreview: strippedText.slice(0, 220),
        userPreview: lastScenarioBUserAnswer.slice(0, 220),
      });
    }
  }
  const { lastUserContent: lastUserForS2Advance, priorJamesRepairAssistantContent: priorAsstForS2Advance } =
    findLastUserWithPriorScenarioBJamesRepairContext(params.messagesToUse);
  const priorJamesRepairContextForS2Advance =
    priorAsstForS2Advance ??
    findLastUserWithPriorAssistantContent(params.messagesToUse).priorAssistantContent;
  const jamesRepairSatisfiedForScenarioBAdvance =
    scenarioBConstructProbeTurn &&
    !!lastUserForS2Advance &&
    !!priorJamesRepairContextForS2Advance &&
    userAnswerSatisfiesScenarioBJamesRepairPrompt(
      lastUserForS2Advance,
      priorJamesRepairContextForS2Advance,
    );
  if (
    jamesRepairSatisfiedForScenarioBAdvance &&
    strippedText.trim() &&
    !textContainsScenarioCVignetteBody(strippedText) &&
    shouldAdvanceScenarioBAfterSatisfiedRepair(
      params.messagesToUse,
      strippedText,
      deps.currentScenarioRef.current ?? 2,
    )
  ) {
    const advanceBundle = applyPostClaudeScenarioAdvanceBundleOverride(
      strippedText,
      params.participantFirstNameForSpoken,
      params.messagesToUse,
      deps.currentInterviewMomentRef.current,
      deps.currentScenarioRef.current,
    );
    if (advanceBundle) {
      strippedText = stripControlTokens(advanceBundle);
      void remoteLog('[S2_JAMES_REPAIR_SATISFIED_BUNDLE_INJECTED_AFTER_SANITIZE]', {
        preview: strippedText.slice(0, 280),
      });
    }
  }

  const { lastUserContent: lastUserForRepairAdvance, priorAssistantContent: priorAsstForRepairAdvance } =
    findLastUserWithPriorScenarioARepairContext(params.messagesToUse);
  const priorRepairContextForAdvance =
    priorAsstForRepairAdvance ??
    findLastUserWithPriorAssistantContent(params.messagesToUse).priorAssistantContent;
  if (
    scenarioAConstructProbeTurn &&
    lastUserForRepairAdvance &&
    priorRepairContextForAdvance &&
    userAnswerSatisfiesScenarioARepairPrompt(lastUserForRepairAdvance, priorRepairContextForAdvance) &&
    (looksLikeScenarioAContemptProbeQuestion(strippedText) ||
      (params.specificEmmaLineAlreadyAddressed &&
        scenarioAEmmaVeryClearContemptReask(strippedText)) ||
      isIncompleteScenarioAContemptProbeLeadSentence(strippedText))
  ) {
    const beforePostRepairContemptStrip = strippedText;
    strippedText = stripScenarioAContemptProbeQuestion(strippedText);
    strippedText = strippedText
      .split(/\n\n+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && !looksLikeScenarioAContemptProbeQuestion(part))
      .join('\n\n')
      .trim();
    if (!strippedText.trim()) {
      const advanceBundle = applyPostClaudeScenarioAdvanceBundleOverride(
        '',
        params.participantFirstNameForSpoken,
        params.messagesToUse,
        deps.currentInterviewMomentRef.current,
        deps.currentScenarioRef.current,
      );
      if (advanceBundle) {
        strippedText = stripControlTokens(advanceBundle);
        void remoteLog('[S1_REPAIR_SATISFIED_BUNDLE_INJECTED_AFTER_CONTEMPT_STRIP]', {
          preview: strippedText.slice(0, 280),
        });
      }
    }
    if (strippedText !== beforePostRepairContemptStrip) {
      void remoteLog('[S1_CONTEMPT_STRIPPED_AFTER_SATISFIED_REPAIR]', {
        beforePreview: beforePostRepairContemptStrip.slice(0, 220),
        afterPreview: strippedText.slice(0, 220),
      });
    }
  }

  if (deps.currentInterviewMomentRef.current === 3) {
    const activeScenario = deps.currentScenarioRef.current ?? 1;
    const lastUserAnswer = [...params.messagesToUse]
      .reverse()
      .find((m) => m.role === 'user')
      ?.content?.trim();
    const skipS3RepairInject = scenarioCUserAnswerHasSubstantiveRepairContent(lastUserAnswer);
    const q1FollowUpsAlreadySatisfied =
      userAnswerHasSophiePerspectiveLanguage(lastUserAnswer ?? '') && skipS3RepairInject;
    if (
      activeScenario === 3 &&
      shouldSuppressScenarioCQ1VerbatimReplay(params.messagesToUse, strippedText)
    ) {
      const beforeS3Q1VerbatimReplay = strippedText;
      strippedText = '';
      logPostClaudeAssistantDraftSanitizeChange(
        '[S3_Q1_VERBATIM_REPLAY_STRIPPED]',
        beforeS3Q1VerbatimReplay,
        strippedText,
      );
      void remoteLog('[S3_Q1_VERBATIM_REPLAY_STRIPPED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        beforePreview: beforeS3Q1VerbatimReplay.slice(0, 220),
      });
    }
    if (
      activeScenario === 3 &&
      (isScenarioCRepairAssistantPrompt(strippedText) ||
        looksLikeScenarioCRepairWithUserAnswerEcho(strippedText)) &&
      shouldSuppressScenarioCRepairReplay(params.messagesToUse, strippedText, {
        repairProbeDeliveredRef: deps.s3RepairProbeDeliveredRef.current,
      })
    ) {
      const beforeS3RepairReplay = strippedText;
      strippedText = '';
      logPostClaudeAssistantDraftSanitizeChange(
        '[S3_REPAIR_VERBATIM_REPLAY_STRIPPED]',
        beforeS3RepairReplay,
        strippedText,
      );
      void remoteLog('[S3_REPAIR_VERBATIM_REPLAY_STRIPPED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        beforePreview: beforeS3RepairReplay.slice(0, 220),
      });
    } else if (
      activeScenario === 3 &&
      looksLikeScenarioCRepairWithUserAnswerEcho(strippedText)
    ) {
      const beforeS3RepairEcho = strippedText;
      strippedText = coerceScenarioCRepairQuestionForTts(strippedText);
      logPostClaudeAssistantDraftSanitizeChange(
        '[S3_REPAIR_ECHO_COERCED_TO_CANONICAL]',
        beforeS3RepairEcho,
        strippedText,
      );
      void remoteLog('[S3_REPAIR_ECHO_COERCED_TO_CANONICAL]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        beforePreview: beforeS3RepairEcho.slice(0, 220),
        afterPreview: strippedText.slice(0, 220),
      });
    }
    if (
      activeScenario === 3 &&
      scenarioCQ1InterpretationSatisfiedInTranscript(params.messagesToUse) &&
      !transcriptContainsScenarioCRepairQuestion(params.messagesToUse) &&
      looksLikeScenarioCDanielPrescriptiveQ1Paraphrase(strippedText)
    ) {
      const beforeS3Q1ReplayStrip = strippedText;
      strippedText = resolveScenarioCNextProbeAfterSatisfiedQ1(params.messagesToUse);
      logPostClaudeAssistantDraftSanitizeChange(
        '[S3_Q1_REPLAY_REPLACED_AFTER_SATISFIED_INTERPRETATION]',
        beforeS3Q1ReplayStrip,
        strippedText,
      );
      void remoteLog('[S3_Q1_REPLAY_REPLACED_AFTER_SATISFIED_INTERPRETATION]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        beforePreview: beforeS3Q1ReplayStrip.slice(0, 220),
        afterPreview: strippedText.slice(0, 220),
      });
    }
    if (
      activeScenario === 3 &&
      scenarioCQ1InterpretationSatisfiedInTranscript(params.messagesToUse) &&
      !transcriptContainsScenarioCRepairQuestion(params.messagesToUse) &&
      (looksLikeScenarioCNextStepsBetweenThemMisparaphraseQuestion(strippedText) ||
        looksLikeScenarioCSophieSayToSophieMisparaphraseQuestion(strippedText)) &&
      !transcriptContainsScenarioCSophiePerspectiveProbe(params.messagesToUse)
    ) {
      const beforeS3NextStepsStrip = strippedText;
      strippedText = coerceScenarioCSophiePerspectiveQuestionForTts(strippedText);
      logPostClaudeAssistantDraftSanitizeChange(
        '[S3_NEXT_STEPS_MISPARAPHRASE_REPLACED_WITH_SOPHIE_PROBE]',
        beforeS3NextStepsStrip,
        strippedText,
      );
      void remoteLog('[S3_NEXT_STEPS_MISPARAPHRASE_REPLACED_WITH_SOPHIE_PROBE]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        beforePreview: beforeS3NextStepsStrip.slice(0, 220),
        afterPreview: strippedText.slice(0, 220),
      });
    }
    if (
      activeScenario === 3 &&
      skipS3RepairInject &&
      looksLikeScenarioCSophiePerspectiveQuestion(strippedText) &&
      !isScenarioCRepairAssistantPrompt(strippedText) &&
      !assistantTextLooksLikeMoment4HandoffLead(strippedText)
    ) {
      const beforeSophieReplayStrip = strippedText;
      strippedText = injectScenarioAdvanceIfRepairSatisfiedAndEmpty(
        '',
        params,
        deps,
        '[S3_SOPHIE_REPLAY_REPLACED_WITH_M4_BUNDLE]',
      );
      logPostClaudeAssistantDraftSanitizeChange(
        '[S3_SOPHIE_REPLAY_REPLACED_WITH_M4_BUNDLE]',
        beforeSophieReplayStrip,
        strippedText,
      );
    }
    if (
      activeScenario === 3 &&
      looksLikeScenarioCSophieRolePlayMisparaphraseQuestion(strippedText)
    ) {
      const beforeSophieRolePlayStrip = strippedText;
      if (q1FollowUpsAlreadySatisfied) {
        strippedText = injectScenarioAdvanceIfRepairSatisfiedAndEmpty(
          '',
          params,
          deps,
          '[S3_REPAIR_SATISFIED_BUNDLE_INJECTED_AFTER_SOPHIE_ROLEPLAY_STRIP]',
        );
      } else if (userAnswerHasSophiePerspectiveLanguage(lastUserAnswer ?? '')) {
        strippedText = skipS3RepairInject
          ? injectScenarioAdvanceIfRepairSatisfiedAndEmpty(
              '',
              params,
              deps,
              '[S3_REPAIR_SATISFIED_BUNDLE_INJECTED_AFTER_SOPHIE_ROLEPLAY_STRIP]',
            )
          : SCENARIO_C_REPAIR_QUESTION_CANONICAL;
      } else {
        strippedText = coerceScenarioCSophieRolePlayQuestionForTts(strippedText);
      }
      logPostClaudeAssistantDraftSanitizeChange(
        '[S3_SOPHIE_ROLEPLAY_MISPARAPHRASE_COERCED]',
        beforeSophieRolePlayStrip,
        strippedText,
      );
    }
    if (
      activeScenario === 3 &&
      (looksLikeScenarioCSophieReceiveMisparaphraseQuestion(strippedText) ||
        isIncompleteScenarioCSophieReceiveLeadSentence(strippedText))
    ) {
      const beforeSophieReceiveStrip = strippedText;
      if (q1FollowUpsAlreadySatisfied || skipS3RepairInject) {
        strippedText = injectScenarioAdvanceIfRepairSatisfiedAndEmpty(
          '',
          params,
          deps,
          '[S3_REPAIR_SATISFIED_BUNDLE_INJECTED_AFTER_SOPHIE_RECEIVE_STRIP]',
        );
      } else {
        strippedText = scenarioCQ1InterpretationSatisfiedInTranscript(params.messagesToUse)
          ? resolveScenarioCNextProbeAfterSatisfiedQ1(params.messagesToUse)
          : SCENARIO_C_REPAIR_QUESTION_CANONICAL;
      }
      logPostClaudeAssistantDraftSanitizeChange(
        '[S3_SOPHIE_RECEIVE_MISPARAPHRASE_STRIPPED]',
        beforeSophieReceiveStrip,
        strippedText,
      );
    }
    if (
      activeScenario === 3 &&
      params.shouldForceScenarioCRepairProbe &&
      !transcriptContainsScenarioCRepairQuestion(params.messagesToUse) &&
      !isScenarioCRepairAssistantPrompt(strippedText) &&
      !skipS3RepairInject
    ) {
      const beforeS3ForcedRepairOnly = strippedText;
      strippedText = SCENARIO_C_REPAIR_QUESTION_CANONICAL;
      logPostClaudeAssistantDraftSanitizeChange(
        '[S3_FORCED_REPAIR_Q2_ONLY]',
        beforeS3ForcedRepairOnly,
        strippedText,
      );
    } else if (
      activeScenario === 3 &&
      transcriptContainsScenarioCSophiePerspectiveProbe(params.messagesToUse) &&
      !transcriptContainsScenarioCRepairQuestion(params.messagesToUse) &&
      !isScenarioCRepairAssistantPrompt(strippedText) &&
      !skipS3RepairInject &&
      (hasScenarioBoundaryWrapPhrase(strippedText) ||
        /\bthat'?s a wrap on this one\b/i.test(strippedText) ||
        /\bthanks for going deep\b/i.test(strippedText))
    ) {
      const beforeS3RepairInject = strippedText;
      strippedText = SCENARIO_C_REPAIR_QUESTION_CANONICAL;
      logPostClaudeAssistantDraftSanitizeChange(
        '[S3_PREMATURE_WRAP_REPLACED_WITH_REPAIR_Q2]',
        beforeS3RepairInject,
        strippedText,
      );
      void remoteLog('[S3_PREMATURE_WRAP_REPLACED_WITH_REPAIR_Q2]', {
        beforePreview: beforeS3RepairInject.slice(0, 220),
      });
    }
    const beforeS3ThreshStrip = strippedText;
    strippedText = stripScenarioCThresholdQuestionFromText(strippedText);
    logPostClaudeAssistantDraftSanitizeChange('[S3_THRESHOLD_TEXT_STRIPPED]', beforeS3ThreshStrip, strippedText, {
      preview: strippedText.slice(0, 220),
    });
    if (
      activeScenario === 3 &&
      skipS3RepairInject &&
      strippedText.trim() &&
      !assistantTextLooksLikeMoment4HandoffLead(strippedText) &&
      (isScenarioCBoundaryReflectionWithoutMoment4Handoff(strippedText) ||
        isIncompleteScenarioCBoundaryClosureLeadSentence(strippedText))
    ) {
      const bundle = applyPostClaudeScenarioAdvanceBundleOverride(
        strippedText,
        params.participantFirstNameForSpoken,
        params.messagesToUse,
        deps.currentInterviewMomentRef.current,
        activeScenario,
      );
      if (bundle) {
        strippedText = stripControlTokens(bundle);
        void remoteLog('[S3_INCOMPLETE_BOUNDARY_REPLACED_WITH_M4_BUNDLE]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          preview: strippedText.slice(0, 280),
        });
      }
    }
    const { priorAssistantContent: s3PriorAsstForAdvance } = findLastUserWithPriorAssistantContent(
      params.messagesToUse,
    );
    const s3DanielRepairSatisfied =
      s3PriorAsstForAdvance &&
      isScenarioCRepairAssistantPrompt(s3PriorAsstForAdvance) &&
      scenarioCUserAnswerSatisfiesRepairQuestionAnswer(lastUserAnswer);
    if (
      activeScenario === 3 &&
      s3DanielRepairSatisfied &&
      isScenarioModalFollowUpProbe(strippedText)
    ) {
      const beforeS3ModalFollowUpStrip = strippedText;
      const bundle = applyPostClaudeScenarioAdvanceBundleOverride(
        strippedText,
        params.participantFirstNameForSpoken,
        params.messagesToUse,
        deps.currentInterviewMomentRef.current,
        activeScenario,
      );
      if (bundle) {
        strippedText = stripControlTokens(bundle);
        void remoteLog('[S3_REPAIR_SATISFIED_BUNDLE_INJECTED_AFTER_MODAL_FOLLOWUP]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          beforePreview: beforeS3ModalFollowUpStrip.slice(0, 220),
          preview: strippedText.slice(0, 280),
        });
      }
    }
  }

  strippedText = coerceOpeningNamePromptForTts(strippedText);

  if (
    isActiveScenarioAConstructProbeTurn(
      deps.currentScenarioRef.current,
      deps.currentInterviewMomentRef.current,
    ) &&
    !repairSatisfiedForScenarioAAdvance &&
    !shouldSkipScenarioARepairDraftNormalization(strippedText)
  ) {
    const beforeRepairNormalize = strippedText;
    strippedText = normalizeScenarioARepairQuestionInAssistantDraft(strippedText);
    if (strippedText !== beforeRepairNormalize) {
      void remoteLog('[S1_REPAIR_TRANSCRIPT_NORMALIZED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        beforePreview: beforeRepairNormalize.slice(0, 220),
        afterPreview: strippedText.slice(0, 220),
      });
    }
  }

  return {
    strippedText,
    shouldInjectScenarioARepairAfterContemptAnswer,
    scenarioHandoffAssistantTurn,
  };
}
