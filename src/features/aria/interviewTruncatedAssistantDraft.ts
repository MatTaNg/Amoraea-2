import { coerceScenarioBoundaryHandoffDisplayText } from '@features/aria/coerceScenarioBoundaryHandoffDisplayText';
import { textContainsScenarioBVignetteBody, textContainsScenarioCVignetteBody } from '@features/aria/emotionScenarioTransitionInference';
import {
  isScenarioThreeToMoment4EmotionModalHandoff,
  splitScenarioTransitionForEmotionModal,
} from '@features/aria/emotionModalTransitionOrchestration';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { applyPostClaudeScenarioAdvanceBundleOverride } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import {
  shouldAdvanceScenarioAAfterSatisfiedRepair,
  shouldAdvanceScenarioBAfterSatisfiedRepair,
} from '@features/aria/interviewRepairRefusalDetection';
import {
  buildMoment4ThresholdProbeWithReflection,
  coerceMoment4ThresholdQuestionForTts,
  looksLikeMoment4GrudgePrompt,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
} from '@features/aria/moment4ProbeLogic';
import {
  coerceMoment4SpecificityFollowUpForTts,
  isAnsweringMoment4SpecificityFollowUp,
  MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT,
  resolveMoment4GrudgeAnswerForThresholdReflection,
} from '@features/aria/moment4SpecificityFollowUp';
import type { PostClaudeInterviewMessage } from '@features/aria/postClaudeAssistantTurnTypes';
import { isScenarioABoundaryReflectionWithoutNextVignette } from '@features/aria/scenarioAContemptProbeTextMatch';
import { substituteCanonicalInterviewScenarioBodiesForTts } from '@features/aria/substituteCanonicalInterviewScenarioBodiesForTts';
import {
  coerceScenarioBQ1QuestionForTts,
  coerceScenarioBJamesDifferentlyQuestionForTts,
  coerceScenarioBJamesRepairQuestionForTts,
  coerceScenarioBJamesSayToJamesQuestionForTts,
  isScenarioBBoundaryReflectionWithoutNextVignette,
  type ScenarioBJamesDifferentlyCoerceContext,
} from '@features/aria/scenarioBProbeLogic';
import {
  coerceScenarioARepairQuestionForTts,
  isIncompleteScenarioARepairLeadSentence,
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairStreamFragment,
  normalizeScenarioARepairQuestionInAssistantDraft,
  shouldSkipScenarioARepairDraftNormalization,
} from '@features/aria/scenarioARepairQuestionHelpers';

export type CoerceInterviewAssistantDraftContext = {
  interviewMoment: number;
  currentScenario: number | null | undefined;
  firstName: string;
  messages: PostClaudeInterviewMessage[];
};

/**
 * True when API/stream delivered assistant copy cut off mid-clause (no complete question or sentence).
 * Complements moment-specific incomplete detectors used before TTS.
 */
export function isGenericTruncatedAssistantDraft(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 16) return false;
  if (/\?\s*$/.test(t)) return false;

  const low = t.toLowerCase();

  if (/\bwhether it'?s that\s*$/i.test(t)) return true;
  if (/\bwhen things go sideways\b/i.test(t) && !/\?\s*$/.test(t)) return true;
  if (/[—–-]\s*whether\b/i.test(t) && !/\?\s*$/.test(t)) return true;
  if (/\bbefore we\s*$/i.test(t)) return true;
  if (/\balready thinking as james\b/i.test(t) && !/\?\s*$/.test(t)) return true;
  if (/\b(?:that|it),?\s*$/i.test(t)) return true;
  if (isScenarioABoundaryReflectionWithoutNextVignette(t)) return true;
  if (/\bwhat do you think caused\b/i.test(t)) return true;
  if (/\bi'?ll get to that\b/i.test(low) && /\bbut first\b/i.test(low)) return true;

  if (!/[.!?]\s*$/.test(t)) {
    if (/\b(?:when|whether|if|because|that)\b/i.test(low) && t.length < 120) {
      return true;
    }
  }

  return false;
}

function resolveMoment4TruncatedDraftFallback(ctx: CoerceInterviewAssistantDraftContext): string {
  if (isAnsweringMoment4SpecificityFollowUp(ctx.messages)) {
    const grudgeAnswer = resolveMoment4GrudgeAnswerForThresholdReflection(ctx.messages, '');
    return buildMoment4ThresholdProbeWithReflection(grudgeAnswer);
  }
  return MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT;
}

function isResolvedScenarioThreeToMoment4HandoffBundle(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t || !isScenarioThreeToMoment4EmotionModalHandoff(t)) return false;
  const { afterModal } = splitScenarioTransitionForEmotionModal(t);
  return afterModal.trim().length > 0 && looksLikeMoment4GrudgePrompt(afterModal);
}

/**
 * Expand truncated or paraphrased assistant drafts before TTS across interview moments.
 * Runs boundary-handoff coercion, moment-specific scripted-question coercion, then fallbacks.
 */
