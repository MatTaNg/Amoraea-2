import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';
import { FlameOrb } from '@app/screens/FlameOrb';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';

export function AriaInterviewStartingScreen({
  adminTopBar,
  micError,
  micPermissionDenied,
  showMobileWebTapToBegin,
  showDesktopAwaitingStartOverlay,
  onSignOut,
  onRetryMic,
  onMobileWebTapToBegin,
  onDesktopBeginInterview,
}: {
  adminTopBar: React.ReactNode;
  micError: string | null;
  micPermissionDenied: boolean;
  showMobileWebTapToBegin: boolean;
  showDesktopAwaitingStartOverlay: boolean;
  onSignOut: () => void;
  onRetryMic: () => void;
  onMobileWebTapToBegin: () => void;
  onDesktopBeginInterview: () => void;
}): React.ReactElement {
  const showMicRetry = !!micError || micPermissionDenied;

  return (
    <SafeAreaContainer style={{ position: 'relative', backgroundColor: '#05060D' }}>
      {adminTopBar}
      <Pressable
        style={styles.introLogoutButton}
        onPress={onSignOut}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Ionicons name="log-out-outline" size={16} color="#5BA8E8" />
        <Text style={styles.introLogoutButtonText}>Log out</Text>
      </Pressable>
      <View
        style={[
          styles.container,
          {
            flex: 1,
            minHeight: '100%',
            backgroundColor: '#05060D',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingVertical: 32,
          },
        ]}
      >
        <FlameOrb state="idle" size={72} />
        <Text
          style={[
            styles.introNote,
            { marginTop: 24, textAlign: 'center', color: '#7A9ABE', letterSpacing: 2, textTransform: 'uppercase' },
          ]}
        >
          {showMicRetry ? 'Microphone needed' : 'Starting interview'}
        </Text>
        {!showMicRetry ? (
          <Text style={[styles.introHint, { marginTop: 12, textAlign: 'center', maxWidth: 320 }]}>
            Requesting microphone access and loading your session…
          </Text>
        ) : null}
        {micError ? (
          <View style={[styles.micErrorBlock, { alignSelf: 'stretch', maxWidth: 400, marginTop: 16 }]}>
            <Text style={styles.micErrorText}>{micError}</Text>
          </View>
        ) : null}
        {showMicRetry ? (
          <Button
            title="Try again"
            onPress={onRetryMic}
            style={StyleSheet.flatten([
              styles.introButton,
              { marginTop: 24, alignSelf: 'stretch' as const, maxWidth: 360 },
            ])}
          />
        ) : null}
      </View>
      {showMobileWebTapToBegin ? (
        <Pressable
          style={styles.mobileWebTapToBeginOverlay}
          onPress={onMobileWebTapToBegin}
          accessibilityRole="button"
          accessibilityLabel="Tap the screen to begin"
        >
          <Text style={styles.mobileWebTapToBeginTitle}>Tap the screen to begin</Text>
          <Text style={styles.mobileWebTapToBeginSubtitle}>
            One quick tap unlocks audio for the interviewer on this device.
          </Text>
        </Pressable>
      ) : null}
      {showDesktopAwaitingStartOverlay ? (
        <Pressable
          style={styles.mobileWebTapToBeginOverlay}
          accessibilityRole="button"
          accessibilityLabel="Click to begin the interview audio"
          onPress={onDesktopBeginInterview}
        >
          <Text style={styles.mobileWebTapToBeginTitle}>Tap to begin</Text>
          <Text style={styles.mobileWebTapToBeginSubtitle}>
            Tap once to unlock audio for the interviewer (required by your browser after opening this page).
          </Text>
        </Pressable>
      ) : null}
    </SafeAreaContainer>
  );
}
