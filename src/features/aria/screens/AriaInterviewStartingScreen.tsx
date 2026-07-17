import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';
import { interviewOverlayTop } from '@features/aria/utils/interviewOverlayInsets';
import { FlameOrb } from '@app/screens/FlameOrb';
import { INTRO_FLAME_ORB_SIZE } from '@app/screens/flameOrbLogo';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';

/**
 * Pre-interview loading / mic-permission screen.
 * Browser Tap-to-begin overlays have been removed (native apps do not need autoplay unlock).
 */
export function AriaInterviewStartingScreen({
  adminTopBar,
  micError,
  micPermissionDenied,
  onSignOut,
  onRetryMic,
}: {
  adminTopBar: React.ReactNode;
  micError: string | null;
  micPermissionDenied: boolean;
  onSignOut: () => void;
  onRetryMic: () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const overlayTop = interviewOverlayTop(insets);
  const showMicRetry = !!micError || micPermissionDenied;

  return (
    <SafeAreaContainer
      edges={['bottom', 'left', 'right']}
      style={{ position: 'relative', backgroundColor: '#05060D' }}
    >
      {adminTopBar}
      <Pressable
        style={[styles.introLogoutButton, { top: overlayTop }]}
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
        <FlameOrb state="idle" size={INTRO_FLAME_ORB_SIZE} />
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
    </SafeAreaContainer>
  );
}
