import React, { useEffect, useId, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  Filter,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
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
  const flicker1 = useRef(new Animated.Value(1)).current;
  const flicker2 = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    pulseAnim.stopAnimation();
    glowAnim.stopAnimation();
    flicker1.stopAnimation();
    flicker2.stopAnimation();

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
              toValue: 1.08,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 0.98,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.85,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(flicker1, {
            toValue: 1.15,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(flicker1, {
            toValue: 0.9,
            duration: 350,
            useNativeDriver: true,
          }),
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
      flicker1.stopAnimation();
      flicker2.stopAnimation();
    };
  }, [state, pulseAnim, glowAnim, flicker1, flicker2]);

  const svgW = (size / REF_SIZE) * FLAME_VIEWBOX_W;
  const svgH = (size / REF_SIZE) * FLAME_VIEWBOX_H;
  const pivotX = (140 / FLAME_VIEWBOX_W) * svgW;
  const pivotY = (PIVOT_Y / FLAME_VIEWBOX_H) * svgH;
  const stateScale = FLAME_STATE_SCALE[state];
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';

  const maxPulse = isSpeaking ? 1.15 : 1.1;
  const containerW = svgW * stateScale * maxPulse * 1.15;
  const containerH = svgH * stateScale * maxPulse * 1.12;

  const vb = `0 0 ${FLAME_VIEWBOX_W} ${FLAME_VIEWBOX_H}`;

  const flameSvg = (
    <Svg width={svgW} height={svgH} viewBox={vb}>
      <Defs>
        <Filter id={`${gid}-glow`} x="-60%" y="-40%" width="220%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
          <FeMerge>
            <FeMergeNode in="blur" />
          </FeMerge>
        </Filter>
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
        <RadialGradient id={`${gid}-hotcore`} cx="50%" cy="65%" r="30%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="40%" stopColor="#D8F0FF" stopOpacity={0.8} />
          <Stop offset="100%" stopColor="#4A9FE8" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path
        d={FLAME_PATH}
        fill="#1E6FD9"
        opacity={isListening ? 0.22 : 0.38}
        filter={`url(#${gid}-glow)`}
      />
      <Path d={FLAME_PATH} fill={`url(#${gid}-outer)`} />
      <Path d={INNER_FLAME_PATH} fill={`url(#${gid}-inner)`} opacity={0.85} />
      <Path d={INNER_FLAME_PATH} fill={`url(#${gid}-hotcore)`} opacity={0.7} />
    </Svg>
  );

  return (
    <View style={[styles.container, { width: containerW, height: containerH }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowWrap,
          {
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <Svg width={svgW} height={svgH} viewBox={vb}>
          <Defs>
            <RadialGradient id={`${gid}-ambient`} cx="50%" cy="72%" rx="55%" ry="45%">
              <Stop offset="0%" stopColor="rgba(30,111,217,0.55)" />
              <Stop offset="50%" stopColor="rgba(10,58,140,0.2)" />
              <Stop offset="100%" stopColor="rgba(10,58,140,0)" />
            </RadialGradient>
          </Defs>
          <Path d={FLAME_PATH} fill={`url(#${gid}-ambient)`} opacity={1} />
        </Svg>
      </Animated.View>

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

      {isSpeaking && (
        <View style={styles.sparkOverlay} pointerEvents="none">
          <Animated.View
            style={[
              styles.spark,
              {
                width: svgW * 0.14,
                height: svgH * 0.12,
                opacity: 0.55,
                transform: [
                  { translateX: -svgW * 0.22 },
                  { translateY: svgH * 0.08 },
                  { rotate: '-25deg' },
                  { scale: flicker1 },
                ],
              },
            ]}
          >
            <Svg width="100%" height="100%" viewBox="0 0 40 36" preserveAspectRatio="xMidYMid meet">
              <Path
                d="M20 2 Q34 14 38 28 Q22 22 20 34 Q18 22 2 28 Q6 14 20 2 Z"
                fill="#5BA8E8"
              />
            </Svg>
          </Animated.View>
          <Animated.View
            style={[
              styles.spark,
              {
                width: svgW * 0.12,
                height: svgH * 0.1,
                opacity: 0.45,
                transform: [
                  { translateX: svgW * 0.2 },
                  { translateY: svgH * 0.1 },
                  { rotate: '22deg' },
                  { scale: flicker2 },
                ],
              },
            ]}
          >
            <Svg width="100%" height="100%" viewBox="0 0 40 36" preserveAspectRatio="xMidYMid meet">
              <Path
                d="M20 2 Q34 14 38 28 Q22 22 20 34 Q18 22 2 28 Q6 14 20 2 Z"
                fill="#5BA8E8"
              />
            </Svg>
          </Animated.View>
        </View>
      )}

      {isListening && (
        <View style={styles.ringOverlay} pointerEvents="none">
          <Animated.View
            style={[
              styles.listenRing,
              {
                width: svgW * 0.92,
                height: svgW * 0.92,
                borderRadius: (svgW * 0.92) / 2,
                borderColor: 'rgba(91,168,232,0.35)',
                opacity: glowAnim,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameStack: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sparkOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    position: 'absolute',
  },
  ringOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenRing: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
});

export default FlameOrbNative;
