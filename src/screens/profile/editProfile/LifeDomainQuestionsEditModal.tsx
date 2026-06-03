import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/shared/ui/Button';
import { theme } from '@/shared/theme/theme';
import {
  LIFE_DOMAIN_ONBOARDING_QUESTIONS,
  countAnsweredInDomain,
  getLifeDomainOnboardingMeta,
  getOptionalLifeDomainQuestionsForDomain,
  isLifeDomainQuestionRequiredForOnboarding,
  validateLifeDomainStep,
  type LifeDomainId,
  type LifeDomainQuestionDef,
} from '@/shared/constants/lifeDomainOnboardingQuestions';
import {
  fetchLifeDomainAnswersMap,
  saveLifeDomainAnswersFromOnboarding,
  type LifeDomainAnswersMap,
} from '@/screens/profile/editProfile/lifeDomainProfileService';
import {
  BottomSheet,
  OptionPickerTrigger,
  type OptionAnchor,
} from '@/screens/profile/editProfile/BottomSheet';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { SelectTriggerRow } from '@/shared/ui/SelectTriggerRow';
import { LifeDomainQuestionSuggestionBlock } from '@/datingProfile/screens/onboarding/modals/components/LifeDomainQuestionSuggestionBlock';
import { submitLifeDomainQuestionSuggestion } from '@/datingProfile/screens/onboarding/modals/lifeDomainQuestionSuggestion';
import { styles as lifeDomainQuestionStyles } from '@/datingProfile/screens/onboarding/modals/LifeDomainQuestionsModal.styled';

type PickerSheet = {
  title: string;
  options: { label: string; value: string }[];
  selectedValue: string;
  onPick: (value: string) => void;
  anchor?: OptionAnchor;
};

type Props = {
  visible: boolean;
  userId: string;
  domainId: LifeDomainId;
  initialAnswers?: LifeDomainAnswersMap;
  onAnswersChange?: (answers: LifeDomainAnswersMap) => void;
  wantKids?: string | null;
  enforceRequired?: boolean;
  /** Lifestyle tab: optional follow-up questions only (required fields live on Compatibility). */
  questionScope?: 'all' | 'optional';
  onClose: () => void;
};

