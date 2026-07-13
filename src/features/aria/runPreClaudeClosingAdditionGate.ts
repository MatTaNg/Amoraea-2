import { MOMENT_4_PERSONAL_CARD } from '@features/aria/interviewMomentScenarioConfig';
import { SCENARIO_2_TEXT, SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { splitScenarioTransitionForEmotionModal } from '@features/aria/emotionRecognitionInterview';
import { generateBriefAck } from '@features/aria/interviewAssistantReflection';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  buildMoment4HandoffForInterview,
  buildScenario1To2BundleForInterview,
  buildScenario2To3TransitionBody,
} from '@features/aria/interviewTransitionBundles';
import { resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

export type PreClaudeClosingAdditionGateResult = {
  handled: boolean;
};

const CLOSING_ADDITION_WITHDRAWAL_PHRASES = [
  'nevermind',
  'never mind',
  'forget it',
  "it's fine",
  'its fine',
  'nothing',
  'no',
  'lets move on',
  "let's move on",
  'actually no',
  'nvm',
  'skip it',
  "doesn't matter",
  'not important',
] as const;

/**
 * INTERCEPT 1: user answered "what would you add?" after a short closing yes — never send to Claude.
 */
export async function runPreClaudeClosingAdditionGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  participantFirstNameForSpoken: string,
): Promise<PreClaudeClosingAdditionGateResult> {
  if (deps.waitingForClosingAdditionRef.current === null) {
    return { handled: false };
  }

  const scenarioNumber = deps.waitingForClosingAdditionRef.current as 1 | 2 | 3;
  deps.waitingForClosingAdditionRef.current = null;
  deps.setClosingQuestionPending(false);
  deps.setClosingQuestionScenario(null);
  const userMsgAdd: MessageWithScenario = {
    role: 'user',
    content: trimmed,
    scenarioNumber,
  };
  const newMessagesAdd = [...deps.messages, userMsgAdd];
  deps.setMessages(newMessagesAdd);
  deps.setCurrentTranscript('');
  deps.transcriptAtReleaseRef.current = '';
  deps.setVoiceState('processing');
  const lower = trimmed.toLowerCase().trim();
  const isWithdrawal =
    CLOSING_ADDITION_WITHDRAWAL_PHRASES.some((p) => lower.includes(p)) || lower.length < 3;
  const ackMsg: MessageWithScenario = isWithdrawal
    ? { role: 'assistant', content: 'No worries.', scenarioNumber }
    : { role: 'assistant', content: generateBriefAck(trimmed), scenarioNumber };
  const messagesAfterAck = [...newMessagesAdd, ackMsg];
  deps.setMessages(messagesAfterAck);
  await deps.speakTextSafe(ackMsg.content);
  deps.markClosingQuestionAnswered(scenarioNumber);
  const userAnswerForReflection = resolveScenarioUserTextForBoundaryReflection(messagesAfterAck, scenarioNumber);
  let nextContent = '';
  if (scenarioNumber === 1) {
    deps.interviewMomentsCompleteRef.current[1] = true;
    deps.currentInterviewMomentRef.current = 2;
    nextContent = buildScenario1To2BundleForInterview(
      participantFirstNameForSpoken,
      SCENARIO_2_TEXT,
      userAnswerForReflection,
    );
  } else if (scenarioNumber === 2) {
    deps.interviewMomentsCompleteRef.current[2] = true;
    deps.currentInterviewMomentRef.current = 3;
    deps.resetScenarioCClientGatesOnly();
    nextContent = buildScenario2To3TransitionBody(
      participantFirstNameForSpoken,
      SCENARIO_3_TEXT,
      userAnswerForReflection,
    );
  }
  const transcriptEndForScoringClosingAddition =
    scenarioNumber === 3
      ? messagesAfterAck
      : [
          ...messagesAfterAck,
          { role: 'assistant', content: nextContent, scenarioNumber: scenarioNumber === 1 ? 2 : 3 },
        ];
  const persistClosingAdditionScenarioCheckpoint = () => {
    deps.setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
    if (!deps.scoredScenariosRef.current.has(scenarioNumber)) {
      deps.scoredScenariosRef.current.add(scenarioNumber);
      deps.scoreScenario(scenarioNumber, transcriptEndForScoringClosingAddition);
    }
  };
  let closingAdditionCheckpointPersisted = false;
  if (scenarioNumber === 3) {
    if (deps.personalHandoffInjectedRef.current) {
      if (__DEV__) console.warn('[Amoraea] Duplicate Moment 4 handoff after closing addition — skipped');
    } else {
      deps.personalHandoffInjectedRef.current = true;
      deps.interviewMomentsCompleteRef.current[3] = true;
      deps.currentInterviewMomentRef.current = 4;
      const moment4Handoff = buildMoment4HandoffForInterview(
        participantFirstNameForSpoken,
        MOMENT_4_PERSONAL_CARD,
        userAnswerForReflection,
      );
      const handoffMsg: MessageWithScenario = { role: 'assistant', content: moment4Handoff, scenarioNumber: 3 };
      const withHandoff = [...messagesAfterAck, handoffMsg];
      deps.setMessages(withHandoff);
      persistClosingAdditionScenarioCheckpoint();
      closingAdditionCheckpointPersisted = true;
      const spM4 = splitScenarioTransitionForEmotionModal(moment4Handoff);
      await deps.speakTextSafe(spM4.beforeModal, ASSISTANT_INTERVIEW_SPEECH);
      await deps.runEmotionModalAfterScenarioTransition(3, {
        transitionText: moment4Handoff,
        afterBeforeModalPlayback: true,
      });
      if (spM4.afterModal.trim()) {
        await deps.speakTextSafe(spM4.afterModal, ASSISTANT_INTERVIEW_SPEECH);
      } else if (__DEV__) {
        console.warn('[Amoraea] emotion modal S3→M4: missing afterModal split (closing addition)');
      }
    }
  } else {
    const transitionMsg: MessageWithScenario = {
      role: 'assistant',
      content: nextContent,
      scenarioNumber: scenarioNumber === 1 ? 2 : 3,
    };
    const nextSn = (scenarioNumber === 1 ? 2 : 3) as 1 | 2 | 3;
    deps.currentScenarioRef.current = nextSn;
    const withTransition = [...messagesAfterAck, transitionMsg];
    deps.setMessages(withTransition);
    persistClosingAdditionScenarioCheckpoint();
    closingAdditionCheckpointPersisted = true;
    await deps.notifyScenarioStarted(nextSn, withTransition);
    const spTr = splitScenarioTransitionForEmotionModal(nextContent);
    await deps.speakTextSafe(spTr.beforeModal, ASSISTANT_INTERVIEW_SPEECH);
    await deps.runEmotionModalAfterScenarioTransition(scenarioNumber, {
      transitionText: nextContent,
      priorScenario: scenarioNumber,
      afterBeforeModalPlayback: true,
    });
    if (spTr.afterModal.trim()) {
      await deps.speakTextSafe(spTr.afterModal, ASSISTANT_INTERVIEW_SPEECH);
    } else if (__DEV__) {
      console.warn('[Amoraea] emotion modal transition: missing afterModal split (closing addition)');
    }
  }
  if (!closingAdditionCheckpointPersisted) {
    persistClosingAdditionScenarioCheckpoint();
  }
  if (__DEV__) {
    deps.closingQuestionAskedRef.current[scenarioNumber] = false;
    deps.closingQuestionAnsweredRef.current[scenarioNumber] = false;
  }
  deps.lastAnsweredClosingScenarioRef.current = null;
  deps.setVoiceState('idle');
  return { handled: true };
}
