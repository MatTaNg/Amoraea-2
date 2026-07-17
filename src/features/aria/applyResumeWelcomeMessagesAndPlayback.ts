import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { findLastRepeatableInterviewQuestionText } from '@features/aria/interviewDisengagementProbes';
import {
  isAssistantBubbleForTranscript,
  syncReferenceCardStateFromAssistantMessages,
} from '@features/aria/interviewReferenceCardResumeHelpers';
import {
  clearResumeWelcomeSpokenForHydration,
  markResumeWelcomeSpoken,
  wasResumeWelcomeSpoken,
} from '@features/aria/interviewLocalPersistence';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { HandleResumeDeps } from '@features/aria/sessionLifecycleTypes';
import { markSessionResumedForNextRecordingStart } from '@utilities/sessionLogging/sessionResumeRecordingTelemetry';
import type { InterviewResumePlan } from '@utilities/interviewResumeCursor';
import {
  buildResumeWelcomeMessage,
  shouldOfferResumeWelcomeTts,
} from '@utilities/interviewResumeCursor';

type ResumeWelcomeDeps = Pick<
  HandleResumeDeps,
  | 'speakTextSafe'
  | 'awaitEmotionModalForIndex'
  | 'currentScenarioRef'
  | 'resumeOfferWelcomeTtsRef'
  | 'resumeWelcomeMessageRef'
  | 'resumeWelcomeHydrationAttemptRef'
  | 'resumeLastAssistantTextRef'
  | 'lastQuestionTextRef'
  | 'setMessages'
  | 'pendingScenarioIntroAfterResumeWelcomeRef'
  | 'resumeRepeatChoicePendingRef'
  | 'committedScenarioRef'
  | 'setReferenceCardScenario'
  | 'setReferenceCardPrompt'
  | 'setInterviewUiPhase'
  | 'resumeEmotionCatchUpIndicesRef'
  | 'resumeEmotionAfterModalTextRef'
  | 'interviewSessionAttemptIdRef'
  | 'currentMessagesRef'
>;

