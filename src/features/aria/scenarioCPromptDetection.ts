import { isScenarioBToScenario3HandoffText } from './scenarioBProbeLogic';
import {
  SCENARIO_2_TO_3_TRANSITION_FALLBACK,
  assistantTextLooksLikeMoment4HandoffLead,
  buildScenario3ToMoment4BundleForInterview,
} from './interviewTransitionBundles';
import { hasScenarioBoundaryWrapPhrase, isScenarioThreeToMoment4EmotionModalHandoff, splitScenarioTransitionForEmotionModal } from './emotionModalTransitionOrchestration';
import { isTruncatedScenarioABoundaryReflectionOpener } from './scenarioAContemptProbeTextMatch';
import { looksLikeMoment4GrudgePrompt, looksLikeMoment4ThresholdQuestion } from './moment4ProbeLogic';
import { MOMENT_4_PERSONAL_CARD, assistantTextIsPrematureMoment4HandoffDuringScenarioC } from './interviewMomentScenarioConfig';
import { transcriptAssistantContainsMoment5PrimaryConflictQuestion } from './probeAndScoringUtils';
import { isDecline } from './interviewControlTokens';
import { normalizeInterviewTypography } from './interviewTypography';
import { looksLikeScenarioCCommitmentThresholdAssistantPrompt } from './scenarioCCommitmentThresholdLogic';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from './interviewDisengagementProbeCopy';
import { SHOW_SCENARIO_3_OPENING_EXACT } from './interviewShowScenarioExactCopy';
import { normalizeWhitespace } from './disengagementProbeNormalize';
import type { MessageWithScenario } from './interviewScenarioScoringSlice';
import { repairAnswerHasConcreteSuggestionActionOrStep } from './interviewRepairRefusalDetection';
import { countSpokenWords } from './interviewLanguageGate';
import { userAnswerHasSophiePerspectiveLanguage } from './interviewMentalizingAndAnswerSignals';

/** "come back" / "comes back" / "came back" after Daniel or he — models vary conjugation. */
const SCENARIO_C_DANIEL_HE_COMES_BACK_RE =
  /\b(?:when )?(?:daniel|he) (?:has )?(?:comes?|came) back\b/;

export function looksLikeScenarioCSophiePerspectiveQuestion(text: string): boolean {
  const raw = normalizeInterviewTypography(text ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return false;
  if (normalizeWhitespace(raw) === normalizeWhitespace(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE)) return true;
  const low = raw.toLowerCase();
  if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(raw)) return false;
  if (isScenarioCRepairAssistantPrompt(raw)) return false;
  return (
    /\bwhat do you think this pattern of leaving\b/.test(low) ||
    /\b(?:how|what).*\b(?:daniel|he)\s+(?:leaving|left|walk(?:s|ing)? away)\b.*\b(?:impact|like for|affect|been like)\b.*\bsophie\b/.test(
      low,
    ) ||
    /\b(?:impact|like|been like)\b.*\bsophie\b.*\b(?:over time|pattern|leaving)\b/.test(low) ||
    (/\bsophie\b/.test(low) &&
      /\b(?:pattern of leaving|over time|leaving has been|daniel leaving|him leaving)\b/.test(low))
  );
}

/** Off-script Sophie role-play the model sometimes invents after S3 Q1 — not a scripted probe. */
export function looksLikeScenarioCSophieRolePlayMisparaphraseQuestion(text: string): boolean {
  const raw = normalizeInterviewTypography(text ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return false;
  if (looksLikeScenarioCSophiePerspectiveQuestion(raw)) return false;
  if (isScenarioCRepairAssistantPrompt(raw)) return false;
  const low = raw.toLowerCase();
  return (
    /\bif you were sophie\b/.test(low) ||
    /\bhow would you handle it if you were sophie\b/.test(low) ||
    /\bhow would you (?:handle|respond|react|deal with|behave)\b.*\bif you were sophie\b/.test(low) ||
    /\bwhat would you do if you were sophie\b/.test(low) ||
    (/\b(as|being) sophie\b/.test(low) && /\bhow would you\b/.test(low))
  );
}

/**
 * Off-script logistics / next-steps follow-up after S3 Q1 — not the scripted Sophie-perspective probe.
 * Example: "Got it. And what should happen next between them?"
 */
export function looksLikeScenarioCNextStepsBetweenThemMisparaphraseQuestion(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 18) return false;
  if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(text)) return false;
  if (isScenarioCRepairAssistantPrompt(text)) return false;
  if (isScenarioCQ1Prompt(text)) return false;
  if (looksLikeScenarioCSophiePerspectiveQuestion(text)) return false;
  if (looksLikeScenarioCSophieRolePlayMisparaphraseQuestion(text)) return false;
  return (
    /\bwhat should happen next between (?:them|the couple)\b/.test(t) ||
    /\bwhat (?:needs|needed) to happen next between\b/.test(t) ||
    /\bwhat happens next between (?:them|the couple)\b/.test(t) ||
    /\bwhat should (?:they|the couple) do next\b/.test(t) ||
    /\bwhat do you think should happen next between\b/.test(t) ||
    /\band what should happen next\b/.test(t)
  );
}

/**
 * Off-script direct-address Sophie question after S3 Q1 — not the scripted Sophie-perspective probe.
 * e.g. "Still upset — what would you say to Sophie?", "What would you tell her?"
 */
export function looksLikeScenarioCSophieSayToSophieMisparaphraseQuestion(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 18) return false;
  if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(text)) return false;
  if (isScenarioCRepairAssistantPrompt(text)) return false;
  if (isScenarioCQ1Prompt(text)) return false;
  if (looksLikeScenarioCSophiePerspectiveQuestion(text)) return false;
  if (looksLikeScenarioCSophieRolePlayMisparaphraseQuestion(text)) return false;
  if (looksLikeScenarioCNextStepsBetweenThemMisparaphraseQuestion(text)) return false;
  return (
    /\bwhat would you (?:say|tell) (?:to )?(?:sophie|her)\b/.test(t) ||
    /\bhow would you respond to (?:sophie|her)\b/.test(t) ||
    (/\bstill upset\b/.test(t) &&
      /\b(?:what would you (?:say|tell)|say to (?:sophie|her))\b/.test(t))
  );
}

/** Streaming may flush before the Sophie say-to misparaphrase tail arrives. */
export function isIncompleteScenarioCSophieSayToLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (looksLikeScenarioCSophieSayToSophieMisparaphraseQuestion(t)) return false;
  const low = t.toLowerCase();
  return (
    (/\bstill upset\b/.test(low) && /\bwhat would you say\b/.test(low)) ||
    /\bwhat would you (?:say|tell) to sophie\b/.test(low) ||
    /\bwhat would you say to her\b/.test(low) ||
    (/\bwhat would you (?:say|tell) to soph\b/.test(low) && !/\bsophie\b/.test(low))
  );
}

/** Replace off-script Sophie role-play with the canonical Sophie-perspective probe. */
export function coerceScenarioCSophieRolePlayQuestionForTts(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!looksLikeScenarioCSophieRolePlayMisparaphraseQuestion(t)) return t;
  const ackMatch = t.match(/^(got it|makes sense|well done|good read|nice read)[.,!?]?\s+/i);
  const ack = ackMatch?.[0]?.trim().replace(/[.,!?]+$/, '');
  if (ack) return `${ack}. ${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}`;
  return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
}

