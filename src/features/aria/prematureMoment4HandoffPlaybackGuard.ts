import {
  textContainsScenarioCVignetteBody,
} from '@features/aria/emotionScenarioTransitionInference';
import { hasScenarioBoundaryWrapPhrase } from '@features/aria/emotionModalTransitionOrchestration';
import { assistantTextIsPrematureMoment4HandoffDuringScenarioC } from '@features/aria/interviewMomentScenarioConfig';
import { looksLikeMoment4GrudgePrompt } from '@features/aria/moment4ProbeLogic';
import {
  isIncompleteScenarioCBoundaryClosureLeadSentence,
  isScenarioCBoundaryReflectionWithoutMoment4Handoff,
} from '@features/aria/scenarioCPromptDetection';

type TranscriptMessage = { role: string; content?: string | null };

/**
 * Model sometimes streams only the M4 personal bridge before S3 boundary closure.
 * Canonical moment_4 handoff speaks the full bundle once (reflection + bridge + grudge Q).
 */
export function isPrematureStandaloneM4PersonalTransitionLine(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || looksLikeMoment4GrudgePrompt(t)) return false;
  const low = t.toLowerCase();
  const hasPersonalBridge =
    /\bnow (?:for|i want to ask you about) something (?:a bit )?more personal\b/.test(low) ||
    /\bnow (?:let's move to|let us move to) something (?:a bit )?more personal\b/.test(low) ||
    /\b(?:ask you about|shift to) something (?:a bit )?more personal\b/.test(low) ||
    /\bnow (?:for|it's| is) time for the personal questions\b/.test(low) ||
    /\bnow for the personal questions\b/.test(low);
  if (!hasPersonalBridge) return false;
  if (
    hasScenarioBoundaryWrapPhrase(t) ||
    /\b(?:end of the three|finished the three|wraps up the three|done with those three)\b/.test(low)
  ) {
    return false;
  }
  return true;
}

/** True when Sophie/Daniel vignette already appears in transcript or recent playback history. */
export function interviewHistoryContainsDeliveredScenarioCVignette(args: {
  messages?: ReadonlyArray<TranscriptMessage>;
  lastQuestionText?: string;
  lastSuccessfulTtsDeliveredPreview?: string;
}): boolean {
  if (
    args.messages?.some(
      (m) => m.role === 'assistant' && textContainsScenarioCVignetteBody(m.content ?? ''),
    )
  ) {
    return true;
  }
  if (textContainsScenarioCVignetteBody(args.lastQuestionText ?? '')) return true;
  if (textContainsScenarioCVignetteBody(args.lastSuccessfulTtsDeliveredPreview ?? '')) {
    return true;
  }
  return false;
}

/**
 * Model sometimes skips Scenario 3 and streams the Moment-4 grudge handoff after Scenario 2.
 * Redirect/suppress unless Scenario C vignette was already delivered or this is a truncated S3→M4 closure.
 */
export function shouldRedirectPrematureMoment4ToScenario2To3Handoff(args: {
  text: string;
  currentInterviewMoment: number;
  messages?: ReadonlyArray<TranscriptMessage>;
  lastQuestionText?: string;
  lastSuccessfulTtsDeliveredPreview?: string;
}): boolean {
  if (!assistantTextIsPrematureMoment4HandoffDuringScenarioC(args.text)) return false;
  if (textContainsScenarioCVignetteBody(args.text)) return false;
  if (args.currentInterviewMoment >= 4) return false;
  if (isScenarioCBoundaryReflectionWithoutMoment4Handoff(args.text)) return false;
  if (isIncompleteScenarioCBoundaryClosureLeadSentence(args.text)) return false;
  if (
    interviewHistoryContainsDeliveredScenarioCVignette({
      messages: args.messages,
      lastQuestionText: args.lastQuestionText,
      lastSuccessfulTtsDeliveredPreview: args.lastSuccessfulTtsDeliveredPreview,
    })
  ) {
    return false;
  }
  return true;
}
