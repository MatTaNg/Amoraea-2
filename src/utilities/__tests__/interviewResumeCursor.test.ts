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
  resumeTranscriptIndicatesPersonalPartActive,
  transcriptHasPersistedPersonalPartProgress,
  shouldResumeMidInterviewFromSaved,
  storedInterviewHasResumableScenarioProgress,
  transcriptHasInScenarioProgressPastOpening,
  transcriptNeedsScenarioNumberPatch,
} from '../interviewResumeCursor';
import { SHOW_SCENARIO_3_OPENING_EXACT, SHOW_SCENARIO_3_VIGNETTE_EXACT } from '../../features/aria/interviewShowScenarioExactCopy';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '../../features/aria/moment4ProbeLogic';
import { SCENARIO_B_JAMES_REPAIR_CANONICAL } from '../../features/aria/scenarioBProbeLogic';
import { SCENARIO_C_REPAIR_QUESTION_CANONICAL } from '../../features/aria/scenarioCPromptDetection';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '../../features/aria/interviewDisengagementProbeCopy';

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
        "Welcome back, we'll pick up where we left off, we were in Scenario two and I just said What do you think is going on here?",
      ),
    ).toBe(true);
    expect(
      isResumeWelcomeBackAssistantText(
        "Welcome back, we'll pick up where we left off, we were in Scenario two and I just asked you What do you think is going on here?",
      ),
    ).toBe(true);
    expect(
      isResumeWelcomeBackAssistantText(
        "Welcome back — we'll pick up where we left off. If you'd like me to repeat what I said, let me know.",
      ),
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

  it('resume welcome names scenario and embeds the last main question', () => {
    const lastQuestion = 'What do you think is going on between Sarah and James in this situation?';
    const msg = buildResumeWelcomeMessage({
      mode: 'replay_incomplete',
      resumeScenario: 2,
      lastQuestionText: lastQuestion,
    });
    expect(msg.toLowerCase()).toContain("we'll pick up where we left off");
    expect(msg.toLowerCase()).toContain('we were in scenario two');
    expect(msg).toContain(`I just said ${lastQuestion}`);
    expect(msg.toLowerCase()).not.toMatch(/repeat (the scenario|what i said)/);
  });

  it('resume welcome for next scenario names scenario three without repeat offer', () => {
    const msg = buildResumeWelcomeMessage({ mode: 'resume_next', resumeScenario: 3 });
    expect(msg.toLowerCase()).toContain('we were in scenario three');
    expect(msg.toLowerCase()).not.toMatch(/repeat (the scenario|what i said)/);
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

  it('resume_post_scenarios uses synced moment 4 when ahead of resume_active_scenario (M4 after S3)', () => {
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
    expect(plan.mode).toBe('resume_post_scenarios');
    expect(plan.resumeScenario).toBe(3);
    expect(plan.effectiveMoment).toBe(4);
    expect(plan.personalHandoffInjected).toBe(true);
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

  it('transcriptHasInScenarioProgressPastOpening is true mid-S2 without vignette anchor', () => {
    const msgs = [
      { role: 'assistant', content: "Got it — moving on. Here's the next situation.", scenarioNumber: 2 },
      { role: 'assistant', content: 'What do you think is going on here?', scenarioNumber: 2 },
      { role: 'user', content: 'Can we skip this scenario?', scenarioNumber: 2 },
    ];
    expect(firstAssistantIndexForScenarioIntro(msgs, 2)).toBe(-1);
    expect(transcriptHasInScenarioProgressPastOpening(msgs, 2)).toBe(true);
  });

  it('transcriptHasInScenarioProgressPastOpening is false before any S2 Q1/user turn', () => {
    const msgs = [
      { role: 'assistant', content: "Here's the first situation — Emma and Ryan.", scenarioNumber: 1 },
      { role: 'user', content: 'done', scenarioNumber: 1 },
    ];
    expect(transcriptHasInScenarioProgressPastOpening(msgs, 2)).toBe(false);
  });

  it('transcriptHasInScenarioProgressPastOpening is true mid-S3 when scenarioNumber lags but interviewMoment is 3', () => {
    const s3Q1 =
      "When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const msgs = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL, scenarioNumber: 2, interviewMoment: 2 },
      { role: 'assistant', content: s3Q1, scenarioNumber: 2, interviewMoment: 3 },
      { role: 'user', content: 'Daniel avoids conflict.', scenarioNumber: 2, interviewMoment: 3 },
    ];
    expect(firstAssistantIndexForScenarioIntro(msgs, 3)).toBe(-1);
    expect(transcriptHasInScenarioProgressPastOpening(msgs, 3)).toBe(true);
  });

  it('computeInterviewResumePlan treats mid-S3 without vignette anchor as replay_incomplete not resume_next', () => {
    const s3Q1 =
      "When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const msgs = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL, scenarioNumber: 2, interviewMoment: 2 },
      { role: 'assistant', content: s3Q1, scenarioNumber: 2, interviewMoment: 3 },
      { role: 'user', content: 'Daniel avoids conflict.', scenarioNumber: 2, interviewMoment: 3 },
    ];
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1, 2, 3],
      scenarioScores: {
        1: { pillarScores: { empathy: 1 } },
        2: { pillarScores: { empathy: 1 } },
        3: { pillarScores: { empathy: 1 } },
      },
      resumeActiveFromStorage: null,
      resumeActiveFromAttempt: null,
      transcriptMessages: msgs,
      syncedMoments: {
        momentsComplete: { 1: true, 2: true, 3: false, 4: false, 5: false },
        currentMoment: 3,
        personalHandoffInjected: false,
      },
    });
    expect(plan.mode).toBe('replay_incomplete');
    expect(plan.effectiveMoment).toBe(3);
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
      scenarioScores: {
        1: { pillarScores: { mentalizing: 6 }, pillarConfidence: {}, keyEvidence: {} },
      },
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
    expect(plan.rewindDueToCorruptScoring).toBe(false);
  });

  it('resumes scenario 3 when S1 scoring interrupted but transcript already reached S3 vignette', () => {
    const tagged = assignScenarioNumbersToTranscript([
      { role: 'assistant', content: "Here's the first situation. Emma and Ryan." },
      { role: 'user', content: 'Ryan should set boundaries.' },
      { role: 'assistant', content: "Here's the second situation. Sarah has been job hunting." },
      { role: 'user', content: 'James should have been more supportive.' },
      { role: 'assistant', content: SHOW_SCENARIO_3_VIGNETTE_EXACT },
    ]);
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1],
      scenarioScores: {},
      resumeActiveFromStorage: 2,
      resumeActiveFromAttempt: 2,
      transcriptMessages: tagged,
      syncedMoments: {
        momentsComplete: { 1: true, 2: false, 3: false, 4: false, 5: false },
        currentMoment: 3,
        personalHandoffInjected: false,
      },
    });
    expect(plan.resumeScenario).toBe(3);
    expect(plan.mode).toBe('replay_incomplete');
    expect(plan.rewindDueToCorruptScoring).toBe(false);
    expect(plan.effectiveMoment).toBe(3);
  });

  it('resumes scenario 2 when S1 scoring interrupted but user already advanced to S2', () => {
    const tagged = assignScenarioNumbersToTranscript([
      { role: 'assistant', content: "Here's the first situation. Emma and Ryan." },
      { role: 'user', content: 'Ryan should set boundaries.' },
      { role: 'assistant', content: "Here's the second situation. Sarah has been job hunting." },
      { role: 'user', content: 'James should have been more supportive.' },
    ]);
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1],
      scenarioScores: {},
      resumeActiveFromStorage: 2,
      resumeActiveFromAttempt: 2,
      transcriptMessages: tagged,
      syncedMoments: {
        momentsComplete: { 1: true, 2: false, 3: false, 4: false, 5: false },
        currentMoment: 2,
        personalHandoffInjected: false,
      },
    });
    expect(plan.resumeScenario).toBe(2);
    expect(plan.mode).toBe('replay_incomplete');
    expect(plan.rewindDueToCorruptScoring).toBe(false);
    expect(plan.effectiveMoment).toBe(2);
  });

  it('rewinds to scenario 1 when scenariosCompleted claims 1 but scores were interrupted and user still on S1', () => {
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1],
      scenarioScores: {},
      resumeActiveFromStorage: 1,
      resumeActiveFromAttempt: null,
      syncedMoments: {
        momentsComplete: { 1: true, 2: false, 3: false, 4: false, 5: false },
        currentMoment: 1,
        personalHandoffInjected: false,
      },
    });
    expect(plan.resumeScenario).toBe(1);
    expect(plan.mode).toBe('replay_incomplete');
    expect(plan.rewindDueToCorruptScoring).toBe(true);
    expect(plan.lastCompletedScenario).toBe(0);
  });

  it('rewinds to earliest corrupt scenario when thin null-only score shell exists', () => {
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1, 2],
      scenarioScores: {
        1: { pillarScores: { mentalizing: 7 }, pillarConfidence: {}, keyEvidence: {} },
        2: { pillarScores: { mentalizing: null }, pillarConfidence: {}, keyEvidence: {} },
      },
      resumeActiveFromStorage: 3,
      resumeActiveFromAttempt: 3,
      syncedMoments: {
        momentsComplete: { 1: true, 2: true, 3: false, 4: false, 5: false },
        currentMoment: 3,
        personalHandoffInjected: false,
      },
    });
    expect(plan.resumeScenario).toBe(2);
    expect(plan.rewindDueToCorruptScoring).toBe(true);
    expect(plan.lastCompletedScenario).toBe(1);
  });

  it('rewinds to Moment 4 when M5 was reached but moment_4_scores are missing', () => {
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1, 2, 3],
      scenarioScores: {
        1: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        2: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        3: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
      },
      resumeActiveFromStorage: null,
      resumeActiveFromAttempt: null,
      transcriptMessages: [
        {
          role: 'assistant',
          content: 'Tell me about a real conflict with someone important to you.',
        },
      ],
      syncedMoments: {
        momentsComplete: { 1: true, 2: true, 3: true, 4: true, 5: true },
        currentMoment: 5,
        personalHandoffInjected: true,
      },
      moment4ScoresIntact: false,
    });
    expect(plan.rewindToMoment4DueToCorruptScoring).toBe(true);
    expect(plan.rewindDueToCorruptScoring).toBe(true);
    expect(plan.effectiveMoment).toBe(4);
    expect(plan.mode).toBe('resume_post_scenarios');
  });

  it('does not treat mid-Moment-4 (before M5) as corrupt M4 scoring', () => {
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1, 2, 3],
      scenarioScores: {
        1: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        2: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        3: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
      },
      resumeActiveFromStorage: null,
      resumeActiveFromAttempt: null,
      syncedMoments: {
        momentsComplete: { 1: true, 2: true, 3: true, 4: false, 5: false },
        currentMoment: 4,
        personalHandoffInjected: true,
      },
      moment4ScoresIntact: false,
    });
    expect(plan.rewindToMoment4DueToCorruptScoring).toBe(false);
    expect(plan.mode).toBe('resume_post_scenarios');
    expect(plan.effectiveMoment).toBe(4);
  });

  it('stays on scenario 3 when all scenarios scored but S3 Q&A is still in progress', () => {
    const s3Question =
      "When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1, 2, 3],
      scenarioScores: {
        1: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        2: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        3: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
      },
      resumeActiveFromStorage: null,
      resumeActiveFromAttempt: null,
      transcriptMessages: [
        { role: 'assistant', content: s3Question, scenarioNumber: 3 },
        { role: 'user', content: 'I think Daniel shut down.', scenarioNumber: 3 },
        {
          role: 'assistant',
          content: "Got it. One more situation and then we'll get personal.",
          scenarioNumber: 3,
        },
      ],
      syncedMoments: {
        momentsComplete: { 1: true, 2: true, 3: true, 4: false, 5: false },
        currentMoment: 4,
        personalHandoffInjected: false,
      },
    });
    expect(plan.mode).toBe('replay_incomplete');
    expect(plan.resumeScenario).toBe(3);
    expect(plan.effectiveMoment).toBe(3);
    expect(
      buildResumeWelcomeMessage({
        mode: plan.mode,
        resumeScenario: plan.resumeScenario,
        lastQuestionText: s3Question,
      }).toLowerCase(),
    ).toContain('scenario three');
    expect(
      buildResumeWelcomeMessage({
        mode: plan.mode,
        resumeScenario: plan.resumeScenario,
        lastQuestionText: s3Question,
      }).toLowerCase(),
    ).not.toContain('personal part');
  });

  it('advances to Moment 4 when S3 repair is satisfied but scenario scores never persisted', () => {
    const s3Q1 =
      "When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const s3RepairAnswer =
      'This situation can be repaired if Daniel would acknowledge how she feels, if he would look for the solutions to find out why he is leaving, what he has avoided and get in touch with his feelings.';
    const transcriptMessages = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL, scenarioNumber: 2 },
      { role: 'assistant', content: s3Q1, scenarioNumber: 3 },
      { role: 'user', content: 'Daniel avoids conflict and shuts down.', scenarioNumber: 3 },
      { role: 'assistant', content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE, scenarioNumber: 3 },
      { role: 'user', content: 'Sophie feels unheard and invisible.', scenarioNumber: 3 },
      { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL, scenarioNumber: 3 },
      { role: 'user', content: s3RepairAnswer, scenarioNumber: 3 },
    ];
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [],
      scenarioScores: {},
      resumeActiveFromStorage: 3,
      resumeActiveFromAttempt: 3,
      transcriptMessages,
      syncedMoments: {
        momentsComplete: { 1: false, 2: false, 3: false, 4: false, 5: false },
        currentMoment: 3,
        personalHandoffInjected: false,
      },
    });
    expect(plan.lastCompletedScenario).toBe(0);
    expect(plan.mode).toBe('resume_post_scenarios');
    expect(plan.effectiveMoment).toBe(4);
    expect(plan.momentsComplete[3]).toBe(true);
    expect(plan.rewindDueToCorruptScoring).toBe(false);
    expect(
      buildResumeWelcomeMessage({
        mode: plan.mode,
        resumeScenario: plan.resumeScenario,
        lastQuestionText: MOMENT_4_GRUDGE_QUESTION_TEXT,
      }).toLowerCase(),
    ).toContain('personal part');
  });

  it('advances to Moment 4 when S3 repair is satisfied but M4 handoff was not delivered before app close', () => {
    const s3Q1 =
      "When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const s3RepairAnswer =
      'This situation can be repaired if Daniel acknowledges how he feels, if he would look for the solution to find out why he is leaving, what he is avoiding and get in touch with his feelings, this situation could be reparative.';
    const transcriptMessages = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL, scenarioNumber: 2 },
      { role: 'assistant', content: s3Q1, scenarioNumber: 3 },
      { role: 'user', content: 'Daniel avoids conflict and shuts down.', scenarioNumber: 3 },
      { role: 'assistant', content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE, scenarioNumber: 3 },
      { role: 'user', content: 'Sophie feels unheard and invisible.', scenarioNumber: 3 },
      { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL, scenarioNumber: 3 },
      { role: 'user', content: s3RepairAnswer, scenarioNumber: 3 },
    ];
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1, 2, 3],
      scenarioScores: {
        1: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        2: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        3: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
      },
      resumeActiveFromStorage: 3,
      resumeActiveFromAttempt: 3,
      transcriptMessages,
      syncedMoments: {
        momentsComplete: { 1: true, 2: true, 3: true, 4: false, 5: false },
        currentMoment: 3,
        personalHandoffInjected: false,
      },
    });
    expect(plan.mode).toBe('resume_post_scenarios');
    expect(plan.effectiveMoment).toBe(4);
    expect(plan.momentsComplete[3]).toBe(true);
    expect(plan.personalHandoffInjected).toBe(false);
    expect(plan.rewindDueToCorruptScoring).toBe(false);
  });

  it('resumes personal part when user turn is tagged interviewMoment 4 even without grudge assistant row', () => {
    const transcriptMessages = [
        { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL, scenarioNumber: 2 },
        { role: 'assistant', content: 'How do you think this situation could be repaired?', scenarioNumber: 3 },
        { role: 'user', content: 'Daniel should apologize.', scenarioNumber: 3, interviewMoment: 3 },
        { role: 'user', content: 'My coworker and I had a falling out.', interviewMoment: 4 },
      ];
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1, 2, 3],
      scenarioScores: {
        1: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        2: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        3: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
      },
      resumeActiveFromStorage: 3,
      resumeActiveFromAttempt: 3,
      transcriptMessages,
      syncedMoments: {
        momentsComplete: { 1: true, 2: true, 3: true, 4: false, 5: false },
        currentMoment: 3,
        personalHandoffInjected: false,
      },
    });
    expect(transcriptHasPersistedPersonalPartProgress(transcriptMessages)).toBe(true);
    expect(
      resumeTranscriptIndicatesPersonalPartActive(transcriptMessages, {
        currentMoment: 3,
        personalHandoffInjected: false,
      }),
    ).toBe(true);
    expect(plan.mode).toBe('resume_post_scenarios');
    expect(plan.effectiveMoment).toBe(4);
    expect(
      buildResumeWelcomeMessage({
        mode: plan.mode,
        resumeScenario: plan.resumeScenario,
        lastQuestionText: MOMENT_4_GRUDGE_QUESTION_TEXT,
      }).toLowerCase(),
    ).toContain('personal part');
    expect(
      buildResumeWelcomeMessage({
        mode: plan.mode,
        resumeScenario: plan.resumeScenario,
        lastQuestionText: MOMENT_4_GRUDGE_QUESTION_TEXT,
      }).toLowerCase(),
    ).not.toContain('scenario three');
  });

  it('resumes Moment 4 when user answered grudge after S3 repair even without interviewMoment tags', () => {
    const s3Q1 =
      "When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const grudgeAnswer =
      'My former roommate and I had a huge falling out over rent and we have not spoken in two years.';
    const transcriptMessages = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL, scenarioNumber: 2 },
      { role: 'assistant', content: s3Q1, scenarioNumber: 3 },
      { role: 'user', content: 'Daniel avoids conflict and shuts down.', scenarioNumber: 3 },
      { role: 'assistant', content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE, scenarioNumber: 3 },
      { role: 'user', content: 'Sophie feels unheard and invisible.', scenarioNumber: 3 },
      { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL, scenarioNumber: 3 },
      { role: 'user', content: 'They should talk honestly about how leaving makes her feel.', scenarioNumber: 3 },
      { role: 'user', content: grudgeAnswer, scenarioNumber: 3 },
    ];
    const plan = computeInterviewResumePlan({
      scenariosCompleted: [1, 2, 3],
      scenarioScores: {
        1: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        2: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        3: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
      },
      resumeActiveFromStorage: 3,
      resumeActiveFromAttempt: 3,
      transcriptMessages,
      syncedMoments: {
        momentsComplete: { 1: true, 2: true, 3: true, 4: false, 5: false },
        currentMoment: 4,
        personalHandoffInjected: false,
      },
    });
    expect(plan.mode).toBe('resume_post_scenarios');
    expect(plan.effectiveMoment).toBe(4);
    expect(plan.resumeScenario).toBe(3);
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

  it('assignScenarioNumbersToTranscript keeps Situation 3 when interviewMoment is 3 without vignette anchor', () => {
    const s3Q1 =
      "When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const raw = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL, interviewMoment: 2 },
      { role: 'assistant', content: s3Q1, interviewMoment: 3 },
      { role: 'user', content: 'Daniel felt genuinely at home.', interviewMoment: 3 },
      { role: 'assistant', content: 'Makes sense. Just say whatever comes to mind.', interviewMoment: 3 },
    ];
    const out = assignScenarioNumbersToTranscript(raw);
    expect((out[1] as { scenarioNumber?: number }).scenarioNumber).toBe(3);
    expect((out[2] as { scenarioNumber?: number }).scenarioNumber).toBe(3);
    expect((out[3] as { scenarioNumber?: number }).scenarioNumber).toBe(3);
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
