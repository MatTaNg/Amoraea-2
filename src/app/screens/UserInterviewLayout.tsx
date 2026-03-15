import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Animated,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlameOrb, type FlameState } from './FlameOrb';

// Design tokens — Amoraea interviewer
const BG = '#05060D';
const SURFACE = '#0D1120';
const BORDER = 'rgba(82, 142, 220, 0.12)';
const FLAME_WHITE = '#EEF6FF';
const FLAME_BRIGHT = '#C8E4FF';
const FLAME_MID = '#5BA8E8';
const FLAME_CORE = '#1E6FD9';
const FLAME_DEEP = '#0D3A9C';
const TEXT_PRIMARY = '#E8F0F8';
const TEXT_SECONDARY = '#7A9ABE';
const TEXT_DIM = '#3D5470';

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_UI = Platform.OS === 'web' ? "'Jost', sans-serif" : undefined;

export interface ActiveScenario {
  label: string;
  text: string;
}

interface UserInterviewLayoutProps {
  flameState: FlameState;
  activeScenario: ActiveScenario | null;
  interviewerText: string;
  onPressStart: () => void;
  onPressEnd: () => void;
  voiceState: 'idle' | 'listening' | 'processing' | 'speaking' | 'recording';
  micError: string | null;
  micWarning: string | null;
  inputDisabled: boolean;
  onExit?: () => void;
  /** When true, show "Audio unavailable — read above, then speak when ready" */
  ttsFallbackActive?: boolean;
  /** When true, show mic-denied state with "Enable in browser settings" / open app settings */
  micPermissionDenied?: boolean;
  /** When true, show "Aira is thinking..." (visual only, no TTS) */
  isWaiting?: boolean;
  /** When true, mic button is tap-to-toggle (one tap start, one tap stop) and onMicPress is used */
  micToggleMode?: boolean;
  /** Used when micToggleMode is true */
  onMicPress?: () => void;
  /** Override mic label when micToggleMode is true (e.g. "Tap to speak" / "Tap to stop") */
  micLabelOverride?: string;
  /** When true, the current interviewer line is an error message — style it distinctly (red tint) */
  interviewerLineIsError?: boolean;
}

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap";

