import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CompatibilityRepository } from '@data/repositories/CompatibilityRepository';
import { CompatibilityUseCase } from '@domain/useCases/CompatibilityUseCase';
import {
  CompatibilityFormData,
  defaultCompatibilityFormData,
} from '@domain/models/CompatibilityForm';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { SelectButton } from '@ui/components/SelectButton';
import { MultiSelectButton } from '@ui/components/MultiSelectButton';
import { ScaleSelect } from '@ui/components/ScaleSelect';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { Ionicons } from '@expo/vector-icons';

const compatibilityRepository = new CompatibilityRepository();
const compatibilityUseCase = new CompatibilityUseCase(compatibilityRepository);

const RELATIONSHIP_OPTIONS = [
  { value: 'monogamy' as const, label: 'Monogamy' },
  { value: 'enm' as const, label: 'ENM' },
  { value: 'poly' as const, label: 'Poly' },
  { value: 'unsure' as const, label: 'Unsure' },
];

const MARRIAGE_PARTNERSHIP_OPTIONS = [
  { value: 'yes' as const, label: 'Yes' },
  { value: 'married_not_legal' as const, label: '"Married" but not legally' },
  { value: 'committed_no_marriage' as const, label: 'I do not want to be married but we can be in a committed partnership' },
  { value: 'no_commitment' as const, label: 'I am not looking for any committed partnership' },
];

const FUTURE_LIVING_OPTIONS = [
  { value: 'city' as const, label: 'City' },
  { value: 'suburban' as const, label: 'Suburban' },
  { value: 'rural' as const, label: 'Rural' },
  { value: 'nomadic' as const, label: 'Nomadic' },
  { value: 'off_grid' as const, label: 'Off grid' },
  { value: 'unsure' as const, label: 'Unsure' },
];

const INCOME_RANGE_OPTIONS = [
  { value: 'under_25k', label: 'Under $25,000' },
  { value: '25k_50k', label: '$25,000 - $50,000' },
  { value: '50k_75k', label: '$50,000 - $75,000' },
  { value: '75k_100k', label: '$75,000 - $100,000' },
  { value: '100k_150k', label: '$100,000 - $150,000' },
  { value: '150k_200k', label: '$150,000 - $200,000' },
  { value: '200k_plus', label: '$200,000+' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

const FINANCIAL_SUPPORT_OPTIONS = [
  { value: 1 as const, label: 'I expect full financial independence on both sides' },
  { value: 2 as const, label: "I'm open to mutual support depending on circumstances" },
  { value: 3 as const, label: 'I expect to provide more financial support' },
  { value: 4 as const, label: 'I expect to receive more financial support' },
];

const FINANCIAL_STRUCTURE_OPTIONS = [
  { value: 1 as const, label: 'Fully pools finances' },
  { value: 2 as const, label: 'Mostly pooled with some individual accounts' },
  { value: 3 as const, label: 'Mostly separate with shared expenses' },
  { value: 4 as const, label: 'Fully separate finances' },
];

const CLEANLINESS_OPTIONS = [
  { value: 1 as const, label: 'Very relaxed (Clutter and mess don\'t bother me much)' },
  { value: 2 as const, label: 'Moderately relaxed (Some clutter is fine)' },
  { value: 3 as const, label: 'Balanced (generally tidy, occasional mess is okay)' },
  { value: 4 as const, label: 'Very tidy (Things should usually be clean and organized)' },
  { value: 5 as const, label: 'Highly structured (Clean and organized most of the time)' },
];

const KIDS_OPTIONS = [
  { value: '0' as const, label: '0' },
  { value: '1' as const, label: '1' },
  { value: '2' as const, label: '2' },
  { value: '3' as const, label: '3' },
  { value: '4' as const, label: '4' },
  { value: '5_plus' as const, label: '5+' },
];

const WORK_WEEK_HOURS_OPTIONS = [
  { value: '0_20' as const, label: '0-20 hours' },
  { value: '21_30' as const, label: '21-30 hours' },
  { value: '31_40' as const, label: '31-40 hours' },
  { value: '41_50' as const, label: '41-50 hours' },
  { value: '51_60' as const, label: '51-60 hours' },
  { value: '60_plus' as const, label: '60+ hours' },
];

const HOURS_PER_WEEK_QUALITY_TIME_OPTIONS = [
  { value: '0_5' as const, label: '0-5 hours' },
  { value: '6_10' as const, label: '6-10 hours' },
  { value: '11_15' as const, label: '11-15 hours' },
  { value: '16_20' as const, label: '16-20 hours' },
  { value: '21_30' as const, label: '21-30 hours' },
  { value: '31_plus' as const, label: '31+ hours' },
];

const SEX_FREQUENCY_OPTIONS = [
  { value: 'rarely' as const, label: 'Rarely' },
  { value: 'once_week' as const, label: 'Once a week' },
  { value: '2_3_week' as const, label: '2-3 times per week' },
  { value: 'several_week' as const, label: 'Several times per week' },
  { value: 'daily' as const, label: 'Daily' },
  { value: 'prefer_not' as const, label: 'Prefer not to say' },
];

const WEIGHT_OPTIONS = [
  { value: '100_120' as const, label: '100-120 lbs' },
  { value: '121_140' as const, label: '121-140 lbs' },
  { value: '141_160' as const, label: '141-160 lbs' },
  { value: '161_180' as const, label: '161-180 lbs' },
  { value: '181_200' as const, label: '181-200 lbs' },
  { value: '200_plus' as const, label: '200+ lbs' },
  { value: 'prefer_not' as const, label: 'Prefer not to say' },
];

const KIDS_VALUES = ['0', '1', '2', '3', '4', '5_plus'] as const;
const WORK_HOURS_VALUES = ['0_20', '21_30', '31_40', '41_50', '51_60', '60_plus'] as const;
const HOURS_PER_WEEK_VALUES = ['0_5', '6_10', '11_15', '16_20', '21_30', '31_plus'] as const;
const SEX_FREQ_VALUES = ['rarely', 'once_week', '2_3_week', 'several_week', 'daily', 'prefer_not'] as const;
const WEIGHT_VALUES = ['100_120', '121_140', '141_160', '161_180', '181_200', '200_plus', 'prefer_not'] as const;

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
    weight: parseWeight(data.weight),
    cleanlinessPreference: (data.cleanlinessPreference as 1 | 2 | 3 | 4 | 5) ?? null,
    partnerSharesCleanlinessImportance: (data.partnerSharesCleanlinessImportance as number) ?? null,
  };
}

