/**
 * Reusable component for input fields with unit pickers (height, weight, income)
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Input } from '@/shared/ui/Input';
import { styles } from './DualInputField.styled';

interface DualInputFieldProps {
  label: string;
  value: string;
  unit: string;
  unitOptions: { label: string; value: string }[];
  onValueChange: (value: string) => void;
  onUnitChange: (unit: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
}

export const DualInputField: React.FC<DualInputFieldProps> = ({
  label,
  value,
  unit,
  unitOptions,
  onValueChange,
  onUnitChange,
  placeholder,
  keyboardType = 'default',
}) => {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.dualInputContainer}>
        <Input
          value={value}
          onChangeText={onValueChange}
          placeholder={placeholder}
          keyboardType={keyboardType}
          style={styles.input}
        />
        <View style={styles.unitPicker}>
          <Picker
            selectedValue={unit}
            onValueChange={onUnitChange}
            style={styles.picker}
          >
            {unitOptions.map((option) => (
              <Picker.Item
                key={option.value}
                label={option.label}
                value={option.value}
              />
            ))}
          </Picker>
        </View>
      </View>
    </View>
  );
};

