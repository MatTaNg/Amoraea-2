/**
 * Reusable component for input fields with unit pickers (height, weight, income)
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Input } from '@/shared/ui/Input';
import { AppSelect } from '@/shared/ui/AppSelect';
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
          <AppSelect
            bare
            value={unit}
            options={unitOptions}
            onValueChange={onUnitChange}
            sheetTitle={`${label} unit`}
            triggerStyle={styles.unitTrigger}
          />
        </View>
      </View>
    </View>
  );
};
