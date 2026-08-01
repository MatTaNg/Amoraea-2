import { describe, expect, it, jest } from '@jest/globals';

import {
  MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT,
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT,
  MOMENT_5_RESOLUTION_FOLLOWUP_TEXT,
  MOMENT_5_SPECIFICITY_REDIRECT_TEXT,
} from '@features/aria/probeAndScoringUtils';
import { runPreClaudeMoment5AccountabilityInjectGates } from '@features/aria/runPreClaudeMoment5AccountabilityInjectGates';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@utilities/storage/InterviewStorage', () => ({
  getCurrentScenario: jest.fn().mockReturnValue(3),
  loadInterviewFromStorage: jest.fn().mockResolvedValue(null),
  mergeInterviewStoragePayload: jest.fn((prior: unknown, patch: Record<string, unknown>) => ({
    ...(prior as object),
    ...patch,
  })),
  saveInterviewToStorage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn().mockReturnValue({ attemptId: 'attempt-test', platform: 'web' }),
  writeSessionLog: jest.fn(),
}));

const SMOOTH_LOW_CONFLICT_ANSWER =
  'Last week my roommate and I had a conversation about the chore schedule. We just talked it out, agreed on who would do what, and it resolved pretty smoothly.';

const ABSTRACT_NO_ANCHOR_ANSWER =
  "Yeah I've had conflicts before. We both had our issues in the situation and eventually things worked themselves out. I think communication is just really important in any relationship.";

const CONCRETE_NO_RESOLUTION_ANSWER =
  'I had a conflict with a close friend over something they did that I felt was being considered. I was upset about it for a while before I said anything.';

const CONCRETE_OTHER_BLAME_WITH_RESOLUTION =
  'We had a fight about money. They were totally unreasonable and kept bringing up old grievances every time we talked. Eventually we sat down and talked it through until we could listen.';

function baseMoment5Deps(overrides: Parameters<typeof createMockPreClaudeDeps>[0] = {}) {
  return createMockPreClaudeDeps({
    currentInterviewMomentRef: { current: 5 },
    currentScenarioRef: { current: 3 },
    moment5QuestionDeliveredRef: { current: true },
    moment5AccountabilityProbeFiredRef: { current: false },
    moment5ConflictValidityClarificationIssuedRef: { current: false },
    moment5SpecificityRedirectIssuedRef: { current: false },
    moment5ResolutionFollowUpIssuedRef: { current: false },
    ...overrides,
  });
}

