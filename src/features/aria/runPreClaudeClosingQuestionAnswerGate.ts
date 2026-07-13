import { MOMENT_4_PERSONAL_CARD } from '@features/aria/interviewMomentScenarioConfig';
import { SCENARIO_2_TEXT, SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { splitScenarioTransitionForEmotionModal } from '@features/aria/emotionRecognitionInterview';
import { generateBriefAck } from '@features/aria/interviewAssistantReflection';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  buildScenario1To2BundleForInterview,
  buildScenario2To3TransitionBody,
  buildScenario3ToMoment4BundleForInterview,
} from '@features/aria/interviewTransitionBundles';
import { resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

export type PreClaudeClosingQuestionAnswerGateResult = {
  handled: boolean;
};

const CLOSING_AFFIRMATIVE_PHRASES = [
  'yes',
  'yeah',
  'yep',
  'yup',
  'sure',
  'actually',
  'there is',
  'there was',
  'one thing',
  'i wanted to',
  'i do',
  'kind of',
  'a bit',
  'sort of',
] as const;

const CLOSING_NO_PHRASES = [
  'no',
  'nope',
  'nothing',
  "i'm good",
  'im good',
  "that's all",
  'thats all',
  'nevermind',
  'never mind',
  'all good',
  'nothing else',
  'nah',
  'nothin',
] as const;

const CLOSING_ADDITION_FOLLOW_UP = 'What would you want to add?';

function classifyClosingQuestionAnswer(trimmed: string): { isYes: boolean; isNo: boolean } {
  const lower = trimmed.toLowerCase().trim();
  const isAffirmative =
    CLOSING_AFFIRMATIVE_PHRASES.some((p) => lower.includes(p)) || /^\s*yes\s*\.?\s*$/i.test(trimmed);
  const isNo =
    CLOSING_NO_PHRASES.some((p) => lower.includes(p)) || (lower.length < 4 && !isAffirmative);
  return { isYes: isAffirmative && !isNo, isNo };
}

/**
 * INTERCEPT 2: closing-question answer — never send to Claude.
 */
export async function runPreClaudeClosingQuestionAnswerGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  participantFirstNameForSpoken: string,
): Promise<PreClaudeClosingQuestionAnswerGateResult> {
  const pendingScenarioFromRef = deps.lastClosingQuestionScenarioRef.current;
  const pendingScenarioFromState = deps.closingQuestionScenario;
  if (pendingScenarioFromRef === null && !deps.closingQuestionPending) {
    return { handled: false };
  }

  const pendingClosingScenario = (pendingScenarioFromRef ?? pendingScenarioFromState ?? 1) as 1 | 2 | 3;
  deps.setClosingQuestionPending(false);
  deps.setClosingQuestionScenario(null);
  const userMsgClosing: MessageWithScenario = {
    role: 'user',
    content: trimmed,
    scenarioNumber: pendingClosingScenario,
  };
  const newMessagesClosing = [...deps.messages, userMsgClosing];
  deps.setMessages(newMessagesClosing);
  deps.setCurrentTranscript('');
  deps.transcriptAtReleaseRef.current = '';
  deps.setVoiceState('processing');
  const { isYes } = classifyClosingQuestionAnswer(trimmed);

  if (isYes && trimmed.length < 20) {
    deps.lastClosingQuestionScenarioRef.current = null;
    deps.waitingForClosingAdditionRef.current = pendingClosingScenario;
    const followUpMsg: MessageWithScenario = {
      role: 'assistant',
      content: CLOSING_ADDITION_FOLLOW_UP,
      scenarioNumber: pendingClosingScenario,
    };
    deps.setMessages([...newMessagesClosing, followUpMsg]);
    await deps.speakTextSafe(CLOSING_ADDITION_FOLLOW_UP, ASSISTANT_INTERVIEW_SPEECH);
    deps.setVoiceState('idle');
    return { handled: true };
  }

  let messagesAfterClosingAnswer = newMessagesClosing;
  if (isYes && trimmed.length >= 20) {
    const ackText = generateBriefAck(trimmed);
    const ackMsg: MessageWithScenario = {
      role: 'assistant',
      content: ackText,
      scenarioNumber: pendingClosingScenario,
    };
    messagesAfterClosingAnswer = [...newMessagesClosing, ackMsg];
    deps.setMessages(messagesAfterClosingAnswer);
    await deps.speakTextSafe(ackText);
  }

  deps.markClosingQuestionAnswered(pendingClosingScenario);
  deps.lastClosingQuestionScenarioRef.current = null;
  const scenarioNumber = pendingClosingScenario;
  const userAnswerForReflection = resolveScenarioUserTextForBoundaryReflection(
    messagesAfterClosingAnswer,
    scenarioNumber,
  );
  let nextClosingContent = '';
  if (scenarioNumber === 1) {
    deps.interviewMomentsCompleteRef.current[1] = true;
    deps.currentInterviewMomentRef.current = 2;
    nextClosingContent = buildScenario1To2BundleForInterview(
      participantFirstNameForSpoken,
      SCENARIO_2_TEXT,
      userAnswerForReflection,
    );
  } else if (scenarioNumber === 2) {
    deps.interviewMomentsCompleteRef.current[2] = true;
    deps.currentInterviewMomentRef.current = 3;
    deps.resetScenarioCClientGatesOnly();
    nextClosingContent = buildScenario2To3TransitionBody(
      participantFirstNameForSpoken,
      SCENARIO_3_TEXT,
      userAnswerForReflection,
    );
  }
  const transcriptEndForScoringClosingAnswer =
    scenarioNumber === 3
      ? messagesAfterClosingAnswer
      : [
          ...messagesAfterClosingAnswer,
          {
            role: 'assistant',
            content: nextClosingContent,
            scenarioNumber: scenarioNumber === 1 ? 2 : 3,
          },
        ];
  const persistClosingAnswerScenarioCheckpoint = () => {
    deps.setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
    if (!deps.scoredScenariosRef.current.has(scenarioNumber)) {
      deps.scoredScenariosRef.current.add(scenarioNumber);
      deps.scoreScenario(scenarioNumber, transcriptEndForScoringClosingAnswer);
    }
  };
  let closingAnswerCheckpointPersisted = false;
  if (scenarioNumber === 3) {
    if (deps.personalHandoffInjectedRef.current) {
      if (__DEV__) console.warn('[Amoraea] Duplicate Moment 4 handoff after closing answer — skipped');
    } else {
      deps.personalHandoffInjectedRef.current = true;
      deps.interviewMomentsCompleteRef.current[3] = true;
      deps.currentInterviewMomentRef.current = 4;
      const moment4Handoff = buildScenario3ToMoment4BundleForInterview(
        participantFirstNameForSpoken,
        MOMENT_4_PERSONAL_CARD,
        userAnswerForReflection,
      );
      const handoffMsg: MessageWithScenario = { role: 'assistant', content: moment4Handoff, scenarioNumber: 3 };
      const withHandoff = [...messagesAfterClosingAnswer, handoffMsg];
      deps.setMessages(withHandoff);
      persistClosingAnswerScenarioCheckpoint();
      closingAnswerCheckpointPersisted = true;
      const spM4c = splitScenarioTransitionForEmotionModal(moment4Handoff);
      await deps.speakTextSafe(spM4c.beforeModal, ASSISTANT_INTERVIEW_SPEECH);
      await deps.runEmotionModalAfterScenarioTransition(3, {
        transitionText: moment4Handoff,
        afterBeforeModalPlayback: true,
      });
      if (spM4c.afterModal.trim()) {
        await deps.speakTextSafe(spM4c.afterModal, ASSISTANT_INTERVIEW_SPEECH);
      } else if (__DEV__) {
        console.warn('[Amoraea] emotion modal S3→M4: missing afterModal split (closing answer)');
      }
    }
  } else {
    const newAssistantMsg: MessageWithScenario = {
      role: 'assistant',
      content: nextClosingContent,
      scenarioNumber: scenarioNumber === 1 ? 2 : 3,
    };
    const nextSnClosing = (scenarioNumber === 1 ? 2 : 3) as 1 | 2 | 3;
    deps.currentScenarioRef.current = nextSnClosing;
    const updatedMsgs = [...messagesAfterClosingAnswer, newAssistantMsg];
    deps.setMessages(updatedMsgs);
    persistClosingAnswerScenarioCheckpoint();
    closingAnswerCheckpointPersisted = true;
    await deps.notifyScenarioStarted(nextSnClosing, updatedMsgs);
    const spCls = splitScenarioTransitionForEmotionModal(nextClosingContent);
    await deps.speakTextSafe(spCls.beforeModal, ASSISTANT_INTERVIEW_SPEECH);
    await deps.runEmotionModalAfterScenarioTransition(scenarioNumber, {
      transitionText: nextClosingContent,
      priorScenario: scenarioNumber,
      afterBeforeModalPlayback: true,
    });
    if (spCls.afterModal.trim()) {
      await deps.speakTextSafe(spCls.afterModal, ASSISTANT_INTERVIEW_SPEECH);
    } else if (__DEV__) {
      console.warn('[Amoraea] emotion modal transition: missing afterModal split (closing answer)');
    }
  }
  if (!closingAnswerCheckpointPersisted) {
    persistClosingAnswerScenarioCheckpoint();
  }
  if (__DEV__) {
    deps.closingQuestionAskedRef.current[scenarioNumber] = false;
    deps.closingQuestionAnsweredRef.current[scenarioNumber] = false;
    console.log('[Amoraea] Closing-question answer handled locally — advanced to next scenario', scenarioNumber);
  }
  deps.lastAnsweredClosingScenarioRef.current = null;
  deps.setVoiceState('idle');
  return { handled: true };
}