/** Streaming may flush before the Sophie-perspective tail arrives. */
export function isIncompleteScenarioCSophiePerspectiveLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (normalizeWhitespace(t) === normalizeWhitespace(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE)) return false;
  const low = t.toLowerCase();
  if (/^got it\.?\s+what do you think\b/.test(low)) return true;
  if (/\bwhat do you think this pattern\b/.test(low)) return true;
  if (/\bwhat do you think\b/.test(low) && /\b(sophie|pattern of leaving|leaving has been)\b/.test(low)) {
    return true;
  }
  return false;
}

/** Remove canonical Sophie-perspective probe tail so a late stream flush can keep only the ack. */
export function stripEmbeddedScenarioCSophiePerspectiveQuestion(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return t;
  const low = t.toLowerCase();
  const marker = 'what do you think this pattern of leaving';
  const idx = low.indexOf(marker);
  if (idx > 0) {
    return t.slice(0, idx).replace(/[—\-–.,\s]+$/, '').trim();
  }
  if (idx === 0) return '';
  return t;
}

/**
 * Parallel streaming may flush Sophie perspective in a later sentence after coercion already spoke it.
 * Keep a brief ack only; suppress bare duplicate probes.
 */
export function stripScenarioCSophiePerspectiveStreamingEcho(
  spoken: string,
  sophieProbeAlreadySpoken: boolean,
): string | null {
  const t0 = (spoken ?? '').trim();
  if (!sophieProbeAlreadySpoken || !t0) return t0;
  if (!looksLikeScenarioCSophiePerspectiveQuestion(t0)) return t0;
  const stripped = stripEmbeddedScenarioCSophiePerspectiveQuestion(t0).trim();
  if (!stripped) return null;
  if (looksLikeScenarioCSophiePerspectiveQuestion(stripped)) return null;
  return stripped;
}

/** Expand truncated Sophie-perspective probe fragments to canonical copy. */
export function coerceScenarioCSophiePerspectiveQuestionForTts(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
  if (looksLikeScenarioCSophieRolePlayMisparaphraseQuestion(t)) {
    return coerceScenarioCSophieRolePlayQuestionForTts(t);
  }
  if (
    looksLikeScenarioCNextStepsBetweenThemMisparaphraseQuestion(t) ||
    looksLikeScenarioCSophieSayToSophieMisparaphraseQuestion(t)
  ) {
    const ackMatch = t.match(/^(got it|makes sense|that makes (?:a lot of )?sense|well done|good read)[.,]?\s+/i);
    const ack = ackMatch?.[0]?.trim().replace(/[.,]+$/, '');
    if (ack) return `${ack}. ${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}`;
    return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
  }
  if (isIncompleteScenarioCSophieSayToLeadSentence(t)) {
    const ackMatch = t.match(/^(got it|makes sense|that makes (?:a lot of )?sense|well done|good read)[.,]?\s+/i);
    const ack = ackMatch?.[0]?.trim().replace(/[.,]+$/, '');
    if (ack) return `${ack}. ${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}`;
    return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
  }
  if (looksLikeScenarioCSophiePerspectiveQuestion(t) && /\?\s*$/.test(t)) return t;
  if (
    looksLikeScenarioCSophiePerspectiveQuestion(t) ||
    isIncompleteScenarioCSophiePerspectiveLeadSentence(t)
  ) {
    const ackMatch = t.match(/^(got it|makes sense|that makes (?:a lot of )?sense|well done|good read)[.,]?\s+/i);
    const ack = ackMatch?.[0]?.trim().replace(/[.,]+$/, '');
    if (ack && isIncompleteScenarioCSophiePerspectiveLeadSentence(t)) {
      return `${ack}. ${SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE}`;
    }
    return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
  }
  return t;
}

/**
 * Streaming may flush a partial S3 boundary wrap (reflection + segment close) without the M4 personal card.
 */
export function isIncompleteScenarioCBoundaryClosureLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (/\b(?:held a grudge|really hard time with|got under your skin|two questions left)\b/i.test(t)) {
    return false;
  }
  if (isTruncatedScenarioABoundaryReflectionOpener(t)) return true;
  const low = t.toLowerCase();
  const hasClosureLead =
    hasScenarioBoundaryWrapPhrase(t) ||
    /\bend of the three situations\b/.test(low) ||
    (/\bgood work getting through all\b/.test(low) &&
      (/\bthree\b/.test(low) || /\b3\b/.test(low) || /\bscenario/.test(low))) ||
    /\bwhat i (?:heard|got) was\b/.test(low) ||
    /\bwhat came through was\b/.test(low) ||
    /\bwhat landed for me was\b/.test(low) ||
    /\byou (?:focused on|named|framed|pointed to|highlighted|saw|recognized|picked up on|read)\b/.test(low) ||
    /\bi can see that\b/.test(low) ||
    /\bso (?:your (?:instinct|read)|for you,? (?:the )?(?:read|repair|instinct))\b/.test(low) ||
    /^so your inst(?:inct)?(?:\s+is)?(?:\s+that)?\b/i.test(t);
  if (!hasClosureLead) return false;
  return !isScenarioCRepairAssistantPrompt(t);
}

/**
 * S3→Moment 4 boundary attempt without the personal card — includes truncated streaming cutoffs
 * like "So your instinct is that showing up and" and complete reflection-only wraps.
 */
export function isScenarioCBoundaryReflectionWithoutMoment4Handoff(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || textContainsScenarioCVignetteBody(t)) return false;
  if (isScenarioBToScenario3HandoffText(t)) return false;
  const low = t.toLowerCase();
  if (/\b(?:held a grudge|really hard time with|got under your skin)\b/.test(low)) return false;
  if (
    assistantTextLooksLikeMoment4HandoffLead(t) &&
    /\b(?:held a grudge|really hard time with|got under your skin|two questions left)\b/.test(low)
  ) {
    return false;
  }
  return (
    hasScenarioBoundaryWrapPhrase(t) ||
    /\bwraps up the three situation/.test(low) ||
    /\bwraps up the third situation/.test(low) ||
    /\bend of the three situations\b/.test(low) ||
    /\bwhat i (?:heard|got) was\b/.test(low) ||
    /\bwhat came through was\b/.test(low) ||
    /\bwhat landed for me was\b/.test(low) ||
    /\byou (?:focused on|named|framed|pointed to|highlighted|saw|recognized|picked up on|read)\b/.test(low) ||
    /\bi can see that\b/.test(low) ||
    /\bso (?:your (?:instinct|read)|for you,? (?:the )?(?:read|repair|instinct))\b/.test(low) ||
    /^so your inst(?:inct)?(?:\s+is)?(?:\s+that)?\b/i.test(t) ||
    isIncompleteScenarioCBoundaryClosureLeadSentence(t)
  );
}

/** Strip a streaming-truncated `[SCENARIO` / `[SCENARIO_COMPLETE` control token tail before TTS. */
export function stripIncompleteScenarioControlTokenSuffix(text: string): string {
  return (text ?? '')
    .replace(/\[\s*SCENARIO(?:_COMPLETE)?(?::\s*\d*)?[^\]]*$/gi, '')
    .trim();
}

