import { describe, expect, it, jest } from '@jest/globals';

import { runPostClaudeScenarioCompleteTokenGate } from '@features/aria/runPostClaudeScenarioCompleteTokenGate';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  createMockSpeakAssistantTurn,
  mockRef,
} from './postClaudeGateTestHelpers';

describe('runPostClaudeScenarioCompleteTokenGate', () => {
  it('returns handled:false when token is absent', async () => {
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams();
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeScenarioCompleteTokenGate(
      deps,
      params,
      'Thanks, that helps.',
      speak,
    );

    expect(result).toEqual({ handled: false });
    expect(speak).not.toHaveBeenCalled();
  });

  it('parses flexible [SCENARIO_COMPLETE: N] spacing and casing after S1 follow-ups are complete', async () => {
    const scoreScenario = jest.fn();
    const deps = createMockPostClaudeDeps({
      scoreScenario,
      currentScenarioRef: mockRef(1),
      currentInterviewMomentRef: mockRef(1),
      interviewMomentsCompleteRef: mockRef({}),
      scoredScenariosRef: mockRef(new Set<number>()),
    });
    const params = createMockPostClaudeParams({
      trimmed: 'I would apologize and set a voicemail boundary during dates.',
      messagesToUse: [
        { role: 'assistant', content: "What's going on between these two?", scenarioNumber: 1 },
        { role: 'user', content: 'Emma is frustrated Ryan keeps taking calls from his mom.', scenarioNumber: 1 },
        { role: 'assistant', content: 'What line crossed into contempt for Emma?', scenarioNumber: 1 },
        { role: 'user', content: 'She sounded resigned when she said it.', scenarioNumber: 1 },
        {
          role: 'assistant',
          content: 'How would you repair this as Ryan?',
          scenarioNumber: 1,
        },
        {
          role: 'user',
          content: 'I would apologize and set a voicemail boundary during dates.',
          scenarioNumber: 1,
        },
      ],
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeScenarioCompleteTokenGate(
      deps,
      params,
      "[SCENARIO_COMPLETE: 1] Good, that's helpful. That's the end of this scenario. Here's the next situation.",
      speak,
    );

    expect(result).toEqual({ handled: true });
    expect(deps.interviewMomentsCompleteRef.current[1]).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(2);
    expect(deps.currentScenarioRef.current).toBe(2);
    expect(scoreScenario).toHaveBeenCalledWith(1, expect.any(Array));
    expect(deps.runEmotionModalAfterScenarioTransition).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ priorScenario: 1 }),
    );
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('blocks premature [SCENARIO_COMPLETE:1] after Q1 only', async () => {
    const scoreScenario = jest.fn();
    const deps = createMockPostClaudeDeps({
      scoreScenario,
      currentScenarioRef: mockRef(1),
      currentInterviewMomentRef: mockRef(1),
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [
        { role: 'assistant', content: "What's going on between these two?", scenarioNumber: 1 },
        { role: 'user', content: 'Emma is frustrated Ryan keeps taking calls from his mom.', scenarioNumber: 1 },
      ],
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeScenarioCompleteTokenGate(
      deps,
      params,
      "[SCENARIO_COMPLETE: 1] That's a wrap on that one.",
      speak,
    );

    expect(result).toEqual({ handled: false });
    expect(scoreScenario).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('injects S2 boundary reflection when vignette is present but reflection is missing', async () => {
    const setMessages = jest.fn();
    const deps = createMockPostClaudeDeps({
      setMessages,
      currentScenarioRef: mockRef(2),
      currentInterviewMomentRef: mockRef(2),
      interviewMomentsCompleteRef: mockRef({ 1: true }),
      scoredScenariosRef: mockRef(new Set([1])),
    });
    const params = createMockPostClaudeParams({
      participantFirstNameForSpoken: 'Alex',
      messagesToUse: [
        {
          role: 'user',
          content:
            'James should have listened more instead of jumping to logistics when Sarah was upset about the trip.',
          scenarioNumber: 2,
        },
        { role: 'assistant', content: 'And if you were James, how would you repair?' },
        {
          role: 'user',
          content:
            "I'd ask how she'd like to be celebrated and commit to celebrating her the way she'd like.",
          scenarioNumber: 2,
        },
      ],
    });
    const speak = createMockSpeakAssistantTurn();

    await runPostClaudeScenarioCompleteTokenGate(
      deps,
      params,
      "[SCENARIO_COMPLETE:2] That scenario is complete. Here's the third situation — after this we'll move to something more personal.\n\nSophie and Daniel have had the same argument for the third time.",
      speak,
    );

    const appended = setMessages.mock.calls[0]?.[0] as Array<{ role: string; content?: string }>;
    const assistantText = appended
      .filter((m) => m.role === 'assistant')
      .map((m) => m.content ?? '')
      .join('\n');
    expect(assistantText).toMatch(/You (?:focused on|named|framed|pointed to|highlighted|saw|recognized|picked up on|read)|What (?:I got|I heard|came through|landed for me) was that/i);
    expect(assistantText).toContain('Nice work, Alex');
    expect(assistantText).toMatch(/Sophie|Daniel/i);
  });

  it('repairs S2→S3 transition when vignette body is missing from model text', async () => {
    const setMessages = jest.fn();
    const deps = createMockPostClaudeDeps({
      setMessages,
      currentScenarioRef: mockRef(2),
      currentInterviewMomentRef: mockRef(2),
      interviewMomentsCompleteRef: mockRef({ 1: true }),
      scoredScenariosRef: mockRef(new Set([1])),
    });
    const params = createMockPostClaudeParams({
      participantFirstNameForSpoken: 'Alex',
      messagesToUse: [
        {
          role: 'user',
          content:
            'James should have listened more instead of jumping to logistics when Sarah was upset about the trip.',
          scenarioNumber: 2,
        },
        { role: 'assistant', content: 'And if you were James, how would you repair?' },
        {
          role: 'user',
          content:
            "I'd ask how she'd like to be celebrated and commit to celebrating her the way she'd like.",
          scenarioNumber: 2,
        },
      ],
    });
    const speak = createMockSpeakAssistantTurn();

    await runPostClaudeScenarioCompleteTokenGate(
      deps,
      params,
      "[SCENARIO_COMPLETE:2] Okay Alex, let's keep going.",
      speak,
    );

    expect(deps.resetScenarioCClientGatesOnly).toHaveBeenCalled();
    expect(deps.currentInterviewMomentRef.current).toBe(3);
    expect(setMessages).toHaveBeenCalled();
    const appended = setMessages.mock.calls[0]?.[0] as Array<{ role: string; content?: string }>;
    const assistantText = appended.filter((m) => m.role === 'assistant').map((m) => m.content ?? '').join('\n');
    expect(assistantText).toMatch(/Sophie|Daniel/i);
  });
});
