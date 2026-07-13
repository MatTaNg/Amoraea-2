import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import { evaluatePostClaudeNaturalLanguageClosingHandoff } from '@features/aria/evaluatePostClaudeNaturalLanguageClosingHandoff';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { persistPostClaudeNaturalLanguageTranscriptTurn } from '@features/aria/persistPostClaudeNaturalLanguageTranscriptTurn';
import { runPostClaudeEmptyTranscriptFallbackGates } from '@features/aria/runPostClaudeEmptyTranscriptFallbackGates';
import { runPostClaudeNaturalLanguageSpeakAndComplete } from '@features/aria/runPostClaudeNaturalLanguageSpeakAndComplete';
import { extractMoment5AnswerForClosingReflection } from '@features/aria/moment5TranscriptHelpers';
import { enrichPersonalMomentClosingForTts } from '@features/aria/personalMomentClosingEnrichment';
import { deriveClosingPillarContextFromScenarioScores } from '@features/aria/closingReflectionGrounding';
import type { SanitizePostClaudeAssistantDraftResult } from '@features/aria/sanitizePostClaudeAssistantDraftText';
import {
  applyPostClaudeClosingQuestionTokenFromRawText,
  resolvePostClaudeNaturalLanguageDisplayText,
} from '@features/aria/resolvePostClaudeNaturalLanguageDisplayText';

export type PostClaudeNaturalLanguageTurnContext = Pick<
  SanitizePostClaudeAssistantDraftResult,
  'recentAsstForAck' | 'shouldInjectScenarioARepairAfterContemptAnswer'
> & {
  strippedText: string;
  assistantIssuedScenarioAContemptProbe: boolean;
  assistantIssuedScenarioBFullProbe: boolean;
  needsScenarioBJamesDifferentlyInsert: boolean;
  assistantTurnIsElongatingProbeOnly: boolean;
  parallelStreamingPlaybackUsed: boolean;
  streamFullTrimmed: string;
  rawApiHadInterviewComplete: boolean;
};

/** Default assistant turn: display prep, transcript persist, emotion-modal natural handoff, M5 close failsafe. */
export async function runPostClaudeNaturalLanguageAssistantTurn(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  ctx: PostClaudeNaturalLanguageTurnContext,
  text: string,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
): Promise<void> {
  applyPostClaudeClosingQuestionTokenFromRawText(deps, text);

  let displayText = resolvePostClaudeNaturalLanguageDisplayText(deps, params, ctx);
  if (deps.currentInterviewMomentRef.current === 5) {
    displayText = enrichPersonalMomentClosingForTts(
      displayText,
      params.participantFirstNameForSpoken,
      extractMoment5AnswerForClosingReflection(params.messagesToUse),
      deriveClosingPillarContextFromScenarioScores(deps.scenarioScoresRef.current),
    );
  }

  const emptyTranscriptFallback = await runPostClaudeEmptyTranscriptFallbackGates(
    deps,
    params,
    {
      assistantTurnIsElongatingProbeOnly: ctx.assistantTurnIsElongatingProbeOnly,
      shouldInjectScenarioARepairAfterContemptAnswer: ctx.shouldInjectScenarioARepairAfterContemptAnswer,
      assistantIssuedScenarioAContemptProbe: ctx.assistantIssuedScenarioAContemptProbe,
      assistantIssuedScenarioBFullProbe: ctx.assistantIssuedScenarioBFullProbe,
      needsScenarioBJamesDifferentlyInsert: ctx.needsScenarioBJamesDifferentlyInsert,
      parallelStreamingPlaybackUsed: ctx.parallelStreamingPlaybackUsed,
      streamFullTrimmed: ctx.streamFullTrimmed,
    },
    text,
    displayText,
    speakAssistantTurn,
  );
  if (emptyTranscriptFallback.handled) {
    return;
  }
  let nextText = emptyTranscriptFallback.text;
  displayText = emptyTranscriptFallback.displayText;

  const transcript = persistPostClaudeNaturalLanguageTranscriptTurn(deps, params, displayText, nextText);
  const {
    priorScenarioNum,
    updatedMessages,
    detectedScenario,
    emotionSplit,
    deferEmotionModal,
    emotionCompletedScenario,
    emotionNaturalForward,
    emotionNaturalS3ToM4,
    scenarioHandoffTransition,
  } = transcript;

  const closingHandoff = evaluatePostClaudeNaturalLanguageClosingHandoff(
    deps,
    params,
    {
      strippedText: ctx.strippedText,
      parallelStreamingPlaybackUsed: ctx.parallelStreamingPlaybackUsed,
      rawApiHadInterviewComplete: ctx.rawApiHadInterviewComplete,
    },
    displayText,
    updatedMessages,
    {
      priorScenarioNum,
      detectedScenario,
      emotionNaturalForward,
      emotionCompletedScenario,
      scenarioHandoffTransition,
      emotionNaturalS3ToM4,
      deferEmotionModal,
      deferBlocked: transcript.deferBlocked,
      hasAfterModal: emotionSplit.afterModal.trim().length > 0,
    },
  );

  await runPostClaudeNaturalLanguageSpeakAndComplete({
    deps,
    params,
    parallelStreamingPlaybackUsed: ctx.parallelStreamingPlaybackUsed,
    displayText,
    transcript,
    closingHandoff,
    speakAssistantTurn,
  });
}
