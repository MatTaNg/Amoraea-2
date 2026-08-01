import { S1_CONTEMPT_FIX_VERSION } from '@features/aria/interviewAdminConfig';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { deriveMoment4PostGrudgeSpecificityResolvedFromMessages } from '@features/aria/moment4SpecificityFollowUp';
import { looksLikeMoment4ThresholdQuestion } from '@features/aria/moment4ProbeLogic';
import { looksLikeMoment4SpecificityFollowUpEcho } from '@features/aria/moment4SpecificityFollowUp';
import {
  countUserTurnsAfterLastMoment5PrimaryAnchor,
} from '@features/aria/interviewProgressSync';
import {
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  looksLikeMoment5ConflictValidityClarificationPrompt,
  looksLikeMoment5SpecificityRedirectPrompt,
  looksLikeScenarioAContemptProbeQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  isScenarioCRepairAssistantPrompt,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
  transcriptHasMoment5ResolutionFollowUpAsked,
} from '@features/aria/probeAndScoringUtils';
import {
  scenarioOneFollowUpFlagsFromTranscript,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  aggregateScenario1Moment1UserTextForContemptGate,
  evaluateScenarioAQ1ContemptProbePreProbeSkip,
  hasScenarioAQ1ContemptProbeCoverage,
} from '@features/aria/scenarioAContemptProbeLogic';
import type { HandleResumeDeps } from '@features/aria/sessionLifecycleTypes';
import { extractInterviewNameFromTranscript } from '@features/aria/interviewNameExtraction';
import { resolvePlausibleInterviewFirstName } from '@features/aria/interviewNameValidation';
import { remoteLog } from '@utilities/remoteLog';
import type { SavedInterviewSnapshot } from '@utilities/storage/InterviewStorage';
import {
  type ShowScenarioCardCanonicalPlaybackConfirmedKinds,
} from '@features/aria/showScenarioCardCanonicalTts';
import { hydrateShowScenarioCardPlaybackConfirmedFromStorage } from '@features/aria/scenarioDeliveryResumeCheckpoint';

type ResumeProbeDeps = Pick<
  HandleResumeDeps,
  | 'interviewSessionIdRef'
  | 'interviewNameRef'
  | 'moment4ThresholdProbeAskedRef'
  | 'moment4PostGrudgeSpecificityResolvedRef'
  | 'moment4ClientSpecificityProbeInjectedRef'
  | 'moment5AccountabilityProbeFiredRef'
  | 'moment5SpecificityRedirectIssuedRef'
  | 'moment5ResolutionFollowUpIssuedRef'
  | 'moment5ResolutionDeliveredRef'
  | 'moment5ConflictValidityClarificationIssuedRef'
  | 'moment5QuestionDeliveredRef'
  | 'moment5PrimaryAnchorDeliveredSessionRef'
  | 'moment5PostPromptUserTurnCountRef'
  | 'scenarioAContemptProbeAskedRef'
  | 'scenarioAContemptProbeTtsDeliveredSessionRef'
  | 'scenarioAContemptProbePlaybackConfirmedRef'
  | 'showScenarioCardCanonicalPlaybackConfirmedKindsRef'
  | 'scenarioARepairQuestionAskedRef'
  | 's2RepairProbeDeliveredRef'
  | 's3RepairProbeDeliveredRef'
  | 'probeLogRef'
>;

