import { buildInterviewTtsPipelineMergedSyncCtx } from '@features/aria/buildInterviewTtsPipelineMergedSyncCtx';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

describe('buildInterviewTtsPipelineMergedSyncCtx', () => {
  it('preserves showScenarioCard and elongating refs from core instead of overwriting with undefined', () => {
    const kindsRef = { current: { situation_3: true } };
    const elongatingRef = { current: false };
    const metaExemptionRef = { current: jest.fn() };
    const applyCardRef = { current: jest.fn() };
    const committedRef = { current: null };

    const coreCtx = {
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: kindsRef,
      elongatingProbeFiredRef: elongatingRef,
      recordInterviewAssistantDeliveryForMetaExemptionRef: metaExemptionRef,
      s2RepairProbeDeliveredRef: { current: true },
      s3RepairProbeDeliveredRef: { current: false },
      committedScenarioRef: committedRef,
    } as unknown as AriaInterviewDepsSyncContext;

    const merged = buildInterviewTtsPipelineMergedSyncCtx(coreCtx, {
      setTtsPlaybackReliabilityNotice: jest.fn(),
      setLastTtsCompletionCallbackMs: jest.fn(),
      speak: jest.fn(),
      applyInterviewSpeechComplete: jest.fn(),
      awaitTtsScreenReadyGate: jest.fn(async () => undefined),
      stopElevenLabsPlayback: jest.fn(async () => undefined),
      referenceCardShouldUpdateOnPlaybackStart: () => false,
      persistInterviewAttemptSessionLifecycle: jest.fn(async () => undefined),
      applyReferenceCardFromAssistantSpeechRef: applyCardRef,
      s1ContemptFixVersion: 21,
      setReferenceCardPrompt: jest.fn(),
      setReferenceCardScenario: jest.fn(),
      setInterviewUiPhase: jest.fn(),
      prepareInterviewTtsPlayback: jest.fn(async () => undefined),
      committedScenarioRef: committedRef,
    });

    expect(merged.showScenarioCardCanonicalPlaybackConfirmedKindsRef).toBe(kindsRef);
    expect(merged.elongatingProbeFiredRef).toBe(elongatingRef);
    expect(merged.recordInterviewAssistantDeliveryForMetaExemptionRef).toBe(metaExemptionRef);
    expect(merged.applyReferenceCardFromAssistantSpeechRef).toBe(applyCardRef);
    expect(merged.committedScenarioRef).toBe(committedRef);
    expect(merged.setLastTtsCompletionCallbackMs).toEqual(expect.any(Function));
  });

  it('does not wipe core showScenarioCard when local scope omits it', () => {
    const kindsRef = { current: { moment_4: true } };
    const coreCtx = {
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: kindsRef,
      committedScenarioRef: { current: null },
    } as unknown as AriaInterviewDepsSyncContext;

    const merged = buildInterviewTtsPipelineMergedSyncCtx(coreCtx, {
      setTtsPlaybackReliabilityNotice: jest.fn(),
      setLastTtsCompletionCallbackMs: jest.fn(),
      speak: jest.fn(),
      applyInterviewSpeechComplete: jest.fn(),
      awaitTtsScreenReadyGate: jest.fn(async () => undefined),
      stopElevenLabsPlayback: jest.fn(async () => undefined),
      referenceCardShouldUpdateOnPlaybackStart: () => false,
      persistInterviewAttemptSessionLifecycle: jest.fn(async () => undefined),
      applyReferenceCardFromAssistantSpeechRef: { current: jest.fn() },
      s1ContemptFixVersion: 21,
      setReferenceCardPrompt: jest.fn(),
      setReferenceCardScenario: jest.fn(),
      setInterviewUiPhase: jest.fn(),
      prepareInterviewTtsPlayback: jest.fn(async () => undefined),
      committedScenarioRef: { current: null },
    });

    expect(merged.showScenarioCardCanonicalPlaybackConfirmedKindsRef).toBe(kindsRef);
  });
});