function toRecord(data: CompatibilityFormData): Record<string, unknown> {
  return {
    kidsWanted: data.kidsWanted,
    openToAdopting: data.openToAdopting,
    kidsExisting: data.kidsExisting,
    relationshipType: data.relationshipType,
    marriagePartnershipPreference: data.marriagePartnershipPreference,
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
    weight: data.weight,
    cleanlinessPreference: data.cleanlinessPreference,
    partnerSharesCleanlinessImportance: data.partnerSharesCleanlinessImportance,
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

  const renderForm = () => (
    <>
      {/* Kids */}
      <Text style={[styles.sectionTitle, styles.sectionTitleFirst]}>Family & Kids</Text>
      <Text style={styles.questionLabel}>How many kids do you want?</Text>
      {KIDS_OPTIONS.map((opt) => (
        <SelectButton
          key={opt.value}
          label={opt.label}
          selected={formData.kidsWanted === opt.value}
          onPress={() => update('kidsWanted', opt.value)}
        />
      ))}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Are you open to adopting kids?</Text>
        <Switch
          value={formData.openToAdopting ?? false}
          onValueChange={(v) => update('openToAdopting', v)}
          trackColor={{ false: colors.border, true: colors.primary + '60' }}
          thumbColor={formData.openToAdopting ? colors.primary : colors.textSecondary}
        />
      </View>
      <Text style={styles.questionLabel}>How many children do you already have?</Text>
      {KIDS_OPTIONS.map((opt) => (
        <SelectButton
          key={opt.value}
          label={opt.label}
          selected={formData.kidsExisting === opt.value}
          onPress={() => update('kidsExisting', opt.value)}
        />
      ))}

            {/* Relationship */}
            <Text style={styles.sectionTitle}>Relationship</Text>
            <Text style={styles.questionLabel}>What kind of relationship are you looking for?</Text>
            {RELATIONSHIP_OPTIONS.map((opt) => (
              <SelectButton
                key={opt.value}
                label={opt.label}
                selected={formData.relationshipType === opt.value}
                onPress={() => update('relationshipType', opt.value)}
              />
            ))}
            <Text style={styles.questionLabel}>Do you want marriage or a legally committed partnership?</Text>
            {MARRIAGE_PARTNERSHIP_OPTIONS.map((opt) => (
              <SelectButton
                key={opt.value}
                label={opt.label}
                selected={formData.marriagePartnershipPreference === opt.value}
                onPress={() => update('marriagePartnershipPreference', opt.value)}
              />
            ))}

            {/* Location */}
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.questionLabel}>Where do you see yourself living in the future? (Select all that apply)</Text>
            {FUTURE_LIVING_OPTIONS.map((opt) => (
              <MultiSelectButton
                key={opt.value}
                label={opt.label}
                selected={formData.futureLivingLocation.includes(opt.value)}
                onPress={() => {
                  const current = formData.futureLivingLocation;
                  const next = current.includes(opt.value)
                    ? current.filter((x) => x !== opt.value)
                    : [...current, opt.value];
                  update('futureLivingLocation', next);
                }}
              />
            ))}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Are you willing to relocate?</Text>
              <Switch
                value={formData.willingToRelocate ?? false}
                onValueChange={(v) => update('willingToRelocate', v)}
                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                thumbColor={formData.willingToRelocate ? colors.primary : colors.textSecondary}
              />
            </View>

            {/* Time */}
            <Text style={styles.sectionTitle}>Time & Availability</Text>
            <Text style={styles.questionLabel}>Typical work week hours</Text>
            {WORK_WEEK_HOURS_OPTIONS.map((opt) => (
              <SelectButton
                key={opt.value}
                label={opt.label}
                selected={formData.workWeekHours === opt.value}
                onPress={() => update('workWeekHours', opt.value)}
              />
            ))}
            <Text style={styles.questionLabel}>Hours per week of quality time desired</Text>
            {HOURS_PER_WEEK_QUALITY_TIME_OPTIONS.map((opt) => (
              <SelectButton
                key={opt.value}
                label={opt.label}
                selected={formData.hoursPerWeekQualityTime === opt.value}
                onPress={() => update('hoursPerWeekQualityTime', opt.value)}
              />
            ))}

            {/* Sex / Intimacy */}
            <Text style={styles.sectionTitle}>Sex & Intimacy</Text>
            <ScaleSelect
              label="How important is sex to you in a romantic relationship? (1-7)"
              value={formData.sexualConnectionImportance}
              min={1}
              max={7}
              onSelect={(v) => update('sexualConnectionImportance', v)}
            />
            <Text style={styles.questionLabel}>How often do you desire to have sex?</Text>
            {SEX_FREQUENCY_OPTIONS.map((opt) => (
              <SelectButton
                key={opt.value}
                label={opt.label}
                selected={formData.sexFrequency === opt.value}
                onPress={() => update('sexFrequency', opt.value)}
              />
            ))}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Is this frequency flexible?</Text>
              <Switch
                value={formData.sexFrequencyFlexible ?? false}
                onValueChange={(v) => update('sexFrequencyFlexible', v)}
                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                thumbColor={formData.sexFrequencyFlexible ? colors.primary : colors.textSecondary}
              />
            </View>
            <ScaleSelect
              label="How open are you to exploring new sexual experiences with a partner? (1 = Very Closed, 7 = Very Open)"
              value={formData.sexualExplorationOpenness}
              min={1}
              max={7}
              onSelect={(v) => update('sexualExplorationOpenness', v)}
            />

            {/* Financial support */}
            <Text style={styles.sectionTitle}>Financial Values</Text>
            <Text style={styles.questionLabel}>
              Which best reflects your expectations around financial support in a relationship?
            </Text>
            {FINANCIAL_SUPPORT_OPTIONS.map((opt) => (
              <SelectButton
                key={opt.value}
                label={opt.label}
                selected={formData.financialSupportExpectation === opt.value}
                onPress={() => update('financialSupportExpectation', opt.value)}
              />
            ))}
            <ScaleSelect
              label="How important is it to you that your partner shares these values? (1-7)"
              value={formData.partnerSharesFinancialValuesImportance}
              min={1}
              max={7}
              onSelect={(v) => update('partnerSharesFinancialValuesImportance', v)}
            />

            {/* Financial structure */}
            <Text style={styles.questionLabel}>
              In a committed relationship, which financial structure feels more natural to you?
            </Text>
            {FINANCIAL_STRUCTURE_OPTIONS.map((opt) => (
              <SelectButton
                key={opt.value}
                label={opt.label}
                selected={formData.financialStructure === opt.value}
                onPress={() => update('financialStructure', opt.value)}
              />
            ))}
            <ScaleSelect
              label="How important is it to you that your partner shares these values? (1-7)"
              value={formData.partnerSharesFinancialStructureImportance}
              min={1}
              max={7}
              onSelect={(v) => update('partnerSharesFinancialStructureImportance', v)}
            />

            {/* Financial risk */}
            <ScaleSelect
              label="How comfortable are you with financial risk? (1 = Very uncomfortable, 7 = Very Comfortable)"
              value={formData.financialRiskComfort}
              min={1}
              max={7}
              onSelect={(v) => update('financialRiskComfort', v)}
            />
            <Text style={styles.questionLabel}>What is your income? (Use income ranges)</Text>
            {INCOME_RANGE_OPTIONS.map((opt) => (
              <SelectButton
                key={opt.value}
                label={opt.label}
                selected={formData.incomeRange === opt.value}
                onPress={() => update('incomeRange', opt.value)}
              />
            ))}

            {/* Cleanliness */}
            <Text style={styles.sectionTitle}>Living Habits</Text>
            <Text style={styles.questionLabel}>
              Which best describes your preferred baseline for cleanliness in shared living spaces?
            </Text>
            {CLEANLINESS_OPTIONS.map((opt) => (
              <SelectButton
                key={opt.value}
                label={opt.label}
                selected={formData.cleanlinessPreference === opt.value}
                onPress={() => update('cleanlinessPreference', opt.value)}
              />
            ))}
            <ScaleSelect
              label="How important is it that your partner shares your same cleanliness habits? (1-7)"
              value={formData.partnerSharesCleanlinessImportance}
              min={1}
              max={7}
              onSelect={(v) => update('partnerSharesCleanlinessImportance', v)}
            />

            {/* Physical */}
            <Text style={styles.sectionTitle}>About You</Text>
            <Text style={styles.questionLabel}>What is your weight?</Text>
            {WEIGHT_OPTIONS.map((opt) => (
              <SelectButton
                key={opt.value}
                label={opt.label}
                selected={formData.weight === opt.value}
                onPress={() => update('weight', opt.value)}
              />
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
