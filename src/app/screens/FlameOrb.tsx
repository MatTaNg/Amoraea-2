import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import FlameOrbNative, { type FlameOrbNativeState } from './FlameOrbNative';

export type FlameState = 'idle' | 'speaking' | 'listening' | 'processing' | 'recording';

// OUTER FLAME — smooth continuous outline, no side bumps
// One clean path: tip → right side → wide smooth base → left side → back to tip
const FLAME_PATH = `
  M 140 12
  C 175 50,  240 90,  248 140
  C 255 180, 245 220, 220 248
  C 200 268, 175 280, 140 282
  C 105 280,  80 268,  60 248
  C  35 220,  25 180,  32 140
  C  40  90, 105  50, 140  12
  Z
`;

// INNER FLAME — clean teardrop, no bumps
const INNER_FLAME_PATH = `
  M 140 55
  C 165 80,  200 112, 205 152
  C 210 186, 198 216, 180 236
  C 165 252, 152 260, 140 262
  C 128 260, 115 252, 100 236
  C  82 216,  70 186,  75 152
  C  80 112, 115  80, 140  55
  Z
`;

const CONFIG = {
  idle: {
    scale: 1,
    glowSize: '60px',
    glowOpacity: 0.5,
    flickerDur: '1.4s',
    turbDur: '3s',
    turbScale: 7,
  },
  speaking: {
    scale: 1.35,
    glowSize: '110px',
    glowOpacity: 1.0,
    flickerDur: '0.35s',
    turbDur: '1.2s',
    turbScale: 12,
  },
  listening: {
    scale: 0.88,
    glowSize: '35px',
    glowOpacity: 0.3,
    flickerDur: '2.5s',
    turbDur: '5s',
    turbScale: 7,
  },
  processing: {
    scale: 1.05,
    glowSize: '70px',
    glowOpacity: 0.6,
    flickerDur: '1.0s',
    turbDur: '2.5s',
    turbScale: 7,
  },
  recording: {
    scale: 0.88,
    glowSize: '35px',
    glowOpacity: 0.3,
    flickerDur: '2.5s',
    turbDur: '5s',
    turbScale: 7,
  },
} as const;

const W = 280;
const H = 300;
const VIEWBOX_W = 280;
const VIEWBOX_H = 300;
const ID = 'amoraea-flame';

export const FlameOrb: React.FC<{ state: FlameState; size?: number }> = ({
  state = 'idle',
  size = 200,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const config = CONFIG[state] ?? CONFIG.idle;

  const transition =
    state === 'speaking'
      ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      : 'transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const dur = (CONFIG[state] ?? CONFIG.idle).flickerDur;
    document.querySelectorAll('.flame-seed-anim').forEach((el) => {
      el.setAttribute('dur', dur);
    });
  }, [state]);

  if (Platform.OS !== 'web') {
    const nativeState: FlameOrbNativeState =
      state === 'recording' ? 'listening' : (state as FlameOrbNativeState);
    return <FlameOrbNative state={nativeState} size={size} />;
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: W,
        height: 320,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 240,
          height: 240,
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse, rgba(30,111,217,0.5) 0%, rgba(10,58,140,0.25) 50%, transparent 70%)',
          filter: `blur(${config.glowSize})`,
          opacity: config.glowOpacity,
          transition: 'opacity 0.4s ease, filter 0.4s ease',
          pointerEvents: 'none',
        }}
      />
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        width={W}
        height={H}
        style={{
          transform: `scale(${config.scale})`,
          transition,
          transformOrigin: '50% 100%',
          overflow: 'visible',
          position: 'relative',
          zIndex: 1,
          filter: 'drop-shadow(0 0 22px rgba(30,111,217,0.8))',
        }}
      >
        <defs>
          <filter id={`${ID}-distort`} x="-20%" y="-10%" width="140%" height="120%">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.025 0.008"
              numOctaves={3}
              seed={4}
              result="turb"
            >
              <animate
                className="flame-seed-anim"
                attributeName="seed"
                values="4;7;2;9;5;4"
                dur={config.flickerDur}
                repeatCount="indefinite"
              />
              <animate
                attributeName="baseFrequency"
                values="0.025 0.008;0.030 0.011;0.022 0.007;0.028 0.009;0.025 0.008"
                dur={config.turbDur}
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="turb"
              scale={config.turbScale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* Outer flame — rich royal blue, darker at edges */}
          <linearGradient id={`${ID}-outer`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#0A2A8C" />
            <stop offset="20%" stopColor="#1245BB" />
            <stop offset="50%" stopColor="#1E6FD9" />
            <stop offset="75%" stopColor="#2B8AEF" />
            <stop offset="90%" stopColor="#1650CC" />
            <stop offset="100%" stopColor="#0D35A0" />
          </linearGradient>

          {/* Inner flame — very pale blue to near-white, like the logo's bright core */}
          <linearGradient id={`${ID}-inner`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#B8DCFF" />
            <stop offset="20%" stopColor="#D8EEFF" />
            <stop offset="45%" stopColor="#F0F8FF" />
            <stop offset="65%" stopColor="#E0F2FF" />
            <stop offset="85%" stopColor="#C0E0FF" />
            <stop offset="100%" stopColor="#A0CCFF" />
          </linearGradient>

          <radialGradient id={`${ID}-hotcore`} cx="50%" cy="65%" r="30%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
            <stop offset="40%" stopColor="#D8F0FF" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#4A9FE8" stopOpacity={0} />
            <animate
              attributeName="cy"
              values="65%;58%;62%;70%;65%"
              dur="1.6s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="30%;25%;35%;28%;30%"
              dur="2.1s"
              repeatCount="indefinite"
            />
          </radialGradient>
        </defs>

        <path
          d={FLAME_PATH}
          fill={`url(#${ID}-outer)`}
          filter={`url(#${ID}-distort)`}
        />
        <path
          d={INNER_FLAME_PATH}
          fill={`url(#${ID}-inner)`}
          filter={`url(#${ID}-distort)`}
          opacity={0.85}
        />
        <path d={INNER_FLAME_PATH} fill={`url(#${ID}-hotcore)`} opacity={0.7} />
      </svg>

      <style>{`
        @keyframes flameGlowPulse {
          0%, 100% { opacity: ${config.glowOpacity}; }
          50%      { opacity: ${config.glowOpacity * 0.6}; }
        }
      `}</style>
    </div>
  );
};