function scenarioCBoundaryHandoffNeedsMoment4Coercion(text: string): boolean {
  const cleaned = stripIncompleteScenarioControlTokenSuffix(text);
  if (!cleaned) return false;
  if (isScenarioBToScenario3HandoffText(cleaned)) return false;
  if (/\[\s*SCENARIO/i.test(text ?? '')) return true;
  const split = splitScenarioTransitionForEmotionModal(cleaned);
  if (split.afterModal.trim()) return false;
  if (/\b(?:held a grudge|really hard time with|got under your skin)\b/i.test(cleaned)) {
    return false;
  }
  return (
    isScenarioThreeToMoment4EmotionModalHandoff(cleaned) ||
    isScenarioCBoundaryReflectionWithoutMoment4Handoff(cleaned) ||
    isIncompleteScenarioCBoundaryClosureLeadSentence(cleaned)
  );
}

/** Expand truncated S3→M4 boundary / repeat-TTS copy to the full handoff + personal card. */
export function coerceScenarioCBoundaryHandoffForTts(
  text: string,
  firstName = '',
  lastUserAnswer?: string | null,
): string {
  const raw = (text ?? '').trim();
  if (!raw) return text;
  const cleaned = stripIncompleteScenarioControlTokenSuffix(raw);
  if (!scenarioCBoundaryHandoffNeedsMoment4Coercion(raw)) {
    return cleaned;
  }
  const coerced = buildScenario3ToMoment4BundleForInterview(
    firstName,
    MOMENT_4_PERSONAL_CARD,
    lastUserAnswer ?? undefined,
  );
  return coerced;
}

/** Canonical Scenario C Q2 (repair / resolve the conflict) — question only (ack is spoken separately). */
export const SCENARIO_C_REPAIR_QUESTION_CANONICAL =
  'How do you think this situation could be repaired?';

/** @deprecated Alias — Scenario C repair is always {@link SCENARIO_C_REPAIR_QUESTION_CANONICAL}. */
export const SCENARIO_C_REPAIR_AS_DANIEL_CANONICAL = SCENARIO_C_REPAIR_QUESTION_CANONICAL;

/** Model paraphrase: repair-as-Daniel / in-Daniel's-shoes — coerced to canonical Q2, not spoken as-is. */
export function looksLikeScenarioCRepairAsDanielQuestion(text: string): boolean {
  const raw = normalizeInterviewTypography(text ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return false;
  const low = raw.toLowerCase();
  if (/\bin daniel'?s? shoes\b/.test(low)) return true;
  if (/\brepair things with sophie\b/.test(low)) return true;
  if (/\bhow would you repair\b/.test(low) && /\b(?:if you were |you were )?daniel\b/.test(low)) return true;
  if (/\bhow would you repair\b/.test(low) && /\bas daniel\b/.test(low)) return true;
  if (/\bhow would you repair\b/.test(low) && /\bsophie\b/.test(low) && /\b(?:if you were|you were)\b/.test(low)) {
    return true;
  }
  return false;
}

/** Streaming may flush before the repair-as-Daniel tail arrives (e.g. "coming back into"). */
export function isIncompleteScenarioCRepairAsDanielLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (looksLikeScenarioCRepairAsDanielQuestion(t) && /\?\s*$/.test(t)) return false;
  const low = t.toLowerCase();
  return (
    /\bin daniel'?s? shoes\b/.test(low) ||
    /\brepair things with sophie\b/.test(low) ||
    (/\bhow would you repair\b/.test(low) && /\bdaniel\b/.test(low))
  );
}

export function coerceScenarioCRepairAsDanielQuestionForTts(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (
    !t ||
    looksLikeScenarioCRepairAsDanielQuestion(t) ||
    isIncompleteScenarioCRepairAsDanielLeadSentence(t)
  ) {
    return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  }
  return t;
}

/** Show scenario modal footer — always canonical Scenario C Q2 repair copy. */
export function resolveScenarioCRepairModalPromptFromText(_text: string): string {
  return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
}

/**
 * Assistant turn: Scenario C Q2 (repair) — not Q1 (make of Daniel's "I didn't know what to say" line), not commitment threshold.
 * Models paraphrase; keep in sync with AriaScreen `replyingToScenarioCQ2` / forced threshold injection.
 */
export function isScenarioCRepairAssistantPrompt(text: string): boolean {
  const raw = normalizeInterviewTypography(text ?? '');
  const t = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 22) return false;
  if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(raw)) return false;
  if (looksLikeScenarioCRepairAsDanielQuestion(raw)) return true;
  if (isScenarioCQ1Prompt(raw)) return false;
  const canonical =
    t.includes('how do you think this situation could be repaired') ||
    t.includes('how do you think this situation can be repaired');
  const dropSituation = /\bhow do you think this could be repaired\b/.test(t);
  const modalShort =
    /\bhow (might|could|would|should) this situation be repaired\b/.test(t) ||
    /\bhow (might|could|would) this be repaired\b/.test(t);
  const canBeRepaired =
    /\bhow (can|could) (this situation|this|they|things) be repaired\b/.test(t) ||
    /\bhow (can|could) (they|daniel and sophie) repair\b/.test(t);
  const repairIng =
    /\bhow would you (approach|begin) repair(ing)?\b/.test(t) ||
    /\bhow (might|should) (they|the couple) repair\b/.test(t);
  return canonical || dropSituation || modalShort || canBeRepaired || repairIng;
}

/**
 * Model paraphrase: prescriptive "what should Daniel do when he's back" — not the interpretive Q1 we want.
 */
export function looksLikeScenarioCDanielPrescriptiveBackInRoomQuestion(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 18) return false;
  if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(text)) return false;
  if (isScenarioCRepairAssistantPrompt(text)) return false;
  if (looksLikeScenarioCSophiePerspectiveQuestion(text)) return false;
  if (/\bwhat do you make of\b/.test(t) && /\bdidn'?t know\b/.test(t)) return false;
  return (
    /\bwhat should (daniel|he)\b/.test(t) ||
    /\bhow would you (?:actually )?have daniel\b/.test(t) ||
    /\bhow would daniel (?:handle|do|say|respond|act)\b/.test(t) ||
    (/\bback in the room\b/.test(t) && /\b(what|how) should\b/.test(t)) ||
    (/\bwhen (daniel|he)('?s| is)? back\b/.test(t) && /\b(what|how) should\b/.test(t)) ||
    (/\bwhen (daniel|he) walks? back\b/.test(t) && /\bhow would\b/.test(t))
  );
}

/** Off-script Daniel Q1 paraphrase — interpretive Q1, come-back, or prescriptive action replay. */
export function looksLikeScenarioCDanielPrescriptiveQ1Paraphrase(text: string): boolean {
  return (
    isScenarioCQ1Prompt(text) ||
    looksLikeScenarioCDanielComeBackMisparaphraseQuestion(text) ||
    looksLikeScenarioCDanielPrescriptiveBackInRoomQuestion(text)
  );
}

/**
 * Model paraphrase after Q1: "Now that Daniel has come back, what do you think…" — not repair, not canonical Q1.
 */
export function looksLikeScenarioCDanielComeBackMisparaphraseQuestion(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 18) return false;
  if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(text)) return false;
  if (isScenarioCRepairAssistantPrompt(text)) return false;
  if (isScenarioCQ1Prompt(text)) return false;
  if (looksLikeScenarioCSophiePerspectiveQuestion(text)) return false;
  const danielBack =
    /\bnow that (daniel|he)\b/.test(t) ||
    SCENARIO_C_DANIEL_HE_COMES_BACK_RE.test(t) ||
    /\bwhen (daniel|he) walks? back\b/.test(t) ||
    /\b(?:daniel|he) (?:has )?(?:comes?|came) back\b/.test(t);
  if (!danielBack) return false;
  return (
    /\bwhat do you think\b/.test(t) ||
    /\bwhat (?:do|would|should)\b/.test(t) ||
    /\bhow (?:do|would|should)\b/.test(t)
  );
}

/**
 * Model paraphrase after Q1 or Sophie perspective: prescriptive Sophie-receive/respond/do question — not repair Q2.
 * e.g. "And when he comes back — how should Sophie receive", "How would you want Sophie to respond when Daniel comes back?",
 * "What would you want Sophie to do with what Daniel just said?"
 */
