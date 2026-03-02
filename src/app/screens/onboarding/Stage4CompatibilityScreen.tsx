import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { SelectButton } from '@ui/components/SelectButton';
import { MultiSelectButton } from '@ui/components/MultiSelectButton';
import { ScaleSelect } from '@ui/components/ScaleSelect';
import { ProgressBar } from '@ui/components/ProgressBar';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { CompatibilityRepository } from '@data/repositories/CompatibilityRepository';
import { CompatibilityUseCase } from '@domain/useCases/CompatibilityUseCase';
import {
  CompatibilityFormData,
  defaultCompatibilityFormData,
} from '@domain/models/CompatibilityForm';
import type { Gate3Compatibility, Gate3ProfilePrompt } from '@domain/models/OnboardingGates';
import {
  COMPATIBILITY_SECTIONS,
  KIDS_VALUES,
  WORK_HOURS_VALUES,
  HOURS_PER_WEEK_VALUES,
  SEX_FREQ_VALUES,
  WEIGHT_VALUES,
} from '@features/compatibility/compatibilityQuestions';
import {
  ONBOARDING_PROFILE_PROMPTS,
  PROMPT_ANSWER_MIN,
  PROMPT_ANSWER_MAX,
} from '@features/onboarding/onboardingProfilePrompts';
import { BMIPreferenceSelector } from '@app/screens/bmi_selector';
import { toFormData } from '@app/screens/CompatibilityScreen';

const profileRepository = new ProfileRepository();
const compatibilityRepository = new CompatibilityRepository();
const compatibilityUseCase = new CompatibilityUseCase(compatibilityRepository);

function compatibilityToRecord(data: CompatibilityFormData): Record<string, unknown> {
  return {
    kidsWanted: data.kidsWanted,
    openToAdopting: data.openToAdopting,
    kidsExisting: data.kidsExisting,
    relationshipType: data.relationshipType,
    marriagePartnershipPreference: data.marriagePartnershipPreference,
    religiousIdentity: data.religiousIdentity ?? undefined,
    faithPracticeLevel: data.faithPracticeLevel ?? undefined,
    partnerSharesFaithPracticeImportance: data.partnerSharesFaithPracticeImportance ?? undefined,
    futureLivingLocation: data.futureLivingLocation?.length ? data.futureLivingLocation : undefined,
    willingToRelocate: data.willingToRelocate,
    workWeekHours: data.workWeekHours,
    hoursPerWeekQualityTime: data.hoursPerWeekQualityTime,
    sexualConnectionImportance: data.sexualConnectionImportance,
    sexFrequency: data.sexFrequency ?? undefined,
    sexFrequencyFlexible: data.sexFrequencyFlexible,
    sexualExplorationOpenness: data.sexualExplorationOpenness,
    financialSupportExpectation: data.financialSupportExpectation,
    partnerSharesFinancialValuesImportance: data.partnerSharesFinancialValuesImportance,
    financialStructure: data.financialStructure,
    partnerSharesFinancialStructureImportance: data.partnerSharesFinancialStructureImportance,
    financialRiskComfort: data.financialRiskComfort,
    incomeRange: data.incomeRange ?? undefined,
    partnerSimilarFinancialPositionImportance: data.partnerSimilarFinancialPositionImportance ?? undefined,
    weight: data.weight,
    partnerBMIPreference: data.partnerBMIPreference ?? undefined,
    cleanlinessPreference: data.cleanlinessPreference,
    partnerSharesCleanlinessImportance: data.partnerSharesCleanlinessImportance,
    hasPets: data.hasPets ?? undefined,
    partnerHasPetsPreference: data.partnerHasPetsPreference ?? undefined,
    alcoholFrequency: data.alcoholFrequency ?? undefined,
    partnerDrinksComfort: data.partnerDrinksComfort ?? undefined,
    cigaretteFrequency: data.cigaretteFrequency ?? undefined,
    partnerCigarettesComfort: data.partnerCigarettesComfort ?? undefined,
    cannabisTobaccoFrequency: data.cannabisTobaccoFrequency ?? undefined,
    partnerCannabisTobaccoComfort: data.partnerCannabisTobaccoComfort ?? undefined,
    recreationalDrugsFrequency: data.recreationalDrugsFrequency ?? undefined,
    partnerRecreationalDrugsComfort: data.partnerRecreationalDrugsComfort ?? undefined,
  };
}

type Step = 'intro' | 'compat' | 'bmi' | 'prompts' | 'done';

