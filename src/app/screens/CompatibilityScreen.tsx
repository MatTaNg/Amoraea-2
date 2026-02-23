import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CompatibilityRepository } from '@data/repositories/CompatibilityRepository';
import { CompatibilityUseCase } from '@domain/useCases/CompatibilityUseCase';
import {
  CompatibilityFormData,
  defaultCompatibilityFormData,
} from '@domain/models/CompatibilityForm';
import {
  COMPATIBILITY_SECTIONS,
  KIDS_VALUES,
  WORK_HOURS_VALUES,
  HOURS_PER_WEEK_VALUES,
  SEX_FREQ_VALUES,
  WEIGHT_VALUES,
} from '@features/compatibility/compatibilityQuestions';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { SelectButton } from '@ui/components/SelectButton';
import { MultiSelectButton } from '@ui/components/MultiSelectButton';
import { ScaleSelect } from '@ui/components/ScaleSelect';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { BMIPreferenceSelector } from './bmi_selector';

const compatibilityRepository = new CompatibilityRepository();
const compatibilityUseCase = new CompatibilityUseCase(compatibilityRepository);

function parseKids(v: unknown): CompatibilityFormData['kidsWanted'] {
  if (typeof v === 'string' && KIDS_VALUES.includes(v as (typeof KIDS_VALUES)[number])) return v as CompatibilityFormData['kidsWanted'];
  if (typeof v === 'number') {
    if (v >= 5) return '5_plus';
    if (v >= 0 && v <= 4) return String(v) as CompatibilityFormData['kidsWanted'];
  }
  return null;
}

function parseWorkHours(v: unknown): CompatibilityFormData['workWeekHours'] {
  if (typeof v === 'string' && WORK_HOURS_VALUES.includes(v as (typeof WORK_HOURS_VALUES)[number])) return v as CompatibilityFormData['workWeekHours'];
  if (typeof v === 'number') {
    if (v <= 20) return '0_20';
    if (v <= 30) return '21_30';
    if (v <= 40) return '31_40';
    if (v <= 50) return '41_50';
    if (v <= 60) return '51_60';
    return '60_plus';
  }
  return null;
}

function parseHoursPerWeek(v: unknown): CompatibilityFormData['hoursPerWeekQualityTime'] {
  if (typeof v === 'string' && HOURS_PER_WEEK_VALUES.includes(v as (typeof HOURS_PER_WEEK_VALUES)[number])) {
    return v as CompatibilityFormData['hoursPerWeekQualityTime'];
  }
  // Legacy: nightsQualityTime (0-7) - rough mapping to hours
  if (typeof v === 'number') {
    if (v <= 1) return '0_5';
    if (v <= 2) return '6_10';
    if (v <= 3) return '11_15';
    if (v <= 4) return '16_20';
    if (v <= 5) return '21_30';
    return '31_plus';
  }
  return null;
}

function parseSexFreq(v: unknown): CompatibilityFormData['sexFrequency'] {
  if (typeof v === 'string' && SEX_FREQ_VALUES.includes(v as (typeof SEX_FREQ_VALUES)[number])) return v as CompatibilityFormData['sexFrequency'];
  return null;
}

function parseWeight(v: unknown): CompatibilityFormData['weight'] {
  if (typeof v === 'string' && WEIGHT_VALUES.includes(v as (typeof WEIGHT_VALUES)[number])) return v as CompatibilityFormData['weight'];
  if (typeof v === 'number') {
    if (v <= 120) return '100_120';
    if (v <= 140) return '121_140';
    if (v <= 160) return '141_160';
    if (v <= 180) return '161_180';
    if (v <= 200) return '181_200';
    return '200_plus';
  }
  return null;
}

