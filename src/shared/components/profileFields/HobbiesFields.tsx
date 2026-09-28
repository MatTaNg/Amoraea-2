import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { HobbiesPicker } from '@/shared/components/HobbiesPicker';
import { hobbiesStringToIds, hobbiesIdsToString } from '@/shared/utils/hobbiesHelpers';
import {
  getHobbiesByIds,
  HOBBY_DEFINITION_EXAMPLE,
  HOBBY_DEFINITION_LEAD,
  HOBBY_SELECTION_HINT,
} from '@/shared/constants/hobbies';
import { theme } from '@/shared/theme/theme';

export type HobbiesFieldsProps = {
  hobbies: string;
  onHobbiesChange: (hobbies: string) => void;
  /** Hide step lead copy when the parent section already shows onboarding subtext. */
  variant?: 'default' | 'editProfile';
};

/** Shared hobbies picker (onboarding + edit profile). */
export const HobbiesFields: React.FC<HobbiesFieldsProps> = ({
  hobbies,
  onHobbiesChange,
  variant = 'default',
}) => {
  const selectedIds = hobbiesStringToIds(hobbies);
  const selectedHobbies = getHobbiesByIds(selectedIds);

  const handleSelectedIdsChange = useCallback(
    (ids: string[]) => {
      onHobbiesChange(hobbiesIdsToString(ids));
    },
    [onHobbiesChange],
  );

  const removeSelected = useCallback(
    (id: string) => {
      handleSelectedIdsChange(selectedIds.filter((x) => x !== id));
    },
    [handleSelectedIdsChange, selectedIds],
  );

  return (
    <View style={styles.root}>
      {variant === 'default' ? (
        <>
          <Text style={styles.description}>{HOBBY_DEFINITION_LEAD}</Text>
          <Text style={styles.example}>{HOBBY_DEFINITION_EXAMPLE}</Text>
          <Text style={styles.selectionHint}>{HOBBY_SELECTION_HINT}</Text>
        </>
      ) : null}

      <Text style={styles.selectedHeading}>Your selections</Text>
      {selectedHobbies.length === 0 ? (
        <Text style={styles.selectedEmpty}>Tap hobbies below to add them here.</Text>
      ) : (
        <View style={styles.selectedList}>
          {selectedHobbies.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => removeSelected(h.id)}
              style={styles.selectedChip}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${h.name}`}
            >
              <Text style={styles.selectedChipText}>{h.name}</Text>
              <Text style={styles.selectedChipRemove}>×</Text>
            </Pressable>
          ))}
        </View>
      )}

      <HobbiesPicker selectedIds={selectedIds} onSelectedIdsChange={handleSelectedIdsChange} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    gap: 0,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  example: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  selectionHint: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  selectedHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  selectedEmpty: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  selectedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceElevated,
  },
  selectedChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  selectedChipRemove: {
    fontSize: 18,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
});
