/**
 * Reusable component for picker fields (habits, sleep schedule)
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
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
  activityType?: 'drinking' | 'smoking' | 'cannabis' | 'workout'; // Optional activity type to show icon
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
        {activityType && (
          <ActivityIcon frequency={value} activityType={activityType} size={18} />
        )}
      </View>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={value}
          onValueChange={onValueChange}
          style={styles.fullPicker}
        >
          {placeholder && <Picker.Item label={placeholder} value="" />}
          {options.map((option) => (
            <Picker.Item
              key={option.value}
              label={option.label}
              value={option.value}
            />
          ))}
        </Picker>
      </View>
    </View>
  );
};

