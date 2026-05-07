import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

/** Small visual hint next to habit/frequency pickers (full icon set can be added later). */
export const ActivityIcon: React.FC<{
  frequency: string;
  activityType: 'drinking' | 'smoking' | 'cannabis' | 'workout';
  size?: number;
  style?: StyleProp<TextStyle>;
}> = ({ frequency, activityType, size = 16, style }) => {
  const glyph =
    activityType === 'workout'
      ? '🏃'
      : activityType === 'drinking'
        ? '🍷'
        : activityType === 'smoking'
          ? '🚬'
          : '🌿';
  return (
    <Text style={[{ fontSize: size, opacity: frequency ? 1 : 0.35 }, style]} accessibilityLabel={`${activityType} ${frequency || 'not set'}`}>
      {glyph}
    </Text>
  );
};
