import { applyPostClaudeScenarioAdvanceOverrides } from '@features/aria/applyPostClaudeScenarioAdvanceOverrides';
import { createPostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import type { PostClaudeAssistantTurnDeps, PostClaudeAssistantTurnParams } from '@features/aria/postClaudeAssistantTurnTypes';
import { runPostClaudeClosingQuestionFailsafeGates } from '@features/aria/runPostClaudeClosingQuestionFailsafeGates';
import { runPostClaudeForcedConstructProbeGates } from '@features/aria/runPostClaudeForcedConstructProbeGates';
import { runPostClaudeInterviewCompletePreM5Gate } from '@features/aria/runPostClaudeInterviewCompletePreM5Gate';
import { runPostClaudeInterviewCompleteTokenGate } from '@features/aria/runPostClaudeInterviewCompleteTokenGate';
import { runPostClaudeNaturalLanguageAssistantTurn } from '@features/aria/runPostClaudeNaturalLanguageAssistantTurn';
import { runPostClaudeParallelStreamBootstrap } from '@features/aria/runPostClaudeParallelStreamBootstrap';
import { runPostClaudeScenarioCompleteTokenGate } from '@features/aria/runPostClaudeScenarioCompleteTokenGate';
import { runPostClaudeStageCompleteTokenGate } from '@features/aria/runPostClaudeStageCompleteTokenGate';
import { sanitizePostClaudeAssistantDraftText } from '@features/aria/sanitizePostClaudeAssistantDraftText';

export async function runPostClaudeAssistantTurn(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
): Promise<void> {
  const preM5CompleteGate = await runPostClaudeInterviewCompletePreM5Gate(
    deps,
    params,
    (params.data.content?.[0]?.text ?? '').trim(),
  );
  let text = preM5CompleteGate.text;
  const rawApiHadInterviewComplete = preM5CompleteGate.rawApiHadInterviewComplete;
  deps.finalizePendingMetaAckBaselineAfterAssistantTextRef.current(text);
  /** LLM done — do not keep "Amoraea is thinking" (or isWaiting-gated UI) until TTS finishes; HTML audio can hang without `onended` on some mobile browsers. */
  deps.setIsWaiting(false);
  const streamBootstrap = runPostClaudeParallelStreamBootstrap(deps, params);
  const parallelStreamingPlaybackUsed = streamBootstrap.parallelStreamingPlaybackUsed;
  const streamFullTrimmed = streamBootstrap.streamFullTrimmed;
  const speakAssistantTurn = createPostClaudeSpeakAssistantTurn(deps, parallelStreamingPlaybackUsed);
  const scenarioAdvance = applyPostClaudeScenarioAdvanceOverrides(
    text,
    params,
    deps,
    params.messagesToUse,
  );
  text = scenarioAdvance.text;
  let strippedText = scenarioAdvance.strippedText;
  const priorAssistantContentS3 = scenarioAdvance.priorAssistantContentS3;
  const draftSanitized = sanitizePostClaudeAssistantDraftText(
    deps,
    params,
    strippedText,
    priorAssistantContentS3,
    parallelStreamingPlaybackUsed,
  );
  strippedText = draftSanitized.strippedText;
  const postSanitizeAdvance = applyPostClaudeScenarioAdvanceOverrides(
    strippedText.trim() || text,
    params,
    deps,
    params.messagesToUse,
  );
  if (
    postSanitizeAdvance.text !== text ||
    postSanitizeAdvance.strippedText !== strippedText
  ) {
    text = postSanitizeAdvance.text;
    strippedText = postSanitizeAdvance.strippedText;
  }
  const shouldInjectScenarioARepairAfterContemptAnswer =
    draftSanitized.shouldInjectScenarioARepairAfterContemptAnswer;
  const recentAsstForAck = draftSanitized.recentAsstForAck;
  const assistantIssuedScenarioAContemptProbe = draftSanitized.assistantIssuedScenarioAContemptProbe;
  const assistantIssuedScenarioBFullProbe = draftSanitized.assistantIssuedScenarioBFullProbe;
  let assistantTurnIsElongatingProbeOnly = draftSanitized.assistantTurnIsElongatingProbeOnly;

  const forcedConstructProbes = await runPostClaudeForcedConstructProbeGates(
    deps,
    params,
    text,
    draftSanitized,
    parallelStreamingPlaybackUsed,
    speakAssistantTurn,
  );
  strippedText = forcedConstructProbes.strippedText;
  const needsScenarioBJamesDifferentlyInsert = forcedConstructProbes.needsScenarioBJamesDifferentlyInsert;
  if (forcedConstructProbes.handled) {
    return;
  }

  const closingFailsafes = await runPostClaudeClosingQuestionFailsafeGates(
    deps,
    params,
    text,
    speakAssistantTurn,
  );
  if (closingFailsafes.handled) {
    return;
  }

  const interviewCompleteGate = await runPostClaudeInterviewCompleteTokenGate(
    deps,
    params,
    text,
    speakAssistantTurn,
  );
  if (interviewCompleteGate.handled) {
    return;
  }

  const scenarioCompleteGate = await runPostClaudeScenarioCompleteTokenGate(
    deps,
    params,
    text,
    speakAssistantTurn,
    parallelStreamingPlaybackUsed,
  );
  if (scenarioCompleteGate.handled) {
    return;
  }

  const stageCompleteGate = await runPostClaudeStageCompleteTokenGate(
    deps,
    params,
    text,
    speakAssistantTurn,
  );
  if (stageCompleteGate.handled) {
    return;
  }

  await runPostClaudeNaturalLanguageAssistantTurn(
    deps,
    params,
    {
      strippedText,
      recentAsstForAck,
      shouldInjectScenarioARepairAfterContemptAnswer,
      assistantIssuedScenarioAContemptProbe,
      assistantIssuedScenarioBFullProbe,
      needsScenarioBJamesDifferentlyInsert,
      assistantTurnIsElongatingProbeOnly,
      parallelStreamingPlaybackUsed,
      streamFullTrimmed,
      rawApiHadInterviewComplete,
    },
    text,
    speakAssistantTurn,
  );
}
