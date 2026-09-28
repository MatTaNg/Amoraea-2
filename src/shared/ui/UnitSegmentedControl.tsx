import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type UnitSegmentOption<T extends string> = {
  label: string;
  value: T;
};

type UnitSegmentedControlProps<T extends string> = {
  options: readonly UnitSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

export function UnitSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: UnitSegmentedControlProps<T>) {
  return (
    <View
      style={styles.track}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected ? styles.segmentSelected : null,
              pressed ? styles.segmentPressed : null,
            ]}
          >
            <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 3,
    gap: 3,
  },
  segment: {
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: 'rgba(91,168,232,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.55)',
  },
  segmentPressed: {
    opacity: 0.85,
  },
  segmentText: {
    color: 'rgba(200,217,238,0.72)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  segmentTextSelected: {
    color: '#EEF6FF',
  },
});
