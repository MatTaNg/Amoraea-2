/**
 * Reusable component for picker fields (habits, sleep schedule)
 */

import React from 'react';
import { View, Text } from 'react-native';
import { AppSelect } from '@/shared/ui/AppSelect';
import { styles } from './PickerField.styled';
import { ActivityIcon } from '@/shared/components/ActivityIcon';

interface PickerOption<T extends string> {
  label: string;
  value: T;
}

interface PickerFieldProps<T extends string> {
  label: string;
  value: T;
  options: PickerOption<T>[];
  onValueChange: (value: T) => void;
  placeholder?: string;
  activityType?: 'drinking' | 'smoking' | 'cannabis' | 'workout';
}

export const PickerField = <T extends string>({
  label,
  value,
  options,
  onValueChange,
  placeholder,
  activityType,
}: PickerFieldProps<T>) => {
  return (
    <View style={styles.fieldContainer}>
      <View style={styles.labelWithIcon}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {activityType ? (
          <ActivityIcon frequency={value} activityType={activityType} size={18} />
        ) : null}
      </View>
      <AppSelect
        bare
        value={value}
        options={options}
        onValueChange={(next) => onValueChange(next as T)}
        placeholder={placeholder ?? 'Choose…'}
        allowUnset={Boolean(placeholder)}
        sheetTitle={label}
      />
    </View>
  );
};
