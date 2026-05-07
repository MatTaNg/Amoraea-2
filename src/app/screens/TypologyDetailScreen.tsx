import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TypologyRepository } from '@data/repositories/TypologyRepository';
import { TypologyUseCase } from '@domain/useCases/TypologyUseCase';
import {
  BigFiveFormData,
  AttachmentFormData,
  SchwartzFormData,
  SCHWARTZ_VALUE_LABELS,
  SCHWARTZ_FORM_KEYS,
} from '@domain/models/TypologyForm';
import { TypologyType } from '@domain/models/Typology';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { NumericRangeInput } from '@ui/components/NumericRangeInput';
import { ScaleSelect } from '@ui/components/ScaleSelect';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { Ionicons } from '@expo/vector-icons';

const typologyRepository = new TypologyRepository();
const typologyUseCase = new TypologyUseCase(typologyRepository);

const TYPOLOGY_NAMES: Record<TypologyType, string> = {
  big_five: 'Big Five',
  attachment_style: 'Attachment Styles',
  schwartz_values: 'Schwartz Values',
};

const TYPOLOGY_EXTERNAL_TEST_URLS: Record<TypologyType, string> = {
  big_five: 'https://bigfive-test.com/test',
  attachment_style: 'https://quiz.attachmentproject.com/',
  schwartz_values: 'https://aidaform.com/templates/pvq-test.html',
};

const TYPOLOGY_ESTIMATED_TIME: Partial<Record<TypologyType, string>> = {
  big_five: '10m',
  attachment_style: '5m',
  schwartz_values: '10m',
};

const defaultBigFive: BigFiveFormData = {
  openness: null,
  conscientiousness: null,
  extraversion: null,
  agreeableness: null,
  neuroticism: null,
};

const defaultAttachment: AttachmentFormData = {
  avoidant: null,
  anxious: null,
};

const defaultSchwartz: SchwartzFormData = {
  universalism: null,
  benevolence: null,
  tradition: null,
  conformity: null,
  security: null,
  power: null,
  achievement: null,
  hedonism: null,
  stimulation: null,
  self_direction: null,
};

function toRecord(data: BigFiveFormData | AttachmentFormData | SchwartzFormData): Record<string, unknown> {
  return { ...data };
}

/** Stable signature so server-loaded vs form state compare reliably. */
function recordSignature(r: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(r).sort()) sorted[k] = r[k];
  return JSON.stringify(sorted);
}

function isBigFiveComplete(d: BigFiveFormData): boolean {
  return (
    d.openness !== null &&
    d.conscientiousness !== null &&
    d.extraversion !== null &&
    d.agreeableness !== null &&
    d.neuroticism !== null
  );
}

function isAttachmentComplete(d: AttachmentFormData): boolean {
  return d.avoidant !== null && d.anxious !== null;
}

function isSchwartzComplete(d: SchwartzFormData): boolean {
  return SCHWARTZ_FORM_KEYS.every((k) => d[k] !== null);
}