export function coerceInterviewAssistantDraftForSpeak(
  text: string,
  ctx: CoerceInterviewAssistantDraftContext,
): string {
  let t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return t;

  t = coerceScenarioBoundaryHandoffDisplayText(
    t,
    ctx.firstName,
    ctx.messages,
    ctx.currentScenario,
    ctx.interviewMoment,
  );

  if (isResolvedScenarioThreeToMoment4HandoffBundle(t)) {
    return substituteCanonicalInterviewScenarioBodiesForTts(t);
  }

  if (ctx.interviewMoment === 4) {
    t = coerceMoment4SpecificityFollowUpForTts(t);
    t = coerceMoment4ThresholdQuestionForTts(t);
  }

  if (ctx.interviewMoment === 2 && (ctx.currentScenario === 2 || ctx.currentScenario == null)) {
    const jamesCoerceCtx: ScenarioBJamesDifferentlyCoerceContext = {
      messages: ctx.messages,
      interviewMoment: ctx.interviewMoment,
    };
    t = coerceScenarioBQ1QuestionForTts(t);
    t = coerceScenarioBJamesSayToJamesQuestionForTts(t);
    t = coerceScenarioBJamesDifferentlyQuestionForTts(t, jamesCoerceCtx);
    t = coerceScenarioBJamesRepairQuestionForTts(t);
  }

  if (ctx.interviewMoment === 1 && (ctx.currentScenario === 1 || ctx.currentScenario == null)) {
    if (!shouldSkipScenarioARepairDraftNormalization(t)) {
      if (
        looksLikeScenarioARepairQuestion(t) ||
        looksLikeScenarioARepairStreamFragment(t) ||
        isIncompleteScenarioARepairLeadSentence(t)
      ) {
        t = coerceScenarioARepairQuestionForTts(t);
      } else {
        t = normalizeScenarioARepairQuestionInAssistantDraft(t);
      }
    }
  }

  if (isGenericTruncatedAssistantDraft(t)) {
    if (ctx.interviewMoment === 4) {
      t = resolveMoment4TruncatedDraftFallback(ctx);
    } else if (ctx.interviewMoment === 1 && ctx.currentScenario === 1) {
      t = coerceScenarioBoundaryHandoffDisplayText(
        t,
        ctx.firstName,
        ctx.messages,
        1,
        1,
      );
    } else if (ctx.interviewMoment === 2 && (ctx.currentScenario === 2 || ctx.currentScenario == null)) {
      t = coerceScenarioBQ1QuestionForTts(t);
    }
  }

  if (ctx.interviewMoment === 4 && isGenericTruncatedAssistantDraft(t)) {
    t = MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
  }

  if (
    ctx.interviewMoment === 1 &&
    (ctx.currentScenario === 1 || ctx.currentScenario == null) &&
    !textContainsScenarioBVignetteBody(t) &&
    (isScenarioABoundaryReflectionWithoutNextVignette(t) ||
      shouldAdvanceScenarioAAfterSatisfiedRepair(ctx.messages, t, 1))
  ) {
    const bundle = applyPostClaudeScenarioAdvanceBundleOverride(
      t,
      ctx.firstName,
      ctx.messages,
      1,
      ctx.currentScenario ?? 1,
    );
    if (bundle) {
      const injected = stripControlTokens(bundle);
      t = injected;
    }
  }

  if (
    ctx.interviewMoment === 2 &&
    (ctx.currentScenario === 2 || ctx.currentScenario == null) &&
    !textContainsScenarioCVignetteBody(t) &&
    (isScenarioBBoundaryReflectionWithoutNextVignette(t) ||
      shouldAdvanceScenarioBAfterSatisfiedRepair(ctx.messages, t, 2))
  ) {
    const bundle = applyPostClaudeScenarioAdvanceBundleOverride(
      t,
      ctx.firstName,
      ctx.messages,
      2,
      ctx.currentScenario ?? 2,
    );
    if (bundle) {
      const injected = stripControlTokens(bundle);
      t = injected;
    }
  }

  return substituteCanonicalInterviewScenarioBodiesForTts(t);
}

/** True when streamed/spoken text is materially shorter or less complete than the coerced target. */
export function spokenTextMissesCoercedAssistantDraft(
  spokenText: string,
  coercedText: string,
): boolean {
  const spoken = spokenText.trim();
  const coerced = coercedText.trim();
  if (!coerced) return false;
  if (!spoken) return true;
  if (spoken === coerced) return false;
  if (isGenericTruncatedAssistantDraft(spoken) && !isGenericTruncatedAssistantDraft(coerced)) {
    return true;
  }
  const spokenNorm = spoken.toLowerCase().replace(/\s+/g, ' ');
  const coercedNorm = coerced.toLowerCase().replace(/\s+/g, ' ');
  if (coercedNorm.length > spokenNorm.length * 1.35 && !coercedNorm.startsWith(spokenNorm)) {
    return true;
  }
  return false;
}
