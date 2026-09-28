import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, StyleSheet, Platform } from 'react-native';

export type ChoiceOption = { label: string; value: string };

/** Same surface as each option row in `SingleChoiceOptionList` (dealbreaker triggers reuse this). */
export const singleChoiceOptionRowStyle = {
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: 'rgba(82,142,220,0.25)',
} as const;

/**
 * RN-web renders Pressable as <button>, whose user-agent stylesheet is
 * `white-space: nowrap`. StyleSheet.create strips unknown CSS, so these must be
 * applied as inline styles.
 */
const webRowWrap =
  Platform.OS === 'web'
    ? ({ whiteSpace: 'normal', overflow: 'visible', height: 'auto' } as const)
    : null;
const webTextWrap =
  Platform.OS === 'web'
    ? ({ whiteSpace: 'normal', display: 'block' } as const)
    : null;
const webWrapAttrs =
  Platform.OS === 'web' ? ({ dataSet: { allowWrap: 'true' } } as object) : null;

export const SingleChoiceOptionList: React.FC<{
  options?: ChoiceOption[] | null;
  value: string;
  onSelect: (v: string) => void;
  /**
   * When true, defers `onSelect` until after the next paint so the selected row can
   * highlight before parents auto-advance and unmount this list.
   */
  deferSelectUntilPaint?: boolean;
}> = ({ options, value, onSelect, deferSelectUntilPaint = false }) => {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (pendingValue != null && value === pendingValue) {
      setPendingValue(null);
    }
  }, [pendingValue, value]);

  const displayedValue = pendingValue ?? value;

  const emitSelect = (next: string) => {
    if (deferSelectUntilPaint) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => onSelectRef.current(next));
      });
      return;
    }
    onSelectRef.current(next);
  };

  return (
    <View style={styles.col}>
      {(options ?? []).map((o) => {
        const isSelected = displayedValue === o.value;
        const isHovered = hoveredValue === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              setPendingValue(o.value);
              emitSelect(o.value);
            }}
            onHoverIn={() => setHoveredValue(o.value)}
            onHoverOut={() => setHoveredValue(null)}
            style={[
              styles.row,
              isSelected && styles.rowOn,
              isHovered && styles.rowHover,
              webRowWrap,
            ]}
            {...webWrapAttrs}
          >
            <View style={styles.labelWrap}>
              <Text style={[styles.txt, isSelected && styles.txtOn, webTextWrap]}>
                {o.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  col: { gap: 10, width: '100%', alignSelf: 'stretch', minWidth: 0 },
  row: {
    flexDirection: 'column',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    overflow: 'visible',
  },
  labelWrap: {
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
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
    width: '100%',
    flexShrink: 1,
    minWidth: 0,
  },
  txtOn: { color: '#EEF6FF', fontWeight: '600' },
});
