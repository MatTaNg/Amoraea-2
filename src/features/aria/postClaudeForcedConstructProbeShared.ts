import { buildPostClaudeProgressRefsPayload } from '@features/aria/buildPostClaudeProgressRefsPayload';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import { isDecline } from '@features/aria/interviewControlTokens';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import {
  extractLeadingBriefScenarioAck,
} from '@features/aria/interviewReflectionAckVariation';
import { isShortAckOnlySentence } from '@features/aria/interviewerFrameworkPrompt';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { looksLikeAssistantSkipsScenarioBJamesIntermediateQuestion } from '@features/aria/probeAndScoringUtils';
import type { SanitizePostClaudeAssistantDraftResult } from '@features/aria/sanitizePostClaudeAssistantDraftText';
import { detectScenarioFromResponse } from '@features/aria/scenarioNumberDetection';
import {
  classifyScriptedFollowUpKind,
  commitDedupedAssistantTranscriptTurn,
  shouldSkipRedundantAssistantPersist,
} from '@features/aria/interviewTranscriptDedup';

export type PostClaudeForcedConstructProbeGatesResult = {
  handled: boolean;
  strippedText: string;
  scenarioBSkippedJamesIntermediate: boolean;
  needsScenarioBJamesDifferentlyInsert: boolean;
};

export type ForcedConstructProbeContext = SanitizePostClaudeAssistantDraftResult & {
  strippedText: string;
};

export function evaluatePostClaudeScenarioBJamesDifferentlyProbeState(
  params: PostClaudeAssistantTurnParams,
  draft: ForcedConstructProbeContext,
  text: string,
  strippedText: string,
): Pick<
  PostClaudeForcedConstructProbeGatesResult,
  'scenarioBSkippedJamesIntermediate' | 'needsScenarioBJamesDifferentlyInsert'
> {
  const scenarioBSkippedJamesIntermediate =
    draft.assistantIssuedScenarioBRepairAsJames ||
    looksLikeAssistantSkipsScenarioBJamesIntermediateQuestion(strippedText);
  const needsScenarioBJamesDifferentlyInsert =
    !params.suppressForcedConstructProbesForMetaFrustration &&
    params.replyingToScenarioBQ1 &&
    !isDecline(params.trimmed) &&
    !params.shouldForceScenarioBFullAppreciationProbe &&
    scenarioBSkippedJamesIntermediate &&
    !draft.assistantIssuedScenarioBJamesDifferently &&
    !draft.assistantTurnIsElongatingProbeOnly &&
    !text.includes('[INTERVIEW_COMPLETE]');

  return { scenarioBSkippedJamesIntermediate, needsScenarioBJamesDifferentlyInsert };
}

/** Model stripped draft is only a brief acknowledgment — fold into the forced probe, do not speak separately. */
export function forcedConstructProbeStrippedTextIsBriefAckOnly(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (isShortAckOnlySentence(t)) return true;
  const ack = extractLeadingBriefScenarioAck(t);
  if (!ack) return false;
  const rest = t.slice(ack.length).trim().replace(/^[.!?…]+\s*/, '');
  return rest.length === 0;
}

export async function stageAndSpeakForcedConstructProbeLeadIn(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  strippedText: string,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
): Promise<PostClaudeInterviewMessage[]> {
  if (!strippedText) {
    return params.messagesToUse;
  }
  const detectedScenario = detectScenarioFromResponse(strippedText);
  if (detectedScenario !== null) {
    deps.currentScenarioRef.current = detectedScenario;
    void deps.notifyScenarioStarted(detectedScenario);
  }
  const scenarioNum = deps.resolveAssistantScenarioNumber(strippedText, params.messagesToUse);
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : params.messagesToUse) as PostClaudeInterviewMessage[];
  if (
    classifyScriptedFollowUpKind(strippedText) ||
    shouldSkipRedundantAssistantPersist(liveTranscript, strippedText)
  ) {
    return params.messagesToUse;
  }
  const stagedMessages = commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    params.messagesToUse,
    strippedText,
    { scenarioNumber: scenarioNum },
    (next) => deps.setMessages(next),
  );
  deps.applyInterviewProgressFromAssistantText(
    strippedText,
    buildPostClaudeProgressRefsPayload(deps),
  );
  await speakAssistantTurn(strippedText, ASSISTANT_INTERVIEW_SPEECH);
  return stagedMessages;
}

export function finishPostClaudeForcedConstructProbeGate(
  deps: PostClaudeAssistantTurnDeps,
  result: Omit<PostClaudeForcedConstructProbeGatesResult, 'handled'> & { handled?: true },
): PostClaudeForcedConstructProbeGatesResult {
  deps.setVoiceState('idle');
  return { handled: true, ...result };
}
