import { describe, expect, it } from '@jest/globals';

import { compareInterviewTurnOrchestratorDecisions } from '@features/aria/compareInterviewTurnOrchestratorDecisions';
import { parseInterviewTurnOrchestratorLlmJson } from '@features/aria/parseInterviewTurnOrchestratorLlmJson';
import type { InterviewTurnOrchestratorDecision } from '@features/aria/interviewTurnOrchestratorTypes';

const basePreview = 'What do you think Emma meant?';

function heuristicDecision(
  overrides: Partial<InterviewTurnOrchestratorDecision> = {},
): InterviewTurnOrchestratorDecision {
  return {
    source: 'heuristic_v1',
    userIntent: 'substantive_answer',
    activeQuestionPreview: basePreview,
    satisfiedProbeIds: [],
    pendingProbeId: 's1_contempt',
    activeConstructEngaged: true,
    action: { kind: 'skip_probe_already_satisfied', probeId: 's1_contempt' },
    reason: 'intent=substantive_answer',
    ...overrides,
  };
}

describe('parseInterviewTurnOrchestratorLlmJson', () => {
  it('parses valid delegate_claude JSON', () => {
    const parsed = parseInterviewTurnOrchestratorLlmJson({
      raw: JSON.stringify({
        userIntent: 'off_topic',
        activeConstructEngaged: false,
        satisfiedProbeIds: [],
        pendingProbeId: null,
        action: { kind: 'delegate_claude', hint: 'gentle_redirect' },
        reason: 'user went off-topic',
      }),
      activeQuestionPreview: basePreview,
    });
    expect(parsed?.source).toBe('llm_v1');
    expect(parsed?.userIntent).toBe('off_topic');
    expect(parsed?.action).toEqual({
      kind: 'delegate_claude',
      hint: 'gentle_redirect',
    });
  });

  it('parses speak_canonical with probe id', () => {
    const parsed = parseInterviewTurnOrchestratorLlmJson({
      raw: `Here is the plan:\n${JSON.stringify({
        userIntent: 'unclear',
        activeConstructEngaged: false,
        satisfiedProbeIds: [],
        pendingProbeId: 's2_james_differently',
        action: { kind: 'speak_canonical', probeId: 's2_james_differently', withBriefAck: true },
        reason: 'thin answer',
      })}`,
      activeQuestionPreview: basePreview,
    });
    expect(parsed?.action).toEqual({
      kind: 'speak_canonical',
      probeId: 's2_james_differently',
      withBriefAck: true,
    });
  });

  it('rejects invalid probe ids', () => {
    const parsed = parseInterviewTurnOrchestratorLlmJson({
      raw: JSON.stringify({
        userIntent: 'substantive_answer',
        activeConstructEngaged: true,
        satisfiedProbeIds: ['not_a_probe'],
        pendingProbeId: 'not_a_probe',
        action: { kind: 'speak_canonical', probeId: 'not_a_probe' },
        reason: 'bad',
      }),
      activeQuestionPreview: basePreview,
    });
    expect(parsed).toBeNull();
  });

  it('rejects unknown action kinds', () => {
    const parsed = parseInterviewTurnOrchestratorLlmJson({
      raw: JSON.stringify({
        userIntent: 'substantive_answer',
        activeConstructEngaged: true,
        satisfiedProbeIds: [],
        pendingProbeId: null,
        action: { kind: 'invent_action' },
        reason: 'bad',
      }),
      activeQuestionPreview: basePreview,
    });
    expect(parsed).toBeNull();
  });
});

describe('compareInterviewTurnOrchestratorDecisions', () => {
  it('reports full agreement when plans match', () => {
    const h = heuristicDecision();
    const l = heuristicDecision({ source: 'llm_v1', reason: 'llm plan' });
    expect(compareInterviewTurnOrchestratorDecisions(h, l)).toEqual({
      actionKindAgrees: true,
      userIntentAgrees: true,
      pendingProbeAgrees: true,
      probeActionAgrees: true,
      fullyAgrees: true,
    });
  });

  it('flags action kind mismatch', () => {
    const h = heuristicDecision({
      action: { kind: 'speak_canonical', probeId: 's1_contempt' },
    });
    const l = heuristicDecision({
      source: 'llm_v1',
      action: { kind: 'skip_probe_already_satisfied', probeId: 's1_contempt' },
    });
    const cmp = compareInterviewTurnOrchestratorDecisions(h, l);
    expect(cmp.actionKindAgrees).toBe(false);
    expect(cmp.probeActionAgrees).toBe(true);
    expect(cmp.fullyAgrees).toBe(false);
  });

  it('flags probe id mismatch for canonical actions', () => {
    const h = heuristicDecision({
      pendingProbeId: 's1_contempt',
      action: { kind: 'speak_canonical', probeId: 's1_contempt' },
    });
    const l = heuristicDecision({
      source: 'llm_v1',
      pendingProbeId: 's1_repair',
      action: { kind: 'speak_canonical', probeId: 's1_repair' },
    });
    const cmp = compareInterviewTurnOrchestratorDecisions(h, l);
    expect(cmp.probeActionAgrees).toBe(false);
    expect(cmp.fullyAgrees).toBe(false);
  });
});
