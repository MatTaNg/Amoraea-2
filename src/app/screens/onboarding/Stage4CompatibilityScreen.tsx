import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
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
  const [formData, setFormData] = useState<CompatibilityFormData>(defaultCompatibilityFormData);
  const [partnerBMIPreference, setPartnerBMIPreference] = useState<
    { noPreference: true } | { minBMI: number; maxBMI: number; minId: number; maxId: number } | null
  >(null);
  const [promptAnswers, setPromptAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepository.getProfile(userId),
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
    setPromptAnswers((prev) => ({ ...prev, [promptId]: answer }));
  }, []);

  const currentSection = COMPATIBILITY_SECTIONS[compatSectionIndex];
  const canProceedCompat = compatSectionIndex >= COMPATIBILITY_SECTIONS.length || true;

  const validatePrompts = (): boolean => {
    for (const p of ONBOARDING_PROFILE_PROMPTS) {
      const a = (promptAnswers[p.id] ?? '').trim();
      if (a.length < PROMPT_ANSWER_MIN) return false;
      if (a.length > PROMPT_ANSWER_MAX) return false;
    }
    return true;
  };

  const handleFinish = useCallback(async () => {
    if (!validatePrompts()) {
      Alert.alert('Answers needed', `Each prompt needs ${PROMPT_ANSWER_MIN}–${PROMPT_ANSWER_MAX} characters.`);
      return;
    }
    setSubmitting(true);
    try {
      const compatRecord = compatibilityToRecord(formData);
      const profilePrompts: Gate3ProfilePrompt[] = ONBOARDING_PROFILE_PROMPTS.map((p) => ({
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
            A few more sections: relationship preferences, partner body type preference, and 15 short profile prompts (20–300 characters each).
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
    return (
      <SafeAreaContainer>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>{sec.sectionTitle}</Text>
          {sec.questions.map((q) => {
            const value = formData[q.field];
            if (q.type === 'select') {
              return (
                <View key={String(q.field)} style={styles.questionBlock}>
                  <Text style={styles.qLabel}>{q.label}</Text>
                  {q.options.map((opt) => (
                    <SelectButton
                      key={String(opt.value)}
                      label={opt.label}
                      selected={value === opt.value}
                      onPress={() => updateForm(q.field, opt.value as CompatibilityFormData[typeof q.field])}
                    />
                  ))}
                </View>
              );
            }
            if (q.type === 'multiSelect') {
              const arr = Array.isArray(value) ? value : [];
              return (
                <View key={String(q.field)} style={styles.questionBlock}>
                  <Text style={styles.qLabel}>{q.label}</Text>
                  {q.options.map((opt) => (
                    <MultiSelectButton
                      key={String(opt.value)}
                      label={opt.label}
                      selected={arr.includes(opt.value as never)}
                      onPress={() => {
                        const next = arr.includes(opt.value as never)
                          ? arr.filter((x) => x !== opt.value)
                          : [...arr, opt.value];
                        updateForm(q.field, next as CompatibilityFormData[typeof q.field]);
                      }}
                    />
                  ))}
                </View>
              );
            }
            if (q.type === 'scale') {
              return (
                <View key={String(q.field)} style={styles.questionBlock}>
                  <ScaleSelect
                    label={q.label}
                    value={value as number | null}
                    min={q.min}
                    max={q.max}
                    onSelect={(v) => updateForm(q.field, v as CompatibilityFormData[typeof q.field])}
                    minLabel={q.min === 1 && q.max === 7 ? 'Least' : undefined}
                    maxLabel={q.min === 1 && q.max === 7 ? 'Most' : undefined}
                  />
                </View>
              );
            }
            if (q.type === 'switch') {
              return (
                <View key={String(q.field)} style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{q.label}</Text>
                  <Switch
                    value={value === true}
                    onValueChange={(v) => updateForm(q.field, v as CompatibilityFormData[typeof q.field])}
                    trackColor={{ false: colors.border, true: colors.primary + '60' }}
                    thumbColor={value ? colors.primary : colors.textSecondary}
                  />
                </View>
              );
            }
            return null;
          })}
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => setCompatSectionIndex((i) => (i > 0 ? i - 1 : 0))}
            style={styles.footerBtn}
          >
            <Text style={styles.footerBtnText}>← Back</Text>
          </TouchableOpacity>
          <Button
            title={compatSectionIndex < COMPATIBILITY_SECTIONS.length - 1 ? 'Next section →' : 'Next →'}
            onPress={() => setCompatSectionIndex((i) => i + 1)}
          />
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
              userHeightCm={userHeightCm}
              userWeightKg={userWeightKg}
              onComplete={(result) => {
                if (result.noPreference) {
                  setPartnerBMIPreference({ noPreference: true });
                } else if (result.minBMI != null && result.maxBMI != null && result.minId != null && result.maxId != null) {
                  setPartnerBMIPreference({
                    minBMI: result.minBMI,
                    maxBMI: result.maxBMI,
                    minId: result.minId,
                    maxId: result.maxId,
                  });
                }
                setStep('prompts');
              }}
            />
            <Button title="Skip (no preference)" variant="outline" onPress={() => { setPartnerBMIPreference({ noPreference: true }); setStep('prompts'); }} style={styles.skipBmi} />
          </ScrollView>
        </SafeAreaContainer>
      );
    }
    return (
      <SafeAreaContainer>
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Partner body type</Text>
          <Text style={styles.hint}>Optional. You can set this later in Compatibility.</Text>
          <Button title="No preference" variant="outline" onPress={() => { setPartnerBMIPreference({ noPreference: true }); setStep('prompts'); }} style={styles.skipBmi} />
          <Button title="Next: Profile prompts →" onPress={() => setStep('prompts')} style={styles.nextBtn} />
        </View>
      </SafeAreaContainer>
    );
  }

  if (step === 'prompts') {
    return (
      <SafeAreaContainer>
        <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.promptsContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Profile prompts</Text>
            <Text style={styles.hint}>Answer each in 20–300 characters. These help others get to know you.</Text>
            {ONBOARDING_PROFILE_PROMPTS.map((p) => (
              <View key={p.id} style={styles.promptBlock}>
                <Text style={styles.promptQuestion}>{p.text}</Text>
                <RNTextInput
                  style={styles.promptInput}
                  value={promptAnswers[p.id] ?? ''}
                  onChangeText={(t) => setPromptAnswer(p.id, t)}
                  placeholder={`${PROMPT_ANSWER_MIN}–${PROMPT_ANSWER_MAX} characters`}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={PROMPT_ANSWER_MAX}
                />
                <Text style={styles.charCount}>
                  {(promptAnswers[p.id] ?? '').length}/{PROMPT_ANSWER_MAX}
                </Text>
              </View>
            ))}
          </ScrollView>
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
  hint: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  nextBtn: { marginTop: spacing.md },
  skipBmi: { marginTop: spacing.sm },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  questionBlock: { marginBottom: spacing.lg },
  qLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  footerBtn: { padding: spacing.sm },
  footerBtnText: { fontSize: 15, color: colors.primary },
  bmiContainer: { padding: spacing.lg },
  promptsContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  promptBlock: { marginBottom: spacing.xl },
  promptQuestion: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  promptInput: {
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
