import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { theme } from '@/shared/theme/theme';
import { FormField } from '@/shared/ui/FormField';
import {
  BODY_TYPE_ATTRACTION_IDS,
  parseBodyTypeAttraction,
  type BodyTypeAttractionId,
} from '@/shared/constants/bodyTypeAttraction';

/**
 * Multi-select body-type preference. Stores canonical ids array (`[]` = no preference).
 */
export const BodyTypeAttractionSelect: React.FC<{
  value?: unknown;
  onChange?: (next: BodyTypeAttractionId[]) => void;
  label?: string;
}> = ({ value, onChange, label = 'What body type are you attracted to?' }) => {
  const ids = useMemo(() => parseBodyTypeAttraction(value), [value]);
  const noPreference = ids.length === 0;

  const toggle = (id: BodyTypeAttractionId) => {
    if (!onChange) return;
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };

  return (
    <FormField label={label} helperText="Select all that apply.">
      <View style={styles.chipWrap}>
        <Pressable
          style={[styles.chip, noPreference && styles.chipSelected]}
          onPress={() => onChange?.([])}
        >
          <Text style={[styles.chipText, noPreference && styles.chipTextSelected]}>
            No preference
          </Text>
        </Pressable>
        {BODY_TYPE_ATTRACTION_IDS.map((id) => {
          const selected = ids.includes(id);
          return (
            <Pressable
              key={id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggle(id)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{id}</Text>
            </Pressable>
          );
        })}
      </View>
    </FormField>
  );
};

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    maxWidth: '100%',
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(91,168,232,0.2)',
  },
  chipText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  chipTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
