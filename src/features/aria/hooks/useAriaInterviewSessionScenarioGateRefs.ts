import { useRef } from 'react';

import { createInitialMomentCompletion } from '@features/aria/interviewProgressSync';
import type { ShowScenarioCardCanonicalPlaybackConfirmedKinds } from '@features/aria/showScenarioCardCanonicalTts';
import type { InterviewMomentIndex } from '@features/aria/interviewScenarioScoringSlice';
import type { Moment5ClientScoringMetadata } from '@features/aria/moment5AccountabilityScoringPrompt';
import type { Moment4ClientScoringMetadata } from '@features/aria/personalMomentScoringPrompt';

export function useAriaInterviewSessionScenarioGateRefs() {
  const interviewNameRef = useRef<string | null>(null);
  const interviewNameReaskPendingRef = useRef(false);
  const interviewNameReaskUsedRef = useRef(false);
  const interviewMomentsCompleteRef = useRef(createInitialMomentCompletion());
  const currentInterviewMomentRef = useRef<InterviewMomentIndex>(1);
  const personalHandoffInjectedRef = useRef(false);
  const moment4ThresholdProbeAskedRef = useRef(false);
  const deliveredReflectionRegistryRef = useRef<
    import('@features/aria/deliveredReflectionRegistry').DeliveredReflectionRecord[]
  >([]);
  const moment4ClientSpecificityProbeInjectedRef = useRef(false);
  const moment4PostGrudgeSpecificityResolvedRef = useRef(false);
  const moment4ExpectingPostSpecificityUserTurnRef = useRef(false);
  const moment4SpecificityScoringRef = useRef<Moment4ClientScoringMetadata | null>(null);
  const deferredMoment4NarrativeRef = useRef<string | null>(null);
  const moment5QuestionDeliveredRef = useRef(false);
  const moment5QuestionDeliveryInFlightRef = useRef(false);
  const moment5PrimaryAnchorDeliveredSessionRef = useRef(false);
  const moment5PostPromptUserTurnCountRef = useRef(0);
  const moment5AccountabilityProbeFiredRef = useRef(false);
  const moment5ConflictValidityClarificationIssuedRef = useRef(false);
  const moment5SpecificityRedirectIssuedRef = useRef(false);
  const moment5ResolutionFollowUpIssuedRef = useRef(false);
  const moment5ResolutionDeliveredRef = useRef(false);
  const moment5ClientScoringMetaRef = useRef<Moment5ClientScoringMetadata | null>(null);
  const scenarioCRepairOnlyEvidenceRef = useRef<string | null>(null);
  const scenarioCSophiePerspectiveProbeFiredRef = useRef(false);
  const scenarioAContemptProbeAskedRef = useRef(false);
  const scenarioAContemptProbePlaybackConfirmedRef = useRef(false);
  const showScenarioCardCanonicalPlaybackConfirmedKindsRef =
    useRef<ShowScenarioCardCanonicalPlaybackConfirmedKinds>({});
  const scenarioAContemptProbeTtsDeliveredSessionRef = useRef(false);
  const pendingScenarioAContemptProbeStreamMuteRef = useRef(false);
  const pendingS3ToM4HandoffStreamMuteRef = useRef(false);
  const scenarioARepairQuestionAskedRef = useRef(false);
  const s2RepairProbeDeliveredRef = useRef(false);
  const s3RepairProbeDeliveredRef = useRef(false);
  const lastUserTurnAudioDurationMsRef = useRef<number | null>(null);
  const lastUserTurnMicStopTelemetryRef = useRef<
    import('@features/aria/interviewCutOffDetectionTypes').UserTurnMicStopTelemetry | null
  >(null);
  const turnAudioIndexRef = useRef(0);
  const responseTimingsRef = useRef<
    Array<{
      question_id: string;
      scenario: number | null;
      question_text: string;
      latency_ms: number;
      duration_ms: number;
      word_count: number;
    }>
  >([]);

  return {
    interviewNameRef,
    interviewNameReaskPendingRef,
    interviewNameReaskUsedRef,
    interviewMomentsCompleteRef,
    currentInterviewMomentRef,
    personalHandoffInjectedRef,
    moment4ThresholdProbeAskedRef,
    deliveredReflectionRegistryRef,
    moment4ClientSpecificityProbeInjectedRef,
    moment4PostGrudgeSpecificityResolvedRef,
    moment4ExpectingPostSpecificityUserTurnRef,
    moment4SpecificityScoringRef,
    deferredMoment4NarrativeRef,
    moment5QuestionDeliveredRef,
    moment5QuestionDeliveryInFlightRef,
    moment5PrimaryAnchorDeliveredSessionRef,
    moment5PostPromptUserTurnCountRef,
    moment5AccountabilityProbeFiredRef,
    moment5ConflictValidityClarificationIssuedRef,
    moment5SpecificityRedirectIssuedRef,
    moment5ResolutionFollowUpIssuedRef,
    moment5ResolutionDeliveredRef,
    moment5ClientScoringMetaRef,
    scenarioCRepairOnlyEvidenceRef,
    scenarioCSophiePerspectiveProbeFiredRef,
    scenarioAContemptProbeAskedRef,
    scenarioAContemptProbePlaybackConfirmedRef,
    showScenarioCardCanonicalPlaybackConfirmedKindsRef,
    scenarioAContemptProbeTtsDeliveredSessionRef,
    pendingScenarioAContemptProbeStreamMuteRef,
    pendingS3ToM4HandoffStreamMuteRef,
    scenarioARepairQuestionAskedRef,
    s2RepairProbeDeliveredRef,
    s3RepairProbeDeliveredRef,
    lastUserTurnAudioDurationMsRef,
    lastUserTurnMicStopTelemetryRef,
    turnAudioIndexRef,
    responseTimingsRef,
  };
}
