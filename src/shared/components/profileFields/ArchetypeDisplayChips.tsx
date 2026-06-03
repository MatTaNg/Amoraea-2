import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import {
  type ArchetypeId,
  ARCHETYPE_BY_ID,
} from '@/shared/constants/archetypes';
import { theme } from '@/shared/theme/theme';

const FONT_BODY =
  Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type Props = {
  archetypeIds: ArchetypeId[];
  /** Optional section label; omit for chips only. */
  label?: string;
};

/** Read-only archetype badges for profile display. */
export const ArchetypeDisplayChips: React.FC<Props> = ({
  archetypeIds,
  label = 'Your archetypes',
}) => {
  if (archetypeIds.length === 0) return null;
  const defs = archetypeIds.map((id) => ARCHETYPE_BY_ID[id]);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chipRow}>
        {defs.map((def) => (
          <View key={def.id} style={styles.chip} accessibilityLabel={`Archetype ${def.name}`}>
            <Text style={styles.chipText}>
              {def.icon} {def.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.45)',
    backgroundColor: 'rgba(91,168,232,0.12)',
  },
  chipText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
