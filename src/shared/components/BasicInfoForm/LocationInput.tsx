import React from 'react';
import { TextInput, StyleSheet } from 'react-native';

export const LocationInput: React.FC<{
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}> = ({ value, onChangeText, placeholder }) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="rgba(122,154,190,0.45)"
    style={styles.input}
  />
);

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    padding: 12,
    color: '#EEF6FF',
    marginBottom: 12,
  },
});