function hasScenarioCSophieReceiveMisparaphraseCue(t: string): boolean {
  if (
    /\b(?:what|how) do you think sophie should (?:do|say|respond|handle|react)\b/.test(t) ||
    /\bwhat do you think sophie should do when (?:daniel|he)\b/.test(t)
  ) {
    return true;
  }
  if (
    /\bhow (?:do|would) you (?:want|like) sophie to respond\b/.test(t) ||
    /\bhow should sophie respond\b/.test(t)
  ) {
    return true;
  }
  if (
    /\b(?:what|how) (?:do|would) you (?:want|like) sophie to (?:do|respond|react|handle|say)\b/.test(t) ||
    /\b(?:want|like) sophie to do\b/.test(t) ||
    /\bsophie to do with what (?:daniel|he)\b/.test(t)
  ) {
    return true;
  }
  if (
    /\bsophie should (?:do|say|respond|handle|react)\b/.test(t) &&
    SCENARIO_C_DANIEL_HE_COMES_BACK_RE.test(t)
  ) {
    return true;
  }
  return (
    /\bhow should sophie receive\b/.test(t) ||
    (SCENARIO_C_DANIEL_HE_COMES_BACK_RE.test(t) &&
      (/\bhow should (sophie|she)\b/.test(t) ||
        /\b(want|like) sophie to (?:respond|do)\b/.test(t))) ||
    (/\band when (daniel|he) comes back\b/.test(t) && /\bhow should sophie\b/.test(t))
  );
}

/** Forbidden prescriptive Sophie-receive/do follow-up — not on the Scenario C question list. */
export function isForbiddenScenarioCSophiePrescriptiveFollowUpQuestion(text: string): boolean {
  return (
    looksLikeScenarioCSophieReceiveMisparaphraseQuestion(text) ||
    looksLikeScenarioCNextStepsBetweenThemMisparaphraseQuestion(text) ||
    looksLikeScenarioCSophieSayToSophieMisparaphraseQuestion(text)
  );
}

export function looksLikeScenarioCSophieReceiveMisparaphraseQuestion(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 18) return false;
  if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(text)) return false;
  if (isScenarioCRepairAssistantPrompt(text)) return false;
  if (isScenarioCQ1Prompt(text)) return false;
  if (looksLikeScenarioCSophiePerspectiveQuestion(text)) return false;
  const matched = hasScenarioCSophieReceiveMisparaphraseCue(t);
  return matched;
}

/** Streaming may flush before the Sophie-receive misparaphrase tail arrives. */
export function isIncompleteScenarioCSophieReceiveLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || isScenarioCRepairAssistantPrompt(t)) return false;
  const low = t.toLowerCase();
  if (looksLikeScenarioCSophieReceiveMisparaphraseQuestion(t)) return !/\?\s*$/.test(t);
  return (
    /\bhow should sophie receive\b/.test(low) ||
    /\bhow (?:do|would) you (?:want|like) sophie to respond\b/.test(low) ||
    /\b(?:what|how) (?:do|would) you (?:want|like) sophie to do\b/.test(low) ||
    /\b(?:what|how) do you think sophie should\b/.test(low) ||
    /\b(?:want|like) sophie to do with what (?:daniel|he)\b/.test(low) ||
    (SCENARIO_C_DANIEL_HE_COMES_BACK_RE.test(low) &&
      (/\bhow should sophie\b/.test(low) ||
        /\b(want|like) sophie to (?:respond|do)\b/.test(low) ||
        /\bsophie should (?:do|say|respond)\b/.test(low)))
  );
}

/** Streaming may flush before the Daniel-come-back misparaphrase tail arrives. */
export function isIncompleteScenarioCDanielComeBackLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || isScenarioCRepairAssistantPrompt(t)) return false;
  if (looksLikeScenarioCDanielComeBackMisparaphraseQuestion(t)) return !/\?\s*$/.test(t);
  if (/\?\s*$/.test(t)) return false;
  const low = t.toLowerCase();
  if (
    /\bnow that (daniel|he)\b/.test(low) &&
    /\b(come back|came back|'?s back|has come back)\b/.test(low)
  ) {
    return true;
  }
  return /\bwhen (daniel|he) walks? back\b/.test(low) && /\bhow would\b/.test(low);
}

/** Replace prescriptive / come-back Daniel paraphrases with canonical Q1 or repair Q2. */
export function coerceScenarioCQ1PrescriptiveStripForTts(
  text: string,
  messages?: readonly MessageWithScenario[],
): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (messages && scenarioCQ1InterpretationSatisfiedInTranscript(messages)) {
    return resolveScenarioCNextProbeAfterSatisfiedQ1(messages);
  }
  if (
    looksLikeScenarioCDanielComeBackMisparaphraseQuestion(t) ||
    isIncompleteScenarioCDanielComeBackLeadSentence(t)
  ) {
    return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  }
  if (!looksLikeScenarioCDanielPrescriptiveBackInRoomQuestion(t)) return t;
  return SHOW_SCENARIO_3_OPENING_EXACT;
}

/** Coerce truncated Daniel-come-back misparaphrases and generic repair Q2 paraphrases to canonical copy. */
export function isIncompleteScenarioCRepairQuestionTail(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 120) return false;
  if (looksLikeScenarioCRepairAsDanielQuestion(t)) return false;
  const low = t.toLowerCase();
  if (/\bhow do you think this (?:situation )?(?:could|can) be repaired\b/.test(low)) {
    return !/\?\s*$/.test(t);
  }
  if (/\b(this )?situation (can|could) be repaired\b/.test(low)) return true;
  if (/\b(could|can) be repaired\b/.test(low) && !/\bhow\b/.test(low)) return true;
  return false;
}

export function coerceScenarioCRepairQuestionForTts(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  if (looksLikeScenarioCRepairWithUserAnswerEcho(t)) {
    return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  }
  if (isIncompleteScenarioCRepairQuestionTail(t)) {
    return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  }
  if (isScenarioCRepairAssistantPrompt(t)) {
    return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  }
  if (
    looksLikeScenarioCRepairAsDanielQuestion(t) ||
    isIncompleteScenarioCRepairAsDanielLeadSentence(t)
  ) {
    return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  }
  if (
    looksLikeScenarioCSophieReceiveMisparaphraseQuestion(t) ||
    isIncompleteScenarioCSophieReceiveLeadSentence(t) ||
    looksLikeScenarioCDanielComeBackMisparaphraseQuestion(t) ||
    isIncompleteScenarioCDanielComeBackLeadSentence(t)
  ) {
    return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  }
  return t;
}

/** Tab-restore / repeat replay — never resume mid-clause repair tails or invalid S3 misparaphrases. */
export function coerceInterviewReplayTtsText(text: string, fallbacks: string[] = []): string {
  const primary = coerceScenarioCRepairQuestionForTts((text ?? '').replace(/\s+/g, ' ').trim());
  if (!isIncompleteScenarioCRepairQuestionTail(primary)) {
    return primary;
  }
  for (const fb of fallbacks) {
    const candidate = coerceScenarioCRepairQuestionForTts((fb ?? '').replace(/\s+/g, ' ').trim());
    if (candidate && !isIncompleteScenarioCRepairQuestionTail(candidate)) {
      return candidate;
    }
  }
  return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
}

/** True when the model draft should be replaced entirely with canonical repair Q2. */
export function shouldReplaceDraftWithScenarioCRepairQuestionOnly(
  draft: string,
  shouldForceScenarioCRepairProbe: boolean,
  transcriptHasRepairQuestion: boolean,
): boolean {
  if (!shouldForceScenarioCRepairProbe || transcriptHasRepairQuestion) return false;
  const t = (draft ?? '').replace(/\s+/g, ' ').trim();
  if (!t || isScenarioCRepairAssistantPrompt(t)) return false;
  return true;
}

