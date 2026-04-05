import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { STYLE_LABEL_TOOLTIPS } from '@utilities/styleTranslations';

export type CommunicationStyleSectionProps = {
  primary: string[] | null | undefined;
  secondary: string[] | null | undefined;
  lowConfidenceNote: string | null | undefined;
  loading?: boolean;
};

export const CommunicationStyleSection: React.FC<CommunicationStyleSectionProps> = ({
  primary,
  secondary,
  lowConfidenceNote,
  loading,
}) => {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>How they communicate</Text>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  const prim = primary?.filter(Boolean) ?? [];
  const sec = secondary?.filter(Boolean) ?? [];

  if (prim.length === 0 && sec.length === 0 && !lowConfidenceNote) {
    return null;
  }

  const tooltip = selectedLabel ? STYLE_LABEL_TOOLTIPS[selectedLabel] ?? null : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.divider}>────────────────────</Text>
      <Text style={styles.title}>How they communicate</Text>

      {prim.length > 0 ? (
        <View style={styles.primaryRow}>
          {prim.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 ? <Text style={styles.dotSep}> · </Text> : null}
              <Pressable onPress={() => setSelectedLabel(selectedLabel === label ? null : label)} style={styles.chip}>
                <Text style={styles.chipText}>{label}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      ) : null}

      {sec.length > 0 ? (
        <View style={styles.secondaryBlock}>
          {sec.map((label) => (
            <Pressable
              key={label}
              onPress={() => setSelectedLabel(selectedLabel === label ? null : label)}
              style={styles.secondaryLine}
            >
              <Text style={styles.secondaryText}>
                <Text style={styles.plus}>+ </Text>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {tooltip ? (
        <Text style={styles.tooltip}>{tooltip}</Text>
      ) : null}

      {lowConfidenceNote ? <Text style={styles.lowConf}>{lowConfidenceNote}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
  },
  divider: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  muted: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  primaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dotSep: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  chipText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  secondaryBlock: {
    gap: 4,
  },
  secondaryLine: {
    alignSelf: 'flex-start',
  },
  secondaryText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  plus: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tooltip: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  lowConf: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
});
