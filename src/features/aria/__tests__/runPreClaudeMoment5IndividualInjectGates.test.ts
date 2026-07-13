import { describe, expect, it, jest } from '@jest/globals';

import type { PreClaudeMoment5AccountabilityEvalContext } from '@features/aria/buildPreClaudeMoment5AccountabilityEvalContext';
import {
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT,
  MOMENT_5_RESOLUTION_FOLLOWUP_TEXT,
  MOMENT_5_SPECIFICITY_REDIRECT_TEXT,
} from '@features/aria/probeAndScoringUtils';
import { runPreClaudeMoment5ConflictValidityClarificationGate } from '@features/aria/runPreClaudeMoment5ConflictValidityClarificationGate';
import { runPreClaudeMoment5PersistentAbstractMoveOnGate } from '@features/aria/runPreClaudeMoment5PersistentAbstractMoveOnGate';
import { runPreClaudeMoment5ResolutionFollowUpGate } from '@features/aria/runPreClaudeMoment5ResolutionFollowUpGate';
import { runPreClaudeMoment5SpecificityRedirectGate } from '@features/aria/runPreClaudeMoment5SpecificityRedirectGate';
import {
  MOMENT_5_PERSISTENT_ABSTRACT_MOVE_ON_TEXT,
} from '@features/aria/probeAndScoringUtils';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

function baseCtx(
  overrides: Partial<PreClaudeMoment5AccountabilityEvalContext> = {},
): PreClaudeMoment5AccountabilityEvalContext {
  return {
    moment5AccountabilityProbeCandidate: true,
    moment5AccountabilityEval: {
      shouldProbe: true,
      reason: 'lacks_explicit_self_accountability',
      selfReference: {
        accountability_probe_self_reference_detected: false,
        self_reference_type: 'process_description',
      },
    },
    moment5CombinedUserText: '',
    moment5CombinedIncludingCurrent: '',
    moment5SelfAccountabilityAlreadyEstablished: false,
    moment5NarrativeConcrete: false,
    moment5NarrativeConcreteIncludingCurrent: false,
    moment5AnsweringAfterSpecificityRedirect: false,
    moment5AnsweringAfterConflictValidityClarification: false,
    moment5LowConflictValidity: false,
    moment5PriorM5Transcript: '',
    moment5ConflictValidityClassification: null,
    moment5AddsTensionDetailAfterClarification: false,
    moment5ForcedAbstractFollowupAccountabilityProbe: false,
    moment5PushbackAlreadyGaveSpecificExample: false,
    specificityRedirectAlreadyInTranscript: false,
    resolutionFollowUpAlreadyInTranscript: false,
    moment5AnsweringAfterResolutionFollowUp: false,
    ...overrides,
  };
}

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

const SMOOTH_CONCRETE =
  'Last week my roommate and I talked about chores. We agreed on a schedule and it resolved pretty smoothly.';
const ABSTRACT =
  "Yeah I've had conflicts before. Communication is important and eventually things worked themselves out.";
const CONCRETE_NO_RESOLUTION =
  'I had a conflict with a close friend over something they did that upset me. I stewed on it for weeks before saying anything.';

describe('runPreClaudeMoment5ConflictValidityClarificationGate', () => {
  it('returns null when clarification was already issued', async () => {
    const deps = baseMoment5Deps({
      moment5ConflictValidityClarificationIssuedRef: { current: true },
    });
    const result = await runPreClaudeMoment5ConflictValidityClarificationGate(
      deps,
      SMOOTH_CONCRETE,
      [{ role: 'user', content: SMOOTH_CONCRETE, interviewMoment: 5 }],
      baseCtx({
        moment5NarrativeConcrete: true,
        moment5LowConflictValidity: true,
      }),
    );
    expect(result).toBeNull();
  });

  it('injects clarification for concrete smooth narratives', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({ speakTextSafe, setMessages });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: SMOOTH_CONCRETE, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5ConflictValidityClarificationGate(
      deps,
      SMOOTH_CONCRETE,
      messagesToUse,
      baseCtx({
        moment5NarrativeConcrete: true,
        moment5LowConflictValidity: true,
        moment5CombinedUserText: SMOOTH_CONCRETE,
      }),
    );

    expect(result?.handled).toBe(true);
    expect(deps.moment5ConflictValidityClarificationIssuedRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT,
      expect.any(Object),
    );
  });
});

