import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

export type ChoiceOption = { label: string; value: string };

/** Same surface as each option row in `SingleChoiceOptionList` (dealbreaker triggers reuse this). */
export const singleChoiceOptionRowStyle = {
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 'rgba(82,142,220,0.25)',
} as const;

export const SingleChoiceOptionList: React.FC<{
  options?: ChoiceOption[] | null;
  value: string;
  onSelect: (v: string) => void;
}> = ({ options, value, onSelect }) => (
  <View style={styles.col}>
    {(options ?? []).map((o) => (
      <Pressable
        key={o.value}
        onPress={() => onSelect(o.value)}
        style={[styles.row, value === o.value && styles.rowOn]}
      >
        <Text style={[styles.txt, value === o.value && styles.txtOn]}>{o.label}</Text>
      </Pressable>
    ))}
  </View>
);

const styles = StyleSheet.create({
  col: { gap: 8 },
  row: {
    ...singleChoiceOptionRowStyle,
  },
  rowOn: { borderColor: '#5BA8E8', backgroundColor: 'rgba(91,168,232,0.12)' },
  txt: { color: '#C8D9EE', fontSize: 16 },
  txtOn: { color: '#EEF6FF', fontWeight: '600' },
});
