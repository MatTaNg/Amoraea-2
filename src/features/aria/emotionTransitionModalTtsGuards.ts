import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
} from '@features/aria/emotionScenarioTransitionInference';
import { assistantTextLooksLikeMoment4HandoffLead } from '@features/aria/interviewTransitionBundles';
import {
  looksLikeScenarioBQ1Question,
  prepareScenarioBEmotionAfterModalForTts,
} from '@features/aria/scenarioBProbeLogic';
import { looksLikeMoment4GrudgePrompt } from '@features/aria/moment4ProbeLogic';
import {
  isShowScenarioCardCanonicalPlaybackConfirmed,
  mergeShowScenarioCardTransitionPrefixWithSpoken,
  streamAlreadySpokeScenarioBoundaryClosingLead,
  type ShowScenarioCardCanonicalPlaybackConfirmedKinds,
} from '@features/aria/showScenarioCardCanonicalTts';

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

  if (
    ctx.scenarioJustCompleted === 1 &&
    isShowScenarioCardCanonicalPlaybackConfirmed(ctx.playbackConfirmedKinds, 'situation_2')
  ) {
    const merged = mergeShowScenarioCardTransitionPrefixWithSpoken(raw, ctx.streamSpokeText);
    if (merged.trim()) return merged.trim();
    if (!/\bnext situation\b/i.test(ctx.streamSpokeText) && !/\btwo more situations\b/i.test(ctx.streamSpokeText)) {
      const nextLead =
        raw.match(/here'?s the next situation[\s\S]*/i)?.[0]?.trim() ||
        raw.match(/we'?ve got two more situations[\s\S]*/i)?.[0]?.trim();
      if (nextLead) return nextLead;
    }
    return '';
  }

  if (ctx.scenarioJustCompleted === 1 && ctx.streamAlreadySpokeBefore) {
    const streamLower = ctx.streamSpokeText.toLowerCase();
    if (
      streamLower.includes("that's a wrap on this situation") ||
      streamLower.includes("that's a wrap on that one") ||
      streamLower.includes("here's the next situation") ||
      streamLower.includes("we've got two more situations") ||
      /\bnice work\b/.test(streamLower)
    ) {
      const merged = mergeShowScenarioCardTransitionPrefixWithSpoken(raw, ctx.streamSpokeText);
      if (
        !merged.trim() ||
        streamLower.includes("that's a wrap on this situation") ||
        streamLower.includes("that's a wrap on that one")
      ) {
        return '';
      }
    }
  }

  if (
    ctx.scenarioJustCompleted === 2 &&
    isShowScenarioCardCanonicalPlaybackConfirmed(ctx.playbackConfirmedKinds, 'situation_3')
  ) {
    const merged = mergeShowScenarioCardTransitionPrefixWithSpoken(raw, ctx.streamSpokeText);
    if (merged.trim()) return merged.trim();
    if (
      !/\bthird situation\b/i.test(ctx.streamSpokeText) &&
      !/\bsecond one done\b/i.test(ctx.streamSpokeText) &&
      !/\bone more situation and then we'?ll get personal\b/i.test(ctx.streamSpokeText)
    ) {
      const thirdSituationLead =
        raw.match(/here'?s the third situation[\s\S]*/i)?.[0]?.trim() ||
        raw.match(/that'?s the second one done[\s\S]*/i)?.[0]?.trim();
      if (thirdSituationLead) return thirdSituationLead;
    }
    return '';
  }

  if (ctx.scenarioJustCompleted === 2 && ctx.streamAlreadySpokeBefore) {
    const streamLower = ctx.streamSpokeText.toLowerCase();
    if (
      streamLower.includes('that scenario is complete') ||
      streamLower.includes("here's the third situation") ||
      streamLower.includes('second one done') ||
      streamLower.includes("one more situation and then we'll get personal") ||
      (streamLower.includes("that's a wrap on this situation") &&
        /\bthird situation\b/.test(streamLower))
    ) {
      const merged = mergeShowScenarioCardTransitionPrefixWithSpoken(raw, ctx.streamSpokeText);
      if (
        !merged.trim() ||
        streamLower.includes('that scenario is complete') ||
        streamLower.includes('second one done')
      ) {
        return '';
      }
    }
  }

  if (
    ctx.scenarioJustCompleted === 3 &&
    isShowScenarioCardCanonicalPlaybackConfirmed(ctx.playbackConfirmedKinds, 'moment_4')
  ) {
    const merged = mergeShowScenarioCardTransitionPrefixWithSpoken(raw, ctx.streamSpokeText);
    if (merged.trim()) return merged.trim();
    if (
      !/\btwo questions left\b/i.test(ctx.streamSpokeText) &&
      /\btwo questions left\b/i.test(raw)
    ) {
      const m4Lead = raw.match(/there are only two questions left[\s\S]*/i)?.[0]?.trim();
      if (m4Lead) return m4Lead;
    }
    return '';
  }

  if (ctx.scenarioJustCompleted === 3 && ctx.streamAlreadySpokeBefore) {
    const streamLower = ctx.streamSpokeText.toLowerCase();
    if (
      streamLower.includes('end of the three described situations') ||
      streamAlreadySpokeScenarioBoundaryClosingLead(ctx.streamSpokeText, 3)
    ) {
      const merged = mergeShowScenarioCardTransitionPrefixWithSpoken(raw, ctx.streamSpokeText);
      if (!merged.trim() || streamLower.includes('end of the three described situations')) {
        return '';
      }
    }
  }

  if (ctx.streamAlreadySpokeBefore) {
    const merged = mergeShowScenarioCardTransitionPrefixWithSpoken(raw, ctx.streamSpokeText);
    if (merged.trim()) return merged.trim();
    if (ctx.scenarioJustCompleted === 1 && !/\bnext situation\b/i.test(ctx.streamSpokeText)) {
      const lead = raw.match(/here'?s the next situation[\s\S]*/i)?.[0]?.trim();
      if (lead) return lead;
    }
    if (ctx.scenarioJustCompleted === 2 && !/\bthird situation\b/i.test(ctx.streamSpokeText)) {
      const lead = raw.match(/here'?s the third situation[\s\S]*/i)?.[0]?.trim();
      if (lead) return lead;
    }
    if (ctx.scenarioJustCompleted === 3 && !/\btwo questions left\b/i.test(ctx.streamSpokeText)) {
      const lead = raw.match(/there are only two questions left[\s\S]*/i)?.[0]?.trim();
      if (lead) return lead;
    }
    return '';
  }
  return raw;
}

/** Skip duplicate vignette playback after the emotion modal when canonical stream already delivered it. */
export function prepareEmotionTransitionAfterModalForTts(
  afterModal: string,
  ctx: EmotionTransitionModalTtsContext,
): string {
  const raw = (afterModal ?? '').trim();
  if (!raw) return '';

  if (ctx.scenarioJustCompleted === 1) {
    return prepareScenarioBEmotionAfterModalForTts(raw, {
      messages: ctx.messages,
      interviewMoment: ctx.interviewMoment,
      streamSpokeS2Opening:
        textContainsScenarioBVignetteBody(ctx.streamSpokeText) ||
        looksLikeScenarioBQ1Question(ctx.streamSpokeText),
      s2CanonicalPlaybackConfirmed: isShowScenarioCardCanonicalPlaybackConfirmed(
        ctx.playbackConfirmedKinds,
        'situation_2',
      ),
      scenarioJustCompleted: 1,
      streamAlreadySpokeBefore: ctx.streamAlreadySpokeBefore,
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
