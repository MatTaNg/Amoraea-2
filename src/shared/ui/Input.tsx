import React from 'react';
import { View, TextInput, Text, StyleSheet, type TextInputProps } from 'react-native';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export const Input: React.FC<Props> = ({ label, error, style, ...rest }) => (
  <View style={styles.wrap}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInput
      placeholderTextColor="rgba(122,154,190,0.55)"
      style={[styles.input, error ? styles.inputErr : null, style]}
      {...rest}
    />
    {error ? <Text style={styles.err}>{error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { color: '#9CB4D8', fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#EEF6FF',
    fontSize: 16,
    backgroundColor: 'rgba(15,20,25,0.6)',
  },
  inputErr: { borderColor: '#f87171' },
  err: { color: '#f87171', fontSize: 12, marginTop: 4 },
});
