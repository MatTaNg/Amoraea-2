import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  ARCHETYPE_BY_ID,
  ARCHETYPE_CATEGORIES,
  MAX_PROFILE_ARCHETYPES,
  type ArchetypeId,
} from '@/shared/constants/archetypes';
import { theme } from '@/shared/theme/theme';

const FONT_BODY =
  Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

const ACCENT = theme.colors.primary;

type Props = {
  value: ArchetypeId[];
  onChange: (next: ArchetypeId[]) => void;
};

export const ArchetypeSelector: React.FC<Props> = ({ value, onChange }) => {
  const atCapacity = value.length >= MAX_PROFILE_ARCHETYPES;

  const toggle = useCallback(
    (id: ArchetypeId) => {
      if (value.includes(id)) {
        onChange(value.filter((x) => x !== id));
        return;
      }
      if (atCapacity) return;
      onChange([...value, id]);
    },
    [atCapacity, onChange, value],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.lead}>
        Choose up to {MAX_PROFILE_ARCHETYPES} archetypes that feel most like you. These help others
        understand your energy in relationships.
      </Text>
      <Text style={styles.counter}>
        {value.length} / {MAX_PROFILE_ARCHETYPES} selected
      </Text>

      {ARCHETYPE_CATEGORIES.map((category) => (
        <View key={category.title} style={styles.categoryBlock}>
          <Text style={styles.categoryTitle}>{category.title}</Text>
          <View style={styles.cardRow}>
            {category.archetypeIds.map((id) => {
              const def = ARCHETYPE_BY_ID[id];
              const selected = value.includes(id);
              const disabled = atCapacity && !selected;

              return (
                <Pressable
                  key={id}
                  onPress={() => toggle(id)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={`${def.name}. ${def.descriptor}`}
                  style={({ pressed }) => [
                    styles.card,
                    selected && styles.cardSelected,
                    disabled && styles.cardDisabled,
                    pressed && !disabled && styles.cardPressed,
                  ]}
                >
                  <Text style={[styles.cardName, selected && styles.cardNameSelected]}>
                    {def.name}
                  </Text>
                  <Text style={styles.cardIcon} accessibilityElementsHidden importantForAccessibility="no">
                    {def.icon}
                  </Text>
                  <Text
                    style={[styles.cardDescriptor, selected && styles.cardDescriptorSelected]}
                    numberOfLines={3}
                  >
                    {def.descriptor}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    marginBottom: 8,
  },
  lead: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 10,
  },
  counter: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  categoryBlock: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '31%',
    minWidth: 100,
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(91,168,232,0.18)',
  },
  cardDisabled: {
    opacity: 0.4,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardName: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '700',
    color: '#E8F0F8',
    marginBottom: 6,
  },
  cardNameSelected: {
    color: '#fff',
  },
  cardDescriptor: {
    fontFamily: FONT_BODY,
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.58)',
  },
  cardIcon: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 6,
  },
  cardDescriptorSelected: {
    color: 'rgba(255,255,255,0.78)',
  },
});
