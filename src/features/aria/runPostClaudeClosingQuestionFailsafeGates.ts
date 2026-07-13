import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import { MOMENT_4_PERSONAL_CARD } from '@features/aria/interviewMomentScenarioConfig';
import { SCENARIO_2_TEXT, SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { buildPostClaudeProgressRefsPayload } from '@features/aria/buildPostClaudeProgressRefsPayload';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import { splitScenarioTransitionForEmotionModal } from '@features/aria/emotionRecognitionInterview';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { dedupeAdjacentBoundaryValidationsBeforeParticipantName } from '@features/aria/interviewerFrameworkPrompt';
import {
  buildMoment4HandoffForInterview,
  buildScenario1To2BundleForInterview,
  buildScenario2To3TransitionBody,
} from '@features/aria/interviewTransitionBundles';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';

function resolveClosingFailsafeNextContent(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  scenarioNumber: 1 | 2 | 3,
  rawTextFallback?: string,
): string {
  const userAnswer = resolveScenarioUserTextForBoundaryReflection(
    params.messagesToUse,
    scenarioNumber,
  );
  if (scenarioNumber === 1) {
    deps.interviewMomentsCompleteRef.current[1] = true;
    deps.currentInterviewMomentRef.current = 2;
    return buildScenario1To2BundleForInterview(
      params.participantFirstNameForSpoken,
      SCENARIO_2_TEXT,
      userAnswer,
    );
  }
  if (scenarioNumber === 2) {
    deps.interviewMomentsCompleteRef.current[2] = true;
    deps.currentInterviewMomentRef.current = 3;
    deps.resetScenarioCClientGatesOnly();
    return buildScenario2To3TransitionBody(
      params.participantFirstNameForSpoken,
      SCENARIO_3_TEXT,
      userAnswer,
    );
  }
  if (deps.personalHandoffInjectedRef.current) {
    return stripControlTokens(rawTextFallback ?? '') || 'Got it.';
  }
  deps.personalHandoffInjectedRef.current = true;
  deps.interviewMomentsCompleteRef.current[3] = true;
  deps.currentInterviewMomentRef.current = 4;
  return buildMoment4HandoffForInterview(
    params.participantFirstNameForSpoken,
    MOMENT_4_PERSONAL_CARD,
    userAnswer,
  );
}

async function advanceClosingFailsafeScenario(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
  opts: {
    scenarioNumber: 1 | 2 | 3;
    nextContent: string;
    displayFallback: string;
    scoreWhenCanAdvance?: boolean;
    devLogLabel?: string;
    devWarnMissingAfterModal: string;
  },
): Promise<void> {
  const { scenarioNumber } = opts;
  const fullDisplay = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
    sanitizeAssistantInterviewerCharacterNames(opts.nextContent || opts.displayFallback),
    params.participantFirstNameForSpoken,
  );
  const nextScenarioNum = scenarioNumber === 1 ? 2 : scenarioNumber === 2 ? 3 : 3;
  const newAssistantMsg: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: fullDisplay,
    scenarioNumber: nextScenarioNum,
  };
  deps.currentScenarioRef.current = nextScenarioNum;
  const updatedMessages = [...params.messagesToUse, newAssistantMsg];
  deps.setMessages(updatedMessages);
  deps.applyInterviewProgressFromAssistantText(
    fullDisplay,
    buildPostClaudeProgressRefsPayload(deps),
  );

  const shouldScore = opts.scoreWhenCanAdvance !== false;
  if (shouldScore) {
    deps.setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
    if (!deps.scoredScenariosRef.current.has(scenarioNumber)) {
      deps.scoredScenariosRef.current.add(scenarioNumber);
      deps.scoreScenario(
        scenarioNumber,
        scenarioNumber === 3 ? params.messagesToUse : updatedMessages,
      );
    }
    if (__DEV__) {
      deps.closingQuestionAskedRef.current[scenarioNumber] = false;
      deps.closingQuestionAnsweredRef.current[scenarioNumber] = false;
    }
  }

  await deps.notifyScenarioStarted(nextScenarioNum, updatedMessages);
  const emotionSplit = splitScenarioTransitionForEmotionModal(fullDisplay);
  await speakAssistantTurn(emotionSplit.beforeModal, ASSISTANT_INTERVIEW_SPEECH);
  await deps.runEmotionModalAfterScenarioTransition(scenarioNumber, {
    transitionText: fullDisplay,
    priorScenario: scenarioNumber,
    afterBeforeModalPlayback: true,
  });
  if (emotionSplit.afterModal.trim()) {
    await speakAssistantTurn(emotionSplit.afterModal, ASSISTANT_INTERVIEW_SPEECH);
  } else if (__DEV__) {
    console.warn(opts.devWarnMissingAfterModal);
  }
  deps.lastAnsweredClosingScenarioRef.current = null;
  deps.setVoiceState('idle');
  if (__DEV__ && opts.devLogLabel) {
    console.log(opts.devLogLabel, scenarioNumber);
  }
}

