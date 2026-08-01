import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';
import { interviewOverlayTop } from '@features/aria/utils/interviewOverlayInsets';
import { FlameOrb } from '@app/screens/FlameOrb';
import { INTRO_FLAME_ORB_SIZE } from '@app/screens/flameOrbLogo';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';

const WHAT_TO_EXPECT_ITEMS = [
  'The interview takes approximately 20 minutes — three scenarios and two short personal questions.',
  'We recommend you find a private area for this interview so you are not distracted.',
  'You can stop at any time. Progress is saved from the last completed scenario if you exit early.',
];

const DATA_PRIVACY_ITEMS = [
  'This conversation will be recorded and processed by AI.',
  'Your voice is analyzed for communication style alongside your words.',
  'Your responses are stored and used to generate your profile and match you with others.',
];

const PRE_INTERVIEW_TIPS = [
  { icon: 'headset-outline' as const, label: 'Use headphones if possible' },
  { icon: 'volume-mute-outline' as const, label: 'Find a quiet space' },
];

export function AriaInterviewIntroScreen({
  adminTopBar,
  fromValidationTrack,
  micError,
  micWarning,
  preInterviewConsentAge,
  preInterviewConsentData,
  preInterviewReady,
  sessionPrepPending,
  interviewStartInFlight,
  interviewAttemptBootstrap,
  userId,
  isAdmin,
  onBackToValidationReport,
  onSignOut,
  onToggleConsentAge,
  onToggleConsentData,
  onBeginInterview,
}: {
  adminTopBar: React.ReactNode;
  fromValidationTrack: boolean;
  micError: string | null;
  micWarning: string | null;
  preInterviewConsentAge: boolean;
  preInterviewConsentData: boolean;
  preInterviewReady: boolean;
  sessionPrepPending?: boolean;
  interviewStartInFlight: boolean;
  interviewAttemptBootstrap: 'idle' | 'loading' | 'ready' | 'failed';
  userId: string;
  isAdmin: boolean;
  onBackToValidationReport: () => void;
  onSignOut: () => void;
  onToggleConsentAge: () => void;
  onToggleConsentData: () => void;
  onBeginInterview: () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const overlayTop = interviewOverlayTop(insets);

  return (
    <SafeAreaContainer
      edges={['bottom', 'left', 'right']}
      style={{ position: 'relative', flex: 1, backgroundColor: '#05060D' }}
    >
      {adminTopBar}
      {fromValidationTrack ? (
        <Pressable
          style={[styles.introBackButton, { top: overlayTop }]}
          onPress={onBackToValidationReport}
          accessibilityRole="button"
          accessibilityLabel="Back to your results"
        >
          <Ionicons name="chevron-back" size={16} color="#5BA8E8" />
          <Text style={styles.introLogoutButtonText}>Your results</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={[styles.introLogoutButton, { top: overlayTop }]}
        onPress={onSignOut}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Ionicons name="log-out-outline" size={16} color="#5BA8E8" />
        <Text style={styles.introLogoutButtonText}>Log out</Text>
      </Pressable>
      <ScrollView
        style={[styles.container, { backgroundColor: '#05060D' }]}
        contentContainerStyle={[
          styles.preInterviewScrollContent,
          // Top edge is intentionally open for absolute logout; pad content below status bar + chrome.
          { paddingTop: overlayTop + 48 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.preInterviewLogoWrap}>
          <FlameOrb state="idle" size={INTRO_FLAME_ORB_SIZE} minimalGlow />
        </View>
        <Text style={styles.preInterviewMainTitle}>Before you begin</Text>

        <Text style={styles.preInterviewSectionHeading}>What to expect</Text>
        {WHAT_TO_EXPECT_ITEMS.map((line) => (
          <View key={line} style={styles.preInterviewBulletRow}>
            <View style={styles.preInterviewBulletDot} />
            <Text style={styles.preInterviewBulletText}>{line}</Text>
          </View>
        ))}

        <View style={styles.preInterviewTipsBlock}>
          {PRE_INTERVIEW_TIPS.map((tip) => (
            <View key={tip.label} style={styles.preInterviewTipRow}>
              <Ionicons name={tip.icon} size={28} color="#5BA8E8" style={styles.preInterviewTipIcon} />
              <Text style={styles.preInterviewTipLabel}>{tip.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.preInterviewSectionHeading, styles.preInterviewSectionHeadingSpaced]}>Data & privacy</Text>
        {DATA_PRIVACY_ITEMS.map((line) => (
          <View key={line} style={styles.preInterviewBulletRow}>
            <View style={styles.preInterviewBulletDot} />
            <Text style={styles.preInterviewBulletText}>{line}</Text>
          </View>
        ))}

        <View style={styles.preInterviewConsentCard}>
          <Pressable
            style={styles.preInterviewCheckboxRow}
            onPress={onToggleConsentAge}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: preInterviewConsentAge }}
          >
            <View
              style={[
                styles.preInterviewCheckboxBox,
                preInterviewConsentAge && styles.preInterviewCheckboxBoxChecked,
              ]}
            >
              {preInterviewConsentAge ? <Ionicons name="checkmark" size={18} color="#EEF6FF" /> : null}
            </View>
            <Text style={styles.preInterviewCheckboxLabel}>I confirm I am 18 years of age or older.</Text>
          </Pressable>
          <Pressable
            style={styles.preInterviewCheckboxRow}
            onPress={onToggleConsentData}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: preInterviewConsentData }}
          >
            <View
              style={[
                styles.preInterviewCheckboxBox,
                preInterviewConsentData && styles.preInterviewCheckboxBoxChecked,
              ]}
            >
              {preInterviewConsentData ? <Ionicons name="checkmark" size={18} color="#EEF6FF" /> : null}
            </View>
            <Text style={styles.preInterviewCheckboxLabel}>
              I understand and agree to the recording, processing, and use of my interview as described in Data & privacy
              above.
            </Text>
          </Pressable>
        </View>

        {micError ? (
          <View style={styles.micErrorBlock}>
            <Text style={styles.micErrorText}>{micError}</Text>
          </View>
        ) : null}
        {micWarning ? (
          <View style={styles.micWarningBlock}>
            <Text style={styles.micWarningText}>{micWarning}</Text>
          </View>
        ) : null}
        {userId && !isAdmin && interviewAttemptBootstrap === 'failed' ? (
          <View style={[styles.micErrorBlock, { marginTop: 12 }]}>
            <Text style={styles.micErrorText}>
              We could not start your interview session. Check your connection and refresh the page.
            </Text>
          </View>
        ) : null}

        <Button
          title={
            interviewStartInFlight
              ? 'Starting…'
              : sessionPrepPending
                ? 'Preparing session…'
                : interviewAttemptBootstrap === 'failed' && userId && !isAdmin
                  ? 'Session unavailable'
                  : 'Begin interview'
          }
          onPress={onBeginInterview}
          disabled={!preInterviewReady || interviewStartInFlight}
          style={styles.preInterviewBeginButton}
        />
      </ScrollView>
    </SafeAreaContainer>
  );
}
