import React, { useSyncExternalStore } from 'react';
import { Image, Platform, View } from 'react-native';
import { AmoraeaLoadingSpinner } from './AmoraeaLoadingSpinner';
import FlameOrbNative, { type FlameOrbNativeState } from './FlameOrbNative';
import { AMORAEA_FLAME_ORB_LOGO } from './flameOrbLogo';
import { FLAME_ORB_STAGE_SCALE, FLAME_STATE_SCALE } from './flameOrbGeometry';
import { getFlameSpeechLevel, subscribeFlameSpeechLevel } from './flameSpeechLevel';

export type FlameState = 'idle' | 'speaking' | 'listening' | 'processing' | 'recording';

function interviewFlameCss(size: number): string {
  const ring = Math.round(size * 0.92);
  return `
    @keyframes amoraeaFlameBreath {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.045); }
    }
    @keyframes amoraeaFlameBreathGlow {
      0%, 100% { opacity: 0.22; }
      50% { opacity: 0.42; }
    }
    @keyframes amoraeaFlameSpeakPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }
    @keyframes amoraeaFlameRing {
      0% { transform: translate(-50%, -50%) scale(0.78); opacity: 0; }
      12% { opacity: 0.55; }
      100% { transform: translate(-50%, -50%) scale(1.42); opacity: 0; }
    }
    .amoraea-flame-idle-logo { animation: amoraeaFlameBreath 5s ease-in-out infinite; }
    .amoraea-flame-speaking-logo { animation: amoraeaFlameSpeakPulse 0.55s ease-in-out infinite; }
    .amoraea-flame-idle-glow {
      position: absolute;
      width: ${ring}px;
      height: ${ring}px;
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(30,111,217,0.45) 0%, rgba(10,58,140,0.16) 52%, transparent 72%);
      filter: blur(28px);
      animation: amoraeaFlameBreathGlow 5s ease-in-out infinite;
      pointer-events: none;
    }
    .amoraea-flame-ring {
      position: absolute;
      left: 50%;
      top: 50%;
      width: ${ring}px;
      height: ${ring}px;
      border-radius: 50%;
      border: 1.5px solid rgba(150, 198, 245, 0.55);
      animation: amoraeaFlameRing 2.8s ease-out infinite;
      pointer-events: none;
    }
    .amoraea-flame-ring-b { animation-delay: 1.4s; }
  `;
}

export const FlameOrb: React.FC<{
  state: FlameState;
  size?: number;
  /** Web: omit interview motion (login and other static marks). Native: unchanged. */
  minimalGlow?: boolean;
}> = ({ state = 'idle', size = 200, minimalGlow = false }) => {
  const speechLevel = useSyncExternalStore(
    subscribeFlameSpeechLevel,
    getFlameSpeechLevel,
    getFlameSpeechLevel,
  );

  if (state === 'processing') {
    const wrapSize = Math.ceil(size * FLAME_ORB_STAGE_SCALE);
    return (
      <View
        style={{
          width: wrapSize,
          height: wrapSize,
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AmoraeaLoadingSpinner size={size} />
      </View>
    );
  }

  if (Platform.OS !== 'web') {
    const nativeState: FlameOrbNativeState =
      state === 'recording' ? 'listening' : (state as FlameOrbNativeState);
    return <FlameOrbNative state={nativeState} size={size} />;
  }

  const visualState = state === 'recording' ? 'listening' : state;
  const speaking = !minimalGlow && visualState === 'speaking';
  const logoSize = speaking ? Math.round(size * FLAME_STATE_SCALE.speaking) : size;
  const wrapSize = Math.ceil(size * (minimalGlow ? 1 : FLAME_ORB_STAGE_SCALE));
  const speakingGlow = 0.75 + speechLevel * 0.25;
  const logoClass =
    minimalGlow || visualState === 'speaking'
      ? undefined
      : visualState === 'idle'
        ? 'amoraea-flame-idle-logo'
        : undefined;

  return (
    <div
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
      {!minimalGlow && visualState === 'idle' ? <div className="amoraea-flame-idle-glow" /> : null}
      {!minimalGlow && visualState === 'listening' ? (
        <>
          <div className="amoraea-flame-ring amoraea-flame-ring-a" />
          <div className="amoraea-flame-ring amoraea-flame-ring-b" />
        </>
      ) : null}
      {speaking ? (
        <div
          style={{
            position: 'absolute',
            width: logoSize,
            height: logoSize,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse, rgba(90,160,235,0.55) 0%, rgba(20,70,160,0.22) 46%, transparent 70%)',
            filter: `blur(${28 + speechLevel * 18}px)`,
            opacity: speakingGlow,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div
        className={speaking ? 'amoraea-flame-speaking-logo' : logoClass}
        style={{
          position: 'relative',
          zIndex: 1,
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
      {!minimalGlow ? <style dangerouslySetInnerHTML={{ __html: interviewFlameCss(size) }} /> : null}
    </div>
  );
};