export const Stage4CompatibilityScreen: React.FC<{ navigation: any; route: { params: { userId: string } } }> = ({
  navigation,
  route,
}) => {
  const { userId } = route.params;
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('intro');
  const [compatSectionIndex, setCompatSectionIndex] = useState(0);
  const [compatQuestionIndex, setCompatQuestionIndex] = useState(0);
  const [formData, setFormData] = useState<CompatibilityFormData>(defaultCompatibilityFormData);
  const [partnerBMIPreference, setPartnerBMIPreference] = useState<
    { noPreference: true } | { minBMI: number; maxBMI: number; minId: number; maxId: number } | null
  >(null);
  const [promptAnswers, setPromptAnswers] = useState<Record<string, string>>({});
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepository.getProfile(userId),
    enabled: !!userId,
  });

  const { data: compatibility } = useQuery({
    queryKey: ['compatibility', userId],
    queryFn: () => compatibilityUseCase.getCompatibility(userId),
    enabled: !!userId,
  });

  const basicInfo = profile?.basicInfo;
  const userHeightCm = basicInfo?.heightCm ?? undefined;
  const userWeightKg = basicInfo?.weightKg ?? undefined;

  const updateForm = useCallback(<K extends keyof CompatibilityFormData>(
    key: K,
    value: CompatibilityFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setPromptAnswer = useCallback((promptId: string, answer: string) => {
    setPromptsError(null);
    setPromptAnswers((prev) => ({ ...prev, [promptId]: answer }));
  }, []);

  const currentSection = COMPATIBILITY_SECTIONS[compatSectionIndex];
  const questions = currentSection?.questions ?? [];
  const currentQuestion = questions[compatQuestionIndex];
  const totalQuestionsInSection = questions.length;

  function getFirstIncompletePosition(
    data: CompatibilityFormData,
    bmiPref: typeof partnerBMIPreference
  ): { step: Step; sectionIndex: number; questionIndex: number } {
    for (let s = 0; s < COMPATIBILITY_SECTIONS.length; s++) {
      const sec = COMPATIBILITY_SECTIONS[s];
      const qs = sec?.questions ?? [];
      for (let q = 0; q < qs.length; q++) {
        const field = qs[q].field;
        const val = data[field];
        const answered = val !== undefined && val !== null;
        if (!answered) return { step: 'compat', sectionIndex: s, questionIndex: q };
      }
    }
    if (bmiPref === null || bmiPref === undefined) return { step: 'bmi', sectionIndex: COMPATIBILITY_SECTIONS.length, questionIndex: 0 };
    return { step: 'prompts', sectionIndex: COMPATIBILITY_SECTIONS.length, questionIndex: 0 };
  }

  const hasResumedRef = React.useRef(false);
  React.useEffect(() => {
    if (!userId || hasResumedRef.current || !compatibility?.compatibilityData) return;
    const raw = compatibility.compatibilityData as Record<string, unknown>;
    if (Object.keys(raw).length === 0) return;
    hasResumedRef.current = true;
    const hydrated = toFormData(raw);
    setFormData(hydrated);
    if (hydrated.partnerBMIPreference != null) {
      if ('noPreference' in hydrated.partnerBMIPreference) {
        setPartnerBMIPreference({ noPreference: true });
      } else if ('minBMI' in hydrated.partnerBMIPreference && 'maxBMI' in hydrated.partnerBMIPreference) {
        const p = hydrated.partnerBMIPreference as { minBMI: number; maxBMI: number; minId: number; maxId: number };
        setPartnerBMIPreference({ minBMI: p.minBMI, maxBMI: p.maxBMI, minId: p.minId, maxId: p.maxId });
      }
    }
    const pos = getFirstIncompletePosition(hydrated, hydrated.partnerBMIPreference != null ? (hydrated.partnerBMIPreference as typeof partnerBMIPreference) : null);
    setStep(pos.step);
    setCompatSectionIndex(pos.sectionIndex);
    setCompatQuestionIndex(pos.questionIndex);
  }, [userId, compatibility?.compatibilityData]);

  const saveCompatibilityProgress = useCallback(async (dataOverride?: CompatibilityFormData) => {
    try {
      const dataToSave = dataOverride ?? formData;
      await compatibilityUseCase.upsertCompatibility(userId, {
        compatibilityData: compatibilityToRecord(dataToSave),
      });
      queryClient.invalidateQueries({ queryKey: ['compatibility', userId] });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save progress.');
    }
  }, [userId, queryClient, formData]);

  const advanceCompat = useCallback(async (formDataWithLatestAnswer?: CompatibilityFormData) => {
    if (compatQuestionIndex < totalQuestionsInSection - 1) {
      setCompatQuestionIndex((i) => i + 1);
    } else {
      if (formDataWithLatestAnswer != null) {
        await saveCompatibilityProgress(formDataWithLatestAnswer);
      } else {
        await saveCompatibilityProgress();
      }
      setCompatSectionIndex((i) => i + 1);
      setCompatQuestionIndex(0);
    }
  }, [compatQuestionIndex, totalQuestionsInSection, saveCompatibilityProgress]);

  const prevCompatSectionIndexRef = React.useRef(0);
  React.useEffect(() => {
    if (step !== 'compat' || compatSectionIndex <= prevCompatSectionIndexRef.current) return;
    prevCompatSectionIndexRef.current = compatSectionIndex;
    saveCompatibilityProgress();
  }, [step, compatSectionIndex, saveCompatibilityProgress]);

  const goBackCompat = useCallback(() => {
    if (compatQuestionIndex > 0) {
      setCompatQuestionIndex((i) => i - 1);
    } else if (compatSectionIndex > 0) {
      const prevSection = COMPATIBILITY_SECTIONS[compatSectionIndex - 1];
      setCompatSectionIndex((i) => i - 1);
      setCompatQuestionIndex((prevSection?.questions?.length ?? 1) - 1);
    }
  }, [compatSectionIndex, compatQuestionIndex]);

  const validatePrompts = (): boolean => {
    const PROMPT_MAX_ANSWERS = 3;
    let answeredCount = 0;
    for (const p of ONBOARDING_PROFILE_PROMPTS) {
      const a = (promptAnswers[p.id] ?? '').trim();
      if (a.length > 0) {
        answeredCount++;
        if (a.length < PROMPT_ANSWER_MIN) return false;
        if (a.length > PROMPT_ANSWER_MAX) return false;
      }
    }
    if (answeredCount > PROMPT_MAX_ANSWERS) return false;
    return true;
  };

  const handleFinish = useCallback(async () => {
    if (!validatePrompts()) {
      const msg = (() => {
        const answered = ONBOARDING_PROFILE_PROMPTS.filter((p) => (promptAnswers[p.id] ?? '').trim().length > 0).length;
        if (answered > 3) return 'You can answer at most 3 prompts.';
        const tooShort = ONBOARDING_PROFILE_PROMPTS.some(
          (p) => (promptAnswers[p.id] ?? '').trim().length > 0 && (promptAnswers[p.id] ?? '').trim().length < PROMPT_ANSWER_MIN
        );
        if (tooShort) return `Each answer must be at least ${PROMPT_ANSWER_MIN} characters. One or more of your answers is too short.`;
        return `Each answer must be ${PROMPT_ANSWER_MIN}–${PROMPT_ANSWER_MAX} characters.`;
      })();
      setPromptsError(msg);
      if (Platform.OS !== 'web') {
        Alert.alert('Invalid answers', msg);
      }
      return;
    }
    setPromptsError(null);
    setSubmitting(true);
    try {
      const compatRecord = compatibilityToRecord(formData);
      const profilePrompts: Gate3ProfilePrompt[] = ONBOARDING_PROFILE_PROMPTS
        .filter((p) => (promptAnswers[p.id] ?? '').trim().length > 0)
        .slice(0, 3)
        .map((p) => ({
          prompt: p.text,
          answer: (promptAnswers[p.id] ?? '').trim(),
        }));

      const gate3: Gate3Compatibility = {
        ...compatRecord,
        preferredMinBMI: partnerBMIPreference && !('noPreference' in partnerBMIPreference)
          ? partnerBMIPreference.minBMI
          : undefined,
        preferredMaxBMI: partnerBMIPreference && !('noPreference' in partnerBMIPreference)
          ? partnerBMIPreference.maxBMI
          : undefined,
        profilePrompts,
        completedAt: new Date().toISOString(),
      };

      await compatibilityUseCase.upsertCompatibility(userId, { compatibilityData: compatRecord });
      await profileRepository.upsertProfile(userId, {
        gate3Compatibility: gate3,
        onboardingStage: 'complete',
        profileVisible: true,
      });

      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['compatibility', userId] });
      setCompleted(true);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  }, [formData, partnerBMIPreference, promptAnswers, userId, queryClient]);

  if (completed) {
    return (
      <SafeAreaContainer>
        <View style={styles.doneContainer}>
          <Text style={styles.doneTitle}>You're all set</Text>
          <Text style={styles.doneSub}>Your profile is now visible. We'll be in touch.</Text>
        </View>
      </SafeAreaContainer>
    );
  }

  if (step === 'intro') {
    return (
      <SafeAreaContainer>
        <View style={styles.introContainer}>
          <Text style={styles.introTitle}>Compatibility & profile</Text>
          <Text style={styles.introSub}>
            A few more sections: relationship preferences, partner body type preference.
          </Text>
          <Button title="Continue" onPress={() => setStep('compat')} style={styles.introBtn} />
        </View>
      </SafeAreaContainer>
    );
  }

  if (step === 'compat') {
    if (compatSectionIndex >= COMPATIBILITY_SECTIONS.length) {
      return (
        <SafeAreaContainer>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Compatibility complete</Text>
            <Button
              title="Next: Partner body type →"
              onPress={() => setStep('bmi')}
              style={styles.nextBtn}
            />
          </View>
        </SafeAreaContainer>
      );
    }

    const sec = currentSection!;
    if (!currentQuestion) {
      return (
        <SafeAreaContainer>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{sec.sectionTitle}</Text>
            <Text style={styles.hint}>No questions in this section.</Text>
            <Button title="Next section →" onPress={advanceCompat} style={styles.nextBtn} />
          </View>
        </SafeAreaContainer>
      );
    }

    const q = currentQuestion;
    const value = formData[q.field];
    const isSelect = q.type === 'select';
    const isMultiSelect = q.type === 'multiSelect';
    const isScale = q.type === 'scale';
    const isSwitch = q.type === 'switch';

    const handleSelectAndNext = <K extends keyof CompatibilityFormData>(
      key: K,
      val: CompatibilityFormData[K]
    ) => {
      const nextForm = { ...formData, [key]: val };
      updateForm(key, val);
      advanceCompat(nextForm);
    };

    return (
      <SafeAreaContainer>
        <View style={styles.compatHeader}>
          <ProgressBar
            currentStep={compatQuestionIndex + 1}
            totalSteps={totalQuestionsInSection}
          />
          <Text style={styles.sectionLabel}>{sec.sectionTitle}</Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.qLabel}>{q.label}</Text>
          {isSelect && (
            <View style={styles.questionBlock}>
              {q.options.map((opt) => (
                <SelectButton
                  key={String(opt.value)}
                  label={opt.label}
                  selected={value === opt.value}
                  onPress={() => handleSelectAndNext(q.field, opt.value as CompatibilityFormData[typeof q.field])}
                />
              ))}
            </View>
          )}
          {isMultiSelect && (
            <View style={styles.questionBlock}>
              {q.options.map((opt) => {
                const arr = Array.isArray(value) ? value : [];
                return (
                  <MultiSelectButton
                    key={String(opt.value)}
                    label={opt.label}
                    selected={arr.includes(opt.value as never)}
                    onPress={() => {
                      const next = arr.includes(opt.value as never)
                        ? arr.filter((x) => x !== opt.value)
                        : [...arr, opt.value];
                      const nextForm = { ...formData, [q.field]: next as CompatibilityFormData[typeof q.field] };
                      updateForm(q.field, next as CompatibilityFormData[typeof q.field]);
                      advanceCompat(nextForm);
                    }}
                  />
                );
              })}
            </View>
          )}
          {isScale && (
            <View style={styles.questionBlock}>
              <ScaleSelect
                label={undefined}
                value={value as number | null}
                min={q.min}
                max={q.max}
                onSelect={(v) => {
                  const nextForm = { ...formData, [q.field]: v as CompatibilityFormData[typeof q.field] };
                  updateForm(q.field, v as CompatibilityFormData[typeof q.field]);
                  advanceCompat(nextForm);
                }}
                minLabel={q.min === 1 && q.max === 7 ? 'Least' : undefined}
                maxLabel={q.min === 1 && q.max === 7 ? 'Most' : undefined}
              />
            </View>
          )}
          {isSwitch && (
            <View style={styles.questionBlock}>
              <SelectButton
                label="Yes"
                selected={value === true}
                onPress={() => handleSelectAndNext(q.field, true as CompatibilityFormData[typeof q.field])}
              />
              <SelectButton
                label="No"
                selected={value === false}
                onPress={() => handleSelectAndNext(q.field, false as CompatibilityFormData[typeof q.field])}
              />
            </View>
          )}
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity onPress={goBackCompat} style={styles.footerBtn}>
            <Text style={styles.footerBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaContainer>
    );
  }

  if (step === 'bmi') {
    if (Platform.OS === 'web') {
      return (
        <SafeAreaContainer>
          <ScrollView contentContainerStyle={styles.bmiContainer}>
            <BMIPreferenceSelector
              embedded
              useAppTheme
              showNoPreferenceButton={false}
              userHeightCm={userHeightCm}
              userWeightKg={userWeightKg}
              onComplete={async (result: { noPreference?: boolean; minBMI?: number; maxBMI?: number; minId?: number; maxId?: number }) => {
                const preference = result.noPreference
                  ? { noPreference: true as const }
                  : result.minBMI != null && result.maxBMI != null && result.minId != null && result.maxId != null
                    ? { minBMI: result.minBMI, maxBMI: result.maxBMI, minId: result.minId, maxId: result.maxId }
                    : null;
                if (preference) {
                  await saveCompatibilityProgress({ ...formData, partnerBMIPreference: preference });
                  setPartnerBMIPreference(preference);
                }
                setStep('prompts');
              }}
            />
            <Button title="Skip (no preference)" variant="outline" onPress={async () => {
              await saveCompatibilityProgress({ ...formData, partnerBMIPreference: { noPreference: true } });
              setPartnerBMIPreference({ noPreference: true });
              setStep('prompts');
            }} style={styles.skipBmi} />
          </ScrollView>
        </SafeAreaContainer>
      );
    }
    return (
      <SafeAreaContainer>
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Partner body type</Text>
          <Text style={styles.hint}>Optional. You can set this later in Compatibility.</Text>
          <Button title="No preference" variant="outline" onPress={async () => {
            await saveCompatibilityProgress({ ...formData, partnerBMIPreference: { noPreference: true } });
            setPartnerBMIPreference({ noPreference: true });
            setStep('prompts');
          }} style={styles.skipBmi} />
          <Button title="Next: Profile prompts →" onPress={() => setStep('prompts')} style={styles.nextBtn} />
        </View>
      </SafeAreaContainer>
    );
  }

  if (step === 'prompts') {
    const togglePromptSelection = (id: string) => {
      setSelectedPromptIds((prev) => {
        if (prev.includes(id)) {
          setPromptAnswers((a) => ({ ...a, [id]: '' }));
          setPromptsError(null);
          return prev.filter((x) => x !== id);
        }
        return prev.length < 3 ? [...prev, id] : prev;
      });
    };

    return (
      <SafeAreaContainer>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.promptsContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Profile prompts</Text>
            <Text style={styles.hint}>Optional: tap up to 3 prompts to answer (20–300 characters each).</Text>
            {ONBOARDING_PROFILE_PROMPTS.map((p) => {
              const isSelected = selectedPromptIds.includes(p.id);
              return (
                <View key={p.id} style={styles.promptBlock}>
                  <TouchableOpacity
                    style={[styles.promptQuestionRow, isSelected && styles.promptQuestionRowSelected]}
                    onPress={() => togglePromptSelection(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.promptQuestion, isSelected && styles.promptQuestionSelected]}>{p.text}</Text>
                    {isSelected && <Text style={styles.promptQuestionCheck}>✓</Text>}
                  </TouchableOpacity>
                  {isSelected && (
                    <>
                      <RNTextInput
                        style={styles.promptInput}
                        value={promptAnswers[p.id] ?? ''}
                        onChangeText={(t) => setPromptAnswer(p.id, t)}
                        placeholder="Your answer (20–300 characters)"
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        maxLength={PROMPT_ANSWER_MAX}
                      />
                      <Text style={styles.charCount}>
                        {(promptAnswers[p.id] ?? '').length}/{PROMPT_ANSWER_MAX}
                      </Text>
                    </>
                  )}
                </View>
              );
            })}
          </ScrollView>
          {promptsError ? (
            <Text style={styles.promptsError}>{promptsError}</Text>
          ) : null}
          <View style={styles.footer}>
            <Button
              title={submitting ? 'Saving…' : 'Complete onboarding'}
              onPress={handleFinish}
              disabled={submitting}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaContainer>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  introContainer: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  introTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  introSub: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.xl },
  introBtn: { marginTop: spacing.md },
  sectionContainer: { flex: 1, padding: spacing.xl },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  compatHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  hint: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  nextBtn: { marginTop: spacing.md },
  skipBmi: { marginTop: spacing.sm },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  questionBlock: { marginBottom: spacing.lg },
  qLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  promptsError: { fontSize: 14, color: colors.error, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  footerBtn: { padding: spacing.sm },
  footerBtnText: { fontSize: 15, color: colors.primary },
  bmiContainer: { padding: spacing.lg },
  promptsContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  promptBlock: { marginBottom: spacing.xl },
  promptQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  promptQuestionRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  promptQuestion: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  promptQuestionSelected: { color: colors.primary },
  promptQuestionCheck: { fontSize: 16, color: colors.primary, marginLeft: spacing.sm },
  promptInput: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  doneContainer: { flex: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center' },
  doneTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  doneSub: { fontSize: 15, color: colors.textSecondary },
});
