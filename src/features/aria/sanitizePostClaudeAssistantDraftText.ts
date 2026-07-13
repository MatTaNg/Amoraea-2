import { applyPostClaudeAssistantDraftElongatingState } from '@features/aria/applyPostClaudeAssistantDraftElongatingState';
import { finalizePostClaudeAssistantDraftProbeSequence } from '@features/aria/finalizePostClaudeAssistantDraftProbeSequence';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { stripPostClaudeAssistantDraftText } from '@features/aria/stripPostClaudeAssistantDraftText';
import {
  recentPostClaudeAssistantMessagesForAck,
  syncPostClaudeAssistantProbeAskedRefs,
} from '@features/aria/syncPostClaudeAssistantProbeAskedRefs';

export type SanitizePostClaudeAssistantDraftResult = {
  strippedText: string;
  shouldInjectScenarioARepairAfterContemptAnswer: boolean;
  scenarioHandoffAssistantTurn: boolean;
  recentAsstForAck: MessageWithScenario[];
  assistantIssuedMoment4ThresholdProbe: boolean;
  assistantIssuedMoment4AnyQuestion: boolean;
  assistantIssuedScenarioAContemptProbe: boolean;
  assistantIssuedScenarioARepairQuestion: boolean;
  assistantIssuedScenarioBFullProbe: boolean;
  assistantIssuedScenarioBJamesDifferently: boolean;
  assistantIssuedScenarioBRepairAsJames: boolean;
  assistantTurnIsElongatingProbeOnly: boolean;
};

/** Orchestrates reflection strips, probe detection, and elongating-probe state for post-Claude drafts. */
export function sanitizePostClaudeAssistantDraftText(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  initialStrippedText: string,
  priorAssistantContentS3: string,
  parallelStreamingPlaybackUsed: boolean,
): SanitizePostClaudeAssistantDraftResult {
  const stripResult = stripPostClaudeAssistantDraftText(deps, params, initialStrippedText);
  const probeResult = finalizePostClaudeAssistantDraftProbeSequence(
    deps,
    params,
    stripResult.strippedText,
    priorAssistantContentS3,
  );
  const elongatingResult = applyPostClaudeAssistantDraftElongatingState(
    deps,
    params,
    probeResult.strippedText,
    parallelStreamingPlaybackUsed,
  );
  syncPostClaudeAssistantProbeAskedRefs(deps, probeResult);

  return {
    strippedText: elongatingResult.strippedText,
    shouldInjectScenarioARepairAfterContemptAnswer: stripResult.shouldInjectScenarioARepairAfterContemptAnswer,
    scenarioHandoffAssistantTurn: stripResult.scenarioHandoffAssistantTurn,
    recentAsstForAck: recentPostClaudeAssistantMessagesForAck(params.messagesToUse),
    assistantIssuedMoment4ThresholdProbe: probeResult.assistantIssuedMoment4ThresholdProbe,
    assistantIssuedMoment4AnyQuestion: probeResult.assistantIssuedMoment4AnyQuestion,
    assistantIssuedScenarioAContemptProbe: probeResult.assistantIssuedScenarioAContemptProbe,
    assistantIssuedScenarioARepairQuestion: probeResult.assistantIssuedScenarioARepairQuestion,
    assistantIssuedScenarioBFullProbe: probeResult.assistantIssuedScenarioBFullProbe,
    assistantIssuedScenarioBJamesDifferently: probeResult.assistantIssuedScenarioBJamesDifferently,
    assistantIssuedScenarioBRepairAsJames: probeResult.assistantIssuedScenarioBRepairAsJames,
    assistantTurnIsElongatingProbeOnly: elongatingResult.assistantTurnIsElongatingProbeOnly,
  };
}
