import { stripBriefInterviewAcknowledgmentPrefixForRepeat } from '@features/aria/interviewRepeatRequestTarget';
import { stripSkipAcceptedNextQuestionBridge } from '@features/aria/skipAcceptedNextQuestionBridge';

/**
 * Strip leading brief acknowledgments ("Got it.", "Makes sense.", …) from assessable prompt text.
 * Acknowledgments may still be spoken in TTS — they must not appear in Show scenario modal,
 * lastQuestionTextRef, or question_delivered telemetry.
 */
export function stripLeadingBriefAckFromAssessablePrompt(text: string): string {
  return stripBriefInterviewAcknowledgmentPrefixForRepeat(text);
}

/** Assessable question body only — no skip bridge, no leading ack. */
export function assessablePromptQuestionBody(raw: string | null | undefined): string {
  const withoutBridge = stripSkipAcceptedNextQuestionBridge((raw ?? '').trim());
  return stripLeadingBriefAckFromAssessablePrompt(withoutBridge).trim();
}
