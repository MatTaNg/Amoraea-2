import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { AmoraeaLoadingSpinner } from './AmoraeaLoadingSpinner';
import { AMORAEA_FLAME_ORB_LOGO } from './flameOrbLogo';
import { FLAME_ORB_STAGE_SCALE, FLAME_STATE_SCALE } from './flameOrbGeometry';
import {
  getFlameSpeechLevel,
  subscribeFlameSpeechLevel,
} from './flameSpeechLevel';

export type FlameOrbNativeState = 'idle' | 'speaking' | 'listening' | 'processing';

type Props = {
  state: FlameOrbNativeState;
  size?: number;
};

const RING_COLOR = 'rgba(150, 198, 245, 0.55)';

/**
 * Interview flame:
 * idle — 5s breath, low glow
 * listening — still orb, two rings drift out
 * speaking — glow follows TTS loudness
 * processing — dim glow, thin arc turns
 */
const FlameOrbNative: React.FC<Props> = ({ state = 'idle', size = 200 }) => {
  const breath = useRef(new Animated.Value(0)).current;
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const speech = useRef(new Animated.Value(0)).current;
  const speakPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    breath.setValue(0);
    ringA.setValue(0);
    ringB.setValue(0);
    speakPulse.setValue(1);

    if (state === 'idle') {
      loops.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(breath, {
              toValue: 1,
              duration: 2500,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(breath, {
              toValue: 0,
              duration: 2500,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ),
      );
    } else if (state === 'listening') {
      const ringLoop = (value: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(value, {
              toValue: 1,
              duration: 2800,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(value, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        );
      loops.push(ringLoop(ringA, 0), ringLoop(ringB, 1400));
    } else if (state === 'speaking') {
      loops.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(speakPulse, {
              toValue: 1.16,
              duration: 320,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(speakPulse, {
              toValue: 0.92,
              duration: 280,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ),
      );
    }

    loops.forEach((loop) => loop.start());
    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [breath, ringA, ringB, speakPulse, state]);

  useEffect(() => {
    if (state !== 'speaking') {
      speech.setValue(0);
      return;
    }
    const unsubscribe = subscribeFlameSpeechLevel(() => {
      Animated.timing(speech, {
        toValue: getFlameSpeechLevel(),
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
    speech.setValue(getFlameSpeechLevel());
    return unsubscribe;
  }, [speech, state]);

  const stage = Math.ceil(size * FLAME_ORB_STAGE_SCALE);
  const logoSize = state === 'speaking' ? Math.round(size * FLAME_STATE_SCALE.speaking) : size;
  const logoOffset = Math.round((stage - logoSize) / 2);
  const ringSize = Math.round(size * 0.92);

  const breathScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.045],
  });
  const breathGlow = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.42],
  });
  const speechGlow = speech.interpolate({
    inputRange: [0, 1],
    outputRange: [0.38, 1],
  });

  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({
      inputRange: [0, 0.15, 1],
      outputRange: [0, 0.55, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.78, 1.42],
        }),
      },
    ],
  });

  if (state === 'processing') {
    return (
      <View style={[styles.container, { width: stage, height: stage }]}>
        <AmoraeaLoadingSpinner size={size} />
      </View>
    );
  }

  const logoScale = state === 'idle' ? breathScale : state === 'speaking' ? speakPulse : 1;
  const glowOpacity =
    state === 'idle' ? breathGlow : state === 'speaking' ? speechGlow : 0.28;
  const logoOpacity = 1;
  const glowSize = Math.round((state === 'speaking' ? logoSize : size) * 0.9);

  return (
    <View style={[styles.container, { width: stage, height: stage }]}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: glowSize,
          height: glowSize,
          borderRadius: glowSize,
          backgroundColor: 'rgba(40, 120, 220, 0.55)',
          opacity: glowOpacity,
          transform: [{ scale: logoScale }],
        }}
      />
      {state === 'listening' ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }, ringStyle(ringA)]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }, ringStyle(ringB)]}
          />
        </>
      ) : null}
      <Animated.View
        style={{
          position: 'absolute',
          width: logoSize,
          height: logoSize,
          left: logoOffset,
          top: logoOffset,
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
        }}
      >
        <Image
          source={AMORAEA_FLAME_ORB_LOGO}
          accessibilityLabel="Amoraea"
          style={{ width: logoSize, height: logoSize }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: RING_COLOR,
  },
});

export default FlameOrbNative;
