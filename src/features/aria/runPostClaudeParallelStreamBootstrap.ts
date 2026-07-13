import { transcriptHasScenario1VignetteAssistant } from '@features/aria/interviewPreambleBriefing';
import {
  isApprovedElongatingProbeOnly,
} from '@features/aria/elongatingProbe';
import {
  isInterviewPreambleBriefingMoment,
} from '@features/aria/interviewLanguageGate';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  coerceScenarioAContemptProbeToDeliveredCopy,
  looksLikeScenarioAContemptProbeQuestion,
} from '@features/aria/probeAndScoringUtils';
import {
  shouldDeliverScenarioFollowUpQuestion,
  transcriptContainsScenarioAContemptProbe,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import { remoteLog } from '@utilities/remoteLog';

export type PostClaudeParallelStreamBootstrapResult = {
  parallelStreamingPlaybackUsed: boolean;
  messagesToUse: PostClaudeInterviewMessage[];
  streamFullTrimmed: string;
};

/** Preamble briefing persist, elongating stream discard, and S1 contempt probe transcript recovery. */
export function runPostClaudeParallelStreamBootstrap(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
): PostClaudeParallelStreamBootstrapResult {
  const streamFullTrimmed = stripControlTokens(params.textToParallelStream.full).trim();
  if (
    deps.interviewNameRef.current &&
    deps.currentInterviewMomentRef.current === 1 &&
    !transcriptHasScenario1VignetteAssistant(params.messagesToUse) &&
    isInterviewPreambleBriefingMoment(streamFullTrimmed)
  ) {
    deps.commitInterviewMessages((prev) =>
      deps.insertPreambleBriefingIfMissing(prev as PostClaudeInterviewMessage[], streamFullTrimmed),
    );
  }
  if (isApprovedElongatingProbeOnly(streamFullTrimmed) && params.elongatingSuppressedForUserTurn) {
    void remoteLog('[ELONGATING_PROBE_STREAM_DISCARDED]', {
      preview: streamFullTrimmed,
      suppressForUserTurn: true,
    });
    params.textToParallelStream.full = '';
    params.textToParallelStream.spokenStarted = false;
    deps.parallelStreamingTtsRef.current.cancelRequested = true;
  }

  let messagesToUse = params.messagesToUse;
  if (
    deps.currentInterviewMomentRef.current === 1 &&
    deps.scenarioAContemptProbeAskedRef.current &&
    !params.specificEmmaLineAlreadyAddressed &&
    !transcriptContainsScenarioAContemptProbe(messagesToUse)
  ) {
    const streamSpoken = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
    const probePersistText = coerceScenarioAContemptProbeToDeliveredCopy(
      looksLikeScenarioAContemptProbeQuestion(streamSpoken) ? streamSpoken : SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    );
    if (shouldDeliverScenarioFollowUpQuestion(messagesToUse, probePersistText)) {
      const probeMsg: PostClaudeInterviewMessage = {
        role: 'assistant',
        content: probePersistText,
        scenarioNumber: 1,
      };
      messagesToUse = [...messagesToUse, probeMsg];
      params.messagesToUse = messagesToUse;
      void remoteLog('[S1_CONTEMPT_PROBE_STAGED_FOR_PERSIST]', {
        preview: probePersistText.slice(0, 200),
        s1ContemptFixVersion: 11,
      });
    }
  }

  return {
    parallelStreamingPlaybackUsed: params.textToParallelStream.spokenStarted,
    messagesToUse,
    streamFullTrimmed,
  };
}
