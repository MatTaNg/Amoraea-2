import { describe, expect, it, jest } from '@jest/globals';

import { SCENARIO_B_VIGNETTE } from '@/constants/scenarioBVignette';
import {
  runClearReferenceCardOnScenarioTransition,
  type InterviewScenarioTransitionUiDeps,
} from '@features/aria/interviewActivePersistenceTypes';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  isAssistantBubbleForTranscript,
  isGenuineScenarioTransitionSignal,
  runRestoreReferenceCardFromTranscriptIfNeeded,
} from '@features/aria/interviewReferenceCardResumeHelpers';
import { detectActiveScenarioFromMessage } from '@features/aria/interviewScenarioOpeningStreamGate';
import { SHOW_SCENARIO_2_FULL_EXACT } from '@features/aria/interviewShowScenarioExactCopy';

function makeTransitionDeps(
  overrides: Partial<InterviewScenarioTransitionUiDeps> = {},
): InterviewScenarioTransitionUiDeps {
  return {
    messages: [],
    committedScenarioRef: { current: { label: 'Situation 2', text: SCENARIO_B_VIGNETTE } },
    isAssistantBubbleForTranscript,
    stripControlTokens,
    detectActiveScenarioFromMessage,
    setInterviewUiPhase: jest.fn(),
    setReferenceCardPrompt: jest.fn(),
    setReferenceCardScenario: jest.fn(),
    ...overrides,
  };
}

describe('runClearReferenceCardOnScenarioTransition', () => {
  it('does not clear when latest assistant is an S1 follow-up during active S2', () => {
    const deps = makeTransitionDeps({
      messages: [
        { role: 'assistant', content: SHOW_SCENARIO_2_FULL_EXACT },
        {
          role: 'assistant',
          content:
            "Thanks for sharing. When Ryan says he can't ignore his mother — what do you think Emma is reacting to?",
        },
      ],
    });

    runClearReferenceCardOnScenarioTransition(deps, {
      status: 'active',
      isAdmin: false,
      messageCount: 2,
    });

    expect(deps.setInterviewUiPhase).not.toHaveBeenCalled();
    expect(deps.setReferenceCardScenario).not.toHaveBeenCalled();
    expect(deps.committedScenarioRef.current?.label).toBe('Situation 2');
  });

  it('does not clear when committed is unset', () => {
    const deps = makeTransitionDeps({
      committedScenarioRef: { current: null },
      messages: [{ role: 'assistant', content: SHOW_SCENARIO_2_FULL_EXACT }],
    });

    runClearReferenceCardOnScenarioTransition(deps, {
      status: 'active',
      isAdmin: false,
      messageCount: 1,
    });

    expect(deps.setInterviewUiPhase).not.toHaveBeenCalled();
  });

  it('clears on a genuine S2 handoff while committed is still S1', () => {
    const deps = makeTransitionDeps({
      committedScenarioRef: {
        current: { label: 'Situation 1', text: 'Emma and Ryan have dinner plans.' },
      },
      messages: [
        {
          role: 'assistant',
          content:
            "That's a wrap on that one. Sarah has been job hunting for four months. She gets an offer and calls James from the street.",
        },
      ],
    });

    runClearReferenceCardOnScenarioTransition(deps, {
      status: 'active',
      isAdmin: false,
      messageCount: 1,
    });

    expect(deps.setInterviewUiPhase).toHaveBeenCalledWith('scenario_transitioning');
    expect(deps.setReferenceCardScenario).toHaveBeenCalledWith(null);
    expect(deps.committedScenarioRef.current).toBeNull();
  });

  it('restores S2 show-scenario UI immediately after S1→S2 handoff clears committed ref', () => {
    const committedScenarioRef = {
      current: { label: 'Situation 1', text: 'Emma and Ryan have dinner plans.' } as {
        label: string;
        text: string;
      } | null,
    };
    const setInterviewUiPhase = jest.fn();
    const setReferenceCardScenario = jest.fn();
    const setReferenceCardPrompt = jest.fn();
    const deps = makeTransitionDeps({
      committedScenarioRef,
      setInterviewUiPhase,
      setReferenceCardScenario,
      setReferenceCardPrompt,
      messages: [{ role: 'assistant', content: SHOW_SCENARIO_2_FULL_EXACT }],
    });

    runClearReferenceCardOnScenarioTransition(deps, {
      status: 'active',
      isAdmin: false,
      messageCount: 1,
    });
    runRestoreReferenceCardFromTranscriptIfNeeded(deps);

    expect(setInterviewUiPhase).toHaveBeenCalledWith('scenario_transitioning');
    expect(setInterviewUiPhase).toHaveBeenCalledWith('scenario_active');
    expect(setReferenceCardScenario).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Situation 2' }),
    );
    expect(committedScenarioRef.current?.label).toBe('Situation 2');
  });
});

describe('isGenuineScenarioTransitionSignal', () => {
  it('recognizes locked show-scenario bundles', () => {
    expect(isGenuineScenarioTransitionSignal(SHOW_SCENARIO_2_FULL_EXACT)).toBe(true);
  });

  it('rejects short S1 follow-up probes', () => {
    expect(
      isGenuineScenarioTransitionSignal(
        "When Ryan says he can't ignore his mother — what do you think Emma is reacting to?",
      ),
    ).toBe(false);
  });
});

describe('runRestoreReferenceCardFromTranscriptIfNeeded', () => {
  it('restores S2 card when committed was cleared mid-scenario', () => {
    const committedScenarioRef = { current: null as { label: string; text: string } | null };
    const setInterviewUiPhase = jest.fn();
    const setReferenceCardScenario = jest.fn();
    const setReferenceCardPrompt = jest.fn();

    runRestoreReferenceCardFromTranscriptIfNeeded({
      messages: [
        { role: 'assistant', content: SHOW_SCENARIO_2_FULL_EXACT },
        { role: 'user', content: 'James was trying to be supportive.' },
        {
          role: 'assistant',
          content: 'What do you think Sarah needed from James in that moment?',
        },
      ],
      committedScenarioRef,
      isAssistantBubbleForTranscript,
      setInterviewUiPhase,
      setReferenceCardPrompt,
      setReferenceCardScenario,
    });

    expect(setInterviewUiPhase).toHaveBeenCalledWith('scenario_active');
    expect(setReferenceCardScenario).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Situation 2' }),
    );
    expect(committedScenarioRef.current?.label).toBe('Situation 2');
  });
});
