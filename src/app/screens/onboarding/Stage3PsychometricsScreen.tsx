import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { ScaleSelect } from '@ui/components/ScaleSelect';
import { ProgressBar } from '@ui/components/ProgressBar';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import {
  ECR12,
  TIPI,
  DSI,
  BRS,
  PVQ21,
  ECR_SCALE_MAX,
  TIPI_SCALE_MAX,
  DSI_SCALE_MAX,
  BRS_SCALE_MAX,
  PVQ_SCALE_MAX,
  FullAssessmentData,
  isFullAssessmentComplete,
} from '@features/assessment/assessmentData';
import { buildGate2Psychometrics, getSectionSummary } from '@features/onboarding/buildGate2Psychometrics';
import type { SectionId as BuildSectionId } from '@features/onboarding/buildGate2Psychometrics';

const profileRepository = new ProfileRepository();

type SectionId = 'intro' | 'ecr' | 'tipi' | 'dsi' | 'brs' | 'pvq';

const SECTIONS: { id: SectionId; title: string; subtitle: string; color: string }[] = [
  { id: 'intro', title: 'Deeper understanding', subtitle: '~15 min', color: colors.primary },
  { id: 'ecr', title: 'Attachment', subtitle: 'ECR-12 · 12 items', color: '#6B3FA0' },
  { id: 'tipi', title: 'Personality', subtitle: 'TIPI · 10 items', color: colors.success },
  { id: 'dsi', title: 'Self & Others', subtitle: 'DSI-SF · 20 items', color: colors.error },
  { id: 'brs', title: 'Resilience', subtitle: 'BRS · 6 items', color: '#2A5C5C' },
  { id: 'pvq', title: 'Values', subtitle: 'PVQ-21 · 21 items', color: colors.primary },
];

function getItems(section: SectionId) {
  switch (section) {
    case 'ecr': return ECR12;
    case 'tipi': return TIPI;
    case 'dsi': return DSI;
    case 'brs': return BRS;
    case 'pvq': return PVQ21;
    default: return [];
  }
}

function getScaleMax(section: SectionId): number {
  switch (section) {
    case 'ecr': return ECR_SCALE_MAX;
    case 'tipi': return TIPI_SCALE_MAX;
    case 'dsi': return DSI_SCALE_MAX;
    case 'brs': return BRS_SCALE_MAX;
    case 'pvq': return PVQ_SCALE_MAX;
    default: return 7;
  }
}

const defaultData: FullAssessmentData = {
  ecr: {},
  tipi: {},
  dsi: {},
  brs: {},
  pvq: {},
};