function toFormData(data: Record<string, unknown> | null): CompatibilityFormData {
  if (!data) return defaultCompatibilityFormData;
  return {
    kidsWanted: parseKids(data.kidsWanted),
    openToAdopting: data.openToAdopting as boolean | null ?? null,
    kidsExisting: parseKids(data.kidsExisting),
    relationshipType: (data.relationshipType as CompatibilityFormData['relationshipType']) ?? null,
    marriagePartnershipPreference:
      (data.marriagePartnershipPreference as CompatibilityFormData['marriagePartnershipPreference']) ?? null,
    religiousIdentity: (data.religiousIdentity as CompatibilityFormData['religiousIdentity']) ?? null,
    faithPracticeLevel: (data.faithPracticeLevel as CompatibilityFormData['faithPracticeLevel']) ?? null,
    partnerSharesFaithPracticeImportance:
      (data.partnerSharesFaithPracticeImportance as number) ?? null,
    futureLivingLocation: (() => {
      const v = data.futureLivingLocation;
      const valid = ['city', 'suburban', 'rural', 'nomadic', 'off_grid', 'unsure'] as const;
      if (Array.isArray(v)) return v.filter((x) => valid.includes(x as (typeof valid)[number]));
      if (typeof v === 'string' && valid.includes(v as (typeof valid)[number])) return [v];
      return [];
    })(),
    willingToRelocate: data.willingToRelocate as boolean | null ?? null,
    workWeekHours: parseWorkHours(data.workWeekHours),
    hoursPerWeekQualityTime: parseHoursPerWeek(data.hoursPerWeekQualityTime ?? data.nightsQualityTime),
    sexualConnectionImportance: (data.sexualConnectionImportance as number) ?? null,
    sexFrequency: parseSexFreq(data.sexFrequency),
    sexFrequencyFlexible: data.sexFrequencyFlexible as boolean | null ?? null,
    sexualExplorationOpenness: (data.sexualExplorationOpenness as number) ?? null,
    financialSupportExpectation: (data.financialSupportExpectation as 1 | 2 | 3 | 4) ?? null,
    partnerSharesFinancialValuesImportance:
      (data.partnerSharesFinancialValuesImportance as number) ?? null,
    financialStructure: (data.financialStructure as 1 | 2 | 3 | 4) ?? null,
    partnerSharesFinancialStructureImportance:
      (data.partnerSharesFinancialStructureImportance as number) ?? null,
    financialRiskComfort: (data.financialRiskComfort as number) ?? null,
    incomeRange: (data.incomeRange as string) ?? null,
    partnerSimilarFinancialPositionImportance:
      (data.partnerSimilarFinancialPositionImportance as number) ?? null,
    weight: parseWeight(data.weight),
    cleanlinessPreference: (data.cleanlinessPreference as 1 | 2 | 3 | 4 | 5) ?? null,
    partnerBMIPreference: (() => {
      const v = data.partnerBMIPreference;
      if (v === null || v === undefined) return null;
      if (typeof v === 'object' && v !== null && 'noPreference' in v && (v as { noPreference?: boolean }).noPreference === true) {
        return { noPreference: true };
      }
      if (typeof v === 'object' && v !== null && 'minBMI' in v && 'maxBMI' in v && 'minId' in v && 'maxId' in v) {
        const o = v as { minBMI: number; maxBMI: number; minId: number; maxId: number };
        return { minBMI: o.minBMI, maxBMI: o.maxBMI, minId: o.minId, maxId: o.maxId };
      }
      return null;
    })(),
    partnerSharesCleanlinessImportance: (data.partnerSharesCleanlinessImportance as number) ?? null,
    hasPets: (data.hasPets as CompatibilityFormData['hasPets']) ?? null,
    partnerHasPetsPreference:
      (data.partnerHasPetsPreference as CompatibilityFormData['partnerHasPetsPreference']) ?? null,
    alcoholFrequency: (data.alcoholFrequency as CompatibilityFormData['alcoholFrequency']) ?? null,
    partnerDrinksComfort:
      (data.partnerDrinksComfort as CompatibilityFormData['partnerDrinksComfort']) ?? null,
    cigaretteFrequency:
      (data.cigaretteFrequency as CompatibilityFormData['cigaretteFrequency']) ?? null,
    partnerCigarettesComfort:
      (data.partnerCigarettesComfort as CompatibilityFormData['partnerCigarettesComfort']) ?? null,
    cannabisTobaccoFrequency:
      (data.cannabisTobaccoFrequency as CompatibilityFormData['cannabisTobaccoFrequency']) ?? null,
    partnerCannabisTobaccoComfort:
      (data.partnerCannabisTobaccoComfort as CompatibilityFormData['partnerCannabisTobaccoComfort']) ?? null,
    recreationalDrugsFrequency:
      (data.recreationalDrugsFrequency as CompatibilityFormData['recreationalDrugsFrequency']) ?? null,
    partnerRecreationalDrugsComfort:
      (data.partnerRecreationalDrugsComfort as CompatibilityFormData['partnerRecreationalDrugsComfort']) ?? null,
  };
}

