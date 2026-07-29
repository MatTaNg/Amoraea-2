import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  textContainsScenarioCVignetteBody,
} from '@features/aria/emotionScenarioTransitionInference';
import { assistantTextLooksLikeMoment4HandoffLead } from '@features/aria/interviewTransitionBundles';
import {
  looksLikeScenarioBQ1Question,
  prepareScenarioBEmotionAfterModalForTts,
} from '@features/aria/scenarioBProbeLogic';
import { looksLikeMoment4GrudgePrompt } from '@features/aria/moment4ProbeLogic';
import { looksLikeBriefStreamAckOnly } from '@features/aria/interviewSpokenTextHeuristics';
import { isShortAckOnlySentence } from '@features/aria/interviewerFrameworkPrompt';
import {
  isExactShowScenario2VignetteText,
  isShowScenarioCardCanonicalPlaybackConfirmed,
  mergeShowScenarioCardTransitionPrefixWithSpoken,
  type ShowScenarioCardCanonicalPlaybackConfirmedKinds,
} from '@features/aria/showScenarioCardCanonicalTts';

function isBriefAckOnlyTransitionLead(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  return looksLikeBriefStreamAckOnly(t) || isShortAckOnlySentence(t);
}

export type EmotionTransitionModalTtsContext = {
  scenarioJustCompleted: 1 | 2 | 3;
  streamAlreadySpokeBefore: boolean;
  streamSpokeText: string;
  playbackConfirmedKinds: ShowScenarioCardCanonicalPlaybackConfirmedKinds;
  messages: readonly MessageWithScenario[];
  interviewMoment: number;
};

/** Speak reflection + transition lead before the emotion modal when stream mute skipped it. */
export function prepareEmotionTransitionBeforeModalForTts(
  beforeModal: string,
  ctx: EmotionTransitionModalTtsContext,
): string {
  const raw = (beforeModal ?? '').trim();
  if (!raw) return '';

  const suppressBriefAckAfterCanonicalNextSegment = (merged: string): string => {
    if (
      isBriefAckOnlyTransitionLead(merged) &&
      ((ctx.scenarioJustCompleted === 2 &&
        isShowScenarioCardCanonicalPlaybackConfirmed(ctx.playbackConfirmedKinds, 'situation_3')) ||
        (ctx.scenarioJustCompleted === 1 &&
          isShowScenarioCardCanonicalPlaybackConfirmed(ctx.playbackConfirmedKinds, 'situation_2')))
    ) {
      return '';
    }
    return merged;
  };

  const tryKeepUnspokenBoundaryLead = (): string => {
    /** Empty merge means stream already covered the prefix — never fall back to re-speaking raw. */
    return suppressBriefAckAfterCanonicalNextSegment(
      mergeShowScenarioCardTransitionPrefixWithSpoken(raw, ctx.streamSpokeText).trim(),
    );
  };

  if (
    ctx.scenarioJustCompleted === 1 &&
    isShowScenarioCardCanonicalPlaybackConfirmed(ctx.playbackConfirmedKinds, 'situation_2')
  ) {
    return tryKeepUnspokenBoundaryLead();
  }

  if (ctx.scenarioJustCompleted === 1 && ctx.streamAlreadySpokeBefore) {
    return tryKeepUnspokenBoundaryLead();
  }

  if (
    ctx.scenarioJustCompleted === 2 &&
    isShowScenarioCardCanonicalPlaybackConfirmed(ctx.playbackConfirmedKinds, 'situation_3')
  ) {
    return tryKeepUnspokenBoundaryLead();
  }

  if (ctx.scenarioJustCompleted === 2 && ctx.streamAlreadySpokeBefore) {
    return tryKeepUnspokenBoundaryLead();
  }

  if (
    ctx.scenarioJustCompleted === 3 &&
    isShowScenarioCardCanonicalPlaybackConfirmed(ctx.playbackConfirmedKinds, 'moment_4')
  ) {
    return tryKeepUnspokenBoundaryLead();
  }

  if (ctx.scenarioJustCompleted === 3 && ctx.streamAlreadySpokeBefore) {
    return tryKeepUnspokenBoundaryLead();
  }

  if (ctx.streamAlreadySpokeBefore) {
    return tryKeepUnspokenBoundaryLead();
  }
  return suppressBriefAckAfterCanonicalNextSegment(raw);
}

/** Skip duplicate vignette playback after the emotion modal when canonical stream already delivered it. */
export function prepareEmotionTransitionAfterModalForTts(
  afterModal: string,
  ctx: EmotionTransitionModalTtsContext,
): string {
  const raw = (afterModal ?? '').trim();
  if (!raw) return '';

  if (ctx.scenarioJustCompleted === 1) {
    /** Require the exact job-hunting vignette — wrap-only or legacy fiction must not skip after-modal speak. */
    const streamAudiblyDeliveredS2Opening = isExactShowScenario2VignetteText(ctx.streamSpokeText);
    return prepareScenarioBEmotionAfterModalForTts(raw, {
      messages: ctx.messages,
      interviewMoment: ctx.interviewMoment,
      streamSpokeS2Opening: streamAudiblyDeliveredS2Opening || looksLikeScenarioBQ1Question(ctx.streamSpokeText),
      s2CanonicalPlaybackConfirmed:
        streamAudiblyDeliveredS2Opening &&
        isShowScenarioCardCanonicalPlaybackConfirmed(ctx.playbackConfirmedKinds, 'situation_2'),
      scenarioJustCompleted: 1,
      streamAlreadySpokeBefore: ctx.streamAlreadySpokeBefore && streamAudiblyDeliveredS2Opening,
    });
  }

  if (
    ctx.scenarioJustCompleted === 2 &&
    isShowScenarioCardCanonicalPlaybackConfirmed(ctx.playbackConfirmedKinds, 'situation_3') &&
    (ctx.streamAlreadySpokeBefore ||
      textContainsScenarioCVignetteBody(ctx.streamSpokeText) ||
      textContainsScenarioCVignetteBody(raw))
  ) {
    return '';
  }

  if (
    ctx.scenarioJustCompleted === 3 &&
    isShowScenarioCardCanonicalPlaybackConfirmed(ctx.playbackConfirmedKinds, 'moment_4') &&
    (ctx.streamAlreadySpokeBefore ||
      looksLikeMoment4GrudgePrompt(ctx.streamSpokeText) ||
      looksLikeMoment4GrudgePrompt(raw) ||
      assistantTextLooksLikeMoment4HandoffLead(raw))
  ) {
    return '';
  }

  return raw;
}
