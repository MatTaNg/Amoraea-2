import { describe, expect, it, jest } from '@jest/globals';

import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT } from '@features/aria/moment4SpecificityFollowUp';
import { runPreClaudeMoment4SpecificityGate } from '@features/aria/runPreClaudeMoment4SpecificityGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const VAISHNAVA_GENERIC_OPENER =
  "I'm generally too nice and don't take offense to many things. So in my life, I've never really had anyone that has ever tried to get under my skin. But there was one time where this one guy who thought I had a crush on his girlfriend tried to get back to me, get back on me in a game and we just talked afterwards and figured out that it was just a misunderstanding and we parted ways amicably after that.";

const SPECIFIC_GRUDGE_ANSWER =
  "Yes, this woman cut me off 20 years ago. I'm still upset at her. Some people should not be driving.";

const UNNAMED_CLOSE_FRIEND_GRUDGE =
  "Yeah, I had a close friend about three years ago who I felt completely betrayed by. She shared something I told her in confidence with a group of mutual friends. I was furious and I pulled back for about six months. What I eventually realized was I never actually told her explicitly that I needed that kept private. I assumed it was obvious she didn't handle it well, but I was crying, carrying some responsibility for the gap in expectations too. We talked it out, but it's not the same friendship it was, but there's no active bitterness.";

describe('runPreClaudeMoment4SpecificityGate', () => {
  it('pre-injects M4 commitment threshold when grudge answer is specific (skips Claude API)', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      currentScenarioRef: { current: 3 },
      moment4ThresholdProbeAskedRef: { current: false },
      speakTextSafe,
      setMessages,
    });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
      { role: 'user', content: SPECIFIC_GRUDGE_ANSWER },
    ];

    const result = await runPreClaudeMoment4SpecificityGate(
      deps,
      SPECIFIC_GRUDGE_ANSWER,
      messagesToUse,
      MOMENT_4_GRUDGE_QUESTION_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(result.shouldForceMoment4ThresholdProbe).toBe(true);
    expect(deps.moment4ThresholdProbeAskedRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/work through versus.*walk away/i),
      expect.any(Object),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringMatching(/work through versus.*walk away/i),
        }),
      ]),
    );
  });

  it('heals lagged moment refs and injects canonical threshold after grudge (not invented paraphrase)', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 3 },
      moment4ThresholdProbeAskedRef: { current: false },
      personalHandoffInjectedRef: { current: false },
      lastQuestionTextRef: { current: MOMENT_4_GRUDGE_QUESTION_TEXT },
      speakTextSafe,
      setMessages,
    });
    const jacketGrudge =
      "I got into a fight with my friend, he said I had a bad jacket and I spent a lot of money on that jacket, so I really didn't like him. I still have a grudge against him.";
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
      { role: 'user', content: jacketGrudge },
    ];

    const result = await runPreClaudeMoment4SpecificityGate(
      deps,
      jacketGrudge,
      messagesToUse,
      MOMENT_4_GRUDGE_QUESTION_TEXT,
    );

    expect(deps.currentInterviewMomentRef.current).toBe(4);
    expect(deps.personalHandoffInjectedRef.current).toBe(true);
    expect(result.handled).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/At what point do you decide when a relationship/i),
      expect.any(Object),
    );
    expect(speakTextSafe).not.toHaveBeenCalledWith(
      expect.stringMatching(/someone you care about/i),
      expect.any(Object),
    );
  });

  it('injects M4 specificity follow-up for generic low-specificity grudge answer', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      currentScenarioRef: { current: 3 },
      moment4ClientSpecificityProbeInjectedRef: { current: false },
      moment4PostGrudgeSpecificityResolvedRef: { current: false },
      speakTextSafe,
      setMessages,
    });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
      { role: 'user', content: VAISHNAVA_GENERIC_OPENER },
    ];

    const result = await runPreClaudeMoment4SpecificityGate(
      deps,
      VAISHNAVA_GENERIC_OPENER,
      messagesToUse,
      MOMENT_4_GRUDGE_QUESTION_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(result.shouldForceMoment4ThresholdProbe).toBe(false);
    expect(deps.moment4ClientSpecificityProbeInjectedRef.current).toBe(true);
    expect(deps.moment4ExpectingPostSpecificityUserTurnRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT,
      expect.any(Object),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT,
        }),
      ]),
    );
    expect(deps.probeLogRef.current).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ trigger_reason: 'moment4_low_specificity' }),
      ]),
    );
  });

  it('does not inject M4 specificity follow-up when grudge answer names close friend with event', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      currentScenarioRef: { current: 3 },
      moment4ClientSpecificityProbeInjectedRef: { current: false },
      speakTextSafe,
    });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
      { role: 'user', content: UNNAMED_CLOSE_FRIEND_GRUDGE },
    ];

    const result = await runPreClaudeMoment4SpecificityGate(
      deps,
      UNNAMED_CLOSE_FRIEND_GRUDGE,
      messagesToUse,
      MOMENT_4_GRUDGE_QUESTION_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(result.shouldForceMoment4ThresholdProbe).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/work through versus.*walk away/i),
      expect.any(Object),
    );
  });

  it('forces commitment follow-up after user pushback on specificity probe (resume-safe)', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: false },
      moment4ClientSpecificityProbeInjectedRef: { current: true },
      moment4ExpectingPostSpecificityUserTurnRef: { current: false },
      moment4PostGrudgeSpecificityResolvedRef: { current: true },
      speakTextSafe,
    });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
      { role: 'user', content: UNNAMED_CLOSE_FRIEND_GRUDGE },
      { role: 'assistant', content: MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT },
      { role: 'user', content: 'I just gave you one' },
    ];

    const result = await runPreClaudeMoment4SpecificityGate(
      deps,
      'I just gave you one',
      messagesToUse,
      MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(result.answeringAfterMoment4SpecificityProbe).toBe(true);
    expect(result.shouldForceMoment4ThresholdProbe).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/work through versus.*walk away/i),
      expect.any(Object),
    );
  });

  it('pre-injects commitment when grudge answer names a person without a specific event but is substantive', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4PostGrudgeSpecificityResolvedRef: { current: false },
      speakTextSafe,
    });
    const narcissistGrudge =
      "My ex was a complete narcissist. Manipulative and selfish. I have nothing to say to him ever again. I don't feel bad about it at all. Some people are just toxic and you're better off cutting them out.";
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
      { role: 'user', content: narcissistGrudge },
    ];

    const result = await runPreClaudeMoment4SpecificityGate(
      deps,
      narcissistGrudge,
      messagesToUse,
      MOMENT_4_GRUDGE_QUESTION_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(result.shouldForceMoment4ThresholdProbe).toBe(true);
    expect(deps.moment4PostGrudgeSpecificityResolvedRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/work through versus.*walk away/i),
      expect.any(Object),
    );
  });
});
