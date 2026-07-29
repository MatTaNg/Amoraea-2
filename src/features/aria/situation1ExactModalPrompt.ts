type ScenarioModalTranscriptTurn = { role: string; content?: string | null };

import { isIrrelevantAnswerRetryAssistantLine } from '@features/aria/interviewAnswerRelevance';
import { getLastSubstantiveScenarioModalQuestion } from '@features/aria/interviewScenarioModalPrompt';
import {
  detectActiveScenarioFromMessage,
  normalizeScenarioOpeningForCompare,
  SCENARIO_1_OPENING,
} from '@features/aria/interviewScenarioOpeningStreamGate';
import {
  SHOW_SCENARIO_1_OPENING_EXACT,
  SHOW_SCENARIO_1_VIGNETTE_EXACT,
} from '@features/aria/interviewShowScenarioExactCopy';
import { buildScenario1VignetteIntroBundle } from '@features/aria/interviewTransitionBundles';
import {
  looksLikeScenarioAContemptProbeQuestion,
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '@features/aria/probeAndScoringUtils';
import {
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairStreamFragment,
} from '@features/aria/scenarioARepairQuestionHelpers';
import {
  looksLikeScenarioBJamesDifferentlyQuestion,
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';

/** Model meta-narration instead of the Situation 1 vignette (often after tab restore / readiness). */
export function looksLikeScenario1MetaPlayNarration(text: string | null | undefined): boolean {
  const t = (text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'");
  if (!t) return false;
  if (/\bemma and ryan\b/.test(t) || /\bryan takes a call\b/.test(t)) return false;
  if (/\bplay\s+situation\s*1\b/.test(t)) return true;
  if (/\b(will|going to|gonna)\s+(now\s+)?(play|start|begin)\s+situation\s*1\b/.test(t)) return true;
  if (/\b(app|i|we|amoraea)\b[\s\S]{0,40}\b(now\s+)?play\b[\s\S]{0,40}\bsituation\s*1\b/.test(t)) {
    return true;
  }
  if (
    /\bhere(?:'s| is)\s+(?:the\s+)?(?:first\s+)?situation\b/.test(t) &&
    t.length < 90 &&
    !/\bemma\b/.test(t) &&
    !/\bryan\b/.test(t)
  ) {
    return true;
  }
  return false;
}

/** Replace Situation 1 meta-play filler with the client-owned vignette + opening. */
export function coerceScenario1MetaPlayNarrationForTts(text: string): string {
  if (!looksLikeScenario1MetaPlayNarration(text)) return text;
  return buildScenario1VignetteIntroBundle(SHOW_SCENARIO_1_VIGNETTE_EXACT, SHOW_SCENARIO_1_OPENING_EXACT);
}

/** Emma coaching / mentalizing paraphrases — match with or without trailing `?` (streaming may cut mid-sentence). */
export function looksLikeScenarioAEmmaCoachingParaphrase(text: string | null | undefined): boolean {
  const t = (text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'");
  if (!t) return false;
  if (looksLikeScenarioAContemptProbeQuestion(text ?? '')) return false;
  if (looksLikeScenarioARepairQuestion(text ?? '')) return false;
  if (looksLikeScenarioARepairStreamFragment(text ?? '')) return false;
  if (/\bhow do you think emma\b/.test(t)) return true;
  if (/\bwhat do you think emma\b/.test(t) && !/\b(very clear|made that very clear)\b/.test(t)) {
    return true;
  }
  if (/\bwhat do you make of emma\b/.test(t) && !/\b(very clear|made that very clear)\b/.test(t)) {
    return true;
  }
  return false;
}

/** Model paraphrases that must never appear in the Situation 1 Show scenario footer. */
export function isScenarioANonScriptedModalParaphrase(text: string | null | undefined): boolean {
  const t = (text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'");
  if (!t) return false;
  if (looksLikeScenarioAEmmaCoachingParaphrase(text)) return true;
  if (looksLikeScenarioAContemptProbeQuestion(text ?? '')) return false;
  if (looksLikeScenarioARepairQuestion(text ?? '')) return false;
  if (looksLikeScenarioARepairStreamFragment(text ?? '')) return false;
  if (t.includes("what's going on between these two")) return false;
  if (!t.includes('?')) return false;
  if (/\bwhat do you think is (?:actually )?going on for ryan\b/.test(t)) return true;
  if (/\bso what do you think is (?:actually )?going on for ryan\b/.test(t)) return true;
  if (/\bwhat(?:'s| is) (?:actually )?going on for ryan\b/.test(t)) return true;
  if (/\bwhat do you think.*\bryan\b.*\b(?:in that moment|right then|at that moment)\b/.test(t)) {
    return true;
  }
  if (/\bwhen emma says\b/.test(t) && !/\b(very clear|made that very clear)\b/.test(t)) return true;
  if (/\bhow would (?:ryan|he) respond\b/.test(t)) return true;
  if (/\bwhat (?:ryan|he) would (?:do or say|do|say)\b/.test(t)) return true;
  if (/\bjust say whatever comes to mind\b/.test(t) && /\b(?:ryan|he)\b/.test(t)) return true;
  /** Scenario B-style preventive ask — not on the Scenario A question list. */
  if (/\bryan\b/.test(t) && /\b(could'?ve done differently|could have done differently|done differently)\b/.test(t)) {
    return true;
  }
  if (/\bbefore emma\b/.test(t) && /\b(done differently|could have done|could'?ve done|avoid)\b/.test(t)) {
    return true;
  }
  if (/\bto avoid this getting\b/.test(t) && /\bryan\b/.test(t)) return true;
  return false;
}

/** Remove non-scripted Situation 1 modal / coaching paragraphs from a multi-paragraph assistant draft. */
export function stripScenarioANonScriptedParaphraseParagraphs(text: string): string {
  if (!text?.trim()) return text;
  const kept = text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isScenarioANonScriptedModalParaphrase(part));
  return kept.join('\n\n').trim();
}

function scopedSituation1AssistantTurns(transcript: ScenarioModalTranscriptTurn[]): ScenarioModalTranscriptTurn[] {
  let anchorIdx = -1;
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i]?.role !== 'assistant') continue;
    const detected = detectActiveScenarioFromMessage((transcript[i]?.content ?? '').trim());
    if (detected?.label === 'Situation 1') {
      anchorIdx = i;
      break;
    }
  }
  return anchorIdx >= 0 ? transcript.slice(anchorIdx) : transcript;
}

export type Situation1ModalDeliveryState = {
  contemptProbeAsked?: boolean;
  repairQuestionAsked?: boolean;
};

/** True when Situation 1 modal must not revert to the opening question (vignette replay / late canonical TTS). */
export function isSituation1ModalAdvancedPastOpening(
  delivery?: Situation1ModalDeliveryState | null,
  lastQuestionText?: string | null,
): boolean {
  if (delivery?.repairQuestionAsked || delivery?.contemptProbeAsked) return true;
  const last = (lastQuestionText ?? '').trim();
  if (!last) return false;
  return (
    looksLikeScenarioARepairQuestion(last) ||
    looksLikeScenarioARepairStreamFragment(last) ||
    looksLikeScenarioAContemptProbeQuestion(last)
  );
}

/**
 * Situation 1 Show scenario footer — exact scripted copy only (opening → contempt → repair).
 * Never surfaces model paraphrases in the modal.
 */
function resolveSituation1ModalPromptFromSubstantiveQuestion(question: string): string | null {
  const q = question.trim();
  if (!q) return null;
  if (looksLikeScenarioARepairQuestion(q) || looksLikeScenarioARepairStreamFragment(q)) {
    return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
  }
  if (looksLikeScenarioAContemptProbeQuestion(q)) {
    return SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
  }
  if (normalizeScenarioOpeningForCompare(q) === normalizeScenarioOpeningForCompare(SCENARIO_1_OPENING)) {
    return SCENARIO_1_OPENING;
  }
  return null;
}

export function resolveSituation1ExactModalPrompt(
  transcript: ScenarioModalTranscriptTurn[],
  currentSpoken?: string | null,
  delivery?: Situation1ModalDeliveryState | null,
): string {
  const spoken = (currentSpoken ?? '').trim();
  if (spoken && !isIrrelevantAnswerRetryAssistantLine(spoken)) {
    const fromSpoken = resolveSituation1ModalPromptFromSubstantiveQuestion(spoken);
    if (fromSpoken) return fromSpoken;
  }

  const scoped = scopedSituation1AssistantTurns(transcript);
  const lastSubstantive = getLastSubstantiveScenarioModalQuestion(scoped);
  if (lastSubstantive) {
    const fromTranscript = resolveSituation1ModalPromptFromSubstantiveQuestion(lastSubstantive);
    if (fromTranscript && fromTranscript !== SCENARIO_1_OPENING) {
      return fromTranscript;
    }
  }

  if (delivery?.repairQuestionAsked) {
    return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
  }
  if (delivery?.contemptProbeAsked) {
    return SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
  }

  if (lastSubstantive) {
    const fromTranscript = resolveSituation1ModalPromptFromSubstantiveQuestion(lastSubstantive);
    if (fromTranscript) return fromTranscript;
  }

  return SCENARIO_1_OPENING;
}

export function coerceExactScenarioModalQuestionDisplay(
  q: string | null | undefined,
  scenarioLabel?: string | null,
): string | null {
  const raw = (q ?? '').trim();
  if (!raw) return null;
  if (scenarioLabel === 'Situation 1' && isScenarioANonScriptedModalParaphrase(raw)) {
    return null;
  }
  if (looksLikeScenarioAContemptProbeQuestion(raw)) {
    return SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
  }
  if (looksLikeScenarioARepairQuestion(raw) || looksLikeScenarioARepairStreamFragment(raw)) {
    return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
  }
  if (looksLikeScenarioBJamesDifferentlyQuestion(raw)) {
    return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  }
  return raw;
}
