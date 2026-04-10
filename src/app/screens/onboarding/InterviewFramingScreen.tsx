import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { FlameOrb } from '@app/screens/FlameOrb';
import { authStyles } from '@app/screens/authStyles';
import { Ionicons } from '@expo/vector-icons';
import { AsyncStorageService } from '@utilities/storage/AsyncStorageService';

const storageService = new AsyncStorageService();

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap';

const BG = '#05060D';
const SURFACE = 'rgba(13,17,32,0.92)';
const BORDER = 'rgba(82,142,220,0.2)';
const FLAME_MID = '#5BA8E8';
const TEXT_PRIMARY = '#E8F0F8';
const TEXT_SECONDARY = '#7A9ABE';
const DOT = '#5BA8E8';

const WHAT_TO_EXPECT = [
  'The interview takes approximately 20–30 minutes — three scenarios and two personal questions.',
  'This is a conversation, not a test. There are no right or wrong answers.',
  'We recommend you find a private area for this interview so you are not distracted.',
  'You can stop at any time. Progress is saved if you exit early.',
] as const;

const DATA_PRIVACY = [
  'This conversation will be recorded and processed by AI.',
  'Your voice is analyzed for communication style alongside your words.',
  'Your responses are stored and used to generate your profile and match you with others.',
] as const;

function BulletRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

/**
 * Pre-interview consent and expectations. Required before the first `OnboardingInterview` session.
 * After the user taps "Begin interview", acknowledgment is stored locally so this screen is not used again on cold start.
 * `AriaScreen` skips its legacy intro + consent for `OnboardingInterview` only (this screen replaces them).
 */
export const InterviewFramingScreen: React.FC<{ navigation: any; route: { params: { userId: string } } }> = ({
  navigation,
  route,
}) => {
  const { userId } = route.params;
  const [confirmAge, setConfirmAge] = useState(false);
  const canBegin = confirmAge;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, []);

  return (
    <SafeAreaContainer style={styles.safeBg}>
      <View style={styles.flex}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, authStyles.grainOverlay]} pointerEvents="none" />
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoBlock}>
            <FlameOrb state="idle" size={88} />
          </View>

          <Text style={styles.title}>Before we begin</Text>
          <Text style={styles.subtitle}>A few things to know before your interview starts.</Text>

          <Text style={styles.sectionLabel}>What to expect</Text>
          {WHAT_TO_EXPECT.map((line) => (
            <BulletRow key={line}>{line}</BulletRow>
          ))}

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Data & privacy</Text>
          {DATA_PRIVACY.map((line) => (
            <BulletRow key={line}>{line}</BulletRow>
          ))}

          <View style={styles.consentCard}>
            <Pressable
              style={styles.checkboxRow}
              onPress={() => setConfirmAge((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmAge }}
            >
              <View style={[styles.checkboxBox, confirmAge && styles.checkboxBoxChecked]}>
                {confirmAge ? <Ionicons name="checkmark" size={16} color={BG} /> : null}
              </View>
              <Text style={styles.checkboxLabel}>I confirm I am 18 years of age or older.</Text>
            </Pressable>
          </View>

          <Button
            title="Begin interview"
            onPress={async () => {
              await storageService.setInterviewFramingAcknowledged(userId);
              navigation.replace('OnboardingInterview', { userId });
            }}
            disabled={!canBegin}
            style={styles.beginButton}
          />

        </ScrollView>
      </View>
    </SafeAreaContainer>
  );
};

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_UI = Platform.OS === 'web' ? "'Jost', sans-serif" : undefined;

const styles = StyleSheet.create({
  safeBg: {
    backgroundColor: BG,
    flex: 1,
  },
  flex: {
    flex: 1,
    backgroundColor: BG,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  logoBlock: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 28,
    fontWeight: '300',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: FONT_UI,
    fontSize: 15,
    fontWeight: '300',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  sectionLabel: {
    fontFamily: FONT_UI,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: FLAME_MID,
    marginBottom: 14,
  },
  sectionLabelSpaced: {
    marginTop: 28,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingRight: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DOT,
    marginTop: 8,
    marginRight: 12,
    flexShrink: 0,
  },
  bulletText: {
    fontFamily: FONT_UI,
    flex: 1,
    fontSize: 15,
    fontWeight: '300',
    color: TEXT_PRIMARY,
    lineHeight: 24,
  },
  consentCard: {
    marginTop: 28,
    marginBottom: 24,
    padding: 18,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: FLAME_MID,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxBoxChecked: {
    backgroundColor: FLAME_MID,
    borderColor: FLAME_MID,
  },
  checkboxLabel: {
    fontFamily: FONT_UI,
    flex: 1,
    fontSize: 14,
    fontWeight: '300',
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },
  beginButton: {
    width: '100%',
    alignSelf: 'stretch',
  },
});
