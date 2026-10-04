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

/** Spoken before the personal setup: "Last one…", "Just say whatever comes to mind —". */
const PERSONAL_RESUME_LEAD_IN_RE =
  /^(?:last one(?:,)?(?: and)? then we(?:'|’)ll wrap up|just say whatever comes to mind)\b(?:\s*[—–\-:,.!…]+\s*|\s+)/i;

function isShortPersonalScenarioPrompt(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.includes('?')) return false;
  if (trimmed.length > 420) return false;
  if (/\b(emma|ryan|sarah|james|sophie|daniel)\b/i.test(trimmed)) return false;
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 2) return false;
  return /^(think of|think about|tell me|describe|imagine)\b/i.test(trimmed);
}

/**
 * Setup sentence plus question for a personal prompt, including when it is embedded
 * in a resume welcome. Fictional situation cards name their characters and are left alone.
 */
export function personalScenarioPromptForRepeat(raw: string | null | undefined): string | null {
  let body = assessablePromptQuestionBody(raw);
  let guard = 0;
  while (guard++ < 4) {
    const next = body.replace(PERSONAL_RESUME_LEAD_IN_RE, '').trim();
    if (!next || next === body || next.length < 12) break;
    body = next;
  }
  if (isShortPersonalScenarioPrompt(body)) return body;
  const setup = body.match(/\b(?:think of|think about|tell me|describe|imagine)\b/i);
  if (!setup || setup.index == null || setup.index === 0) return null;
  const fromSetup = body.slice(setup.index).trim();
  return isShortPersonalScenarioPrompt(fromSetup) ? fromSetup : null;
}

/** Drop "Got it." / "Last one, then we'll wrap up." so Show scenario never displays the pivot. */
export function stripShowScenarioTransitionLead(text: string | null | undefined): string {
  let body = assessablePromptQuestionBody(text);
  let guard = 0;
  while (guard++ < 4) {
    const next = body.replace(PERSONAL_RESUME_LEAD_IN_RE, '').trim();
    if (next === body) break;
    body = next;
    if (!body) break;
  }
  return body;
}

/** Pivot-only line ("Last one, then we'll wrap up.") with no question yet. */
export function isShowScenarioTransitionLeadOnly(text: string | null | undefined): boolean {
  const raw = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!raw || raw.includes('?')) return false;
  return /last one(?:,)?(?: and)? then we(?:'|’)ll wrap up/i.test(raw);
}
