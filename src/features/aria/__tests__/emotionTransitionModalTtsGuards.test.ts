import { describe, expect, it } from '@jest/globals';

import { SHOW_SCENARIO_2_VIGNETTE_EXACT, SHOW_SCENARIO_3_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import {
  prepareEmotionTransitionAfterModalForTts,
  prepareEmotionTransitionBeforeModalForTts,
} from '@features/aria/emotionTransitionModalTtsGuards';
import { SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL } from '@features/aria/scenarioBProbeLogic';

describe('emotionTransitionModalTtsGuards', () => {
  const s2To3BeforeModal =
    "That scenario is complete. Nice work, Matt — You saw James's focus on logistics. Here's the third situation — after this we'll move to something more personal.";
  const s2To3AfterModal = `${SHOW_SCENARIO_3_VIGNETTE_EXACT}\n\nWhen Daniel comes back and says 'I didn't know what to say' — what do you make of that?`;

  it('speaks S1→S2 transition lead before modal when stream only delivered reflection', () => {
    const beforeModal =
      "That's a wrap on this situation. Nice work, Matt — you recognized Emma's frustration about shared time. Here's the next situation.";
    const streamReflection =
      "That's a wrap on this situation. Nice work, Matt — you recognized Emma's frustration about shared time.";
    expect(
      prepareEmotionTransitionBeforeModalForTts(beforeModal, {
        scenarioJustCompleted: 1,
        streamAlreadySpokeBefore: true,
        streamSpokeText: streamReflection,
        playbackConfirmedKinds: { situation_2: true },
        messages: [],
        interviewMoment: 1,
      }),
    ).toMatch(/next situation/i);
  });

  it('speaks S2→S3 transition lead before modal when stream only delivered reflection', () => {
    const streamReflection =
      "That's a wrap on this situation. Nice work, Matt — you recognized that James needed to meet Sarah's emotional moment first.";
    expect(
      prepareEmotionTransitionBeforeModalForTts(s2To3BeforeModal, {
        scenarioJustCompleted: 2,
        streamAlreadySpokeBefore: true,
        streamSpokeText: streamReflection,
        playbackConfirmedKinds: { situation_3: true },
        messages: [],
        interviewMoment: 2,
      }),
    ).toMatch(/third situation/i);
  });

  it('skips S3 afterModal when canonical situation_3 playback was confirmed in stream', () => {
    expect(
      prepareEmotionTransitionAfterModalForTts(s2To3AfterModal, {
        scenarioJustCompleted: 2,
        streamAlreadySpokeBefore: true,
        streamSpokeText: "That's a wrap on this situation.",
        playbackConfirmedKinds: { situation_3: true },
        messages: [],
        interviewMoment: 3,
      }),
    ).toBe('');
  });

  it('speaks S3→M4 transition lead before modal when stream only delivered reflection', () => {
    const beforeModal =
      "That's the end of the three described situations. Good work, Matt — you recognized Daniel's confusion. There are only two questions left. Now I want to ask you about something a bit more personal.";
    const streamReflection =
      "That's the end of the three described situations. Good work, Matt — you recognized Daniel's genuine confusion.";
    expect(
      prepareEmotionTransitionBeforeModalForTts(beforeModal, {
        scenarioJustCompleted: 3,
        streamAlreadySpokeBefore: true,
        streamSpokeText: streamReflection,
        playbackConfirmedKinds: { moment_4: true },
        messages: [],
        interviewMoment: 4,
      }),
    ).toMatch(/two questions left/i);
  });

  it('skips M4 afterModal when canonical moment_4 playback was confirmed in stream', () => {
    const m4AfterModal =
      "Think of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin. Tell me what happened there, and where things stand now.";
    expect(
      prepareEmotionTransitionAfterModalForTts(m4AfterModal, {
        scenarioJustCompleted: 3,
        streamAlreadySpokeBefore: true,
        streamSpokeText: "That's the end of the three described situations.",
        playbackConfirmedKinds: { moment_4: true },
        messages: [],
        interviewMoment: 4,
      }),
    ).toBe('');
  });

  it('still skips S2 James Q2 afterModal on S1→S2 transition', () => {
    const messages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'If I were Ryan, I would assure her that this would not happen again and actually follow through.',
      },
    ];
    expect(
      prepareEmotionTransitionAfterModalForTts(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL, {
        scenarioJustCompleted: 1,
        streamAlreadySpokeBefore: true,
        streamSpokeText: `${SHOW_SCENARIO_2_VIGNETTE_EXACT}\n\nWhat do you think is going on here?`,
        playbackConfirmedKinds: { situation_2: true },
        messages,
        interviewMoment: 1,
      }),
    ).toBe('');
  });

  it('speaks S2 afterModal when confirmed flag is set but only the wrap was spoken', () => {
    const afterModal =
      `${SHOW_SCENARIO_2_VIGNETTE_EXACT}\n\nWhat do you think is going on here?`;
    expect(
      prepareEmotionTransitionAfterModalForTts(afterModal, {
        scenarioJustCompleted: 1,
        streamAlreadySpokeBefore: true,
        streamSpokeText: "Good work — that's the end of this scenario. Here's the next situation.",
        playbackConfirmedKinds: { situation_2: true },
        messages: [],
        interviewMoment: 2,
      }),
    ).toMatch(/job hunting for four months/i);
  });

  it('prepareEmotionTransitionBeforeModalForTts skips S3 closing when stream already spoke wrap lead', () => {
    const beforeModal =
      "That's the end of the three described situations. Good work, Matt — You recognized that the pattern won't shift without both of them staying in the room for an honest conversation. There are only two questions left. Now I want to ask you about something a bit more personal.";
    const streamSpoke = beforeModal;
    expect(
      prepareEmotionTransitionBeforeModalForTts(beforeModal, {
        scenarioJustCompleted: 3,
        streamAlreadySpokeBefore: true,
        streamSpokeText: streamSpoke,
        playbackConfirmedKinds: {},
        messages: [],
        interviewMoment: 4,
      }),
    ).toBe('');
  });

  it('prepareEmotionTransitionBeforeModalForTts skips S1 wrap when stream already spoke closing lead', () => {
    const beforeModal =
      "That's a wrap on this situation. Nice work, Matz — You recognized that putting guardrails in place has to come before the same rupture can repeat. Here's the next situation.";
    const streamSpoke =
      "That's a wrap on this situation. Nice work, Matz — You recognized that putting guardrails in place has to come before the same rupture can repeat. Here's the next situation.";
    expect(
      prepareEmotionTransitionBeforeModalForTts(beforeModal, {
        scenarioJustCompleted: 1,
        streamAlreadySpokeBefore: true,
        streamSpokeText: streamSpoke,
        playbackConfirmedKinds: {},
        messages: [],
        interviewMoment: 2,
      }),
    ).toBe('');
  });

  it('prepareEmotionTransitionBeforeModalForTts skips canonical short S1→S2 close when stream already spoke it', () => {
    const beforeModal =
      "Good work — that's the end of this scenario. Here's the next situation.";
    expect(
      prepareEmotionTransitionBeforeModalForTts(beforeModal, {
        scenarioJustCompleted: 1,
        streamAlreadySpokeBefore: true,
        streamSpokeText: beforeModal,
        playbackConfirmedKinds: { situation_2: true },
        messages: [],
        interviewMoment: 2,
      }),
    ).toBe('');
  });

  it('keeps S1 wrap when canonical S2 confirmed but spoken audio never included the wrap lead', () => {
    const beforeModal =
      "Good work — that's the end of this scenario. Here's the next situation.";
    expect(
      prepareEmotionTransitionBeforeModalForTts(beforeModal, {
        scenarioJustCompleted: 1,
        streamAlreadySpokeBefore: true,
        streamSpokeText:
          'Sarah has been job hunting for four months. What do you think is going on here?',
        playbackConfirmedKinds: { situation_2: true },
        messages: [],
        interviewMoment: 2,
      }),
    ).toMatch(/end of this scenario|next situation/i);
  });

  it('keeps S2 wrap when canonical S3 confirmed but spoken audio never included the wrap lead', () => {
    expect(
      prepareEmotionTransitionBeforeModalForTts(s2To3BeforeModal, {
        scenarioJustCompleted: 2,
        streamAlreadySpokeBefore: true,
        streamSpokeText: SHOW_SCENARIO_3_VIGNETTE_EXACT,
        playbackConfirmedKinds: { situation_3: true },
        messages: [],
        interviewMoment: 3,
      }),
    ).toMatch(/scenario is complete|third situation/i);
  });

  it('skips S2→S3 beforeModal when stream end already delivered LLM wrap plus S3 vignette', () => {
    const clientBeforeModal =
      "Got it. That's the second one done. One more situation and then we'll get personal.";
    const streamSpoke =
      "That's the second situation wrapped up. On to the next one.\n\nSophie and Daniel have had the same argument for the third time. Sophie feels unheard because Daniel goes silent or leaves.";
    expect(
      prepareEmotionTransitionBeforeModalForTts(clientBeforeModal, {
        scenarioJustCompleted: 2,
        streamAlreadySpokeBefore: true,
        streamSpokeText: streamSpoke,
        playbackConfirmedKinds: { situation_3: true },
        messages: [],
        interviewMoment: 3,
      }),
    ).toBe('');
  });

  it('skips S2→S3 beforeModal when stream spoke wraps-up-Sarah-James LLM lead plus S3 vignette', () => {
    const clientBeforeModal =
      "Got it. That's the second one done. One more situation and then we'll get personal.";
    const streamSpoke =
      'That wraps up Sarah and James. On to the third and final situation.\n\nSophie and Daniel have had the same argument for the third time. Sophie feels unheard because Daniel goes silent or leaves.';
    expect(
      prepareEmotionTransitionBeforeModalForTts(clientBeforeModal, {
        scenarioJustCompleted: 2,
        streamAlreadySpokeBefore: true,
        streamSpokeText: streamSpoke,
        playbackConfirmedKinds: { situation_3: true },
        messages: [],
        interviewMoment: 3,
      }),
    ).toBe('');
  });

  it('prepareEmotionTransitionBeforeModalForTts skips S2 closing when stream already spoke client bundle lead', () => {
    const streamSpoke = s2To3BeforeModal;
    expect(
      prepareEmotionTransitionBeforeModalForTts(s2To3BeforeModal, {
        scenarioJustCompleted: 2,
        streamAlreadySpokeBefore: true,
        streamSpokeText: streamSpoke,
        playbackConfirmedKinds: {},
        messages: [],
        interviewMoment: 3,
      }),
    ).toBe('');
  });

  it('prepareEmotionTransitionBeforeModalForTts keeps S3 closing when stream only spoke M4 grudge body', () => {
    const beforeModal =
      "That's the end of the three described situations. Good work, Matt — You recognized Daniel's genuine confusion about how to communicate and how Sophie felt dismissed by the pattern of him leaving. There are only two questions left. Now I want to ask you about something a bit more personal.";
    const streamSpoke =
      "Think of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin.";
    expect(
      prepareEmotionTransitionBeforeModalForTts(beforeModal, {
        scenarioJustCompleted: 3,
        streamAlreadySpokeBefore: true,
        streamSpokeText: streamSpoke,
        playbackConfirmedKinds: { moment_4: true },
        messages: [],
        interviewMoment: 4,
      }),
    ).toContain('end of the three described situations');
  });
});
