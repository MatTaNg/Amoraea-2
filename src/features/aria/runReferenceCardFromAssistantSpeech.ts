import { Platform } from 'react-native';



import {

  MOMENT_4_PERSONAL_CARD,

  MOMENT_4_PERSONAL_LABEL,

  MOMENT_5_REFERENCE_SCENARIO,

} from '@features/aria/interviewMomentScenarioConfig';

import {

  isAssistantBubbleForTranscript,

  isResumeOrScenarioReplayUiPrompt,

} from '@features/aria/interviewReferenceCardResumeHelpers';

import { stripControlTokens } from '@features/aria/interviewControlTokens';

import {

  assistantSpeechShouldRefreshScenarioModalPrompt,

  extractScenarioModalQuestionFromAssistantText,

  getLastSubstantiveScenarioModalQuestion,

  resolveMoment4ShowScenarioReferenceCard,

  resolveScenarioModalPromptInScope,

} from '@features/aria/interviewLanguageGate';

import {

  SHOW_SCENARIO_2_VIGNETTE_EXACT,

  SHOW_SCENARIO_3_VIGNETTE_EXACT,

} from '@features/aria/interviewShowScenarioExactCopy';

import {

  detectActiveScenarioFromMessage,

  getSituationOpeningQuestion,

  SCENARIO_1_OPENING,

  type InterviewDetectedScenario,

} from '@features/aria/interviewScenarioOpeningStreamGate';

import type {

  ApplyReferenceCardFromAssistantSpeechDeps,

  ApplyInterviewSpeechCompleteDeps,

  ShowChatErrorDeps,

} from '@features/aria/referenceCardFromAssistantSpeechTypes';

import {
  inferScenarioFromSpokenDeliveryTexts,
  syncInterviewScenarioRefsFromSpokenDelivery,
  type InterviewScenarioRefSyncTarget,
} from '@features/aria/interviewScenarioRefSync';
import {
  spokenTextStartsMoment5PrimaryConflictQuestion,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
  looksLikeScenarioAContemptProbeQuestion,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  MOMENT_5_ACCOUNTABILITY_PROBE_TEXT,
  MOMENT_5_SPECIFICITY_REDIRECT_TEXT,
  MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT,
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  looksLikeMoment5SpecificityRedirectPrompt,
  looksLikeMoment5ConflictValidityClarificationPrompt,
} from '@features/aria/probeAndScoringUtils';
import { reconcileMoment5DeliveryFromAssistantText } from '@features/aria/moment5DeliveryReconcile';

import { SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '@features/aria/scenarioAContemptProbeTtsStrip';

import {
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairStreamFragment,
} from '@features/aria/scenarioARepairQuestionHelpers';
import {
  isIncompleteScenarioBJamesDifferentlyLeadSentence,
  isIncompleteScenarioBJamesRepairLeadSentence,
  isIncompleteScenarioBJamesSayToJamesLeadSentence,
  looksLikeScenarioBJamesSayToJamesRolePlayQuestion,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import {
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCSophiePerspectiveQuestion,
  looksLikeScenarioCSophieRolePlayMisparaphraseQuestion,
  looksLikeScenarioCRepairAsDanielQuestion,
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
} from '@features/aria/scenarioCPromptDetection';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import {
  isIncompleteMoment4ThresholdLeadSentence,
  looksLikeMoment4ThresholdParaphraseInProgress,
  looksLikeMoment4ThresholdQuestion,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY,
} from '@features/aria/moment4ProbeLogic';

import {

  isScenarioANonScriptedModalParaphrase,

  isSituation1ModalAdvancedPastOpening,

  resolveSituation1ExactModalPrompt,

  type Situation1ModalDeliveryState,

} from '@features/aria/situation1ExactModalPrompt';
import {
  isSituation2ModalAdvancedPastOpening,
  resolveSituation2ExactModalPrompt,
  type Situation2ModalDeliveryState,
} from '@features/aria/situation2ExactModalPrompt';
import {
  applySituation3ExactModalPrompt,
  readSituation3DeliveryState,
} from '@features/aria/situation3ExactModalPrompt';
import { transcriptContainsScenarioBJamesDifferentlyProbe } from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  looksLikeMoment5ResolutionFollowUpPrompt,
  stripInterviewClosingBundledWithMoment5ResolutionFollowUp,
} from '@features/aria/moment5SpecificityRedirect';



function applyMoment5PersonalReflectionCard(
  deps: ApplyReferenceCardFromAssistantSpeechDeps,
  questionText: string,
): void {
  const personalScenario = {
    label: MOMENT_4_PERSONAL_LABEL,
    text: questionText.trim(),
  };
  if (deps.committedScenarioRef) {
    deps.committedScenarioRef.current = personalScenario;
  }
  deps.setReferenceCardScenario(personalScenario);
  deps.setReferenceCardPrompt(null);
  deps.setInterviewUiPhase('scenario_active');
  if (deps.lastQuestionTextRef) {
    deps.lastQuestionTextRef.current = questionText.trim();
  }
}

function readSituation1DeliveryState(
  deps: ApplyReferenceCardFromAssistantSpeechDeps,
): Situation1ModalDeliveryState {
  return {
    contemptProbeAsked: deps.scenarioAContemptProbeAskedRef?.current ?? false,
    repairQuestionAsked: deps.scenarioARepairQuestionAskedRef?.current ?? false,
  };
}

function withExactScenarioVignetteBody(scenario: InterviewDetectedScenario): InterviewDetectedScenario {

  switch (scenario.label) {

    case 'Situation 2':

      return { label: scenario.label, text: SHOW_SCENARIO_2_VIGNETTE_EXACT };

    case 'Situation 3':

      return { label: scenario.label, text: SHOW_SCENARIO_3_VIGNETTE_EXACT };

    default:

      return scenario;

  }

}


function readSituation2DeliveryState(
  deps: ApplyReferenceCardFromAssistantSpeechDeps,
  assistantForModal: Array<{ role: string; content?: string | null }>,
): Situation2ModalDeliveryState {
  return {
    jamesDifferentlyAsked: transcriptContainsScenarioBJamesDifferentlyProbe(assistantForModal),
    repairQuestionAsked: deps.s2RepairProbeDeliveredRef?.current ?? false,
  };
}

function applySituation2ExactModalPrompt(
  deps: ApplyReferenceCardFromAssistantSpeechDeps,
  assistantForModal: Array<{ role: string; content?: string | null }>,
  currentSpoken?: string | null,
): void {
  const delivery = readSituation2DeliveryState(deps, assistantForModal);
  const exact = resolveSituation2ExactModalPrompt(assistantForModal, currentSpoken, delivery);
  deps.setReferenceCardPrompt(exact);
  if (deps.lastQuestionTextRef) {
    deps.lastQuestionTextRef.current = exact;
  }
}

function applySituation1ExactModalPrompt(

  deps: ApplyReferenceCardFromAssistantSpeechDeps,

  assistantForModal: Array<{ role: string; content?: string | null }>,

  currentSpoken?: string | null,

): void {

  const delivery = readSituation1DeliveryState(deps);

  const exact = resolveSituation1ExactModalPrompt(assistantForModal, currentSpoken, delivery);

  deps.setReferenceCardPrompt(exact);

  if (deps.lastQuestionTextRef) {

    deps.lastQuestionTextRef.current = exact;

  }

}



export function runApplyReferenceCardFromAssistantSpeech(

  deps: ApplyReferenceCardFromAssistantSpeechDeps,

  rawText: string,

): void {

  const cleaned = stripControlTokens(rawText).trim();

  if (!cleaned) return;



  const committedLabel = deps.committedScenarioRef?.current?.label;



  if (looksLikeScenarioAContemptProbeQuestion(cleaned)) {

    deps.setReferenceCardPrompt(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);

    if (deps.lastQuestionTextRef) {

      deps.lastQuestionTextRef.current = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;

    }

    return;

  }



  if (
    (committedLabel === 'Situation 1' || !committedLabel) &&
    (looksLikeScenarioARepairQuestion(cleaned) || looksLikeScenarioARepairStreamFragment(cleaned))
  ) {

    deps.setReferenceCardPrompt(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);

    if (deps.lastQuestionTextRef) {

      deps.lastQuestionTextRef.current = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;

    }

    if (deps.scenarioARepairQuestionAskedRef) {

      deps.scenarioARepairQuestionAskedRef.current = true;

    }

    return;

  }



  if (
    (committedLabel === 'Situation 2' || !committedLabel) &&
    (looksLikeScenarioBJamesSayToJamesRolePlayQuestion(cleaned) ||
      isIncompleteScenarioBJamesSayToJamesLeadSentence(cleaned))
  ) {
    const prompt =
      looksLikeScenarioBRepairAsJamesQuestion(cleaned) ||
      isIncompleteScenarioBJamesRepairLeadSentence(cleaned)
        ? SCENARIO_B_JAMES_REPAIR_CANONICAL
        : SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
    deps.setReferenceCardPrompt(prompt);
    if (deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = prompt;
    }
    return;
  }

  if (
    (committedLabel === 'Situation 2' || !committedLabel) &&
    (looksLikeScenarioBJamesDifferentlyQuestion(cleaned) || isIncompleteScenarioBJamesDifferentlyLeadSentence(cleaned))
  ) {

    deps.setReferenceCardPrompt(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);

    if (deps.lastQuestionTextRef) {

      deps.lastQuestionTextRef.current = SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;

    }

    return;

  }



  if (
    (committedLabel === 'Situation 2' || !committedLabel) &&
    (
      looksLikeScenarioBRepairAsJamesQuestion(cleaned) ||
      isIncompleteScenarioBJamesRepairLeadSentence(cleaned)
    )
  ) {

    deps.setReferenceCardPrompt(SCENARIO_B_JAMES_REPAIR_CANONICAL);

    if (deps.lastQuestionTextRef) {

      deps.lastQuestionTextRef.current = SCENARIO_B_JAMES_REPAIR_CANONICAL;

    }

    return;

  }



  if (
    (committedLabel === 'Situation 3' || !committedLabel) &&
    (looksLikeScenarioCRepairAsDanielQuestion(cleaned) || isScenarioCRepairAssistantPrompt(cleaned))
  ) {

    deps.setReferenceCardPrompt(SCENARIO_C_REPAIR_QUESTION_CANONICAL);

    if (deps.lastQuestionTextRef) {

      deps.lastQuestionTextRef.current = SCENARIO_C_REPAIR_QUESTION_CANONICAL;

    }

    return;

  }



  if (
    looksLikeScenarioCSophiePerspectiveQuestion(cleaned) ||
    looksLikeScenarioCSophieRolePlayMisparaphraseQuestion(cleaned)
  ) {

    deps.setReferenceCardPrompt(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE);

    if (deps.lastQuestionTextRef) {

      deps.lastQuestionTextRef.current = SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;

    }

    return;

  }



  if (
    looksLikeMoment4ThresholdQuestion(cleaned) ||
    isIncompleteMoment4ThresholdLeadSentence(cleaned) ||
    looksLikeMoment4ThresholdParaphraseInProgress(cleaned)
  ) {
    const personalScenario = {
      label: MOMENT_4_PERSONAL_LABEL,
      text: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY,
    };
    if (deps.committedScenarioRef) {
      deps.committedScenarioRef.current = personalScenario;
    }
    deps.setReferenceCardScenario(personalScenario);
    deps.setReferenceCardPrompt(null);
    deps.setInterviewUiPhase('scenario_active');
    if (deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY;
    }
    return;
  }



  const assistantForModal = deps.messages

    .filter((m) => m.role === 'assistant' && isAssistantBubbleForTranscript(m))

    .map((m) => ({

      role: m.role,

      content: stripControlTokens(m.content ?? '').trim(),

    }));



  const activatesMoment5ShowScenario =

    transcriptAssistantContainsMoment5PrimaryConflictQuestion(cleaned) ||

    spokenTextStartsMoment5PrimaryConflictQuestion(cleaned);



  if (looksLikeMoment5ResolutionFollowUpPrompt(cleaned)) {
    const cardBody =
      stripInterviewClosingBundledWithMoment5ResolutionFollowUp(cleaned).trim() ||
      extractScenarioModalQuestionFromAssistantText(cleaned) ||
      cleaned.trim();
    applyMoment5PersonalReflectionCard(deps, cardBody);
    return;
  }

  if (looksLikeMoment5AccountabilityProbeAssistantPrompt(cleaned)) {
    applyMoment5PersonalReflectionCard(deps, MOMENT_5_ACCOUNTABILITY_PROBE_TEXT);
    return;
  }

  if (looksLikeMoment5SpecificityRedirectPrompt(cleaned)) {
    applyMoment5PersonalReflectionCard(deps, MOMENT_5_SPECIFICITY_REDIRECT_TEXT);
    return;
  }

  if (looksLikeMoment5ConflictValidityClarificationPrompt(cleaned)) {
    applyMoment5PersonalReflectionCard(deps, MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT);
    return;
  }



  let moment5InTranscript = activatesMoment5ShowScenario;

  if (!moment5InTranscript) {

    for (let i = assistantForModal.length - 1; i >= 0; i--) {

      const c = assistantForModal[i]?.content ?? '';

      if (transcriptAssistantContainsMoment5PrimaryConflictQuestion(c)) {

        moment5InTranscript = true;

        break;

      }

    }

  }

  if (moment5InTranscript) {

    reconcileMoment5DeliveryFromAssistantText(deps, cleaned);

    if (deps.committedScenarioRef) {
      deps.committedScenarioRef.current = MOMENT_5_REFERENCE_SCENARIO;
    }

    deps.setReferenceCardScenario(MOMENT_5_REFERENCE_SCENARIO);

    deps.setReferenceCardPrompt(null);

    deps.setInterviewUiPhase('scenario_active');

    if (deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT;
    }

    return;

  }



  const m4Modal = resolveMoment4ShowScenarioReferenceCard(assistantForModal, {

    grudgeCardBody: MOMENT_4_PERSONAL_CARD,

    currentSpokenContent: cleaned,

  });

  if (m4Modal.active) {

    const personalScenario = {

      label: MOMENT_4_PERSONAL_LABEL,

      text: m4Modal.cardBodyText,

    };

    if (deps.committedScenarioRef) {
      deps.committedScenarioRef.current = personalScenario;
    }

    deps.setReferenceCardScenario(personalScenario);

    deps.setReferenceCardPrompt(null);

    deps.setInterviewUiPhase('scenario_active');

    return;

  }



  const detectedScenario = detectActiveScenarioFromMessage(cleaned);

  if (detectedScenario) {

    const scenario = withExactScenarioVignetteBody(detectedScenario);

    if (deps.committedScenarioRef) {
      deps.committedScenarioRef.current = scenario;
    }

    deps.setReferenceCardScenario(scenario);

    deps.setInterviewUiPhase('scenario_active');

    if (scenario.label === 'Situation 1') {

      const delivery = readSituation1DeliveryState(deps);

      const lastQuestion = deps.lastQuestionTextRef?.current ?? null;

      if (isSituation1ModalAdvancedPastOpening(delivery, lastQuestion)) {

        applySituation1ExactModalPrompt(deps, assistantForModal, cleaned);

        return;

      }

      deps.setReferenceCardPrompt(SCENARIO_1_OPENING);

      if (deps.lastQuestionTextRef) {

        deps.lastQuestionTextRef.current = SCENARIO_1_OPENING;

      }

      return;

    }

    if (scenario.label === 'Situation 2') {

      const delivery = readSituation2DeliveryState(deps, assistantForModal);

      const lastQuestion = deps.lastQuestionTextRef?.current ?? null;

      if (isSituation2ModalAdvancedPastOpening(delivery, lastQuestion, assistantForModal)) {

        applySituation2ExactModalPrompt(deps, assistantForModal, cleaned);

        return;

      }

      const opening = getSituationOpeningQuestion(scenario);

      if (opening) {

        deps.setReferenceCardPrompt(opening);

        if (deps.lastQuestionTextRef) {

          deps.lastQuestionTextRef.current = opening;

        }

      }

      return;

    }

    if (scenario.label === 'Situation 3') {
      const delivery = readSituation3DeliveryState(assistantForModal);
      applySituation3ExactModalPrompt(deps, assistantForModal, cleaned, delivery);
      return;
    }

    const fromSpoken = getLastSubstantiveScenarioModalQuestion([{ role: 'assistant', content: cleaned }]);

    const opening = getSituationOpeningQuestion(scenario);

    if (fromSpoken) {

      deps.setReferenceCardPrompt(fromSpoken);

      return;

    }

    if (opening) {

      deps.setReferenceCardPrompt(opening);

    }

    return;

  }



  if (!deps.committedScenarioRef?.current) return;



  if (deps.committedScenarioRef.current.label === 'Situation 1') {

    applySituation1ExactModalPrompt(deps, assistantForModal, cleaned);

    return;

  }



  if (deps.committedScenarioRef.current.label === 'Situation 2') {

    applySituation2ExactModalPrompt(deps, assistantForModal, cleaned);

    return;

  }

  if (deps.committedScenarioRef.current.label === 'Situation 3') {

    applySituation3ExactModalPrompt(deps, assistantForModal, cleaned);

    return;

  }



  const resolveModalPrompt = (currentSpoken?: string): string | null => {

    const committed = deps.committedScenarioRef.current;

    const q = resolveScenarioModalPromptInScope(assistantForModal, {

      scenarioLabel: committed?.label ?? null,

      detectScenarioFromContent: detectActiveScenarioFromMessage,

      openingQuestionForLabel: (label) => getSituationOpeningQuestion({ label, text: '' }),

      currentSpokenContent: currentSpoken,

    });

    if (q === null || isResumeOrScenarioReplayUiPrompt(q)) return null;

    return q;

  };

  const q = resolveModalPrompt(cleaned);

  if (q !== null) {

    deps.setReferenceCardPrompt(q);

  }

}



export function runReferenceCardShouldUpdateOnPlaybackStart(rawText: string): boolean {

  const cleaned = stripControlTokens(rawText).trim();

  if (!cleaned) return false;

  if (isScenarioANonScriptedModalParaphrase(cleaned)) return false;

  if (detectActiveScenarioFromMessage(cleaned)) return true;

  if (assistantSpeechShouldRefreshScenarioModalPrompt(cleaned)) return true;

  if (

    transcriptAssistantContainsMoment5PrimaryConflictQuestion(cleaned) ||

    spokenTextStartsMoment5PrimaryConflictQuestion(cleaned)

  ) {

    return true;

  }

  if (looksLikeMoment5ResolutionFollowUpPrompt(cleaned)) return true;
  if (looksLikeMoment5AccountabilityProbeAssistantPrompt(cleaned)) return true;
  if (looksLikeMoment5SpecificityRedirectPrompt(cleaned)) return true;
  if (looksLikeMoment5ConflictValidityClarificationPrompt(cleaned)) return true;

  return resolveMoment4ShowScenarioReferenceCard([{ role: 'assistant', content: cleaned }], {

    grudgeCardBody: MOMENT_4_PERSONAL_CARD,

  }).active;

}



export function runApplyInterviewSpeechComplete(

  deps: ApplyInterviewSpeechCompleteDeps,

  rawText: string,

): void {

  if (deps.scenarioRefSync && inferScenarioFromSpokenDeliveryTexts([rawText])) {
    syncInterviewScenarioRefsFromSpokenDelivery(deps.scenarioRefSync, {
      extraTexts: [rawText],
    });
  }

  deps.applyReferenceCardFromAssistantSpeech(rawText);

}



export function runShowChatError(deps: ShowChatErrorDeps, message: string): void {

  deps.setConversationErrorNotice?.(message);

  deps.setMessages((prev) => [

    ...prev,

    { role: 'error', content: message, isError: true } as { role: string; content: string; isError?: boolean },

  ]);

}