export const UserInterviewLayout: React.FC<UserInterviewLayoutProps> = ({
  flameState,
  activeScenario,
  interviewerText,
  onPressStart,
  onPressEnd,
  voiceState,
  micError,
  micWarning,
  inputDisabled,
  onExit,
  ttsFallbackActive = false,
  micPermissionDenied = false,
  isWaiting = false,
  micToggleMode = false,
  onMicPress,
  micLabelOverride,
  interviewerLineIsError = false,
}) => {
  const rippleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, []);

  useEffect(() => {
    if (voiceState !== 'listening' && voiceState !== 'recording') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rippleAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(rippleAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [voiceState, rippleAnim]);

  const micLabel =
    micLabelOverride !== undefined
      ? micLabelOverride
      : voiceState === 'listening' || voiceState === 'recording'
        ? 'Listening...'
        : voiceState === 'speaking'
          ? 'Speaking...'
          : voiceState === 'processing'
            ? '...'
            : 'Hold to speak';

  const statusLabelOpacity =
    voiceState === 'speaking' || voiceState === 'processing' ? 0.35 : 0.7;

  const rippleScale = rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const rippleOpacity = rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  const isMicDisabled = !!micError || inputDisabled || voiceState === 'speaking' || voiceState === 'processing';
  const micOpacity = voiceState === 'speaking' ? 0.35 : 1;
  const isListeningOrRecording = voiceState === 'listening' || voiceState === 'recording';

  return (
    <View style={styles.pageWrapper}>
      {/* Grain overlay */}
      {Platform.OS === 'web' && (
        <View
          style={styles.grainOverlay}
          pointerEvents="none"
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.wordmark}>
          <Text style={styles.wordmarkText}>
            amor<Text style={styles.wordmarkAe}>æ</Text>a
          </Text>
        </View>
        <Text style={styles.headerLabel}>Interview</Text>
        {onExit ? (
          <Pressable onPress={onExit} style={styles.exitButton} hitSlop={16}>
            <Ionicons name="exit-outline" size={24} color={FLAME_MID} />
          </Pressable>
        ) : (
          <View style={styles.exitPlaceholder} />
        )}
      </View>

      {/* Main content */}
      <View style={styles.main}>
        {/* Ambient glow behind flame */}
        <View style={styles.ambientGlow} pointerEvents="none" />

        {/* FlameOrb — existing component, no changes */}
        <View style={styles.flameSection}>
          <FlameOrb state={flameState} size={180} />
        </View>

        {/* Bottom section */}
        <View style={styles.bottomSection}>
          {activeScenario && (
            <View style={styles.scenarioCard}>
              <Text style={styles.scenarioCardLabel}>◆ {activeScenario.label}</Text>
              <Text style={styles.scenarioCardText} numberOfLines={6} ellipsizeMode="tail">
                {activeScenario.text}
              </Text>
            </View>
          )}

          {isWaiting ? (
            <Text style={styles.waitingText}>Aira is thinking...</Text>
          ) : interviewerText ? (
            <Text
              style={[styles.interviewerQuote, interviewerLineIsError && styles.interviewerQuoteError]}
              numberOfLines={4}
              ellipsizeMode="tail"
            >
              "{interviewerText}"
            </Text>
          ) : null}

          {ttsFallbackActive ? (
            <Text style={styles.ttsFallbackNotice}>
              ◆ Audio unavailable — read above, then speak when ready
            </Text>
          ) : null}

          <View style={styles.micSection}>
            {micError ? <Text style={styles.dockError}>{micError}</Text> : null}
            {micWarning && !micError ? <Text style={styles.dockWarning}>{micWarning}</Text> : null}
            {micPermissionDenied ? (
              <View style={styles.micDeniedBlock}>
                <View style={styles.micDeniedIconWrap}>
                  <Ionicons name="mic-off" size={24} color="#E87A7A" />
                </View>
                <Text style={styles.micDeniedText}>
                  Microphone access is required for this interview.
                </Text>
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.reload) {
                      window.location.reload();
                    } else {
                      Linking.openSettings();
                    }
                  }}
                  style={styles.micDeniedButton}
                >
                  <Text style={styles.micDeniedButtonLabel}>
                    {Platform.OS === 'web' ? 'Enable in browser settings →' : 'Open app settings →'}
                  </Text>
                </Pressable>
                <Text style={styles.micDeniedHint}>
                  {Platform.OS === 'web'
                    ? 'Open your browser settings, find this site under permissions, and allow microphone access. Then refresh the page.'
                    : 'Allow microphone access in your device settings, then return here.'}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.micButtonWrapper}>
                  {isListeningOrRecording && (
                    <Animated.View
                      style={[
                        styles.rippleRing,
                        {
                          opacity: rippleOpacity,
                          transform: [{ scale: rippleScale }],
                        },
                      ]}
                      pointerEvents="none"
                    />
                  )}
                  <Pressable
                    onPress={micToggleMode && onMicPress ? onMicPress : undefined}
                    onPressIn={micToggleMode ? undefined : onPressStart}
                    onPressOut={micToggleMode ? undefined : onPressEnd}
                    disabled={isMicDisabled}
                    style={[
                      styles.micButton,
                      isListeningOrRecording && styles.micButtonListening,
                      { opacity: micOpacity },
                    ]}
                  >
                    {voiceState === 'processing' ? (
                      <ActivityIndicator size="small" color={FLAME_MID} />
                    ) : (
                      <Ionicons name="mic" size={24} color={FLAME_MID} />
                    )}
                  </Pressable>
                </View>
                <Text style={[styles.micLabel, { opacity: statusLabelOpacity }]}>{micLabel}</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {Platform.OS === 'web' && (
        <style>{`
          @keyframes ripple {
            0%   { transform: scale(1);   opacity: 0.5; }
            100% { transform: scale(1.6); opacity: 0;   }
          }
        `}</style>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  pageWrapper: {
    width: '100%',
    flex: 1,
    backgroundColor: BG,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  grainOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.022,
    zIndex: 999,
    ...(Platform.OS === 'web'
      ? {
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }
      : {}),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82, 142, 220, 0.08)',
    backgroundColor: BG,
    zIndex: 10,
  },
  wordmark: {},
  wordmarkText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 2.4,
    color: FLAME_BRIGHT,
  },
  wordmarkAe: {
    color: FLAME_MID,
  },
  headerLabel: {
    fontFamily: FONT_UI,
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: TEXT_DIM,
  },
  exitButton: {
    backgroundColor: 'transparent',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(82, 142, 220, 0.2)',
  },
  exitPlaceholder: {
    width: 40,
    height: 40,
  },
  main: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 24,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    top: '20%',
    left: '50%',
    width: 320,
    height: 320,
    marginLeft: -160,
    borderRadius: 160,
    backgroundColor: 'rgba(30, 111, 217, 0.1)',
    ...(Platform.OS === 'web'
      ? { filter: 'blur(40px)' }
      : { shadowColor: FLAME_CORE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 40 }),
    zIndex: 0,
  },
  flameSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    zIndex: 1,
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
    zIndex: 1,
  },
  scenarioCard: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Platform.OS === 'web' ? 'rgba(13, 17, 32, 0.9)' : SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(82, 142, 220, 0.1)',
    borderRadius: 12,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)' } : {}),
  },
  scenarioCardLabel: {
    fontFamily: FONT_UI,
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: TEXT_DIM,
    marginBottom: 6,
  },
  scenarioCardText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 22,
    color: TEXT_SECONDARY,
    fontStyle: 'italic',
  },
  interviewerQuote: {
    textAlign: 'center',
    maxWidth: 480,
    paddingHorizontal: 8,
    fontFamily: FONT_DISPLAY,
    fontSize: 19,
    fontWeight: '300',
    lineHeight: 32,
    color: FLAME_BRIGHT,
    fontStyle: 'italic',
    letterSpacing: 0.4,
    ...(Platform.OS === 'web'
      ? { textShadow: '0 0 40px rgba(30,111,217,0.3)' }
      : { textShadowColor: 'rgba(30,111,217,0.3)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 40 }),
  },
  interviewerQuoteError: {
    color: '#E87A7A',
    fontStyle: 'normal',
    ...(Platform.OS === 'web'
      ? { textShadow: 'none' }
      : { textShadowColor: 'transparent', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 0 }),
  },
  ttsFallbackNotice: {
    fontFamily: FONT_UI,
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: TEXT_DIM,
    textAlign: 'center',
    marginTop: 8,
  },
  waitingText: {
    textAlign: 'center',
    fontFamily: FONT_DISPLAY,
    fontSize: 17,
    fontWeight: '300',
    fontStyle: 'italic',
    color: TEXT_DIM,
    letterSpacing: 0.4,
  },
  micDeniedBlock: {
    alignItems: 'center',
    maxWidth: 280,
    gap: 10,
  },
  micDeniedIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(232,122,122,0.3)',
    backgroundColor: 'rgba(232,122,122,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  micDeniedText: {
    fontFamily: FONT_UI,
    fontSize: 12,
    fontWeight: '300',
    color: TEXT_SECONDARY,
    lineHeight: 20,
    textAlign: 'center',
  },
  micDeniedButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  micDeniedButtonLabel: {
    fontFamily: FONT_UI,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: FLAME_BRIGHT,
  },
  micDeniedHint: {
    fontFamily: FONT_UI,
    fontSize: 10,
    fontWeight: '300',
    color: TEXT_DIM,
    lineHeight: 16,
    textAlign: 'center',
  },
  micSection: {
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  micButtonWrapper: {
    position: 'relative',
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: 'rgba(30, 111, 217, 0.2)',
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(82, 142, 220, 0.35)',
    backgroundColor: 'rgba(30, 111, 217, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonListening: {
    borderColor: FLAME_CORE,
    backgroundColor: 'rgba(30, 111, 217, 0.15)',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 24px rgba(30, 111, 217, 0.4)' }
      : { shadowColor: FLAME_CORE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 8 }),
  },
  micLabel: {
    fontFamily: FONT_UI,
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: FLAME_MID,
  },
  dockError: {
    fontSize: 13,
    color: '#E57373',
    marginBottom: 8,
  },
  dockWarning: {
    fontSize: 13,
    color: '#FFB74D',
    marginBottom: 8,
  },
});
