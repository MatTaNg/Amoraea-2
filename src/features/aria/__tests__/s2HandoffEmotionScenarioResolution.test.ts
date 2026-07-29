import { describe, expect, it } from '@jest/globals';

import {
  assistantTextLooksLikeMoment4HandoffLead,
  buildScenario2To3BundleForInterview,
} from '@features/aria/interviewTransitionBundles';
import { SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import {
  completedScenarioForEmotionModalFromTransition,
  resolveHandoffPriorScenario,
  resolveScenarioJustCompletedForPostClaudeEmotionTransition,
} from '@features/aria/emotionScenarioTransitionInference';
import { prepareEmotionTransitionBeforeModalForTts } from '@features/aria/emotionTransitionModalTtsGuards';
import { SHOW_SCENARIO_3_FULL_EXACT } from '@features/aria/interviewShowScenarioExactCopy';

describe('S2 repair satisfied → S3 canonical handoff emotion resolution', () => {
  const bundle = buildScenario2To3BundleForInterview('Matt', SCENARIO_3_TEXT, null);
  const streamSpoke = `That's the second one done. One more situation and then we'll get personal.\n\n${SHOW_SCENARIO_3_FULL_EXACT}`;

  it('does not treat S2→S3 bundle as M4 handoff', () => {
    expect(assistantTextLooksLikeMoment4HandoffLead(bundle)).toBe(false);
    expect(
      completedScenarioForEmotionModalFromTransition({
        declaredComplete: 3,
        transitionText: bundle,
        priorScenario: 3,
      }),
    ).toBe(2);
  });

  it('resolveHandoffPriorScenario returns 2 when Sophie vignette is in transition text', () => {
    expect(resolveHandoffPriorScenario(3, 3, [], bundle)).toBe(2);
  });

  it('resolveScenarioJustCompletedForPostClaudeEmotionTransition infers S2 after stream advanced refs', () => {
    expect(
      resolveScenarioJustCompletedForPostClaudeEmotionTransition({
        displayText: 'Got it.',
        priorScenarioNum: 3,
        emotionCompletedScenario: null,
        situation3PlaybackConfirmed: true,
        situation2PlaybackConfirmed: true,
        scenarioCRepairStillPending: true,
      }),
    ).toBe(2);
  });

  it('resolveScenarioJustCompletedForPostClaudeEmotionTransition prefers S2 over emotionCompletedScenario 3 at S2→S3', () => {
    expect(
      resolveScenarioJustCompletedForPostClaudeEmotionTransition({
        displayText: 'Good work getting through all of this.',
        priorScenarioNum: 3,
        emotionCompletedScenario: 3,
        situation3PlaybackConfirmed: true,
        situation2PlaybackConfirmed: true,
        scenarioCRepairStillPending: true,
      }),
    ).toBe(2);
  });

  it('resolveScenarioJustCompletedForPostClaudeEmotionTransition still allows S3 at S3→M4', () => {
    expect(
      resolveScenarioJustCompletedForPostClaudeEmotionTransition({
        displayText: 'Good work — you just finished the three situations.',
        priorScenarioNum: 3,
        emotionCompletedScenario: 3,
        situation3PlaybackConfirmed: true,
        situation2PlaybackConfirmed: true,
        scenarioCRepairStillPending: false,
      }),
    ).toBe(3);
  });

  it('resolveScenarioJustCompletedForPostClaudeEmotionTransition prefers S3 over pending S2 repair at M4 grudge handoff', () => {
    const m4 =
      "Good work — you just finished the three situations. There are only two questions left. Now I want to ask you about something a bit more personal.\n\nThink of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin.";
    expect(
      resolveScenarioJustCompletedForPostClaudeEmotionTransition({
        displayText: m4,
        priorScenarioNum: 3,
        emotionCompletedScenario: null,
        situation3PlaybackConfirmed: true,
        situation2PlaybackConfirmed: true,
        scenarioCRepairStillPending: true,
      }),
    ).toBe(3);
  });

  it('prepareEmotionTransitionBeforeModalForTts suppresses stray Got it after canonical S3', () => {
    const beforeModal = prepareEmotionTransitionBeforeModalForTts('Got it.', {
      scenarioJustCompleted: 2,
      streamAlreadySpokeBefore: true,
      streamSpokeText: streamSpoke,
      playbackConfirmedKinds: { situation_3: true },
      messages: [],
      interviewMoment: 3,
    });
    expect(beforeModal).toBe('');
  });
});
