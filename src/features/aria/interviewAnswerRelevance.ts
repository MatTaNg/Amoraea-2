import { looksLikeInterviewScoreStatusRequest } from './interviewScoreStatusRequest';
import { looksLikeCheckingInSufficiencyAsk } from './metaCommentPatternScoring';
import { looksLikePriorAnswerMetaComment } from './interviewPriorAnswerMetaDetection';

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

function normalizeUserReplyCompare(text: string): string {
  let s = normalizeIrrelevantCompare(text);
  s = s.replace(/[\u2019\u2018]/g, "'");
  s = s.replace(/[.,!?;:…—–-]+$/g, '').trim();
  return s;
}

/**
 * Complete short replies to yes/no or auxiliary questions (e.g. "I did.", "I have.")
 * — not mic-stop cut-offs and not ratio-reask fodder.
 */
export function looksLikeCompleteShortUserReply(text: string): boolean {
  const n = normalizeUserReplyCompare(text);
  if (!n) return false;
  const wordCount = n.split(/\s+/).filter(Boolean).length;
  if (wordCount > 4) return false;
  if (
    /^i\s+(?:did(?:n'?t|\s+not)?|have(?:n'?t|\s+not)?|was(?:n'?t|\s+not)?|do(?:n'?t|\s+not)?)$/.test(
      n,
    )
  ) {
    return true;
  }
  if (/^i\s+(?:did|have|was|do)\s+(?:that|it|so|this|before|already)$/.test(n)) {
    return true;
  }
  if (/^i\s+already\s+did(?:\s+it)?$/.test(n)) {
    return true;
  }
  return false;
}

