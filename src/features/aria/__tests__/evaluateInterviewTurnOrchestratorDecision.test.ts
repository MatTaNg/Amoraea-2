import { describe, expect, it } from '@jest/globals';

import { evaluateInterviewTurnOrchestratorDecision } from '@features/aria/evaluateInterviewTurnOrchestratorDecision';
import { getCanonicalProbeText } from '@features/aria/interviewCanonicalProbeRegistry';
import { SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '@features/aria/scenarioAContemptProbeTtsStrip';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import type { InterviewTurnStateSnapshot } from '@features/aria/interviewTurnOrchestratorTypes';

const baseConstructFlags = (): PreClaudeScenarioConstructProbeFlags => ({
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

const baseSnapshot = (overrides: Partial<InterviewTurnStateSnapshot> = {}): InterviewTurnStateSnapshot => ({
  currentInterviewMoment: 1,
  currentScenario: 1,
  lastAssistantContent: 'Tell me about the dinner scene.',
  lastQuestionText: 'Tell me about the dinner scene.',
  userText: 'I think Emma was being passive aggressive when she said that.',
  transcriptTurnCount: 4,
  ...overrides,
});

describe('evaluateInterviewTurnOrchestratorDecision', () => {
  it('routes score requests to fixed decline line', () => {
    const decision = evaluateInterviewTurnOrchestratorDecision({
      snapshot: baseSnapshot({ userText: 'What is my score so far?' }),
      messages: [],
      constructFlags: baseConstructFlags(),
      metaCommentClassification: null,
    });
    expect(decision.userIntent).toBe('score_request');
    expect(decision.action).toEqual({ kind: 'speak_fixed_line', lineId: 'score_decline' });
  });

  it('routes go-back requests to fixed decline line', () => {
    const decision = evaluateInterviewTurnOrchestratorDecision({
      snapshot: baseSnapshot({ userText: 'Can we go back to the first scenario?' }),
      messages: [],
      constructFlags: baseConstructFlags(),
      metaCommentClassification: null,
    });
    expect(decision.userIntent).toBe('go_back_request');
    expect(decision.action).toEqual({ kind: 'speak_fixed_line', lineId: 'go_back_decline' });
  });

  it('recommends speak_canonical when S1 contempt probe is pending', () => {
    const decision = evaluateInterviewTurnOrchestratorDecision({
      snapshot: baseSnapshot(),
      messages: [],
      constructFlags: {
        ...baseConstructFlags(),
        shouldForceScenarioAContemptProbe: true,
      },
      metaCommentClassification: null,
    });
    expect(decision.pendingProbeId).toBe('s1_contempt');
    expect(decision.action).toEqual({
      kind: 'speak_canonical',
      probeId: 's1_contempt',
    });
  });

  it('marks contempt probe satisfied when already in transcript', () => {
    const decision = evaluateInterviewTurnOrchestratorDecision({
      snapshot: baseSnapshot({ currentInterviewMoment: 1, currentScenario: 1 }),
      messages: [
        { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
        { role: 'user', content: 'She was dismissive.' },
      ],
      constructFlags: baseConstructFlags(),
      metaCommentClassification: null,
    });
    expect(decision.satisfiedProbeIds).toContain('s1_contempt');
    expect(getCanonicalProbeText('s1_contempt')).toBe(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
  });

  it('recommends skip_probe_already_satisfied when contempt construct met on Q1', () => {
    const q1Answer =
      "Emma's tone was contemptuous — that 'very clear' line is pure disdain toward Ryan.";
    const decision = evaluateInterviewTurnOrchestratorDecision({
      snapshot: baseSnapshot({
        userText: q1Answer,
        currentInterviewMoment: 1,
        currentScenario: 1,
      }),
      messages: [{ role: 'user', content: q1Answer, scenarioNumber: 1, interviewMoment: 1 }],
      constructFlags: {
        ...baseConstructFlags(),
        shouldForceScenarioAContemptProbe: true,
        replyingToScenarioAQ1: true,
      },
      metaCommentClassification: null,
    });
    expect(decision.satisfiedProbeIds).toContain('s1_contempt');
    expect(decision.action.kind).toBe('skip_probe_already_satisfied');
  });

  it('delegates to Claude with gentle_redirect for off-topic lines', () => {
    const decision = evaluateInterviewTurnOrchestratorDecision({
      snapshot: baseSnapshot({ userText: 'purple elephant' }),
      messages: [],
      constructFlags: baseConstructFlags(),
      metaCommentClassification: null,
    });
    expect(decision.userIntent).toBe('off_topic');
    expect(decision.action).toEqual({
      kind: 'delegate_claude',
      hint: 'gentle_redirect',
    });
  });
});
