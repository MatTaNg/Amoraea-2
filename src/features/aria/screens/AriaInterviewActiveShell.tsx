import React from 'react';
import { ScrollView, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { FeedbackBubble } from '@/components/FeedbackBubble';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { AriaEmotionInterviewModal } from '@features/aria/screens/AriaEmotionInterviewModal';
import { AriaInterviewerActivePanel } from '@features/aria/screens/AriaInterviewerActivePanel';
import {
  AriaAdminInterviewPanel,
  type AriaAdminReasoningProgress,
} from '@features/aria/screens/AriaAdminInterviewPanel';
import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';
import type { VoiceState, InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { ActiveScenario } from '@app/screens/UserInterviewLayout';
import type { InterviewUiPhase } from '@features/aria/sessionLifecycleTypes';

type InterviewLifecycleStatus =
  | 'loading'
  | 'not_started'
  | 'in_progress'
  | 'preparing_results'
  | 'under_review'
  | 'congratulations'
  | 'analysis';

export type AriaInterviewActiveShellProps = {
  adminInterviewTopBar: React.ReactNode;
  emotionModalVisible: boolean;
  emotionModalItemIndex: number;
  emotionItemsComplete: boolean;
  onEmotionInterviewAnswer: (answer: string) => void;
  isAdmin: boolean;
  status: InterviewSessionStatus;
  isInterviewerView: boolean;
  audioRecorder: {
    isRecording: boolean;
    inputMeterLevel: number;
    reinitializeMicrophoneSession: () => void;
  };
  voiceState: VoiceState;
  interviewerOutputActive: boolean;
  interviewUiPhase: InterviewUiPhase;
  referenceCardScenario: ActiveScenario | null;
  referenceCardPrompt: string | null;
  ttsPlaybackReliabilityNotice: string | null;
  sessionAudioHealthNotice: string | null;
  conversationErrorNotice: string | null;
  micPermission: string;
  isWaiting: boolean;
  handlePressStart: () => void;
  handlePressEnd: () => void;
  micError: string | null;
  micWarning: string | null;
  inputDisabled: boolean;
  useTapMicUi: boolean;
  handleNativeOrWhisperMicPress: () => void;
  handleInterviewSignOut: () => void;
  preInitMeterLevel: number;
  micSessionRecovering: boolean;
  micNeedsReconnect: boolean;
  setMicNeedsReconnect: React.Dispatch<React.SetStateAction<boolean>>;
  lateStartIdleCueVisible: boolean;
  results: InterviewResults | null;
  stageResults: Array<{ stage: number; results: InterviewResults }>;
  messages: ReadonlyArray<{ role: string; content?: string; isError?: boolean; isWaiting?: boolean; id?: string }>;
  scrollViewRef: React.RefObject<ScrollView | null>;
  currentTranscript: string;
  reasoningProgress: AriaAdminReasoningProgress;
  userId: string;
  userEmail: string | undefined;
  standardResultsReferralCode: string | null;
  standardResultsReferralCopyFeedback: boolean;
  typedAnswer: string;
  handleSendTyped: () => void;
  setTypedAnswer: React.Dispatch<React.SetStateAction<string>>;
  setStatus: React.Dispatch<React.SetStateAction<InterviewSessionStatus>>;
  setInterviewStatus: React.Dispatch<React.SetStateAction<InterviewLifecycleStatus>>;
  setStandardResultsReferralCopyFeedback: React.Dispatch<React.SetStateAction<boolean>>;
  navigation: { replace: (name: string, params: { userId: string }) => void };
  routeName: string;
  interviewSessionIdRef: React.MutableRefObject<string>;
  replaceWithStandardApplicantPostInterviewHandoffForUser: (
    navigation: { replace: (name: string, params: { userId: string }) => void },
    userId: string,
    meta?: { interviewSessionId?: string | null; source?: string; attemptId?: string | null },
  ) => void;
  routeOnComplete?: (results: InterviewResults) => void;
  interviewSessionAttemptIdRef: React.MutableRefObject<string | null>;
};

export function AriaInterviewActiveShell(props: AriaInterviewActiveShellProps): React.ReactElement {
  if (__DEV__) {
    console.log(
      '[EmotionModal] render — visible:',
      props.emotionModalVisible,
      'index:',
      props.emotionModalItemIndex,
      'items complete:',
      props.emotionItemsComplete,
    );
  }

  return (
    <SafeAreaContainer
      edges={['bottom', 'left', 'right']}
      style={{ position: 'relative', backgroundColor: '#05060D' }}
    >
      <AriaEmotionInterviewModal
        visible={props.emotionModalVisible}
        itemIndex={props.emotionModalItemIndex}
        onAnswer={props.onEmotionInterviewAnswer}
      />
      {props.adminInterviewTopBar}
      <View style={[styles.activeContainer, props.isAdmin ? styles.adminActiveContainer : undefined]}>
        {props.isInterviewerView ? (
          <AriaInterviewerActivePanel
            audioRecorderIsRecording={props.audioRecorder.isRecording}
            audioRecorderInputMeterLevel={props.audioRecorder.inputMeterLevel}
            reinitializeMicrophoneSession={props.audioRecorder.reinitializeMicrophoneSession}
            voiceState={props.voiceState}
            interviewerOutputActive={props.interviewerOutputActive}
            interviewUiPhase={props.interviewUiPhase}
            referenceCardScenario={props.referenceCardScenario}
            referenceCardPrompt={props.referenceCardPrompt}
            ttsPlaybackReliabilityNotice={props.ttsPlaybackReliabilityNotice}
            sessionAudioHealthNotice={props.sessionAudioHealthNotice}
            conversationErrorNotice={props.conversationErrorNotice}
            micPermissionDenied={props.micPermission === 'denied'}
            isWaiting={props.isWaiting}
            handlePressStart={props.handlePressStart}
            handlePressEnd={props.handlePressEnd}
            micError={props.micError}
            micWarning={props.micWarning}
            inputDisabled={props.inputDisabled}
            useTapMicUi={props.useTapMicUi}
            handleNativeOrWhisperMicPress={props.handleNativeOrWhisperMicPress}
            handleInterviewSignOut={props.handleInterviewSignOut}
            preInitMeterLevel={props.preInitMeterLevel}
            micSessionRecovering={props.micSessionRecovering}
            micNeedsReconnect={props.micNeedsReconnect}
            setMicNeedsReconnect={props.setMicNeedsReconnect}
            lateStartIdleCueVisible={props.lateStartIdleCueVisible}
          />
        ) : (
          <AriaAdminInterviewPanel
            isAdmin={props.isAdmin}
            status={props.status}
            results={props.results}
            stageResults={props.stageResults}
            messages={props.messages}
            scrollViewRef={props.scrollViewRef}
            isWaiting={props.isWaiting}
            currentTranscript={props.currentTranscript}
            voiceState={props.voiceState}
            reasoningProgress={props.reasoningProgress}
            userId={props.userId}
            userEmail={props.userEmail}
            standardResultsReferralCode={props.standardResultsReferralCode}
            standardResultsReferralCopyFeedback={props.standardResultsReferralCopyFeedback}
            typedAnswer={props.typedAnswer}
            inputDisabled={props.inputDisabled}
            emotionModalVisible={props.emotionModalVisible}
            micError={props.micError}
            micWarning={props.micWarning}
            interviewerOutputActive={props.interviewerOutputActive}
            onPressStart={props.handlePressStart}
            onPressEnd={props.handlePressEnd}
            onSendTyped={props.handleSendTyped}
            onSetTypedAnswer={props.setTypedAnswer}
            onViewResults={() => props.setStatus('results')}
            onStandardApplicantContinue={() => {
              props.setInterviewStatus('congratulations');
              if (props.userId && (props.routeName === 'Amoraea' || props.routeName === 'OnboardingInterview')) {
                props.replaceWithStandardApplicantPostInterviewHandoffForUser(props.navigation, props.userId, {
                  interviewSessionId: props.interviewSessionIdRef.current,
                  source: 'results_panel_continue_cta',
                });
              }
            }}
            onAdminResultsContinue={() => {
              if (props.routeOnComplete && props.results) {
                props.routeOnComplete({ ...props.results, gateResult: props.results.gateResult });
              }
            }}
            onCopyReferralCode={async () => {
              if (!props.standardResultsReferralCode) return;
              try {
                await Clipboard.setStringAsync(props.standardResultsReferralCode);
                props.setStandardResultsReferralCopyFeedback(true);
                setTimeout(() => props.setStandardResultsReferralCopyFeedback(false), 2000);
              } catch {
                /* non-fatal */
              }
            }}
          />
        )}
      </View>
      <FeedbackBubble
        attemptId={props.interviewSessionAttemptIdRef.current ?? undefined}
        userId={props.userId || undefined}
      />
    </SafeAreaContainer>
  );
}