export const LifeDomainQuestionsEditModal: React.FC<Props> = ({
  visible,
  userId,
  domainId,
  initialAnswers,
  onAnswersChange,
  wantKids,
  enforceRequired = false,
  questionScope = 'optional',
  onClose,
}) => {
  const domainMeta = getLifeDomainOnboardingMeta(domainId);
  const [answers, setAnswers] = useState<LifeDomainAnswersMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerSheet, setPickerSheet] = useState<PickerSheet | null>(null);
  const [questionSuggestion, setQuestionSuggestion] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const answersBaselineRef = useRef<LifeDomainAnswersMap>({});
  const draftSeedRef = useRef(initialAnswers);

  draftSeedRef.current = initialAnswers;

  useEffect(() => {
    if (!visible) return;
    setQuestionSuggestion('');
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const fromDb = await fetchLifeDomainAnswersMap(userId);
        if (cancelled) return;
        const seed = draftSeedRef.current ?? {};
        const merged: LifeDomainAnswersMap = { ...fromDb };
        for (const id of Object.keys(seed) as LifeDomainId[]) {
          merged[id] = { ...merged[id], ...seed[id] };
        }
        setAnswers(merged);
        answersBaselineRef.current = JSON.parse(JSON.stringify(merged)) as LifeDomainAnswersMap;
      } catch (e) {
        if (__DEV__) console.warn('[LifeDomainQuestionsEditModal] load', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, userId, domainId]);

  const setAnswer = useCallback((questionId: string, value: string) => {
    setValidationError(null);
    setAnswers((prev) => ({
      ...prev,
      [domainId]: { ...prev[domainId], [questionId]: value },
    }));
  }, [domainId]);

  const handleCancel = useCallback(() => {
    setAnswers(answersBaselineRef.current);
    onClose();
  }, [onClose]);

  const handleSave = async () => {
    const domainAnswers = answers[domainId] ?? {};
    const validation = validateLifeDomainStep(domainId, domainAnswers, {
      enforceRequired,
      wantKids,
    });
    if (!validation.valid) {
      const labels = validation.missingQuestions.map((q) => q.text).join('\n• ');
      setValidationError(`Please answer all required questions:\n• ${labels}`);
      return;
    }

    setSaving(true);
    try {
      await saveLifeDomainAnswersFromOnboarding(userId, answers);
      const suggestion = questionSuggestion.trim();
      if (suggestion) {
        const { error } = await submitLifeDomainQuestionSuggestion(userId, domainId, suggestion);
        if (error && __DEV__) {
          console.warn('[LifeDomainQuestionsEditModal] question suggestion', error);
        }
        setQuestionSuggestion('');
      }
      onAnswersChange?.(answers);
      onClose();
    } catch (e) {
      if (__DEV__) console.warn('[LifeDomainQuestionsEditModal] save', e);
    } finally {
      setSaving(false);
    }
  };

  const questionLabelSuffix = (q: LifeDomainQuestionDef) => {
    if (q.explicitlyOptional) return '(optional)';
    if (isLifeDomainQuestionRequiredForOnboarding(q, { wantKids })) return '(required)';
    return null;
  };

  const textPlaceholder = (q: LifeDomainQuestionDef) => {
    if (q.explicitlyOptional) return 'Optional — you can skip this question';
    if (isLifeDomainQuestionRequiredForOnboarding(q, { wantKids })) {
      return 'Required — share your answer here';
    }
    return 'Optional — share as much or as little as you like';
  };

  const renderQuestion = (q: LifeDomainQuestionDef) => {
    const value = answers[domainId]?.[q.id] ?? '';
    const suffix = questionLabelSuffix(q);
    if (q.input === 'dropdown' && q.options?.length) {
      const optionRows = [{ label: 'Select an option', value: '' }, ...q.options];
      const selectedLabel =
        optionRows.find((o) => o.value === value)?.label ?? 'Select an option';

      return (
        <View key={q.id} style={styles.questionBlock}>
          <View style={lifeDomainQuestionStyles.questionTextRow}>
            <Text style={styles.questionText}>{q.text}</Text>
            {suffix ? (
              <Text
                style={
                  q.explicitlyOptional
                    ? lifeDomainQuestionStyles.optionalBadge
                    : lifeDomainQuestionStyles.requiredBadge
                }
              >
                {suffix}
              </Text>
            ) : null}
          </View>
          {Platform.OS === 'web' ? (
            <OptionPickerTrigger
              style={styles.dropdownTrigger}
              onOpen={(anchor) =>
                setPickerSheet({
                  title: q.text,
                  options: optionRows,
                  selectedValue: value,
                  anchor,
                  onPick: (picked) => setAnswer(q.id, picked),
                })
              }
            >
              <SelectTriggerRow
                label={selectedLabel}
                isPlaceholder={!value}
                labelStyle={styles.dropdownTriggerText}
                placeholderStyle={styles.dropdownPlaceholder}
              />
            </OptionPickerTrigger>
          ) : (
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={value}
                onValueChange={(v) => setAnswer(q.id, String(v))}
                mode={Platform.OS === 'android' ? 'dropdown' : undefined}
                dropdownIconColor={theme.colors.textSecondary}
                style={styles.picker}
              >
                {optionRows.map((opt) => (
                  <Picker.Item
                    key={opt.value || '__placeholder'}
                    label={opt.label}
                    value={opt.value}
                    color={theme.colors.text}
                  />
                ))}
              </Picker>
            </View>
          )}
        </View>
      );
    }

    return (
      <View key={q.id} style={styles.questionBlock}>
        <View style={lifeDomainQuestionStyles.questionTextRow}>
          <Text style={styles.questionText}>{q.text}</Text>
          {suffix ? (
            <Text
              style={
                q.explicitlyOptional
                  ? lifeDomainQuestionStyles.optionalBadge
                  : lifeDomainQuestionStyles.requiredBadge
              }
            >
              {suffix}
            </Text>
          ) : null}
        </View>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={(t) => setAnswer(q.id, t)}
          placeholder={textPlaceholder(q)}
          placeholderTextColor="rgba(123,154,190,0.65)"
          multiline={q.multiline !== false}
          textAlignVertical="top"
        />
      </View>
    );
  };

  const { answered, total } = useMemo(
    () =>
      countAnsweredInDomain(domainId, answers[domainId] ?? {}, {
        wantKids,
        countRequiredOnly: true,
      }),
    [answers, domainId, wantKids],
  );

  const questions = LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {domainMeta.icon} {domainMeta.name}
            </Text>
            <Pressable
              onPress={handleCancel}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close" size={26} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.description}>
              {questionScope === 'optional'
                ? 'Optional follow-up questions for this life area. Required questions are on the Compatibility tab.'
                : 'Answers you shared during onboarding appear below. Required fields are marked — edit profile does not block saving if optional fields are blank.'}
            </Text>
            {!loading && total > 0 ? (
              <Text style={styles.meta}>
                {answered} of {total}{' '}
                {questionScope === 'optional' ? 'optional' : 'required'} answered
              </Text>
            ) : null}
            {validationError ? (
              <Text style={lifeDomainQuestionStyles.validationError}>{validationError}</Text>
            ) : null}
            {loading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <View style={styles.body}>
                {questions.map((q) => renderQuestion(q))}
                <View style={lifeDomainQuestionStyles.questionSuggestionBlock}>
                  <LifeDomainQuestionSuggestionBlock
                    value={questionSuggestion}
                    onChangeText={setQuestionSuggestion}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={handleCancel}
              disabled={saving}
              style={styles.footerBtn}
            />
            <Button
              title={saving ? 'Saving…' : 'Save'}
              onPress={() => void handleSave()}
              disabled={saving || loading}
              style={styles.footerBtn}
            />
          </View>

          <BottomSheet
            visible={!!pickerSheet}
            title={pickerSheet?.title}
            anchor={pickerSheet?.anchor}
            onClose={() => setPickerSheet(null)}
          >
            {pickerSheet ? (
              <SingleChoiceOptionList
                options={pickerSheet.options}
                value={pickerSheet.selectedValue}
                onSelect={(next) => {
                  pickerSheet.onPick(next);
                  setPickerSheet(null);
                }}
              />
            ) : null}
          </BottomSheet>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    flex: 1,
    maxHeight: '92%',
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.18)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    paddingRight: 12,
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  meta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  body: {
    gap: 16,
  },
  questionBlock: {
    gap: 8,
  },
  questionText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(238,246,255,0.9)',
    fontWeight: '600',
  },
  textInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
    textAlignVertical: 'top',
  },
  dropdownTrigger: {
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  dropdownTriggerText: {
    color: theme.colors.text,
    fontSize: 15,
  },
  dropdownPlaceholder: {
    color: theme.colors.textSecondary,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  picker: {
    color: theme.colors.text,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.18)',
  },
  footerBtn: {
    flex: 1,
  },
});