function priorScenarioCAssistantTurns(msgs: readonly MessageWithScenario[]) {
  return msgs.filter(
    (m) =>
      m.role === 'assistant' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      !(m as { isScoreCard?: boolean }).isScoreCard,
  );
}

function transcriptAlreadyContainsScenarioCRepairQuestion(msgs: readonly MessageWithScenario[]): boolean {
  return priorScenarioCAssistantTurns(msgs).some((m) =>
    isScenarioCRepairAssistantPrompt((m as { content?: string }).content ?? ''),
  );
}

/** Sophie perspective probe already delivered in transcript (including stream-persisted turns). */
export function scenarioCSophiePerspectiveProbeAlreadyDelivered(
  messages: readonly MessageWithScenario[],
): boolean {
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      looksLikeScenarioCSophiePerspectiveQuestion((m.content ?? '').trim()),
  );
}

/** Sophie perspective probe accepts brief affect reads — e.g. "Probably annoying", "It must've been frustrating". */
const SCENARIO_C_SOPHIE_PERSPECTIVE_SHORT_AFFECT_RE =
  /\b(?:frustrating|frustrated|annoying|annoyed|hurt|hurting|painful|hard|difficult|lonely|exhausting|exhausted|draining|invalidating|invalidated|dismissed|unheard|abandoned|disappointed|upset|sad|scared|anxious|resigned|tired|awful|terrible|suck|sucks|reject(?:ed|ion)?|abandon(?:ment|ed)?)\b/i;

export function looksLikeScenarioCSophiePerspectiveAssessableShortAnswer(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim();
  if (!t || t.length < 6) return false;
  const low = t.toLowerCase().replace(/[\u201c\u201d\u2018\u2019]/g, "'");
  if (/^i\s+(?:think|guess|feel|believe|suppose)(?:\s+that)?\s*[.,;:!?…—–-]*$/i.test(low)) {
    return false;
  }
  if (
    /^i\s+(?:think|guess|feel|believe|suppose)\s+(?:(?:that\s+)(?:the\s+)?)?(?:sophie|daniel|he|she|they|it)\s*[.,;:!?…—–-]*$/i.test(
      low,
    )
  ) {
    return false;
  }
  if (!SCENARIO_C_SOPHIE_PERSPECTIVE_SHORT_AFFECT_RE.test(low)) return false;
  if (/\b(?:sophie|she|her)\b/i.test(low)) return true;
  if (/\b(?:for|to)\s+(?:so|soph|her|she)\s*[.,;:!?…—–-]*$/i.test(low)) return true;
  if (/\b(?:must(?:'ve| have) been|probably|maybe|really|very|pretty|so|just|quite)\b/i.test(low)) {
    return true;
  }
  if (countSpokenWords(t) <= 6) return true;
  return false;
}

/** User answered the Sophie perspective probe with substantive emotional read (with or without naming Sophie). */
export function userAnswerSatisfiesScenarioCSophiePerspectiveProbe(
  text: string | null | undefined,
): boolean {
  const raw = (text ?? '').trim();
  if (!raw || isDecline(raw)) return false;
  if (userAnswerHasSophiePerspectiveLanguage(raw)) return true;
  if (looksLikeScenarioCSophiePerspectiveAssessableShortAnswer(raw)) return true;
  if (countSpokenWords(raw) < 8) return false;
  const t = normalizeInterviewTypography(raw).replace(/\s+/g, ' ').trim().toLowerCase();
  const emotionalImpact =
    /\b(hurt|rejection|abandonment|unheard|dismissed|lonely|painful|invalidated|exhausting|abandon|dismiss|suck|awful|terrible|hard)\b/.test(
      t,
    );
  const leavingPattern =
    /\b(pattern|leaving|leave|walk(?:s|ing)? away|without resolution|over time|keeps? leaving)\b/.test(
      t,
    );
  return emotionalImpact && (leavingPattern || countSpokenWords(raw) >= 12);
}

/** True when the user already answered after the most recent Sophie perspective probe. */
export function scenarioCSophiePerspectiveAnsweredInTranscript(
  messages: readonly MessageWithScenario[],
): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    if (!looksLikeScenarioCSophiePerspectiveQuestion((m.content ?? '').trim())) continue;
    return messages.slice(i + 1).some(
      (u) =>
        u.role === 'user' &&
        userAnswerSatisfiesScenarioCSophiePerspectiveProbe((u.content ?? '').trim()),
    );
  }
  return false;
}

/** Model echoed the user's prior answer before re-asking repair — speak canonical Q2 instead. */
export function looksLikeScenarioCRepairWithUserAnswerEcho(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  const hasRepairAsk =
    looksLikeScenarioCRepairAsDanielQuestion(text) || isScenarioCRepairAssistantPrompt(text);
  if (!hasRepairAsk) return false;
  return (
    /\b(you'?re right|that'?s right|exactly|fair point)\b/.test(t) &&
    /\b(you said|you mentioned|you described|you talked about|you pointed to|you highlighted)\b/.test(t)
  );
}

/** Coerce repair paraphrases / user-echo prefaces to canonical Scenario C Q2 for TTS + persist. */
export function coerceScenarioCRepairAssistantForTts(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  if (
    looksLikeScenarioCRepairWithUserAnswerEcho(t) ||
    looksLikeScenarioCRepairAsDanielQuestion(t) ||
    isIncompleteScenarioCRepairAsDanielLeadSentence(t)
  ) {
    return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  }
  return t;
}

export function shouldSuppressScenarioCRepairReplay(
  messages: readonly MessageWithScenario[],
  candidateText: string,
  opts?: {
    repairSpokenThisStream?: boolean;
    repairProbeDeliveredRef?: boolean;
  },
): boolean {
  if (
    !isScenarioCRepairAssistantPrompt(candidateText) &&
    !looksLikeScenarioCRepairAsDanielQuestion(candidateText) &&
    !looksLikeScenarioCRepairWithUserAnswerEcho(candidateText)
  ) {
    return false;
  }
  if (
    opts?.repairSpokenThisStream ||
    opts?.repairProbeDeliveredRef ||
    transcriptAlreadyContainsScenarioCRepairQuestion(messages)
  ) {
    return true;
  }
  const lastUser = [...messages]
    .reverse()
    .find((m) => m.role === 'user' && (m.content ?? '').trim().length > 0)
    ?.content?.trim();
  if (lastUser && scenarioCUserAnswerHasSubstantiveRepairContent(lastUser)) {
    return true;
  }
  if (!scenarioCRepairConstructStillPending(messages)) {
    return true;
  }
  return false;
}

/** User answer already includes repair steps / prescriptions — skip redundant S3 repair Q2 inject. */
export function scenarioCUserAnswerHasSubstantiveRepairContent(text: string | null | undefined): boolean {
  const raw = (text ?? '').trim();
  if (!raw) return false;
  if (repairAnswerHasConcreteSuggestionActionOrStep(raw)) return true;
  const t = normalizeInterviewTypography(raw).replace(/\s+/g, ' ').trim().toLowerCase();
  if (countSpokenWords(raw) < 8) return false;
  const honestConversationRepair =
    /\b(honest|open|heart[- ]to[- ]heart|sit[- ]down|candid|direct)\s+(conversation|talk|discussion)\b/.test(
      t,
    ) &&
    /\b(repair|repaired|fix|resolve|work(?:ing)? through|situation)\b/.test(t);
  if (honestConversationRepair) return true;
  const danielLeavingPrescription =
    /\b(daniel|he)\s+(?:need|needs|must|should|has)\s+(?:to\s+)?(?:stop|quit)?\s*(?:leaving|leave|walking away|avoiding|withdrawing)\b/.test(
      t,
    ) || (/\b(?:stop|leaving|leave|walk(?:s|ing)? away)\b/.test(t) && /\b(?:daniel|he)\b/.test(t));
  const couplesRepairPath =
    /\b(they|both|the couple)\s+(?:need|needs|must|should)\s+(?:to\s+)?(?:figure out|understand|talk|communicat|repair|fix|resolve|work)\b/.test(
      t,
    );
  const explicitRepairOutcome =
    /\b(?:repair|repaired|be repaired|never be repaired|fix this|make it right|work(?:ing)? through)\b/.test(t);
  if (couplesRepairPath || danielLeavingPrescription) return true;
  return explicitRepairOutcome;
}

