import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SEX_INTEREST_CATEGORY_OPTIONS } from '@/shared/constants/sexualCompatibilityOptions';

export const SexInterestCheckboxList: React.FC<{
  selected: string[];
  onChange: (next: string[]) => void;
  options?: { label: string; value: string }[];
  /** One option at a time; tap the selected row again to clear. */
  singleSelect?: boolean;
}> = ({ selected, onChange, options = SEX_INTEREST_CATEGORY_OPTIONS, singleSelect = false }) => {
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const displayedSelected =
    singleSelect && pendingValue != null ? [pendingValue] : selected;

  return (
    <View style={styles.col}>
      {options.map((o) => {
        const on = singleSelect ? displayedSelected[0] === o.value : selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (singleSelect) {
                if (on) {
                  setPendingValue(null);
                  onChange([]);
                } else {
                  setPendingValue(o.value);
                  onChange([o.value]);
                }
              } else if (on) {
                onChange(selected.filter((x) => x !== o.value));
              } else {
                onChange([...selected, o.value]);
              }
            }}
            style={[styles.row, on && styles.rowOn]}
          >
            <Text style={styles.txt}>{o.label}</Text>
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
  rowOn: {
    borderColor: '#5BA8E8',
    backgroundColor: 'rgba(91,168,232,0.2)',
  },
  txt: {
    color: '#EEF6FF',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
});
