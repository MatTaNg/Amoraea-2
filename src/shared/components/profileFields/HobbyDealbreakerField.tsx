import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppSelect } from '@/shared/ui/AppSelect';
import { getHobbiesByIds, HOBBY_PROFESSIONAL_LABEL } from '@/shared/constants/hobbies';
import { hobbiesStringToIds } from '@/shared/utils/hobbiesHelpers';
import { theme } from '@/shared/theme/theme';

const NONE_VALUE = '__none__';

export type HobbyDealbreakerFieldProps = {
  hobbies: string;
  professionalHobbyId: string | null | undefined;
  onProfessionalHobbyIdChange: (id: string | null) => void;
};

export function HobbyDealbreakerField({
  hobbies,
  professionalHobbyId,
  onProfessionalHobbyIdChange,
}: HobbyDealbreakerFieldProps) {
  const selectedHobbies = useMemo(
    () => getHobbiesByIds(hobbiesStringToIds(hobbies)),
    [hobbies],
  );

  const options = useMemo(
    () => [
      ...selectedHobbies.map((h) => ({ label: h.name, value: h.id })),
      { label: 'None of these would be a dealbreaker', value: NONE_VALUE },
    ],
    [selectedHobbies],
  );

  const value =
    professionalHobbyId == null || professionalHobbyId === ''
      ? NONE_VALUE
      : String(professionalHobbyId);

  if (selectedHobbies.length === 0) {
    return (
      <View style={styles.emptyBlock}>
        <Text style={styles.question}>{HOBBY_PROFESSIONAL_LABEL}</Text>
        <Text style={styles.emptyHint}>Add hobbies on the Essentials tab to answer this.</Text>
      </View>
    );
  }

  return (
    <AppSelect
      label={HOBBY_PROFESSIONAL_LABEL}
      value={value}
      options={options}
      onValueChange={(next) =>
        onProfessionalHobbyIdChange(next === NONE_VALUE ? null : next)
      }
      sheetTitle={HOBBY_PROFESSIONAL_LABEL}
    />
  );
}

const styles = StyleSheet.create({
  emptyBlock: {
    gap: 8,
  },
  question: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    lineHeight: 22,
  },
  emptyHint: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});
