import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@data/supabase/client';
import { profilesRepo } from '@data/repos/profilesRepo';

interface Props {
  visible: boolean;
  userId: string;
  onComplete: () => void;
}

type Question = 'referral' | 'occupation' | 'seriousness' | 'duration' | 'dating_status' | 'spend';

const TOTAL_QUESTIONS = 6;

const QUESTION_ORDER: Question[] = [
  'referral',
  'occupation',
  'seriousness',
  'duration',
  'dating_status',
  'spend',
];

function MarketResearchTextField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(focusInput, Platform.OS === 'web' ? 50 : 0);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const shellProps =
    Platform.OS === 'web'
      ? ({
          onMouseDown: (event: { stopPropagation?: () => void }) => {
            event.stopPropagation?.();
            focusInput();
          },
        } as const)
      : {};

  return (
    <View
      style={[
        styles.textInputShell,
        focused && styles.textInputShellFocused,
        Platform.OS === 'web' ? styles.textInputShellWeb : null,
      ]}
      {...shellProps}
    >
      <TextInput
        ref={inputRef}
        style={[styles.textInput, Platform.OS === 'web' ? styles.textInputWeb : null]}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        value={value}
        onChangeText={onChangeText}
        autoFocus={Platform.OS !== 'web' ? autoFocus : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPressIn={(event) => event.stopPropagation?.()}
        underlineColorAndroid="transparent"
        accessibilityLabel={placeholder}
      />
    </View>
  );
}

