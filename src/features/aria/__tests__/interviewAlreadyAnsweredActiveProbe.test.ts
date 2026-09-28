import { describe, expect, it } from '@jest/globals';

import {
  evaluateActiveProbeSubstantivelyAnswered,
  resolveAlreadyAnsweredSingleHopAdvanceProbeId,
} from '@features/aria/interviewAlreadyAnsweredActiveProbe';
import { evaluateInterviewProbeConstructSatisfaction } from '@features/aria/evaluateInterviewProbeConstructSatisfaction';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';

const emptyFlags = {} as PreClaudeScenarioConstructProbeFlags;

describe('interviewAlreadyAnsweredActiveProbe', () => {
  it('does not treat verbatim probe delivery as substantive satisfaction', () => {
    const messages: MessageWithScenario[] = [
      {
        role: 'assistant',
        content: SCENARIO_B_JAMES_REPAIR_CANONICAL,
        scenarioNumber: 2,
        interviewMoment: 2,
      },
    ];
    const withShortcut = evaluateInterviewProbeConstructSatisfaction({
      probeId: 's2_james_repair',
      messages,
      userText: '',
      constructFlags: emptyFlags,
    });
    const substantive = evaluateActiveProbeSubstantivelyAnswered({
      probeId: 's2_james_repair',
      messages,
      userText: '',
      constructFlags: emptyFlags,
    });
    expect(withShortcut.satisfied).toBe(true);
    expect(withShortcut.source).toBe('transcript_delivered');
    expect(substantive.satisfied).toBe(false);
  });

  it('single-hop advance from repair goes to s3, never m4', () => {
    const repairAnswer =
      'If I were James I would apologize sincerely and ask Sarah what she needed to feel appreciated.';
    const messages: MessageWithScenario[] = [
      {
        role: 'assistant',
        content: SCENARIO_B_JAMES_REPAIR_CANONICAL,
        scenarioNumber: 2,
        interviewMoment: 2,
      },
      { role: 'user', content: repairAnswer, scenarioNumber: 2, interviewMoment: 2 },
    ];
    const advance = resolveAlreadyAnsweredSingleHopAdvanceProbeId({
      activeProbeId: 's2_james_repair',
      messages,
      userText: repairAnswer,
      constructFlags: emptyFlags,
    });
    expect(advance).toBe('s3_sophie_perspective');
    expect(advance).not.toBe('m4_grudge');
  });

  it('does not advance when James pattern answer did not satisfy repair', () => {
    const differentlyAnswer =
      "I think there's a pattern of behavior with James and this might be the first time he's generally showed up.";
    const messages: MessageWithScenario[] = [
      {
        role: 'assistant',
        content: SCENARIO_B_JAMES_REPAIR_CANONICAL,
        scenarioNumber: 2,
        interviewMoment: 2,
      },
      { role: 'user', content: differentlyAnswer, scenarioNumber: 2, interviewMoment: 2 },
    ];
    const answered = evaluateActiveProbeSubstantivelyAnswered({
      probeId: 's2_james_repair',
      messages,
      userText: differentlyAnswer,
      constructFlags: emptyFlags,
    });
    expect(answered.satisfied).toBe(false);
    expect(
      resolveAlreadyAnsweredSingleHopAdvanceProbeId({
        activeProbeId: 's2_james_repair',
        messages,
        userText: differentlyAnswer,
        constructFlags: emptyFlags,
      }),
    ).toBeNull();
  });

  it('advances from James differently when that construct is met', () => {
    const differentlyAnswer =
      'James could have planned something special and told Sarah how much he appreciated her before the fight.';
    const messages: MessageWithScenario[] = [
      {
        role: 'assistant',
        content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
        scenarioNumber: 2,
        interviewMoment: 2,
      },
      { role: 'user', content: differentlyAnswer, scenarioNumber: 2, interviewMoment: 2 },
    ];
    expect(
      resolveAlreadyAnsweredSingleHopAdvanceProbeId({
        activeProbeId: 's2_james_differently',
        messages,
        userText: differentlyAnswer,
        constructFlags: emptyFlags,
      }),
    ).toBe('s3_sophie_perspective');
  });
});
