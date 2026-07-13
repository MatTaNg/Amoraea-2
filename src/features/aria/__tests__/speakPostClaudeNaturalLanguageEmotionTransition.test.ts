import { describe, expect, it, jest } from '@jest/globals';

import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import {
  handlePostClaudePendingBundledHandoffSpeak,
  parallelStreamMissedBundledHandoffPreModal,
  speakPostClaudeNaturalLanguageEmotionTransition,
} from '@features/aria/speakPostClaudeNaturalLanguageEmotionTransition';
import { buildCanonicalShowScenarioCardTtsBody } from '@features/aria/showScenarioCardCanonicalTts';
import { SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL } from '@features/aria/scenarioBProbeLogic';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  createMockSpeakAssistantTurn,
} from './postClaudeGateTestHelpers';

describe('speakPostClaudeNaturalLanguageEmotionTransition', () => {
  const baseArgs = {
    displayText: 'Nice work, Alex.\n\nSarah has been feeling overlooked at work.',
    priorScenarioNum: 1 as const,
    emotionSplit: {
      beforeModal: 'Nice work, Alex.',
      afterModal: 'Sarah has been feeling overlooked at work.',
    },
    deferEmotionModal: false,
    aiMsg: {
      role: 'assistant' as const,
      content: 'Nice work, Alex.\n\nSarah has been feeling overlooked at work.',
      scenarioNumber: 2 as const,
    },
    scenarioJustCompleted: 1 as const,
  };

  it('speaks beforeModal and afterModal, then runs emotion modal on the inline path', async () => {
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const speak = createMockSpeakAssistantTurn();
    const deps = createMockPostClaudeDeps({ runEmotionModalAfterScenarioTransition });
    const updatedMessages = [{ role: 'user', content: 'They should talk it out.' }];

    await speakPostClaudeNaturalLanguageEmotionTransition(deps, updatedMessages, speak, baseArgs);

    expect(speak).toHaveBeenNthCalledWith(
      1,
      'Nice work, Alex.',
      expect.objectContaining(ASSISTANT_INTERVIEW_SPEECH),
    );
    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalledWith(1, {
      transitionText: baseArgs.displayText,
      priorScenario: 1,
      afterBeforeModalPlayback: true,
    });
    expect(speak).toHaveBeenNthCalledWith(
      2,
      'Sarah has been feeling overlooked at work.',
      expect.objectContaining(ASSISTANT_INTERVIEW_SPEECH),
    );
    expect(deps.pendingEmotionModalTransitionRef.current).toBeNull();
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
    expect(deps.setIsWaiting).toHaveBeenCalledWith(false);
  });

  it('defers emotion modal and stages pending transition when afterModal is present', async () => {
    const setMessages = jest.fn();
    const speak = createMockSpeakAssistantTurn();
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPostClaudeDeps({ setMessages, runEmotionModalAfterScenarioTransition });
    const updatedMessages = [
      { role: 'user', content: 'They should talk it out.' },
      {
        role: 'assistant' as const,
        content: baseArgs.displayText,
        scenarioNumber: 2 as const,
      },
    ];
    deps.currentMessagesRef.current = updatedMessages;

    await speakPostClaudeNaturalLanguageEmotionTransition(deps, updatedMessages, speak, {
      ...baseArgs,
      deferEmotionModal: true,
    });

    expect(deps.pendingEmotionModalTransitionRef.current).toEqual({
      completedScenario: 1,
      afterModal: baseArgs.emotionSplit.afterModal,
      transitionText: baseArgs.displayText,
      priorScenario: 1,
    });
    expect(setMessages).toHaveBeenCalledWith([
      { role: 'user', content: 'They should talk it out.' },
      expect.objectContaining({
        role: 'assistant',
        content: 'Nice work, Alex.',
      }),
    ]);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(
      'Nice work, Alex.',
      expect.objectContaining(ASSISTANT_INTERVIEW_SPEECH),
    );
    expect(runEmotionModalAfterScenarioTransition).not.toHaveBeenCalled();
  });

  it('uses speakTextSafe for afterModal when parallel stream already spoke beforeModal', async () => {
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const speak = createMockSpeakAssistantTurn();
    const deps = createMockPostClaudeDeps({
      runEmotionModalAfterScenarioTransition,
      speakTextSafe,
      parallelStreamingTtsRef: {
        current: {
          active: false,
          spokenCompleteText: 'Nice work, Alex.',
          accumulatedFullText: '',
          cancelRequested: false,
        },
      },
    });
    await speakPostClaudeNaturalLanguageEmotionTransition(deps, [], speak, baseArgs);

    expect(speak).not.toHaveBeenCalled();
    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalled();
    expect(speakTextSafe).toHaveBeenCalledWith(
      'Sarah has been feeling overlooked at work.',
      ASSISTANT_INTERVIEW_SPEECH,
    );
  });

  it('skips afterModal speak when canonical S2 opening already played in parallel stream', async () => {
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const speak = createMockSpeakAssistantTurn();
    const s2Opening =
      "Sarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait. What do you think is going on here?";
    const deps = createMockPostClaudeDeps({
      runEmotionModalAfterScenarioTransition,
      speakTextSafe,
      currentInterviewMomentRef: { current: 1 },
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: { current: { situation_2: true } },
      parallelStreamingTtsRef: {
        current: {
          active: false,
          spokenCompleteText: s2Opening,
          accumulatedFullText: '',
          cancelRequested: false,
        },
      },
    });
    const updatedMessages = [
      { role: 'assistant', content: 'If you were Ryan, how would you repair this?' },
      {
        role: 'user',
        content:
          'If I were Ryan, I would assure her that this would not happen again and actually follow through.',
      },
    ];

    await speakPostClaudeNaturalLanguageEmotionTransition(deps, updatedMessages, speak, {
      ...baseArgs,
      emotionSplit: {
        beforeModal: 'Nice work, Alex.',
        afterModal: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
      },
    });

    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalled();
    expect(speakTextSafe).not.toHaveBeenCalled();
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
    expect(deps.setIsWaiting).toHaveBeenCalledWith(false);
  });

  it('speaks S2→S3 transition before modal and skips S3 afterModal when canonical stream confirmed', async () => {
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const speak = createMockSpeakAssistantTurn();
    const streamReflection =
      "That's a wrap on this situation. Nice work, Matt — you recognized James needed to meet Sarah's emotional moment first.";
    const beforeModal =
      "That scenario is complete. Nice work, Matt — You saw James's focus on logistics. Here's the third situation — after this we'll move to something more personal.";
    const afterModal = 'Sophie and Daniel have had the same argument for the third time.';
    const deps = createMockPostClaudeDeps({
      runEmotionModalAfterScenarioTransition,
      speakTextSafe,
      currentInterviewMomentRef: { current: 2 },
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: { current: { situation_3: true } },
      parallelStreamingTtsRef: {
        current: {
          active: false,
          spokenCompleteText: streamReflection,
          accumulatedFullText: '',
          cancelRequested: false,
        },
      },
    });
    await speakPostClaudeNaturalLanguageEmotionTransition(deps, [], speak, {
      ...baseArgs,
      priorScenarioNum: 2,
      scenarioJustCompleted: 2,
      emotionSplit: { beforeModal, afterModal },
    });

    expect(speak).toHaveBeenCalledWith(
      expect.stringMatching(/third situation/i),
      expect.objectContaining(ASSISTANT_INTERVIEW_SPEECH),
    );
    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalledWith(2, expect.any(Object));
    expect(speakTextSafe).not.toHaveBeenCalled();
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
    expect(deps.setIsWaiting).toHaveBeenCalledWith(false);
  });
});

