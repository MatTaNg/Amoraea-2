import { isScenarioModalPureTransitionTurn } from './interviewLanguageGate';
import { assistantTextLooksLikeMoment4HandoffLead } from './interviewTransitionBundles';
import {
  completedScenarioForEmotionModalFromTransition,
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
} from './emotionScenarioTransitionInference';
import { scenarioAMinimumEngagementForHandoff } from './scenarioFollowUpTranscriptGuard';

export type PendingEmotionModalTransition = {
  completedScenario: 1 | 2 | 3;
  afterModal: string;
  transitionText: string;
  priorScenario: 1 | 2 | 3 | null;
};

const EMOTION_MODAL_CLOSING_QUESTION_PATTERNS = [
  'is there anything about that situation',
  "anything you'd want me to know",
  "anything about that situation you'd want me to know",
  "anything you'd want to add before we move on",
  'anything else about that one before',
  'before we move on',
  'before we move forward',
  "anything you'd want me to understand",
  'anything else about that one you',
  'before we go to the next one',
] as const;

function textIsEmotionModalClosingQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return EMOTION_MODAL_CLOSING_QUESTION_PATTERNS.some((p) => t.includes(p));
}

/**
 * Client bundles use `\n\n` between the spoken transition lead and the next vignette / personal card.
 * Speak `beforeModal` first, show the emotion modal, then speak `afterModal` when non-empty.
 *
 * Model streams often omit `\n\n`; fall back to a line break before canonical vignette / handoff openers
 * so {@link splitScenarioTransitionForEmotionModal} still yields a non-empty `afterModal` when possible.
 */
