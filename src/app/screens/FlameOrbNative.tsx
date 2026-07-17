import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { AMORAEA_FLAME_ORB_LOGO } from './flameOrbLogo';
import { FLAME_STATE_SCALE } from './flameOrbGeometry';

export type FlameOrbNativeState = 'idle' | 'speaking' | 'listening' | 'processing';

type Props = {
  state: FlameOrbNativeState;
  size?: number;
};

/**
 * PNG interviewer logo with speak/idle expand–contract pulse.
 */
const FlameOrbNative: React.FC<Props> = ({ state = 'idle', size = 200 }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    pulseAnim.stopAnimation();
    glowAnim.stopAnimation();
    pulseAnim.setValue(1);
    glowAnim.setValue(0.6);

    if (state === 'idle') {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.06,
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
        ]),
      ).start();
    } else if (state === 'speaking') {
      // Stronger, faster beat so “talking” reads clearly vs idle.
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.16,
              duration: 320,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 320,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 0.92,
              duration: 280,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.7,
              duration: 280,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ).start();
    } else if (state === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.9,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.96,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
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
        ]),
      ).start();
    } else if (state === 'processing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.96,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }

    return () => {
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
    };
  }, [state, pulseAnim, glowAnim]);

  const stateScale = FLAME_STATE_SCALE[state];
  const maxPulse = state === 'speaking' ? 1.2 : 1.1;
  const containerSize = size * stateScale * maxPulse * 1.15;

  return (
    <View style={[styles.container, { width: containerSize, height: containerSize }]}>
      <View style={{ transform: [{ scale: stateScale }] }}>
        <Animated.View
          style={{
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          }}
        >
          <Image
            source={AMORAEA_FLAME_ORB_LOGO}
            accessibilityLabel="Amoraea"
            style={{ width: size, height: size }}
            resizeMode="contain"
          />
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
});

export default FlameOrbNative;
