import {
  SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE,
  withSkipAcceptedNextQuestionBridgePreserved,
} from '@features/aria/skipAcceptedNextQuestionBridge';
import {
  coerceScenarioBJamesDifferentlyQuestionForTts,
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';

describe('skip-accept bridge TTS coerce', () => {
  it('preserves skip acknowledgment when coercing James-differently for TTS', () => {
    const spoken = `${SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE} ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`;
    const out = coerceScenarioBJamesDifferentlyQuestionForTts(spoken);
    expect(out).toMatch(/we(?:'ve| have) skipped this one/i);
    expect(out).toContain(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
    expect(out.startsWith(SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE)).toBe(true);
  });

  it('preserves legacy "we can skip" bridge through James coerce', () => {
    const spoken = `Okay, we can skip this one, the next question is ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`;
    const out = coerceScenarioBJamesDifferentlyQuestionForTts(spoken);
    expect(out).toMatch(/skipped this one|we can skip this one/i);
    expect(out).toContain(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
  });

  it('withSkipAcceptedNextQuestionBridgePreserved reattaches after inner map', () => {
    const spoken = `${SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE} What do you think is going on here?`;
    const out = withSkipAcceptedNextQuestionBridgePreserved(spoken, () => SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);
    expect(out).toBe(`${SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE} ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`);
  });
});
