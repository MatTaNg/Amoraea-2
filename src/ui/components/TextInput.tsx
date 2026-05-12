import React from 'react';
import { FormTextInput } from '@/shared/ui/FormField';

interface TextInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 1,
}) => {
  return (
    <FormTextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      error={error}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      secureTextEntry={secureTextEntry}
      multiline={multiline}
      numberOfLines={numberOfLines}
    />
  );
};