/** Inline handoff openers when the model omits blank lines between wrap and next segment. */
const INLINE_EMOTION_MODAL_NEXT_SEGMENT_MARKERS: readonly RegExp[] = [
  /here'?s the next situation\s*:/i,
  /here'?s the third situation\s*:/i,
  /on to the second situation/i,
  /on to the third situation/i,
  /after this we(?:'|’)ll shift to something more personal/i,
  /before we shift to something more personal/i,
  /now we'?ll shift to something more personal/i,
  /now let'?s shift to something more personal/i,
  /there are only two questions left/i,
  /have you ever held a grudge/i,
  /think of someone you(?:'|’)ve had a really hard time with/i,
  /got under your skin/i,
  /\bhave you ever\b/i,
  /\bsarah has been job hunting\b/i,
  /\bsophie and daniel have had\b/i,
  /\bsophie and daniel\b/i,
];

export function splitScenarioTransitionForEmotionModal(fullText: string): {
  beforeModal: string;
  afterModal: string;
} {
  const t = fullText.trim();
  const ix = t.indexOf('\n\n');
  if (ix !== -1) {
    return { beforeModal: t.slice(0, ix).trim(), afterModal: t.slice(ix + 2).trim() };
  }
  /** First substantial line that starts the next segment (Situation 2/3 vignette or personal card). */
  const vignetteStart =
    /\n+(?=Sarah has been\b|Sophie and Daniel\b|There are only two questions left\b|Have you ever held a grudge\b|Think of someone you(?:'|’)ve had\b|Personal reflection\b|Situation [23]\b)/i;
  const m = vignetteStart.exec(t);
  if (m != null && m.index >= 24) {
    return {
      beforeModal: t.slice(0, m.index).trim(),
      afterModal: t.slice(m.index).replace(/^\n+/, '').trim(),
    };
  }
  let inlineSplitAt = -1;
  for (const marker of INLINE_EMOTION_MODAL_NEXT_SEGMENT_MARKERS) {
    const inline = marker.exec(t);
    if (inline != null && inline.index >= 24) {
      inlineSplitAt = inlineSplitAt < 0 ? inline.index : Math.min(inlineSplitAt, inline.index);
    }
  }
  if (inlineSplitAt >= 0) {
    return {
      beforeModal: t.slice(0, inlineSplitAt).trim(),
      afterModal: t.slice(inlineSplitAt).trim(),
    };
  }
  return { beforeModal: t, afterModal: '' };
}

/**
 * Defer the emotion modal when the transition turn still owes an in-scenario answer
 * (e.g. repair-as-James bundled with S2→S3 handoff). Closing-question turns defer to the
 * closing-answer intercept; pure wrap transitions run the modal immediately.
 */
export function shouldDeferEmotionModalForTransitionText(transitionText: string): boolean {
  const t = (transitionText ?? '').trim();
  if (!t) return false;
  if (textIsEmotionModalClosingQuestion(t)) return true;

  const { beforeModal } = splitScenarioTransitionForEmotionModal(t);
  const before = beforeModal.trim();
  if (!before) return false;
  if (textIsEmotionModalClosingQuestion(before)) return true;
  if (isScenarioModalPureTransitionTurn(before)) return false;
  if (before.includes('?')) return true;

  return false;
}

function wrapHandoffCoreText(text: string): string {
  const t = (text ?? '').trim();
  const repairIx = t.search(/\bhow would you repair\b/i);
  if (repairIx >= 48) return t.slice(0, repairIx).trim();
  const ryanIx = t.search(/\b(?:what if|and if|so if|if) you were ryan\b/i);
  if (ryanIx >= 48) return t.slice(0, ryanIx).trim();
  return t;
}

/** Shared wrap / boundary phrases for emotion modal and post-Claude strip guards. */
export function hasScenarioBoundaryWrapPhrase(text: string): boolean {
  const lower = (text ?? '').trim().toLowerCase();
  if (!lower) return false;
  return (
    lower.includes("that's the end of this scenario") ||
    lower.includes("that's the end of that scenario") ||
    lower.includes("that's the end of this situation") ||
    lower.includes("that's the end of that situation") ||
    lower.includes('end of this situation') ||
    lower.includes('end of that situation') ||
    lower.includes('end of the three described situations') ||
    lower.includes('end of the three situations') ||
    /\bend of (?:the )?three (?:described )?situations\b/.test(lower) ||
    lower.includes("that's the end of situation three") ||
    lower.includes("that's the end of situation 3") ||
    /\bthat'?s the end of situation (?:one|two|three|[123])\b/.test(lower) ||
    /\bend of situation (?:one|two|three|[123])\b/.test(lower) ||
    lower.includes("that's a wrap on this situation") ||
    lower.includes("that's a wrap on that one") ||
    lower.includes("that's a wrap on this one") ||
    lower.includes('second one done') ||
    lower.includes("we've got two more situations") ||
    lower.includes("one more situation and then we'll get personal") ||
    lower.includes("that's all for that situation") ||
    lower.includes("that's all for this situation") ||
    lower.includes("that's all for this one") ||
    /\bthat'?s a wrap on situation [123]\b/.test(lower) ||
    (lower.includes("that's a wrap") && /\b(?:great|nice) work\b/i.test(lower)) ||
    lower.includes('great work getting through all of this') ||
    lower.includes('thanks for working through that one') ||
    lower.includes('thanks for going deep') ||
    /\bthat scenario'?s done\b/.test(lower) ||
    /\bthis scenario'?s done\b/.test(lower) ||
    /\bthat situation'?s done\b/.test(lower) ||
    /\bthis situation'?s done\b/.test(lower) ||
    /\bgood work on that one\b/.test(lower) ||
    /\bwraps up the three situation/.test(lower) ||
    /\bthat wraps up the three situation/.test(lower) ||
    /\bwraps up the third situation/.test(lower) ||
    /\bthat wraps up the third situation/.test(lower) ||
    /\bwraps up the (?:first|second|third) situation/.test(lower) ||
    /\bthat wraps up the (?:first|second) situation/.test(lower) ||
    /\b(?:that )?wraps up (?:this|that) situation\b/.test(lower) ||
    /\b(?:situation|that situation)\s+[123]\s+(?:is\s+)?wrap(?:ped)?\s+up\b/.test(lower) ||
    /\bthat'?s situation\s+[123]\s+wrap(?:ped)?\s+up\b/.test(lower) ||
    /\bthat'?s situation\s+[123]\s+done\b/.test(lower) ||
    /\bsituation\s+[123]\s+done\b/.test(lower)
  );
}

function hasScenarioWrapReflectionWithoutNextSegment(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\bhow would you repair\b/i.test(lower)) return false;
  if (/\bwhat if you were ryan\b/i.test(lower)) return false;
  return (
    /\b(?:nice|great) work\b/i.test(lower) ||
    /\byou (?:read|saw|noticed|focused|picked up)\b/i.test(lower) ||
    lower.includes('thanks for working through')
  );
}

/**
 * Natural-language S1→S2 / S2→S3 handoffs (no `[SCENARIO_COMPLETE:N]`).
 * Parallel streaming may advance `currentScenarioRef` before the post-stream handler runs.
 */
export function isNaturalLanguageScenarioHandoffTransition(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t || t.length < 48) return false;
  const core = wrapHandoffCoreText(t);
  if (!hasScenarioBoundaryWrapPhrase(core)) return false;
  if (
    INLINE_EMOTION_MODAL_NEXT_SEGMENT_MARKERS.some((re) => re.test(t)) ||
    textContainsScenarioBVignetteBody(t) ||
    textContainsScenarioCVignetteBody(t) ||
    assistantTextLooksLikeMoment4HandoffLead(t)
  ) {
    return true;
  }
  return hasScenarioWrapReflectionWithoutNextSegment(core);
}

/** S3 complete → Moment 4 personal card (no `detectScenarioFromResponse` — M4 is not scenario 4). */
export function isScenarioThreeToMoment4EmotionModalHandoff(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  return (
    lower.includes('end of the three described situations') ||
    assistantTextLooksLikeMoment4HandoffLead(t) ||
    (lower.includes('shift to something more personal') && /\bhave you ever\b/i.test(lower))
  );
}

/** Whether to show the emotion modal on a natural-language scenario boundary (no completion token). */
export function resolveNaturalLanguageEmotionModalGate(params: {
  displayText: string;
  priorScenario: 1 | 2 | 3;
  detectedScenario: 1 | 2 | 3 | null;
  messages?: ReadonlyArray<{ role: string; content?: string | null }>;
}): {
  emotionNaturalForward: boolean;
  completedScenario: 1 | 2 | 3 | null;
  deferBlocked: boolean;
} {
  const { displayText, priorScenario, detectedScenario, messages } = params;
  const emotionSplit = splitScenarioTransitionForEmotionModal(displayText);
  const deferEmotionModal = shouldDeferEmotionModalForTransitionText(displayText);
  const deferBlocked = deferEmotionModal && !emotionSplit.afterModal.trim();
  const blockPrematureScenarioOneHandoff =
    messages != null &&
    !scenarioAMinimumEngagementForHandoff(messages) &&
    (priorScenario === 1 ||
      textContainsScenarioBVignetteBody(displayText) ||
      isNaturalLanguageScenarioHandoffTransition(displayText));
  /** Repair / in-scenario question bundled before handoff — wait for user answer before scoring or modal. */
  if (deferEmotionModal && emotionSplit.afterModal.trim()) {
    return { emotionNaturalForward: false, completedScenario: null, deferBlocked: false };
  }
  if (deferBlocked) {
    return { emotionNaturalForward: false, completedScenario: null, deferBlocked };
  }

  if (isScenarioThreeToMoment4EmotionModalHandoff(displayText)) {
    return { emotionNaturalForward: true, completedScenario: 3, deferBlocked };
  }

  /** Stale S1→S2 handoff text must not regress emotion modal when interview is already past Scenario 3. */
  if (
    priorScenario === 3 &&
    textContainsScenarioBVignetteBody(displayText) &&
    !assistantTextLooksLikeMoment4HandoffLead(displayText)
  ) {
    return { emotionNaturalForward: false, completedScenario: null, deferBlocked: false };
  }

  const handoff = isNaturalLanguageScenarioHandoffTransition(displayText);
  if (handoff) {
    const declared =
      detectedScenario != null && detectedScenario > priorScenario
        ? ((detectedScenario - 1) as 1 | 2 | 3)
        : priorScenario;
    const completed = completedScenarioForEmotionModalFromTransition({
      declaredComplete: declared,
      transitionText: displayText,
      priorScenario,
    });
    if (completed === 1 && blockPrematureScenarioOneHandoff) {
      return { emotionNaturalForward: false, completedScenario: null, deferBlocked: false };
    }
    return { emotionNaturalForward: true, completedScenario: completed, deferBlocked };
  }

  if (
    detectedScenario !== null &&
    detectedScenario > priorScenario &&
    detectedScenario <= 3 &&
    priorScenario >= 1 &&
    priorScenario <= 3
  ) {
    const declared = (detectedScenario - 1) as 1 | 2 | 3;
    const completed = completedScenarioForEmotionModalFromTransition({
      declaredComplete: declared,
      transitionText: displayText,
      priorScenario,
    });
    if (completed === 1 && blockPrematureScenarioOneHandoff) {
      return { emotionNaturalForward: false, completedScenario: null, deferBlocked: false };
    }
    return { emotionNaturalForward: true, completedScenario: completed, deferBlocked };
  }

  return { emotionNaturalForward: false, completedScenario: null, deferBlocked };
}

/** After resume catch-up for modal index 2, speak only the post-modal segment (not the full handoff). */
export function extractEmotionAfterModalForResumeCatchUp(
  transcriptMessages: ReadonlyArray<{ role: string; content?: string }>,
  catchUpIndices: readonly number[],
): string | null {
  if (!catchUpIndices.includes(2)) return null;
  for (let i = transcriptMessages.length - 1; i >= 0; i--) {
    const m = transcriptMessages[i];
    if (m?.role !== 'assistant') continue;
    const content = m.content ?? '';
    if (!/three described|grudge|two questions|more personal/i.test(content)) continue;
    const { afterModal } = splitScenarioTransitionForEmotionModal(content);
    if (afterModal.trim().length >= 20) return afterModal;
  }
  return null;
}
