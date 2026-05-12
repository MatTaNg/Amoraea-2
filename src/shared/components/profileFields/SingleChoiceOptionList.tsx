import React, { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

export type ChoiceOption = { label: string; value: string };

/** Same surface as each option row in `SingleChoiceOptionList` (dealbreaker triggers reuse this). */
export const singleChoiceOptionRowStyle = {
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: 'rgba(82,142,220,0.25)',
} as const;

export const SingleChoiceOptionList: React.FC<{
  options?: ChoiceOption[] | null;
  value: string;
  onSelect: (v: string) => void;
}> = ({ options, value, onSelect }) => {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);

  return (
    <View style={styles.col}>
      {(options ?? []).map((o) => {
        const isSelected = value === o.value;
        const isHovered = hoveredValue === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            onHoverIn={() => setHoveredValue(o.value)}
            onHoverOut={() => setHoveredValue(null)}
            style={[styles.row, isSelected && styles.rowOn, isHovered && styles.rowHover]}
          >
            <Text style={[styles.txt, isSelected && styles.txtOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  col: { gap: 10 },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  rowHover: {
    borderColor: 'rgba(91,168,232,0.5)',
    backgroundColor: 'rgba(91,168,232,0.12)',
  },
  rowOn: {
    borderColor: '#5BA8E8',
    backgroundColor: 'rgba(91,168,232,0.2)',
  },
  txt: {
    color: '#C8D9EE',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  txtOn: { color: '#EEF6FF', fontWeight: '600' },
});
