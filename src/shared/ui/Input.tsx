import React from 'react';
import { type TextInputProps } from 'react-native';
import { FormTextInput } from '@/shared/ui/FormField';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export const Input: React.FC<Props> = ({ label, error, style, ...rest }) => (
  <FormTextInput label={label} error={error} style={style} {...rest} />
);
