import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

type FormFieldProps = {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const FormField: React.FC<FormFieldProps> = ({
  label,
  helperText,
  error,
  children,
  style,
}) => (
  <View style={[formControlStyles.field, style]}>
    {label ? <Text style={formControlStyles.label}>{label}</Text> : null}
    {helperText ? <Text style={formControlStyles.helperText}>{helperText}</Text> : null}
    {children}
    {error ? <Text style={formControlStyles.errorText}>{error}</Text> : null}
  </View>
);

type FormControlSurfaceProps = PressableProps & {
  error?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const FormControlSurface: React.FC<FormControlSurfaceProps> = ({
  error,
  children,
  style,
  ...rest
}) => (
  <Pressable
    accessibilityRole="button"
    style={({ pressed }) => [
      formControlStyles.control,
      error ? formControlStyles.controlError : null,
      pressed ? formControlStyles.controlPressed : null,
      style,
    ]}
    {...rest}
  >
    {children}
  </Pressable>
);

type FormTextInputProps = TextInputProps & {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  fieldStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export const FormTextInput: React.FC<FormTextInputProps> = ({
  label,
  helperText,
  error,
  fieldStyle,
  inputStyle,
  style,
  multiline,
  ...rest
}) => (
  <FormField label={label} helperText={helperText} error={error} style={fieldStyle}>
    <TextInput
      placeholderTextColor="rgba(200,217,238,0.55)"
      multiline={multiline}
      style={[
        formControlStyles.control,
        formControlStyles.inputText,
        multiline ? formControlStyles.multilineInput : null,
        error ? formControlStyles.controlError : null,
        inputStyle,
        style,
      ]}
      {...rest}
    />
  </FormField>
);

export const formControlStyles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    color: '#9CB4D8',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 6,
  },
  helperText: {
    color: 'rgba(200,217,238,0.72)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  control: {
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  /** Match onboarding single-choice options: solid card surface + thicker border. */
  controlSelectLike: {
    backgroundColor: '#0f1419',
    borderWidth: 2,
    borderRadius: 12,
    borderColor: 'rgba(82,142,220,0.25)',
    minHeight: 58,
  },
  controlPressed: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  controlError: {
    borderColor: '#f87171',
  },
  inputText: {
    color: '#E8F0F8',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  valueText: {
    color: '#E8F0F8',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  placeholderText: {
    color: 'rgba(200,217,238,0.55)',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 6,
  },
});
