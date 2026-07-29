import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import {
  ensureScenarioCQ1SequenceAfterVignette,
  replaceOrphanScenarioCRepairWithQ1,
} from '@features/aria/interviewScenarioCTextHelpers';
import {
  ensureScenario3VignetteOpening,
} from '@features/aria/interviewAssistantReflection';
import {
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairStreamFragment,
  looksLikeScenarioBRepairAsJamesQuestion,
  stripScenarioARepairQuestion,
} from '@features/aria/interviewDisengagementProbes';
import {
  dedupeAdjacentBoundaryValidationsBeforeParticipantName,
} from '@features/aria/interviewerFrameworkPrompt';
import { logPostClaudeAssistantDraftSanitizeChange } from '@features/aria/postClaudeAssistantDraftSanitizeLog';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  coerceMoment4ThresholdQuestionForTts,
  isIncompleteMoment4ThresholdLeadSentence,
  looksLikeMoment4ThresholdParaphraseInProgress,
  looksLikeMoment4ThresholdQuestion,
} from '@features/aria/moment4ProbeLogic';
import {
  coerceMoment4SpecificityFollowUpForTts,
  isIncompleteMoment4SpecificityFollowUpLeadSentence,
  looksLikeMoment4SpecificityFollowUpEcho,
} from '@features/aria/moment4SpecificityFollowUp';
import {
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCDanielComeBackMisparaphraseQuestion,
} from '@features/aria/scenarioCPromptDetection';
import { shouldAdvanceScenarioAAfterSatisfiedRepair } from '@features/aria/interviewRepairRefusalDetection';
import {
  debugScenarioAQ1ContemptProbeCoverageDetail,
  isIncompleteScenarioAContemptProbeLeadSentence,
  looksLikeScenarioAContemptProbeQuestion,
  looksLikeScenarioBFullAppreciationProbeQuestion,
  looksLikeScenarioBJamesDifferentlyQuestion,
  stripScenarioAContemptProbeQuestion,
} from '@features/aria/probeAndScoringUtils';
import {
  coerceScenarioAContemptProbeForTts,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '@features/aria/scenarioAContemptProbeTtsStrip';
import { syncInterviewScenarioRefsFromTranscript } from '@features/aria/interviewScenarioRefSync';
import {
  coerceMisplacedScenarioRedirectForActiveScenario,
  isIncompleteMisplacedScenarioRedirectLeadSentence,
} from '@features/aria/misplacedScenarioAnswerLogic';
import {
  coerceScenarioBQ1QuestionForTts,
  coerceScenarioBJamesDifferentlyQuestionForTts,
  coerceScenarioBJamesRepairQuestionForTts,
  coerceScenarioBJamesSayToJamesQuestionForTts,
  collapseScenarioBJamesSayToJamesWithRepairDuplicate,
  isBeforeFightOnlyScenarioBJamesQ2Paraphrase,
  isDeliveredScenarioBJamesDifferentlyProbe,
  isIncompleteScenarioBJamesSayToJamesLeadSentence,
  looksLikeScenarioBJamesSayToJamesRolePlayQuestion,
  isIncompleteScenarioBQ1LeadSentence,
  isIncompleteScenarioBJamesDifferentlyLeadSentence,
  isIncompleteScenarioBJamesRepairLeadSentence,
} from '@features/aria/scenarioBProbeLogic';
import { textContainsScenarioCVignetteBody } from '@features/aria/scenarioCProbeLogic';
import { isActiveScenarioBConstructProbeTurn } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { remoteLog } from '@utilities/remoteLog';

export type PostClaudeAssistantDraftProbeFlags = {
  assistantIssuedMoment4ThresholdProbe: boolean;
  assistantIssuedMoment4AnyQuestion: boolean;
  assistantIssuedScenarioAContemptProbe: boolean;
  assistantIssuedScenarioARepairQuestion: boolean;
  assistantIssuedScenarioBFullProbe: boolean;
  assistantIssuedScenarioBJamesDifferently: boolean;
  assistantIssuedScenarioBRepairAsJames: boolean;
};

export type FinalizePostClaudeAssistantDraftProbeResult = PostClaudeAssistantDraftProbeFlags & {
  strippedText: string;
};

/** Probe detection, S3 sequence repair, participant-name dedupe, and contempt/repair ordering. */
export function finalizePostClaudeAssistantDraftProbeSequence(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  strippedTextIn: string,
  priorAssistantContentS3: string,
): FinalizePostClaudeAssistantDraftProbeResult {
  let strippedText = strippedTextIn;

  let assistantIssuedMoment4ThresholdProbe = looksLikeMoment4ThresholdQuestion(strippedText);
  const moment4ThresholdParaphraseInFlight =
    isIncompleteMoment4ThresholdLeadSentence(strippedText) ||
    looksLikeMoment4ThresholdParaphraseInProgress(strippedText);
  let assistantIssuedMoment4AnyQuestion =
    deps.currentInterviewMomentRef.current === 4 &&
    ((/\?$/.test(strippedText.trim()) && strippedText.trim().length > 10) ||
      moment4ThresholdParaphraseInFlight);
  if (
    deps.currentInterviewMomentRef.current === 4 &&
    deps.moment4ThresholdProbeAskedRef.current &&
    (assistantIssuedMoment4ThresholdProbe || moment4ThresholdParaphraseInFlight)
  ) {
    void remoteLog('[M4_THRESHOLD_DRAFT_SUPPRESSED_ALREADY_ASKED]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: strippedText.slice(0, 220),
    });
    strippedText = '';
    assistantIssuedMoment4ThresholdProbe = false;
    assistantIssuedMoment4AnyQuestion = false;
  }
  if (
    params.shouldForceMoment4ThresholdProbe &&
    (assistantIssuedMoment4ThresholdProbe || moment4ThresholdParaphraseInFlight)
  ) {
    strippedText = '';
    assistantIssuedMoment4ThresholdProbe = false;
    assistantIssuedMoment4AnyQuestion = false;
  }
  if (
    params.shouldForceMoment4ThresholdProbe &&
    assistantIssuedMoment4AnyQuestion
  ) {
    strippedText = '';
    assistantIssuedMoment4AnyQuestion = false;
  }
  if (
    params.shouldForceScenarioCRepairProbe &&
    looksLikeScenarioCDanielComeBackMisparaphraseQuestion(strippedText)
  ) {
    strippedText = '';
  }
  const rawAssistantIssuedScenarioAContemptProbe = looksLikeScenarioAContemptProbeQuestion(strippedText);
  let assistantIssuedScenarioAContemptProbe = rawAssistantIssuedScenarioAContemptProbe;
  let assistantIssuedScenarioARepairQuestion =
    deps.currentInterviewMomentRef.current === 1 && looksLikeScenarioARepairQuestion(strippedText);
  const assistantIssuedScenarioBFullProbe = looksLikeScenarioBFullAppreciationProbeQuestion(strippedText);
  let assistantIssuedScenarioBJamesDifferently =
    deps.currentInterviewMomentRef.current === 2 && looksLikeScenarioBJamesDifferentlyQuestion(strippedText);
  let assistantIssuedScenarioBRepairAsJames =
    deps.currentInterviewMomentRef.current === 2 && looksLikeScenarioBRepairAsJamesQuestion(strippedText);

  if (deps.currentInterviewMomentRef.current === 1 && rawAssistantIssuedScenarioAContemptProbe) {
    assistantIssuedScenarioAContemptProbe = true;
    assistantIssuedScenarioARepairQuestion =
      deps.currentInterviewMomentRef.current === 1 && looksLikeScenarioARepairQuestion(strippedText);
  }

  if (
    deps.currentInterviewMomentRef.current === 1 &&
    params.specificEmmaLineAlreadyAddressed &&
    assistantIssuedScenarioAContemptProbe
  ) {
    const beforeCoveredProbeStrip = strippedText;
    strippedText = stripScenarioAContemptProbeQuestion(strippedText);
    if (!strippedText) {
      strippedText = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
    }
    assistantIssuedScenarioAContemptProbe = false;
    assistantIssuedScenarioARepairQuestion = looksLikeScenarioARepairQuestion(strippedText);
    void remoteLog('[S1_MODEL_CONTEMPT_PROBE_SUPPRESSED_AFTER_USER_COVERAGE]', {
      coverageDetail: debugScenarioAQ1ContemptProbeCoverageDetail(params.scenarioAContemptGateUserText),
      beforePreview: beforeCoveredProbeStrip.slice(0, 320),
      afterPreview: strippedText.slice(0, 320),
      userPreview: params.trimmed.slice(0, 320),
    });
  }

  {
    const beforeS3 = strippedText;
    strippedText = ensureScenario3VignetteOpening(strippedText);
    logPostClaudeAssistantDraftSanitizeChange('[S3_VIGNETTE_OPENING_REPAIRED]', beforeS3, strippedText, {
      preview: strippedText.slice(0, 200),
    });
  }

  if (deps.currentInterviewMomentRef.current === 3) {
    const beforeS3q1 = strippedText;
    strippedText = ensureScenarioCQ1SequenceAfterVignette(strippedText);
    strippedText = replaceOrphanScenarioCRepairWithQ1(strippedText, priorAssistantContentS3);
    if (strippedText !== beforeS3q1) {
      void remoteLog('[S3_Q1_SEQUENCE_ENFORCED]', {
        preview: strippedText.slice(0, 260),
        hadVignetteInTurn: textContainsScenarioCVignetteBody(beforeS3q1),
      });
    }
  }

  if (params.shouldForceScenarioAContemptProbe && assistantIssuedScenarioARepairQuestion) {
    strippedText = stripScenarioARepairQuestion(strippedText);
    if (looksLikeScenarioARepairStreamFragment(strippedText)) {
      strippedText = '';
    }
    assistantIssuedScenarioARepairQuestion = false;
    if (__DEV__) {
      console.log('[S1_SEQUENCE_BLOCKED_REPAIR_BEFORE_CONTEMPT]', {
        shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
        specificEmmaLineAlreadyAddressed: params.specificEmmaLineAlreadyAddressed,
      });
    }
    void remoteLog('[S1_SEQUENCE_BLOCKED_REPAIR_BEFORE_CONTEMPT]', {
      shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
      specificEmmaLineAlreadyAddressed: params.specificEmmaLineAlreadyAddressed,
    });
  }

  const sanitizedForDedupe = sanitizeAssistantInterviewerCharacterNames(strippedText);
  strippedText = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
    sanitizedForDedupe,
    params.participantFirstNameForSpoken,
  );

  if (
    deps.currentInterviewMomentRef.current === 1 &&
    (deps.currentScenarioRef.current ?? 1) === 1 &&
    isIncompleteMisplacedScenarioRedirectLeadSentence(strippedText)
  ) {
    const { effectiveScenario } = syncInterviewScenarioRefsFromTranscript(
      deps,
      params.messagesToUse,
    );
    if (effectiveScenario > 1) {
      strippedText = '';
    } else {
    const beforeMisplacedCoerce = strippedText;
    strippedText = coerceMisplacedScenarioRedirectForActiveScenario(strippedText, 1);
    logPostClaudeAssistantDraftSanitizeChange(
      '[S1_MISPLACED_REDIRECT_INCOMPLETE_COERCED]',
      beforeMisplacedCoerce,
      strippedText,
    );
    }
  }

  if (
    isActiveScenarioBConstructProbeTurn(
      deps.currentScenarioRef.current,
      deps.currentInterviewMomentRef.current,
    ) &&
    isIncompleteScenarioBQ1LeadSentence(strippedText)
  ) {
    const beforeQ1Coerce = strippedText;
    strippedText = coerceScenarioBQ1QuestionForTts(strippedText);
    logPostClaudeAssistantDraftSanitizeChange(
      '[S2_Q1_INCOMPLETE_COERCED]',
      beforeQ1Coerce,
      strippedText,
    );
  }

  if (
    isActiveScenarioBConstructProbeTurn(
      deps.currentScenarioRef.current,
      deps.currentInterviewMomentRef.current,
    ) &&
    (isIncompleteScenarioBJamesDifferentlyLeadSentence(strippedText) ||
      isBeforeFightOnlyScenarioBJamesQ2Paraphrase(strippedText) ||
      (looksLikeScenarioBJamesDifferentlyQuestion(strippedText) &&
        !isDeliveredScenarioBJamesDifferentlyProbe(strippedText)))
  ) {
    const beforeJamesCoerce = strippedText;
    strippedText = coerceScenarioBJamesDifferentlyQuestionForTts(strippedText, {
      messages: params.messagesToUse,
      interviewMoment: deps.currentInterviewMomentRef.current,
    });
    assistantIssuedScenarioBJamesDifferently = looksLikeScenarioBJamesDifferentlyQuestion(strippedText);
    logPostClaudeAssistantDraftSanitizeChange(
      '[S2_JAMES_DIFFERENTLY_COERCED]',
      beforeJamesCoerce,
      strippedText,
    );
  }

  if (
    isActiveScenarioBConstructProbeTurn(
      deps.currentScenarioRef.current,
      deps.currentInterviewMomentRef.current,
    ) &&
    (looksLikeScenarioBJamesSayToJamesRolePlayQuestion(strippedText) ||
      isIncompleteScenarioBJamesSayToJamesLeadSentence(strippedText))
  ) {
    const beforeSayToJamesCoerce = strippedText;
    strippedText = collapseScenarioBJamesSayToJamesWithRepairDuplicate(
      strippedText,
      params.shouldForceScenarioBJamesRepairProbe,
    );
    assistantIssuedScenarioBJamesDifferently = looksLikeScenarioBJamesDifferentlyQuestion(strippedText);
    assistantIssuedScenarioBRepairAsJames = looksLikeScenarioBRepairAsJamesQuestion(strippedText);
    logPostClaudeAssistantDraftSanitizeChange(
      '[S2_JAMES_SAY_TO_JAMES_COERCED]',
      beforeSayToJamesCoerce,
      strippedText,
    );
  }

  if (
    isActiveScenarioBConstructProbeTurn(
      deps.currentScenarioRef.current,
      deps.currentInterviewMomentRef.current,
    ) &&
    isIncompleteScenarioBJamesRepairLeadSentence(strippedText)
  ) {
    const beforeRepairCoerce = strippedText;
    strippedText = coerceScenarioBJamesRepairQuestionForTts(strippedText);
    assistantIssuedScenarioBRepairAsJames = looksLikeScenarioBRepairAsJamesQuestion(strippedText);
    logPostClaudeAssistantDraftSanitizeChange(
      '[S2_JAMES_REPAIR_INCOMPLETE_COERCED]',
      beforeRepairCoerce,
      strippedText,
    );
  }

  if (
    deps.currentInterviewMomentRef.current === 1 &&
    isIncompleteScenarioAContemptProbeLeadSentence(strippedText) &&
    !shouldAdvanceScenarioAAfterSatisfiedRepair(params.messagesToUse, strippedText, 1)
  ) {
    const beforeContemptCoerce = strippedText;
    strippedText = coerceScenarioAContemptProbeForTts(strippedText);
    assistantIssuedScenarioAContemptProbe = looksLikeScenarioAContemptProbeQuestion(strippedText);
    logPostClaudeAssistantDraftSanitizeChange(
      '[S1_CONTEMPT_INCOMPLETE_COERCED]',
      beforeContemptCoerce,
      strippedText,
    );
  }

  if (
    deps.currentInterviewMomentRef.current === 4 &&
    (isIncompleteMoment4SpecificityFollowUpLeadSentence(strippedText) ||
      (looksLikeMoment4SpecificityFollowUpEcho(strippedText) && !/\?\s*$/.test(strippedText.trim())))
  ) {
    const beforeM4SpecCoerce = strippedText;
    strippedText = coerceMoment4SpecificityFollowUpForTts(strippedText);
    assistantIssuedMoment4AnyQuestion = true;
    logPostClaudeAssistantDraftSanitizeChange(
      '[M4_SPECIFICITY_INCOMPLETE_COERCED]',
      beforeM4SpecCoerce,
      strippedText,
    );
  }

  if (
    deps.currentInterviewMomentRef.current === 4 &&
    (looksLikeMoment4ThresholdQuestion(strippedText) ||
      isIncompleteMoment4ThresholdLeadSentence(strippedText) ||
      looksLikeMoment4ThresholdParaphraseInProgress(strippedText))
  ) {
    const beforeM4ThresholdCoerce = strippedText;
    strippedText = coerceMoment4ThresholdQuestionForTts(strippedText);
    assistantIssuedMoment4ThresholdProbe = looksLikeMoment4ThresholdQuestion(strippedText);
    assistantIssuedMoment4AnyQuestion = true;
    logPostClaudeAssistantDraftSanitizeChange(
      '[M4_THRESHOLD_PARAPHRASE_COERCED]',
      beforeM4ThresholdCoerce,
      strippedText,
    );
  }

  return {
    strippedText,
    assistantIssuedMoment4ThresholdProbe,
    assistantIssuedMoment4AnyQuestion,
    assistantIssuedScenarioAContemptProbe,
    assistantIssuedScenarioARepairQuestion,
    assistantIssuedScenarioBFullProbe,
    assistantIssuedScenarioBJamesDifferently,
    assistantIssuedScenarioBRepairAsJames,
  };
}
