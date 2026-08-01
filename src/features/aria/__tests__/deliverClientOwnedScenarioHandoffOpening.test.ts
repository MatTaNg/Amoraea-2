import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { createInitialParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import {
  deliverClientOwnedScenario2OpeningAfterS1Repair,
  shouldDeliverClientOwnedScenario2Opening,
  shouldDeliverClientOwnedScenario3Opening,
} from '@features/aria/deliverClientOwnedScenarioHandoffOpening';
import { SCENARIO_2_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '@features/aria/scenarioAContemptProbeTtsStrip';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';
import { runPreClaudePostCommitGates } from '@features/aria/runPreClaudePostCommitGates';

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

const s1RepairMessages = [
  {
    role: 'assistant' as const,
    content: 'What do you think is going on between these two?',
    scenarioNumber: 1,
    interviewMoment: 1,
  },
  {
    role: 'user' as const,
    content: 'Phone use is disrespectful on a date.',
    scenarioNumber: 1,
    interviewMoment: 1,
  },
  {
    role: 'assistant' as const,
    content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    scenarioNumber: 1,
    interviewMoment: 1,
  },
  {
    role: 'user' as const,
    content: 'That sounds dismissive and contemptuous to me.',
    scenarioNumber: 1,
    interviewMoment: 1,
  },
  {
    role: 'assistant' as const,
    content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    scenarioNumber: 1,
    interviewMoment: 1,
  },
  {
    role: 'user' as const,
    content:
      "I would apologize to Emma and set boundaries so all calls go to voicemail during dates and commit to that.",
    scenarioNumber: 1,
    interviewMoment: 1,
  },
];

const s2RepairMessages = [
  {
    role: 'assistant' as const,
    content: SCENARIO_2_TEXT,
    scenarioNumber: 2,
    interviewMoment: 2,
  },
  {
    role: 'user' as const,
    content: 'They have different job priorities.',
    scenarioNumber: 2,
    interviewMoment: 2,
  },
  {
    role: 'assistant' as const,
    content: 'And if you were James, how would you repair?',
    scenarioNumber: 2,
    interviewMoment: 2,
  },
  {
    role: 'user' as const,
    content:
      'If I were James, I would apologize and reflect on my behavior and assure her that I will try to be better in the future.',
    scenarioNumber: 2,
    interviewMoment: 2,
  },
];

const emptySkipMeta = {
  frustrationSkipDeclinePipeline: false,
  skipConfirmationGreetingReconnectInjection: false,
  inabilityInvitationClientInjection: false,
  inabilityEscalationSkipInjection: false,
  proactiveScenarioSkipConfirmationInjection: false,
  skipRequestMetaConfirmationInjection: false,
  frustrationSkipAcceptancePipeline: false,
  skipRequestConfirmationSpeech: '',
};

describe('shouldDeliverClientOwnedScenario2Opening', () => {
  it('is true after Scenario 1 repair when still on moment 1', () => {
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
    });
    expect(shouldDeliverClientOwnedScenario2Opening(deps, s1RepairMessages)).toBe(true);
  });

  it('is false once situation_2 playback is already confirmed', () => {
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: {
        current: { situation_2: true },
      },
    });
    expect(shouldDeliverClientOwnedScenario2Opening(deps, s1RepairMessages)).toBe(false);
  });

  it('is false when Situation 2 vignette is already in the transcript', () => {
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
    });
    expect(
      shouldDeliverClientOwnedScenario2Opening(deps, [
        ...s1RepairMessages,
        {
          role: 'assistant',
          content: SCENARIO_2_TEXT,
          scenarioNumber: 2,
          interviewMoment: 2,
        },
      ]),
    ).toBe(false);
  });
});