export function MarketResearchModal({ visible, userId, onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [referralSource, setReferralSource] = useState<string | null>(null);
  const [referralOther, setReferralOther] = useState('');
  const [occupation, setOccupation] = useState('');
  const [seriousness, setSeriousness] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [datingStatus, setDatingStatus] = useState<string | null>(null);
  const [spend, setSpend] = useState<string | null>(null);
  const [spendContext, setSpendContext] = useState('');
  const [saving, setSaving] = useState(false);

  const currentQuestion = QUESTION_ORDER[currentIndex];

  function getCurrentValue(): string | null {
    switch (currentQuestion) {
      case 'referral':
        return referralSource;
      case 'occupation':
        return occupation.trim() ? occupation.trim() : null;
      case 'seriousness':
        return seriousness;
      case 'duration':
        return duration;
      case 'dating_status':
        return datingStatus;
      case 'spend':
        return spend;
    }
  }

  function isCurrentComplete(): boolean {
    const value = getCurrentValue();
    if (!value) return false;
    if (currentQuestion === 'referral' && value === 'Other') {
      return referralOther.trim().length > 0;
    }
    if (currentQuestion === 'occupation') {
      return occupation.trim().length > 0;
    }
    return true;
  }

  function handleNext() {
    if (!isCurrentComplete()) return;
    if (currentIndex < TOTAL_QUESTIONS - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      void handleSubmit();
    }
  }

  function handleBack() {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }

  function showSpendContextForValue(spendValue: string | null): boolean {
    return spendValue !== null && spendValue !== '0' && spendValue !== '1 - 100';
  }

  function showSpendContext(): boolean {
    return showSpendContextForValue(spend);
  }

  function stepNeedsManualAdvance(selectedValue?: string): boolean {
    if (currentQuestion === 'occupation') return true;
    if (currentQuestion === 'referral') {
      // Use the incoming choice when auto-advancing — referralSource state is still stale here.
      const effective = selectedValue ?? referralSource;
      return effective === 'Other';
    }
    if (currentQuestion === 'spend') {
      const effective = selectedValue ?? spend;
      return showSpendContextForValue(effective);
    }
    return false;
  }

  function needsManualAdvance(): boolean {
    return stepNeedsManualAdvance();
  }

  /** Auto-advance after a choice unless the step needs manual Continue (free text or conditional input). */
  function handleChoiceSelect(value: string, apply: (next: string) => void) {
    apply(value);
    if (stepNeedsManualAdvance(value)) return;

    if (currentIndex < TOTAL_QUESTIONS - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      void handleSubmit({ spend: value });
    }
  }

  async function handleSubmit(overrides?: { spend?: string | null }) {
    const resolvedSpend = overrides?.spend ?? spend;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          market_research_completed_at: new Date().toISOString(),
          market_research_referral_source: referralSource,
          market_research_referral_other: referralSource === 'Other' ? referralOther.trim() : null,
          market_research_relationship_seriousness: seriousness,
          market_research_search_duration: duration,
          market_research_dating_status: datingStatus,
          market_research_max_spend: resolvedSpend,
          market_research_spend_context: showSpendContextForValue(resolvedSpend)
            ? spendContext.trim() || null
            : null,
        })
        .eq('id', userId);

      if (error) throw error;

      const occupationTrimmed = occupation.trim();
      if (occupationTrimmed) {
        const profileResult = await profilesRepo.updateProfile(userId, {
          occupation: occupationTrimmed,
        });
        if (!profileResult.success) throw profileResult.error;
      }

      onComplete();
    } catch (err) {
      console.error('[MarketResearch] save failed:', err);
      Alert.alert('Something went wrong', 'We could not save your responses. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const isLastQuestion = currentIndex === TOTAL_QUESTIONS - 1;

  const card = (
    <View style={[styles.card, Platform.OS === 'web' ? styles.cardWeb : null]}>
      <Text style={styles.title}>Let's get to know you first</Text>

      <View style={styles.dotsRow}>
        {QUESTION_ORDER.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex && styles.dotActive,
              i < currentIndex && styles.dotComplete,
            ]}
          />
        ))}
      </View>

      <View style={styles.body}>
            {currentQuestion === 'referral' && (
              <View>
                <Text style={styles.questionText}>How did you hear about us?</Text>
                {(
                  [
                    { value: 'Facebook group', label: 'Facebook group' },
                    { value: 'Friend', label: 'Friend' },
                    { value: 'One of our events', label: 'One of our events' },
                    { value: 'Other', label: 'Other' },
                  ] as const
                ).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, referralSource === option.value && styles.optionSelected]}
                    onPress={() => handleChoiceSelect(option.value, setReferralSource)}
                  >
                    <View
                      style={[styles.radio, referralSource === option.value && styles.radioSelected]}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        referralSource === option.value && styles.optionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                {referralSource === 'Other' ? (
                  <MarketResearchTextField
                    key="referral-other"
                    placeholder="Please specify..."
                    value={referralOther}
                    onChangeText={setReferralOther}
                    autoFocus
                  />
                ) : null}
              </View>
            )}

            {currentQuestion === 'occupation' && (
              <View>
                <Text style={styles.questionText}>What is your occupation?</Text>
                <MarketResearchTextField
                  key="occupation"
                  placeholder="e.g. Software engineer, teacher, student..."
                  value={occupation}
                  onChangeText={setOccupation}
                  autoFocus
                />
              </View>
            )}

            {currentQuestion === 'seriousness' && (
              <View>
                <Text style={styles.questionText}>
                  How seriously are you looking for a relationship right now?
                </Text>
                {(
                  [
                    {
                      value: 'Very seriously',
                      label: 'Very seriously',
                      sub: 'This is a priority in my life',
                    },
                    {
                      value: 'Seriously',
                      label: 'Seriously',
                      sub: "But I'm not in a rush",
                    },
                    {
                      value: 'Somewhat',
                      label: 'Somewhat',
                      sub: "I'm open to it but not focused on it",
                    },
                    {
                      value: 'Mostly curious',
                      label: "I'm mostly curious what this is about",
                      sub: null,
                    },
                  ] as const
                ).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, seriousness === option.value && styles.optionSelected]}
                    onPress={() => handleChoiceSelect(option.value, setSeriousness)}
                  >
                    <View
                      style={[styles.radio, seriousness === option.value && styles.radioSelected]}
                    />
                    <View style={styles.optionLabelBlock}>
                      <Text
                        style={[
                          styles.optionText,
                          seriousness === option.value && styles.optionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {option.sub ? <Text style={styles.optionSub}>{option.sub}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {currentQuestion === 'duration' && (
              <View>
                <Text style={styles.questionText}>
                  How long have you been actively looking for a serious relationship?
                </Text>
                {(
                  [
                    { value: 'Less than 6 months', label: 'Less than 6 months' },
                    { value: '6 months to 1 year', label: '6 months to 1 year' },
                    { value: '1 to 3 years', label: '1 to 3 years' },
                    { value: 'More than 3 years', label: 'More than 3 years' },
                    {
                      value: "I'm not sure I've been looking seriously",
                      label: "I'm not sure I've been looking seriously",
                    },
                  ] as const
                ).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, duration === option.value && styles.optionSelected]}
                    onPress={() => handleChoiceSelect(option.value, setDuration)}
                  >
                    <View style={[styles.radio, duration === option.value && styles.radioSelected]} />
                    <Text
                      style={[
                        styles.optionText,
                        duration === option.value && styles.optionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {currentQuestion === 'dating_status' && (
              <View>
                <Text style={styles.questionText}>
                  How would you describe where you are with dating right now?
                </Text>
                {(
                  [
                    {
                      value: 'Doing fine',
                      label: "I'm doing fine, just open to something better",
                    },
                    {
                      value: 'Struggling but hopeful',
                      label: 'I am struggling but hopeful',
                    },
                    {
                      value: 'Draining',
                      label: "It's draining, I keep hitting the same walls",
                    },
                    {
                      value: 'Nearly given up',
                      label: "I've nearly given up",
                    },
                  ] as const
                ).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, datingStatus === option.value && styles.optionSelected]}
                    onPress={() => handleChoiceSelect(option.value, setDatingStatus)}
                  >
                    <View
                      style={[styles.radio, datingStatus === option.value && styles.radioSelected]}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        datingStatus === option.value && styles.optionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {currentQuestion === 'spend' && (
              <View>
                <Text style={styles.questionText}>
                  What is the most you've spent on coaching or a self-development workshop?
                </Text>
                {(
                  [
                    { value: '0', label: '$0' },
                    { value: '1 - 100', label: '$1 – $100' },
                    { value: '101 - 500', label: '$101 – $500' },
                    { value: '501 - 1,000', label: '$501 – $1,000' },
                    { value: '1,001 - 3,000', label: '$1,001 – $3,000' },
                    { value: '3,001 - 5,000', label: '$3,001 – $5,000' },
                    { value: '5,001 - 10,000', label: '$5,001 – $10,000' },
                    { value: '10,000+', label: '$10,000+' },
                  ] as const
                ).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, spend === option.value && styles.optionSelected]}
                    onPress={() => handleChoiceSelect(option.value, setSpend)}
                  >
                    <View style={[styles.radio, spend === option.value && styles.radioSelected]} />
                    <Text
                      style={[styles.optionText, spend === option.value && styles.optionTextSelected]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                {showSpendContext() ? (
                  <View style={styles.spendContextBlock}>
                    <Text style={styles.spendContextLabel}>
                      If you'd like to share, what was the coach, or workshop name?{' '}
                      <Text style={styles.optional}>(optional)</Text>
                    </Text>
                    <MarketResearchTextField
                      key="spend-context"
                      placeholder="e.g. relationship coaching, men's work, therapy..."
                      value={spendContext}
                      onChangeText={setSpendContext}
                    />
                  </View>
                ) : null}
              </View>
            )}
            </View>

            <View style={styles.footerRow}>
              {currentIndex > 0 ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleBack}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="chevron-back" size={20} color="#111" />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.footerSpacer} />
              )}
              {saving ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator color="#111" size="small" />
                </View>
              ) : needsManualAdvance() ? (
                <TouchableOpacity
                  style={[
                    styles.nextButton,
                    !isCurrentComplete() && styles.nextButtonDisabled,
                    currentIndex > 0 && styles.nextButtonWithBack,
                  ]}
                  onPress={handleNext}
                  disabled={!isCurrentComplete()}
                >
                  <Text style={styles.nextButtonText}>{isLastQuestion ? 'Continue' : 'Next'}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.footerSpacer} />
              )}
            </View>
          </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      {...(Platform.OS === 'web' ? ({ style: { zIndex: 100000 } as const } as const) : {})}
    >
      <View style={[styles.overlay, Platform.OS === 'web' ? styles.overlayWeb : null]}>
        {Platform.OS === 'web' ? (
          <View style={[styles.overlayScrollContent, styles.overlayScrollContentWeb]}>{card}</View>
        ) : (
          <KeyboardAvoidingView
            style={styles.overlayScroll}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={styles.overlayScroll}
              contentContainerStyle={styles.overlayScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              bounces={false}
            >
              {card}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayWeb: {
    flex: 1,
    pointerEvents: 'auto',
    zIndex: 100000,
  },
  overlayScroll: {
    flex: 1,
    width: '100%',
  },
  overlayScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayScrollContentWeb: {
    flex: 1,
    width: '100%',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  cardWeb: {
    pointerEvents: 'auto',
    position: 'relative',
    zIndex: 1,
  },
  body: {
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  dotActive: {
    backgroundColor: '#111',
    width: 20,
  },
  dotComplete: {
    backgroundColor: '#888',
  },
  questionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    marginBottom: 20,
    lineHeight: 24,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 12,
  },
  optionSelected: {
    borderColor: '#111',
    backgroundColor: '#f5f5f5',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#ccc',
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: '#111',
    backgroundColor: '#111',
  },
  optionLabelBlock: {
    flex: 1,
  },
  optionText: {
    fontSize: 15,
    color: '#333',
  },
  optionTextSelected: {
    color: '#111',
    fontWeight: '500',
  },
  optionSub: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  textInputShell: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#fff',
    alignSelf: 'stretch',
    width: '100%',
  },
  textInputShellWeb: {
    position: 'relative',
    zIndex: 2,
    pointerEvents: 'auto',
  },
  textInputShellFocused: {
    borderColor: '#111',
  },
  textInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111',
    borderWidth: 0,
    width: '100%',
    minHeight: 44,
    backgroundColor: 'transparent',
  },
  textInputWeb: {
    flex: 1,
    alignSelf: 'stretch',
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  spendContextBlock: {
    marginTop: 16,
  },
  spendContextLabel: {
    fontSize: 14,
    color: '#444',
    marginBottom: 6,
    lineHeight: 20,
  },
  optional: {
    color: '#aaa',
    fontWeight: '400',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  footerSpacer: {
    flex: 1,
    minWidth: 88,
  },
  savingRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 14,
    paddingHorizontal: 4,
    minWidth: 88,
  },
  backButtonText: {
    fontSize: 15,
    color: '#111',
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextButtonWithBack: {
    flex: 1,
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
