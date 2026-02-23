import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TypologyRepository } from '@data/repositories/TypologyRepository';
import { TypologyUseCase } from '@domain/useCases/TypologyUseCase';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { ScaleSelect } from '@ui/components/ScaleSelect';
import { ProgressBar } from '@ui/components/ProgressBar';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
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

const typologyRepository = new TypologyRepository();
const typologyUseCase = new TypologyUseCase(typologyRepository);

type SectionId = 'intro' | 'ecr' | 'tipi' | 'dsi' | 'brs' | 'pvq' | 'done';

const SECTIONS: { id: SectionId; title: string; subtitle: string; color: string }[] = [
  { id: 'intro', title: 'Compatibility Assessment', subtitle: '~15 min', color: colors.primary },
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

export const FullAssessmentScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { userId } = route.params;
  const queryClient = useQueryClient();
  const [section, setSection] = useState<SectionId>('intro');
  const [itemIndex, setItemIndex] = useState(0);
  const [data, setData] = useState<FullAssessmentData>(defaultData);

  const { data: existing } = useQuery({
    queryKey: ['typology', userId, 'full_assessment'],
    queryFn: () => typologyUseCase.getTypology(userId, 'full_assessment'),
  });

  const upsertMutation = useMutation({
    mutationFn: (payload: FullAssessmentData) =>
      typologyUseCase.upsertTypology(userId, 'full_assessment', {
        typologyData: payload as unknown as Record<string, unknown>,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['typology', userId, 'full_assessment'] });
      queryClient.invalidateQueries({ queryKey: ['profileCompletion', userId] });
    },
  });

  React.useEffect(() => {
    const raw = existing?.typologyData as FullAssessmentData | undefined;
    if (raw?.ecr && raw?.tipi && raw?.dsi && raw?.brs && raw?.pvq) {
      setData({
        ecr: raw.ecr as Record<string, number>,
        tipi: raw.tipi as Record<string, number>,
        dsi: raw.dsi as Record<string, number>,
        brs: raw.brs as Record<string, number>,
        pvq: raw.pvq as Record<string, number>,
      });
    }
  }, [existing]);

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

  const handleAnswer = (value: number) => {
    if (!item) return;
    const key = section as keyof FullAssessmentData;
    if (key === 'ecr') setAnswers('ecr', (p) => ({ ...p, [item.id]: value }));
    else if (key === 'tipi') setAnswers('tipi', (p) => ({ ...p, [item.id]: value }));
    else if (key === 'dsi') setAnswers('dsi', (p) => ({ ...p, [item.id]: value }));
    else if (key === 'brs') setAnswers('brs', (p) => ({ ...p, [item.id]: value }));
    else setAnswers('pvq', (p) => ({ ...p, [item.id]: value }));
  };

  const goNext = () => {
    if (itemIndex < items.length - 1) {
      setItemIndex((i) => i + 1);
    } else {
      const nextSectionIndex = SECTIONS.findIndex((s) => s.id === section) + 1;
      const nextSection = SECTIONS[nextSectionIndex]?.id;
      if (nextSection && nextSection !== 'intro' && nextSection !== 'done') {
        setSection(nextSection);
        setItemIndex(0);
      } else if (nextSection === 'done' || !nextSection) {
        // Ensure current item's answer is included (state may not have flushed yet)
        const key = section as keyof FullAssessmentData;
        const sectionData = data[key];
        const finalData: FullAssessmentData = item
          ? { ...data, [key]: { ...sectionData, [item.id]: currentAnswer! } }
          : { ...data };
        upsertMutation.mutate(finalData, {
          onSuccess: () => navigation.goBack(),
        });
      }
    }
  };

  const goBack = () => {
    if (itemIndex > 0) {
      setItemIndex((i) => i - 1);
    } else {
      const prevIndex = SECTIONS.findIndex((s) => s.id === section) - 1;
      const prevSection = SECTIONS[prevIndex]?.id;
      if (prevSection) {
        setSection(prevSection);
        const prevItems = getItems(prevSection);
        setItemIndex(prevItems.length - 1);
      } else {
        setSection('intro');
      }
    }
  };

  if (section === 'intro') {
    return (
      <SafeAreaContainer>
        <ScrollView style={styles.container} contentContainerStyle={styles.introContent}>
          <Text style={styles.introTitle}>Compatibility Assessment</Text>
          <Text style={styles.introSubtitle}>
            A research-grounded assessment: ECR-12 (attachment), TIPI (personality), DSI-SF (differentiation), BRS (resilience), PVQ-21 (values). No right answers — about 15 minutes.
          </Text>
          <View style={styles.introCards}>
            {SECTIONS.filter((s) => s.id !== 'intro' && s.id !== 'done').map((s) => (
              <View key={s.id} style={[styles.introCard, { borderLeftColor: s.color }]}>
                <Text style={[styles.introCardTitle, { color: s.color }]}>{s.title}</Text>
                <Text style={styles.introCardSub}>{s.subtitle}</Text>
              </View>
            ))}
          </View>
          <Button
            title="Begin assessment"
            onPress={() => setSection('ecr')}
            style={styles.introButton}
          />
        </ScrollView>
      </SafeAreaContainer>
    );
  }

  if (!item) return null;

  const sec = SECTIONS.find((s) => s.id === section)!;
  const canProceed = currentAnswer !== undefined;

  return (
    <SafeAreaContainer>
      <View style={styles.header}>
        <ProgressBar
          currentStep={itemIndex + 1}
          totalSteps={items.length}
        />
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
          disabled={section === 'ecr' && itemIndex === 0}
        >
          <Text style={styles.footerBtnText}>← Back</Text>
        </TouchableOpacity>
        <Button
          title={itemIndex < items.length - 1 ? 'Next →' : 'Complete section →'}
          onPress={goNext}
          disabled={!canProceed || upsertMutation.isPending}
        />
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
