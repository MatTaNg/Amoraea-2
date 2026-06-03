import React from 'react';
import { FormTextInput } from '@/shared/ui/FormField';
import { HEIGHT_CM_MAX, HEIGHT_CM_MIN } from './HeightCmPicker';

export type HeightCmInputProps = {
  label?: string;
  /** Stored label form e.g. `"172 cm"`. */
  value?: string;
  onChange?: (v: string) => void;
  valueCm?: number | null;
  onChangeCm?: (cm: number | undefined) => void;
  errorText?: string;
  placeholder?: string;
};

function cmDigitsFromProps(value?: string, valueCm?: number | null): string {
  if (valueCm != null && Number.isFinite(valueCm)) return String(valueCm);
  const t = (value || '').trim();
  const m = t.match(/^(\d+)/);
  if (m) return m[1];
  return t.replace(/\D/g, '');
}

export const HeightCmInput: React.FC<HeightCmInputProps> = ({
  label,
  value = '',
  onChange,
  valueCm,
  onChangeCm,
  errorText,
  placeholder = 'e.g. 172',
}) => {
  const display = cmDigitsFromProps(value, valueCm);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 3);
    if (onChange) {
      onChange(digits ? `${digits} cm` : '');
    }
    if (onChangeCm) {
      if (!digits) {
        onChangeCm(undefined);
        return;
      }
      const n = parseInt(digits, 10);
      onChangeCm(Number.isFinite(n) ? n : undefined);
    }
  };

  const rangeError =
    display && /^\d+$/.test(display)
      ? (() => {
          const n = parseInt(display, 10);
          if (n < HEIGHT_CM_MIN || n > HEIGHT_CM_MAX) {
            return `Enter a height between ${HEIGHT_CM_MIN} and ${HEIGHT_CM_MAX} cm.`;
          }
          return undefined;
        })()
      : undefined;

  return (
    <FormTextInput
      label={label}
      value={display}
      onChangeText={handleChange}
      placeholder={placeholder}
      keyboardType="number-pad"
      error={errorText ?? rangeError}
    />
  );
};
