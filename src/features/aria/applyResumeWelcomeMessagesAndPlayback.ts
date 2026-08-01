import { awaitResumePlaybackAfterLoadingDismissed } from '@features/aria/awaitResumePlaybackAfterLoadingDismissed';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  acquireResumeWelcomePlaybackLock,
  clearResumeWelcomeSpokenForHydration,
  consumeMountResumeOwnsWelcomePlayback,
  getResumeWelcomePlaybackGeneration,
  markResumeWelcomeSpoken,
  releaseResumeWelcomePlaybackLock,
  resolveResumeWelcomeStorageAttemptId,
  wasResumeWelcomeSpoken,
} from '@features/aria/interviewLocalPersistence';
import {
  clearResumeDeferredUserSpeech,
  flushResumeDeferredUserSpeechWhenUnblocked,
} from '@features/aria/resumeDeferredUserSpeech';
import {
  findLastMoment4RepeatableQuestionText,
  findLastRepeatableInterviewQuestionText,
} from '@features/aria/interviewDisengagementProbes';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import {
  isAssistantBubbleForTranscript,
  MOMENT_4_PERSONAL_LABEL,
  resolveLastMoment4QuestionCardBodyFromTranscript,
  syncReferenceCardStateFromAssistantMessages,
} from '@features/aria/interviewReferenceCardResumeHelpers';
import {
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from '@features/aria/moment5ProbeLogic';
import { resolveQuestionOnlyTextForResumeWelcome } from '@features/aria/resolveAssessableQuestionTextForResponseTiming';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { HandleResumeDeps } from '@features/aria/sessionLifecycleTypes';
import { markSessionResumedForNextRecordingStart } from '@utilities/sessionLogging/sessionResumeRecordingTelemetry';
import type { InterviewResumePlan } from '@utilities/interviewResumeCursor';
import {
  buildResumeWelcomeMessage,
  resumeWelcomeMessageEmbedsLastQuestion,
  shouldOfferResumeWelcomeTts,
} from '@utilities/interviewResumeCursor';
import { Platform } from 'react-native';

import { remoteLog } from '@utilities/remoteLog';
import { markNativePlaybackBridgeBeforeNextTts } from '@features/aria/utils/audioModeHelpers';

type ResumeWelcomeDeps = Pick<
  HandleResumeDeps,
  | 'speakTextSafe'
  | 'awaitEmotionModalForIndex'
  | 'currentScenarioRef'
  | 'resumeOfferWelcomeTtsRef'
  | 'resumeWelcomeMessageRef'
  | 'resumeInPersonalPartRef'
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
  | 'interviewSessionIdRef'
  | 'currentMessagesRef'
  | 'resumeLoadingFlowActiveRef'
  | 'interviewNameRef'
  | 'processUserSpeech'
>;

export function resolveResumeWelcomeQuestionText(
  messages: MessageWithScenario[],
  fallbackLastQuestionText: string | null | undefined,
  options: {
    activeScenario: number | null | undefined;
    firstName: string | null | undefined;
    inPersonalPart?: boolean;
  },
): string {
  const lastUserAnswer = [...messages].reverse().find((m) => m.role === 'user')?.content ?? null;
  const resolveOpts = {
    firstName: options.firstName ?? '',
    lastUserAnswer,
    activeScenario: options.activeScenario ?? undefined,
  };
  if (options.inPersonalPart) {
    const hasMoment5Question = messages.some(
      (m) =>
        m.role === 'assistant' &&
        !m.isWelcomeBack &&
        !m.isScoreCard &&
        transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content ?? ''),
    );
    const raw = hasMoment5Question
      ? findLastRepeatableInterviewQuestionText(messages, fallbackLastQuestionText, {
          activeScenario: options.activeScenario ?? undefined,
        })
      : (findLastMoment4RepeatableQuestionText(messages) ?? MOMENT_4_GRUDGE_QUESTION_TEXT);
    return resolveQuestionOnlyTextForResumeWelcome(raw, resolveOpts);
  }
  const raw = findLastRepeatableInterviewQuestionText(messages, fallbackLastQuestionText, {
    activeScenario: options.activeScenario ?? undefined,
  });
  return resolveQuestionOnlyTextForResumeWelcome(raw, resolveOpts);
}

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

  const inPersonalPart = resumePlan.mode === 'resume_post_scenarios';
  if (deps.resumeInPersonalPartRef) {
    deps.resumeInPersonalPartRef.current = inPersonalPart;
  }
  const hasMoment5PrimaryQuestion = fullMessages.some(
    (m) =>
      m.role === 'assistant' &&
      !m.isWelcomeBack &&
      !m.isScoreCard &&
      transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content ?? ''),
  );

  deps.resumeLastAssistantTextRef.current = resolveResumeWelcomeQuestionText(
    fullMessages,
    deps.lastQuestionTextRef.current,
    {
      activeScenario: deps.currentScenarioRef.current,
      firstName: deps.interviewNameRef.current,
      inPersonalPart,
    },
  );
  if (deps.resumeLastAssistantTextRef.current?.trim()) {
    deps.lastQuestionTextRef.current = deps.resumeLastAssistantTextRef.current;
  }

  const assistantForRef = fullMessages.filter((m) => isAssistantBubbleForTranscript(m));
  const refSync = syncReferenceCardStateFromAssistantMessages(assistantForRef, {
    fullTranscript: fullMessages,
    activeScenario: deps.currentScenarioRef.current,
    lastQuestionText: deps.lastQuestionTextRef.current,
  });
  if (inPersonalPart) {
    if (hasMoment5PrimaryQuestion && refSync.scenario) {
      deps.committedScenarioRef.current = refSync.scenario;
      deps.setReferenceCardScenario(refSync.scenario);
      deps.setReferenceCardPrompt(refSync.prompt);
      deps.setInterviewUiPhase('scenario_active');
    } else {
      const moment4Question =
        findLastMoment4RepeatableQuestionText(fullMessages) ??
        resolveLastMoment4QuestionCardBodyFromTranscript(fullMessages) ??
        refSync.prompt?.trim() ??
        MOMENT_4_GRUDGE_QUESTION_TEXT;
      deps.committedScenarioRef.current = {
        label: MOMENT_4_PERSONAL_LABEL,
        text: moment4Question,
      };
      deps.setReferenceCardScenario(deps.committedScenarioRef.current);
      deps.setReferenceCardPrompt(moment4Question);
      deps.setInterviewUiPhase('scenario_active');
    }
  } else {
    deps.committedScenarioRef.current = refSync.scenario;
    deps.setReferenceCardScenario(refSync.scenario);
    deps.setReferenceCardPrompt(refSync.prompt);
    deps.setInterviewUiPhase(refSync.phase);
    if (refSync.prompt?.trim() && !deps.resumeLastAssistantTextRef.current?.trim()) {
      const questionOnly = resolveQuestionOnlyTextForResumeWelcome(refSync.prompt, {
        firstName: deps.interviewNameRef.current ?? '',
        lastUserAnswer: [...fullMessages].reverse().find((m) => m.role === 'user')?.content ?? null,
        activeScenario: deps.currentScenarioRef.current ?? undefined,
      });
      deps.lastQuestionTextRef.current = questionOnly;
      deps.resumeLastAssistantTextRef.current = questionOnly;
    }
  }

  deps.resumeWelcomeMessageRef.current = buildResumeWelcomeMessage({
    mode: resumePlan.mode,
    resumeScenario: resumePlan.resumeScenario,
    lastQuestionText: scenarioIntroBody?.trim()
      ? null
      : (deps.resumeLastAssistantTextRef.current ?? deps.lastQuestionTextRef.current),
  });
  const welcomeBack = deps.resumeWelcomeMessageRef.current;
  const welcomeEmbedsLastQuestion = resumeWelcomeMessageEmbedsLastQuestion(welcomeBack);
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
  const welcomeStorageAttemptId = resolveResumeWelcomeStorageAttemptId({
    persistenceAttemptId: persistenceAttemptIdForWelcome,
    interviewSessionAttemptId: deps.interviewSessionAttemptIdRef.current,
    interviewSessionId: deps.interviewSessionIdRef.current,
  });
  if (deps.resumeOfferWelcomeTtsRef.current && welcomeStorageAttemptId) {
    await clearResumeWelcomeSpokenForHydration(welcomeStorageAttemptId);
  }
  const welcomeAlreadySpoken = welcomeStorageAttemptId
    ? await wasResumeWelcomeSpoken(welcomeStorageAttemptId)
    : false;
  const messagesWithWelcome =
    !deps.resumeOfferWelcomeTtsRef.current || welcomeAlreadySpoken
      ? scenarioIntroMsg
        ? [...fullMessages, scenarioIntroMsg]
        : fullMessages
      : scenarioIntroMsg
        ? [...fullMessages, welcomeMsg, scenarioIntroMsg]
        : [...fullMessages, welcomeMsg];

  deps.setMessages(messagesWithWelcome);

  deps.pendingScenarioIntroAfterResumeWelcomeRef.current = null;

  deps.resumeRepeatChoicePendingRef.current = false;
  markSessionResumedForNextRecordingStart();

  const attemptIdForPlaybackLock = welcomeStorageAttemptId;
  const willRunResumePlayback =
    deps.resumeOfferWelcomeTtsRef.current ||
    Boolean(scenarioIntroBody?.trim()) ||
    (deps.resumeEmotionCatchUpIndicesRef.current?.length ?? 0) > 0;
  if (willRunResumePlayback) {
    acquireResumeWelcomePlaybackLock(attemptIdForPlaybackLock);
  }

  void (async () => {
    try {
      await awaitResumePlaybackAfterLoadingDismissed(deps.resumeLoadingFlowActiveRef);
      const playbackGeneration = getResumeWelcomePlaybackGeneration();
      const isResumePlaybackStale = (): boolean =>
        getResumeWelcomePlaybackGeneration() !== playbackGeneration;
      if (isResumePlaybackStale()) {
        return;
      }
      if (Platform.OS !== 'web') {
        markNativePlaybackBridgeBeforeNextTts('resume_welcome_playback');
      }
      const catchUpIndices = deps.resumeEmotionCatchUpIndicesRef.current;
      if (catchUpIndices != null && catchUpIndices.length > 0) {
        for (const itemIndex of catchUpIndices) {
          await deps.awaitEmotionModalForIndex(itemIndex);
        }
        deps.resumeEmotionCatchUpIndicesRef.current = null;
      }
      const offerWelcome = deps.resumeOfferWelcomeTtsRef.current;
      const welcomeAttemptId = resolveResumeWelcomeStorageAttemptId({
        persistenceAttemptId,
        interviewSessionAttemptId: deps.interviewSessionAttemptIdRef.current,
        interviewSessionId: deps.interviewSessionIdRef.current,
      });
      const speakLastQuestionReplay = async (): Promise<void> => {
        if (isResumePlaybackStale()) return;
        const last = resolveResumeWelcomeQuestionText(
          deps.currentMessagesRef.current,
          deps.resumeLastAssistantTextRef.current ?? deps.lastQuestionTextRef.current,
          {
            activeScenario: deps.currentScenarioRef.current,
            firstName: deps.interviewNameRef.current,
            inPersonalPart,
          },
        );
        if (!last?.trim()) return;
        if (isResumePlaybackStale()) return;
        await deps.speakTextSafe(stripControlTokens(last), {
          telemetrySource: 'replay',
          ttsTriggerSource: 'callback',
          skipQuestionDeliveredTelemetry: true,
          skipInterviewSpeechAdvance: true,
          skipQuestionTiming: true,
          skipLastQuestionRef: true,
        });
      };
      const speakWelcomeIfNeeded = async (): Promise<void> => {
        const alreadySpoken =
          welcomeAttemptId != null ? await wasResumeWelcomeSpoken(welcomeAttemptId) : false;
        if (!offerWelcome || alreadySpoken) {
          return;
        }
        if (isResumePlaybackStale()) {
          return;
        }
        await deps.speakTextSafe(welcomeBack, {
          telemetrySource: 'greeting',
          ttsTriggerSource: 'callback',
          skipLastQuestionRef: true,
          skipQuestionDeliveredTelemetry: true,
          skipInterviewSpeechAdvance: true,
          skipQuestionTiming: true,
          skipScenarioAContemptProbeSessionDedup: true,
        });
        if (welcomeAttemptId) {
          await markResumeWelcomeSpoken(welcomeAttemptId);
        }
      };
      const hadCatchUp = catchUpIndices != null && catchUpIndices.length > 0;
      if (scenarioIntroBody?.trim()) {
        await speakWelcomeIfNeeded();
        if (isResumePlaybackStale()) return;
        await deps.speakTextSafe(scenarioIntroBody, {
          telemetrySource: 'greeting',
          ttsTriggerSource: 'callback',
        });
      } else if (hadCatchUp && deps.resumeEmotionAfterModalTextRef.current?.trim()) {
        const afterModal = deps.resumeEmotionAfterModalTextRef.current;
        deps.resumeEmotionAfterModalTextRef.current = null;
        await speakWelcomeIfNeeded();
        if (isResumePlaybackStale()) return;
        await deps.speakTextSafe(stripControlTokens(afterModal), {
          telemetrySource: 'replay',
          ttsTriggerSource: 'callback',
          skipQuestionDeliveredTelemetry: true,
          skipInterviewSpeechAdvance: true,
          skipQuestionTiming: true,
          skipLastQuestionRef: true,
        });
      } else {
        await speakWelcomeIfNeeded();
        if (isResumePlaybackStale()) return;
        if (!welcomeEmbedsLastQuestion) {
          await speakLastQuestionReplay();
        }
      }
      deps.resumeRepeatChoicePendingRef.current = false;
      deps.resumeOfferWelcomeTtsRef.current = false;
    } catch {
      deps.resumeRepeatChoicePendingRef.current = false;
      deps.resumeOfferWelcomeTtsRef.current = false;
      clearResumeDeferredUserSpeech();
    } finally {
      consumeMountResumeOwnsWelcomePlayback();
      releaseResumeWelcomePlaybackLock(attemptIdForPlaybackLock);
      void flushResumeDeferredUserSpeechWhenUnblocked({
        processUserSpeech: deps.processUserSpeech,
        resumeLoadingFlowActiveRef: deps.resumeLoadingFlowActiveRef,
        resumeOfferWelcomeTtsRef: deps.resumeOfferWelcomeTtsRef,
        resumeRepeatChoicePendingRef: deps.resumeRepeatChoicePendingRef,
        interviewSessionAttemptIdRef: deps.interviewSessionAttemptIdRef,
        currentMessagesRef: deps.currentMessagesRef,
      });
    }
  })();
}
