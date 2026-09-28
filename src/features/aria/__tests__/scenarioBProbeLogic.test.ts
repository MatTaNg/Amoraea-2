import { describe, expect, it } from '@jest/globals';

import {
  countScenarioBSubstantiveUserTurns,
  countScenarioBUserTurns,
  scenarioBMinimumEngagementForHandoff,
} from '@features/aria/scenarioBProbeLogic';

describe('scenarioBProbeLogic handoff engagement', () => {
  const devJumpMetaOnlyMessages = [
    {
      role: 'assistant' as const,
      content:
        "Sarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait. James is on a deadline, says 'that's amazing, let's celebrate tonight.' What do you think is going on here?",
      scenarioNumber: 2,
    },
    { role: 'user' as const, content: 'Give a question.', scenarioNumber: 2 },
    { role: 'assistant' as const, content: 'What do you think is going on here?', scenarioNumber: 2 },
    {
      role: 'user' as const,
      content:
        "Again, there's nothing really to comment on. She gets a job offer, he asks a question, she tears up, am I supposed to be making assumptions as to why she's tearing up? So far there's no new questions.",
      scenarioNumber: 2,
    },
  ];

  it('counts only substantive Scenario B user turns toward handoff minimum', () => {
    expect(countScenarioBUserTurns(devJumpMetaOnlyMessages)).toBe(2);
    expect(countScenarioBSubstantiveUserTurns(devJumpMetaOnlyMessages)).toBe(0);
    expect(scenarioBMinimumEngagementForHandoff(devJumpMetaOnlyMessages)).toBe(false);
  });

  it('meets coerce second-block preconditions for dev jump meta-only turns', () => {
    const s1Handoff =
      "Good work — that's the end of this scenario. Here's the next situation.\n\nSarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait. James is on a deadline, says 'that's amazing, let's celebrate tonight.' What do you think is going on here?";
    const userStarted =
      countScenarioBUserTurns(devJumpMetaOnlyMessages) > 0 ||
      devJumpMetaOnlyMessages.some((m) => m.role === 'user' && m.scenarioNumber === 2);
    const isLegitimate =
      /sarah has been job hunting for four months/i.test(s1Handoff) ||
      /that's the end of this scenario|here's the next situation/i.test(s1Handoff);
    const secondBlock =
      true &&
      2 === 2 &&
      !scenarioBMinimumEngagementForHandoff(devJumpMetaOnlyMessages) &&
      (userStarted || !isLegitimate);
    expect(userStarted).toBe(true);
    expect(isLegitimate).toBe(true);
    expect(secondBlock).toBe(true);
  });

  it('meets handoff after a James-differently answer without hypothetical repair', () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: 'What do you think James could have done differently to help Sarah feel appreciated?',
        scenarioNumber: 2,
      },
      {
        role: 'user' as const,
        content: 'He could have put the deadline aside and asked how she felt about the offer.',
        scenarioNumber: 2,
      },
    ];
    expect(scenarioBMinimumEngagementForHandoff(messages)).toBe(true);
  });
});
