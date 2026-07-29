import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { HobbiesPicker } from '@/shared/components/HobbiesPicker';
import { hobbiesStringToIds, hobbiesIdsToString } from '@/shared/utils/hobbiesHelpers';
import {
  getHobbiesByIds,
  MAX_HOBBY_SELECTIONS,
  MIN_HOBBY_SELECTIONS,
  HOBBY_DEFINITION,
} from '@/shared/constants/hobbies';
import { theme } from '@/shared/theme/theme';

export type HobbiesFieldsProps = {
  hobbies: string;
  professionalHobbyId: string | null | undefined;
  onHobbiesChange: (hobbies: string) => void;
  onProfessionalHobbyIdChange: (id: string | null) => void;
};

/** Shared hobbies picker + optional professional-hobby marker (onboarding + edit profile). */
export const HobbiesFields: React.FC<HobbiesFieldsProps> = ({
  hobbies,
  professionalHobbyId,
  onHobbiesChange,
  onProfessionalHobbyIdChange,
}) => {
  const selectedIds = hobbiesStringToIds(hobbies);
  const selectedHobbies = getHobbiesByIds(selectedIds);

  const handleSelectedIdsChange = useCallback(
    (ids: string[]) => {
      onHobbiesChange(hobbiesIdsToString(ids));
      if (professionalHobbyId && !ids.includes(professionalHobbyId)) {
        onProfessionalHobbyIdChange(null);
      }
    },
    [onHobbiesChange, onProfessionalHobbyIdChange, professionalHobbyId],
  );

  const removeSelected = useCallback(
    (id: string) => {
      handleSelectedIdsChange(selectedIds.filter((x) => x !== id));
    },
    [handleSelectedIdsChange, selectedIds],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.description}>{HOBBY_DEFINITION}</Text>
      <Text style={styles.selectionHint}>
        Choose {MIN_HOBBY_SELECTIONS}–{MAX_HOBBY_SELECTIONS} hobbies.
      </Text>

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

      {selectedIds.length > 0 ? (
        <>
          <Text style={styles.proLabel}>
            Optionally, mark one as your "professional hobby" (you spend 20+ hours a week on it — the
            center of your life).
          </Text>
          <View style={styles.proOptions}>
            <TouchableOpacity
              style={[
                styles.proOption,
                (professionalHobbyId === null || professionalHobbyId === undefined) &&
                  styles.proOptionSelected,
              ]}
              onPress={() => onProfessionalHobbyIdChange(null)}
            >
              <Text style={styles.proOptionText}>None</Text>
            </TouchableOpacity>
            {selectedHobbies.map((h) => (
              <TouchableOpacity
                key={h.id}
                style={[
                  styles.proOption,
                  professionalHobbyId === h.id ? styles.proOptionSelected : undefined,
                ]}
                onPress={() => onProfessionalHobbyIdChange(h.id)}
              >
                <Text style={styles.proOptionText}>{h.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
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
  proLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 8,
    marginBottom: 12,
    lineHeight: 18,
  },
  proOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  proOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  proOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceElevated,
  },
  proOptionText: {
    fontSize: 14,
    color: theme.colors.text,
  },
});