function toRecord(data: CompatibilityFormData): Record<string, unknown> {
  return {
    kidsWanted: data.kidsWanted,
    openToAdopting: data.openToAdopting,
    kidsExisting: data.kidsExisting,
    relationshipType: data.relationshipType,
    marriagePartnershipPreference: data.marriagePartnershipPreference,
    religiousIdentity: data.religiousIdentity ?? undefined,
    faithPracticeLevel: data.faithPracticeLevel ?? undefined,
    partnerSharesFaithPracticeImportance: data.partnerSharesFaithPracticeImportance ?? undefined,
    futureLivingLocation: data.futureLivingLocation.length > 0 ? data.futureLivingLocation : undefined,
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

export const CompatibilityScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { userId } = route.params;
  const [formData, setFormData] = useState<CompatibilityFormData>(defaultCompatibilityFormData);
  const queryClient = useQueryClient();

  const { data: compatibility, isLoading } = useQuery({
    queryKey: ['compatibility', userId],
    queryFn: () => compatibilityUseCase.getCompatibility(userId),
  });

  const upsertMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      compatibilityUseCase.upsertCompatibility(userId, { compatibilityData: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compatibility', userId] });
      queryClient.invalidateQueries({ queryKey: ['profileCompletion', userId] });
    },
  });

  useEffect(() => {
    if (compatibility?.compatibilityData && Object.keys(compatibility.compatibilityData).length > 0) {
      setFormData(toFormData(compatibility.compatibilityData));
    } else {
      setFormData(defaultCompatibilityFormData);
    }
  }, [compatibility]);

  const handleSave = () => {
    upsertMutation.mutate(toRecord(formData));
  };

  const update = <K extends keyof CompatibilityFormData>(
    key: K,
    value: CompatibilityFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const workQualityTimeGapNote = ((): string | null => {
    const work = formData.workWeekHours;
    const quality = formData.hoursPerWeekQualityTime;
    if (!work || !quality) return null;
    const highWork = work === '51_60' || work === '60_plus';
    const highQuality = quality === '21_30' || quality === '31_plus';
    if (!highWork || !highQuality) return null;
    const workLabel = work === '60_plus' ? '60+ hours' : '51-60 hours';
    return `That's ambitious — most people working ${workLabel} find 10–15 hours of quality time more realistic. Want to adjust either number?`;
  })();

  const renderForm = () => (
    <>
      {COMPATIBILITY_SECTIONS.map((section, sectionIndex) => (
        <View key={section.sectionTitle}>
          <Text
            style={[
              styles.sectionTitle,
              sectionIndex === 0 && styles.sectionTitleFirst,
            ]}
          >
            {section.sectionTitle}
          </Text>
          {section.questions.map((q) => {
            const value = formData[q.field];
            if (q.type === 'select') {
              return (
                <View key={String(q.field)} style={styles.questionBlock}>
                  <Text style={styles.questionLabel}>{q.label}</Text>
                  {q.options.map((opt) => (
                    <SelectButton
                      key={String(opt.value)}
                      label={opt.label}
                      selected={value === opt.value}
                      onPress={() => update(q.field, opt.value as CompatibilityFormData[typeof q.field])}
                    />
                  ))}
                </View>
              );
            }
            if (q.type === 'multiSelect') {
              const arr = Array.isArray(value) ? value : [];
              return (
                <View key={String(q.field)} style={styles.questionBlock}>
                  <Text style={styles.questionLabel}>{q.label}</Text>
                  {q.options.map((opt) => (
                    <MultiSelectButton
                      key={String(opt.value)}
                      label={opt.label}
                      selected={arr.includes(opt.value as never)}
                      onPress={() => {
                        const next = arr.includes(opt.value as never)
                          ? arr.filter((x) => x !== opt.value)
                          : [...arr, opt.value];
                        update(q.field, next as CompatibilityFormData[typeof q.field]);
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
                    onSelect={(v) => update(q.field, v as CompatibilityFormData[typeof q.field])}
                    minLabel={q.min === 1 && q.max === 7 ? 'Least important' : undefined}
                    maxLabel={q.min === 1 && q.max === 7 ? 'Most important' : undefined}
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
                    onValueChange={(v) => update(q.field, v as CompatibilityFormData[typeof q.field])}
                    trackColor={{ false: colors.border, true: colors.primary + '60' }}
                    thumbColor={value ? colors.primary : colors.textSecondary}
                  />
                </View>
              );
            }
            return null;
          })}
          {section.sectionTitle === 'Time & Availability' && workQualityTimeGapNote ? (
            <View style={styles.gapNote}>
              <Text style={styles.gapNoteText}>{workQualityTimeGapNote}</Text>
            </View>
          ) : null}
          {section.sectionTitle === 'About You' && Platform.OS === 'web' ? (
            <View style={styles.bmiSection}>
              <BMIPreferenceSelector
                embedded
                userHeightCm={undefined}
                userWeightKg={undefined}
                onComplete={(result: { noPreference?: true; minBMI?: number; maxBMI?: number; minId?: number; maxId?: number }) => {
                  if (result.noPreference) {
                    update('partnerBMIPreference', { noPreference: true });
                  } else if (result.minBMI != null && result.maxBMI != null && result.minId != null && result.maxId != null) {
                    update('partnerBMIPreference', {
                      minBMI: result.minBMI,
                      maxBMI: result.maxBMI,
                      minId: result.minId,
                      maxId: result.maxId,
                    });
                  }
                }}
              />
            </View>
          ) : null}
        </View>
      ))}
      <View style={styles.saveSpacer} />
    </>
  );

  return (
    <SafeAreaContainer>
      {isLoading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : (
        <>
          <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {renderForm()}
          </ScrollView>
          <View style={styles.footer}>
            <Button
              title="Save"
              onPress={handleSave}
              loading={upsertMutation.isPending}
              style={styles.saveButton}
            />
          </View>
        </>
      )}
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  loadingText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  questionBlock: {
    marginBottom: spacing.lg,
  },
  gapNote: {
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary + '80',
  },
  gapNoteText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bmiSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  saveSpacer: {
    height: spacing.xxl,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    width: '100%',
  },
  sectionTitleFirst: {
    marginTop: 0,
  },
});
