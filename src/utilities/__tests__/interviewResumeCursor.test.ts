import {
  assignScenarioNumbersToTranscript,
  buildResumeWelcomeMessage,
  computeInterviewResumePlan,
  emotionModalCatchUpThroughScenario,
  emotionModalCatchUpThroughScenarioFromResume,
  savedInterviewReachedClosingState,
  shouldOfferResumeWelcomeTts,
  firstAssistantIndexForScenarioIntro,
  lastFullyCompletedScenario,
  retagScenarioNumbersBeforeMomentFour,
  sliceMessagesBeforeScenarioIntro,
  isResumeWelcomeBackAssistantText,
  stripEphemeralWelcomeBackMessages,
  resumeShouldSpeakEmotionCatchUpAfterModal,
  resumeTranscriptAlreadyDeliveredMoment4Question,
  shouldResumeMidInterviewFromSaved,
  storedInterviewHasResumableScenarioProgress,
  transcriptNeedsScenarioNumberPatch,
} from '../interviewResumeCursor';
import { SHOW_SCENARIO_3_OPENING_EXACT, SHOW_SCENARIO_3_VIGNETTE_EXACT } from '../../features/aria/interviewShowScenarioExactCopy';

describe('interviewResumeCursor', () => {
  it('lastFullyCompletedScenario prefers score bundles', () => {
    expect(
      lastFullyCompletedScenario(
        [1],
        { 1: { pillarScores: { mentalizing: 5 }, pillarConfidence: {}, keyEvidence: {} } }
      )
    ).toBe(1);
  });

  it('isResumeWelcomeBackAssistantText detects resume welcome copy', () => {
    expect(
      isResumeWelcomeBackAssistantText(
        "Welcome back — we'll pick up where we left off. If you'd like me to repeat what I said, let me know."
      )
    ).toBe(true);
    expect(isResumeWelcomeBackAssistantText('Can you say more about that?')).toBe(false);
  });

  it('stripEphemeralWelcomeBackMessages removes tagged and untagged welcome lines', () => {
    const msgs = [
      { role: 'assistant', content: 'Sarah vignette', isWelcomeBack: false },
      {
        role: 'assistant',
        content: "Welcome back — we'll pick up where we left off. If you'd like me to repeat what I said, let me know.",
        isWelcomeBack: true,
      },
      {
        role: 'assistant',
        content: "Welcome back — we'll pick up where we left off.",
      },
    ];
    expect(stripEphemeralWelcomeBackMessages(msgs)).toHaveLength(1);
    expect(stripEphemeralWelcomeBackMessages(msgs)[0]?.content).toContain('Sarah');
  });

  it('emotionModalCatchUpThroughScenario maps last completed to modal gate scenario', () => {
    expect(emotionModalCatchUpThroughScenario(0)).toBeNull();
    expect(emotionModalCatchUpThroughScenario(1)).toBe(1);
    expect(emotionModalCatchUpThroughScenario(2)).toBe(2);
    expect(emotionModalCatchUpThroughScenario(5)).toBe(3);
  });

  it('emotionModalCatchUpThroughScenarioFromResume includes S3 modal when moment 4 despite scores at 2', () => {
    expect(
      emotionModalCatchUpThroughScenarioFromResume({
        lastCompletedScenario: 2,
        effectiveMoment: 4,
        transcriptMessages: [
          {
            role: 'assistant',
            content:
              "That's the end of the three described situations. Have you ever held a grudge against someone?",
          },
        ],
      }).through
    ).toBe(3);
  });

  it('emotionModalCatchUpThroughScenarioFromResume ignores intro "three situations" on mid-S1 resume', () => {
    const result = emotionModalCatchUpThroughScenarioFromResume({
      lastCompletedScenario: 0,
      effectiveMoment: 1,
      transcriptMessages: [
        {
          role: 'assistant',
          content:
            "Good to meet you. I'll first give you three situations, and you just tell me what you'd do in each situation.",
        },
        {
          role: 'assistant',
          content: 'That makes a lot of sense. What if you were Ryan? How would you repair this situation?',
        },
      ],
    });
    expect(result.through).toBeNull();
    expect(result.bumpReason).toBeNull();
  });

  it('shouldOfferResumeWelcomeTts even when last assistant line is substantive (mid-scenario refresh)', () => {
    const longAssistant = {
      role: 'assistant' as const,
      content:
        "That's the end of this scenario — great work. Here's the third situation: Sophie and Daniel have had the same argument for the third time.",
    };
    expect(
      shouldOfferResumeWelcomeTts({
        mode: 'replay_incomplete',
        transcriptMessages: [longAssistant],
      })
    ).toBe(true);
    expect(
      shouldOfferResumeWelcomeTts({
        mode: 'replay_incomplete',
        transcriptMessages: [{ role: 'assistant', content: 'Hi.' }],
      })
    ).toBe(true);
  });

  it('shouldOfferResumeWelcomeTts is false when closing turn is in transcript', () => {
    expect(
      shouldOfferResumeWelcomeTts({
        mode: 'resume_post_scenarios',
        transcriptMessages: [
          {
            role: 'assistant',
            content:
              'Good work getting through all of that. Thank you for being so open with me.',
          },
        ],
      }),
    ).toBe(false);
  });

  it('savedInterviewReachedClosingState detects pendingCompletion and closing transcript', () => {
    expect(savedInterviewReachedClosingState({ pendingCompletion: true, messages: [] })).toBe(true);
    expect(
      savedInterviewReachedClosingState({
        messages: [
          {
            role: 'assistant',
            content: 'Thanks for sticking with this. Thank you for being so open with me.',
          },
        ],
      }),
    ).toBe(true);
    expect(
      savedInterviewReachedClosingState({
        messages: [{ role: 'assistant', content: 'What do you make of that?' }],
      }),
    ).toBe(false);
  });

  it('resume welcome for mid-scenario dropout does not promise a full vignette restart', () => {
    const msg = buildResumeWelcomeMessage({ mode: 'replay_incomplete', resumeScenario: 2 });
    expect(msg.toLowerCase()).toContain('pick up where we left off');
    expect(msg.toLowerCase()).not.toContain('from the beginning');
    expect(msg).toMatch(/repeat what i said/i);
    expect(msg.toLowerCase()).not.toMatch(/\bthe (first|second|third) situation\b/);
  });

  it('resume welcome for next scenario omits vignette ordinal phrase', () => {
    const msg = buildResumeWelcomeMessage({ mode: 'resume_next', resumeScenario: 3 });
    expect(msg.toLowerCase()).toContain('pick up where we left off');
    expect(msg.toLowerCase()).not.toMatch(/\bthe (first|second|third) situation\b/);
  });

  it('resumeShouldSpeakEmotionCatchUpAfterModal skips grudge when already in transcript', () => {
    const grudge =
      'Have you ever held a grudge against someone, or had someone in your life you really did not like?';
    expect(
      resumeTranscriptAlreadyDeliveredMoment4Question([{ role: 'assistant', content: grudge }])
    ).toBe(true);
    expect(
      resumeShouldSpeakEmotionCatchUpAfterModal([{ role: 'assistant', content: grudge }], grudge)
    ).toBe(false);
  });

  it('resumeShouldSpeakEmotionCatchUpAfterModal allows grudge tail when handoff only', () => {
    const afterModal =
      'Have you ever held a grudge against someone, or had someone in your life you really did not like?';
    expect(
      resumeShouldSpeakEmotionCatchUpAfterModal(
        [{ role: 'assistant', content: "That's the end of the three described situations — great work." }],
        afterModal
      )
    ).toBe(true);
  });

  it('replays when active scenario has no scores', () => {
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1],
      scenarioScores: { 1: { pillarScores: { m: 1 }, pillarConfidence: {}, keyEvidence: {} } },
      resumeActiveFromStorage: 2,
      resumeActiveFromAttempt: 2,
      syncedMoments: {
        momentsComplete: { 1: true, 2: false, 3: false, 4: false, 5: false },
        currentMoment: 2,
        personalHandoffInjected: false,
      },
    });
    expect(plan.mode).toBe('replay_incomplete');
    expect(plan.resumeScenario).toBe(2);
    expect(plan.partialScenarioDataWritten).toBe(true);
  });

  it('replay_incomplete uses transcript moment when ahead of resume_active_scenario (M4 after S3)', () => {
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [],
      scenarioScores: undefined,
      resumeActiveFromStorage: 3,
      resumeActiveFromAttempt: 3,
      syncedMoments: {
        momentsComplete: { 1: false, 2: false, 3: false, 4: false, 5: false },
        currentMoment: 4,
        personalHandoffInjected: true,
      },
    });
    expect(plan.mode).toBe('replay_incomplete');
    expect(plan.resumeScenario).toBe(3);
    expect(plan.effectiveMoment).toBe(4);
    expect(plan.personalHandoffInjected).toBe(true);
    expect(plan.momentsComplete[3]).toBe(true);
  });

  it('resumes next scenario when active is cleared and last completed is 1', () => {
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1],
      scenarioScores: { 1: { pillarScores: { m: 1 }, pillarConfidence: {}, keyEvidence: {} } },
      resumeActiveFromStorage: null,
      resumeActiveFromAttempt: null,
      syncedMoments: {
        momentsComplete: { 1: true, 2: false, 3: false, 4: false, 5: false },
        currentMoment: 2,
        personalHandoffInjected: false,
      },
    });
    expect(plan.mode).toBe('resume_next');
    expect(plan.resumeScenario).toBe(2);
  });

  it('retags user turns after scenario 2 anchor', () => {
    const raw = [
      { role: 'assistant', content: "Here's the first situation — Emma and Ryan.", scenarioNumber: 1 },
      { role: 'user', content: 'Answer a.', scenarioNumber: 1 },
      { role: 'assistant', content: "Sarah has been job hunting — here's the next situation.", scenarioNumber: 1 },
      { role: 'user', content: 'Answer b.', scenarioNumber: 1 },
    ];
    const out = retagScenarioNumbersBeforeMomentFour(raw);
    expect((out[3] as { scenarioNumber?: number }).scenarioNumber).toBe(2);
  });

  it('firstAssistantIndexForScenarioIntro finds scenario 2 anchor', () => {
    const msgs = [
      { role: 'assistant', content: "Here's the first situation — Emma and Ryan." },
      { role: 'user', content: 'ok' },
      { role: 'assistant', content: "Sarah has been job hunting — here's the next situation." },
      { role: 'user', content: 'partial' },
    ];
    expect(firstAssistantIndexForScenarioIntro(msgs, 2)).toBe(2);
  });

  it('sliceMessagesBeforeScenarioIntro drops partial scenario 2 and later', () => {
    const msgs = [
      { role: 'assistant', content: "Here's the first situation — Emma and Ryan." },
      { role: 'user', content: 'done s1' },
      { role: 'assistant', content: "Sarah has been job hunting — here's the next situation." },
      { role: 'user', content: 'partial s2' },
    ];
    const sliced = sliceMessagesBeforeScenarioIntro(msgs, 2);
    expect(sliced).toHaveLength(2);
    expect(sliced[1].content).toBe('done s1');
  });

  it('sliceMessagesBeforeScenarioIntro is no-op when scenario intro anchor is missing', () => {
    const msgs = [{ role: 'assistant', content: 'unrelated' }];
    expect(sliceMessagesBeforeScenarioIntro(msgs, 3)).toEqual(msgs);
  });

  it('firstAssistantIndexForScenarioIntro ignores S3 Q1 without vignette setup', () => {
    const msgs = [
      { role: 'assistant', content: "Sarah has been job hunting — here's the next situation." },
      { role: 'user', content: 'done s2' },
      { role: 'assistant', content: SHOW_SCENARIO_3_OPENING_EXACT },
      { role: 'user', content: 'partial s3' },
    ];
    expect(firstAssistantIndexForScenarioIntro(msgs, 3)).toBe(-1);
    expect(sliceMessagesBeforeScenarioIntro(msgs, 3)).toEqual(msgs);
  });

  it('firstAssistantIndexForScenarioIntro finds scenario 3 when vignette is present', () => {
    const msgs = [
      { role: 'assistant', content: "Sarah has been job hunting — here's the next situation." },
      { role: 'user', content: 'done s2' },
      { role: 'assistant', content: SHOW_SCENARIO_3_VIGNETTE_EXACT },
      { role: 'user', content: 'partial s3' },
    ];
    expect(firstAssistantIndexForScenarioIntro(msgs, 3)).toBe(2);
  });

  it('storedInterviewHasResumableScenarioProgress rejects pre-scenario intro only (name + ready)', () => {
    const msgs = [
      { role: 'assistant', content: "Hi, I'm Amoraea. What can I call you?" },
      { role: 'user', content: 'Matt' },
      {
        role: 'assistant',
        content:
          "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?",
      },
      { role: 'user', content: 'Yes.' },
    ];
    expect(
      storedInterviewHasResumableScenarioProgress({
        messages: msgs,
        resumeActiveScenario: 1,
        currentScenario: 1,
      }),
    ).toBe(false);
  });

  it('computeInterviewResumePlan prefers transcript S2 anchor over stale resumeActive 1', () => {
    const messages = [
      { role: 'assistant', content: "Here's the first situation. Emma and Ryan have dinner plans." },
      { role: 'user', content: 'Emma feels sidelined.' },
      { role: 'assistant', content: "Here's the second situation. Sarah has been job hunting for four months." },
      { role: 'user', content: 'James should listen more.' },
    ];
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [],
      scenarioScores: {},
      resumeActiveFromStorage: 1,
      resumeActiveFromAttempt: 1,
      transcriptMessages: messages,
      syncedMoments: {
        momentsComplete: { 1: false, 2: false, 3: false, 4: false, 5: false },
        currentMoment: 2,
        personalHandoffInjected: false,
      },
    });
    expect(plan.resumeScenario).toBe(2);
    expect(plan.mode).toBe('replay_incomplete');
  });

  it('computeInterviewResumePlan uses synced moment 2 when resumeActive is stale 1 and S2 anchor missing', () => {
    const messages = [
      { role: 'assistant', content: "Here's the first situation. Emma and Ryan have dinner plans." },
      { role: 'user', content: 'Emma feels sidelined.' },
      { role: 'assistant', content: "Good, that's helpful." },
      { role: 'user', content: 'James should listen more.' },
    ];
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [],
      scenarioScores: {},
      resumeActiveFromStorage: 1,
      resumeActiveFromAttempt: 1,
      transcriptMessages: messages,
      syncedMoments: {
        momentsComplete: { 1: false, 2: false, 3: false, 4: false, 5: false },
        currentMoment: 2,
        personalHandoffInjected: false,
      },
    });
    expect(plan.resumeScenario).toBe(2);
    expect(plan.mode).toBe('replay_incomplete');
  });

  it('storedInterviewHasResumableScenarioProgress accepts resumeActiveScenario without vignette anchor yet', () => {
    expect(
      storedInterviewHasResumableScenarioProgress({
        messages: [
          { role: 'assistant', content: "Here's the first situation. Emma and Ryan." },
          { role: 'user', content: 'Ryan should have set boundaries with his mother during dinner.' },
        ],
        scenariosCompleted: [1],
        resumeActiveScenario: 2,
        currentScenario: 2,
      }),
    ).toBe(true);
  });

  it('computeInterviewResumePlan uses resumeActiveFromStorage when attempt resume is null', () => {
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1],
      scenarioScores: {},
      resumeActiveFromStorage: 2,
      resumeActiveFromAttempt: null,
      syncedMoments: {
        momentsComplete: { 1: true, 2: false, 3: false, 4: false, 5: false },
        currentMoment: 2,
        personalHandoffInjected: false,
      },
    });
    expect(plan.resumeScenario).toBe(2);
    expect(plan.mode).toBe('replay_incomplete');
  });

  it('shouldResumeMidInterviewFromSaved is true mid scenario 2 with saved transcript', () => {
    expect(
      shouldResumeMidInterviewFromSaved({
        messages: [
          { role: 'assistant', content: "Here's the first situation. Emma and Ryan." },
          { role: 'user', content: 'Ryan should have set boundaries with his mother.' },
          { role: 'assistant', content: "Here's the second situation. Sarah has been job hunting." },
          { role: 'user', content: 'I think James should have been more supportive.' },
        ],
        scenariosCompleted: [1],
        scenarioScores: {},
        resumeActiveScenario: 2,
        currentScenario: 2,
      }),
    ).toBe(true);
  });

  it('shouldResumeMidInterviewFromSaved is false for greeting-only save', () => {
    expect(
      shouldResumeMidInterviewFromSaved({
        messages: [{ role: 'assistant', content: "Hi, I'm Amoraea. What can I call you?" }],
        scenariosCompleted: [],
        scenarioScores: {},
        resumeActiveScenario: null,
        currentScenario: 1,
      }),
    ).toBe(false);
  });

  it('shouldResumeMidInterviewFromSaved is true in Moment 4 after all three scenarios scored', () => {
    expect(
      shouldResumeMidInterviewFromSaved({
        messages: [
          { role: 'assistant', content: "Emma and Ryan have dinner plans. What's going on between these two?" },
          { role: 'user', content: 'Ryan should have set boundaries.' },
          { role: 'assistant', content: "Think of someone you've had a really hard time with" },
          { role: 'user', content: 'I had a falling out with a friend.' },
        ],
        scenariosCompleted: [1, 2, 3],
        scenarioScores: {},
        resumeActiveScenario: 3,
        currentScenario: 3,
      }),
    ).toBe(true);
  });

  it('storedInterviewHasResumableScenarioProgress accepts after Emma/Ryan vignette anchor', () => {
    const msgs = [
      { role: 'assistant', content: "Hi, I'm Amoraea. What can I call you?" },
      { role: 'user', content: 'Matt' },
      {
        role: 'assistant',
        content:
          "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?",
      },
      { role: 'user', content: 'Yes.' },
      {
        role: 'assistant',
        content:
          "Emma and Ryan have dinner plans. Ryan takes a call from his mother halfway through. What's going on between these two?",
      },
    ];
    expect(
      storedInterviewHasResumableScenarioProgress({
        messages: msgs,
        resumeActiveScenario: 1,
        currentScenario: 1,
      }),
    ).toBe(true);
  });

  it('assignScenarioNumbersToTranscript tags intro and scenario segments', () => {
    const raw = [
      { role: 'assistant', content: "Hi, I'm Amoraea. What can I call you?" },
      { role: 'user', content: 'Matt' },
      {
        role: 'assistant',
        content:
          "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?",
      },
      { role: 'user', content: 'Yes.' },
      {
        role: 'assistant',
        content:
          "Emma and Ryan have dinner plans. Ryan takes a call from his mother halfway through. What's going on between these two?",
      },
      { role: 'user', content: 'Emma feels ignored.' },
    ];
    const out = assignScenarioNumbersToTranscript(raw);
    expect(out.every((m) => typeof (m as { scenarioNumber?: number }).scenarioNumber === 'number')).toBe(true);
    expect((out[0] as { scenarioNumber?: number }).scenarioNumber).toBe(1);
    expect((out[4] as { scenarioNumber?: number }).scenarioNumber).toBe(1);
    expect((out[5] as { scenarioNumber?: number }).scenarioNumber).toBe(1);
  });

  it('assignScenarioNumbersToTranscript bumps to 2 after Sarah/James anchor', () => {
    const raw = [
      { role: 'assistant', content: "Here's the first situation — Emma and Ryan." },
      { role: 'user', content: 'Answer a.' },
      { role: 'assistant', content: "Sarah has been job hunting — here's the next situation." },
      { role: 'user', content: 'Answer b.' },
    ];
    const out = assignScenarioNumbersToTranscript(raw);
    expect((out[2] as { scenarioNumber?: number }).scenarioNumber).toBe(2);
    expect((out[3] as { scenarioNumber?: number }).scenarioNumber).toBe(2);
  });

  it('assignScenarioNumbersToTranscript tags Moment 4+ turns as scenario 3', () => {
    const raw = [
      { role: 'assistant', content: 'Sophie and Daniel have had the same argument.', scenarioNumber: 3 },
      { role: 'user', content: 'Threshold answer.', scenarioNumber: 3, interviewMoment: 3 },
      {
        role: 'assistant',
        content: "Good work — you just finished the three situations. Have you ever held a grudge?",
        interviewMoment: 4,
      },
      { role: 'user', content: 'Yes, a coworker.', interviewMoment: 4 },
    ];
    const out = assignScenarioNumbersToTranscript(raw);
    expect((out[2] as { scenarioNumber?: number }).scenarioNumber).toBe(3);
    expect((out[3] as { scenarioNumber?: number }).scenarioNumber).toBe(3);
  });

  it('transcriptNeedsScenarioNumberPatch detects missing tags', () => {
    const raw = [{ role: 'assistant', content: "Hi, I'm Amoraea." }, { role: 'user', content: 'Matt' }];
    expect(transcriptNeedsScenarioNumberPatch(raw)).toBe(true);
    expect(transcriptNeedsScenarioNumberPatch(assignScenarioNumbersToTranscript(raw))).toBe(false);
  });
});
