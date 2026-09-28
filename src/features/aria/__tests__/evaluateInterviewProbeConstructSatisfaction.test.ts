import { describe, expect, it } from '@jest/globals';

import { evaluateInterviewProbeConstructSatisfaction } from '@features/aria/evaluateInterviewProbeConstructSatisfaction';
import { SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '@features/aria/scenarioAContemptProbeTtsStrip';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';

const baseFlags = (): PreClaudeScenarioConstructProbeFlags => ({
  replyingToScenarioAQ1: false,
  replyingToScenarioBQ1: false,
  replyingToScenarioCQ1: false,
  scenarioAContemptGateUserText: '',
  shouldForceScenarioAContemptProbe: false,
  shouldForceScenarioBFullAppreciationProbe: false,
  shouldForceScenarioBJamesRepairProbe: false,
  shouldForceScenarioCRepairProbe: false,
  shouldForceScenarioCSophiePerspectiveProbe: false,
  specificEmmaLineAlreadyAddressed: false,
  sidedEntirelyWithJames: false,
  scenarioBQ1Engaged: false,
  muteParallelTtsForScenarioAContemptProbeStream: false,
  muteParallelTtsForS3ToM4HandoffStream: false,
  allowScenarioARepairAfterContemptAnswer: false,
});

describe('evaluateInterviewProbeConstructSatisfaction', () => {
  it('marks s1_contempt satisfied when specificEmmaLineAlreadyAddressed flag is set', () => {
    const result = evaluateInterviewProbeConstructSatisfaction({
      probeId: 's1_contempt',
      messages: [],
      userText: 'Emma was dismissive toward Ryan.',
      constructFlags: { ...baseFlags(), specificEmmaLineAlreadyAddressed: true },
    });
    expect(result.satisfied).toBe(true);
    expect(result.source).toBe('legacy_flag');
  });

  it('marks s1_contempt satisfied when Q1 answer covers Emma closing line', () => {
    const q1Answer =
      "Emma's tone was contemptuous — that 'very clear' line is pure disdain toward Ryan when he tried to plan something nice.";
    const result = evaluateInterviewProbeConstructSatisfaction({
      probeId: 's1_contempt',
      messages: [{ role: 'user', content: q1Answer, scenarioNumber: 1, interviewMoment: 1 }],
      userText: q1Answer,
      constructFlags: baseFlags(),
    });
    expect(result.satisfied).toBe(true);
    expect(result.source).toBe('user_transcript');
  });

  it('marks s2_james_differently satisfied when user jumped ahead on Q1', () => {
    const answer =
      'James could have celebrated with her instead of treating the promotion like pure logistics.';
    const result = evaluateInterviewProbeConstructSatisfaction({
      probeId: 's2_james_differently',
      messages: [{ role: 'user', content: answer, scenarioNumber: 2, interviewMoment: 2 }],
      userText: answer,
      constructFlags: baseFlags(),
    });
    expect(result.satisfied).toBe(true);
    expect(result.reason).toContain('ahead_of_schedule');
  });

  it('marks probe satisfied when verbatim probe already in transcript', () => {
    const result = evaluateInterviewProbeConstructSatisfaction({
      probeId: 's1_contempt',
      messages: [{ role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY }],
      userText: 'ok',
      constructFlags: baseFlags(),
    });
    expect(result.satisfied).toBe(true);
    expect(result.source).toBe('transcript_delivered');
  });

  it('does not mark s2_james_differently satisfied for shallow Q1 engagement only', () => {
    const result = evaluateInterviewProbeConstructSatisfaction({
      probeId: 's2_james_differently',
      messages: [{ role: 'user', content: 'James was wrong.', scenarioNumber: 2, interviewMoment: 2 }],
      userText: 'James was wrong.',
      constructFlags: baseFlags(),
    });
    expect(result.satisfied).toBe(false);
  });

  it('does not mark s1_repair satisfied from loose third-person Ryan advice without repair prompt context', () => {
    const answer =
      'They have a difference in priorities. Ryan should be able to tell their family that they will call them back if they really liked Emma and wanted to spend time with her.';
    const result = evaluateInterviewProbeConstructSatisfaction({
      probeId: 's1_repair',
      messages: [
        {
          role: 'assistant',
          content: "Great, let's stay on this one then. Just try your best. You've got this.",
          scenarioNumber: 1,
        },
        { role: 'user', content: answer, scenarioNumber: 1 },
      ],
      userText: answer,
      constructFlags: baseFlags(),
    });
    expect(result.satisfied).toBe(false);
    expect(result.reason).toBe('repair_construct_not_met');
  });

  it('marks s1_repair satisfied when user answered the canonical Ryan repair prompt', () => {
    const answer =
      "If I were Ryan, I would tell my family I'll call them back and prioritize Emma on date night.";
    const result = evaluateInterviewProbeConstructSatisfaction({
      probeId: 's1_repair',
      messages: [
        {
          role: 'assistant',
          content: 'If you were Ryan, how would you repair this?',
          scenarioNumber: 1,
        },
        { role: 'user', content: answer, scenarioNumber: 1 },
      ],
      userText: answer,
      constructFlags: baseFlags(),
    });
    expect(result.satisfied).toBe(true);
  });
});
