import React from 'react';
import { FormTextInput } from '@/shared/ui/FormField';

export const WeightInput: React.FC<{
  label?: string;
  value?: string;
  onChange?: (v: string) => void;
  valueKg?: number;
  onChangeKg?: (n: number) => void;
}> = ({ label, value = '', onChange }) => (
  <FormTextInput
    label={label}
    value={value}
    onChangeText={(t) => onChange?.(t)}
    placeholder="e.g. 165 lbs or 72 kg"
  />
);
