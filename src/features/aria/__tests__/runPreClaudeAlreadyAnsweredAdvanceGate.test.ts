import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { runPreClaudeAlreadyAnsweredAdvanceGate } from '@features/aria/runPreClaudeAlreadyAnsweredAdvanceGate';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@features/aria/deliverInterviewCanonicalProbe', () => ({
  deliverInterviewCanonicalProbe: jest.fn(),
}));

jest.mock('@features/aria/deliverClientOwnedScenarioHandoffOpening', () => ({
  deliverClientOwnedScenario3OpeningAfterS2Repair: jest.fn(),
}));

import { deliverInterviewCanonicalProbe } from '@features/aria/deliverInterviewCanonicalProbe';
import { deliverClientOwnedScenario3OpeningAfterS2Repair } from '@features/aria/deliverClientOwnedScenarioHandoffOpening';

const mockDeliverProbe = jest.mocked(deliverInterviewCanonicalProbe);
const mockDeliverS3Opening = jest.mocked(deliverClientOwnedScenario3OpeningAfterS2Repair);

describe('runPreClaudeAlreadyAnsweredAdvanceGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeliverProbe.mockResolvedValue(undefined);
    mockDeliverS3Opening.mockResolvedValue(false);
  });

  it('returns handled false for non-already-answered turns', async () => {
    const deps = createMockPreClaudeDeps();
    const result = await runPreClaudeAlreadyAnsweredAdvanceGate(
      deps,
      'James could apologize and listen more.',
      [],
      null,
    );
    expect(result).toEqual({ handled: false });
  });

  it('advances one hop to Scenario 3 when James repair is substantively satisfied', async () => {
    const repairAnswer =
      'If I were James I would apologize sincerely and ask Sarah what she needed to feel appreciated.';
    const messages = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL, scenarioNumber: 2, interviewMoment: 2 },
      { role: 'user', content: repairAnswer, scenarioNumber: 2, interviewMoment: 2 },
      {
        role: 'user',
        content: 'I thought I already answered this question.',
        scenarioNumber: 2,
        interviewMoment: 2,
      },
    ];
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      lastQuestionTextRef: { current: SCENARIO_B_JAMES_REPAIR_CANONICAL },
      messages: messages as never,
    });

    const result = await runPreClaudeAlreadyAnsweredAdvanceGate(
      deps,
      'I thought I already answered this question.',
      messages as never,
      { type: 'already_answered', confidence: 0.67 },
    );

    expect(result).toEqual({ handled: true });
    expect(mockDeliverS3Opening).toHaveBeenCalled();
    expect(mockDeliverProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        probeId: 's3_sophie_perspective',
        ackPrefix: expect.stringMatching(/You're right/i),
        logTag: '[ALREADY_ANSWERED_ADVANCE_CLIENT_OWNED]',
      }),
    );
    expect(mockDeliverProbe).not.toHaveBeenCalledWith(
      expect.objectContaining({ probeId: 'm4_grudge' }),
    );
  });

  it('clarifies what is needed and re-asks repair when prior answer did not satisfy repair', async () => {
    const differentlyAnswer =
      "I think there's a pattern of behavior with James and this might be the first time he's generally showed up.";
    const messages = [
      {
        role: 'assistant',
        content: SCENARIO_B_JAMES_REPAIR_CANONICAL,
        scenarioNumber: 2,
        interviewMoment: 2,
      },
      { role: 'user', content: differentlyAnswer, scenarioNumber: 2, interviewMoment: 2 },
      {
        role: 'user',
        content: 'Then I answer that already',
        scenarioNumber: 2,
        interviewMoment: 2,
      },
    ];
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      lastQuestionTextRef: { current: SCENARIO_B_JAMES_REPAIR_CANONICAL },
      messages: messages as never,
    });

    const result = await runPreClaudeAlreadyAnsweredAdvanceGate(
      deps,
      'Then I answer that already',
      messages as never,
      null,
    );

    expect(result).toEqual({ handled: true });
    expect(mockDeliverS3Opening).not.toHaveBeenCalled();
    expect(mockDeliverProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        probeId: 's2_james_repair',
        ackPrefix: expect.stringMatching(/what i'm looking for here is/i),
        logTag: '[ALREADY_ANSWERED_CLARIFY_REASK_CLIENT_OWNED]',
      }),
    );
  });

  it('clarifies and re-asks M4 grudge when user claims already answered with no prior substantive', async () => {
    const messages = [
      {
        role: 'assistant',
        content: MOMENT_4_GRUDGE_QUESTION_TEXT,
        scenarioNumber: 3,
        interviewMoment: 4,
      },
      {
        role: 'user',
        content: 'I thought I answered this already.',
        scenarioNumber: 3,
        interviewMoment: 4,
      },
    ];
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      currentScenarioRef: { current: 3 },
      lastQuestionTextRef: { current: MOMENT_4_GRUDGE_QUESTION_TEXT },
      messages: messages as never,
    });

    const result = await runPreClaudeAlreadyAnsweredAdvanceGate(
      deps,
      'I thought I answered this already.',
      messages as never,
      { type: 'already_answered', confidence: 0.62 },
    );

    expect(result).toEqual({ handled: true });
    expect(mockDeliverProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        probeId: 'm4_grudge',
        ackPrefix: expect.stringMatching(/what i'm looking for here is/i),
        logTag: '[ALREADY_ANSWERED_CLARIFY_REASK_CLIENT_OWNED]',
      }),
    );
  });

  it('detects already answered phrasing on James differently without meta classification', async () => {
    const messages = [
      {
        role: 'assistant',
        content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
        scenarioNumber: 2,
        interviewMoment: 2,
      },
      {
        role: 'user',
        content:
          'James could have planned something special and told Sarah how much he appreciated her before the fight.',
        scenarioNumber: 2,
        interviewMoment: 2,
      },
      {
        role: 'user',
        content: "Didn't I already answer this question?",
        scenarioNumber: 2,
        interviewMoment: 2,
      },
    ];
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      lastQuestionTextRef: { current: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
      messages: messages as never,
    });

    const result = await runPreClaudeAlreadyAnsweredAdvanceGate(
      deps,
      "Didn't I already answer this question?",
      messages as never,
      null,
    );

    expect(result).toEqual({ handled: true });
    expect(mockDeliverProbe).toHaveBeenCalledWith(
      expect.objectContaining({ probeId: 's3_sophie_perspective' }),
    );
    expect(mockDeliverProbe).not.toHaveBeenCalledWith(
      expect.objectContaining({ probeId: 's2_james_repair' }),
    );
  });
});
