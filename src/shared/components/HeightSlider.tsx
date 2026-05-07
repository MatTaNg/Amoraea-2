import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { HeightCmPicker, HEIGHT_CM_MAX, HEIGHT_CM_MIN } from './HeightCmPicker';

/** Parse stored height strings like `172`, `172 cm`, `178 CM` into cm for pickers. */
export function parseCmFromValue(value: string): number | undefined {
  const t = (value || '').trim();
  if (!t) return undefined;
  const m = t.match(/(\d+)\s*cm/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n >= HEIGHT_CM_MIN && n <= HEIGHT_CM_MAX) return n;
  }
  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10);
    if (n >= HEIGHT_CM_MIN && n <= HEIGHT_CM_MAX) return n;
  }
  return undefined;
}

export const HeightSlider: React.FC<{
  label?: string;
  value?: string;
  onChange?: (v: string) => void;
  userLocation?: unknown;
  valueCm?: number;
  onChangeCm?: (n: number) => void;
  defaultUnit?: 'ft' | 'cm';
  allowUnitSwitch?: boolean;
}> = ({ label, value = '', onChange, defaultUnit, allowUnitSwitch = true }) => {
  const useCmDropdown = defaultUnit === 'cm' && allowUnitSwitch === false;

  if (useCmDropdown) {
    return (
      <HeightCmPicker
        label={label}
        valueCm={parseCmFromValue(value)}
        onChangeCm={(cm) => onChange?.(cm != null ? `${cm} cm` : '')}
      />
    );
  }

  return (
    <View style={styles.box}>
      {label ? <Text style={styles.lbl}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={(t) => onChange?.(t)}
        placeholder="e.g. 5'10&quot; or 178 cm"
        placeholderTextColor="rgba(122,154,190,0.45)"
        style={styles.input}
      />
      <Text style={styles.hint}>Full height picker UI can replace this text field.</Text>
    </View>
  );
};

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
  hint: { color: '#5a6578', fontSize: 12, marginTop: 6 },
});