/** Substantive answer to Scenario C repair Q2 — used for S3→M4 advance when the model emits thin follow-ups. */
export function scenarioCUserAnswerSatisfiesRepairQuestionAnswer(text: string | null | undefined): boolean {
  const raw = (text ?? '').trim();
  if (!raw || isDecline(raw)) return false;
  return (
    repairAnswerHasConcreteSuggestionActionOrStep(raw) ||
    scenarioCUserAnswerHasSubstantiveRepairContent(raw)
  );
}

/**
 * Substantive S3 Q1 or Sophie-perspective prompt the user is answering — not infra (skip confirm,
 * meta invitation) that may sit between the probe and the latest user turn.
 */
export function resolveScenarioCRepairProbeAnchorAssistantContent(
  messages: readonly MessageWithScenario[],
  lastAssistantContent: string,
  lastQuestionText?: string | null,
): string | null {
  if (
    isScenarioCQ1Prompt(lastAssistantContent) ||
    looksLikeScenarioCSophiePerspectiveQuestion(lastAssistantContent)
  ) {
    return lastAssistantContent;
  }
  const trackedQuestion = (lastQuestionText ?? '').trim();
  if (
    trackedQuestion &&
    (isScenarioCQ1Prompt(trackedQuestion) ||
      looksLikeScenarioCSophiePerspectiveQuestion(trackedQuestion))
  ) {
    return trackedQuestion;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const content = (m.content ?? '').trim();
    if (isScenarioCQ1Prompt(content) || looksLikeScenarioCSophiePerspectiveQuestion(content)) {
      return content;
    }
  }
  return null;
}

/**
 * True once Sophie perspective was delivered or the user already inferred Sophie's experience
 * (e.g. in the Q1 answer). Repair Q2 must not run before this is satisfied.
 */
export function scenarioCSophiePerspectivePrerequisiteMet(
  messages: readonly MessageWithScenario[],
  pendingUserAnswer?: string,
): boolean {
  if (
    messages.some(
      (m) =>
        m.role === 'assistant' &&
        looksLikeScenarioCSophiePerspectiveQuestion((m.content ?? '').trim()),
    )
  ) {
    return true;
  }
  if (pendingUserAnswer && userAnswerHasSophiePerspectiveLanguage(pendingUserAnswer)) {
    return true;
  }
  let q1Index = -1;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m?.role === 'assistant' && isScenarioCQ1Prompt(m.content ?? '')) {
      q1Index = i;
    }
  }
  if (q1Index < 0) return false;
  for (let i = q1Index + 1; i < messages.length; i++) {
    const m = messages[i];
    if (m?.role === 'user' && userAnswerHasSophiePerspectiveLanguage(m.content ?? '')) {
      return true;
    }
  }
  return false;
}

/** True when transcript after `fromIndex` shows Moment 4+ personal gameplay (handoff, grudge, threshold, M5). */
function transcriptHasPersonalPartProgressAfterIndex(
  messages: readonly MessageWithScenario[],
  fromIndex: number,
): boolean {
  for (let i = fromIndex + 1; i < messages.length; i++) {
    const m = messages[i];
    if (typeof m.interviewMoment === 'number' && m.interviewMoment >= 4) {
      return true;
    }
    if (m.role !== 'assistant') continue;
    const c = m.content ?? '';
    if (looksLikeMoment4GrudgePrompt(c) || looksLikeMoment4ThresholdQuestion(c)) {
      return true;
    }
    if (assistantTextLooksLikeMoment4HandoffLead(c)) {
      return true;
    }
    if (/\b(?:held a grudge|really hard time with|got under your skin|two questions left)\b/i.test(c)) {
      return true;
    }
    if (transcriptAssistantContainsMoment5PrimaryConflictQuestion(c)) {
      return true;
    }
  }
  return false;
}

/** Repair Q2 still owed after Sophie perspective is satisfied (blocks premature S3→M4 advance). */
export function scenarioCRepairConstructStillPending(
  messages: readonly MessageWithScenario[],
): boolean {
  if (transcriptHasPersonalPartProgressAfterIndex(messages, -1)) {
    return false;
  }
  if (transcriptAlreadyContainsScenarioCRepairQuestion(messages)) {
    const hasScenarioCQ1InTranscript = messages.some(
      (m) => m.role === 'assistant' && isScenarioCQ1Prompt(m.content ?? ''),
    );
    const hasSophiePerspectiveProbeInTranscript = messages.some(
      (m) =>
        m.role === 'assistant' &&
        looksLikeScenarioCSophiePerspectiveQuestion((m.content ?? '').trim()),
    );
    if (
      (hasScenarioCQ1InTranscript || hasSophiePerspectiveProbeInTranscript) &&
      !scenarioCSophiePerspectivePrerequisiteMet(messages)
    ) {
      return true;
    }
    let repairAnchorIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      if (isScenarioCRepairAssistantPrompt(m.content ?? '')) {
        repairAnchorIndex = i;
        break;
      }
    }
    if (repairAnchorIndex < 0) return true;
    if (transcriptHasPersonalPartProgressAfterIndex(messages, repairAnchorIndex)) {
      return false;
    }
    const userTurnsAfterRepair = messages
      .slice(repairAnchorIndex + 1)
      .filter(
        (m) =>
          m.role === 'user' && (m.content ?? '').trim().length > 0 && !isDecline(m.content ?? ''),
      );
    if (userTurnsAfterRepair.length === 0) return true;
    /** Gameplay advanced past repair Q2 (e.g. grudge answer) even when repair-content heuristics miss. */
    if (userTurnsAfterRepair.length >= 2) {
      return false;
    }
    if (
      userTurnsAfterRepair.some((m) =>
        scenarioCUserAnswerHasSubstantiveRepairContent((m.content ?? '').trim()),
      )
    ) {
      return false;
    }
    return true;
  }
  if (!scenarioCSophiePerspectivePrerequisiteMet(messages)) {
    return true;
  }
  let anchorIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const content = m.content ?? '';
    if (isScenarioCQ1Prompt(content) || looksLikeScenarioCSophiePerspectiveQuestion(content)) {
      anchorIndex = i;
      break;
    }
  }
  if (anchorIndex < 0) return false;
  const userTurnsAfterAnchor = messages
    .slice(anchorIndex + 1)
    .filter(
      (m) => m.role === 'user' && (m.content ?? '').trim().length > 0 && !isDecline(m.content ?? ''),
    );
  if (userTurnsAfterAnchor.length === 0) {
    /** Sophie (or Q1) probe delivered — still waiting for the user's answer before repair/M4. */
    return true;
  }
  if (
    userTurnsAfterAnchor.some((m) =>
      scenarioCUserAnswerHasSubstantiveRepairContent((m.content ?? '').trim()),
    )
  ) {
    return false;
  }
  return true;
}

