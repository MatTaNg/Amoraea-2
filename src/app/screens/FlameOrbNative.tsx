import React, { useEffect, useId, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  FLAME_PATH,
  FLAME_STATE_SCALE,
  FLAME_VIEWBOX_H,
  FLAME_VIEWBOX_W,
  INNER_FLAME_PATH,
} from './flameOrbGeometry';

export type FlameOrbNativeState = 'idle' | 'speaking' | 'listening' | 'processing';

type Props = {
  state: FlameOrbNativeState;
  size?: number;
};

const REF_SIZE = 200;
/** ViewBox Y of flame base (matches web SVG silhouette). */
const PIVOT_Y = 282;

/**
 * Same paths and gradients as web `FlameOrb.tsx` (no feTurbulence / displacement on RN).
 */
const FlameOrbNative: React.FC<Props> = ({ state = 'idle', size = 200 }) => {
  const reactId = useId();
  const gid = useMemo(() => `fn${reactId.replace(/[^a-zA-Z0-9]/g, '')}`, [reactId]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    pulseAnim.stopAnimation();
    glowAnim.stopAnimation();

    if (state === 'idle') {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 2500,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.9,
              duration: 2500,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 0.97,
              duration: 2500,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.6,
              duration: 2500,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    } else if (state === 'speaking') {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.04,
              duration: 550,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 550,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 0.98,
              duration: 450,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.85,
              duration: 450,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();

    } else if (state === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.88,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.95,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.45,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.7,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (state === 'processing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.96,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }

    return () => {
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
    };
  }, [state, pulseAnim, glowAnim]);

  const svgW = (size / REF_SIZE) * FLAME_VIEWBOX_W;
  const svgH = (size / REF_SIZE) * FLAME_VIEWBOX_H;
  const pivotX = (140 / FLAME_VIEWBOX_W) * svgW;
  const pivotY = (PIVOT_Y / FLAME_VIEWBOX_H) * svgH;
  /** Keep same footprint as idle; speaking uses pulseAnim only (no base scale-up like web CONFIG 1.35). */
  const stateScale = state === 'speaking' ? 1 : FLAME_STATE_SCALE[state];
  const isListening = state === 'listening';

  const maxPulse = state === 'speaking' ? 1.12 : 1.1;
  const containerW = svgW * stateScale * maxPulse * 1.15;
  const containerH = svgH * stateScale * maxPulse * 1.12;

  const vb = `0 0 ${FLAME_VIEWBOX_W} ${FLAME_VIEWBOX_H}`;

  const flameSvg = (
    <Svg width={svgW} height={svgH} viewBox={vb}>
      <Defs>
        <LinearGradient id={`${gid}-outer`} x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%" stopColor="#0A2A8C" />
          <Stop offset="20%" stopColor="#1245BB" />
          <Stop offset="50%" stopColor="#1E6FD9" />
          <Stop offset="75%" stopColor="#2B8AEF" />
          <Stop offset="90%" stopColor="#1650CC" />
          <Stop offset="100%" stopColor="#0D35A0" />
        </LinearGradient>
        <LinearGradient id={`${gid}-inner`} x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%" stopColor="#B8DCFF" />
          <Stop offset="20%" stopColor="#D8EEFF" />
          <Stop offset="45%" stopColor="#F0F8FF" />
          <Stop offset="65%" stopColor="#E0F2FF" />
          <Stop offset="85%" stopColor="#C0E0FF" />
          <Stop offset="100%" stopColor="#A0CCFF" />
        </LinearGradient>
      </Defs>
      <Path d={FLAME_PATH} fill={`url(#${gid}-outer)`} />
      <Path d={INNER_FLAME_PATH} fill={`url(#${gid}-inner)`} opacity={isListening ? 0.78 : 0.85} />
    </Svg>
  );

  return (
    <View style={[styles.container, { width: containerW, height: containerH }]}>
      <View
        style={[
          styles.flameStack,
          {
            transform: [{ scale: stateScale }],
          },
        ]}
      >
        <Animated.View
          style={{
            opacity: glowAnim,
            transform: [
              { translateX: pivotX },
              { translateY: pivotY },
              { scale: pulseAnim },
              { translateX: -pivotX },
              { translateY: -pivotY },
            ],
          }}
        >
          {flameSvg}
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  flameStack: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});

export default FlameOrbNative;
