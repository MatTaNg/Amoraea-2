import React from 'react';
import { FormTextInput } from '@/shared/ui/FormField';

export const WeightInput: React.FC<{
  label?: string;
  value?: string;
  onChange?: (v: string) => void;
  valueKg?: number;
  onChangeKg?: (n: number) => void;
  defaultUnit?: 'lbs' | 'kg';
  allowUnitSwitch?: boolean;
  maxLength?: number;
}> = ({
  label,
  value = '',
  onChange,
  defaultUnit,
  allowUnitSwitch = true,
  maxLength,
}) => {
  const lbsOnly = defaultUnit === 'lbs' && allowUnitSwitch === false;
  const digitMaxLength = maxLength ?? (lbsOnly ? 3 : undefined);

  const handleChange = (text: string) => {
    if (digitMaxLength != null) {
      onChange?.(text.replace(/\D/g, '').slice(0, digitMaxLength));
      return;
    }
    onChange?.(text);
  };

  return (
    <FormTextInput
      label={label}
      value={value}
      onChangeText={handleChange}
      placeholder={lbsOnly ? 'e.g. 165' : 'e.g. 165 lbs or 72 kg'}
      keyboardType={digitMaxLength != null ? 'number-pad' : undefined}
      maxLength={digitMaxLength}
    />
  );
};