export async function applyResumeWelcomeMessagesAndPlayback(params: {
  deps: ResumeWelcomeDeps;
  resumePlan: InterviewResumePlan;
  transcriptMessages: MessageWithScenario[];
  fullMessages: MessageWithScenario[];
  scenarioIntroBody: string | null;
  persistenceAttemptId: string | null | undefined;
}): Promise<void> {
  const {
    deps,
    resumePlan,
    transcriptMessages,
    fullMessages,
    scenarioIntroBody,
    persistenceAttemptId,
  } = params;

  deps.resumeOfferWelcomeTtsRef.current = shouldOfferResumeWelcomeTts({
    mode: resumePlan.mode,
    transcriptMessages,
  });
  deps.resumeWelcomeMessageRef.current = buildResumeWelcomeMessage({
    mode: resumePlan.mode,
    resumeScenario: resumePlan.resumeScenario,
  });
  const welcomeBack = deps.resumeWelcomeMessageRef.current;
  const welcomeMsg = {
    role: 'assistant',
    content: welcomeBack,
    isWelcomeBack: true,
    scenarioNumber: deps.currentScenarioRef.current,
  } as MessageWithScenario;

  const scenarioIntroMsg = scenarioIntroBody
    ? ({
        role: 'assistant',
        content: scenarioIntroBody,
        scenarioNumber: resumePlan.resumeScenario,
      } as MessageWithScenario)
    : null;

  const persistenceAttemptIdForWelcome =
    typeof persistenceAttemptId === 'string' ? persistenceAttemptId : null;
  const isFirstWelcomeHydrationForAttempt =
    persistenceAttemptIdForWelcome != null &&
    deps.resumeWelcomeHydrationAttemptRef.current !== persistenceAttemptIdForWelcome;
  if (isFirstWelcomeHydrationForAttempt) {
    deps.resumeWelcomeHydrationAttemptRef.current = persistenceAttemptIdForWelcome;
    if (deps.resumeOfferWelcomeTtsRef.current) {
      await clearResumeWelcomeSpokenForHydration(persistenceAttemptIdForWelcome);
    }
  }
  const welcomeAlreadySpoken = await wasResumeWelcomeSpoken(persistenceAttemptIdForWelcome);
  const messagesWithWelcome =
    !deps.resumeOfferWelcomeTtsRef.current || welcomeAlreadySpoken
      ? scenarioIntroMsg
        ? [...fullMessages, scenarioIntroMsg]
        : fullMessages
      : scenarioIntroMsg
        ? [...fullMessages, welcomeMsg, scenarioIntroMsg]
        : [...fullMessages, welcomeMsg];
  deps.resumeLastAssistantTextRef.current = findLastRepeatableInterviewQuestionText(
    messagesWithWelcome,
    deps.lastQuestionTextRef.current,
    { activeScenario: deps.currentScenarioRef.current },
  );
  if (deps.resumeLastAssistantTextRef.current?.trim()) {
    deps.lastQuestionTextRef.current = deps.resumeLastAssistantTextRef.current;
  }
  deps.setMessages(messagesWithWelcome);

  const assistantForRef = messagesWithWelcome.filter((m) => isAssistantBubbleForTranscript(m));
  const refSync = syncReferenceCardStateFromAssistantMessages(assistantForRef);
  deps.committedScenarioRef.current = refSync.scenario;
  deps.setReferenceCardScenario(refSync.scenario);
  deps.setReferenceCardPrompt(refSync.prompt);
  deps.setInterviewUiPhase(refSync.phase);
  if (refSync.prompt?.trim()) {
    deps.lastQuestionTextRef.current = refSync.prompt;
    deps.resumeLastAssistantTextRef.current = refSync.prompt;
  }

  deps.pendingScenarioIntroAfterResumeWelcomeRef.current = null;

  deps.resumeRepeatChoicePendingRef.current = false;
  markSessionResumedForNextRecordingStart();

  void (async () => {
    try {
      const catchUpIndices = deps.resumeEmotionCatchUpIndicesRef.current;
      if (catchUpIndices != null && catchUpIndices.length > 0) {
        for (const itemIndex of catchUpIndices) {
          await deps.awaitEmotionModalForIndex(itemIndex);
        }
        deps.resumeEmotionCatchUpIndicesRef.current = null;
      }
      const offerWelcome = deps.resumeOfferWelcomeTtsRef.current;
      const attemptId = deps.interviewSessionAttemptIdRef.current;
      let spokeWelcome = false;
      if (offerWelcome && !(await wasResumeWelcomeSpoken(attemptId))) {
        await deps.speakTextSafe(welcomeBack, {
          telemetrySource: 'greeting',
          ttsTriggerSource: 'callback',
          // Do not overwrite lastQuestionTextRef with welcome-back meta.
          skipLastQuestionRef: true,
          skipQuestionDeliveredTelemetry: true,
          skipInterviewSpeechAdvance: true,
          skipQuestionTiming: true,
        });
        await markResumeWelcomeSpoken(attemptId);
        spokeWelcome = true;
      }
      const hadCatchUp = catchUpIndices != null && catchUpIndices.length > 0;
      if (scenarioIntroBody?.trim()) {
        await deps.speakTextSafe(scenarioIntroBody, {
          telemetrySource: 'greeting',
          ttsTriggerSource: 'callback',
          // Scenario restart intro is the question to resume; keep lastQuestionTextRef in sync.
        });
      } else if (hadCatchUp && deps.resumeEmotionAfterModalTextRef.current?.trim()) {
        const afterModal = deps.resumeEmotionAfterModalTextRef.current;
        deps.resumeEmotionAfterModalTextRef.current = null;
        await deps.speakTextSafe(stripControlTokens(afterModal), {
          telemetrySource: 'replay',
          ttsTriggerSource: 'callback',
          skipQuestionDeliveredTelemetry: true,
          skipInterviewSpeechAdvance: true,
          skipQuestionTiming: true,
          skipLastQuestionRef: true,
        });
      } else if (!spokeWelcome && !offerWelcome) {
        const last = findLastRepeatableInterviewQuestionText(
          deps.currentMessagesRef.current,
          deps.resumeLastAssistantTextRef.current ?? deps.lastQuestionTextRef.current,
          { activeScenario: deps.currentScenarioRef.current },
        );
        if (last?.trim()) {
          await deps.speakTextSafe(stripControlTokens(last), {
            telemetrySource: 'replay',
            ttsTriggerSource: 'callback',
            skipQuestionDeliveredTelemetry: true,
            skipInterviewSpeechAdvance: true,
            skipQuestionTiming: true,
            skipLastQuestionRef: true,
          });
        }
      }
      deps.resumeRepeatChoicePendingRef.current = offerWelcome && spokeWelcome;
      if (spokeWelcome || !offerWelcome) {
        deps.resumeOfferWelcomeTtsRef.current = false;
      }
    } catch {
      deps.resumeRepeatChoicePendingRef.current = false;
      deps.resumeOfferWelcomeTtsRef.current = false;
    }
  })();
}
