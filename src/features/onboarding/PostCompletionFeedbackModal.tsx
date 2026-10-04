import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveInterviewTopInset } from '@features/aria/utils/interviewOverlayInsets';

import {
  POST_COMPLETION_FATIGUE_ONLY_OPTIONS,
  POST_COMPLETION_QUESTIONS,
  POST_COMPLETION_SCENARIO_OPTIONS,
  emptyPostCompletionFeedbackDraft,
  choosePostCompletionOption,
  POST_COMPLETION_FEEDBACK_THANKS_BODY,
  POST_COMPLETION_FEEDBACK_THANKS_DONE_LABEL,
  POST_COMPLETION_FEEDBACK_THANKS_TITLE,
  submitPostCompletionFeedback,
  type PostCompletionFeedbackDraft,
  type PostCompletionFeedbackEntryPoint,
  type PostCompletionMultiAnswer,
} from '@features/onboarding/postCompletionFeedback';

const FEEDBACK_STEP_COUNT = 8;

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type PostCompletionFeedbackModalProps = {
  visible: boolean;
  userId: string;
  entryPoint: PostCompletionFeedbackEntryPoint;
  onDismiss: () => void;
  onSubmitted: () => void;
};

function OptionList({
  questionId,
  options,
  answer,
  onChange,
}: {
  questionId: string;
  options: readonly string[];
  answer: PostCompletionMultiAnswer;
  onChange: (next: PostCompletionMultiAnswer) => void;
}) {
  return (
    <View style={styles.optionList}>
      {options.map((option) => {
        const selected = answer.selected[0] === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${questionId} option ${option}`}
            onPress={() =>
              onChange({
                selected: choosePostCompletionOption(answer.selected, option),
                freeform: '',
              })
            }
            style={[styles.optionRow, selected && styles.optionRowSelected]}
          >
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={selected ? '#9CCBFF' : 'rgba(255,255,255,0.55)'}
            />
            <Text style={styles.optionLabel}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScaleRow({
  questionId,
  value,
  onChange,
}: {
  questionId: string;
  value: number | null;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.scaleRow}>
      {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => {
        const active = value === score;
        return (
          <Pressable
            key={score}
            accessibilityRole="button"
            accessibilityLabel={`${questionId} score ${score}`}
            onPress={() => onChange(score)}
            style={[styles.scalePill, active && styles.scalePillActive]}
          >
            <Text style={[styles.scalePillText, active && styles.scalePillTextActive]}>{score}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PostCompletionFeedbackModal({
  visible,
  userId,
  entryPoint,
  onDismiss,
  onSubmitted,
}: PostCompletionFeedbackModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const edgeGap = Math.max(resolveInterviewTopInset(insets), insets.bottom, 24) + 16;
  const [draft, setDraft] = useState<PostCompletionFeedbackDraft>(emptyPostCompletionFeedbackDraft);
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showThanks, setShowThanks] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(emptyPostCompletionFeedbackDraft());
    setStep(0);
    setSending(false);
    setError(null);
    setShowThanks(false);
  }, [visible]);

  const patchMulti = (key: 'fatigue' | 'redundant' | 'unclear', next: PostCompletionMultiAnswer) => {
    setDraft((current) => ({ ...current, [key]: next }));
  };

  const goToNextStep = () => {
    setStep((current) => Math.min(FEEDBACK_STEP_COUNT - 1, current + 1));
  };

  const chooseAndContinue = (
    key: 'fatigue' | 'redundant' | 'unclear',
    next: PostCompletionMultiAnswer,
  ) => {
    patchMulti(key, next);
    if (next.selected.length > 0) goToNextStep();
  };

  const chooseScaleAndContinue = (key: 'trust' | 'difficulty', value: number) => {
    setDraft((current) => ({ ...current, [key]: value }));
    goToNextStep();
  };

  const handleSubmit = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    const result = await submitPostCompletionFeedback({ userId, entryPoint, draft });
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowThanks(true);
  };

  if (!visible) return null;

  const isLastStep = step === FEEDBACK_STEP_COUNT - 1;
  const showsNext = step === 5 || step === 6;
  const progress = (step + 1) / FEEDBACK_STEP_COUNT;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={showThanks ? onSubmitted : onDismiss}
    >
      {showThanks ? (
        <View style={styles.thanksBackdrop}>
          <View style={styles.thanksCard}>
            <Text style={styles.thanksTitle}>{POST_COMPLETION_FEEDBACK_THANKS_TITLE}</Text>
            <Text style={styles.thanksBody}>{POST_COMPLETION_FEEDBACK_THANKS_BODY}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={POST_COMPLETION_FEEDBACK_THANKS_DONE_LABEL}
              onPress={onSubmitted}
              style={[styles.submitButton, styles.thanksDone]}
            >
              <Text style={styles.submitText}>{POST_COMPLETION_FEEDBACK_THANKS_DONE_LABEL}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {showThanks ? null : (
      <View style={[styles.backdrop, { paddingTop: edgeGap, paddingBottom: edgeGap }]}>
        <View style={[styles.card, { maxHeight: Math.max(320, windowHeight - edgeGap * 2) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Interview feedback</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onDismiss}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.72)" />
            </Pressable>
          </View>
          <View style={styles.progressBlock}>
            <Text style={styles.stepLabel}>
              {step + 1} of {FEEDBACK_STEP_COUNT}
            </Text>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Feedback progress"
              accessibilityValue={{ min: 1, max: FEEDBACK_STEP_COUNT, now: step + 1 }}
              style={styles.track}
            >
              <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {step === 0 ? (
              <View style={styles.questionBlock}>
                <Text style={styles.prompt}>{POST_COMPLETION_QUESTIONS.fatigue}</Text>
                <OptionList
                  questionId="fatigue"
                  options={[...POST_COMPLETION_SCENARIO_OPTIONS, ...POST_COMPLETION_FATIGUE_ONLY_OPTIONS]}
                  answer={draft.fatigue}
                  onChange={(next) => chooseAndContinue('fatigue', next)}
                />
              </View>
            ) : null}
            {step === 1 ? (
              <View style={styles.questionBlock}>
                <Text style={styles.prompt}>{POST_COMPLETION_QUESTIONS.redundant}</Text>
                <OptionList
                  questionId="redundant"
                  options={POST_COMPLETION_SCENARIO_OPTIONS}
                  answer={draft.redundant}
                  onChange={(next) => chooseAndContinue('redundant', next)}
                />
              </View>
            ) : null}
            {step === 2 ? (
              <View style={styles.questionBlock}>
                <Text style={styles.prompt}>{POST_COMPLETION_QUESTIONS.trust}</Text>
                <Text style={styles.scaleCaption}>1 = not at all, 10 = completely</Text>
                <ScaleRow
                  questionId="trust"
                  value={draft.trust}
                  onChange={(trust) => chooseScaleAndContinue('trust', trust)}
                />
              </View>
            ) : null}
            {step === 3 ? (
              <View style={styles.questionBlock}>
                <Text style={styles.prompt}>{POST_COMPLETION_QUESTIONS.unclear}</Text>
                <OptionList
                  questionId="unclear"
                  options={POST_COMPLETION_SCENARIO_OPTIONS}
                  answer={draft.unclear}
                  onChange={(next) => chooseAndContinue('unclear', next)}
                />
              </View>
            ) : null}
            {step === 4 ? (
              <View style={styles.questionBlock}>
                <Text style={styles.prompt}>{POST_COMPLETION_QUESTIONS.difficulty}</Text>
                <Text style={styles.scaleCaption}>1 = very easy, 10 = very difficult</Text>
                <ScaleRow
                  questionId="difficulty"
                  value={draft.difficulty}
                  onChange={(difficulty) => chooseScaleAndContinue('difficulty', difficulty)}
                />
              </View>
            ) : null}
            {step === 5 ? (
              <View style={styles.questionBlock}>
                <Text style={styles.prompt}>{POST_COMPLETION_QUESTIONS.missedDimensions}</Text>
                <TextInput
                  value={draft.missedDimensions}
                  onChangeText={(missedDimensions) => setDraft((current) => ({ ...current, missedDimensions }))}
                  placeholder="Optional"
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  accessibilityLabel="missed dimensions"
                  style={styles.textInput}
                  multiline
                />
              </View>
            ) : null}
            {step === 6 ? (
              <View style={styles.questionBlock}>
                <Text style={styles.prompt}>{POST_COMPLETION_QUESTIONS.bugs}</Text>
                <TextInput
                  value={draft.bugs}
                  onChangeText={(bugs) => setDraft((current) => ({ ...current, bugs }))}
                  placeholder="Optional"
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  accessibilityLabel="interview bugs"
                  style={styles.textInput}
                  multiline
                />
              </View>
            ) : null}
            {step === 7 ? (
              <View style={styles.questionBlock}>
                <Text style={styles.prompt}>{POST_COMPLETION_QUESTIONS.anythingElse}</Text>
                <TextInput
                  value={draft.anythingElse}
                  onChangeText={(anythingElse) => setDraft((current) => ({ ...current, anythingElse }))}
                  placeholder="Optional"
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  accessibilityLabel="anything else"
                  style={styles.textInput}
                  multiline
                />
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            {step === 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onDismiss}
                style={styles.skipButton}
              >
                <Text style={styles.skipText}>Cancel</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous question"
                onPress={() => setStep((current) => Math.max(0, current - 1))}
                style={styles.backButton}
              >
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            )}
            <View style={styles.navButtons}>
              {isLastStep ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Submit feedback"
                  onPress={() => void handleSubmit()}
                  disabled={sending}
                  style={[styles.submitButton, sending && { opacity: 0.7 }]}
                >
                  {sending ? (
                    <ActivityIndicator color="#041018" size="small" />
                  ) : (
                    <Text style={styles.submitText}>Submit</Text>
                  )}
                </Pressable>
              ) : null}
              {showsNext ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next question"
                  onPress={goToNextStep}
                  style={styles.submitButton}
                >
                  <Text style={styles.submitText}>Next</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,7,18,0.72)',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thanksBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,7,18,0.72)',
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thanksCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0B1324',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.26)',
    borderRadius: 18,
    paddingTop: 28,
    paddingBottom: 18,
    paddingHorizontal: 22,
  },
  thanksTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    color: '#F8FBFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  thanksBody: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    marginBottom: 22,
  },
  thanksDone: {
    alignSelf: 'stretch',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0B1324',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.26)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  title: {
    flex: 1,
    fontFamily: FONT_DISPLAY,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600',
    color: '#F8FBFF',
    paddingRight: 12,
  },
  closeButton: {
    padding: 6,
  },
  progressBlock: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
  },
  stepLabel: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 8,
  },
  track: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#9CCBFF',
  },
  error: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 18,
    color: '#F0A8A8',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  questionBlock: {
    marginBottom: 18,
  },
  prompt: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: '#F8FBFF',
    marginBottom: 10,
  },
  scaleCaption: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  optionList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  optionRowSelected: {
    borderColor: 'rgba(156,203,255,0.7)',
    backgroundColor: 'rgba(91,168,232,0.12)',
  },
  optionLabel: {
    flex: 1,
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.9)',
  },
  scaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scalePill: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  scalePillActive: {
    backgroundColor: '#9CCBFF',
    borderColor: '#9CCBFF',
  },
  scalePillText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '600',
    color: '#E8F4FF',
  },
  scalePillTextActive: {
    color: '#041018',
  },
  textInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FBFF',
    fontFamily: FONT_BODY,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  skipText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  backText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
  },
  submitButton: {
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CCBFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  submitText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '700',
    color: '#041018',
  },
});
