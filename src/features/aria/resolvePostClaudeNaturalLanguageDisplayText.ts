import type { PostClaudeAssistantTurnDeps, PostClaudeAssistantTurnParams } from '@features/aria/postClaudeAssistantTurnTypes';
import type { SanitizePostClaudeAssistantDraftResult } from '@features/aria/sanitizePostClaudeAssistantDraftText';
import { coerceScenarioBoundaryHandoffDisplayText } from '@features/aria/coerceScenarioBoundaryHandoffDisplayText';
import { coerceInterviewAssistantDraftForSpeak } from '@features/aria/interviewTruncatedAssistantDraft';
import { ensureAcknowledgmentBeforeMove } from '@features/aria/interviewAssistantReflection';
import {
  isPersonalMomentInterviewTurn,
  isStandalonePersonalDisclosureAcknowledgment,
  resolveScenarioFollowUpAfterSuppressedResponse,
} from '@features/aria/personalDisclosureAckGate';
import { shouldDeliverScenarioFollowUpQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { looksLikeScenarioARepairStreamFragment } from '@features/aria/scenarioARepairQuestionHelpers';
import { remoteLog } from '@utilities/remoteLog';

export type PostClaudeNaturalLanguageDisplayContext = Pick<
  SanitizePostClaudeAssistantDraftResult,
  'recentAsstForAck' | 'shouldInjectScenarioARepairAfterContemptAnswer'
> & {
  strippedText: string;
  assistantIssuedScenarioAContemptProbe: boolean;
  assistantIssuedScenarioBFullProbe: boolean;
  needsScenarioBJamesDifferentlyInsert: boolean;
};

/** Marks closing-question refs when `[CLOSING_QUESTION:N]` appears in raw model output. */
export function applyPostClaudeClosingQuestionTokenFromRawText(
  deps: PostClaudeAssistantTurnDeps,
  text: string,
): void {
  const closingQuestionMatch = text.match(/\[CLOSING_QUESTION:(\d)\]/);
  if (!closingQuestionMatch) return;
  const n = parseInt(closingQuestionMatch[1], 10) as 1 | 2 | 3;
  deps.markClosingQuestionAsked(n);
  deps.setClosingQuestionPending(true);
  deps.setClosingQuestionScenario(n);
}

export function resolvePostClaudeNaturalLanguageDisplayText(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  ctx: PostClaudeNaturalLanguageDisplayContext,
): string {
  let displayText = ensureAcknowledgmentBeforeMove(
    ctx.strippedText,
    params.trimmed,
    ctx.recentAsstForAck,
    deps.currentInterviewMomentRef.current,
  );
  if (!isPersonalMomentInterviewTurn(deps.currentInterviewMomentRef.current)) {
    if (isStandalonePersonalDisclosureAcknowledgment(displayText)) {
      const scenarioFollowUp = resolveScenarioFollowUpAfterSuppressedResponse({
        interviewMoment: deps.currentInterviewMomentRef.current,
        currentScenario: deps.currentScenarioRef.current,
        shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
        assistantIssuedScenarioAContemptProbe: ctx.assistantIssuedScenarioAContemptProbe,
        shouldInjectScenarioARepairAfterContemptAnswer: ctx.shouldInjectScenarioARepairAfterContemptAnswer,
        shouldForceScenarioBFullAppreciationProbe: params.shouldForceScenarioBFullAppreciationProbe,
        assistantIssuedScenarioBFullProbe: ctx.assistantIssuedScenarioBFullProbe,
        needsScenarioBJamesDifferentlyInsert: ctx.needsScenarioBJamesDifferentlyInsert,
        scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
        scenarioARepairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
        transcriptMessages: params.messagesToUse,
        contemptProbeDeliveredThisTurn: deps.scenarioAContemptProbeAskedRef.current,
      });
      if (scenarioFollowUp) {
        if (!shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, scenarioFollowUp)) {
          void remoteLog('[SCENARIO_PERSONAL_ACK_FOLLOWUP_SKIPPED_TRANSCRIPT_DEDUP]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: scenarioFollowUp.slice(0, 200),
          });
          displayText = '';
        } else {
          void remoteLog('[SCENARIO_PERSONAL_ACK_REPLACED_WITH_FOLLOWUP]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            interviewMoment: deps.currentInterviewMomentRef.current,
            preview: scenarioFollowUp.slice(0, 200),
          });
          displayText = scenarioFollowUp;
        }
      } else {
        displayText = '';
      }
    }
  }
  if (
    deps.currentInterviewMomentRef.current === 1 &&
    deps.scenarioAContemptProbeAskedRef.current &&
    (params.shouldForceScenarioAContemptProbe || params.muteParallelTtsForScenarioAContemptProbeStream) &&
    looksLikeScenarioARepairStreamFragment(displayText)
  ) {
    void remoteLog('[S1_REPAIR_DISPLAY_CLEARED_AFTER_CONTEMPT_STREAM]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: displayText.slice(0, 220),
      s1ContemptFixVersion: 22,
    });
    displayText = '';
  }
  return coerceInterviewAssistantDraftForSpeak(
    coerceScenarioBoundaryHandoffDisplayText(
      displayText,
      params.participantFirstNameForSpoken,
      params.messagesToUse,
      deps.currentScenarioRef.current,
      deps.currentInterviewMomentRef.current,
    ),
    {
      interviewMoment: deps.currentInterviewMomentRef.current,
      currentScenario: deps.currentScenarioRef.current,
      firstName: params.participantFirstNameForSpoken,
      messages: params.messagesToUse,
    },
  );
}