describe('shouldDeliverClientOwnedScenario3Opening', () => {
  it('is true after Scenario 2 repair when still on moment 2', () => {
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 2 },
      currentInterviewMomentRef: { current: 2 },
    });
    expect(shouldDeliverClientOwnedScenario3Opening(deps, s2RepairMessages)).toBe(true);
  });

  it('is true after skip-decline re-ask and a substantive James repair answer', () => {
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 2 },
      currentInterviewMomentRef: { current: 2 },
    });
    const messages = [
      ...s2RepairMessages.slice(0, -1),
      {
        role: 'assistant' as const,
        content: 'Are you sure you want to skip this one? We can, but it may affect your score.',
        scenarioNumber: 2,
        interviewMoment: 2,
      },
      { role: 'user' as const, content: 'No.', scenarioNumber: 2, interviewMoment: 2 },
      {
        role: 'assistant' as const,
        content:
          "Great, let's stay on this one then. Just try your best. You've got this. And if you were James, how would you repair?",
        scenarioNumber: 2,
        interviewMoment: 2,
      },
      {
        role: 'user' as const,
        content:
          'I will sit down, have a genuine conversation, and ask how he would improve the relationship and better show appreciation going forward.',
        scenarioNumber: 2,
        interviewMoment: 2,
      },
    ];
    expect(shouldDeliverClientOwnedScenario3Opening(deps, messages)).toBe(true);
  });

  it('is false once situation_3 playback is already confirmed', () => {
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 2 },
      currentInterviewMomentRef: { current: 2 },
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: {
        current: { situation_3: true },
      },
    });
    expect(shouldDeliverClientOwnedScenario3Opening(deps, s2RepairMessages)).toBe(false);
  });
});

describe('deliverClientOwnedScenario2OpeningAfterS1Repair', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('speaks wrap, then emotion modal, then vignette; advances refs and scores situation 1', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const runEmotionModal = jest.fn().mockResolvedValue(undefined);
    const ensureCompletedScenarioScored = jest.fn();
    const commitInterviewMessages = jest.fn();
    const notifyScenarioStarted = jest.fn().mockResolvedValue(undefined);
    const parallelStreamingTtsRef = { current: createInitialParallelStreamingTtsState() };
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      resumeActiveScenarioRef: { current: 1 },
      interviewNameRef: { current: 'Matt' },
      parallelStreamingTtsRef,
      speakTextSafe,
      commitInterviewMessages,
      ensureCompletedScenarioScored,
      runEmotionModalAfterScenarioTransition: runEmotionModal,
      notifyScenarioStarted,
    });

    const delivered = await deliverClientOwnedScenario2OpeningAfterS1Repair(
      deps,
      s1RepairMessages,
      'Matt',
    );

    expect(delivered).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledTimes(2);
    const wrapSpoken = String(speakTextSafe.mock.calls[0]?.[0] ?? '');
    const vignetteSpoken = String(speakTextSafe.mock.calls[1]?.[0] ?? '');
    expect(wrapSpoken.toLowerCase()).toMatch(/next|situation|wrap|nice work|good work/);
    expect(wrapSpoken).not.toContain('Sarah has been job hunting');
    expect(vignetteSpoken).toContain('Sarah has been job hunting');
    expect(runEmotionModal).toHaveBeenCalledWith(1, {
      transitionText: expect.stringContaining('Sarah has been job hunting'),
      priorScenario: 1,
      afterBeforeModalPlayback: true,
    });
    const speakOrder = speakTextSafe.mock.invocationCallOrder[0]!;
    const modalOrder = runEmotionModal.mock.invocationCallOrder[0]!;
    const vignetteOrder = speakTextSafe.mock.invocationCallOrder[1]!;
    expect(speakOrder).toBeLessThan(modalOrder);
    expect(modalOrder).toBeLessThan(vignetteOrder);
    expect(deps.currentScenarioRef.current).toBe(2);
    expect(deps.currentInterviewMomentRef.current).toBe(2);
    expect(deps.resumeActiveScenarioRef.current).toBe(2);
    expect(ensureCompletedScenarioScored).toHaveBeenCalledWith(
      1,
      expect.any(Array),
      'client_owned_scenario_2_open',
    );
    expect(commitInterviewMessages).toHaveBeenCalled();
    expect(notifyScenarioStarted).toHaveBeenCalledWith(2, expect.any(Array));
    expect(parallelStreamingTtsRef.current.spokenCompleteText.length).toBeGreaterThan(40);
  });
});

describe('runPreClaudePostCommitGates client-owned S2 open', () => {
  it('returns handled:true so Claude is skipped when S1 repair is satisfied', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      resumeActiveScenarioRef: { current: 1 },
      interviewNameRef: { current: 'Matt' },
      parallelStreamingTtsRef: { current: createInitialParallelStreamingTtsState() },
      speakTextSafe,
      ensureCompletedScenarioScored: jest.fn(),
      runEmotionModalAfterScenarioTransition: jest.fn().mockResolvedValue(undefined),
      notifyScenarioStarted: jest.fn().mockResolvedValue(undefined),
    });

    const result = await runPreClaudePostCommitGates(
      deps,
      s1RepairMessages[s1RepairMessages.length - 1]!.content,
      s1RepairMessages,
      'Matt',
      emptySkipMeta,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalled();
    expect(deps.currentScenarioRef.current).toBe(2);
  });
});