export const TypologyDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { type, userId } = route.params;
  const [bigFiveData, setBigFiveData] = useState<BigFiveFormData>(defaultBigFive);
  const [attachmentData, setAttachmentData] = useState<AttachmentFormData>(defaultAttachment);
  const [schwartzData, setSchwartzData] = useState<SchwartzFormData>(defaultSchwartz);
  const queryClient = useQueryClient();
  /** Last payload signature successfully persisted (or hydrated from DB) — avoids duplicate upserts. */
  const lastPersistedSigRef = useRef<string | null>(null);
  /** Detect complete → incomplete so we clear `lastPersistedSigRef` without racing hydration. */
  const prevHadCompleteRecordRef = useRef(false);

  useEffect(() => {
    lastPersistedSigRef.current = null;
    prevHadCompleteRecordRef.current = false;
  }, [type]);

  const { data: typology, isLoading } = useQuery({
    queryKey: ['typology', userId, type],
    queryFn: () => typologyUseCase.getTypology(userId, type),
  });

  const upsertMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      typologyUseCase.upsertTypology(userId, type, { typologyData: data }),
    onSuccess: (_data, variables) => {
      lastPersistedSigRef.current = recordSignature(variables);
      queryClient.invalidateQueries({ queryKey: ['typology', userId, type] });
      queryClient.invalidateQueries({ queryKey: ['profileCompletion', userId] });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Couldn't save typology", msg);
    },
  });

  useEffect(() => {
    const data = typology?.typologyData;
    if (!data) {
      lastPersistedSigRef.current = null;
      if (type === 'big_five') setBigFiveData(defaultBigFive);
      else if (type === 'attachment_style') setAttachmentData(defaultAttachment);
      else if (type === 'schwartz_values') setSchwartzData(defaultSchwartz);
      return;
    }
    if (type === 'big_five') {
      const next: BigFiveFormData = {
        openness: (data.openness as number) ?? null,
        conscientiousness: (data.conscientiousness as number) ?? null,
        extraversion: (data.extraversion as number) ?? null,
        agreeableness: (data.agreeableness as number) ?? null,
        neuroticism: (data.neuroticism as number) ?? null,
      };
      setBigFiveData(next);
      lastPersistedSigRef.current = isBigFiveComplete(next)
        ? recordSignature(toRecord(next))
        : null;
    } else if (type === 'attachment_style') {
      const next: AttachmentFormData = {
        avoidant: (data.avoidant as number) ?? null,
        anxious: (data.anxious as number) ?? null,
      };
      setAttachmentData(next);
      lastPersistedSigRef.current = isAttachmentComplete(next)
        ? recordSignature(toRecord(next))
        : null;
    } else if (type === 'schwartz_values') {
      const next: SchwartzFormData = {
        universalism: (data.universalism as number) ?? null,
        benevolence: (data.benevolence as number) ?? null,
        tradition: (data.tradition as number) ?? null,
        conformity: (data.conformity as number) ?? null,
        security: (data.security as number) ?? null,
        power: (data.power as number) ?? null,
        achievement: (data.achievement as number) ?? null,
        hedonism: (data.hedonism as number) ?? null,
        stimulation: (data.stimulation as number) ?? null,
        self_direction: (data.self_direction as number) ?? null,
      };
      setSchwartzData(next);
      lastPersistedSigRef.current = isSchwartzComplete(next)
        ? recordSignature(toRecord(next))
        : null;
    }
  }, [typology, type]);

  useEffect(() => {
    if (isLoading) return;

    let record: Record<string, unknown> | null = null;
    if (type === 'big_five' && isBigFiveComplete(bigFiveData)) record = toRecord(bigFiveData);
    else if (type === 'attachment_style' && isAttachmentComplete(attachmentData))
      record = toRecord(attachmentData);
    else if (type === 'schwartz_values' && isSchwartzComplete(schwartzData))
      record = toRecord(schwartzData);

    if (!record) {
      if (prevHadCompleteRecordRef.current) {
        lastPersistedSigRef.current = null;
      }
      prevHadCompleteRecordRef.current = false;
      return;
    }

    prevHadCompleteRecordRef.current = true;
    const sig = recordSignature(record);
    if (sig === lastPersistedSigRef.current || upsertMutation.isPending) return;

    upsertMutation.mutate(record);
  }, [
    bigFiveData,
    attachmentData,
    schwartzData,
    type,
    isLoading,
    upsertMutation.isPending,
    upsertMutation.mutate,
  ]);

  const openExternalTest = () => {
    const url = TYPOLOGY_EXTERNAL_TEST_URLS[type];
    Linking.openURL(url).catch((err) => console.warn('Failed to open URL:', err));
  };

  const handleSave = () => {
    if (type === 'big_five') upsertMutation.mutate(toRecord(bigFiveData));
    else if (type === 'attachment_style') upsertMutation.mutate(toRecord(attachmentData));
    else if (type === 'schwartz_values') upsertMutation.mutate(toRecord(schwartzData));
  };

  const renderForm = () => {
    if (type === 'big_five') {
      return (
        <>
          <Text style={styles.sectionTitle}>Enter your Big Five scores (1-100)</Text>
          <Text style={styles.formHint}>Take the external test or enter results from a previous assessment.</Text>
          <Button
            title={`Take External Test${TYPOLOGY_ESTIMATED_TIME[type] ? ` (${TYPOLOGY_ESTIMATED_TIME[type]})` : ''}`}
            onPress={openExternalTest}
            variant="outline"
            style={styles.testButton}
          />
          <NumericRangeInput
            label="Openness"
            value={bigFiveData.openness}
            min={1}
            max={100}
            onChange={(v) => setBigFiveData((prev) => ({ ...prev, openness: v }))}
          />
          <NumericRangeInput
            label="Conscientiousness"
            value={bigFiveData.conscientiousness}
            min={1}
            max={100}
            onChange={(v) => setBigFiveData((prev) => ({ ...prev, conscientiousness: v }))}
          />
          <NumericRangeInput
            label="Extraversion"
            value={bigFiveData.extraversion}
            min={1}
            max={100}
            onChange={(v) => setBigFiveData((prev) => ({ ...prev, extraversion: v }))}
          />
          <NumericRangeInput
            label="Agreeableness"
            value={bigFiveData.agreeableness}
            min={1}
            max={100}
            onChange={(v) => setBigFiveData((prev) => ({ ...prev, agreeableness: v }))}
          />
          <NumericRangeInput
            label="Neuroticism"
            value={bigFiveData.neuroticism}
            min={1}
            max={100}
            onChange={(v) => setBigFiveData((prev) => ({ ...prev, neuroticism: v }))}
          />
        </>
      );
    }

    if (type === 'attachment_style') {
      return (
        <>
          <Text style={styles.sectionTitle}>Enter your attachment style percentages (1-100)</Text>
          <Text style={styles.formHint}>Take the external test or enter results from a previous assessment.</Text>
          <Button
            title={`Take External Test${TYPOLOGY_ESTIMATED_TIME[type] ? ` (${TYPOLOGY_ESTIMATED_TIME[type]})` : ''}`}
            onPress={openExternalTest}
            variant="outline"
            style={styles.testButton}
          />
          <NumericRangeInput
            label="Avoidant (%)"
            value={attachmentData.avoidant}
            min={1}
            max={100}
            onChange={(v) => setAttachmentData((prev) => ({ ...prev, avoidant: v }))}
          />
          <NumericRangeInput
            label="Anxious (%)"
            value={attachmentData.anxious}
            min={1}
            max={100}
            onChange={(v) => setAttachmentData((prev) => ({ ...prev, anxious: v }))}
          />
        </>
      );
    }

    if (type === 'schwartz_values') {
      return (
        <>
          <Text style={styles.sectionTitle}>Rate each value (1-10)</Text>
          <Text style={styles.formHint}>Take the external test or rate each value yourself.</Text>
          <Button
            title={`Take External Test${TYPOLOGY_ESTIMATED_TIME[type] ? ` (${TYPOLOGY_ESTIMATED_TIME[type]})` : ''}`}
            onPress={openExternalTest}
            variant="outline"
            style={styles.testButton}
          />
          {SCHWARTZ_FORM_KEYS.map((key) => (
            <View key={key} style={styles.schwartzValueBlock}>
              <Text style={styles.schwartzValueTitle}>{SCHWARTZ_VALUE_LABELS[key].title}</Text>
              <Text style={styles.schwartzValueDesc}>{SCHWARTZ_VALUE_LABELS[key].description}</Text>
              <ScaleSelect
                value={schwartzData[key]}
                min={1}
                max={10}
                onSelect={(v) => setSchwartzData((prev) => ({ ...prev, [key]: v }))}
              />
            </View>
          ))}
        </>
      );
    }

    return null;
  };

  return (
    <SafeAreaContainer>
      <View style={styles.flexFill}>
        {isLoading ? (
          <View style={styles.pageLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : (
          <>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
              {renderForm()}
              <View style={styles.saveSpacer} />
            </ScrollView>
            <View style={styles.footer}>
              <Button
                title="Save"
                onPress={handleSave}
                disabled={upsertMutation.isPending}
                style={styles.saveButton}
              />
            </View>
          </>
        )}
        {upsertMutation.isPending && (
          <View
            style={styles.savingOverlay}
            pointerEvents="auto"
            accessibilityRole="progressbar"
            accessibilityLabel="Saving typology"
          >
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.savingOverlayHint}>Saving…</Text>
          </View>
        )}
      </View>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  pageLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontSize: 15,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  savingOverlayHint: {
    marginTop: spacing.md,
    fontSize: 16,
    color: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  formHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  testButton: {
    marginBottom: spacing.lg,
  },
  schwartzValueBlock: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  schwartzValueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  schwartzValueDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
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
});
