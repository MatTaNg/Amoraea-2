import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';

const SCALE_CELL_W = 40;
const SCALE_GAP = 8;

export const LikertScale: React.FC<{
  min: number;
  max: number;
  value: number | null;
  onChange: (n: number) => void;
  minLabel?: string;
  maxLabel?: string;
}> = ({ min, max, value, onChange, minLabel, maxLabel }) => {
  const items: number[] = [];
  for (let i = min; i <= max; i++) items.push(i);
  const scaleRowWidth = items.length * SCALE_CELL_W + (items.length - 1) * SCALE_GAP;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {items.map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={[styles.dot, value === n && styles.dotOn]}
          >
            <Text style={[styles.num, value === n && styles.numOn]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      {(minLabel || maxLabel) && (
        <View style={[styles.edgeLabelsRow, { width: scaleRowWidth }]}>
          <Text style={[styles.edgeLabel, styles.edgeLabelMin]}>{minLabel ?? ''}</Text>
          <Text style={[styles.edgeLabel, styles.edgeLabelMax]}>{maxLabel ?? ''}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SCALE_GAP },
  dot: {
    width: SCALE_CELL_W,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
    alignItems: 'center',
  },
  dotOn: { backgroundColor: 'rgba(91,168,232,0.2)', borderColor: '#5BA8E8' },
  num: { color: '#9CB4D8', fontSize: 14 },
  numOn: { color: '#EEF6FF', fontWeight: '700' },
  /** Matches numeric row width; left/right labels each use ~half — avoids 40px cells crushing copy. */
  edgeLabelsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    gap: SCALE_GAP,
  },
  edgeLabel: {
    color: '#9CB4D8',
    fontSize: 12,
    lineHeight: 16,
  },
  edgeLabelMin: {
    flex: 1,
    flexShrink: 1,
    textAlign: 'left',
    paddingRight: 4,
  },
  edgeLabelMax: {
    flex: 1,
    flexShrink: 1,
    textAlign: 'right',
    paddingLeft: 4,
  },
});
