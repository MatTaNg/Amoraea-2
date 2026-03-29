import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export type FlameOrbNativeState = 'idle' | 'speaking' | 'listening' | 'processing';

type Props = {
  state: FlameOrbNativeState;
  size?: number;
};

/**
 * FlameOrbNative — native iOS/Android flame using React Native Animated API.
 * Layered animated circles approximate the web SVG flame (no feTurbulence/feDisplacementMap on RN).
 */
const FlameOrbNative: React.FC<Props> = ({ state = 'idle', size = 200 }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  const innerPulse = useRef(new Animated.Value(1)).current;
  const flicker1 = useRef(new Animated.Value(1)).current;
  const flicker2 = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    pulseAnim.stopAnimation();
    glowAnim.stopAnimation();
    innerPulse.stopAnimation();
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

      Animated.loop(
        Animated.sequence([
          Animated.timing(innerPulse, {
            toValue: 1.04,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(innerPulse, {
            toValue: 0.97,
            duration: 900,
            useNativeDriver: true,
          }),
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
          Animated.timing(innerPulse, {
            toValue: 1.12,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(innerPulse, {
            toValue: 0.95,
            duration: 250,
            useNativeDriver: true,
          }),
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
      innerPulse.stopAnimation();
      flicker1.stopAnimation();
      flicker2.stopAnimation();
    };
  }, [state, pulseAnim, glowAnim, innerPulse, flicker1, flicker2]);

  const s = size;
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';

  return (
    <View style={[styles.container, { width: s * 1.8, height: s * 1.8, overflow: 'hidden' }]}>
      <Animated.View
        style={[
          styles.layer,
          {
            width: s * 1.6,
            height: s * 1.6,
            borderRadius: s * 0.8,
            backgroundColor: '#0D3A9C',
            opacity: Animated.multiply(glowAnim, isListening ? 0.25 : 0.35),
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.layer,
          {
            width: s * 1.2,
            height: s * 1.2,
            borderRadius: s * 0.6,
            backgroundColor: '#1E6FD9',
            opacity: Animated.multiply(glowAnim, isListening ? 0.3 : 0.45),
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.layer,
          styles.flameShape,
          {
            width: s * 0.78,
            height: s * 0.92,
            backgroundColor: '#1E6FD9',
            opacity: isListening ? 0.7 : 1,
            transform: [{ scale: pulseAnim }, { scaleX: 0.88 }],
            borderRadius: s * 0.39,
            borderTopLeftRadius: s * 0.39,
            borderTopRightRadius: s * 0.25,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.layer,
          {
            width: s * 0.58,
            height: s * 0.76,
            backgroundColor: '#5BA8E8',
            opacity: isListening ? 0.6 : 0.9,
            transform: [{ scale: innerPulse }],
            borderRadius: s * 0.29,
            borderTopRightRadius: s * 0.18,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.layer,
          {
            width: s * 0.36,
            height: s * 0.52,
            backgroundColor: '#C8E4FF',
            opacity: isListening ? 0.5 : 0.85,
            transform: [{ scale: innerPulse }],
            borderRadius: s * 0.18,
            borderTopRightRadius: s * 0.1,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.layer,
          {
            width: s * 0.18,
            height: s * 0.26,
            backgroundColor: '#EEF6FF',
            opacity: isListening ? 0.4 : 0.9,
            transform: [{ scale: innerPulse }],
            borderRadius: s * 0.09,
          },
        ]}
      />
      {isSpeaking && (
        <Animated.View
          style={[
            styles.layer,
            {
              width: s * 0.18,
              height: s * 0.32,
              backgroundColor: '#5BA8E8',
              opacity: 0.6,
              transform: [
                { scale: flicker1 },
                { translateX: -(s * 0.28) },
                { translateY: s * 0.12 },
                { rotate: '-25deg' },
              ],
              borderRadius: s * 0.09,
              borderTopRightRadius: s * 0.04,
            },
          ]}
        />
      )}
      {isSpeaking && (
        <Animated.View
          style={[
            styles.layer,
            {
              width: s * 0.14,
              height: s * 0.26,
              backgroundColor: '#5BA8E8',
              opacity: 0.5,
              transform: [
                { scale: flicker2 },
                { translateX: s * 0.24 },
                { translateY: s * 0.16 },
                { rotate: '20deg' },
              ],
              borderRadius: s * 0.07,
              borderTopRightRadius: s * 0.04,
            },
          ]}
        />
      )}
      {isListening && (
        <Animated.View
          style={[
            styles.layer,
            {
              width: s * 1.1,
              height: s * 1.1,
              borderRadius: s * 0.55,
              borderWidth: 1,
              borderColor: 'rgba(91,168,232,0.3)',
              backgroundColor: 'transparent',
              opacity: glowAnim,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 999,
  },
  layer: {
    position: 'absolute',
  },
  flameShape: {},
});

export default FlameOrbNative;