export function hydrateResumeProbeFlagsFromTranscript(
  deps: ResumeProbeDeps,
  saved: SavedInterviewSnapshot,
  transcriptMessages: MessageWithScenario[],
): boolean {
  if (!deps.interviewNameRef.current) {
    const resumedName = extractInterviewNameFromTranscript(transcriptMessages);
    deps.interviewNameRef.current = resolvePlausibleInterviewFirstName(resumedName);
  } else {
    deps.interviewNameRef.current = resolvePlausibleInterviewFirstName(deps.interviewNameRef.current);
  }

  deps.moment4ThresholdProbeAskedRef.current = transcriptMessages.some(
    (m) =>
      m.role === 'assistant' &&
      typeof m.content === 'string' &&
      looksLikeMoment4ThresholdQuestion(m.content ?? ''),
  );
  deps.moment4PostGrudgeSpecificityResolvedRef.current =
    deriveMoment4PostGrudgeSpecificityResolvedFromMessages(transcriptMessages);
  deps.moment4ClientSpecificityProbeInjectedRef.current = transcriptMessages.some(
    (m) => m.role === 'assistant' && looksLikeMoment4SpecificityFollowUpEcho(m.content ?? ''),
  );
  deps.moment5AccountabilityProbeFiredRef.current = transcriptMessages.some(
    (m) =>
      m.role === 'assistant' &&
      looksLikeMoment5AccountabilityProbeAssistantPrompt(m.content ?? ''),
  );
  if (
    deps.moment5AccountabilityProbeFiredRef.current &&
    deps.probeLogRef &&
    !deps.probeLogRef.current.some(
      (e) => e.construct === 'accountability' && e.probe_fired === true,
    )
  ) {
    deps.probeLogRef.current.push({
      scenario: 3,
      construct: 'accountability',
      probe_fired: true,
      trigger_reason: 'lacks_explicit_self_accountability',
      pre_probe_score: 0,
      post_probe_score: 0,
      score_delta: 0,
    });
  }
  deps.moment5SpecificityRedirectIssuedRef.current = transcriptMessages.some(
    (m) =>
      m.role === 'assistant' && looksLikeMoment5SpecificityRedirectPrompt(m.content ?? ''),
  );
  deps.moment5ResolutionFollowUpIssuedRef.current = transcriptHasMoment5ResolutionFollowUpAsked(
    transcriptMessages.map((m) => ({
      role: m.role,
      content: m.content ?? '',
      isWelcomeBack: (m as { isWelcomeBack?: boolean }).isWelcomeBack,
    })),
  );
  deps.moment5ResolutionDeliveredRef.current = deps.moment5ResolutionFollowUpIssuedRef.current;
  const moment5ConflictValidityClarificationIssued =
    saved.moment_5_clarification_fired === true ||
    transcriptMessages.some(
      (m) =>
        m.role === 'assistant' &&
        looksLikeMoment5ConflictValidityClarificationPrompt(m.content ?? ''),
    );
  deps.moment5ConflictValidityClarificationIssuedRef.current = moment5ConflictValidityClarificationIssued;

  const transcriptHasM5PrimaryConflict = transcriptMessages.some(
    (m) =>
      m.role === 'assistant' &&
      typeof m.content === 'string' &&
      transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content ?? ''),
  );
  deps.moment5QuestionDeliveredRef.current = transcriptHasM5PrimaryConflict;
  deps.moment5PrimaryAnchorDeliveredSessionRef.current = transcriptHasM5PrimaryConflict;
  deps.moment5PostPromptUserTurnCountRef.current = countUserTurnsAfterLastMoment5PrimaryAnchor(
    transcriptMessages,
    deps.moment5PrimaryAnchorDeliveredSessionRef.current,
  );

  const scenarioAContemptProbePreviouslyAsked = transcriptMessages.some(
    (m) =>
      m.role === 'assistant' && looksLikeScenarioAContemptProbeQuestion(m.content ?? ''),
  );
  const scenario1Moment1CombinedForResume = aggregateScenario1Moment1UserTextForContemptGate(
    transcriptMessages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
      scenarioNumber: m.scenarioNumber,
      interviewMoment: (m as { interviewMoment?: number }).interviewMoment,
    })),
  );
  const scenarioAContemptProbeSatisfiedByUser =
    scenario1Moment1CombinedForResume.length >= 8 &&
    (hasScenarioAQ1ContemptProbeCoverage(scenario1Moment1CombinedForResume) ||
      evaluateScenarioAQ1ContemptProbePreProbeSkip(scenario1Moment1CombinedForResume).skip);
  deps.scenarioAContemptProbeAskedRef.current = scenarioAContemptProbePreviouslyAsked;
  if (scenarioAContemptProbeSatisfiedByUser && !scenarioAContemptProbePreviouslyAsked) {
    void remoteLog('[S1_CONTEMPT_RESUME_COVERAGE_WITHOUT_PROBE]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: scenario1Moment1CombinedForResume.slice(0, 320),
      s1ContemptFixVersion: S1_CONTEMPT_FIX_VERSION,
    });
  }
  deps.scenarioAContemptProbeTtsDeliveredSessionRef.current = scenarioAContemptProbePreviouslyAsked;
  deps.scenarioAContemptProbePlaybackConfirmedRef.current = scenarioAContemptProbePreviouslyAsked;
  const playbackConfirmedKinds: ShowScenarioCardCanonicalPlaybackConfirmedKinds = {
    ...hydrateShowScenarioCardPlaybackConfirmedFromStorage(saved.scenarioOpeningDeliveredFor),
    ...deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
  };
  deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = playbackConfirmedKinds;
  const scenarioOneFollowUp = scenarioOneFollowUpFlagsFromTranscript(transcriptMessages);
  deps.scenarioARepairQuestionAskedRef.current = scenarioOneFollowUp.repairQuestionAsked;
  deps.s2RepairProbeDeliveredRef.current = transcriptMessages.some(
    (m) =>
      m.role === 'assistant' && looksLikeScenarioBRepairAsJamesQuestion(m.content ?? ''),
  );
  deps.s3RepairProbeDeliveredRef.current = transcriptMessages.some(
    (m) => m.role === 'assistant' && isScenarioCRepairAssistantPrompt(m.content ?? ''),
  );

  return moment5ConflictValidityClarificationIssued;
}
