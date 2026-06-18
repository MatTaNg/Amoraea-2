import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { FlameOrb } from '@app/screens/FlameOrb';
import { authStyles } from '@app/screens/authStyles';
import { loadPsychometricsWebFontsOnce } from '@features/psychometrics/psychometricsTheme';

type Props = {
  visible: boolean;
  onContinue: () => void;
};

/** Footer + button — used to cap scroll area so the CTA stays visible. */
const FOOTER_HEIGHT = 84;

export function RelationshipValidationWelcomeModal({ visible, onContinue }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const cardMaxHeight = Math.round(windowHeight * 0.88);
  const scrollMaxHeight = Math.max(200, cardMaxHeight - FOOTER_HEIGHT);

  useEffect(() => {
    if (visible) loadPsychometricsWebFontsOnce();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { maxHeight: cardMaxHeight }]}>
          <ScrollView
            style={{ maxHeight: scrollMaxHeight }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            bounces={false}
          >
            <View style={styles.flameWrap}>
              <View style={styles.flameScale}>
                <FlameOrb state="idle" minimalGlow />
              </View>
            </View>

            <Text style={styles.title}>Thank you for helping us calibrate Amoraea</Text>
            <Text style={styles.body}>
              You are helping us test a compatibility algorithm that will be used to match real
              people. Your honest, independent answers make this research valuable.
            </Text>

            <View style={styles.callout}>
              <Text style={styles.calloutText}>
                Please do not discuss your answers with your partner until you have both completed
                the assessment. Your independent responses are what make this data valuable.
              </Text>
            </View>

            <Text style={styles.estimate}>
              Pre-assessment: ~5 minutes{'\n'}
              Compatibility assessment: ~15–20 minutes{'\n'}
              Total: about 25 minutes
            </Text>

            <Text style={[styles.body, styles.bodyLast]}>
              When you finish, you will receive a relationship compatibility report and your own
              psychological profile as a thank you.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [authStyles.primaryButton, pressed && { opacity: 0.9 }]}
            >
              <Text style={authStyles.primaryButtonText}>I understand — let&apos;s begin</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 6, 13, 0.92)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#0B0F18',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(82, 142, 220, 0.25)',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82, 142, 220, 0.12)',
    backgroundColor: '#0B0F18',
  },
  flameWrap: {
    height: 88,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  flameScale: {
    transform: [{ scale: 0.42 }],
  },
  title: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 26,
    color: '#E8F0F8',
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 15,
    lineHeight: 22,
    color: '#95A8BD',
    textAlign: 'center',
    marginBottom: 16,
  },
  bodyLast: {
    marginBottom: 0,
  },
  callout: {
    backgroundColor: 'rgba(91, 168, 232, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(91, 168, 232, 0.25)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  calloutText: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 14,
    lineHeight: 21,
    color: '#C8E4FF',
    textAlign: 'center',
  },
  estimate: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 14,
    lineHeight: 22,
    color: '#E8F0F8',
    textAlign: 'center',
    marginBottom: 16,
  },
});