/** After S3 repair Q2 is satisfied, block Sophie-pattern replays — advance to M4 instead. */
export function shouldSuppressScenarioCSophiePerspectiveReplay(
  messages: readonly MessageWithScenario[],
): boolean {
  return !scenarioCRepairConstructStillPending(messages);
}

/** Force canonical Sophie perspective probe after substantive Scenario C Q1 when not yet delivered. */
export function shouldForceScenarioCSophiePerspectiveProbe(params: {
  currentMoment: number;
  currentScenario: number | null | undefined;
  messages: readonly MessageWithScenario[];
  lastAssistantContent: string;
  lastQuestionText?: string | null;
  userAnswer: string;
  suppressForcedConstructProbesForMetaFrustration: boolean;
  sophieProbeDelivered?: boolean;
}): boolean {
  if (params.sophieProbeDelivered) return false;
  if (params.suppressForcedConstructProbesForMetaFrustration) return false;
  if (params.currentMoment !== 3 || params.currentScenario !== 3) return false;
  if (isDecline(params.userAnswer)) return false;
  if (!scenarioCQ1InterpretationSatisfiedInTranscript(params.messages)) return false;
  if (scenarioCSophiePerspectiveProbeAlreadyDelivered(params.messages)) return false;
  if (scenarioCSophiePerspectiveAnsweredInTranscript(params.messages)) return false;
  if (userAnswerSatisfiesScenarioCSophiePerspectiveProbe(params.userAnswer)) return false;
  const anchor = resolveScenarioCRepairProbeAnchorAssistantContent(
    params.messages,
    params.lastAssistantContent,
    params.lastQuestionText,
  );
  if (!anchor || !isScenarioCQ1Prompt(anchor)) return false;
  if (transcriptAlreadyContainsScenarioCRepairQuestion(params.messages)) return false;
  return true;
}

/** Force canonical repair Q2 after a substantive answer to Scenario C Q1 or Sophie perspective. */
export function shouldForceScenarioCRepairProbe(params: {
  currentMoment: number;
  currentScenario: number | null | undefined;
  messages: readonly MessageWithScenario[];
  lastAssistantContent: string;
  lastQuestionText?: string | null;
  userAnswer: string;
  suppressForcedConstructProbesForMetaFrustration: boolean;
  /** Session ref: repair Q2 already passed to TTS this attempt (transcript may lag). */
  repairProbeDelivered?: boolean;
}): boolean {
  const repairStillPending = scenarioCRepairConstructStillPending(params.messages);
  if (params.repairProbeDelivered && !repairStillPending) return false;
  if (params.suppressForcedConstructProbesForMetaFrustration) return false;
  if (params.currentMoment !== 3 || params.currentScenario !== 3) return false;
  if (isDecline(params.userAnswer)) return false;
  if (scenarioCUserAnswerHasSubstantiveRepairContent(params.userAnswer)) return false;
  const anchor = resolveScenarioCRepairProbeAnchorAssistantContent(
    params.messages,
    params.lastAssistantContent,
    params.lastQuestionText,
  );
  if (!anchor) return false;
  if (transcriptAlreadyContainsScenarioCRepairQuestion(params.messages) && !repairStillPending) {
    return false;
  }
  if (
    !scenarioCSophiePerspectiveProbeAlreadyDelivered(params.messages) &&
    !scenarioCSophiePerspectiveAnsweredInTranscript(params.messages) &&
    !userAnswerSatisfiesScenarioCSophiePerspectiveProbe(params.userAnswer)
  ) {
    return false;
  }
  if (
    !scenarioCSophiePerspectivePrerequisiteMet(params.messages, params.userAnswer)
  ) {
    return false;
  }
  return true;
}

/** True when the assistant turn is Scenario C Q1 (interpret Daniel's line), not Q2/repair/threshold. */
export function isScenarioCQ1Prompt(text: string): boolean {
  const t = normalizeInterviewTypography(text).replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 12) return false;
  if (/\bhow do you think this situation could be repaired\b/.test(t)) return false;
  if (/\bat what point would you say daniel or sophie\b/.test(t)) return false;
  if (t.includes("isn't working") && t.includes('daniel') && t.includes('sophie')) return false;
  const quotesDanielReturnLine =
    t.includes("didn't know what to say") ||
    t.includes('did not know what to say') ||
    t.includes("didn't know how") ||
    t.includes('did not know how');
  return t.includes('what do you make of') && quotesDanielReturnLine;
}

export function transcriptContainsScenarioCQ1Prompt(
  messages: readonly MessageWithScenario[],
): boolean {
  return messages.some(
    (m) => m.role === 'assistant' && isScenarioCQ1Prompt((m.content ?? '').trim()),
  );
}

/** True when any assistant turn already delivered the Sophie/Daniel vignette body. */
export function transcriptContainsScenario3VignetteSetup(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
): boolean {
  return messages.some(
    (m) => m.role === 'assistant' && textContainsScenarioCVignetteBody(m.content ?? ''),
  );
}

/** S2→S3 handoff deferral applies only during the S2 boundary — not when S3 is already active. */
export function shouldDeferS2ToS3HandoffForSuppressedS3Q1(args: {
  currentScenario: number | null | undefined;
  effectiveActiveScenario: number | null;
}): boolean {
  return args.currentScenario !== 3 && args.effectiveActiveScenario !== 3;
}

/** Skip replaying the S2→S3 handoff bundle when Sophie/Daniel is already in progress. */
export function shouldSkipS2ToS3HandoffReplayAtStreamEnd(args: {
  currentScenario: number | null | undefined;
  messages: ReadonlyArray<{ role: string; content?: string | null }>;
}): boolean {
  if (args.currentScenario === 3) return true;
  return transcriptContainsScenario3VignetteSetup(args.messages);
}

/**
 * Block streaming S3 Q1 until the setup narrative was spoken or is present in the transcript.
 * Prevents jumping straight to Daniel's return line without Sophie/Daniel context.
 */
export function shouldSuppressScenarioCQ1UntilVignetteSetup(args: {
  spoken: string;
  fullStreamText: string;
  spokenCompleteText: string;
  messages: ReadonlyArray<{ role: string; content?: string | null }>;
}): boolean {
  const spoken = (args.spoken ?? '').trim();
  if (!spoken) return false;
  const isQ1Lead =
    isScenarioCQ1Prompt(spoken) || looksLikeScenarioCDanielComeBackMisparaphraseQuestion(spoken);
  if (!isQ1Lead) return false;
  if (textContainsScenarioCVignetteBody(args.fullStreamText)) return false;
  if (textContainsScenarioCVignetteBody(args.spokenCompleteText)) return false;
  if (transcriptContainsScenario3VignetteSetup(args.messages)) return false;
  return true;
}

/** User already took a turn after Q1 was delivered (including truncated / partial answers). */
export function scenarioCQ1HasUserResponseAfterDelivery(
  messages: readonly MessageWithScenario[],
): boolean {
  let q1Index = -1;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m?.role === 'assistant' && isScenarioCQ1Prompt(m.content ?? '')) {
      q1Index = i;
    }
  }
  if (q1Index < 0) return false;
  return messages.slice(q1Index + 1).some((m) => {
    if (m.role !== 'user') return false;
    if ((m as { isWelcomeBack?: boolean }).isWelcomeBack) return false;
    return countSpokenWords((m.content ?? '').trim()) >= 2;
  });
}

/** Block verbatim Q1 replay once the user has already attempted an answer. */
export function shouldSuppressScenarioCQ1VerbatimReplay(
  messages: readonly MessageWithScenario[],
  candidateText: string,
): boolean {
  if (!isScenarioCQ1Prompt(candidateText)) return false;
  if (!transcriptContainsScenarioCQ1Prompt(messages)) return false;
  return scenarioCQ1HasUserResponseAfterDelivery(messages);
}

