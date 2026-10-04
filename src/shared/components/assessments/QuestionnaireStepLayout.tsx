import React, { useEffect } from 'react';
import { ActivityIndicator, View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  loadPsychometricsWebFontsOnce,
  PSYCHOMETRICS_ACCENT,
  PSYCHOMETRICS_BG,
  PSYCHOMETRICS_FONT_BODY,
  PSYCHOMETRICS_FONT_DISPLAY,
} from '@features/psychometrics/psychometricsTheme';
import { useNarrowAssessmentViewport } from '@utilities/assessmentMobileLayout';

const MUTED = '#8EA6C4';
const QUESTION = '#F4F7FB';
const OPTION_TEXT = '#E7EEF6';

const DISPLAY_FONT =
  PSYCHOMETRICS_FONT_DISPLAY ?? (Platform.OS === 'ios' ? 'Georgia' : Platform.OS === 'android' ? 'serif' : undefined);

export function questionnaireScalePrompt(labels: Record<string, string>): string {
  const blob = Object.values(labels).join(' ').toLowerCase();
  if (blob.includes('comfortable')) return 'How comfortable is this for you?';
  if (blob.includes('like me')) return 'How much is this like you?';
  if (blob.includes('likely')) return 'How likely is this for you?';
  if (blob.includes('true') || blob.includes('agree') || blob.includes('disagree')) {
    return 'How true is this for you?';
  }
  if (
    blob.includes('never') ||
    blob.includes('rarely') ||
    blob.includes('sometimes') ||
    blob.includes('often') ||
    blob.includes('always')
  ) {
    return 'How often is this true for you?';
  }
  return 'How true is this for you?';
}

type LayoutProps = {
  title: string;
  current: number;
  total: number;
  onBack: () => void;
  backDisabled?: boolean;
  /** Spoken name for the top-left arrow. */
  headerBackLabel?: string;
  /** Bottom-left control that steps to the previous question. */
  onPreviousQuestion?: () => void;
  previousQuestionDisabled?: boolean;
  prompt?: string | null;
  preamble?: string | null;
  saving?: boolean;
  children: React.ReactNode;
};

export function QuestionnaireStepLayout({
  title,
  current,
  total,
  onBack,
  backDisabled,
  headerBackLabel = 'Go back',
  onPreviousQuestion,
  previousQuestionDisabled,
  prompt,
  preamble,
  saving,
  children,
}: LayoutProps) {
  useEffect(() => {
    loadPsychometricsWebFontsOnce();
  }, []);

  const progress = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
  const headerTitle = title.replace(/\s+assessment$/i, '').trim();

  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={headerBackLabel}
            onPress={onBack}
            disabled={backDisabled}
            hitSlop={12}
            style={styles.backHit}
          >
            <Ionicons name="chevron-back" size={22} color="#D5E2F2" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {headerTitle.toUpperCase()} · {current} OF {total}
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {preamble ? <Text style={styles.preamble}>{preamble}</Text> : null}
          {prompt ? <Text style={styles.prompt}>{prompt}</Text> : null}
          {children}
          {onPreviousQuestion ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous question"
              onPress={onPreviousQuestion}
              disabled={previousQuestionDisabled || backDisabled}
              style={styles.previousButton}
            >
              <Text
                style={[
                  styles.previousText,
                  (previousQuestionDisabled || backDisabled) && styles.previousTextDisabled,
                ]}
              >
                Back
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
        {saving ? <ActivityIndicator size="small" color="#5BA8E8" style={styles.saving} /> : null}
      </View>
    </View>
  );
}

export function QuestionnaireQuestion({ children }: { children: string }) {
  const narrow = useNarrowAssessmentViewport();
  return <Text style={[styles.question, narrow && styles.questionNarrow]}>{children}</Text>;
}

export function QuestionnaireOption({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <Text style={styles.optionText}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={18} color={PSYCHOMETRICS_ACCENT} /> : <View style={styles.checkSlot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PSYCHOMETRICS_BG,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  backHit: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.6,
    color: MUTED,
    textAlign: 'center',
  },
  track: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 22,
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: PSYCHOMETRICS_ACCENT,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 24,
  },
  preamble: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: MUTED,
    marginBottom: 18,
  },
  prompt: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: MUTED,
    marginBottom: 14,
  },
  question: {
    fontFamily: DISPLAY_FONT,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '500',
    color: QUESTION,
    marginBottom: 22,
  },
  questionNarrow: {
    fontSize: 28,
    lineHeight: 36,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(156, 180, 216, 0.28)',
    borderRadius: 16,
    backgroundColor: '#101624',
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  optionSelected: {
    borderColor: PSYCHOMETRICS_ACCENT,
    backgroundColor: '#122033',
  },
  optionText: {
    flex: 1,
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 16,
    lineHeight: 22,
    color: OPTION_TEXT,
  },
  checkSlot: {
    width: 18,
    height: 18,
  },
  footer: {
    fontFamily: DISPLAY_FONT,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
    color: '#7E97B8',
    textAlign: 'center',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 18,
  },
  previousButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  previousText: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
  },
  previousTextDisabled: {
    opacity: 0.35,
  },
  saving: {
    position: 'absolute',
    right: 16,
    bottom: 18,
  },
});