describe('handlePostClaudePendingBundledHandoffSpeak', () => {
  it('returns false when there is no pending bundled handoff', async () => {
    const setVoiceState = jest.fn();
    const speak = createMockSpeakAssistantTurn();

    const handled = await handlePostClaudePendingBundledHandoffSpeak(
      { setVoiceState },
      speak,
      {
        pendingBundledHandoff: false,
        parallelStreamingPlaybackUsed: false,
        assistantContentToPersist: 'Nice work, Alex.',
      },
    );

    expect(handled).toBe(false);
    expect(speak).not.toHaveBeenCalled();
    expect(setVoiceState).not.toHaveBeenCalled();
  });

  it('speaks pre-modal content and idles voice when bundled handoff is pending', async () => {
    const setVoiceState = jest.fn();
    const speak = createMockSpeakAssistantTurn();

    const handled = await handlePostClaudePendingBundledHandoffSpeak(
      { setVoiceState },
      speak,
      {
        pendingBundledHandoff: true,
        parallelStreamingPlaybackUsed: false,
        assistantContentToPersist: 'Nice work, Alex.',
      },
    );

    expect(handled).toBe(true);
    expect(speak).toHaveBeenCalledWith('Nice work, Alex.', ASSISTANT_INTERVIEW_SPEECH);
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('skips TTS when parallel streaming already delivered the bundled pre-modal segment', async () => {
    const setVoiceState = jest.fn();
    const speak = createMockSpeakAssistantTurn();
    const preModal =
      "That's the end of that scenario. What came through was that you'd follow through. Here's the next situation.";

    const handled = await handlePostClaudePendingBundledHandoffSpeak(
      { setVoiceState },
      speak,
      {
        pendingBundledHandoff: true,
        parallelStreamingPlaybackUsed: true,
        assistantContentToPersist: preModal,
        streamSpokenCompleteText: preModal,
        currentInterviewMoment: 1,
      },
    );

    expect(handled).toBe(true);
    expect(speak).not.toHaveBeenCalled();
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('speaks bundled pre-modal when parallel stream only delivered a truncated S1 handoff fragment', async () => {
    const setVoiceState = jest.fn();
    const speak = createMockSpeakAssistantTurn();
    const preModal =
      "That's the end of that scenario. What came through was that you'd follow through. Here's the next situation.";

    const handled = await handlePostClaudePendingBundledHandoffSpeak(
      { setVoiceState },
      speak,
      {
        pendingBundledHandoff: true,
        parallelStreamingPlaybackUsed: true,
        assistantContentToPersist: preModal,
        streamSpokenCompleteText: "Got it. That situation's",
        currentInterviewMoment: 1,
      },
    );

    expect(handled).toBe(true);
    expect(speak).toHaveBeenCalledWith(preModal, ASSISTANT_INTERVIEW_SPEECH);
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('skips bundled handoff respeak when show-scenario-card S2 canonical playback was confirmed', async () => {
    const setVoiceState = jest.fn();
    const speak = createMockSpeakAssistantTurn();
    const bundle =
      "That's a wrap on this situation. Here's the next situation.\n\n" +
      buildCanonicalShowScenarioCardTtsBody('situation_2');

    expect(
      parallelStreamMissedBundledHandoffPreModal(
        "Makes sense. Here's the next situation.",
        bundle,
        1,
        { situation_2: true },
      ),
    ).toBe(false);

    const handled = await handlePostClaudePendingBundledHandoffSpeak(
      {
        setVoiceState,
        showScenarioCardCanonicalPlaybackConfirmedKindsRef: { current: { situation_2: true } },
      },
      speak,
      {
        pendingBundledHandoff: true,
        parallelStreamingPlaybackUsed: true,
        assistantContentToPersist: bundle,
        streamSpokenCompleteText: "Makes sense. Here's the next situation.",
        currentInterviewMoment: 1,
      },
    );

    expect(handled).toBe(true);
    expect(speak).not.toHaveBeenCalled();
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });
});