describe('runPreClaudeMoment5SpecificityRedirectGate', () => {
  it('returns null when narrative is already concrete', async () => {
    const deps = baseMoment5Deps();
    const result = await runPreClaudeMoment5SpecificityRedirectGate(
      deps,
      ABSTRACT,
      [{ role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT }],
      baseCtx({
        moment5NarrativeConcrete: true,
      }),
    );
    expect(result).toBeNull();
  });

  it('injects specificity redirect for abstract thin answers', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({ speakTextSafe, setMessages });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: ABSTRACT, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5SpecificityRedirectGate(
      deps,
      ABSTRACT,
      messagesToUse,
      baseCtx({
        moment5CombinedUserText: ABSTRACT,
      }),
    );

    expect(result?.handled).toBe(true);
    expect(deps.moment5SpecificityRedirectIssuedRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(MOMENT_5_SPECIFICITY_REDIRECT_TEXT, expect.any(Object));
  });
});

describe('runPreClaudeMoment5ResolutionFollowUpGate', () => {
  it('returns null when resolution is already in the user answer', async () => {
    const withResolution =
      'We argued about money but eventually we sat down and talked it through until we could listen again.';
    const deps = baseMoment5Deps();
    const result = await runPreClaudeMoment5ResolutionFollowUpGate(
      deps,
      withResolution,
      [{ role: 'user', content: withResolution, interviewMoment: 5 }],
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      baseCtx({
        moment5NarrativeConcreteIncludingCurrent: true,
        moment5CombinedUserText: withResolution,
      }),
    );
    expect(result).toBeNull();
  });

  it('injects resolution follow-up after concrete conflict without resolution', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({ speakTextSafe, setMessages });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: CONCRETE_NO_RESOLUTION, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5ResolutionFollowUpGate(
      deps,
      CONCRETE_NO_RESOLUTION,
      messagesToUse,
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      baseCtx({
        moment5NarrativeConcreteIncludingCurrent: true,
        moment5CombinedUserText: CONCRETE_NO_RESOLUTION,
      }),
    );

    expect(result?.handled).toBe(true);
    expect(deps.moment5ResolutionFollowUpIssuedRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(MOMENT_5_RESOLUTION_FOLLOWUP_TEXT, expect.any(Object));
  });
});

describe('runPreClaudeMoment5PersistentAbstractMoveOnGate', () => {
  it('returns null when specificity redirect was not issued', async () => {
    const deps = baseMoment5Deps({
      moment5SpecificityRedirectIssuedRef: { current: false },
    });
    const result = await runPreClaudeMoment5PersistentAbstractMoveOnGate(
      deps,
      ABSTRACT,
      [{ role: 'user', content: ABSTRACT, interviewMoment: 5 }],
      baseCtx({
        moment5NarrativeConcrete: true,
        moment5AnsweringAfterSpecificityRedirect: true,
        moment5AccountabilityEval: {
          shouldProbe: false,
          reason: 'decline_or_vague_evade',
          selfReference: {
            accountability_probe_self_reference_detected: false,
            self_reference_type: 'process_description',
          },
        },
      }),
    );
    expect(result).toBeNull();
  });

  it('moves on after persistent abstraction following specificity redirect', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({
      speakTextSafe,
      setMessages,
      moment5SpecificityRedirectIssuedRef: { current: true },
    });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'assistant', content: MOMENT_5_SPECIFICITY_REDIRECT_TEXT, interviewMoment: 5 },
      { role: 'user', content: ABSTRACT, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5PersistentAbstractMoveOnGate(
      deps,
      ABSTRACT,
      messagesToUse,
      baseCtx({
        moment5NarrativeConcrete: false,
        moment5AnsweringAfterSpecificityRedirect: true,
        moment5CombinedUserText: ABSTRACT,
        moment5AccountabilityEval: {
          shouldProbe: false,
          reason: 'decline_or_vague_evade',
          selfReference: {
            accountability_probe_self_reference_detected: false,
            self_reference_type: 'process_description',
          },
        },
      }),
    );

    expect(result?.handled).toBe(true);
    expect(deps.moment5ClientScoringMetaRef.current).toMatchObject({
      persistentAbstractionMoveOn: true,
      specificityRedirectIssued: true,
      accountabilityProbeFired: false,
    });
    expect(speakTextSafe).toHaveBeenCalledWith(
      MOMENT_5_PERSISTENT_ABSTRACT_MOVE_ON_TEXT,
      expect.any(Object),
    );
  });
});
