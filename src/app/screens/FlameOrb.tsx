import React, { useRef } from 'react';
import { Image, Platform } from 'react-native';
import FlameOrbNative, { type FlameOrbNativeState } from './FlameOrbNative';
import { AMORAEA_FLAME_ORB_LOGO } from './flameOrbLogo';
import { FLAME_STATE_SCALE } from './flameOrbGeometry';

export type FlameState = 'idle' | 'speaking' | 'listening' | 'processing' | 'recording';

const CONFIG = {
  idle: {
    scale: FLAME_STATE_SCALE.idle,
    glowSize: '60px',
    glowOpacity: 0.5,
  },
  speaking: {
    scale: FLAME_STATE_SCALE.speaking,
    glowSize: '130px',
    glowOpacity: 1.0,
  },
  listening: {
    scale: FLAME_STATE_SCALE.listening,
    glowSize: '35px',
    glowOpacity: 0.3,
  },
  processing: {
    scale: FLAME_STATE_SCALE.processing,
    glowSize: '70px',
    glowOpacity: 0.6,
  },
  recording: {
    scale: FLAME_STATE_SCALE.listening,
    glowSize: '35px',
    glowOpacity: 0.3,
  },
} as const;

export const FlameOrb: React.FC<{
  state: FlameState;
  size?: number;
  /** Web: omit the circular blurred glow (e.g. login). Native: unchanged. */
  minimalGlow?: boolean;
}> = ({ state = 'idle', size = 200, minimalGlow = false }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const config = CONFIG[state] ?? CONFIG.idle;

  if (Platform.OS !== 'web') {
    const nativeState: FlameOrbNativeState =
      state === 'recording' ? 'listening' : (state as FlameOrbNativeState);
    return <FlameOrbNative state={nativeState} size={size} />;
  }

  const isSpeaking = state === 'speaking';
  const transition = isSpeaking
    ? 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
    : 'transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

  const logoSize = size;
  // Room for speaking base scale + continuous pulse overshoot.
  const wrapSize = Math.ceil(logoSize * FLAME_STATE_SCALE.speaking * 1.2);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: wrapSize,
        height: wrapSize,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!minimalGlow && (
        <div
          className={isSpeaking ? 'amoraea-flame-glow-speaking' : undefined}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: wrapSize * 0.95,
            height: wrapSize * 0.95,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse, rgba(30,111,217,0.55) 0%, rgba(10,58,140,0.28) 50%, transparent 70%)',
            filter: `blur(${config.glowSize})`,
            opacity: config.glowOpacity,
            transition: 'opacity 0.4s ease, filter 0.4s ease',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: logoSize,
          height: logoSize,
          transform: `scale(${config.scale})`,
          transition,
          transformOrigin: '50% 50%',
        }}
      >
        <div
          className={isSpeaking ? 'amoraea-flame-logo-speaking' : undefined}
          style={{
            width: logoSize,
            height: logoSize,
            transformOrigin: '50% 50%',
          }}
        >
          <Image
            source={AMORAEA_FLAME_ORB_LOGO}
            accessibilityLabel="Amoraea"
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
          />
        </div>
      </div>
      {isSpeaking ? (
        <style>{`
          @keyframes amoraeaFlameSpeakPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.14); }
          }
          @keyframes amoraeaFlameSpeakGlow {
            0%, 100% { opacity: 0.75; }
            50% { opacity: 1; }
          }
          .amoraea-flame-logo-speaking {
            animation: amoraeaFlameSpeakPulse 0.55s ease-in-out infinite;
          }
          .amoraea-flame-glow-speaking {
            animation: amoraeaFlameSpeakGlow 0.55s ease-in-out infinite;
          }
        `}</style>
      ) : null}
    </div>
  );
};
