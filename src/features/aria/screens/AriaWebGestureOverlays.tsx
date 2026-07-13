import React from 'react';
import { Pressable, Text } from 'react-native';

import type { WebActiveGestureOverlayKind } from '@features/aria/webInterviewGestureOverlay';
import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';
import { webSpeechShouldDeferToUserGesture } from '@features/aria/utils/webSpeechDeferPolicy';

export function AriaWebGestureOverlays({
  overlayKind,
  resumeWelcomeOffersTts,
  onPendingTtsPress,
  onTabRestorePressIn,
  onTabRestorePress,
  onResumeWelcomePressIn,
  onResumeWelcomePress,
}: {
  overlayKind: WebActiveGestureOverlayKind;
  resumeWelcomeOffersTts: boolean;
  onPendingTtsPress: () => void;
  onTabRestorePressIn: () => void;
  onTabRestorePress: () => void;
  onResumeWelcomePressIn: () => void;
  onResumeWelcomePress: () => void;
}): React.ReactElement {
  return (
    <>
      {overlayKind === 'pending_tts' ? (
        <Pressable
          style={styles.mobileWebTapToBeginOverlay}
          onPress={onPendingTtsPress}
          accessibilityRole="button"
          accessibilityLabel={
            webSpeechShouldDeferToUserGesture()
              ? 'Tap to play interviewer audio'
              : 'Click to play interviewer audio'
          }
        >
          <Text style={styles.mobileWebTapToBeginTitle}>
            {webSpeechShouldDeferToUserGesture() ? 'Tap to play audio' : 'Click to play audio'}
          </Text>
          <Text style={styles.mobileWebTapToBeginSubtitle}>
            {webSpeechShouldDeferToUserGesture()
              ? 'Your browser needs one tap to play the next line after you spoke.'
              : "When you're ready, click anywhere to start!"}
          </Text>
        </Pressable>
      ) : null}
      {overlayKind === 'tab_restore' ? (
        <Pressable
          style={styles.mobileWebTapToBeginOverlay}
          onPressIn={onTabRestorePressIn}
          onPress={onTabRestorePress}
          accessibilityRole="button"
          accessibilityLabel="Tap to continue"
        >
          <Text style={styles.mobileWebTapToBeginTitle}>Tap to continue</Text>
          <Text style={styles.mobileWebTapToBeginSubtitle}>
            Your browser paused interviewer audio when you switched away. Tap to continue where it left off.
          </Text>
        </Pressable>
      ) : null}
      {overlayKind === 'resume_welcome' ? (
        <Pressable
          style={styles.mobileWebTapToBeginOverlay}
          onPressIn={onResumeWelcomePressIn}
          onPress={onResumeWelcomePress}
          accessibilityRole="button"
          accessibilityLabel={
            resumeWelcomeOffersTts ? 'Tap to play welcome message' : 'Tap to continue interview'
          }
        >
          <Text style={styles.mobileWebTapToBeginTitle}>
            {resumeWelcomeOffersTts ? 'Tap to play' : 'Tap to continue'}
          </Text>
          <Text style={styles.mobileWebTapToBeginSubtitle}>
            {resumeWelcomeOffersTts
              ? 'Your browser needs a tap to resume interviewer audio after loading your saved session.'
              : 'Your browser needs a tap to unlock audio and finish any quick prompts before you continue.'}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}
