import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import {
  collapseStackedEmpathyIHearYouInFirstParagraph,
  ensureAcknowledgmentBeforeClosing,
  recentAssistantMessagesForAck,
  sanitizeClosingLanguage,
  stripFlatReflectionAcknowledgmentOpeners,
  stripForbiddenReflectionLead,
  stripGenericReflectionFillersFirstParagraph,
  stripHollowSystemInterviewerPhrases,
} from '@features/aria/interviewAssistantReflection';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  dedupeAdjacentBoundaryValidationsBeforeParticipantName,
  ensureSpokenTextIncludesParticipantFirstName,
} from '@features/aria/interviewerFrameworkPrompt';
import { resolvePlausibleInterviewFirstName } from '@features/aria/interviewNameValidation';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';

/** Shared closing reflection strips before TTS / transcript persist on interview-complete paths. */
export function sanitizePostClaudeClosingDisplayText(
  deps: PostClaudeAssistantTurnDeps,
  messagesToUse: PostClaudeInterviewMessage[],
  userTrimmed: string,
  rawText: string,
): string {
  let closingRaw = stripControlTokens(rawText) || 'Thank you. That was really helpful.';
  closingRaw = stripFlatReflectionAcknowledgmentOpeners(closingRaw);
  closingRaw = stripGenericReflectionFillersFirstParagraph(closingRaw);
  closingRaw = stripHollowSystemInterviewerPhrases(closingRaw);
  closingRaw = collapseStackedEmpathyIHearYouInFirstParagraph(closingRaw);
  closingRaw = stripForbiddenReflectionLead(closingRaw);
  let displayText = sanitizeClosingLanguage(closingRaw);
  const closingInterviewName = resolvePlausibleInterviewFirstName(deps.interviewNameRef.current) ?? '';
  displayText = ensureAcknowledgmentBeforeClosing(
    displayText,
    userTrimmed,
    recentAssistantMessagesForAck(messagesToUse),
    closingInterviewName,
  );
  displayText = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
    sanitizeAssistantInterviewerCharacterNames(displayText),
    closingInterviewName,
  );
  return ensureSpokenTextIncludesParticipantFirstName(displayText, closingInterviewName, {
    allowAppendWhenMissing: true,
  });
}
