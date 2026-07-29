import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getSelectableHobbies,
  HOBBY_CATEGORIES,
  MAX_HOBBY_SELECTIONS,
  MIN_HOBBY_SELECTIONS,
  type HobbyCategory,
} from '@/shared/constants/hobbies';
import { theme } from '@/shared/theme/theme';

const FONT_BODY =
  Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

export type HobbiesPickerProps = {
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  minSelections?: number;
  maxSelections?: number;
};

export const HobbiesPicker: React.FC<HobbiesPickerProps> = ({
  selectedIds,
  onSelectedIdsChange,
  minSelections = MIN_HOBBY_SELECTIONS,
  maxSelections = MAX_HOBBY_SELECTIONS,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<HobbyCategory>>(
    () => new Set(),
  );

  const toggleCategory = useCallback((category: HobbyCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const toggleHobby = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onSelectedIdsChange(selectedIds.filter((x) => x !== id));
        return;
      }
      if (selectedIds.length >= maxSelections) {
        return;
      }
      onSelectedIdsChange([...selectedIds, id]);
    },
    [maxSelections, onSelectedIdsChange, selectedIds],
  );

  const hobbiesByCategory = useMemo(
    () =>
      HOBBY_CATEGORIES.map((category) => ({
        category,
        items: getSelectableHobbies().filter((h) => h.category === category),
      })),
    [],
  );

  const atCapacity = selectedIds.length >= maxSelections;

  return (
    <View style={styles.root}>
      <Text style={styles.countLabel}>
        {selectedIds.length}/{maxSelections} selected · choose {minSelections}–{maxSelections}
      </Text>
      <Text style={styles.expandHint}>Tap a category to browse hobbies</Text>

      {hobbiesByCategory.map(({ category, items }) => {
        const expanded = expandedCategories.has(category);
        const selectedInCategory = items.filter((h) => selectedIds.includes(h.id)).length;

        return (
          <View key={category} style={styles.section}>
            <Pressable
              onPress={() => toggleCategory(category)}
              style={({ pressed }) => [
                styles.sectionHeader,
                pressed && styles.sectionHeaderPressed,
                expanded && styles.sectionHeaderExpanded,
              ]}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${category}, ${selectedInCategory} selected`}
            >
              <View style={styles.sectionHeaderMain}>
                <Ionicons
                  name={expanded ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={theme.colors.textSecondary}
                  style={styles.sectionCaret}
                />
                <Text style={styles.sectionTitle}>{category}</Text>
              </View>
              {selectedInCategory > 0 ? (
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{selectedInCategory}</Text>
                </View>
              ) : null}
            </Pressable>

            {expanded ? (
              <View style={styles.chipWrap}>
                {items.map((hobby) => {
                  const selected = selectedIds.includes(hobby.id);
                  const disabled = !selected && atCapacity;
                  return (
                    <Pressable
                      key={hobby.id}
                      onPress={() => toggleHobby(hobby.id)}
                      disabled={disabled}
                      style={[
                        styles.chip,
                        selected && styles.chipSelected,
                        disabled && styles.chipDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                          disabled && styles.chipTextDisabled,
                        ]}
                      >
                        {hobby.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    gap: 0,
  },
  countLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    fontFamily: FONT_BODY,
  },
  expandHint: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginBottom: 12,
    fontFamily: FONT_BODY,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  sectionHeaderPressed: {
    opacity: 0.85,
  },
  sectionHeaderExpanded: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceElevated,
    marginBottom: 10,
  },
  sectionHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  sectionCaret: {
    marginRight: 8,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    fontFamily: FONT_BODY,
  },
  sectionBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  sectionBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT_BODY,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceElevated,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: FONT_BODY,
  },
  chipTextSelected: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  chipTextDisabled: {
    color: theme.colors.textSecondary,
  },
});
