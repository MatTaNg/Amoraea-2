import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AMORAEA_FLAME_ORB_LOGO } from './flameOrbLogo';
import { WhiteArcStroke } from './whiteArcStroke';

/** Same blue as the interview progress bar and the thinking arc. */
const FLAME_ARC = '#5BA8E8';
const ARC_SCALE = 1.08;
const SPIN_MS = 1400;

const LOGO_SIZE = {
  small: 26,
  large: 64,
} as const;

/** Full-page loader mark, at least 200×200. Inline indicators under 50px use ActivityIndicator. */
export const AMORAEA_PAGE_LOADING_SIZE = 200;

export type AmoraeaLoadingSpinnerSize = number | 'small' | 'large';

function logoSizeFor(size: AmoraeaLoadingSpinnerSize): number {
  if (size === 'small') return LOGO_SIZE.small;
  if (size === 'large') return LOGO_SIZE.large;
  return size;
}

/** Interview thinking arc is 5px around a ~200px flame. Smaller spinners stay visible. */
function arcThickness(logoSize: number): number {
  if (logoSize >= 120) return 5;
  return Math.max(2, Math.round(logoSize / 18));
}

function ensureWebSpinKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('amoraea-loading-spinner-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'amoraea-loading-spinner-keyframes';
  style.textContent = '@keyframes amoraeaLoadingSpinner{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
}

/**
 * Interview "Amoraea is thinking" mark: blue flame with the spinning arc.
 * A loading page uses at least AMORAEA_PAGE_LOADING_SIZE. Indicators under 50px
 * that share the screen with other content use ActivityIndicator.
 */
export function AmoraeaLoadingSpinner({
  size = 'small',
  style,
}: {
  size?: AmoraeaLoadingSpinnerSize;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const logoSize = logoSizeFor(size);
  const arcSize = Math.round(logoSize * ARC_SCALE);
  const thickness = arcThickness(logoSize);
  const arc = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      ensureWebSpinKeyframes();
      return;
    }
    const loop = Animated.loop(
      Animated.timing(arc, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [arc]);

  const rotate = arc.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        {
          width: arcSize,
          height: arcSize,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Image
        source={AMORAEA_FLAME_ORB_LOGO}
        accessibilityLabel="Amoraea"
        style={{ width: logoSize, height: logoSize }}
        resizeMode="contain"
      />
      {Platform.OS === 'web' ? (
        <div
          style={{
            position: 'absolute',
            width: arcSize,
            height: arcSize,
            animation: `amoraeaLoadingSpinner ${SPIN_MS}ms linear infinite`,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: `${thickness}px solid transparent`,
              borderTopColor: FLAME_ARC,
              background: 'none',
            }}
          />
        </div>
      ) : (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: arcSize,
            height: arcSize,
            transform: [{ rotate }],
          }}
        >
          <WhiteArcStroke size={arcSize} thickness={thickness} />
        </Animated.View>
      )}
    </View>
  );
}
