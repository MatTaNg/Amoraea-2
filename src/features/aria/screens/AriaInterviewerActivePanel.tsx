import React from 'react';
import { Platform, View } from 'react-native';

import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import { isWebInterviewMicPreInitReady } from '@features/aria/utils/webInterviewMicPreInit';
import { UserInterviewLayout, type ActiveScenario } from '@app/screens/UserInterviewLayout';
import type { FlameState } from '@app/screens/FlameOrb';

export function AriaInterviewerActivePanel({
  useMediaRecorderPath,
  audioRecorderIsRecording,
  audioRecorderInputMeterLevel,
  reinitializeMicrophoneSession,
  voiceState,
  webInterviewerOutputActive,
  interviewUiPhase,
  referenceCardScenario,
  referenceCardPrompt,
  ttsPlaybackReliabilityNotice,
  webInsecureContextMessage,
  sessionAudioHealthNotice,
  conversationErrorNotice,
  micPermissionDenied,
  isWaiting,
  handlePressStart,
  handlePressEnd,
  micError,
  micWarning,
  inputDisabled,
  useTapMicUi,
  handleNativeOrWhisperMicPress,
  handleWebMicPressIn,
  handleInterviewSignOut,
  preInitMeterLevel,
  micSessionRecovering,
  micNeedsReconnect,
  setMicNeedsReconnect,
  lateStartIdleCueVisible,
}: {
  useMediaRecorderPath: boolean;
  audioRecorderIsRecording: boolean;
  audioRecorderInputMeterLevel: number;
  reinitializeMicrophoneSession: () => Promise<boolean>;
  voiceState: VoiceState;
  webInterviewerOutputActive: boolean;
  interviewUiPhase: string;
  referenceCardScenario: ActiveScenario | null;
  referenceCardPrompt: string | null;
  ttsPlaybackReliabilityNotice: string | null;
  webInsecureContextMessage: string | null;
  sessionAudioHealthNotice: string | null;
  conversationErrorNotice: string | null;
  micPermissionDenied: boolean;
  isWaiting: boolean;
  handlePressStart: () => void;
  handlePressEnd: () => void;
  micError: string | null;
  micWarning: string | null;
  inputDisabled: boolean;
  useTapMicUi: boolean;
  handleNativeOrWhisperMicPress: () => void;
  handleWebMicPressIn: () => void;
  handleInterviewSignOut: () => void;
  preInitMeterLevel: number;
  micSessionRecovering: boolean;
  micNeedsReconnect: boolean;
  setMicNeedsReconnect: (value: boolean) => void;
  lateStartIdleCueVisible: boolean;
}): React.ReactElement {
  const flameState: FlameState =
    useMediaRecorderPath && audioRecorderIsRecording
      ? 'recording'
      : Platform.OS === 'web' && voiceState === 'speaking' && !webInterviewerOutputActive
        ? 'idle'
        : voiceState;

  const interviewMicMeterActive =
    useMediaRecorderPath &&
    (audioRecorderIsRecording ||
      voiceState === 'recording' ||
      (Platform.OS === 'web' && isWebInterviewMicPreInitReady()));

  const interviewMicInputLevel = interviewMicMeterActive
    ? Math.max(audioRecorderInputMeterLevel, preInitMeterLevel)
    : 0;

  const micLabelOverride = useTapMicUi
    ? useMediaRecorderPath
      ? audioRecorderIsRecording
        ? 'Tap to stop'
        : 'Tap to speak'
      : voiceState === 'listening'
        ? 'Tap to stop'
        : 'Tap to speak'
    : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: '#05060D' }}>
      <UserInterviewLayout
        flameState={flameState}
        showScenarioReferenceEnabled={interviewUiPhase === 'scenario_active' && !!referenceCardScenario}
        referenceCardScenario={referenceCardScenario}
        referenceCardPrompt={referenceCardPrompt}
        ttsPlaybackReliabilityNotice={ttsPlaybackReliabilityNotice}
        webInsecureContextMessage={webInsecureContextMessage}
        sessionAudioHealthNotice={sessionAudioHealthNotice}
        conversationErrorNotice={conversationErrorNotice}
        micPermissionDenied={micPermissionDenied}
        isWaiting={isWaiting && voiceState === 'processing' && !webInterviewerOutputActive}
        onPressStart={handlePressStart}
        onPressEnd={handlePressEnd}
        voiceState={useMediaRecorderPath && audioRecorderIsRecording ? 'recording' : voiceState}
        interviewerOutputActive={webInterviewerOutputActive}
        micError={micError}
        micWarning={micWarning}
        inputDisabled={inputDisabled}
        micToggleMode={useTapMicUi}
        onMicPress={useTapMicUi ? handleNativeOrWhisperMicPress : undefined}
        onMicPressIn={Platform.OS === 'web' ? handleWebMicPressIn : undefined}
        micLabelOverride={micLabelOverride}
        onExit={handleInterviewSignOut}
        micInputLevel={interviewMicInputLevel}
        showMicInputMeter={interviewMicMeterActive}
        micSessionRecovering={micSessionRecovering}
        micReconnectPrompt={
          micNeedsReconnect
            ? {
                message: 'Your microphone disconnected. Tap to reconnect.',
                onReconnect: () => {
                  setMicNeedsReconnect(false);
                  void reinitializeMicrophoneSession().then((ok) => {
                    if (!ok) setMicNeedsReconnect(true);
                  });
                },
              }
            : null
        }
        lateStartRecordingCue={lateStartIdleCueVisible}
      />
    </View>
  );
}
