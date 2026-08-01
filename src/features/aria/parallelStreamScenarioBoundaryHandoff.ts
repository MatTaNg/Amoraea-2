import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { splitScenarioTransitionForEmotionModal, hasScenarioBoundaryWrapPhrase } from '@features/aria/emotionModalTransitionOrchestration';
import { textContainsScenarioBVignetteBody } from '@features/aria/emotionScenarioTransitionInference';
import { textContainsScenarioCVignetteBody } from '@features/aria/scenarioVignetteBodyDetection';
import { looksLikeInterviewClosingAssistantMessage } from '@features/aria/elongatingProbe';
import { applyPostClaudeScenarioAdvanceBundleOverride } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import { enrichScenarioBoundaryHandoffBundleWithDynamicLead } from '@features/aria/resolveScenarioBoundaryLeadForInterview';
import { SHOW_SCENARIO_CARD_CANONICAL_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import {
  mergeShowScenarioCardTransitionPrefixWithSpoken,
} from '@features/aria/showScenarioCardCanonicalTts';
import { remoteLog } from '@utilities/remoteLog';

import type { ParallelStreamTtsPlaybackContext } from './parallelStreamTtsRuntimeState';
import { scenarioCRepairConstructStillPending } from '@features/aria/scenarioCPromptDetection';
import {
  isActiveScenarioAConstructProbeTurn,
  scenarioAMinimumEngagementForHandoff,
} from '@features/aria/scenarioFollowUpTranscriptGuard';

function boundaryTransitionAlreadySpoken(spokenSoFar: string, beforeModal: string): boolean {
  const spoken = spokenSoFar.toLowerCase();
  if (/\bnext situation\b/.test(spoken) && /\bnext situation\b/i.test(beforeModal)) return true;
  if (/\bthird situation\b/.test(spoken) && /\bthird situation\b/i.test(beforeModal)) return true;
  if (/\btwo questions left\b/.test(spoken) && /\btwo questions left\b/i.test(beforeModal)) return true;
  if (/\bthat scenario is complete\b/.test(spoken) && /\bthat scenario is complete\b/i.test(beforeModal)) {
    return true;
  }
  return false;
}

/**
 * When stream-end boundary lead already spoke the wrap, only the next vignette segment remains.
 */
export function resolveStreamEndHandoffSpeechAfterPartialBoundaryLead(
  handoffText: string,
  spokenSoFar: string,
  completedScenario: 1 | 2,
): string | null {
  const handoff = stripControlTokens(handoffText).trim();
  const spoken = stripControlTokens(spokenSoFar).trim();
  if (!handoff) return null;
  if (completedScenario === 1) {
    if (textContainsScenarioBVignetteBody(spoken)) return null;
  } else if (textContainsScenarioCVignetteBody(spoken)) {
    return null;
  }
  if (!hasScenarioBoundaryWrapPhrase(spoken)) {
    return handoff;
  }
  const { afterModal } = splitScenarioTransitionForEmotionModal(handoff);
  if (afterModal.trim()) {
    return afterModal.trim();
  }
  return handoff;
}

/** Scenario boundary leads only apply during moments 1–3; skip during M5 close buffering. */
export function shouldSpeakMissedScenarioBoundaryLeadAtStreamEnd(args: {
  interviewMoment: number;
  bufferAllStreamTtsForMoment5Close: boolean;
  moment5StickyCloseBufferAll: boolean;
  moment5ClosingStreamBuffer: string;
  streamFull: string;
}): boolean {
  if (args.interviewMoment > 3) return false;
  if (args.bufferAllStreamTtsForMoment5Close || args.moment5StickyCloseBufferAll) return false;
  if (args.moment5ClosingStreamBuffer.trim()) return false;
  const streamFull = stripControlTokens(args.streamFull).trim();
  if (looksLikeInterviewClosingAssistantMessage(streamFull)) return false;
  if (/\[INTERVIEW_COMPLETE\]/i.test(args.streamFull)) return false;
  return true;
}

/**
 * When stream suppression skipped the boundary lead but canonical card did not deliver it,
 * speak ack + reflection + transition before post-Claude emotion-modal orchestration.
 */
export async function speakMissedScenarioBoundaryLeadAtStreamEnd(
  ctx: ParallelStreamTtsPlaybackContext,
): Promise<void> {
  const { deps, params, state } = ctx;
  if (!shouldSpeakMissedScenarioBoundaryLeadAtStreamEnd({
    interviewMoment: deps.currentInterviewMomentRef.current ?? 1,
    bufferAllStreamTtsForMoment5Close: params.bufferAllStreamTtsForMoment5Close,
    moment5StickyCloseBufferAll: state.moment5StickyCloseBufferAll,
    moment5ClosingStreamBuffer: state.moment5ClosingStreamBuffer,
    streamFull: params.textToParallelStream.full,
  })) {
    return;
  }
  if (state.s1RepairSatisfiedHandoffSpokenThisStream) return;
  if (
    deps.currentInterviewMomentRef.current === 3 &&
    (deps.currentScenarioRef.current ?? 1) === 3 &&
    scenarioCRepairConstructStillPending(params.messagesToUse)
  ) {
    return;
  }
  if (
    isActiveScenarioAConstructProbeTurn(
      deps.currentScenarioRef.current,
      deps.currentInterviewMomentRef.current,
    ) &&
    !scenarioAMinimumEngagementForHandoff(params.messagesToUse)
  ) {
    return;
  }
  if (state.scenarioAContemptProbeSpokenThisStream && !state.s1RepairSatisfiedHandoffSpokenThisStream) {
    return;
  }

  const advanceBundle = applyPostClaudeScenarioAdvanceBundleOverride(
    stripControlTokens(params.textToParallelStream.full),
    params.participantFirstNameForSpoken,
    params.messagesToUse,
    deps.currentInterviewMomentRef.current,
    deps.currentScenarioRef.current,
  );
  if (!advanceBundle) return;

  const enrichedBundle = await enrichScenarioBoundaryHandoffBundleWithDynamicLead({
    bundleText: advanceBundle,
    firstName: params.participantFirstNameForSpoken,
    messages: params.messagesToUse,
    interviewSessionId: deps.interviewSessionIdRef.current,
  });

  const bundleText = stripControlTokens(
    enrichedBundle.replace(/\[SCENARIO_COMPLETE:\s*\d+\]/gi, ''),
  ).trim();
  if (!bundleText) return;

  const { beforeModal } = splitScenarioTransitionForEmotionModal(bundleText);
  if (!beforeModal.trim()) return;

  const spokenSoFar = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
  if (boundaryTransitionAlreadySpoken(spokenSoFar, beforeModal)) return;

  const toSpeak = mergeShowScenarioCardTransitionPrefixWithSpoken(beforeModal, spokenSoFar);
  if (!toSpeak.trim()) return;

  void remoteLog('[SCENARIO_BOUNDARY_LEAD_STREAM_END_SPEAK]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    preview: toSpeak.slice(0, 280),
    streamSpokePreview: spokenSoFar.slice(0, 120),
  });
  await deps.speakTextSafe(toSpeak, SHOW_SCENARIO_CARD_CANONICAL_SPEECH);
  deps.parallelStreamingTtsRef.current.spokenCompleteText = spokenSoFar
    ? `${spokenSoFar} ${toSpeak}`.trim()
    : toSpeak;
  params.textToParallelStream.spokenStarted = true;
  deps.recordInterviewAssistantDeliveryForMetaExemptionRef.current(toSpeak);
}
