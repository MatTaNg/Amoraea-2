/**
 * Detect answers that cannot be scored against the current interview question
 * (identity/off-topic asks, interviewer-directed questions, empty engagement,
 * mid-sentence cut-offs with no scorable content).
 */

export const IRRELEVANT_ANSWER_RETRY_LINE =
  "I wasn't able to understand that — you may have gotten cut off. Can you try again?";

function normalizeIrrelevantCompare(text: string): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** True for the client irrelevant-answer retry line (current or legacy copy). */
export function isIrrelevantAnswerRetryAssistantLine(text: string | null | undefined): boolean {
  const t = normalizeIrrelevantCompare(text ?? '');
  if (!t) return false;
  if (t === normalizeIrrelevantCompare(IRRELEVANT_ANSWER_RETRY_LINE)) return true;
  if (t.includes("wasn't able to understand that") || t.includes('was not able to understand that')) {
    return true;
  }
  if (t.includes("that's not something i can score") || t.includes('does not answer the question')) {
    return true;
  }
  if (t.includes("doesn't answer the question") && t.includes('give it another try')) return true;
  return false;
}

const INTERVIEWER_IDENTITY_OR_OFF_TOPIC_ASK_RE =
  /\b(?:are you|you'?re)\b.{0,48}\b(?:an?\s+)?(?:alien|ai|a\.?i\.?|robot|bot|human|real|chatgpt|computer|machine|person)\b|\bwho (?:are|made|built|created|programmed) you\b|\b(?:what are you|are you even real)\b|\b(?:where do you live|how old are you)\b/i;

/** Shared scenario / relationship vocabulary that indicates an assessable attempt. */
const ASSESSABLE_ENGAGEMENT_RE =
  /\b(?:emma|ryan|sarah|james|sophie|daniel|matt|partner|relationship|scenario|situation|contempt|disdain|dismiss(?:ive|ing)?|repair|apolog(?:y|ize|ise)|feel(?:ing|s)?|felt|emotion(?:al)?|angry|hurt|validat(?:e|ion)|listen|understand|empath(?:y|ize|ise)|need(?:ed|s)?|want(?:ed|s)?|wrong|right|both|sides?|mean|rude|respect|disrespect|defensive|attack|blame|accountab(?:le|ility)|perspective|point of view|fight(?:ing)?|argu(?:e|ing|ment)|communicat(?:e|ion|ing)|tone|sarcas(?:m|tic)|eye[\s-]?roll|scoff|bid|comfort|celebration|logistics)\b/i;

/**
 * Mid-utterance cut-offs that name a character / start a plan but never deliver scoring material.
 * Example: "If I were Ryan, I would" — has "Ryan" but nothing assessable after the modal.
 */
export function looksLikeIncompleteCutOffUserAnswer(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  const low = t.toLowerCase().replace(/[\u201c\u201d\u2018\u2019]/g, "'");
  // Bare assent variants — not treated as cut-offs here.
  if (
    /^(yes|yeah|yep|yup|sure|ok|okay|no|nope|nah)([.,!\s]+|$)/i.test(low) &&
    low.split(/\s+/).filter(Boolean).length <= 3
  ) {
    return false;
  }
  // Dangling modal / auxiliary with nothing after (classic Whisper / early mic-stop cut-off).
  if (
    /\b(i|he|she|they|we|you|ryan|emma|james|sarah|sophie|daniel)\s+(would|could|should|might|will|can|am|is|are|was|were|have|had|do|did|wanna|gonna)\s*[.,;:!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  // "If I were Ryan" / "If I'm Ryan" with no completed action.
  if (/^if\s+i\s+(?:were|was|am|'m)\s+\w+\s*[.,;:!?…—–-]*$/i.test(low)) {
    return true;
  }
  // Trailing conjunction / thin preposition — utterance stopped before the clause finished.
  if (
    /\b(and|but|or|so|because|then|that|than|to|for|with|about|like|just|of|if|when)\s*[.,;:!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  // Trailing article / possessive opener.
  if (/\b(a|an|the|my|his|her|their|our|your)\s*[.,;:!?…—–-]*$/i.test(low)) {
    return true;
  }
  return false;
}

export function looksLikeInterviewerIdentityOrOffTopicAsk(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return false;
  return INTERVIEWER_IDENTITY_OR_OFF_TOPIC_ASK_RE.test(t);
}

export function hasMinimalAssessableScenarioContent(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 6) return false;
  return ASSESSABLE_ENGAGEMENT_RE.test(t);
}

/**
 * True when the user turn is not a scorable attempt at the interview question.
 * Prefer handling known meta/skip/repeat intents elsewhere before calling this.
 */
export function looksLikeUnassessableScenarioAnswer(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (looksLikeInterviewerIdentityOrOffTopicAsk(t)) return true;
  // Cut-offs can include a character name ("Ryan") without any scorable content — still unassessable.
  if (looksLikeIncompleteCutOffUserAnswer(t)) return true;

  const words = t.split(/\s+/).filter(Boolean);
  const asksInterviewer =
    /\?/.test(t) && /\b(?:you|your|amoraea|aira|aria)\b/i.test(t);

  if (asksInterviewer && !hasMinimalAssessableScenarioContent(t)) {
    return true;
  }

  if (words.length <= 8 && !hasMinimalAssessableScenarioContent(t)) {
    return true;
  }

  return false;
}