/**
 * Closing-ack and repeat-closing-question failsafes when the model omits `[SCENARIO_COMPLETE:N]`.
 * Must not run when `[INTERVIEW_COMPLETE]` is present (handled downstream).
 */
export async function runPostClaudeClosingQuestionFailsafeGates(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  text: string,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
): Promise<{ handled: boolean }> {
  if (text.includes('[INTERVIEW_COMPLETE]')) {
    return { handled: false };
  }

  const closingAckPattern = /\b(got it|okay|alright)\b.*\b(move on|on to the next|next one)\b/i;
  const looksLikeClosingAck =
    closingAckPattern.test(text) ||
    (/\blet'?s move on\b/i.test(text) && /got it|okay|alright/i.test(text));
  const justAnsweredClosing = deps.lastAnsweredClosingScenarioRef.current != null;
  const noScenarioCompleteInResponse = !/\[SCENARIO_COMPLETE:\s*\d+\]/i.test(text);

  if (justAnsweredClosing && looksLikeClosingAck && noScenarioCompleteInResponse) {
    const scenarioNumber = deps.lastAnsweredClosingScenarioRef.current as 1 | 2 | 3;
    const canAdvance =
      deps.closingQuestionAskedRef.current[scenarioNumber] === true &&
      deps.closingQuestionAnsweredRef.current[scenarioNumber] === true;
    const nextContent = resolveClosingFailsafeNextContent(deps, params, scenarioNumber, text);
    await advanceClosingFailsafeScenario(deps, params, speakAssistantTurn, {
      scenarioNumber,
      nextContent,
      displayFallback: stripControlTokens(text) || 'Got it.',
      scoreWhenCanAdvance: canAdvance,
      devLogLabel: '[Amoraea] Closing-ack failsafe: advanced to next scenario',
      devWarnMissingAfterModal:
        '[Amoraea] emotion modal transition: missing afterModal split (closing-ack failsafe)',
    });
    return { handled: true };
  }

  const repeatClosingMatch = text.match(/\[CLOSING_QUESTION:(\d)\]/);
  if (repeatClosingMatch) {
    const scenarioNumber = parseInt(repeatClosingMatch[1], 10) as 1 | 2 | 3;
    if (deps.closingQuestionAnsweredRef.current[scenarioNumber] === true) {
      if (__DEV__) {
        console.warn('[Amoraea] Closing question repeat detected — advancing without displaying');
      }
      const nextContent = resolveClosingFailsafeNextContent(deps, params, scenarioNumber, text);
      await advanceClosingFailsafeScenario(deps, params, speakAssistantTurn, {
        scenarioNumber,
        nextContent,
        displayFallback: 'Got it.',
        devWarnMissingAfterModal:
          '[Amoraea] emotion modal transition: missing afterModal split (repeat-closing failsafe)',
      });
      return { handled: true };
    }
  }

  return { handled: false };
}