describe('runPreClaudeMoment5AccountabilityInjectGates', () => {
  it('returns handled:false when Moment 5 anchor is not in transcript and refs are unset', async () => {
    const deps = baseMoment5Deps({
      moment5QuestionDeliveredRef: { current: false },
      moment5PrimaryAnchorDeliveredSessionRef: { current: false },
      currentInterviewMomentRef: { current: 4 },
    });
    const messagesToUse = [
      { role: 'assistant', content: 'Tell me more about your grudge answer.', interviewMoment: 4 },
      { role: 'user', content: ABSTRACT_NO_ANCHOR_ANSWER, interviewMoment: 4 },
    ];

    const result = await runPreClaudeMoment5AccountabilityInjectGates(
      deps,
      ABSTRACT_NO_ANCHOR_ANSWER,
      messagesToUse,
      'Tell me more about your grudge answer.',
    );

    expect(result).toEqual({ handled: false, moment5CombinedUserText: expect.any(String) });
  });

  it('defers M5 inject gates when user asks to skip/advance (skip_request meta)', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = baseMoment5Deps({ speakTextSafe });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: "What's the next one?", interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5AccountabilityInjectGates(
      deps,
      "What's the next one?",
      messagesToUse,
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      { type: 'skip_request', confidence: 0.89 },
    );

    expect(result).toEqual({ handled: false, moment5CombinedUserText: "What's the next one?" });
    expect(speakTextSafe).not.toHaveBeenCalled();
    expect(deps.moment5SpecificityRedirectIssuedRef.current).toBe(false);
  });

  it('fires accountability probe when model delivered M5 but delivery refs were stale', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = baseMoment5Deps({
      moment5QuestionDeliveredRef: { current: false },
      moment5PrimaryAnchorDeliveredSessionRef: { current: true },
      currentInterviewMomentRef: { current: 4 },
      speakTextSafe,
    });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: CONCRETE_OTHER_BLAME_WITH_RESOLUTION, interviewMoment: 4 },
    ];

    const result = await runPreClaudeMoment5AccountabilityInjectGates(
      deps,
      CONCRETE_OTHER_BLAME_WITH_RESOLUTION,
      messagesToUse,
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(deps.moment5AccountabilityProbeFiredRef.current).toBe(true);
    expect(deps.moment5QuestionDeliveredRef.current).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(5);
    expect(deps.probeLogRef.current).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          construct: 'accountability',
          probe_fired: true,
          trigger_reason: 'lacks_explicit_self_accountability',
        }),
      ]),
    );
  });

  it('issues conflict-validity clarification for smooth concrete narratives', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({ speakTextSafe, setMessages });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: SMOOTH_LOW_CONFLICT_ANSWER, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5AccountabilityInjectGates(
      deps,
      SMOOTH_LOW_CONFLICT_ANSWER,
      messagesToUse,
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(deps.moment5ConflictValidityClarificationIssuedRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT,
      expect.any(Object),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT,
        }),
      ]),
    );
  });

  it('skips accountability injects for narrative opener cut-offs like "This one time"', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({ speakTextSafe, setMessages });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: 'This one time', interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5AccountabilityInjectGates(
      deps,
      'This one time',
      messagesToUse,
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
    );

    expect(result).toEqual({ handled: false, moment5CombinedUserText: 'This one time' });
    expect(speakTextSafe).not.toHaveBeenCalled();
    expect(setMessages).not.toHaveBeenCalled();
    expect(deps.moment5SpecificityRedirectIssuedRef.current).toBe(false);
    expect(deps.moment5ResolutionFollowUpIssuedRef.current).toBe(false);
    expect(deps.moment5AccountabilityProbeFiredRef.current).toBe(false);
  });

  it('issues specificity redirect for abstract answers without a concrete anchor', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({ speakTextSafe, setMessages });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: ABSTRACT_NO_ANCHOR_ANSWER, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5AccountabilityInjectGates(
      deps,
      ABSTRACT_NO_ANCHOR_ANSWER,
      messagesToUse,
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(deps.moment5SpecificityRedirectIssuedRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(MOMENT_5_SPECIFICITY_REDIRECT_TEXT, expect.any(Object));
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: MOMENT_5_SPECIFICITY_REDIRECT_TEXT,
        }),
      ]),
    );
  });

  it('issues resolution follow-up when narrative is concrete but resolution is missing', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({ speakTextSafe, setMessages });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: CONCRETE_NO_RESOLUTION_ANSWER, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5AccountabilityInjectGates(
      deps,
      CONCRETE_NO_RESOLUTION_ANSWER,
      messagesToUse,
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(deps.moment5ResolutionFollowUpIssuedRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(MOMENT_5_RESOLUTION_FOLLOWUP_TEXT, expect.any(Object));
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT,
        }),
      ]),
    );
  });

  it('fires accountability probe when resolution is present but self-accountability is missing', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({
      moment5ResolutionFollowUpIssuedRef: { current: true },
      speakTextSafe,
      setMessages,
    });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: CONCRETE_OTHER_BLAME_WITH_RESOLUTION, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5AccountabilityInjectGates(
      deps,
      CONCRETE_OTHER_BLAME_WITH_RESOLUTION,
      messagesToUse,
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(deps.moment5AccountabilityProbeFiredRef.current).toBe(true);
    expect(deps.probeLogRef.current).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          construct: 'accountability',
          probe_fired: true,
        }),
      ]),
    );
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining(MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT.slice(0, 24)),
      expect.any(Object),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringMatching(/contributed to the conflict/i),
        }),
      ]),
    );
  });

  it('fires accountability probe after resolution follow-up when the short reply alone is too thin', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({
      moment5ResolutionFollowUpIssuedRef: { current: true },
      speakTextSafe,
      setMessages,
    });
    const conflictAnswer =
      "I had a conflict with my best friend last year where I'd been pulling away and not showing up for her the way I normally would. She called me out on it directly. We didn't speak for a few days. It was really uncomfortable.";
    const resolutionAnswer = 'It was never resolved.';
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: conflictAnswer, interviewMoment: 5 },
      { role: 'assistant', content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5AccountabilityInjectGates(
      deps,
      resolutionAnswer,
      messagesToUse,
      MOMENT_5_RESOLUTION_FOLLOWUP_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(deps.moment5AccountabilityProbeFiredRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining('contributed to the conflict'),
      expect.any(Object),
    );
  });

  it('fires accountability probe for mom marriage resolution without self-accountability', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({
      moment5ResolutionFollowUpIssuedRef: { current: true },
      speakTextSafe,
      setMessages,
    });
    const momConflictAnswer =
      'I had a massive conflict with my mom regarding when I was going to get married. I realized she lacked some of the context around my timeline. I explained to her what was going on for me.';
    const resolutionAnswer =
      'I took time to logically explain to her my rationale and my side of things, and assured her that I wanted the same things as she did, but I just needed time.';
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: momConflictAnswer, interviewMoment: 5 },
      { role: 'assistant', content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5AccountabilityInjectGates(
      deps,
      resolutionAnswer,
      messagesToUse,
      MOMENT_5_RESOLUTION_FOLLOWUP_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(deps.moment5AccountabilityProbeFiredRef.current).toBe(true);
    expect(deps.moment5ClientScoringMetaRef.current).toMatchObject({
      accountabilityProbeFired: true,
      probeTriggerReason: 'lacks_explicit_self_accountability',
      warmAckBeforeAccountabilityProbe: true,
    });
    expect(deps.probeLogRef.current).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          construct: 'accountability',
          probe_fired: true,
          trigger_reason: 'lacks_explicit_self_accountability',
        }),
      ]),
    );
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining('contributed to the conflict'),
      expect.any(Object),
    );
    expect(speakTextSafe).not.toHaveBeenCalledWith(
      expect.stringContaining('specific time you had a conflict'),
      expect.any(Object),
    );
  });

  it('uses canonical probe text when resolution reply alone would pick philosophy variant', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({
      moment5ResolutionFollowUpIssuedRef: { current: true },
      speakTextSafe,
      setMessages,
    });
    const momConflictAnswer =
      'I had a massive conflict with my mom regarding when I was going to get married. I realized she lacked some of the context around my timeline.';
    const resolutionAnswer =
      'I think I took time to logically explain to her my rationale and my side of things, and assured her that I wanted the same things as she did, but I just needed time.';
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: momConflictAnswer, interviewMoment: 5 },
      { role: 'assistant', content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5AccountabilityInjectGates(
      deps,
      resolutionAnswer,
      messagesToUse,
      MOMENT_5_RESOLUTION_FOLLOWUP_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT,
      expect.any(Object),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT,
        }),
      ]),
    );
  });
});
