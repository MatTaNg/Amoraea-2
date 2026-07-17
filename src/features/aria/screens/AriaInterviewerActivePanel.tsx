import React from 'react';
import { View } from 'react-native';

import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import { UserInterviewLayout, type ActiveScenario } from '@app/screens/UserInterviewLayout';
import type { FlameState } from '@app/screens/FlameOrb';

export function AriaInterviewerActivePanel({
  audioRecorderIsRecording,
  audioRecorderInputMeterLevel,
  reinitializeMicrophoneSession,
  voiceState,
  interviewerOutputActive,
  interviewUiPhase,
  referenceCardScenario,
  referenceCardPrompt,
  ttsPlaybackReliabilityNotice,
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
  handleInterviewSignOut,
  preInitMeterLevel,
  micSessionRecovering,
  micNeedsReconnect,
  setMicNeedsReconnect,
  lateStartIdleCueVisible,
}: {
  audioRecorderIsRecording: boolean;
  audioRecorderInputMeterLevel: number;
  reinitializeMicrophoneSession: () => Promise<boolean>;
  voiceState: VoiceState;
  interviewerOutputActive: boolean;
  interviewUiPhase: string;
  referenceCardScenario: ActiveScenario | null;
  referenceCardPrompt: string | null;
  ttsPlaybackReliabilityNotice: string | null;
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
  handleInterviewSignOut: () => void;
  preInitMeterLevel: number;
  micSessionRecovering: boolean;
  micNeedsReconnect: boolean;
  setMicNeedsReconnect: (value: boolean) => void;
  lateStartIdleCueVisible: boolean;
}): React.ReactElement {
  const flameState: FlameState = audioRecorderIsRecording ? 'recording' : voiceState;

  const interviewMicMeterActive = audioRecorderIsRecording || voiceState === 'recording';

  const interviewMicInputLevel = interviewMicMeterActive
    ? Math.max(audioRecorderInputMeterLevel, preInitMeterLevel)
    : 0;

  const micLabelOverride = useTapMicUi
    ? audioRecorderIsRecording
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
        sessionAudioHealthNotice={sessionAudioHealthNotice}
        conversationErrorNotice={conversationErrorNotice}
        micPermissionDenied={micPermissionDenied}
        isWaiting={isWaiting && voiceState === 'processing' && !interviewerOutputActive}
        onPressStart={handlePressStart}
        onPressEnd={handlePressEnd}
        voiceState={audioRecorderIsRecording ? 'recording' : voiceState}
        interviewerOutputActive={interviewerOutputActive}
        micError={micError}
        micWarning={micWarning}
        inputDisabled={inputDisabled}
        micToggleMode={useTapMicUi}
        onMicPress={useTapMicUi ? handleNativeOrWhisperMicPress : undefined}
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
