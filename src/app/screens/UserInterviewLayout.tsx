import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Animated,
  Linking,
  Modal,
  ScrollView,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlameOrb, type FlameState } from './FlameOrb';
// Design tokens — Amoraea interviewer
const BG = '#05060D';
const SURFACE = '#0D1120';
const BORDER = 'rgba(82, 142, 220, 0.12)';
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
  /** Web desktop: hover Show scenario (closes on pointer leave). Web mobile + native: press-and-hold. Only when parent sets true (scenario delivered, not during intro/transition). */
  showScenarioReferenceEnabled: boolean;
  /** Scenario vignette text committed after delivery (modal body). */
  referenceCardScenario: ActiveScenario | null;
  /** Last interrogative sentence for this scenario (reflection stripped upstream in AriaScreen); null hides separator and question. */
  referenceCardPrompt: string | null;
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
  /** When true, show "Amoraea is thinking..." (visual only, no TTS) */
  isWaiting?: boolean;
  /** When true, mic button is tap-to-toggle (one tap start, one tap stop) and onMicPress is used */
  micToggleMode?: boolean;
  /** Used when micToggleMode is true */
  onMicPress?: () => void;
  /** Web (tap-to-speak): runs on press in — use for gesture-gated audio (e.g. iOS Safari speechSynthesis). */
  onMicPressIn?: () => void;
  /** Override mic label when micToggleMode is true (e.g. "Tap to speak" / "Tap to stop") */
  micLabelOverride?: string;
  /** Web: HTTP on LAN (not a secure context) — mic/TTS blocked by browser; show fix instructions */
  webInsecureContextMessage?: string | null;
  /** One-time device / thermal / routing notice at interview start (cleared when mic is used). */
  sessionAudioHealthNotice?: string | null;
  /** 0–1 live mic level while recording (expo metering / web analyser). */
  micInputLevel?: number;
  /** After resume from background / interruption — mic session is being re-established. */
  micSessionRecovering?: boolean;
  /** Hardware route lost — show manual reconnect. */
  micReconnectPrompt?: { message: string; onReconnect: () => void } | null;
  /** Rare escape hatch when capture/transcription likely failed — secondary text control. */
  micFailureEscape?: { onPress: () => void } | null;
}

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400;500&display=swap";

/** Break fiction into lines between sentences for scanning (single newline saves vertical space vs double). */
function formatScenarioModalBody(raw: string): string {
  const t = (raw ?? '').trim();
  if (!t) return '';
  return t.replace(/(\.\s+)(?=[A-Z])/g, '$1\n');
}

/** Web only: scenario reference modal text should not be selectable/copyable. */
const WEB_MODAL_NO_COPY = (Platform.OS === 'web'
  ? { userSelect: 'none', WebkitUserSelect: 'none' }
  : {}) as ViewStyle;

/** Web touch: long-press on label triggers selection + touchcancel → Pressable fires out → modal closes. */
const WEB_SHOW_SCENARIO_NO_SELECT = (Platform.OS === 'web'
  ? {
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
      touchAction: 'manipulation',
    }
  : {}) as ViewStyle;