/** User gave an interpretive read on Daniel's line (not logistics-only repair prescription). */
export function userAnswerSatisfiesScenarioCQ1Interpretation(text: string | null | undefined): boolean {
  const raw = (text ?? '').trim();
  if (!raw || isDecline(raw)) return false;
  if (countSpokenWords(raw) < 8) return false;
  return !isMisplacedScenarioCQ1Answer(raw);
}

/** Any Scenario C user turn already interpreted Daniel's return line — Q1 should not replay. */
export function scenarioCQ1InterpretationSatisfiedInTranscript(
  messages: readonly MessageWithScenario[],
): boolean {
  let q1Index = -1;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m?.role === 'assistant' && isScenarioCQ1Prompt(m.content ?? '')) {
      q1Index = i;
    }
  }
  if (q1Index >= 0) {
    const satisfiedAfterQ1 = messages.slice(q1Index + 1).some((m) => {
      if (m.role !== 'user') return false;
      if ((m as { isWelcomeBack?: boolean }).isWelcomeBack) return false;
      return userAnswerSatisfiesScenarioCQ1Interpretation(m.content ?? '');
    });
    if (satisfiedAfterQ1) return true;
  }
  return messages
    .filter((m) => m.role === 'user' && (m.scenarioNumber ?? 0) === 3)
    .some((m) => userAnswerSatisfiesScenarioCQ1Interpretation(m.content ?? ''));
}

/** Next scripted S3 probe after Q1 interpretation is satisfied (Sophie perspective, then repair Q2). */
export function resolveScenarioCNextProbeAfterSatisfiedQ1(
  messages: readonly MessageWithScenario[],
): string {
  const sophieProbeAsked = scenarioCSophiePerspectiveProbeAlreadyDelivered(messages);
  const sophieAnswered = scenarioCSophiePerspectiveAnsweredInTranscript(messages);
  const sophieInferred = messages.some(
    (m) => m.role === 'user' && userAnswerHasSophiePerspectiveLanguage(m.content ?? ''),
  );
  if (!sophieProbeAsked && !sophieAnswered && !sophieInferred) {
    return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
  }
  return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
}

/** Coerce the next scripted S3 probe for parallel-stream TTS after Q1 interpretation. */
export function coerceScenarioCNextProbeForStreamTts(
  messages: readonly MessageWithScenario[],
): string {
  const next = resolveScenarioCNextProbeAfterSatisfiedQ1(messages);
  if (isScenarioCRepairAssistantPrompt(next)) {
    return coerceScenarioCRepairQuestionForTts(next);
  }
  return coerceScenarioCSophiePerspectiveQuestionForTts(next);
}

/**
 * User answered Q1 with repair/logistics/next-steps rather than interpreting Daniel's internal state
 * or the meaning of his return line ("I didn't know what to say"; legacy transcripts may say "I didn't know how").
 */
export function isMisplacedScenarioCQ1Answer(text: string): boolean {
  const t = normalizeInterviewTypography(text).replace(/\s+/g, ' ').trim();
  if (t.length < 40) return false;

  /** User engaged the quoted prompt line or a clear "what that line means" read — not only prescriptions. */
  const referencesDanielPromptLine =
    /\b(i |he |she |they )?didn'?t know what to say\b/i.test(t) ||
    /\b(i |he |she |they )?didn'?t know how\b/i.test(t) ||
    /\bwhat (that |he |daniel )?(line|said|means?|meant)\b/i.test(t) ||
    /\bwhen (daniel |he )(comes back |says|said )\b/i.test(t) ||
    /\b(that|those) words\b/i.test(t);

  const danielInternalRead =
    /\b(daniel|he)('?s| is| was| felt| seems| sounds| means| meant)\b/i.test(t) ||
    /\b(his|him) (own|inner|shame|fear|anxiety|avoidance|struggle|vulnerability|emotion|state|head|heart)\b/i.test(
      t
    ) ||
    /\b(meaning|read|interpretation) (of|is|that)|what (that|he) mean|what (that|it) (says|tells|signals|shows)\b/i.test(
      t
    ) ||
    /\b(where he'?s at|what he'?s going through|going on (for|with) him|in his (shoes|position))\b/i.test(t) ||
    /\b(overwhelmed|ashamed|embarrassed|stuck|lost|flooded|shut down|shutdown|vulnerable|raw|defensive|avoidant|withdraw|withdrawing)\b/i.test(
      t
    ) ||
    /\b(didn'?t know what to say|didn'?t know how (to|what)|lack(ed|s)? (the )?(skills|tools|words)|capacity|limitation|learning|growth|trying|effort|intent)\b/i.test(
      t
    ) ||
    /\b(remorse|guilt|shame)\b/i.test(t);

  if (danielInternalRead) return false;

  const prescriptiveDanielSophie =
    /\b(daniel|sophie)\s+(needs? to|has to|must)\b/i.test(t) || /\bdaniel should\b/i.test(t);

  const relationshipVerdictOrThreshold =
    /\b(relationship (is )?(not )?working|whether (this |the )?relationship|walk away|end (the relationship|it)|seriously consider|fourth time|third time|one more time|without real change|deal[- ]?breaker)\b/i.test(
      t
    );

  if (!referencesDanielPromptLine && (prescriptiveDanielSophie || relationshipVerdictOrThreshold)) {
    return true;
  }

  const logisticsOrRepairNextSteps =
    /\b(they should|the couple (should|needs to)|both (need|should) to|sophie and daniel should|next step|action plan|ground rules|start by|begin by|sit down (and|to)|schedule|couples therapy|therapy|mediat|take turns|check[- ]?ins?\b|communicate better|talk it out|work (it|this) out|resolve (this|it)|repair (this|the|their)|how (they|we) (could|should|can) (fix|repair|handle)|patch things|make a plan|come up with|agree on|structure|boundar(y|ies))\b/i.test(
      t
    );

  return logisticsOrRepairNextSteps;
}

export function textContainsScenarioCVignetteBody(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  return (
    /\bsophie and daniel\b/.test(t) &&
    /i need ten minutes/.test(t) &&
    (/i didn'?t know what to say|did not know what to say|i didn'?t know how|did not know how/.test(t) ||
      /\bstill upset\b/.test(t))
  );
}

/**
 * Situation 2→3 delivery (canonical or paraphrased) must not advance interview progress to Moment 4.
 * Otherwise a sloppy [SCENARIO_COMPLETE:2] model turn that jumps to personal/grudge language can skip Sophie/Daniel.
 */
export function assistantTextBlocksMoment4ProgressInference(text: string): boolean {
  if (textContainsScenarioCVignetteBody(text)) return true;
  if (assistantTextIsPrematureMoment4HandoffDuringScenarioC(text)) return true;
  const t = (text ?? '').toLowerCase();
  if (t.includes(SCENARIO_2_TO_3_TRANSITION_FALLBACK.toLowerCase())) return true;
  if (t.includes("here's the third situation") || t.includes('here the third situation')) return true;
  if (t.includes('third situation') && (t.includes('more personal') || t.includes('two questions'))) return true;
  return false;
}

/** Moment 4: a personal grudge answer with any narrative substance — used for scoring helpers, not to gate the threshold probe. */
export function hasMoment4PersonalNarrativeEngagement(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 25) return false;
  return /\b(i|my|me|we|our|us)\b/i.test(t);
}

/** Scenario C Q2 (repair) — delegates to shared matcher so paraphrases still gate threshold forcing. */
export function isScenarioCQ2Prompt(text: string): boolean {
  return isScenarioCRepairAssistantPrompt(text);
}
