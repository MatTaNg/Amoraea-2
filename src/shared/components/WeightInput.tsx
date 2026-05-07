import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export const WeightInput: React.FC<{
  label?: string;
  value?: string;
  onChange?: (v: string) => void;
  valueKg?: number;
  onChangeKg?: (n: number) => void;
}> = ({ label, value = '', onChange }) => (
  <View style={styles.box}>
    {label ? <Text style={styles.lbl}>{label}</Text> : null}
    <TextInput
      value={value}
      onChangeText={(t) => onChange?.(t)}
      placeholder="e.g. 165 lbs or 72 kg"
      placeholderTextColor="rgba(122,154,190,0.45)"
      style={styles.input}
    />
  </View>
);

const styles = StyleSheet.create({
  box: { marginBottom: 16 },
  lbl: { color: '#9CB4D8', marginBottom: 6, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    padding: 12,
    color: '#EEF6FF',
  },
});
