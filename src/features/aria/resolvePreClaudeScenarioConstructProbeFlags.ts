import { isDecline } from '@features/aria/interviewControlTokens';
import { looksLikeUnassessableScenarioAnswer } from '@features/aria/interviewAnswerRelevance';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  aggregateScenario1Moment1UserTextForContemptGate,
  debugScenarioAQ1ContemptProbeCoverageDetail,
  evaluateScenarioAQ1ContemptProbePreProbeSkip,
  hasScenarioAQ1ContemptProbeCoverage,
  hasScenarioBQ1OnTopicEngagement,
  isReplyingToScenarioAQ1AfterDelivery,
  looksLikeScenarioAContemptProbeQuestion,
  userSidesEntirelyWithJames,
} from '@features/aria/probeAndScoringUtils';
import {
  looksLikeScenarioARepairQuestion,
  shouldAllowScenarioARepairAfterContemptAnswer,
  transcriptContainsScenarioCSophiePerspectiveProbe,
} from '@features/aria/interviewDisengagementProbes';
import {
  scenarioOneFollowUpFlagsFromTranscript,
  transcriptContainsScenarioCRepairQuestion,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  isScenarioCQ1Prompt,
  looksLikeScenarioCSophiePerspectiveAssessableShortAnswer,
  looksLikeScenarioCSophiePerspectiveQuestion,
  shouldForceScenarioCRepairProbe as evaluateScenarioCRepairProbeEligibility,
  shouldForceScenarioCSophiePerspectiveProbe as evaluateScenarioCSophiePerspectiveProbeEligibility,
} from '@features/aria/scenarioCPromptDetection';
import { looksLikeScenarioAContemptProbeAssessableShortAnswer } from '@features/aria/scenarioAContemptProbeCoverage';
import {
  looksLikeScenarioBRepairAsJamesQuestion,
  shouldForceScenarioBJamesRepairProbe as evaluateScenarioBJamesRepairProbeEligibility,
  isScenarioBQ1Prompt,
  looksLikeScenarioBQ1Question,
} from '@features/aria/scenarioBProbeLogic';
import { remoteLog } from '@utilities/remoteLog';
import { shouldMuteParallelTtsForS3ToM4HandoffStream } from '@features/aria/s3ToM4HandoffStreamMute';

export type PreClaudeScenarioConstructProbeFlags = {
  replyingToScenarioAQ1: boolean;
  replyingToScenarioBQ1: boolean;
  replyingToScenarioCQ1: boolean;
  scenarioAContemptGateUserText: string;
  shouldForceScenarioAContemptProbe: boolean;
  shouldForceScenarioBFullAppreciationProbe: boolean;
  shouldForceScenarioBJamesRepairProbe: boolean;
  shouldForceScenarioCRepairProbe: boolean;
  shouldForceScenarioCSophiePerspectiveProbe: boolean;
  specificEmmaLineAlreadyAddressed: boolean;
  sidedEntirelyWithJames: boolean;
  scenarioBQ1Engaged: boolean;
  muteParallelTtsForScenarioAContemptProbeStream: boolean;
  muteParallelTtsForS3ToM4HandoffStream: boolean;
  allowScenarioARepairAfterContemptAnswer: boolean;
};

/**
 * Scenario A contempt and Scenario B appreciation construct-probe flags for the Claude API params tail.
 */