/** True when a ratio / cut-off recovery prompt already fired for this substantive question seq. */
export function hasQuestionRecoveryPromptAlreadySpokenForSeq(
  recoverySpokenAtSeq: number | null | undefined,
  currentSubstantiveSeq: number,
): boolean {
  return recoverySpokenAtSeq != null && recoverySpokenAtSeq === currentSubstantiveSeq;
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

/** User asks for the question, clarification, or other interview-process meta — not a mic-stop cut-off. */
const INTERVIEW_PROCESS_META_RE =
  /\b(?:give(?:\s+me)?\s+(?:a\s+)?question|ask(?:\s+me)?\s+(?:a\s+)?question|what(?:'s|\s+is)\s+the\s+question|where(?:'s|\s+is)\s+the\s+question|do\s+you\s+have\s+(?:a\s+)?question|can\s+you\s+(?:ask|repeat|clarify)|repeat\s+(?:the\s+)?question|what\s+(?:am\s+i|are\s+we)\s+(?:supposed\s+to|meant\s+to)\s+(?:answer|respond)|what\s+should\s+i\s+(?:say|answer)|is\s+there\s+(?:a\s+)?question|so\s+far\s+there'?s\s+no\s+question)\b/i;

/** Shared scenario / relationship vocabulary that indicates an assessable attempt. */
const ASSESSABLE_ENGAGEMENT_RE =
  /\b(?:emma|ryan|sarah|james|sophie|daniel|matt|partner|relationship|scenario|situation|contempt|disdain|dismiss(?:ive|ing)?|repair|apolog(?:y|ize|ise)|feel(?:ing|s)?|felt|emotion(?:al)?|angry|hurt|validat(?:e|ion)|listen|understand|empath(?:y|ize|ise)|need(?:ed|s)?|want(?:ed|s)?|wrong|right|both|sides?|mean|rude|respect|disrespect|defensive|attack|blame|accountab(?:le|ility)|perspective|point of view|fight(?:ing)?|argu(?:e|ing|ment)|communicat(?:e|ion|ing)|tone|sarcas(?:m|tic)|eye[\s-]?roll|scoff|bid|comfort|celebration|logistics|frustrated|disappointed|condescending|contemptuous|resentful|exasperated|annoyed|annoying|bitter|upset|lonely|painful|invalidated|exhausting|draining|abandoned|unheard)\b/i;

/**
 * Mid-utterance cut-offs that name a character / start a plan but never deliver scoring material.
 * Example: "If I were Ryan, I would" — has "Ryan" but nothing assessable after the modal.
 */
export function looksLikeIncompleteCutOffUserAnswer(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  const low = t.toLowerCase().replace(/[\u201c\u201d\u2018\u2019]/g, "'");
  const wordCount = low.split(/\s+/).filter(Boolean).length;
  // Bare assent variants — not treated as cut-offs here.
  if (
    /^(yes|yeah|yep|yup|sure|ok|okay|no|nope|nah)([.,!\s]+|$)/i.test(low) &&
    low.split(/\s+/).filter(Boolean).length <= 3
  ) {
    return false;
  }
  if (looksLikeCompleteShortUserReply(t)) {
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
  // Bare mentalizing opener with no completed thought — e.g. "I think" / "I think that" (mic-stop).
  if (
    /^i\s+(?:think|guess|feel|believe|suppose)(?:\s+that)?\s*[.,;:!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  // "I think Daniel" / "I think that Daniel" — mentalizing opener + character name only (mic-stop cut-off).
  if (
    /^i\s+(?:think|guess|feel|believe|suppose)\s+(?:(?:that\s+)(?:the\s+)?)?(?:ryan|emma|james|sarah|sophie|daniel|he|she|they|it)\s*[.,;:!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  // Mentalizing opener + character + dangling modal without object — e.g. "I think that James could have".
  if (
    /^i\s+(?:think|guess|feel|believe|suppose)\s+(?:(?:that\s+)(?:the\s+)?)?(?:ryan|emma|james|sarah|sophie|daniel|he|she|they|it)\s+(?:would|could|should|might|will|can)\s+(?:have|be|been|do|done|say|said|go|get|make|talk|tell|ask|listen|help|try|start|stop|kept|keep|told|given|give|shown|show|explained|explain|understood|understand)\s*[.,;:!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  // Character affect mid-clause — e.g. "Daniel felt genuinely" before "at a loss about what to say next".
  if (
    /\b(?:felt|feels|feeling|was feeling|is feeling|seemed|seems|looked|looks|sounded|sounds|appeared|appears)\s+(?:genuinely|really|very|quite|pretty|so|just|truly|actually|probably|maybe|clearly|obviously|definitely|totally|absolutely|somewhat|kinda|kind of|sort of|a little|a bit)\s*[.,;:!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  // "If I'm right" / "If I am right" — conditional setup cut off before the payoff clause.
  if (
    /^if\s+i(?:'m|\s+am)\s+right\b/i.test(low) &&
    wordCount <= 12 &&
    !/\b(?:then|because|so|would|could|should|apolog|listen|repair|talk|tell|ask|feel|frustrated|angry|hurt|upset|contempt|dismiss|care\s+about)\b.{4,}/i.test(
      low,
    ) &&
    !/\bcare\s+about\b/i.test(low)
  ) {
    return true;
  }
  // Trailing "and I …" with dangling modal / intensifier — e.g. "If I'm right and I really".
  if (
    wordCount <= 15 &&
    /\band\s+i\s+(?:really(?:\s+(?:care|think|feel|want|need|do|did|would|could|should|might|will|can|am|was|were|have|had|guess|suppose|believe))?\s*|just|would|could|should|might|will|can|am|was|were|have|had|do|did|want|wanted|need|needed|think|thought|feel|felt|guess|suppose|was|were)\s*[.,;:!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  // Trailing conjunction / thin preposition — utterance stopped before the clause finished.
  if (
    wordCount <= 15 &&
    /\b(and|but|or|so|because|then|that|than|to|for|with|about|like|just|of|if|when|on|upon|at|in|from|into|by)\s*[.,;:!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  // Incomplete negation — "I don't" / "I do not" with no object (mic-stop mid-clause).
  if (/\bi\s+(?:do not|don'?t)\s*[.,;:!?…—–-]*$/i.test(low)) {
    return true;
  }
  // Generic self-description opener cut off before completing the thought (M4 grudge).
  if (
    /\bi'?m\s+generally\b/i.test(low) &&
    /\bi\s+(?:do not|don'?t)\s*[.,;:!?…—–-]*$/i.test(low)
  ) {
    return true;
  }
  if (/\bi\s+generally\s+don'?t\s*[.,;:!?…—–-]*$/i.test(low)) {
    return true;
  }
  // Trailing article / possessive opener (not object pronouns — "with her." is a complete ending).
  if (/\b(a|an|the|my)\s*[.,;:!?…–-]*$/i.test(low)) {
    return true;
  }
  // Incomplete commitment conditional — e.g. "If someone is willing" before finishing the thought.
  if (
    /^if\s+(?:someone|somebody|they|he|she|my\s+partner|the\s+partner|(?:the\s+)?other\s+person)\s+is\s+willing(?:\s+to)?\s*[.,;:!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  if (/^if\s+.{0,48}\s+willing(?:\s+to)?\s*[.,;:!?…—–-]*$/i.test(low)) {
    if (wordCount <= 10) return true;
  }
  // Narrative story opener with no story body — e.g. "This one time" (mic-stop, common on M5).
  if (
    /^(?:well,?\s+|so,?\s+|okay,?\s+|um,?\s+|uh,?\s+)?(?:(?:there\s+was\s+(?:this\s+)?one\s+time|there\s+was\s+a\s+time|this\s+one\s+time|one\s+time))(?:\s+(?:when|where|that))?\s*[.,;:!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  // Common Whisper hallucination / media outro — not an interview answer.
  if (/^thank\s+you\s+for\s+(?:watching|listening|tuning\s+in|joining)\s*[.,;:!?…—–-]*$/i.test(low)) {
    return true;
  }
  // Relationship setup with no episode — e.g. "Yeah, me and my partner" (mic-stop before the story).
  const incompleteRelationalOpener =
    /^(?:(?:yeah|yes|yep|sure|ok|okay),?\s+)?(?:(?:me\s+and\s+my|my)\s+(?:partner|boyfriend|girlfriend|wife|husband|spouse|friend|mom|dad|mother|father|brother|sister|parents|ex|boss|coworker|colleague))\s*[.,;:!?…—–-]*$/i;
  if (wordCount <= 8 && incompleteRelationalOpener.test(low)) {
    return true;
  }
  return false;
}

/**
 * True when {@link looksLikeIncompleteCutOffUserAnswer} should bypass meta-comment routing
 * (ambiguous_short / confusion) and fall through to the cut-off retry gate instead.
 * Excludes phrasing that ends on "that/on" etc. but is clearly a meta comment, not mic-stop.
 */
export function looksLikeMicStopCutOffExemptFromMetaComment(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || !looksLikeIncompleteCutOffUserAnswer(t)) return false;
  if (looksLikeInterviewProcessMetaComment(t)) return false;
  if (looksLikeInterviewProcessQuestionRepeatRequest(t)) return false;
  if (looksLikeGrammaticallyCompleteShortUtterance(t)) return false;
  const low = t.toLowerCase().replace(/[\u201c\u201d\u2018\u2019]/g, "'");
  if (/\?\s*$/.test(low) && /\b(?:mean|what|how|why|skip|move on|next question|question)\b/.test(low)) {
    return false;
  }
  if (/^can we move on\b/i.test(low)) return false;
  if (/^i already (?:answered|said|told|covered)\b/i.test(low)) return false;
  if (/^i think i (?:already|just|covered|answered|said|told)\b/i.test(low)) return false;
  if (/^skip\b/i.test(low) || /\bskip this\b/i.test(low)) return false;
  return true;
}

export function looksLikeInterviewerIdentityOrOffTopicAsk(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return false;
  return INTERVIEWER_IDENTITY_OR_OFF_TOPIC_ASK_RE.test(t);
}

/**
 * User is asking about the interview process (e.g. "Give a question", "Do you have a question?")
 * — a complete meta turn, not a mic-stop cut-off or scorable scenario answer.
 */
export function looksLikeInterviewProcessMetaComment(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  const wc = t.split(/\s+/).filter(Boolean).length;
  if (/\b(?:next question|what'?s next|move on to the next|can we move on)\b/i.test(t)) {
    return false;
  }
  // Long turns that summarize the vignette and ask what to infer are content confusion — not a
  // bare "give me the question" process ask (those should reach Claude, not verbatim replay).
  if (
    wc > 18 &&
    (hasMinimalAssessableScenarioContent(t) ||
      /\b(?:supposed to|meant to|making assumptions|nothing (?:really )?to comment|am i supposed)\b/i.test(
        t,
      ))
  ) {
    return false;
  }
  if (/\bso far there'?s no question\b/i.test(t) && wc > 12) {
    return false;
  }
  if (INTERVIEW_PROCESS_META_RE.test(t)) return true;
  if (
    /\?\s*$/.test(t) &&
    /\b(?:question|ask|repeat|clarify|what do you want|what should i)\b/i.test(t) &&
    !hasMinimalAssessableScenarioContent(t)
  ) {
    return true;
  }
  return false;
}

/** Bare ask to hear/repeat the current interview question (not long substantive confusion). */
const INTERVIEW_PROCESS_QUESTION_REPEAT_RE =
  /\b(?:give(?:\s+me)?\s+(?:a\s+)?(?:the\s+)?question|ask(?:\s+me)?\s+(?:a\s+)?(?:the\s+)?question|what(?:'s|\s+is)\s+the\s+question|where(?:'s|\s+is)\s+the\s+question|do\s+you\s+have\s+(?:a\s+)?question|repeat\s+(?:the\s+)?question|is\s+there\s+(?:a\s+)?question|so\s+far\s+there'?s\s+no\s+question)\b/i;

/** Mic-stop prefix before Whisper completes "question" — e.g. "Give a ques-". */
const INTERVIEW_PROCESS_QUESTION_REPEAT_CUTOFF_RE =
  /^(?:give(?:\s+me)?\s+(?:a\s+)?(?:the\s+)?ques|ask(?:\s+me)?\s+(?:a\s+)?(?:the\s+)?ques|what(?:'s|\s+is)\s+the\s+ques|repeat\s+(?:the\s+)?ques|do\s+you\s+have\s+(?:a\s+)?ques)\b/i;

/**
 * User is asking to hear or repeat the active interview question — client-owned verbatim replay,
 * not Claude meta + parallel-stream duplicate delivery.
 */
export function looksLikeInterviewProcessQuestionRepeatRequest(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  const wc = t.split(/\s+/).filter(Boolean).length;
  if (
    wc > 18 &&
    (hasMinimalAssessableScenarioContent(t) ||
      /\b(?:supposed to|meant to|making assumptions|nothing (?:really )?to comment|am i supposed)\b/i.test(
        t,
      ))
  ) {
    return false;
  }
  if (/\bso far there'?s no question\b/i.test(t) && wc > 12) {
    return false;
  }
  if (INTERVIEW_PROCESS_QUESTION_REPEAT_RE.test(t)) return true;
  if (INTERVIEW_PROCESS_QUESTION_REPEAT_CUTOFF_RE.test(t)) return true;
  if (
    wc <= 8 &&
    /\bcan\s+you\s+(?:ask|repeat)\b/i.test(t) &&
    !hasMinimalAssessableScenarioContent(t)
  ) {
    return true;
  }
  return false;
}

/**
 * Short reply that ends as a complete sentence (terminal punctuation, no dangling grammar).
 * Used to avoid treating intentional brief meta/process turns as mic-stop cut-offs.
 */
export function looksLikeGrammaticallyCompleteShortUtterance(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (!/[.!?]\s*$/.test(t)) return false;
  if (looksLikeIncompleteCutOffUserAnswer(t)) return false;
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  return wordCount > 0 && wordCount <= 15;
}

export function hasMinimalAssessableScenarioContent(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 6) return false;
  return ASSESSABLE_ENGAGEMENT_RE.test(t);
}

/**
 * Tautological repair answer — restates that something can be repaired/fixed without saying how.
 * Example: "This situation can be repaired." on "How do you think this situation could be repaired?"
 */
export function looksLikeRepairQuestionEchoAnswer(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  const low = t.toLowerCase().replace(/[\u201c\u201d\u2018\u2019]/g, "'");
  const wordCount = low.split(/\s+/).filter(Boolean).length;
  if (wordCount > 12) return false;
  if (
    /^(?:this|that|the|it|(?:this|that|the)\s+(?:situation|relationship|issue|conflict|problem))\s+(?:can|could|should|might|would|needs?\s+to)\s+(?:be\s+)?(?:repair(?:ed)?|fix(?:ed)?|resolv(?:ed)?|work(?:ed)?\s*out)\s*[.!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  if (
    /^(?:yes|yeah|yep|sure|ok|okay),?\s*(?:it|this|that)\s+(?:can|could)\s+(?:be\s+)?(?:repair(?:ed)?|fix(?:ed)?)\s*[.!?…—–-]*$/i.test(
      low,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * True when the user turn is not a scorable attempt at the interview question.
 * Prefer handling known meta/skip/repeat intents elsewhere before calling this.
 */
export function looksLikeUnassessableScenarioAnswer(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (looksLikeCompleteShortUserReply(t)) return false;
  if (looksLikeInterviewScoreStatusRequest(t)) return false;
  if (looksLikeInterviewProcessMetaComment(t)) return false;
  if (looksLikeInterviewProcessQuestionRepeatRequest(t)) return false;
  if (looksLikeCheckingInSufficiencyAsk(t)) return true;
  if (looksLikePriorAnswerMetaComment(t)) return true;
  if (looksLikeInterviewerIdentityOrOffTopicAsk(t)) return true;
  // Cut-offs can include a character name ("Ryan") without any scorable content — still unassessable.
  if (looksLikeIncompleteCutOffUserAnswer(t)) return true;
  if (looksLikeRepairQuestionEchoAnswer(t)) return true;

  const words = t.split(/\s+/).filter(Boolean);
  const asksInterviewer =
    /\?/.test(t) && /\b(?:you|your|amoraea|aira|aria)\b/i.test(t);

  if (asksInterviewer && !hasMinimalAssessableScenarioContent(t)) {
    return true;
  }

  if (words.length <= 8 && !hasMinimalAssessableScenarioContent(t)) {
    if (looksLikeGrammaticallyCompleteShortUtterance(t)) return false;
    return true;
  }

  return false;
}
