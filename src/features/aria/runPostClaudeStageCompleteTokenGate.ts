import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import {
  collapseStackedEmpathyIHearYouInFirstParagraph,
  ensureAcknowledgmentBeforeMove,
  recentAssistantMessagesForAck,
  stripFlatReflectionAcknowledgmentOpeners,
  stripForbiddenReflectionLead,
  stripGenericReflectionFillersFirstParagraph,
  stripHollowSystemInterviewerPhrases,
} from '@features/aria/interviewAssistantReflection';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { dedupeAdjacentBoundaryValidationsBeforeParticipantName } from '@features/aria/interviewerFrameworkPrompt';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { FALLBACK_MARKER_SCORES_MID } from '@features/aria/scoreInterviewModuleConstants';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

/** `[STAGE_N_COMPLETE]` token: stage display, TTS, and stage score fetch. */
export async function runPostClaudeStageCompleteTokenGate(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  text: string,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
): Promise<{ handled: boolean }> {
  const stageCompleteMatch = text.match(/\[STAGE_([123])_COMPLETE\]/);
  if (!stageCompleteMatch) {
    return { handled: false };
  }

  const stageNum = parseInt(stageCompleteMatch[1], 10);
  let stageDisplay = stripControlTokens(text) || "Good, that's helpful.";
  stageDisplay = stripFlatReflectionAcknowledgmentOpeners(stageDisplay);
  stageDisplay = stripGenericReflectionFillersFirstParagraph(stageDisplay);
  stageDisplay = stripHollowSystemInterviewerPhrases(stageDisplay);
  stageDisplay = collapseStackedEmpathyIHearYouInFirstParagraph(stageDisplay);
  stageDisplay = stripForbiddenReflectionLead(stageDisplay);
  let displayText = ensureAcknowledgmentBeforeMove(
    stageDisplay,
    params.trimmed,
    recentAssistantMessagesForAck(params.messagesToUse),
    deps.currentInterviewMomentRef.current,
  );
  displayText = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
    sanitizeAssistantInterviewerCharacterNames(displayText),
    params.participantFirstNameForSpoken,
  );
  if (deps.userId) {
    const rtd = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: rtd.attemptId,
      eventType: 'name_injection_debug',
      eventData: {
        stage: 'stage_complete_display',
        moment_number: deps.currentInterviewMomentRef.current,
        scenario_number: deps.currentScenarioRef.current,
        display_has_name: params.participantFirstNameForSpoken
          ? displayText.toLowerCase().includes(params.participantFirstNameForSpoken.toLowerCase())
          : null,
        display_preview: displayText.slice(0, 140),
      },
      platform: rtd.platform,
    });
  }
  const finalMessages = [
    ...params.messagesToUse,
    { role: 'assistant' as const, content: displayText || 'Good, that’s helpful.' },
  ];
  deps.setMessages(finalMessages);
  await speakAssistantTurn(displayText || 'Good, that’s helpful.', ASSISTANT_INTERVIEW_SPEECH);
  try {
    const stageRes = await deps.fetchStageScore(finalMessages);
    deps.setStageResults((prev) => {
      const existing = prev.findIndex((s) => s.stage === stageNum);
      const entry = { stage: stageNum, results: stageRes };
      if (existing >= 0) return prev.map((s, i) => (i === existing ? entry : s));
      return [...prev, entry];
    });
  } catch {
    const fallback = {
      pillarScores: { ...FALLBACK_MARKER_SCORES_MID },
      keyEvidence: {},
      narrativeCoherence: 'moderate' as const,
      behavioralSpecificity: 'moderate' as const,
      notableInconsistencies: [],
      interviewSummary: 'Score unavailable.',
    };
    deps.setStageResults((prev) => {
      const existing = prev.findIndex((s) => s.stage === stageNum);
      const entry = { stage: stageNum, results: fallback };
      if (existing >= 0) return prev.map((s, i) => (i === existing ? entry : s));
      return [...prev, entry];
    });
  }
  deps.setVoiceState('idle');
  return { handled: true };
}