export const Stage3PsychometricsScreen: React.FC<{ navigation: any; route: { params: { userId: string } } }> = ({
  navigation,
  route,
}) => {
  const { userId } = route.params;
  const queryClient = useQueryClient();
  const [section, setSection] = useState<SectionId>('intro');
  const [itemIndex, setItemIndex] = useState(0);
  const [data, setData] = useState<FullAssessmentData>(defaultData);
  const [submitting, setSubmitting] = useState(false);
  const [resultsForSection, setResultsForSection] = useState<BuildSectionId | null>(null);
  const hasHydratedFromProgressRef = React.useRef(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepository.getProfile(userId),
    enabled: !!userId,
  });

  // Hydrate saved progress into state so we have it when user clicks Begin/Continue; do not auto-advance to first question
  React.useEffect(() => {
    const progress = profile?.psychometricsProgress;
    if (!progress || typeof progress !== 'object' || hasHydratedFromProgressRef.current) return;
    hasHydratedFromProgressRef.current = true;
    const hydrated: FullAssessmentData = {
      ecr: progress.ecr && typeof progress.ecr === 'object' ? progress.ecr : {},
      tipi: progress.tipi && typeof progress.tipi === 'object' ? progress.tipi : {},
      dsi: progress.dsi && typeof progress.dsi === 'object' ? progress.dsi : {},
      brs: progress.brs && typeof progress.brs === 'object' ? progress.brs : {},
      pvq: progress.pvq && typeof progress.pvq === 'object' ? progress.pvq : {},
    };
    setData(hydrated);
  }, [profile?.psychometricsProgress]);

  const answers = section === 'ecr' ? data.ecr : section === 'tipi' ? data.tipi : section === 'dsi' ? data.dsi : section === 'brs' ? data.brs : data.pvq;
  const setAnswers = useCallback(
    (key: keyof FullAssessmentData, updater: (prev: Record<string, number>) => Record<string, number>) => {
      setData((p) => ({ ...p, [key]: updater(p[key]) }));
    },
    []
  );

  const items = getItems(section);
  const item = items[itemIndex];
  const scaleMax = getScaleMax(section);
  const currentAnswer = item ? answers[item.id] : undefined;

  const getFirstIncompleteSection = useCallback((): { section: BuildSectionId; itemIndex: number } | null => {
    const order: BuildSectionId[] = ['ecr', 'tipi', 'dsi', 'brs', 'pvq'];
    const lengths = [ECR12.length, TIPI.length, DSI.length, BRS.length, PVQ21.length];
    for (let i = 0; i < order.length; i++) {
      const sid = order[i];
      const keys = Object.keys(data[sid]).length;
      if (keys < lengths[i]) return { section: sid, itemIndex: keys };
    }
    return null;
  }, [data]);

  const hasProgress = Object.keys(data.ecr).length > 0 || Object.keys(data.tipi).length > 0 ||
    Object.keys(data.dsi).length > 0 || Object.keys(data.brs).length > 0 || Object.keys(data.pvq).length > 0;

  const startOrContinue = () => {
    const first = getFirstIncompleteSection();
    if (first) {
      setSection(first.section);
      setItemIndex(first.itemIndex);
    } else {
      setSection('ecr');
      setItemIndex(0);
    }
  };

  const handleAnswer = (value: number) => {
    if (!item) return;
    const key = section as keyof FullAssessmentData;
    if (key === 'ecr') setAnswers('ecr', (p) => ({ ...p, [item.id]: value }));
    else if (key === 'tipi') setAnswers('tipi', (p) => ({ ...p, [item.id]: value }));
    else if (key === 'dsi') setAnswers('dsi', (p) => ({ ...p, [item.id]: value }));
    else if (key === 'brs') setAnswers('brs', (p) => ({ ...p, [item.id]: value }));
    else setAnswers('pvq', (p) => ({ ...p, [item.id]: value }));
    goNext(value);
  };

  const finishAndSave = async (finalDataOverride?: FullAssessmentData) => {
    const finalData: FullAssessmentData = finalDataOverride ?? data;
    if (!isFullAssessmentComplete(finalData)) {
      Alert.alert('Incomplete', 'Please answer all sections.');
      return;
    }
    const gate2 = buildGate2Psychometrics(finalData);
    if (!gate2) {
      Alert.alert('Error', 'Could not compute scores.');
      return;
    }
    setSubmitting(true);
    try {
      await profileRepository.upsertProfile(userId, {
        gate2Psychometrics: gate2,
        onboardingStage: 'compatibility',
        psychometricsProgress: null,
      });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      navigation.replace('Stage4Compatibility', { userId });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveProgress = async (updatedData: FullAssessmentData) => {
    try {
      await profileRepository.upsertProfile(userId, {
        psychometricsProgress: updatedData as unknown as Record<string, Record<string, number>>,
      });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save progress.');
    }
  };

  const goNext = async (overrideValue?: number) => {
    if (itemIndex < items.length - 1) {
      setItemIndex((i) => i + 1);
    } else {
      const key = section as keyof FullAssessmentData;
      const sectionData = data[key];
      const chosen = overrideValue ?? currentAnswer;
      const merged = item ? { ...sectionData, [item.id]: chosen } : sectionData;
      const updatedData: FullAssessmentData = { ...data, [key]: merged };
      setData(updatedData);

      const nextSectionIndex = SECTIONS.findIndex((s) => s.id === section) + 1;
      const nextSection = SECTIONS[nextSectionIndex]?.id;

      await saveProgress(updatedData);

      if (nextSection && nextSection !== 'intro') {
        setResultsForSection(section as BuildSectionId);
      } else {
        finishAndSave(updatedData);
      }
    }
  };

  const goBack = () => {
    if (itemIndex > 0) {
      setItemIndex((i) => i - 1);
    } else {
      setSection('intro');
    }
  };

  const canGoBack = true;

  if (section === 'intro') {
    return (
      <SafeAreaContainer>
        <ScrollView style={styles.container} contentContainerStyle={styles.introContent}>
          <Text style={styles.introTitle}>Deeper understanding</Text>
          <Text style={styles.introSubtitle}>
            To match you well, we use five short questionnaires: attachment (ECR-12), personality (TIPI), self & others (DSI-SF), resilience (BRS), and values (PVQ-21). About 15 minutes. No right answers.
          </Text>
          <View style={styles.introCards}>
            {SECTIONS.filter((s) => s.id !== 'intro').map((s) => (
              <View key={s.id} style={[styles.introCard, { borderLeftColor: s.color }]}>
                <Text style={[styles.introCardTitle, { color: s.color }]}>{s.title}</Text>
                <Text style={styles.introCardSub}>{s.subtitle}</Text>
              </View>
            ))}
          </View>
          <Button
            title={hasProgress ? 'Continue' : 'Begin'}
            onPress={startOrContinue}
            style={styles.introButton}
          />
        </ScrollView>
      </SafeAreaContainer>
    );
  }

  if (resultsForSection) {
    const summary = getSectionSummary(resultsForSection, data);
    const nextSectionIndex = SECTIONS.findIndex((s) => s.id === resultsForSection) + 1;
    const nextSection = SECTIONS[nextSectionIndex]?.id as SectionId | undefined;
    const sec = SECTIONS.find((s) => s.id === resultsForSection);
    return (
      <SafeAreaContainer>
        <ScrollView style={styles.container} contentContainerStyle={styles.resultsContent}>
          <Text style={styles.resultsTitle}>Your results</Text>
          <Text style={[styles.resultsSectionTitle, sec ? { color: sec.color } : undefined]}>
            {summary?.title ?? resultsForSection}
          </Text>
          {summary?.lines.map((line, i) => (
            <Text key={i} style={styles.resultsLine}>{line}</Text>
          ))}
          <Text style={styles.resultsHint}>Your progress is saved. You can continue later if you need to stop.</Text>
          <Button
            title={nextSection ? `Continue to ${SECTIONS.find((s) => s.id === nextSection)?.title ?? nextSection} →` : 'Complete →'}
            onPress={() => {
              setResultsForSection(null);
              if (nextSection && nextSection !== 'intro') {
                setSection(nextSection);
                setItemIndex(0);
              }
            }}
            style={styles.introButton}
          />
        </ScrollView>
      </SafeAreaContainer>
    );
  }

  if (!item) return null;

  const sec = SECTIONS.find((s) => s.id === section)!;

  return (
    <SafeAreaContainer>
      <View style={styles.header}>
        <ProgressBar currentStep={itemIndex + 1} totalSteps={items.length} />
        <Text style={[styles.sectionLabel, { color: sec.color }]}>{sec.title}</Text>
        <Text style={styles.sectionSub}>{sec.subtitle}</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.itemCounter}>
          {itemIndex + 1} of {items.length}
        </Text>
        <Text style={styles.itemText}>{item.text}</Text>
        <Text style={styles.itemHint}>Rate how well this describes you.</Text>
        <ScaleSelect
          value={currentAnswer ?? null}
          min={1}
          max={scaleMax}
          onSelect={handleAnswer}
        />
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={goBack}
          style={styles.footerBtn}
          disabled={!canGoBack}
        >
          <Text style={styles.footerBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  introContent: { padding: spacing.lg, paddingTop: spacing.xl },
  introTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  introSubtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.xl },
  introCards: { gap: spacing.sm, marginBottom: spacing.xl },
  introCard: {
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    padding: spacing.md,
    borderRadius: 8,
  },
  introCardTitle: { fontSize: 16, fontWeight: '600' },
  introCardSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  introButton: { marginTop: spacing.md },
  resultsContent: { padding: spacing.lg, paddingTop: spacing.xl },
  resultsTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  resultsSectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing.md },
  resultsLine: { fontSize: 15, color: colors.text, marginBottom: spacing.xs },
  resultsHint: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.lg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  sectionLabel: { fontSize: 18, fontWeight: '600', marginTop: spacing.sm },
  sectionSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  itemCounter: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  itemText: { fontSize: 17, color: colors.text, lineHeight: 24, marginBottom: spacing.xs },
  itemHint: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBtn: { padding: spacing.sm },
  footerBtnText: { fontSize: 15, color: colors.primary },
});
