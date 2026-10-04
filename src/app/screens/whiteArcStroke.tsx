import React from 'react';
import { View } from 'react-native';

/** Portion of the circle the loading stroke covers. */
const ARC_SWEEP = 0.24;

/**
 * Solid arc built from overlapping strokes, matching the interview progress bar.
 * A bordered circle fills grey on Android, and one straight bar does not read as a spinner.
 */
export function WhiteArcStroke({
  size,
  thickness = 5,
}: {
  size: number;
  thickness?: number;
}): React.ReactElement {
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const sweep = ARC_SWEEP * Math.PI * 2;
  const arcLength = radius * sweep;
  const spacing = Math.max(2, thickness * 0.45);
  const count = Math.max(8, Math.ceil(arcLength / spacing));
  const segmentLength = spacing * 2.6;
  const start = -Math.PI / 2;

  return (
    <View style={{ width: size, height: size, backgroundColor: 'transparent' }}>
      {Array.from({ length: count }, (_, index) => {
        const angle = start + (sweep * index) / (count - 1);
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        const degrees = (angle * 180) / Math.PI + 90;
        return (
          <View
            key={index}
            collapsable={false}
            style={{
              position: 'absolute',
              left: x - segmentLength / 2,
              top: y - thickness / 2,
              width: segmentLength,
              height: thickness,
              backgroundColor: '#5BA8E8',
              opacity: 1,
              transform: [{ rotate: `${degrees}deg` }],
            }}
          />
        );
      })}
    </View>
  );
}
