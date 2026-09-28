import { describe, expect, it, jest } from '@jest/globals';

import { deliverInterviewCanonicalProbe } from '@features/aria/deliverInterviewCanonicalProbe';
import { runPreClaudeOrchestratorExecuteGate } from '@features/aria/runPreClaudeOrchestratorExecuteGate';
import { speakInterviewOrchestratorFixedLine } from '@features/aria/speakInterviewOrchestratorFixedLine';
import type { InterviewTurnOrchestratorDecision } from '@features/aria/interviewTurnOrchestratorTypes';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

jest.mock('@features/aria/deliverInterviewCanonicalProbe', () => ({
  deliverInterviewCanonicalProbe: jest.fn(async () => undefined),
}));
jest.mock('@features/aria/speakInterviewOrchestratorFixedLine', () => ({
  speakInterviewOrchestratorFixedLine: jest.fn(async () => true),
}));
jest.mock('@features/aria/deliverMoment4CommitmentThresholdProbe', () => ({
  deliverMoment4CommitmentThresholdProbe: jest.fn(async () => false),
}));
jest.mock('@features/aria/runPreClaudeMoment5QuestionInjectGate', () => ({
  runPreClaudeMoment5QuestionInjectGate: jest.fn(async () => ({ handled: false })),
}));

const deliverMock = deliverInterviewCanonicalProbe as jest.MockedFunction<
  typeof deliverInterviewCanonicalProbe
>;
const fixedLineMock = speakInterviewOrchestratorFixedLine as jest.MockedFunction<
  typeof speakInterviewOrchestratorFixedLine
>;

function baseDecision(
  overrides: Partial<InterviewTurnOrchestratorDecision> = {},
): InterviewTurnOrchestratorDecision {
  return {
    source: 'heuristic_v1',
    userIntent: 'substantive_answer',
    activeQuestionPreview: 'preview',
    satisfiedProbeIds: [],
    pendingProbeId: 's1_contempt',
    activeConstructEngaged: true,
    action: { kind: 'delegate_claude' },
    reason: 'test',
    ...overrides,
  };
}

function baseDeps(): PreClaudeTurnGateDeps {
  return {
    interviewSessionIdRef: { current: 'sess-1' },
    setVoiceState: jest.fn(),
    setIsWaiting: jest.fn(),
  } as unknown as PreClaudeTurnGateDeps;
}

describe('runPreClaudeOrchestratorExecuteGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executes score decline fixed line', async () => {
    const result = await runPreClaudeOrchestratorExecuteGate({
      deps: baseDeps(),
      trimmed: "what's my score",
      messagesToUse: [],
      participantFirstNameForSpoken: 'Alex',
      suppressForcedConstructProbesForMetaFrustration: false,
      decision: baseDecision({
        userIntent: 'score_request',
        action: { kind: 'speak_fixed_line', lineId: 'score_decline' },
      }),
    });
    expect(result.handled).toBe(true);
    expect(fixedLineMock).toHaveBeenCalled();
  });

  it('delivers scenario canonical probe', async () => {
    const result = await runPreClaudeOrchestratorExecuteGate({
      deps: baseDeps(),
      trimmed: 'Emma showed contempt in her tone when she said it was very clear to Ryan.',
      messagesToUse: [],
      participantFirstNameForSpoken: 'Alex',
      suppressForcedConstructProbesForMetaFrustration: false,
      decision: baseDecision({
        action: { kind: 'speak_canonical', probeId: 's1_contempt' },
      }),
    });
    expect(result.handled).toBe(true);
    expect(deliverMock).toHaveBeenCalledWith(
      expect.objectContaining({ probeId: 's1_contempt' }),
    );
  });

  it('returns skipped probe id without halting turn', async () => {
    const result = await runPreClaudeOrchestratorExecuteGate({
      deps: baseDeps(),
      trimmed: 'Emma showed contempt in her tone.',
      messagesToUse: [],
      participantFirstNameForSpoken: 'Alex',
      suppressForcedConstructProbesForMetaFrustration: false,
      decision: baseDecision({
        action: {
          kind: 'skip_probe_already_satisfied',
          probeId: 's1_contempt',
        },
      }),
    });
    expect(result.handled).toBe(false);
    expect(result.skippedProbeId).toBe('s1_contempt');
  });
});
