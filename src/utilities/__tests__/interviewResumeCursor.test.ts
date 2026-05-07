import { describe, expect, it } from 'vitest';
import {
  buildResumeWelcomeMessage,
  computeInterviewResumePlan,
  firstAssistantIndexForScenarioIntro,
  lastFullyCompletedScenario,
  retagScenarioNumbersBeforeMomentFour,
  sliceMessagesBeforeScenarioIntro,
} from '../interviewResumeCursor';

describe('interviewResumeCursor', () => {
  it('lastFullyCompletedScenario prefers score bundles', () => {
    expect(
      lastFullyCompletedScenario(
        [1],
        { 1: { pillarScores: { mentalizing: 5 }, pillarConfidence: {}, keyEvidence: {} } }
      )
    ).toBe(1);
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
});
