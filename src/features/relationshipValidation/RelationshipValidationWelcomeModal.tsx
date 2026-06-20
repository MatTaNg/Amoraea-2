import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  SafeAreaView,
} from 'react-native';
import { FlameOrb } from '@app/screens/FlameOrb';
import { authStyles } from '@app/screens/authStyles';
import { loadPsychometricsWebFontsOnce } from '@features/psychometrics/psychometricsTheme';
import { useAssessmentScrollContent } from '@utilities/assessmentMobileLayout';

type Props = {
  visible: boolean;
  onContinue: () => void;
};

export function RelationshipValidationWelcomeModal({ visible, onContinue }: Props) {
  const scrollContentStyle = useAssessmentScrollContent({ alignItems: 'center' });

  useEffect(() => {
    if (visible) loadPsychometricsWebFontsOnce();
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[scrollContentStyle, styles.scrollContent]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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

          <Pressable
            onPress={onContinue}
            style={({ pressed }) => [authStyles.primaryButton, styles.cta, pressed && { opacity: 0.9 }]}
          >
            <Text style={authStyles.primaryButtonText}>I understand — let&apos;s begin</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#05060D',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#05060D',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  flameWrap: {
    height: 88,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
    width: '100%',
  },
  flameScale: {
    transform: [{ scale: 0.42 }],
  },
  title: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 24,
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
    marginBottom: 24,
  },
  callout: {
    backgroundColor: 'rgba(91, 168, 232, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(91, 168, 232, 0.25)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    width: '100%',
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
  cta: {
    marginTop: 8,
    marginBottom: 8,
  },
});