export function resolvePreClaudeScenarioConstructProbeFlags(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  lastAssistantContent: string,
  lastInterviewerContent: string,
  suppressForcedConstructProbesForMetaFrustration: boolean,
): PreClaudeScenarioConstructProbeFlags {
  const replyingToScenarioAQ1 = isReplyingToScenarioAQ1AfterDelivery({
    currentMoment: deps.currentInterviewMomentRef.current,
    contemptProbeAlreadyAsked: deps.scenarioAContemptProbeAskedRef.current,
    lastAssistantWasContemptProbe: looksLikeScenarioAContemptProbeQuestion(lastAssistantContent),
    lastAssistantWasRepair: looksLikeScenarioARepairQuestion(lastAssistantContent),
    assistantTexts: [lastAssistantContent, lastInterviewerContent, deps.lastQuestionTextRef.current],
    userAnswerText: trimmed,
  });
  const replyingToScenarioBQ1 =
    deps.currentInterviewMomentRef.current === 2 &&
    (isScenarioBQ1Prompt(lastAssistantContent) || looksLikeScenarioBQ1Question(lastAssistantContent));
  const replyingToScenarioCQ1 =
    deps.currentInterviewMomentRef.current === 3 &&
    deps.currentScenarioRef.current === 3 &&
    isScenarioCQ1Prompt(lastAssistantContent);

  if (transcriptContainsScenarioCSophiePerspectiveProbe(messagesToUse)) {
    deps.scenarioCSophiePerspectiveProbeFiredRef.current = true;
  }

  const scenarioAContemptGateUserText =
    deps.currentInterviewMomentRef.current === 1
      ? (() => {
          const agg = aggregateScenario1Moment1UserTextForContemptGate(messagesToUse);
          return agg.length >= 8 ? agg : trimmed;
        })()
      : trimmed;
  const legacyScenarioAQ1ContemptCoverage = hasScenarioAQ1ContemptProbeCoverage(scenarioAContemptGateUserText);
  const scenarioAQ1PreProbeSkip = evaluateScenarioAQ1ContemptProbePreProbeSkip(scenarioAContemptGateUserText);
  const scenarioOneFollowUpFromTranscript = scenarioOneFollowUpFlagsFromTranscript(messagesToUse);
  if (scenarioOneFollowUpFromTranscript.contemptProbeAsked) {
    deps.scenarioAContemptProbeAskedRef.current = true;
  }
  if (scenarioOneFollowUpFromTranscript.repairQuestionAsked) {
    deps.scenarioARepairQuestionAskedRef.current = true;
  }
  if (transcriptContainsScenarioCRepairQuestion(messagesToUse)) {
    deps.s3RepairProbeDeliveredRef.current = true;
  }
  if (
    messagesToUse.some(
      (m) => m.role === 'assistant' && looksLikeScenarioBRepairAsJamesQuestion(m.content ?? ''),
    )
  ) {
    deps.s2RepairProbeDeliveredRef.current = true;
  }
  const scenarioAContemptProbeCoverage = legacyScenarioAQ1ContemptCoverage || scenarioAQ1PreProbeSkip.skip;
  const specificEmmaLineAlreadyAddressed = scenarioAContemptProbeCoverage;
  // Character names (e.g. "Ryan") can look "engaged" while the utterance is still a cut-off
  // ("If I were Ryan, I would") — never force construct advance without scorable material.
  const questionToAssess =
    (deps.lastQuestionTextRef.current ?? '').trim() || lastAssistantContent.trim();
  const sophiePerspectiveQuestion =
    looksLikeScenarioCSophiePerspectiveQuestion(questionToAssess) ||
    looksLikeScenarioCSophiePerspectiveQuestion(lastAssistantContent);
  const contemptProbeQuestion =
    looksLikeScenarioAContemptProbeQuestion(questionToAssess) ||
    looksLikeScenarioAContemptProbeQuestion(lastAssistantContent);
  const unassessableAnswer =
    looksLikeUnassessableScenarioAnswer(trimmed) &&
    !(
      (contemptProbeQuestion && looksLikeScenarioAContemptProbeAssessableShortAnswer(trimmed)) ||
      (sophiePerspectiveQuestion && looksLikeScenarioCSophiePerspectiveAssessableShortAnswer(trimmed))
    );
  const shouldForceScenarioAContemptProbe =
    !unassessableAnswer &&
    !suppressForcedConstructProbesForMetaFrustration &&
    replyingToScenarioAQ1 &&
    !isDecline(trimmed) &&
    !scenarioAContemptProbeCoverage &&
    !deps.scenarioAContemptProbeAskedRef.current;
  // Mute only when we still need the contempt probe — not when Q1 already covered Emma's line
  // (otherwise client-owned delivery treated mute as a force and re-asked the probe).
  const muteParallelTtsForScenarioAContemptProbeStream =
    !unassessableAnswer &&
    deps.currentInterviewMomentRef.current === 1 &&
    !deps.scenarioAContemptProbeAskedRef.current &&
    !scenarioAContemptProbeCoverage &&
    (replyingToScenarioAQ1 || shouldForceScenarioAContemptProbe) &&
    !isDecline(trimmed);
  if (muteParallelTtsForScenarioAContemptProbeStream) {
    deps.pendingScenarioAContemptProbeStreamMuteRef.current = true;
  }
  const shouldForceScenarioCSophiePerspectiveProbe =
    evaluateScenarioCSophiePerspectiveProbeEligibility({
      currentMoment: deps.currentInterviewMomentRef.current,
      currentScenario: deps.currentScenarioRef.current,
      messages: messagesToUse,
      lastAssistantContent,
      lastQuestionText: deps.lastQuestionTextRef.current,
      userAnswer: trimmed,
      suppressForcedConstructProbesForMetaFrustration,
      sophieProbeDelivered: deps.scenarioCSophiePerspectiveProbeFiredRef?.current ?? false,
    });
  const shouldForceScenarioCRepairProbe = evaluateScenarioCRepairProbeEligibility({
    currentMoment: deps.currentInterviewMomentRef.current,
    currentScenario: deps.currentScenarioRef.current,
    messages: messagesToUse,
    lastAssistantContent,
    lastQuestionText: deps.lastQuestionTextRef.current,
    userAnswer: trimmed,
    suppressForcedConstructProbesForMetaFrustration,
    repairProbeDelivered: deps.s3RepairProbeDeliveredRef?.current ?? false,
  });
  const muteParallelTtsForS3ToM4HandoffStream =
    !unassessableAnswer &&
    shouldMuteParallelTtsForS3ToM4HandoffStream({
      currentMoment: deps.currentInterviewMomentRef.current,
      currentScenario: deps.currentScenarioRef.current,
      lastAssistantContent,
      messagesToUse,
      shouldForceScenarioCRepairProbe,
    });
  if (muteParallelTtsForS3ToM4HandoffStream) {
    deps.pendingS3ToM4HandoffStreamMuteRef.current = true;
    void remoteLog('[S3_TO_M4_HANDOFF_STREAM_MUTE_ARMED_PRE_CLAUDE]', {
      interviewSessionId: deps.interviewSessionIdRef?.current,
    });
  }
  if (scenarioAContemptProbeCoverage && !deps.scenarioAContemptProbeAskedRef.current) {
    deps.scenarioAContemptProbeAskedRef.current = true;
    void remoteLog('[S1_CONTEMPT_SATISFIED_BY_USER]', {
      coverageDetail: debugScenarioAQ1ContemptProbeCoverageDetail(scenarioAContemptGateUserText),
      userPreview: trimmed.slice(0, 320),
      contempt_probe_skipped: true,
      contempt_probe_skip_reason:
        scenarioAQ1PreProbeSkip.reason ??
        (legacyScenarioAQ1ContemptCoverage ? 'legacy_contempt_quality_coverage' : null),
      pre_probe_skip: scenarioAQ1PreProbeSkip.skip,
      legacy_contempt_quality_coverage: legacyScenarioAQ1ContemptCoverage,
    });
  }
  const sidedEntirelyWithJames = userSidesEntirelyWithJames(trimmed);
  const scenarioBQ1Engaged = hasScenarioBQ1OnTopicEngagement(trimmed);
  const shouldForceScenarioBFullAppreciationProbe =
    !unassessableAnswer &&
    !suppressForcedConstructProbesForMetaFrustration &&
    replyingToScenarioBQ1 &&
    !isDecline(trimmed) &&
    !sidedEntirelyWithJames &&
    !scenarioBQ1Engaged;
  const shouldForceScenarioBJamesRepairProbe =
    !unassessableAnswer &&
    evaluateScenarioBJamesRepairProbeEligibility({
      currentMoment: deps.currentInterviewMomentRef.current,
      messages: messagesToUse,
      lastAssistantContent,
      userAnswer: trimmed,
      suppressForcedConstructProbesForMetaFrustration,
    });
  const allowScenarioARepairAfterContemptAnswer =
    !unassessableAnswer &&
    shouldAllowScenarioARepairAfterContemptAnswer({
      currentScenario: deps.currentScenarioRef.current,
      currentMoment: deps.currentInterviewMomentRef.current,
      scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
      scenarioARepairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
      replyingToScenarioAQ1,
      specificEmmaLineAlreadyAddressed,
      shouldForceScenarioAContemptProbe,
      messagesToUse,
      lastDeliveredQuestionText: deps.lastQuestionTextRef.current,
      userAnswer: trimmed,
    });

  return {
    replyingToScenarioAQ1,
    replyingToScenarioBQ1,
    replyingToScenarioCQ1,
    scenarioAContemptGateUserText,
    shouldForceScenarioAContemptProbe,
    shouldForceScenarioBFullAppreciationProbe,
    shouldForceScenarioBJamesRepairProbe,
    shouldForceScenarioCRepairProbe: !unassessableAnswer && shouldForceScenarioCRepairProbe,
    shouldForceScenarioCSophiePerspectiveProbe:
      !unassessableAnswer && shouldForceScenarioCSophiePerspectiveProbe,
    specificEmmaLineAlreadyAddressed,
    sidedEntirelyWithJames,
    scenarioBQ1Engaged,
    muteParallelTtsForScenarioAContemptProbeStream,
    muteParallelTtsForS3ToM4HandoffStream,
    allowScenarioARepairAfterContemptAnswer,
  };
}