export const UserInterviewLayout: React.FC<UserInterviewLayoutProps> = ({
  flameState,
  showScenarioReferenceEnabled,
  referenceCardScenario,
  referenceCardPrompt,
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
  onMicPressIn,
  micLabelOverride,
  webInsecureContextMessage = null,
  sessionAudioHealthNotice = null,
  micInputLevel = 0,
  micSessionRecovering = false,
  micReconnectPrompt = null,
  micFailureEscape = null,
}) => {
  const [refCardOpen, setRefCardOpen] = useState(false);
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const safeInsets = useSafeAreaInsets();
  /** Mobile Safari: `useWindowDimensions` can exceed the visible viewport (URL bar / home indicator). */
  const [visualViewportH, setVisualViewportH] = useState<number | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => setVisualViewportH(vv.height);
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
    };
  }, []);
  const layoutHeight = visualViewportH != null ? Math.min(windowHeight, visualViewportH) : windowHeight;

  /** Card caps at viewport; vignette ScrollView caps so long text scrolls without forcing a tall empty card. */
  const { refModalCardMaxHeight, refModalScrollMaxHeight } = useMemo(() => {
    const overlayPadY = 80;
    const innerH = Math.max(0, layoutHeight - overlayPadY);
    const cardMax = Math.min(innerH * 0.82, 580);
    const labelChrome = 48;
    const footerChrome = referenceCardPrompt ? 168 : 8;
    return {
      refModalCardMaxHeight: cardMax,
      refModalScrollMaxHeight: Math.max(96, cardMax - labelChrome - footerChrome),
    };
  }, [layoutHeight, referenceCardPrompt]);

  /**
   * Web is one platform for both desktop and mobile browsers. Touch phones report no hover — only
   * `(hover: hover) and (pointer: fine)` should use hover; otherwise use press-and-hold like native.
   */
  const [webShowScenarioHoverMode, setWebShowScenarioHoverMode] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setWebShowScenarioHoverMode(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /** Native + mobile web: long-press; desktop web with mouse: hover (no hint). */
  const showScenarioPressAndHoldHint = Platform.OS !== 'web' || !webShowScenarioHoverMode;

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
            : 'Tap to speak';

  const statusLabelOpacity =
    voiceState === 'speaking' || voiceState === 'processing' ? 0.35 : 0.7;

  const rippleScale = rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const rippleOpacity = rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  const isMicDisabled = !!micError || inputDisabled || voiceState === 'speaking' || voiceState === 'processing';
  const micOpacity = voiceState === 'speaking' ? 0.35 : 1;
  const isListeningOrRecording = voiceState === 'listening' || voiceState === 'recording';
  const isRecording = voiceState === 'recording';

  /** Shrink orb on short viewports so mic + SHOW SCENARIO stay above the fold (esp. mobile Safari + home indicator). */
  const flameOrbSize = useMemo(
    () => Math.round(Math.min(170, Math.max(96, layoutHeight * 0.2))),
    [layoutHeight]
  );

  const mainDynamicStyle = useMemo(() => {
    const topPad = layoutHeight < 720 ? 10 : 24;
    if (Platform.OS === 'web') {
      return {
        paddingTop: topPad,
        paddingBottom: 'max(40px, env(safe-area-inset-bottom, 0px))' as unknown as number,
      };
    }
    return {
      paddingTop: topPad,
      paddingBottom: Math.max(40, 24 + safeInsets.bottom),
    };
  }, [layoutHeight, safeInsets.bottom]);

  // Pulse animation for mic button when recording/listening
  const micPulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isListeningOrRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(micPulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(micPulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => {
        loop.stop();
        micPulseAnim.setValue(1);
      };
    }
    micPulseAnim.setValue(1);
  }, [isListeningOrRecording, micPulseAnim]);

  const interviewMainColumn = (
    <View style={styles.interviewMainColumnRoot}>
      {/* Soft blur behind flame — web only; native shadow reads as a misaligned circle behind the orb */}
      {Platform.OS === 'web' ? (
        <View style={styles.ambientGlow} pointerEvents="none" />
      ) : null}

      {/* FlameOrb — existing component, no changes */}
      <View style={styles.flameSection}>
        <FlameOrb state={flameState} size={flameOrbSize} />
      </View>

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        {isWaiting ? (
          <View style={styles.waitingRow}>
            <Text style={styles.waitingDot}>◆</Text>
            <Text style={styles.waitingText}>Amoraea is thinking...</Text>
          </View>
        ) : null}

        {webInsecureContextMessage && Platform.OS === 'web' ? (
          <Text style={styles.insecureContextBanner}>{webInsecureContextMessage}</Text>
        ) : null}

        {sessionAudioHealthNotice && !micError ? (
          <Text style={styles.insecureContextBanner}>{sessionAudioHealthNotice}</Text>
        ) : null}

        {ttsFallbackActive ? (
          <Text style={styles.ttsFallbackNotice}>
            {Platform.OS === 'web'
              ? '◆ Audio unavailable — hover Show scenario to read the question, then speak when ready'
              : '◆ Audio unavailable — hold Show scenario to read the question, then speak when ready'}
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
              {micSessionRecovering ? (
                <Text style={styles.micRecoveringHint}>Reconnecting microphone…</Text>
              ) : null}
              {micReconnectPrompt ? (
                <View style={styles.micReconnectBox}>
                  <Text style={styles.micReconnectText}>{micReconnectPrompt.message}</Text>
                  <Pressable
                    onPress={() => micReconnectPrompt.onReconnect()}
                    style={styles.micReconnectButton}
                    accessibilityRole="button"
                    accessibilityLabel="Reconnect microphone"
                  >
                    <Text style={styles.micReconnectButtonLabel}>Tap to reconnect</Text>
                  </Pressable>
                </View>
              ) : null}
              {(isRecording || micInputLevel > 0.02) && (
                <View style={styles.micMeterRow} accessibilityLabel="Microphone input level">
                  {[0, 1, 2, 3, 4].map((i) => {
                    const active = micInputLevel > i * 0.22;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.micMeterSegment,
                          {
                            height: 6 + i * 4,
                            marginRight: i < 4 ? 4 : 0,
                            backgroundColor: active ? FLAME_MID : TEXT_DIM,
                            opacity: active ? 0.85 + i * 0.03 : 0.35,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              )}
              <View style={styles.micButtonWrapper}>
                {Platform.OS === 'web' && isListeningOrRecording && (
                  <Animated.View
                    style={[
                      styles.rippleRing,
                      {
                        opacity: rippleOpacity,
                        transform: [{ scale: rippleScale }],
                      },
                      isRecording && styles.rippleRingRecording,
                    ]}
                    pointerEvents="none"
                  />
                )}
                <Animated.View style={{ transform: [{ scale: isListeningOrRecording ? micPulseAnim : 1 }] }}>
                  <Pressable
                    /**
                     * Mobile browsers (e.g. Brave on Android/iOS) often fail to synthesize `click` / `onPress`
                     * from touch; `onPressIn` still fires. For tap-to-speak, run the mic action on pressIn on web
                     * and omit onPress to avoid double-toggle when both fire on desktop.
                     */
                    onPress={
                      Platform.OS === 'web' && micToggleMode && onMicPress
                        ? undefined
                        : micToggleMode && onMicPress
                          ? onMicPress
                          : undefined
                    }
                    onPressIn={
                      Platform.OS === 'web' && micToggleMode && onMicPress
                        ? () => {
                            onMicPressIn?.();
                            onMicPress();
                          }
                        : Platform.OS === 'web' && micToggleMode && onMicPressIn
                          ? () => onMicPressIn()
                          : micToggleMode
                            ? onMicPressIn ?? undefined
                            : onPressStart
                    }
                    onTouchStart={
                      Platform.OS === 'web' && micToggleMode && onMicPress
                        ? undefined
                        : Platform.OS === 'web' && micToggleMode && onMicPressIn
                          ? () => onMicPressIn()
                          : undefined
                    }
                    onPressOut={micToggleMode ? undefined : onPressEnd}
                    disabled={isMicDisabled}
                    style={[
                      styles.micButton,
                      isListeningOrRecording && (isRecording ? styles.micButtonRecording : styles.micButtonListening),
                      { opacity: micOpacity },
                    ]}
                  >
                    {voiceState === 'processing' ? (
                      <ActivityIndicator size="small" color={FLAME_MID} />
                    ) : (
                      <Ionicons
                        name="mic"
                        size={24}
                        color={isRecording ? '#E84444' : FLAME_MID}
                      />
                    )}
                  </Pressable>
                </Animated.View>
              </View>
              <Text
                style={[
                  styles.micLabel,
                  { opacity: statusLabelOpacity },
                  isRecording && styles.micLabelRecording,
                ]}
              >
                {micLabel}
              </Text>
              {micFailureEscape ? (
                <Pressable
                  onPress={micFailureEscape.onPress}
                  accessibilityRole="button"
                  accessibilityLabel="Amoraea did not hear me"
                  hitSlop={8}
                  style={styles.micFailureEscapePressable}
                >
                  <Text style={styles.micFailureEscapeLabel}>Amoraea didn&apos;t hear me.</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show scenario"
          accessibilityHint={
            Platform.OS === 'web'
              ? webShowScenarioHoverMode
                ? 'Hover to view the scenario reference; it closes when the pointer leaves this button'
                : 'Press and hold to view the current scenario reference'
              : 'Press and hold to view the current scenario reference'
          }
          accessibilityState={{ disabled: !showScenarioReferenceEnabled }}
          disabled={!showScenarioReferenceEnabled}
          {...(Platform.OS === 'web' && webShowScenarioHoverMode
            ? {
                onHoverIn: () => {
                  if (!showScenarioReferenceEnabled || !referenceCardScenario) return;
                  setRefCardOpen(true);
                },
                onHoverOut: () => {
                  setRefCardOpen(false);
                },
              }
            : {
                delayLongPress: 450,
                onLongPress: () => {
                  if (!showScenarioReferenceEnabled || !referenceCardScenario) return;
                  setRefCardOpen(true);
                },
                onPressOut: () => {
                  setRefCardOpen(false);
                },
              })}
          {...(Platform.OS === 'web' && !webShowScenarioHoverMode
            ? {
                onContextMenu: (e: { preventDefault?: () => void }) => {
                  e.preventDefault?.();
                },
              }
            : {})}
          style={(state) => {
            const hovered =
              Platform.OS === 'web' && webShowScenarioHoverMode && (state as { hovered?: boolean }).hovered;
            return [
              styles.showScenarioButton,
              WEB_SHOW_SCENARIO_NO_SELECT,
              !showScenarioReferenceEnabled && styles.showScenarioButtonDisabled,
              showScenarioReferenceEnabled && (state.pressed || hovered) && styles.showScenarioButtonPressed,
            ];
          }}
        >
          <View style={styles.showScenarioButtonInner}>
            <Text
              selectable={false}
              style={[
                styles.showScenarioButtonLabel,
                WEB_SHOW_SCENARIO_NO_SELECT,
                !showScenarioReferenceEnabled && styles.showScenarioButtonLabelDisabled,
              ]}
            >
              SHOW SCENARIO
            </Text>
            {showScenarioPressAndHoldHint ? (
              <Text
                selectable={false}
                style={[
                  styles.showScenarioButtonHint,
                  WEB_SHOW_SCENARIO_NO_SELECT,
                  !showScenarioReferenceEnabled && styles.showScenarioButtonHintDisabled,
                ]}
              >
                (Press and hold)
              </Text>
            ) : null}
          </View>
        </Pressable>

        {/* Native only: RN Modal. Web uses inline overlay — Modal portal breaks hover on Show scenario. */}
        {Platform.OS !== 'web' ? (
          <Modal
            visible={refCardOpen && !!referenceCardScenario}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setRefCardOpen(false);
            }}
          >
            <View style={styles.refModalRoot} pointerEvents="auto">
              <Pressable
                style={[styles.refModalOverlay, WEB_MODAL_NO_COPY]}
                onPress={() => setRefCardOpen(false)}
              >
                <Pressable
                  style={[styles.refModalCard, { maxHeight: refModalCardMaxHeight }, WEB_MODAL_NO_COPY]}
                  onPress={() => {}}
                  accessible={false}
                >
                  <Text style={[styles.refModalLabel, WEB_MODAL_NO_COPY]}>◆ {referenceCardScenario?.label ?? ''}</Text>
                  <ScrollView
                    style={[{ maxHeight: refModalScrollMaxHeight }, WEB_MODAL_NO_COPY]}
                    contentContainerStyle={[styles.refModalScrollContent, WEB_MODAL_NO_COPY]}
                    showsVerticalScrollIndicator
                  >
                    <Text style={[styles.refModalScenarioText, WEB_MODAL_NO_COPY]}>
                      {formatScenarioModalBody(referenceCardScenario?.text ?? '')}
                    </Text>
                  </ScrollView>
                  {referenceCardPrompt ? (
                    <>
                      <View style={styles.refModalSeparator} />
                      <Text style={[styles.refModalPromptText, WEB_MODAL_NO_COPY]}>{referenceCardPrompt}</Text>
                    </>
                  ) : null}
                </Pressable>
              </Pressable>
            </View>
          </Modal>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.pageWrapper, Platform.OS === 'web' && styles.pageWrapperWeb]}>
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
          <Pressable
            onPress={onExit}
            style={styles.exitButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Ionicons name="log-out-outline" size={20} color={FLAME_MID} />
            <Text style={styles.exitButtonLabel}>Log out</Text>
          </Pressable>
        ) : (
          <View style={styles.exitPlaceholder} />
        )}
      </View>

      {/* Main content */}
      {Platform.OS === 'web' ? (
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={[styles.main, mainDynamicStyle, styles.mainScrollContent]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {interviewMainColumn}
        </ScrollView>
      ) : (
        <View style={[styles.main, mainDynamicStyle]}>
          {interviewMainColumn}
        </View>
      )}

      {Platform.OS === 'web' && refCardOpen && referenceCardScenario ? (
        <View style={styles.refModalWebLayer} pointerEvents="none">
          <View style={[styles.refModalOverlay, WEB_MODAL_NO_COPY]}>
            <Pressable
              style={[styles.refModalCard, { maxHeight: refModalCardMaxHeight }, WEB_MODAL_NO_COPY]}
              onPress={() => {}}
              accessible={false}
            >
              <Text style={[styles.refModalLabel, WEB_MODAL_NO_COPY]}>◆ {referenceCardScenario?.label ?? ''}</Text>
              <ScrollView
                style={[{ maxHeight: refModalScrollMaxHeight }, WEB_MODAL_NO_COPY]}
                contentContainerStyle={[styles.refModalScrollContent, WEB_MODAL_NO_COPY]}
                showsVerticalScrollIndicator
              >
                <Text style={[styles.refModalScenarioText, WEB_MODAL_NO_COPY]}>
                  {formatScenarioModalBody(referenceCardScenario?.text ?? '')}
                </Text>
              </ScrollView>
              {referenceCardPrompt ? (
                <>
                  <View style={styles.refModalSeparator} />
                  <Text style={[styles.refModalPromptText, WEB_MODAL_NO_COPY]}>{referenceCardPrompt}</Text>
                </>
              ) : null}
            </Pressable>
          </View>
        </View>
      ) : null}

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
  /** Avoid clipping bottom controls when the visual viewport is shorter than window dimensions (mobile browsers). */
  pageWrapperWeb: {
    overflow: 'visible',
    minHeight: '100%' as unknown as number,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(82, 142, 220, 0.2)',
  },
  exitButtonLabel: {
    fontFamily: FONT_UI,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: FLAME_MID,
  },
  exitPlaceholder: {
    minWidth: 100,
    height: 40,
  },
  main: {
    flex: 1,
    paddingHorizontal: 24,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainWeb: {
    overflow: 'visible',
  },
  mainScroll: {
    flex: 1,
    minHeight: 0,
  },
  mainScrollContent: {
    flexGrow: 1,
    overflow: 'visible',
  },
  interviewMainColumnRoot: {
    width: '100%',
    minHeight: 0,
    flex: 1,
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
    minHeight: 0,
    flexShrink: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    zIndex: 1,
  },
  bottomSection: {
    width: '100%',
    flexShrink: 0,
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
  },
  showScenarioButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(82, 142, 220, 0.35)',
    backgroundColor: 'rgba(30, 111, 217, 0.08)',
    minWidth: 200,
    alignItems: 'center',
  },
  showScenarioButtonInner: {
    alignItems: 'center',
    gap: 4,
  },
  showScenarioButtonPressed: {
    backgroundColor: 'rgba(30, 111, 217, 0.18)',
  },
  showScenarioButtonDisabled: {
    opacity: 0.38,
    borderColor: 'rgba(82, 142, 220, 0.12)',
    backgroundColor: 'rgba(13, 17, 32, 0.5)',
  },
  showScenarioButtonLabel: {
    fontFamily: FONT_UI,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: FLAME_MID,
  },
  showScenarioButtonLabelDisabled: {
    color: TEXT_DIM,
  },
  showScenarioButtonHint: {
    fontFamily: FONT_UI,
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 0.8,
    color: TEXT_SECONDARY,
  },
  showScenarioButtonHintDisabled: {
    color: TEXT_DIM,
    opacity: 0.7,
  },
  /** Web: scenario layer lives in pageWrapper (not Modal) so hover is not lost to a portal. */
  refModalWebLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  refModalRoot: {
    flex: 1,
  },
  refModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  refModalCard: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'column',
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 24px 80px rgba(0,0,0,0.55)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.45,
          shadowRadius: 24,
          elevation: 16,
        }),
  },
  refModalLabel: {
    fontFamily: FONT_UI,
    fontSize: 8,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: TEXT_DIM,
    marginBottom: 6,
  },
  refModalScrollContent: {
    paddingBottom: 6,
    flexGrow: 0,
  },
  /**
   * Vignette body: Jost (sans) reads more clearly on screen than long italic serif blocks.
   * Web: slightly narrower measure. Native: system UI font when FONT_UI is unset.
   */
  refModalScenarioText: {
    fontFamily: FONT_UI,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: 0.12,
    color: '#EEF6FC',
    fontStyle: 'normal',
    ...(Platform.OS === 'web'
      ? {
          fontWeight: '500',
          maxWidth: 428,
          alignSelf: 'center',
        }
      : {}),
  },
  refModalSeparator: {
    height: 1,
    backgroundColor: 'rgba(82, 142, 220, 0.2)',
    marginVertical: 10,
    width: '100%',
  },
  refModalPromptText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
    letterSpacing: 0.1,
    color: FLAME_BRIGHT,
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
  insecureContextBanner: {
    fontFamily: FONT_UI,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: '#E8A060',
    textAlign: 'center',
    marginTop: 10,
    marginHorizontal: 12,
    paddingHorizontal: 8,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  waitingDot: {
    color: FLAME_MID,
    fontSize: 11,
    letterSpacing: 1,
  },
  waitingText: {
    textAlign: 'center',
    fontFamily: FONT_DISPLAY,
    fontSize: 17,
    fontWeight: '300',
    fontStyle: 'italic',
    color: '#8FB8E3',
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
  rippleRingRecording: {
    borderColor: 'rgba(232, 68, 68, 0.4)',
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
  micButtonRecording: {
    borderColor: '#E84444',
    backgroundColor: 'rgba(232, 68, 68, 0.2)',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 24px rgba(232, 68, 68, 0.4)' }
      : { shadowColor: '#E84444', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 8 }),
  },
  micLabel: {
    fontFamily: FONT_UI,
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: FLAME_MID,
  },
  micLabelRecording: {
    color: '#E84444',
  },
  micFailureEscapePressable: {
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignSelf: 'center',
  },
  micFailureEscapeLabel: {
    fontFamily: FONT_UI,
    fontSize: 11,
    fontWeight: '300',
    color: TEXT_DIM,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  micRecoveringHint: {
    fontFamily: FONT_UI,
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 8,
    textAlign: 'center',
  },
  micReconnectBox: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(232, 122, 90, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 122, 90, 0.35)',
    alignItems: 'center',
    maxWidth: 280,
  },
  micReconnectText: {
    fontFamily: FONT_UI,
    fontSize: 13,
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  micReconnectButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: FLAME_CORE,
  },
  micReconnectButtonLabel: {
    fontFamily: FONT_UI,
    fontSize: 13,
    fontWeight: '500',
    color: '#E8F0F8',
  },
  micMeterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 8,
  },
  micMeterSegment: {
    width: 6,
    borderRadius: 2,
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
