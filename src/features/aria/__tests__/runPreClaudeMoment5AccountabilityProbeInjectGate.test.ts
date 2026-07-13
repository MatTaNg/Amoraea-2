import { describe, expect, it, jest } from '@jest/globals';

import type { PreClaudeMoment5AccountabilityEvalContext } from '@features/aria/buildPreClaudeMoment5AccountabilityEvalContext';
import {
  MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT,
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  MOMENT_5_SPECIFICITY_REDIRECT_TEXT,
} from '@features/aria/probeAndScoringUtils';
import { runPreClaudeMoment5AccountabilityProbeInjectGate } from '@features/aria/runPreClaudeMoment5AccountabilityProbeInjectGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

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
    moment5SpecificityRedirectIssuedRef: { current: false },
    probeLogRef: { current: [] },
    ...overrides,
  });
}

const CONCRETE_OTHER_BLAME_WITH_RESOLUTION =
  'We had a fight about money. They were totally unreasonable and kept bringing up old grievances every time we talked. Eventually we sat down and talked it through until we could listen.';

const ABSTRACT =
  "Yeah I've had conflicts before. Communication is important and eventually things worked themselves out.";

const DEATH_DISCLOSURE_ANSWER =
  'We had a conflict after my father passed away and I struggled to communicate with my siblings about how to handle the estate.';

describe('runPreClaudeMoment5AccountabilityProbeInjectGate', () => {
  it('returns null when accountability probe is not a candidate', async () => {
    const deps = baseMoment5Deps();
    const result = await runPreClaudeMoment5AccountabilityProbeInjectGate(
      deps,
      CONCRETE_OTHER_BLAME_WITH_RESOLUTION,
      [{ role: 'user', content: CONCRETE_OTHER_BLAME_WITH_RESOLUTION, interviewMoment: 5 }],
      baseCtx({ moment5AccountabilityProbeCandidate: false }),
    );
    expect(result).toBeNull();
  });

  it('delegates to specificity redirect before firing the accountability probe', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = baseMoment5Deps({ speakTextSafe });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: ABSTRACT, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5AccountabilityProbeInjectGate(
      deps,
      ABSTRACT,
      messagesToUse,
      baseCtx({ moment5CombinedUserText: ABSTRACT }),
    );

    expect(result?.handled).toBe(true);
    expect(deps.moment5SpecificityRedirectIssuedRef.current).toBe(true);
    expect(deps.moment5AccountabilityProbeFiredRef.current).toBe(false);
    expect(speakTextSafe).toHaveBeenCalledWith(MOMENT_5_SPECIFICITY_REDIRECT_TEXT, expect.any(Object));
  });

  it('returns null when self-accountability is already established', async () => {
    const deps = baseMoment5Deps();
    const result = await runPreClaudeMoment5AccountabilityProbeInjectGate(
      deps,
      CONCRETE_OTHER_BLAME_WITH_RESOLUTION,
      [{ role: 'user', content: CONCRETE_OTHER_BLAME_WITH_RESOLUTION, interviewMoment: 5 }],
      baseCtx({
        moment5NarrativeConcreteIncludingCurrent: true,
        moment5SelfAccountabilityAlreadyEstablished: true,
        moment5CombinedIncludingCurrent: 'I admitted I was defensive and owned my part in the fight.',
      }),
    );
    expect(result).toBeNull();
    expect(deps.moment5AccountabilityProbeFiredRef.current).toBe(false);
  });

  it('fires accountability probe after specificity redirect when self-accountability is still missing', async () => {
    const deps = baseMoment5Deps({
      moment5SpecificityRedirectIssuedRef: { current: true },
    });
    const concreteAfterRedirect =
      'Last week my roommate and I argued about dishes. They were being unreasonable and we still have not resolved it.';
    const result = await runPreClaudeMoment5AccountabilityProbeInjectGate(
      deps,
      concreteAfterRedirect,
      [
        { role: 'assistant', content: MOMENT_5_SPECIFICITY_REDIRECT_TEXT, interviewMoment: 5 },
        { role: 'user', content: concreteAfterRedirect, interviewMoment: 5 },
      ],
      baseCtx({
        moment5AnsweringAfterSpecificityRedirect: true,
        moment5NarrativeConcreteIncludingCurrent: true,
        moment5CombinedUserText: concreteAfterRedirect,
        moment5AccountabilityEval: {
          shouldProbe: true,
          reason: 'lacks_explicit_self_accountability',
          selfReference: {
            accountability_probe_self_reference_detected: false,
            self_reference_type: 'process_description',
          },
        },
      }),
    );
    expect(result?.handled).toBe(true);
    expect(deps.moment5AccountabilityProbeFiredRef.current).toBe(true);
  });

  it('fires accountability probe for concrete blame narratives lacking self-accountability', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = baseMoment5Deps({ speakTextSafe, setMessages });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: CONCRETE_OTHER_BLAME_WITH_RESOLUTION, interviewMoment: 5 },
    ];

    const result = await runPreClaudeMoment5AccountabilityProbeInjectGate(
      deps,
      CONCRETE_OTHER_BLAME_WITH_RESOLUTION,
      messagesToUse,
      baseCtx({
        moment5NarrativeConcreteIncludingCurrent: true,
        moment5CombinedUserText: CONCRETE_OTHER_BLAME_WITH_RESOLUTION,
        moment5CombinedIncludingCurrent: CONCRETE_OTHER_BLAME_WITH_RESOLUTION,
      }),
    );

    expect(result?.handled).toBe(true);
    expect(deps.moment5AccountabilityProbeFiredRef.current).toBe(true);
    expect(deps.moment5ClientScoringMetaRef.current).toMatchObject({
      accountabilityProbeFired: true,
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
    expect(speakTextSafe).toHaveBeenCalled();
    expect(setMessages).toHaveBeenCalled();
  });

  it('uses grief-aware probe copy when death is disclosed', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = baseMoment5Deps({ speakTextSafe });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
      { role: 'user', content: DEATH_DISCLOSURE_ANSWER, interviewMoment: 5 },
    ];

    await runPreClaudeMoment5AccountabilityProbeInjectGate(
      deps,
      DEATH_DISCLOSURE_ANSWER,
      messagesToUse,
      baseCtx({
        moment5NarrativeConcreteIncludingCurrent: true,
        moment5CombinedUserText: DEATH_DISCLOSURE_ANSWER,
        moment5CombinedIncludingCurrent: DEATH_DISCLOSURE_ANSWER,
      }),
    );

    expect(deps.moment5ClientScoringMetaRef.current).toMatchObject({
      griefAckBeforeAccountabilityProbe: true,
    });
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining(MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT.slice(0, 24)),
      expect.any(Object),
    );
  });
});
