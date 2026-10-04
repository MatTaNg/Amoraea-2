import { describe, expect, it, jest } from '@jest/globals';

import {
  looksLikeMomentSupportNoSituationHypothetical,
  MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_SPOKEN,
  MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT,
  MOMENT_SUPPORT_QUESTION_TEXT,
  userLacksLivedSupportSituation,
} from '../moment4ProbeLogic';
import { runPreClaudeSupportNoSituationHypotheticalGate } from '../runPreClaudeSupportNoSituationHypotheticalGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('userLacksLivedSupportSituation', () => {
  it('matches a missing situation, including a missing apostrophe', () => {
    expect(userLacksLivedSupportSituation("I don't have a situation")).toBe(true);
    expect(userLacksLivedSupportSituation('I dont have a situation')).toBe(true);
    expect(userLacksLivedSupportSituation('I dont have a sitation')).toBe(true);
    expect(userLacksLivedSupportSituation("Nothing comes to mind.")).toBe(true);
    expect(userLacksLivedSupportSituation("I can't think of a time like that.")).toBe(true);
    expect(userLacksLivedSupportSituation("I can't think of one.")).toBe(true);
    expect(userLacksLivedSupportSituation("I can't think of anyone")).toBe(true);
    expect(userLacksLivedSupportSituation("I can't think of any")).toBe(true);
    expect(userLacksLivedSupportSituation("I can't think of anybody.")).toBe(true);
    expect(userLacksLivedSupportSituation("I can't think of anyone right now")).toBe(true);
    expect(userLacksLivedSupportSituation("I've never been in that situation.")).toBe(true);
  });

  it('acknowledges a missing example, then asks one support question', () => {
    expect(MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT).toBe(
      'If someone close to you was stressed and needed your support, what would you do?',
    );
    expect(MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_SPOKEN).toBe(
      `No problem. ${MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT}`,
    );
    expect(MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_SPOKEN.toLowerCase()).not.toContain(
      'that makes a lot of sense',
    );
    expect(MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_SPOKEN.toLowerCase()).not.toContain("that's okay");
    expect(looksLikeMomentSupportNoSituationHypothetical(MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_SPOKEN)).toBe(
      true,
    );
    expect(
      looksLikeMomentSupportNoSituationHypothetical(
        "That's okay. What would you do if someone close to you was stressed and needed your support? How would you respond?",
      ),
    ).toBe(true);
  });

  it('does not treat a developed answer that mentions not thinking of anyone as a missing example', () => {
    expect(
      userLacksLivedSupportSituation(
        "I can't think of anyone specific, but when my sister was stressed I sat with her and listened until she calmed down.",
      ),
    ).toBe(false);
  });

  it('does not treat a real support story as a missing example', () => {
    expect(
      userLacksLivedSupportSituation(
        "I don't have a situation at work, but when my sister was stressed I sat with her and listened until she calmed down and then I asked what she needed.",
      ),
    ).toBe(false);
  });
});

describe('runPreClaudeSupportNoSituationHypotheticalGate', () => {
  it('asks the hypothetical when the support answer is that they have no situation', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      messages: [{ role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT, interviewMoment: 4 }],
      speakTextSafe,
      setMessages,
    });

    const result = await runPreClaudeSupportNoSituationHypotheticalGate(
      deps,
      "I don't have a situation",
    );

    expect(result).toEqual({ handled: true });
    expect(setMessages).toHaveBeenCalledWith([
      { role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT, interviewMoment: 4 },
      { role: 'user', content: "I don't have a situation", interviewMoment: 4 },
      {
        role: 'assistant',
        content: MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_SPOKEN,
        interviewMoment: 4,
      },
    ]);
    expect(speakTextSafe).toHaveBeenCalledWith(
      MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_SPOKEN,
      expect.any(Object),
    );
    expect(deps.lastQuestionTextRef.current).toBe(MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT);
  });

  it('asks the hypothetical when the transcript is a cut-off "can\'t think of any"', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      messages: [{ role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT, interviewMoment: 4 }],
      speakTextSafe,
    });

    const result = await runPreClaudeSupportNoSituationHypotheticalGate(deps, "I can't think of any");

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_SPOKEN,
      expect.any(Object),
    );
  });

  it('leaves a real support story for the normal flow', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      messages: [{ role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT }],
      speakTextSafe,
    });

    const result = await runPreClaudeSupportNoSituationHypotheticalGate(
      deps,
      'She got bad news about her job so I sat with her and listened.',
    );

    expect(result).toEqual({ handled: false });
    expect(speakTextSafe).not.toHaveBeenCalled();
  });
});
