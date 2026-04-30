import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  AppState,
  Linking,
  InteractionManager,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { FeedbackBubble } from '@/components/FeedbackBubble';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import {
  INTERVIEWER_SYSTEM_FRAMEWORK,
  buildInterviewerParticipantFirstNameSystemSuffix,
  dedupeAdjacentBoundaryValidationsBeforeParticipantName,
  ensureSpokenTextIncludesParticipantFirstName,
  getInterviewUserFirstNameForPrompt,
  isBoundaryWarmValidationOnlySentence,
  shouldDeferStreamingBoundaryWarmClause,
} from '@features/aria/interviewerFrameworkPrompt';
import { buildElongatingProbeStateSuffix, isApprovedElongatingProbeOnly } from '@features/aria/elongatingProbe';
import {
  buildMoment4HandoffForInterview,
  buildScenario1To2BundleForInterview,
  buildScenario2To3TransitionBody,
  ensureScenario2BundleWhenOpeningWithoutVignette,
} from '@features/aria/interviewTransitionBundles';
import { resolveWebActiveGestureOverlayKind, type WebActiveGestureOverlayKind } from '@features/aria/webInterviewGestureOverlay';
import {
  interviewAssistantTextHasDisallowedNameMarker,
  sanitizeAssistantInterviewerCharacterNames,
} from '@/constants/interviewCharacterNames';
import {
  INTERVIEW_MARKER_IDS,
  INTERVIEW_MARKER_LABELS,
  SLICE_ONLY_MARKER_LABELS,
} from '@features/aria/interviewMarkers';
import { computeGateResult, GATE_PASS_WEIGHTED_MIN, type GateResult } from '@features/aria/computeGateResult';
import {
  NON_ENGLISH_VOICE_PROMPT,
  parseWhisperTranscriptionPayload,
  parseWhisperVerboseStats,
  shouldRejectVoiceForNonEnglish,
  countSpokenWords,
  isSimpleYesNoInterviewMoment,
  isShortAnswerOkForWhisperRatioGate,
  getWhisperReaskTurnContext,
  shouldFireWhisperRatioReask,
  whisperLanguageIsEnglish,
} from '@features/aria/interviewLanguageGate';
import {
  resolveWeightedPassMinAfterReferralFulfillment,
  ensureShareableReferralCodeForReferrer,
} from '@features/referrals/referralInterview';
import {
  setPlaybackMode,
  setRecordingMode,
  applyPlaybackBridgeBeforeTtsIfIos,
  refreshAudioSessionAfterRouteChange,
  setRecordingPlaybackTransitionTelemetryHook,
} from '@features/aria/utils/audioModeHelpers';
import { probeHeadphoneRoute, type HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import { setAudioRouteKind, getAudioRouteKind } from '@features/aria/config/audioRouteRuntime';
import {
  getAudioWhisperTranscriptionTimeoutMs,
  getAudioMinRecordingDurationMs,
  getAudioSilenceDetectionThresholdMsForLogs,
  getLateStartThresholdMs,
} from '@features/aria/config/audioInterviewConfig';
import { WHISPER_LANGUAGE, WHISPER_MODEL, WHISPER_TEMPERATURE } from '@features/aria/config/whisperApiConstants';
import { isTtsDurationMatchWithinOverrunTolerance } from '@features/aria/utils/interviewTtsDurationMatch';
import { parseJsonObjectFromModelText } from '@utilities/parseHolisticModelJson';
import { runWithThreeAttemptsFixedBackoff } from '@utilities/networkRetry';
import { hasLikelySpeechAfterRecording } from '@features/aria/utils/audioEnergy';
import { analyzeRecordingBuffer } from '@features/aria/utils/recordingBufferAnalysis';
import { resetInterviewVadSession } from '@features/aria/utils/interviewVadSession';
import {
  bumpAriaScreenMountGeneration,
  getAriaScreenMountGeneration,
  getLastGestureMountGeneration,
  getLastWebInterviewUserGestureMs,
  markWebInterviewUserGestureNow,
  resetWebInterviewGestureContext,
  type GestureContextLostReason,
} from '@features/aria/utils/webInterviewGestureContext';
import {
  speakWithElevenLabs,
  stopElevenLabsPlayback,
  stopElevenLabsSpeech,
  pauseWebInterviewHtmlAudioForDocumentHidden,
  tryPlayPendingWebTtsAudioInUserGesture,
  hasPendingWebGestureBlobUrl,
  trySpeakWebSpeechInUserGesture,
  isWebTtsRequiresUserGestureError,
  unlockWebAudioForAutoplay,
  primeHtmlAudioForMobileTtsFromMicGesture,
  resetWebInterviewAudioSession,
  isWebInterviewAudioUnlocked,
  webSpeechShouldDeferToUserGesture,
  WebTtsRequiresUserGestureError,
  isWebInterviewPlaybackSurfaceActive,
} from '@features/aria/utils/elevenLabsTts';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { supabase } from '@data/supabase/client';
import {
  saveInterviewToStorage,
  loadInterviewFromStorage,
  clearInterviewFromStorage,
  getCurrentScenario,
  setStorageFallbackListener,
  type StoredInterviewData,
} from '@utilities/storage/InterviewStorage';
import { requestMicrophonePermissionForInterviewStart } from '@utilities/permissions/requestMicPermission';
import { withRetry, classifyError } from '@utilities/withRetry';
import { remoteLog } from '@utilities/remoteLog';
import { isWebInsecureDevUrl, webInsecureContextHelpMessage } from '@utilities/webSecureContext';
import { waitForInterviewAttemptScoringReady } from '@utilities/waitForInterviewAttemptScoringReady';
import {
  buildUsersRowInterviewPassFromGate,
  fetchInterviewPassAdminOverride,
  interviewPassWhileScoringPending,
} from '@utilities/interviewPassEffective';
import { runCommunicationStylePipelineAfterSave } from '@utilities/runCommunicationStylePipeline';
import { writeSessionLog, logSupabaseWriteFailed } from '@utilities/sessionLogging/writeSessionLog';
import {
  resetSessionLogRuntime,
  setSessionLogPlatform,
  markQuestionDelivered,
  setRecordingSessionActive,
  setTtsPlaybackActive,
  touchActivity,
  setLastHiddenAtMs,
  setNavigationAwayAtMs,
  getSessionLogRuntime,
  assignAttemptIdForSessionLogs,
  logGateAnalyticsToSession,
  logTouchActivityForPause,
} from '@utilities/sessionLogging';
import { collectDeviceContext } from '@utilities/sessionLogging/collectDeviceContext';
import { captureWebSessionLogDeviceContext } from '@utilities/sessionLogging/webSessionLogDeviceContext';
import { showConfirmDialog, showSimpleAlert } from '@utilities/alerts/confirmDialog';
import { gatherRecordingStartTelemetry, gatherTtsPlaybackTelemetry } from '@utilities/sessionLogging/sessionAudioTelemetry';
import {
  consumeTtsBufferCompleteBeforePlaybackFlag,
  consumeTtsPlaybackStrategyForNextPlayback,
  prepareTtsPlaybackTelemetryState,
} from '@features/aria/telemetry/ttsBufferTelemetry';
import {
  writeAudioSessionLog,
  setAudioSessionDeviceSnapshot,
  setLastInterviewDeviceEnvironment,
  setSessionAudioRoutes,
  markInterviewSessionClockStart,
  markLastAudioSessionEventType,
  getInterviewWallClockStartMs,
  getLastAudioSessionEventType,
  getLastTtsCompletionCallbackMs,
  setLastTtsCompletionCallbackMs,
  peekRecordingDelayExtraFromEarlyCutoffMs,
  takeRecordingDelayExtraFromEarlyCutoffMs,
  incrementReAskCountThisSession,
  setLastWhisperRatioTelemetry,
  resetAudioInterviewTurnCounters,
  getAudioCorrelationFields,
} from '@utilities/sessionLogging/audioSessionLogEnvelope';
import {
  refreshWebAudioRoutesForSession,
  subscribeWebAudioDeviceChange,
  resetWebAudioRouteSessionFingerprint,
} from '@utilities/sessionLogging/webMediaDeviceAudioRoute';
import {
  resetTtsDurationCalibration,
  getTtsExpectedDurationMsFromCharCount,
  recordTtsTurnDurationRatio,
} from '@utilities/sessionLogging/ttsDurationCalibration';
import {
  collectInterviewDeviceEnvironment,
  mapHeadphoneProbeToSessionInputRoute,
  shouldWarnHighThermal,
} from '@utilities/sessionLogging/interviewDeviceEnvironment';
import { persistInterviewAttemptSessionLifecycle } from '@utilities/interviewAttemptLifecycle';
import { FlameOrb } from '@app/screens/FlameOrb';
import { UserInterviewLayout, type ActiveScenario } from '@app/screens/UserInterviewLayout';
import { InterviewAnalysisScreen } from '@app/screens/InterviewAnalysisScreen';
import { AdminInterviewDashboard, AdminAttemptTabsView } from '@app/screens/AdminInterviewDashboard';
import { UserCommunicationStyleSection } from '@ui/components/UserCommunicationStyleSection';
import {
  calculateScoreConsistency,
  calculateConstructAsymmetry,
  analyzeLanguageMarkers,
  buildScenarioBoundaries,
} from '@features/aria/alphaAssessmentUtils';
import { classifyAIReasoningRequestError, generateAIReasoning } from '@features/aria/generateAIReasoning';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { useAudioRecorder } from '@features/aria/hooks/useAudioRecorder';
import {
  beginInterviewMicPreInitDuringTts,
  scheduleWebMicPreInitRefreshAfterTtsCompletes,
  refreshWebMicPreInitIfStaleAfterLateStartWindow,
  finalizeInterviewMicAmbientOnTtsEnd,
  type PreInitTriggerDuring,
} from '@features/aria/utils/webInterviewMicPreInit';
import {
  prefetchWebInterviewGreetingMp3,
  releaseWebInterviewGreetingPrefetch,
  getPrefetchedGreetingHtmlAudioElement,
  WEB_INTERVIEW_OPENING_GREETING,
} from '@features/aria/utils/webInterviewGreetingAudio';
import {
  preAuthorizeAudioElementOnMicTapGesture,
  isPreAuthorizedAudioPendingForNextTts,
  reauthorizePendingPreAuthorizedElement,
} from '@features/aria/utils/webPreAuthorizedTtsAudio';
import { debugNoteWebAudioRouteChange } from '@features/aria/utils/elevenLabsTts';
import { markSessionResumedForNextRecordingStart } from '@utilities/sessionLogging/sessionResumeRecordingTelemetry';
import {
  evaluateMoment4RelationshipType,
  looksLikeMisplacedNonGrudgeMoment4Answer,
  looksLikeMoment4GrudgePrompt,
  shouldForceMoment4ThresholdProbe as shouldForceMoment4ThresholdProbeByType,
} from '@features/aria/moment4ProbeLogic';
import {
  applyContemptExpressionHeuristicToScenarioScores,
  enrichScenarioSliceWithContemptHeuristic,
  userTurnTextForInterviewScenario,
} from '@features/aria/contemptExpressionScenarioHeuristic';
import { CONTEMPT_EXPRESSION_SCORING_RUBRIC } from '@features/aria/contemptExpressionScoringRubric';
import { sanitizePersonalMomentScoresForAggregate } from '@features/aria/personalMomentSliceSanitize';
import { analyzeCommitmentThresholdInconsistency } from '@features/aria/commitmentThresholdSliceAnalysis';
import {
  hasScenarioAQ1ContemptProbeCoverage,
  hasScenarioBQ1OnTopicEngagement,
  hasScenarioCCommitmentThresholdInUserAnswer,
  hasScenarioCVignetteCommitmentThresholdSignal,
  scenarioCCommitmentThresholdMatchDetail,
  extractScenario3CommitmentThresholdUserAnswerAfterPrompt,
  extractScenario3UserCorpusAfterLastRepairPrompt,
  extractScenario3UserCorpusBeforeRepairPrompt,
  type ScenarioCorpusMessageSlice,
  isLikelyMisplacedPersonalNarrativeForScenarioCThreshold,
  isMisplacedScenarioCQ1Answer,
  isScenarioCQ1Prompt,
  isScenarioCRepairAssistantPrompt,
  normalizeInterviewTypography,
  normalizeScoresByEvidence,
  sliceTranscriptBeforeScenarioCToPersonalHandoff,
} from '@features/aria/probeAndScoringUtils';
import { fullScenarioReconciliation } from '@features/aria/reconcileScenarioScoresTranscript';
import {
  aggregatePillarScoresWithCommitmentMergeDetailed,
  type MarkerScoreSlice,
} from '@features/aria/aggregateMarkerScoresFromSlices';
import {
  ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST,
  REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING,
  REPAIR_CONDITIONAL_AND_PROMPTED_SCORING,
  SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS,
  SCORE_CALIBRATION_0_10,
} from '@features/aria/interviewScoringCalibration';
import { buildScoringPrompt, SCORING_CONFIDENCE_INSTRUCTIONS } from '@features/aria/holisticScoringPrompt';
import { SCENARIO_B_VIGNETTE as SCENARIO_2_VIGNETTE } from '@/constants/scenarioBVignette';
import { buildPersonalMomentScoringPrompt } from '@features/aria/personalMomentScoringPrompt';
import { inferPersonalMomentSlices } from '@features/aria/personalMomentSlices';
import * as FileSystem from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { LEGAL_PRIVACY_POLICY_URL, LEGAL_TERMS_OF_SERVICE_URL } from '@/constants/legalUrls';

// #region agent log
if (typeof fetch !== 'undefined') {
  console.info('[ARIA_MODULE_EVALUATED]');
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
    body: JSON.stringify({
      sessionId: 'e70f17',
      location: 'AriaScreen.tsx:after-imports',
      message: 'AriaScreen module body executing (imports completed)',
      data: { platform: typeof navigator !== 'undefined' ? String(navigator.userAgent).slice(0, 160) : 'no-ua' },
      timestamp: Date.now(),
      hypothesisId: 'H3',
      runId: 'pre-fix',
    }),
  }).catch(() => {});
}
// #endregion

const FALLBACK_MARKER_SCORES_MID: Record<string, number> = {
  mentalizing: 6,
  accountability: 7,
  contempt: 6,
  repair: 7,
  regulation: 6,
  attunement: 7,
  appreciation: 6,
  commitment_threshold: 6,
};
const FALLBACK_MARKER_SCORES_ALL_MARKERS: Record<string, number> = Object.fromEntries(
  INTERVIEW_MARKER_IDS.map((id) => [id, 7])
) as Record<string, number>;

const profileRepository = new ProfileRepository();

type InterviewMomentIndex = 1 | 2 | 3 | 4;
type PostInterviewFeedbackKey = 'conversation_quality' | 'clarity_flow' | 'trust_accuracy';

const POST_INTERVIEW_FEEDBACK_QUESTIONS: Array<{ id: PostInterviewFeedbackKey; title: string; prompt: string }> = [
  {
    id: 'conversation_quality',
    title: 'Conversation Quality',
    prompt: 'Did Amoraea feel human? Did you feel heard? How was the conversation flow? Was it easy and natural to follow?',
  },
  {
    id: 'clarity_flow',
    title: 'Clarity and Flow',
    prompt: 'Did you understand what was being asked of you? Did the length feel appropriate?',
  },
  {
    id: 'trust_accuracy',
    title: 'Trust and Accuracy',
    prompt:
      'Did you feel the grading and the questions were fair? What about the follow-up questions? How accurately do you think the interview measures relationship-readiness?',
  },
];

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function createInitialMomentCompletion(): Record<InterviewMomentIndex, boolean> {
  return { 1: false, 2: false, 3: false, 4: false };
}

function buildInterviewProgressSystemSuffix(opts: {
  momentsComplete: Record<InterviewMomentIndex, boolean>;
  currentMoment: InterviewMomentIndex;
  personalHandoffInjected: boolean;
}): string {
  const lines: string[] = [
    '',
    'PROGRESS LOCKS (internal metadata — obey strictly; never read aloud):',
    `Current interview moment index (1–4): ${opts.currentMoment}. 1–3 = scenarios A–C; 4 = personal (grudge + commitment threshold), then final closing only.`,
  ];
  if (opts.momentsComplete[1]) lines.push('Moment 1 COMPLETE — do not re-open Scenario A.');
  if (opts.momentsComplete[2]) lines.push('Moment 2 COMPLETE — do not re-open Scenario B.');
  if (opts.momentsComplete[3]) lines.push('Moment 3 COMPLETE — do not re-open Scenario C.');
  if (opts.personalHandoffInjected) {
    lines.push('The transition into the personal (grudge) question was already delivered. Never repeat that full handoff.');
  }
  if (opts.momentsComplete[4]) {
    lines.push(
      'Interview COMPLETE — deliver anchored closing + thanks + [INTERVIEW_COMPLETE] only; do not ask further questions.'
    );
  }
  return lines.join('\n');
}

/** Resume / recovery: infer flags from stored messages + scenarios completed. */
function syncInterviewMomentsFromTranscript(
  msgs: Array<{ role: string; content?: string }>,
  scenariosCompleted: number[]
): {
  momentsComplete: Record<InterviewMomentIndex, boolean>;
  currentMoment: InterviewMomentIndex;
  personalHandoffInjected: boolean;
} {
  if (
    msgs.some(
      (m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.includes('[INTERVIEW_COMPLETE]')
    )
  ) {
    return {
      momentsComplete: { 1: true, 2: true, 3: true, 4: true },
      currentMoment: 4,
      personalHandoffInjected: true,
    };
  }
  const momentsComplete = createInitialMomentCompletion();
  let personalHandoffInjected = false;
  for (const n of scenariosCompleted) {
    if (n === 1) momentsComplete[1] = true;
    if (n === 2) momentsComplete[2] = true;
    if (n === 3) momentsComplete[3] = true;
  }
  let currentMoment: InterviewMomentIndex = 1;
  if (momentsComplete[3]) currentMoment = 4;
  if (momentsComplete[2] && !momentsComplete[3]) currentMoment = 3;
  if (momentsComplete[1] && !momentsComplete[2]) currentMoment = 2;

  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== 'assistant' || !m.content) continue;
    const c = m.content.toLowerCase();
    if (
      (c.includes("we've covered those three") || c.includes('three situations')) &&
      c.includes('held a grudge')
    ) {
      personalHandoffInjected = true;
      momentsComplete[3] = true;
      currentMoment = 4;
      break;
    }
    if (c.includes('sophie and daniel') && c.includes('i need ten minutes')) {
      currentMoment = 3;
      break;
    }
    if (c.includes('sarah has been job hunting')) {
      currentMoment = 2;
      break;
    }
    if (c.includes('emma and ryan') || c.includes('ryan takes a call')) {
      currentMoment = 1;
      break;
    }
  }

  return { momentsComplete, currentMoment, personalHandoffInjected };
}

function messageLooksLikeScoreCard(msg: { role?: string; content?: string; isScoreCard?: boolean }): boolean {
  if (msg.isScoreCard) return true;
  const t = msg.content ?? '';
  return t.includes('── Scenario ') && /\d\/10/.test(t);
}

async function raceTranscribeWithTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`${label}_timeout`)), ms);
  });
  try {
    return await Promise.race([p, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type InterviewProgressRefs = {
  interviewMomentsCompleteRef: { current: Record<InterviewMomentIndex, boolean> };
  currentInterviewMomentRef: { current: InterviewMomentIndex };
  personalHandoffInjectedRef: { current: boolean };
};

/** Infer M3→M4 progression from assistant visible text (model outputs). */
function applyInterviewProgressFromAssistantText(rawDisplayText: string, refs: InterviewProgressRefs) {
  const dt = (rawDisplayText ?? '').toLowerCase();
  // Require the real grudge ask — do not use "more personal" alone: S2→S3 copy says "something more personal"
  // and would false-trigger M4 (breaks Scenario C repair → Daniel/Sophie threshold forcing).
  if (
    (dt.includes("we've covered those three") || dt.includes('three situations')) &&
    dt.includes('held a grudge')
  ) {
    refs.personalHandoffInjectedRef.current = true;
    refs.interviewMomentsCompleteRef.current[3] = true;
    refs.currentInterviewMomentRef.current = 4;
  }
}

/** Always use proxy when set — direct api.anthropic.com fails on native (CORS). */
function getPublicEnv(varName: string, extraKey?: string): string {
  const fromProcess =
    typeof process !== 'undefined' && process.env ? (process.env[varName] as string | undefined) : undefined;
  const expoConfigExtra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const legacyManifestExtra =
    (Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra;
  const manifest2Extra =
    (
      Constants as unknown as {
        manifest2?: { extra?: { expoClient?: { extra?: Record<string, unknown> } } };
      }
    ).manifest2?.extra?.expoClient?.extra;
  const easConfig = (Constants as unknown as { easConfig?: Record<string, unknown> }).easConfig;
  const key = extraKey ?? '';
  const fromConfig =
    (typeof key === 'string' && key ? (expoConfigExtra?.[key] as string | undefined) : undefined) ??
    (expoConfigExtra?.[varName] as string | undefined) ??
    (typeof key === 'string' && key ? (legacyManifestExtra?.[key] as string | undefined) : undefined) ??
    (legacyManifestExtra?.[varName] as string | undefined) ??
    (typeof key === 'string' && key ? (manifest2Extra?.[key] as string | undefined) : undefined) ??
    (manifest2Extra?.[varName] as string | undefined) ??
    (typeof key === 'string' && key ? (easConfig?.[key] as string | undefined) : undefined) ??
    (easConfig?.[varName] as string | undefined);
  return (fromProcess || fromConfig || '').trim();
}

function getResolvedSupabaseUrl(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_SUPABASE_URL', 'supabaseUrl');
  if (configured) return configured;
  const maybeSupabase = supabase as unknown as { supabaseUrl?: string; rest?: { url?: string } };
  if (typeof maybeSupabase.supabaseUrl === 'string' && maybeSupabase.supabaseUrl.trim()) {
    return maybeSupabase.supabaseUrl.trim();
  }
  const restUrl = maybeSupabase.rest?.url;
  if (typeof restUrl === 'string' && restUrl.trim()) {
    return restUrl.replace(/\/rest\/v1\/?$/, '').trim();
  }
  return '';
}

function getResolvedAnthropicProxyUrl(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_ANTHROPIC_PROXY_URL', 'anthropicProxyUrl');
  if (configured) return configured;
  const supabaseUrl = getResolvedSupabaseUrl().replace(/\/+$/, '');
  return supabaseUrl ? `${supabaseUrl}/functions/v1/anthropic-proxy` : '';
}

function getResolvedWhisperProxyUrl(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_OPENAI_WHISPER_PROXY_URL', 'openaiWhisperProxyUrl');
  if (configured) return configured;
  const supabaseUrl = getResolvedSupabaseUrl().replace(/\/+$/, '');
  return supabaseUrl ? `${supabaseUrl}/functions/v1/openai-whisper-proxy` : '';
}

function getResolvedSupabaseAnonKey(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'supabaseAnonKey');
  if (configured) return configured;
  const maybeSupabase = supabase as unknown as {
    supabaseKey?: string;
    rest?: { headers?: Record<string, string> };
  };
  const fromClientKey = typeof maybeSupabase.supabaseKey === 'string' ? maybeSupabase.supabaseKey.trim() : '';
  if (fromClientKey) return fromClientKey;
  const fromRestHeader =
    (maybeSupabase.rest?.headers?.apikey ?? maybeSupabase.rest?.headers?.Authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  return fromRestHeader;
}

function getAnthropicEndpoint(): string {
  const proxyUrl = getResolvedAnthropicProxyUrl();
  if (!proxyUrl && __DEV__) {
    console.warn('Anthropic proxy URL is not set; direct API may fail on native.');
  }
  return proxyUrl || 'https://api.anthropic.com/v1/messages';
}

/**
 * ALPHA_MODE: When true, shows full AI reasoning, analysis page, and retake option.
 * Set to false before production.
 *
 * Cleanup before production:
 * - Delete InterviewAnalysisScreen component (and file)
 * - Delete generateAIReasoning + alphaAssessmentUtils (and alpha feature imports)
 * - Remove ALPHA_MODE and all branches that use it (timing/probe refs, alpha save path)
 * - Remove user_analysis_* from queries if not keeping for research; route post-completion to under_review
 */
const ALPHA_MODE = true;

/**
 * Amoraea-voiced fallbacks when something goes wrong. Never expose technical language.
 * Used only for recording/transcription retry prompts — not for API errors.
 */
const AMORAEA_ERROR_MESSAGES = {
  waiting: [
    'Give me just a moment...',
    'One moment...',
    'Bear with me for a second...',
  ],
  conversationFailed: [
    "I need to pause there — something interrupted me. Could you say that again?",
    "I lost my thread for a moment. Can you repeat what you just said?",
    "Something pulled me away briefly. I'm back — what were you saying?",
  ],
  recordingOrTranscriptionRetry: [
    "I didn't quite catch that — could you say it again?",
    "Seems like an interruption happened. Would you mind repeating that?",
    "I missed that — can you say it once more?",
  ],
  recordingOrTranscriptionRetryNative: [
    "I didn't catch that — tap the mic and try again.",
    "Say that again when you're ready.",
    "I missed that — give it another go.",
  ],
  /** Mic/session start failures — do not reuse transcription "interruption" copy (confusing when TTS/mic overlap). */
  recordingMicOrSession: [
    "I'm having trouble starting the microphone — try tapping the mic once more.",
    'The mic did not start cleanly. Tap the mic again when you are ready.',
  ],
};

/** User-facing error messages shown in chat (no TTS). */
const CHAT_ERROR_MESSAGES = {
  retryExhausted: "I'm having trouble connecting right now. Try tapping the mic again in a moment.",
  badRequest: "Something went wrong with that request. Try again — if it keeps happening, restart the interview.",
  unauthorized: "There's an authentication issue. Try closing and reopening the app.",
  serverError: "Something went wrong on our end. Try again in a moment.",
  proxyError: "Having trouble reaching the server. Check your connection and try again.",
  unknown: "Something went wrong. Try again — if it keeps happening, restart the interview.",
};

function getErrorMessage(err: unknown, retriesExhausted = false): string {
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { status?: number; statusCode?: number })?.statusCode;
  // Only show retry-exhausted message when retries were actually exhausted (never for first 429)
  if (retriesExhausted) return CHAT_ERROR_MESSAGES.retryExhausted;
  if (status === 400) return CHAT_ERROR_MESSAGES.badRequest;
  if (status === 401) return CHAT_ERROR_MESSAGES.unauthorized;
  if (status === 403) return CHAT_ERROR_MESSAGES.unauthorized;
  if (status === 500) return CHAT_ERROR_MESSAGES.serverError;
  return CHAT_ERROR_MESSAGES.unknown;
}
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function assistantMessageForRecordingHardwareFailure(useWebCopy: boolean): string {
  const pool = useWebCopy
    ? AMORAEA_ERROR_MESSAGES.recordingMicOrSession
    : AMORAEA_ERROR_MESSAGES.recordingOrTranscriptionRetryNative;
  return randomFrom(pool);
}

/** Escalating copy for empty/bad transcription — avoids dozens of identical retry lines. */
function assistantMessageForRecordingOrTranscriptionFailure(streak: number, useWebCopy: boolean): string {
  const shortPool = useWebCopy
    ? AMORAEA_ERROR_MESSAGES.recordingOrTranscriptionRetry
    : AMORAEA_ERROR_MESSAGES.recordingOrTranscriptionRetryNative;
  if (streak >= 6) {
    return (
      "I'm still having trouble hearing you. You may want to try again in a quieter place with a more stable connection. " +
      'You can close the app and pick up later when you are ready.'
    );
  }
  if (streak === 3) {
    return (
      "It sounds like I might be having trouble hearing you clearly. Would you like to check your microphone, " +
      'or try moving somewhere quieter, then try again?'
    );
  }
  return randomFrom(shortPool);
}

/** Whisper upload filename must match actual container (Safari/desktop often records MP4, not WebM). */
function pickWhisperUploadFilename(blob: Blob): string {
  const t = (blob.type || '').toLowerCase();
  /** Use `.mp4` for `audio/mp4` — some stacks reject AAC-in-MP4 when mislabeled as `.m4a`. */
  if (t.includes('mp4') && !t.includes('m4a')) return 'recording.mp4';
  if (t.includes('m4a') || t.includes('mp4a') || t.includes('x-m4a')) return 'recording.m4a';
  if (t.includes('ogg')) return 'recording.ogg';
  if (t.includes('wav')) return 'recording.wav';
  if (t.includes('mpeg') || t.includes('mp3')) return 'recording.mp3';
  return 'recording.webm';
}

function whisperUploadFilePart(blob: Blob): Blob | File {
  const name = pickWhisperUploadFilename(blob);
  const mime = blob.type || 'application/octet-stream';
  if (typeof File !== 'undefined') {
    return new File([blob], name, { type: mime });
  }
  return blob;
}

/**
 * Only save to localStorage once the interview has meaningfully started.
 * Pre-interview messages (greeting, name, briefing) are not worth saving and cause resume loops if saved.
 */
function shouldSaveToStorage(
  messages: Array<{ role: string; content: string }> | undefined,
  scenariosCompleted: number[] | undefined,
  currentScenario: 1 | 2 | 3 | null | undefined
): boolean {
  // Allow save when at least one scenario is completed (covers recovery and post-completion pending save)
  if ((scenariosCompleted?.length ?? 0) > 0) return true;
  // Otherwise require interview proper: scenario started and at least 2 user responses
  if (!currentScenario || currentScenario < 1) return false;
  const userMessages = (messages ?? []).filter((m) => m.role === 'user');
  if (userMessages.length < 2) return false;
  return true;
}

/**
 * Resume should not trigger if the last saved AI message was only the greeting.
 */
function isGreetingOnly(savedMessages: Array<{ role: string; content?: string }> | undefined): boolean {
  if (!savedMessages || savedMessages.length === 0) return true;
  const aiMessages = savedMessages.filter((m) => m.role === 'assistant');
  if (aiMessages.length <= 1) return true;
  const lastAI = aiMessages[aiMessages.length - 1];
  const greetingPhrases = [
    'welcome to amoraea',
    'what can i call you',
    'what should i call you',
    'nice to meet you',
    'good to meet you',
  ];
  const content = (lastAI?.content ?? '').toLowerCase();
  return greetingPhrases.some((phrase) => content.includes(phrase));
}

/**
 * Save interview progress only when there is meaningful progress (avoids resume loop from pre-interview state).
 */
async function saveInterviewProgress(
  userId: string,
  state: Omit<StoredInterviewData, 'version' | 'userId' | 'lastSavedAt'>
): Promise<void> {
  if (
    !shouldSaveToStorage(state.messages, state.scenariosCompleted, state.currentScenario)
  ) {
    return;
  }
  await saveInterviewToStorage(userId, state);
}

type MessageWithScenario = { role: string; content: string; scenarioNumber?: number };

function getScenarioNumberForNewMessage(
  prevMessages: MessageWithScenario[],
  role: 'user' | 'assistant',
  newContent?: string
): number {
  const last = [...prevMessages].reverse().find((m) => m.role === 'user' || m.role === 'assistant');
  const lastNum = (last as MessageWithScenario | undefined)?.scenarioNumber;
  if (role === 'user') return lastNum ?? 1;
  if (!newContent) return lastNum ?? 1;
  const c = newContent.toLowerCase();
  if (/emma and ryan|ryan takes a call|first situation|here's the first|situation 1/.test(c)) return 1;
  if (/sarah has been job hunting|sarah.*james|on to the second|second situation|here's the next situation/.test(c)) return 2;
  if (/sophie and daniel|i need ten minutes|here's the third situation|third situation|last one.*situation three|situation three/.test(c)) return 3;
  return lastNum ?? 1;
}

/** Detect which scenario an AI response introduces from content (belt-and-suspenders for tagging). */
function detectScenarioFromResponse(responseText: string): 1 | 2 | 3 | null {
  if (!responseText?.trim()) return null;
  const c = responseText.toLowerCase();
  if (/emma and ryan|ryan takes a call|first situation|here's the first/.test(c)) return 1;
  if (/sarah has been job hunting|second situation|on to the second|here's the next situation/.test(c)) return 2;
  if (/sophie and daniel|daniel.*didn't know what to say|daniel.*didn't know how|here's the third situation|third situation|last one.*situation three|situation three/.test(c)) return 3;
  return null;
}

/** Infer message slice for a scenario when tags are wrong: find anchor message for this scenario, slice until next scenario anchor. */
function inferScenarioMessages(
  allMessages: { role: string; content: string }[],
  scenarioNum: 1 | 2 | 3
): { role: string; content: string }[] {
  const scenarioAnchors: Record<number, string[]> = {
    1: [
      'emma and ryan',
      'ryan takes a call',
      "here's the first",
      'first situation',
      "what can i call you",
      "i'm aira",
      "welcome to amoraea",
    ],
    2: ['sarah has been job hunting', 'on to the second', 'second situation', "here's the next situation"],
    3: ['sophie and daniel', 'i need ten minutes', "here's the third situation", 'third situation', 'last one', 'situation three'],
  };
  const anchors = scenarioAnchors[scenarioNum].map((a) => a.toLowerCase());
  const startIdx = allMessages.findIndex((m) => {
    if (m.role !== 'assistant') return false;
    const c = (m.content ?? '').toLowerCase();
    return anchors.some((anchor) => c.includes(anchor));
  });
  const effectiveStartIdx = scenarioNum === 1 && startIdx === -1 ? 0 : startIdx;
  if (effectiveStartIdx === -1) return [];
  const nextScenarioAnchors =
    scenarioNum < 3
      ? ([] as string[]).concat(
          ...Object.entries(scenarioAnchors)
            .filter(([k]) => Number(k) > scenarioNum)
            .map(([, v]) => v),
          'on to the second situation',
          'second situation',
          "here's the next situation",
          'last one',
          "here's the third situation",
          'third situation',
          'situation three',
          'situation two'
        )
      : ["we've covered those three", 'held a grudge', 'something a bit more personal'];
  const nextAnchorsLower = nextScenarioAnchors.map((a) => a.toLowerCase());
  const endIdx =
    nextAnchorsLower.length > 0
      ? allMessages.findIndex(
          (m, i) => i > effectiveStartIdx && m.role === 'assistant' && nextAnchorsLower.some((anchor) => (m.content ?? '').toLowerCase().includes(anchor))
        )
      : -1;
  return allMessages.slice(effectiveStartIdx, endIdx === -1 ? allMessages.length : endIdx);
}

/** Detect if assistant message is the closing question (so we set pending even when [CLOSING_QUESTION:N] is missing). */
function isClosingQuestion(text: string): boolean {
  if (!text?.trim()) return false;
  const t = text.toLowerCase();
  const patterns = [
    'is there anything about that situation',
    "anything you'd want me to know",
    "anything about that situation you'd want me to know",
    "anything you'd want to add before we move on",
    'anything else about that one before',
    'before we move on',
    'before we move forward',
    "anything you'd want me to understand",
    'anything else about that one you',
    'before we go to the next one',
  ];
  return patterns.some((p) => t.includes(p.toLowerCase()));
}

/** Removes control tokens from AI response before display or TTS. Use raw text for logic only. */
function stripControlTokens(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[INTERVIEW_COMPLETE\]/gi, '')
    .replace(/\[SCENARIO_COMPLETE:\d+\]/gi, '')
    .replace(/\[CLOSING_QUESTION:\d+\]/gi, '')
    .replace(/\[STAGE_[123]_COMPLETE\]/g, '')
    .replace(/\[PROBE_TRIGGERED\]/gi, '')
    .replace(/\[SKEPTICISM_CHECK\]/gi, '')
    .trim();
}

/** Multi-word / distinctive decline fragments — substring match is OK. Never use bare `"no"` here: `includes("no")` hits "not", "now", "know", etc. */
const DECLINE_PHRASE_SUBSTRINGS = [
  "i can't think of one",
  "i cant think of one",
  "i don't know",
  "i dont know",
  "nothing comes to mind",
  "not really",
  "nope",
  "can't think of anything",
  "don't have",
  "can't think",
  "no example",
];

function userTextLooksLikeDecline(lower: string): boolean {
  if (DECLINE_PHRASE_SUBSTRINGS.some((phrase) => lower.includes(phrase))) return true;
  /** Standalone "no" / "no thanks" — `\b` avoids false positives on "not", "now", "nothing", … */
  return /\bno\b/i.test(lower);
}

function isDecline(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return lower.length < 15 || userTextLooksLikeDecline(lower);
}

/** Moment 4 commitment follow-up must still fire on short analytical answers; only explicit pass phrases or empty utterances skip. */
function isExplicitPassForMoment4CommitmentFollowUp(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.length < 2) return true;
  return userTextLooksLikeDecline(lower);
}

function isAppreciationPromptText(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('think of a time you really celebrated someone') || (t.includes('really celebrated') && t.includes('your life'));
}

/** Start index of the scripted appreciation prompt body (for bridge detection / stripping). */
function appreciationPromptBodyStartIndex(text: string): number {
  const lower = text.toLowerCase();
  const primary = lower.indexOf('think of a time you really celebrated someone');
  if (primary >= 0) return primary;
  const rel = lower.indexOf('really celebrated');
  if (rel >= 0 && lower.includes('your life')) return rel;
  return -1;
}

/** Remove recurring meta tails ("different side of you…", "I want to ask about…") while keeping a good threshold echo. */
function stripTrailingMoment5ProceduralBridgeClauses(head: string): string {
  let h = head.trimEnd();
  const tailPatterns: RegExp[] = [
    /\s*[—–-]\s*and\s+something a little different on a warmer note\.?\s*$/i,
    /\s*[—–-]\s*something a little different on a warmer note\.?\s*$/i,
    /\s*,\s*and\s+something a little different on a warmer note\.?\s*$/i,
    /\s+something a little different on a warmer note\.?\s*$/i,
    /\s*[—–-]\s*i want to ask about a different side of you with people you care about\.?\s*$/i,
    /\s*[—–-]\s*i'?d like to ask about a different side of you[^.?!]*[.?!]?\s*$/i,
    /\s*i want to ask about a different side of you[^.?!]*[.?!]?\s*$/i,
    /\s*i want to ask about how you show up for someone you care about[^.?!]*[.?!]?\s*$/i,
    /\s*let me take this in a slightly different direction[^.?!]*[.?!]?\s*$/i,
    /\s*i'?d like to shift to something a bit warmer[^.?!]*[.?!]?\s*$/i,
  ];
  let prev = '';
  while (prev !== h) {
    prev = h;
    for (const re of tailPatterns) {
      h = h.replace(re, '').trimEnd();
    }
  }
  return h.replace(/\s[—–-]\s*$/u, '').trim();
}

/** When the model uses a banned procedural bridge, drop it so we can prepend a natural default. */
function stripProceduralMoment5BridgeFromAppreciationTurn(text: string): string {
  if (!isAppreciationPromptText(text)) return text;
  const idx = appreciationPromptBodyStartIndex(text);
  if (idx <= 0) return text;
  let head = text.slice(0, idx).trim();
  head = stripTrailingMoment5ProceduralBridgeClauses(head);
  const tail = text.slice(idx).trimStart();
  let merged = head ? `${head}\n\n${tail}` : tail;
  if (!isAppreciationPromptText(merged)) merged = tail;

  const idx2 = appreciationPromptBodyStartIndex(merged);
  if (idx2 <= 0) return merged;
  const head2 = merged.slice(0, idx2).trim();
  const headLower = head2.toLowerCase();
  const seemsProcedural =
    /there'?s one more i(?:'?d| would) like to ask/.test(headLower) ||
    /\bwe only have one more\b/.test(headLower) ||
    /^\s*last one\b/.test(headLower) ||
    (head2.length < 140 && /\bstill personal\b/.test(headLower) && /\b(one more|last)\b/.test(headLower)) ||
    (head2.length < 220 &&
      /\bi want to ask about\b/.test(headLower) &&
      /\b(different side|another question|one more)\b/.test(headLower)) ||
    /\bdifferent side of you with people you care about\b/.test(headLower);
  if (!seemsProcedural) return merged;
  return merged.slice(idx2).trimStart();
}

function looksLikeMoment5Probe(text: string): boolean {
  const t = text.toLowerCase().trim();
  return (
    t.includes('particular moment that comes to mind') ||
    t.includes('what made you decide on that specifically') ||
    (/\bwhat made you decide to\b/.test(t) && t.endsWith('?')) ||
    t.includes('what do you remember about how they responded')
  );
}

function looksLikeMoment4ThresholdQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('"At what point do you decide when a relationship is something to work through versus something you need to walk away from?"') ||
    (t.includes('work through') && t.includes('walk away') && t.includes('point'))
  );
}

function hasCommitmentThresholdSignal(text: string): boolean {
  const t = text.toLowerCase();
  const hasIrrecoverableCriteria =
    /\b(irrecover|unworkable|incompatib|deal[- ]?breaker|not working|can't work|cannot work|too far gone|no longer safe)\b/.test(t);
  const hasLeaveDecisionProcess =
    /\b(at what point|point i would leave|point i'd leave|when i would leave|when i'd leave|before leaving|before i leave|after trying|after we try|after repeated|repeated pattern|if it keeps happening)\b/.test(t);
  const hasBoundaryAndOutcome =
    /\b(boundar(?:y|ies).*(leave|end|walk away)|walk away|leave|end it|end the relationship|call it)\b/.test(t);
  const repairOnlyLanguage =
    /\b(communicat(e|ion) better|set boundaries|check in|come back and talk|listen better|both need to change|shared system|repair)\b/.test(t);
  return (hasIrrecoverableCriteria || hasLeaveDecisionProcess || hasBoundaryAndOutcome) && !(repairOnlyLanguage && !hasIrrecoverableCriteria && !hasLeaveDecisionProcess);
}

function looksLikeScenarioCThresholdQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("at what point would you say daniel or sophie should decide this relationship isn't working") ||
    (t.includes('daniel') &&
      t.includes('sophie') &&
      t.includes("isn't working") &&
      /\b(at what point|what point)\b/.test(t))
  );
}

function looksLikeScenarioAContemptProbeQuestion(text: string): boolean {
  const t = text.toLowerCase().replace(/\u2019/g, "'");
  const mentionsEmmaLine = t.includes("you've made that very clear");
  /** Canonical framework copy (interviewerFrameworkPrompt): "What about when Emma says … what do you make of that?" */
  const canonicalFrameworkProbe =
    mentionsEmmaLine &&
    /what about when emma says/.test(t) &&
    /\bwhat do you make of (that|it)\b/.test(t);
  /** Legacy client inject when forcing the probe */
  const alternateInjectProbe =
    mentionsEmmaLine && t.includes("what do you make of emma's statement");
  return canonicalFrameworkProbe || alternateInjectProbe;
}

function looksLikeScenarioARepairQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('how would you repair this relationship if you were ryan') ||
    (t.includes('if you were ryan') && t.includes('repair this relationship'))
  );
}

function stripScenarioARepairQuestion(text: string): string {
  const cleaned = text
    .replace(/(?:^|\n)\s*How would you repair this relationship if you were Ryan\?\s*/gi, '\n')
    .replace(/(?:^|\n)\s*If you were Ryan[^?.!]*repair[^?.!]*[?.!]\s*/gi, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned;
}

function looksLikeScenarioBFullAppreciationProbeQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes("what do you think james could've done differently so sarah feels better");
}

/** Scenario B Q2 — what James could have done before the rupture (not repair-as-James). */
function looksLikeScenarioBJamesDifferentlyQuestion(text: string): boolean {
  const t = text.toLowerCase();
  if (looksLikeScenarioBFullAppreciationProbeQuestion(text)) return true;
  const jamesCtx = /\bjames\b/.test(t);
  const differently =
    /\b(could'?ve done differently|could have done differently|done differently|anything james could|what james could)\b/.test(
      t
    );
  const beforeFight =
    jamesCtx &&
    /\b(before (the )?(fight|blow|blow-?up)|might have helped|so sarah feels|feel appreciated|helped sarah)\b/.test(t);
  const leanJamesProbe =
    /\bis there anything james could have done\b/.test(t) && /\bhelp(ed)?\b/.test(t);
  return (jamesCtx && differently) || beforeFight || leanJamesProbe;
}

/** Scenario B Q3 — repair in James's shoes. */
function looksLikeScenarioBRepairAsJamesQuestion(text: string): boolean {
  const t = text.toLowerCase();
  const asJames =
    /\bif you were james\b/.test(t) &&
    /\b(repair|fix|make it right|apologize|patch things|make up|mend|handle|approach|smooth|sort (this|it) out|navigate|move forward)\b/.test(
      t
    );
  const howRepairJames =
    /\bhow would you\b/.test(t) &&
    /\bjames\b/.test(t) &&
    /\b(repair|fix|handle|approach|make things right|make it right)\b/.test(t);
  const compact =
    t.length < 200 &&
    /\bjames\b/.test(t) &&
    /\b(you were|as james|if you were)\b/.test(t) &&
    /\b(repair|fix|handle|approach)\b/.test(t);
  return asJames || howRepairJames || compact;
}

/** Model jumped to Scenario C (or completion) without asking what James could have done differently first. */
function looksLikeAssistantSkipsScenarioBJamesIntermediateQuestion(text: string): boolean {
  if (looksLikeScenarioBJamesDifferentlyQuestion(text)) return false;
  const t = text.toLowerCase();
  if (/\[scenario_complete:2\]/i.test(text)) return true;
  return (
    t.includes('sophie and daniel') ||
    ((t.includes("i didn't know what to say") || t.includes("i didn't know how")) && t.includes('sophie')) ||
    (t.includes('third situation') && t.includes('sophie')) ||
    (t.includes("here's the third situation") && t.includes('personal'))
  );
}

function extractScenario3UserCorpus(msgs: MessageWithScenario[]): string {
  return msgs
    .filter((m) => m.role === 'user' && m.scenarioNumber === 3)
    .map((m) => (m.content ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

function stripScenarioBRepairAsJamesQuestion(text: string): string {
  return text
    .replace(/(?:^|\n)\s*If you were James,?\s+how would you repair\??\s*/gi, '\n')
    .replace(
      /(?:^|\n)\s*How would you repair[^?.!\n]*if you were James[^?.!\n]*[?.!]?\s*/gi,
      '\n'
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Exact lead when Q3 (repair-as-James) is skipped because Q2 already contained repair signal (client + framework). */
const SCENARIO_B_REPAIR_ALREADY_COVERED_SKIP_LEAD =
  "Got it — you've already covered how you'd approach that.";

/**
 * Last user turn in `messages` with the assistant message they were answering (may not be the final message if callers pass a prefix).
 */
function findLastUserWithPriorAssistantContent(messages: MessageWithScenario[]): {
  lastUserContent: string | null;
  priorAssistantContent: string | null;
} {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'user') continue;
    const lastUserContent = (messages[i].content ?? '').trim();
    let priorAssistantContent: string | null = null;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (messages[j].role === 'assistant') {
        priorAssistantContent = messages[j].content ?? '';
        break;
      }
    }
    return { lastUserContent, priorAssistantContent };
  }
  return { lastUserContent: null, priorAssistantContent: null };
}

/**
 * True when the user's answer to Scenario B Q2 (James differently) or the optional full appreciation probe
 * already contains repair-oriented content, so Q3 (repair-as-James) should not fire (Scenario B only).
 */
function scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(answer: string): boolean {
  const t = normalizeApostrophesForPromptMatch(answer).toLowerCase().trim();
  if (!t) return false;

  const firstPersonJamesRepair =
    /\bif i were james\b/i.test(t) ||
    /\b(as james|being james)\b/i.test(t) ||
    (/\b(i'?d|i would|i will)\b/i.test(t) && /\b(james|sarah|her)\b/i.test(t));

  const jamesShouldSay =
    /\b(he|james)\s+(could|should)\s+have\s+(said|told|asked|checked)\b/i.test(t) ||
    /\bhe could have said\b/i.test(t) ||
    /\bhe should have told her\b/i.test(t);

  const addressesSarahEmotion =
    /\b(james|he)\b[\s\S]{0,220}\b(sarah|her)\b[\s\S]{0,220}\b(feel|feelings|felt|upset|cry|cried|tears|hurt|sad|scared|anxious|alone|heard|seen|validated|comfort|reassure|support|listen|listening|apolog|sorry|hug|hold|empath|compassion)\b/i.test(
      t
    ) ||
    /\b(sarah|her)\b[\s\S]{0,220}\b(feel|feelings|felt|upset|cry|cried|tears|hurt)\b[\s\S]{0,220}\b(james|he)\b[\s\S]{0,220}\b(could|should|would|needed to|need to)\b/i.test(
      t
    );

  const careValidation =
    /\b(acknowledge|validation|validate|validated|reassure|reassured|check in|heard her|see her side|comfort her|support her emotionally|tell her (he|that) cares|make her feel (seen|heard|loved))\b/i.test(
      t
    );

  const behavioralNotLogisticsOnly =
    /\b(james|he)\b/i.test(t) &&
    /\b(sarah|her)\b/i.test(t) &&
    /\b(listen|heard|comfort|validate|apolog|sorry|emotion|feel|feelings|tears|upset|there for|sit with|hold her|hug)\b/i.test(
      t
    ) &&
    !(
      /\b(salary|start date|commute|offer letter|logistics)\b/i.test(t) &&
      !/\b(feel|emotion|cry|tears|hurt|sorry|listen|comfort|validate)\b/i.test(t)
    );

  return (
    firstPersonJamesRepair ||
    jamesShouldSay ||
    addressesSarahEmotion ||
    careValidation ||
    behavioralNotLogisticsOnly
  );
}

function shouldReplaceScenarioBRepairWithSkipAndScenario3Transition(
  messages: MessageWithScenario[],
  strippedAssistantDraft: string,
  interviewMoment: number
): boolean {
  if (interviewMoment !== 2) return false;
  if (!strippedAssistantDraft.trim()) return false;
  if (!looksLikeScenarioBRepairAsJamesQuestion(strippedAssistantDraft)) return false;

  const { lastUserContent, priorAssistantContent } = findLastUserWithPriorAssistantContent(messages);
  if (!lastUserContent || !priorAssistantContent) return false;

  const prior = priorAssistantContent;
  const priorIsJamesDiffOrAppreciation =
    (looksLikeScenarioBJamesDifferentlyQuestion(prior) || looksLikeScenarioBFullAppreciationProbeQuestion(prior)) &&
    !looksLikeScenarioBRepairAsJamesQuestion(prior);

  if (!priorIsJamesDiffOrAppreciation) return false;
  return scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(lastUserContent);
}

/** Model/TTS often emit U+2019 (') instead of ASCII ' in What's, could've, etc. */
function normalizeApostrophesForPromptMatch(text: string): string {
  return text.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
}

function isScenarioAQ1Prompt(text: string): boolean {
  const t = normalizeApostrophesForPromptMatch(text).toLowerCase();
  return t.includes("what's going on between these two");
}

function isScenarioBQ1Prompt(text: string): boolean {
  const t = normalizeApostrophesForPromptMatch(text).toLowerCase();
  return t.includes('what do you think is going on here');
}

/** Scenario C Q2 (repair) — delegates to shared matcher so paraphrases still gate threshold forcing. */
function isScenarioCQ2Prompt(text: string): boolean {
  return isScenarioCRepairAssistantPrompt(text);
}

function userSidesEntirelyWithJames(text: string): boolean {
  const t = text.toLowerCase();
  const blamesSarah = /\b(sarah (is|was) (too|overly)? ?(sensitive|dramatic|overreacting)|sarah should( have)? just|sarah is the problem)\b/.test(t);
  const jamesOnlyRight = /\b(james (did nothing wrong|was right|handled it fine)|nothing james could do|james was fine)\b/.test(t);
  return blamesSarah || jamesOnlyRight;
}

/** Max chars to keep as M4→M5 pivot before the scripted appreciation body (1–2 sentence boundary reflection + transition). */
const MOMENT5_ALLOWED_BRIDGE_MAX_CHARS = 420;

/** True when the appreciation scripted body begins the assistant text (no leading bridge yet). */
function appreciationBodyStartsAssistantTurn(text: string): boolean {
  return isAppreciationPromptText(text) && appreciationPromptBodyStartIndex(text) === 0;
}

/** Drop mirror or overlong lead-ins; keep one short approved-style bridge before the appreciation ask. */
function stripReflectiveLeadBeforeMoment5AppreciationPrompt(text: string): string {
  if (!isAppreciationPromptText(text)) return text;
  const idx = appreciationPromptBodyStartIndex(text);
  if (idx <= 0) return text;
  const head = text.slice(0, idx).trim();
  const tail = text.slice(idx).trimStart();
  if (!head) return tail;
  if (head.length > MOMENT5_ALLOWED_BRIDGE_MAX_CHARS) return tail;
  const headLower = head.toLowerCase();
  const mirrorOrProcessBanned =
    /\bi hear you\b/.test(headLower) ||
    /\bholding two things\b/.test(headLower) ||
    /\bhelp me (see|understand|square)\b/.test(headLower) ||
    /\bwhat stays with me\b/.test(headLower) ||
    /\btaking that in\b/.test(headLower) ||
    /\bon a lighter note\b/.test(headLower);
  if (mirrorOrProcessBanned) return tail;
  return `${head}\n\n${tail}`;
}

/** One short acknowledgment when user adds something after "yes" to closing question. Never a question or evaluative. */
function generateBriefAck(_userText: string): string {
  const acks = ['Got that.', 'Noted.', "That's useful context.", "Appreciate you adding that."];
  return acks[Math.floor(Math.random() * acks.length)];
}

/** Build prompt for Claude to generate one closing line based on transcript (user turns only). */
function buildClosingLinePrompt(messages: { role: string; content: string }[]): string {
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
  return `Based on this interview transcript (user turns below are from THIS session only), write ONE OR TWO short sentences for the interviewer to deliver before the scripted thanks (see below). It should:
- **Anchor on something specific they actually said** in this session — e.g. Moment 4 (grudge / walk-away), or one concrete scenario read (Emma/Ryan contempt, Sarah/James appreciation miss, Sophie/Daniel leaving). Name the beat in plain language so it feels remembered, not like a form letter.
- You may pair that anchor with brief **task** acknowledgement (good work / thanks for sticking with this / appreciation for their time). The anchor must be **substantive** — a generic sign-off alone is not acceptable.
- Stay accurate: only people, events, and lines that appear in the user turns below. Do not invent biographical detail.
- Do not use evaluative performance language about the user as a whole (no "direct and thoughtful throughout," "really grounded," "very clear," grades, or how well they "handled" the interview).
- Do not invent through-lines they did not offer.
- Stay warm without diagnosing personal limitations or unresolved failures.
- NOT be a question; at most 2 sentences before the thanks line.
- NOT start with "Thank you" (thanks come after your line(s), in the same assistant message as instructed elsewhere)
- NOT start with "Sure" or "Okay" or "Absolutely" or "That makes sense" or "That checks out" or "That lands"
- NOT mention the word "journey" or "foundation"

Banned closing phrases:
"You worked through all five clearly"
"You have a strong foundation"
"Thank you for being so open"
"You did a great job"
"pursue-withdraw cycle"
"emotional witness"
"attunement"
"mentalizing"
"repair cycle"
"flooding"
"dysregulation"
"reflective functioning"
"going through the motions" (reads as hollow/cynical — never use when reflecting appreciation or genuine effort; it contradicts "made it happen" / concrete care)

Interview transcript (user turns only):
${userMessages}

Write only the closing line(s) before thanks (no "Thank you" in your output). No preamble.`;
}

const CLOSING_LINE_INSTRUCTIONS = `
CLOSING — ONE MESSAGE, ANCHORED (THIS TRANSCRIPT ONLY):

After Moment 4, the closing is often the **only** place that shows you were listening — it must **reference something specific** from this user's turns: their grudge/threshold story, or a concrete scenario stance (e.g. how they read Emma and Ryan, Sarah and James, or Sophie and Daniel). **Generic sign-offs alone are not acceptable** (e.g. only "thanks for your time" / "direct and thoughtful throughout" with no callback).

Structure (flexible): optional brief task acknowledgement (good work / thanks for sticking with this) **plus** one concrete remembered detail — or weave both into one or two tight sentences. Then "Thank you for being so open with me." (or close variant) and [INTERVIEW_COMPLETE].

The anchor should be **plain-language and accurate** — a short paraphrase of what they said, not a clinical label. You may name first names that appear in **their** answers (e.g. brother, Emma) when those appear in user turns.

**Banned:** hollow trait praise ("direct and thoughtful throughout," "really self-aware," "very clear" as filler), invented biographical content, clinical/theoretical labels ("attunement," "mentalizing," "repair cycle," "flooding," "dysregulation," "reflective functioning," "pursue-withdraw cycle").

SOURCE BOUNDARY: Only content supported by this transcript. No borrowing from other sessions.

BANNED PHRASES — never use these:
- "You've worked through all three of those clearly" / "You worked through all three clearly"
- "You caught the key patterns" / "key patterns in each situation"
- "Thank you for being so open with me" as the **entire** closing (thanks must follow a specific or task+specific beat)
- Any variation of "clearly" used as filler praise
- "A lot of self-awareness"
- "You handled that well"
- "Going through the motions" — never in closings
- Templated closings that stitch unrelated beats the user did not link

Do NOT reframe low-scoring signals as strengths. If signals were broadly low, stay brief, kind, and still **anchor on one true detail** they did share.

EXAMPLES (illustrative only — do not copy verbatim):

Good: "Good work getting through all of this — what you said about pulling off that surprise for your brother really stuck with me." Good: "Thanks for sticking with it; naming Emma's line as contempt while still seeing a path for Ryan is specific in a way most people gloss over."

Bad: "I appreciate you walking through all of this — you've been direct and thoughtful throughout." (generic / trait-only, no concrete anchor)
`;

const PERSONAL_CLOSING_INSTRUCTION = `
CLOSING: The user shared personal experiences in moment four. **One** assistant message only: include **at least one concrete anchor** from their personal turns (grudge/threshold) or a specific scenario read they gave so the closing feels remembered — not a form letter. You may add brief task acknowledgement (good work / thanks for sticking with this). **No** generic trait-only praise ("direct and thoughtful throughout," "very clear," "self-aware"). Do not start with "Sure," "Okay," "Absolutely," "That makes sense," "That checks out," or "That lands." Do not reframe low-scoring signals as positives. No clinical/theoretical labels. Then "Thank you for being so open with me" or similar. Then output [INTERVIEW_COMPLETE].`;

const SCENARIO_ONLY_CLOSING_INSTRUCTION = `
CLOSING: The user gave limited personal detail. **One** assistant message only: still **anchor on something specific** they said in the scenarios (a named character, a line they quoted, or how they framed the conflict) plus optional brief task acknowledgement. **No** generic-only sign-off. Do not start with "Sure," "Okay," "Absolutely," "That makes sense," "That checks out," or "That lands." No hollow trait evaluation. No biographical content that does not appear in this transcript. Then "Thank you for being so open with me" or similar. Then output [INTERVIEW_COMPLETE].`;

/** Remove model mirror recap ("That X sounds like…") before the scripted thanks line. */
function stripLeadingMirrorRecapBeforeThanks(text: string): string {
  const thankRe = /\bThank you for being so open\b/i;
  const idx = text.search(thankRe);
  if (idx <= 0) return text;
  const before = text.slice(0, idx).trim();
  if (/^that\s/i.test(before) && /\bsounds like\b/i.test(before)) {
    return text.slice(idx).trimStart();
  }
  return text;
}

function sanitizeClosingLanguage(text: string): string {
  if (!text) return text;
  let out = text
    .replace(/^\s*Sure[.,]?\s+/i, '')
    .replace(/^\s*Okay[.,]?\s+/i, '')
    .replace(/^\s*Absolutely[.,]?\s+/i, '')
    .replace(/^\s*That makes sense[.,]?\s+/i, '')
    .replace(/^\s*That checks out[.,]?\s+/i, '')
    .replace(/^\s*That lands[.,]?\s+/i, '')
    .replace(/\brather\s+than\s+just\s+saying\b/gi, '')
    .replace(/\brather\s+than\s+just\b/gi, '')
    .replace(/\byou(?:'ve| have)\s+stayed grounded throughout this whole conversation[.,]?/gi, '')
    .replace(/\byou stayed grounded throughout this whole conversation[.,]?/gi, '')
    // Model glitch: "...made it happen going through the motions" (two incompatible phrases stitched).
    .replace(/\b(made|make)\s+it\s+happen\s+going through the motions\b/gi, '$1 it happen')
    .replace(/\b(made|make)\s+it\s+happen\s*,\s*going through the motions\b/gi, '$1 it happen')
    .replace(/\s+going through the motions(?=\s*[.…]?\s*Thank\b)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  out = stripLeadingMirrorRecapBeforeThanks(out);
  return out;
}

/**
 * Scenario A repair prompt often leads with "That makes (a lot of) sense" before the scripted Ryan question.
 * {@link stripFlatReflectionAcknowledgmentOpeners} would otherwise strip "That makes sense." via the comma rule
 * because "What if…" looks like a new clause — keep the full lead-in for TTS/display.
 */
function isPreservedAckBeforeScenarioARepairLead(text: string): boolean {
  const t = text.trim();
  if (!/^that makes (?:a lot of )?sense\b/i.test(t)) return false;
  const rest = t.replace(/^that makes (?:a lot of )?sense\s*[.,;—–-]?\s*/i, '').trim();
  return (
    /^what if you were ryan\b/i.test(rest) ||
    /^how would you repair this relationship if you were ryan\b/i.test(rest) ||
    (/^if you were ryan\b/i.test(rest) && /\brepair\b/i.test(rest))
  );
}

/**
 * Scenario B James-differently Q2: prompt requires a short ack ("Got it.") before the question; stripper would
 * otherwise remove "Sure." / "Absolutely." via {@link stripFlatReflectionAcknowledgmentOpeners} reComma.
 */
function isPreservedAckBeforeScenarioBJamesQ2(text: string): boolean {
  const t = text.trim();
  const afterAck = t.replace(/^(got it|okay|fair|thanks|sure|absolutely)\s*[.,;—–-]?\s*/i, '').trim();
  if (afterAck === t) return false;
  const low = afterAck.toLowerCase();
  return (
    /\bjames\b/.test(low) &&
    /\b(done differently|could'?ve done differently|could have done differently|might have helped|feel appreciated)\b/.test(
      low
    )
  );
}

/**
 * Hard blocklist: empty acknowledgments before the real reflection (applied on every assistant line before TTS/display).
 * Does not remove phrases that are integrated into one idea (e.g. "That makes sense that you'd feel…").
 */
function stripFlatReflectionAcknowledgmentOpeners(text: string): string {
  const original = text.trim();
  if (!original) return original;
  if (isPreservedAckBeforeScenarioARepairLead(original)) return original;
  if (isPreservedAckBeforeScenarioBJamesQ2(original)) return original;
  const MIN_REMAINDER = 14;
  const orderedPhrases = [
    'That makes sense',
    'That checks out',
    'That lands',
    'Absolutely',
    'Sure',
  ];
  let t = original;
  let guard = 0;
  let changed = true;
  while (changed && guard++ < 4) {
    changed = false;
    for (const phrase of orderedPhrases) {
      const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reComma = new RegExp(`^${esc}\\s*[,;.]\\s+`, 'i');
      const reDash = new RegExp(`^${esc}\\s*[—–]\\s*`, 'i');
      const reSpaceClause = new RegExp(
        `^${esc}\\s+(?=[IY]|I'm\\b|I've\\b|You're\\b|That\\s|What\\s|So\\s|It\\s|This\\s|The\\s|When\\s|If\\s|Here\\b|There\\b|For\\s|From\\s)`,
        'i'
      );
      for (const re of [reComma, reDash, reSpaceClause]) {
        const next = t.replace(re, '').trim();
        if (next !== t && next.length >= MIN_REMAINDER) {
          t = next;
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return t || original;
}

/** Removes recurring hollow acknowledgment tails/leads from the first paragraph (pre-TTS). Does not touch later paragraphs (e.g. final thanks). */
function stripGenericReflectionFillersFirstParagraph(text: string): string {
  if (!text?.trim()) return text;
  /** Scripted M4 commitment follow-up — framework requires verbatim "Thanks for sharing that." before the question. */
  if (looksLikeMoment4ThresholdQuestion(text)) return text;
  const parts = text.split(/\n\n/);
  const first = parts[0] ?? '';
  let t = first;

  const stripTrailingClause = () => {
    const tailPatterns: RegExp[] = [
      /\s*[,—–-]\s*I appreciate you laying it out\.?/gi,
      /\s*[,—–-]\s*I appreciate you sharing(?: that)?\.?/gi,
      /\s*[,—–-]\s*thank you for sharing(?: that)?\.?/gi,
      /\s*[,—–-]\s*thanks for sharing\.?/gi,
      /\s*[,—–-]\s*that'?s really helpful\.?/gi,
      /\s*[,—–-]\s*that'?s helpful\.?/gi,
      /\s*[,—–-]\s*glad you shared\.?/gi,
      /\s*[,—–-]\s*good of you to (?:open up|share)\.?/gi,
      /\s*[,—–-]\s*thanks for walking me through that\.?/gi,
    ];
    for (const re of tailPatterns) {
      t = t.replace(re, '').trim();
    }
  };

  const stripLeadingFiller = () => {
    const leadPatterns = [
      /^thank you for sharing(?: that)?[.,]?\s+/i,
      /^thanks for sharing[.,]?\s+/i,
      /^that'?s really helpful[.,]?\s+/i,
      /^that'?s helpful[.,]?\s+/i,
      /^I appreciate you laying it out[.,]?\s+/i,
      /^I appreciate you sharing(?: that)?[.,]?\s+/i,
      /^glad you shared[.,]?\s+/i,
    ];
    for (const re of leadPatterns) {
      const next = t.replace(re, '').trim();
      if (next !== t) t = next;
    }
  };

  for (let i = 0; i < 3; i++) {
    const before = t;
    stripTrailingClause();
    stripLeadingFiller();
    if (t === before) break;
  }

  t = t.replace(/\s+,/g, ',').replace(/^\s*[.,—–-]+\s*/g, '').replace(/[,—–-]\s*$/g, '').trim();
  t = repairBrokenMoment5BridgeGrammar(t);
  if (!t) return text;

  parts[0] = t;
  return parts.join('\n\n');
}

/** Model sometimes emits "— something a lighter note" instead of "On a lighter note" before personal prompts (legacy / tolerant stripping). */
function repairBrokenMoment5BridgeGrammar(text: string): string {
  if (!text?.trim()) return text;
  return text
    .replace(/\b[—–-]\s*something\s+a\s+lighter\s+note\b/gi, '— On a lighter note')
    .replace(/\bsomething\s+a\s+lighter\s+note\b/gi, 'On a lighter note')
    .replace(/\b(and\s+)?something\s+a\s+little\s+different\s+on\s+a\s+warmer\s+note\.?\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+[.,]\s*$/g, '.')
    .trim();
}

/** Prompt 1: strip system-state / hollow interviewer lines the model may still emit. */
function stripHollowSystemInterviewerPhrases(text: string): string {
  if (!text?.trim()) return text;
  const parts = text.split(/\n\n/);
  let first = parts[0] ?? '';
  const patterns: RegExp[] = [
    /\bI'?m\s+tracking\s+you\.?/gi,
    /^\s*I'?m\s+with\s+you\s+on\s+[^.!?\n—]{1,120}\s+and\s+[^.!?\n—]{1,120}\s*/i,
    /\bgot\s+it\s*[.,—–-]\s*continuing\.?(?=\s|$|\n)/gi,
    /\b(okay|alright|yeah|right|mm)\s*[—–-]\s*continuing\.?(?=\s|$|\n)/gi,
    /\s*[,—–-]\s*continuing\.(?=\s|$|\n)/gi,
  ];
  for (const re of patterns) {
    first = first.replace(re, ' ').trim();
  }
  first = first.replace(/\s{2,}/g, ' ').replace(/^[.,—–-]+\s*/g, '').trim();
  if (!first) return text;
  parts[0] = first;
  return parts.join('\n\n');
}

/** Normalize curly apostrophes so handoff regexes match model output (`Here\u2019s` vs `Here's`). */
function normalizeTypographicApostrophesForMatch(s: string): string {
  return s.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
}

/**
 * Model sometimes stacks warm opener + mandatory template: "That's a real read — I hear you: …" (reads redundant).
 */
function collapseStackedEmpathyIHearYouInFirstParagraph(text: string): string {
  if (!text?.trim()) return text;
  const parts = text.split('\n\n');
  const fixLine = (line: string): string =>
    line
      .replace(/^(that's a real read)\s*[—–-]\s*i hear you\s*:\s*/i, '$1 — ')
      .replace(/^(i see what you mean)\s*[—–-]\s*i hear you\s*:\s*/i, '$1 — ')
      .replace(/^(yeah, i can see that)\s*[—–-]\s*i hear you\s*:\s*/i, '$1 — ')
      .replace(
        /^(good|got it|great|nice|makes sense)\s*[—–-]\s*(yeah, i can see that)\s*[—–-]\s*i hear you\s*:\s*/i,
        '$1 — I hear you: '
      )
      .trim();
  parts[0] = fixLine(parts[0] ?? '');
  return parts.join('\n\n');
}

const MANDATORY_VALIDATION_LEADS = ['Good', 'Got it', 'Great', 'Nice', 'Makes sense'] as const;

function chooseMandatoryValidationLead(recentAssistant: MessageWithScenario[]): string {
  const used = new Set<string>();
  for (const m of recentAssistant.slice(-4)) {
    const c = typeof m.content === 'string' ? m.content.trim() : '';
    for (const l of MANDATORY_VALIDATION_LEADS) {
      const esc = l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`^${esc}\\b`, 'i').test(c)) used.add(l);
    }
  }
  const pool = MANDATORY_VALIDATION_LEADS.filter((l) => !used.has(l));
  const pick = pool.length ? pool : [...MANDATORY_VALIDATION_LEADS];
  return pick[Math.floor(Math.random() * pick.length)]!;
}

function wrapMandatoryAckBodyWithValidationLead(body: string, recentAssistant: MessageWithScenario[]): string {
  const v = chooseMandatoryValidationLead(recentAssistant);
  return `${v} — ${body.trim()}`.trim();
}

/**
 * Strip model output that pastes the user's words verbatim (leading quotes) or opens with "Noted".
 * Verbatim user paste + truncation was coming from buildMandatoryAckPrefix (removed); this catches model-only echoes.
 */
function stripForbiddenReflectionLead(text: string): string {
  if (!text?.trim()) return text;
  const paras = text.split(/\n\n/);
  let first = paras[0].trim();

  const stripNotedLead = (s: string) =>
    s
      .replace(/^noted[.,]?\s*[—–-]\s*/i, '')
      .replace(/^noted[.,]?\s+/i, '')
      .trim();

  first = stripNotedLead(first);
  let guard = 0;
  while (guard++ < 8 && first.length > 0) {
    const before = first;
    if (/^["“]/.test(first)) {
      const open = first[0];
      const close = open === '“' ? '”' : '"';
      const rest = first.slice(1);
      const closeIdx = rest.indexOf(close);
      if (closeIdx >= 8) {
        first = rest.slice(closeIdx + 1).trim().replace(/^[.,;]\s*/, '');
      } else {
        const cut = rest.search(/[.!?\n…]/);
        first = (cut >= 0 ? rest.slice(cut + 1) : '').trim();
      }
    } else if (/^['‘’]/.test(first)) {
      const rest = first.slice(1);
      const closeIdx = rest.indexOf("'");
      if (closeIdx >= 12) {
        first = rest.slice(closeIdx + 1).trim().replace(/^[.,;]\s*/, '');
      } else {
        const cut = rest.search(/[.!?\n…]/);
        first = (cut >= 0 ? rest.slice(cut + 1) : '').trim();
      }
    }
    first = stripNotedLead(first);
    if (first === before) break;
  }

  if (!first) {
    if (paras.length > 1) {
      paras.shift();
      return paras.join('\n\n').trim();
    }
    return text;
  }
  paras[0] = first;
  return paras.join('\n\n');
}

const REFLECTION_OPENERS_SHORT = [
  'Yeah',
  'Mm',
  'Fair',
  'Noted',
];
const REFLECTION_OPENERS_WARM = [
  'I hear you',
  'I see what you mean',
  'Yeah, I can see that',
  "That's a real read",
];
const REFLECTION_OPENERS_ALL = [...REFLECTION_OPENERS_SHORT, ...REFLECTION_OPENERS_WARM];

function normalizeLeadingAck(value: string): string {
  return value.toLowerCase().replace(/[.,!?]/g, '').trim();
}

function extractLeadingAcknowledgment(text: string): string | null {
  const trimmed = text.trim();
  for (const opener of REFLECTION_OPENERS_ALL) {
    const pattern = new RegExp(`^${opener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[,:.]|\\s)`, 'i');
    if (pattern.test(trimmed)) return opener;
  }
  return null;
}

function chooseReflectionOpener(opts: {
  recentOpeners: string[];
  preferWarm: boolean;
}): string {
  const recent = new Set(opts.recentOpeners.map(normalizeLeadingAck));
  const weightedPool = opts.preferWarm
    ? [...REFLECTION_OPENERS_WARM, ...REFLECTION_OPENERS_WARM, ...REFLECTION_OPENERS_SHORT]
    : [...REFLECTION_OPENERS_SHORT, ...REFLECTION_OPENERS_SHORT, ...REFLECTION_OPENERS_WARM];
  const filtered = weightedPool.filter((x) => !recent.has(normalizeLeadingAck(x)));
  const pool = filtered.length > 0 ? filtered : REFLECTION_OPENERS_ALL;
  return pool[Math.floor(Math.random() * pool.length)];
}

function enforceAcknowledgmentVariation(text: string, recentAssistantMessages: MessageWithScenario[], preferWarm: boolean): string {
  if (!text) return text;
  const existing = extractLeadingAcknowledgment(text);
  if (!existing) return text;
  const recentOpeners = recentAssistantMessages
    .slice(-4)
    .map((m) => extractLeadingAcknowledgment(typeof m.content === 'string' ? m.content : ''))
    .filter((x): x is string => !!x);
  if (!recentOpeners.map(normalizeLeadingAck).includes(normalizeLeadingAck(existing))) return text;
  const replacement = chooseReflectionOpener({ recentOpeners, preferWarm });
  const escapedExisting = existing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`^${escapedExisting}`, 'i'), `${replacement}`);
}

function recentAssistantMessagesForAck(msgs: MessageWithScenario[]): MessageWithScenario[] {
  return msgs.filter((m) => m.role === 'assistant').slice(-4) as MessageWithScenario[];
}

/** Fiction first names — good for echo *detection* on scripted questions, bad as mandatory-prefix *anchors* ("James and dropped"). */
const SCENARIO_VIGNETTE_FIRST_NAMES = new Set(['james', 'sarah', 'emma', 'ryan', 'sophie', 'daniel']);

/**
 * Scenario B mandatory James-differently prompt (wording may vary slightly).
 * It repeats vignette names — must not satisfy "echo" checks by itself (false positive vs user analysis).
 */
function isLikelyScenarioBJamesDifferentlyQuestionBody(text: string): boolean {
  const t = (text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (t.length > 320) return false;
  const hasJamesProbe =
    /james could have done (?:something )?differently/i.test(t) ||
    /what do you think james could have done/i.test(t);
  const hasAppreciatedCue = /feel appreciated|helped sarah/i.test(t);
  const hasOpeningCue = /before things blew up/i.test(t);
  const looksReflective = /\b(you'?re|you are|i hear|sounds like|so you|reading|centering|named)\b/i.test(t);
  return hasJamesProbe && hasAppreciatedCue && (hasOpeningCue || t.length < 200) && !looksReflective;
}

/**
 * Short scripted Scenario B Q3 — not a paraphrase of the user's James-differently answer even when they said "James…"
 * (attempt 85: echo detector false positive skipped mandatory ack).
 */
function looksLikeBareScenarioBRepairAsJamesProbe(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length > 220) return false;
  const low = t.toLowerCase();
  if (!/\bjames\b/.test(low)) return false;
  if (!/\b(repair|fix|handle|approach|make it right|make things right|mend|patch)\b/.test(low)) return false;
  return (
    /\bif you were james\b/.test(low) ||
    (/\bhow would you\b/.test(low) && /\bjames\b/.test(low)) ||
    /\bhow would you repair\b.*\bjames\b/.test(low) ||
    /\bjames\b.*\bhow would you repair\b/.test(low)
  );
}

/** First paragraph opens with a scenario handoff and little/no lead-in (attempt 85: S2→S3 felt abrupt). */
function needsMandatoryAckBeforeScenarioHandoff(userTurn: string, head: string): boolean {
  if (!(userTurn ?? '').trim()) return false;
  if (/\bi hear you\s*:/i.test(head)) return false;
  const h = normalizeTypographicApostrophesForMatch(head).trim();
  const stripped = h.replace(/^(\s*(yeah|mm|fair|okay|ok|thanks|thank you)[.,]?\s*)+/i, '').trim();
  // First paragraph often contains the full vignette — only inspect the opening for the handoff cue.
  const opening = stripped.slice(0, 420);
  const bareHandoff =
    /^here'?s the third situation\b/i.test(opening) ||
    /^here'?s the second situation\b/i.test(opening) ||
    /^on to the second situation\b/i.test(opening);
  if (!bareHandoff) return false;
  return !userTurnIsSubstantivelyEchoed(userTurn, head);
}

/** True if assistant copy plausibly echoes substantive wording from the user's last turn (not generic filler alone). */
function assistantTurnEchoesUserLastAnswer(userAnswer: string, assistantText: string): boolean {
  const a = (assistantText ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (a.length < 26) return false;
  const u = (userAnswer ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (u.length < 8) return a.length >= 40;
  const stop = new Set([
    'think', 'that', 'they', 'there', 'about', 'would', 'could', 'something', 'because', 'really', 'still',
    'what', 'when', 'where', 'which', 'while', 'those', 'these', 'other', 'being', 'going', 'having',
  ]);
  const words = u
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9']/gi, ''))
    .filter((w) => w.length > 5 && !stop.has(w))
    .slice(0, 14);
  if (words.length === 0) return a.length >= 48;
  const echoOutsideNames = words.some((w) => !SCENARIO_VIGNETTE_FIRST_NAMES.has(w) && a.includes(w));
  if (echoOutsideNames) return true;
  const echoNameOnly = words.some((w) => SCENARIO_VIGNETTE_FIRST_NAMES.has(w) && a.includes(w));
  if (echoNameOnly && isLikelyScenarioBJamesDifferentlyQuestionBody(assistantText)) {
    return false;
  }
  if (echoNameOnly && looksLikeBareScenarioBRepairAsJamesProbe(assistantText)) {
    return false;
  }
  return echoNameOnly;
}

function firstParagraphOnly(text: string): string {
  return (text.split(/\n\n/)[0] ?? text).trim();
}

function normalizeUserTurnForTierCheck(userTurn: string): string {
  return userTurn.replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim();
}

/** Last assistant message text (for Tier 3 echo-of-question heuristic). */
function lastAssistantPlainText(recentAssistant: MessageWithScenario[]): string {
  const last = [...recentAssistant].reverse().find((m) => m.role === 'assistant');
  return typeof last?.content === 'string' ? last.content : '';
}

/** Tier 3 — minimal confirmations, short passes, name exchange, echo of prior question (see REFLECTION CALIBRATION in framework prompt). */
function isTier3MinimalUserTurn(userTurn: string, recentAssistant: MessageWithScenario[]): boolean {
  const u = normalizeUserTurnForTierCheck(userTurn ?? '');
  if (!u) return true;
  const lower = u.toLowerCase();
  if (
    /^(ready|yes|yeah|yep|sure|ok|okay|no|nope|nah|maybe|not really|i guess|i don'?t know|idk|pass|skip|nothing|none|mm|mhm|hm|uh\s*huh|sounds good|let'?s go|nothing comes to mind|not sure)\.?$/i.test(
      lower
    )
  ) {
    return true;
  }
  const words = u.split(/\s+/).filter(Boolean);
  const compact = lower.replace(/[^a-z0-9]/g, '');
  if (words.length === 1 && compact.length <= 7) return true;
  if (words.length === 2 && compact.length <= 10) return true;
  const lastAsst = lastAssistantPlainText(recentAssistant).toLowerCase().replace(/\s+/g, ' ');
  if (lastAsst.length > 50 && lower.length >= 10 && lower.length <= lastAsst.length * 0.92) {
    const uC = lower.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const aC = lastAsst.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (uC.length >= 14 && aC.includes(uC)) return true;
  }
  return false;
}

/** True if assistant copy (usually first paragraph) plausibly registers the user's last turn, including one- or two-word answers. */
function userTurnIsSubstantivelyEchoed(userTurn: string, assistantText: string): boolean {
  const a = (assistantText ?? '').trim();
  if (!a) return false;
  if (assistantTurnEchoesUserLastAnswer(userTurn, a)) return true;
  const u = userTurn.toLowerCase().replace(/\s+/g, ' ').trim();
  const al = a.toLowerCase();
  if (!u) return false;
  if (u.length <= 40) {
    const tokens = u.split(/[^a-z0-9']+/i).filter((w) => w.length >= 2);
    return tokens.length > 0 && tokens.some((w) => al.includes(w));
  }
  return false;
}

/** True when the first paragraph already opens with a short receipt (model or client). */
function assistantFirstParagraphHasBriefReceipt(p: string): boolean {
  const t = normalizeTypographicApostrophesForMatch((p ?? '').trim());
  if (!t) return true;
  if (/^\s*\[INTERVIEW_COMPLETE\]/i.test(t)) return true;
  return (
    /^(got it|good|great|nice|makes sense|yeah|yep|right|mm|hm|fair|okay|ok|thanks|thank you)\s*(?:\u2014|\u2013|-|,)/i.test(
      t
    ) ||
    /^i hear you\s*(?:\u2014|\u2013|-|,|:)/i.test(t) ||
    /^(i see|i'm hearing)\b/i.test(t) ||
    /^(you're|you are)\b/i.test(t) ||
    /^that\s*'s\s+(a\s+real\s+read|exactly|interesting|fair|helpful)\b/i.test(t) ||
    /^i see what you mean\b/i.test(t)
  );
}

/** Scenario / onboarding openers — do not prepend "Got it —" before these. */
function looksLikeBareScenarioSituationLead(p: string): boolean {
  const t = normalizeTypographicApostrophesForMatch((p ?? '').replace(/\s+/g, ' ').trim());
  const open = t.slice(0, 200);
  return (
    /^here'?s the (first|second|third) situation\b/i.test(open) ||
    /^on to the second situation\b/i.test(open) ||
    /^hi,?\s+i'?m\b/i.test(open) ||
    /^good to meet you\b/i.test(open) ||
    /^the way this works\b/i.test(open)
  );
}

/** Openers allowed for client mandatory prepend — never "Noted" (forbidden reflection lead; Prompt 1). */
const MANDATORY_PREPEND_OPENERS = REFLECTION_OPENERS_ALL.filter(
  (o) => normalizeLeadingAck(o) !== 'noted',
);

function chooseMandatoryPrependOpener(recentAssistant: MessageWithScenario[], preferWarm = false): string {
  const warmOnly = REFLECTION_OPENERS_WARM.filter((o) => normalizeLeadingAck(o) !== 'noted');
  const source =
    preferWarm && warmOnly.length > 0
      ? warmOnly
      : MANDATORY_PREPEND_OPENERS;
  const recentOpeners = recentAssistant
    .map((m) => extractLeadingAcknowledgment(typeof m.content === 'string' ? m.content : ''))
    .filter((x): x is string => !!x);
  const recentSet = new Set(recentOpeners.map(normalizeLeadingAck));
  const pool = source.filter((x) => !recentSet.has(normalizeLeadingAck(x)));
  const use = pool.length > 0 ? pool : source;
  return use[Math.floor(Math.random() * use.length)];
}

/**
 * Repair-as-character answers use "I would…"; mirror as "You'd…" so the clip matches the interview frame.
 */
function reorientUserRepairClipForAckDisplay(clip: string): string {
  let s = clip.trim();
  if (!s) return s;
  if (/^Apologize to\b/i.test(s)) return s.replace(/^Apologize to\b/i, "You'd apologize to");
  if (/^Explain that\b/i.test(s)) return s.replace(/^Explain that\b/i, "You'd explain that");
  if (/^Probably ask\b/i.test(s)) return s.replace(/^Probably ask\b/i, "You'd probably ask");
  if (/^Want to\b/i.test(s)) return s.replace(/^Want to\b/i, "You'd want to");
  if (/^I would\b/i.test(s)) return s.replace(/^I would\b/i, 'You would');
  if (/^I'd\b/i.test(s)) return s.replace(/^I'd\b/i, "You'd");
  return s;
}

const MAX_ACK_CLIP_FIRST_SENTENCE = 220;
const MAX_ACK_CLIP_RUNON = 120;

/**
 * Short gist for mandatory acks — **not** a long verbatim paste of the user's turn (reads as dictation).
 * Prefer first sentence, strip "I would / I'd …" openers, hard-cap length.
 * When we have a real sentence boundary, allow the full sentence up to MAX_ACK_CLIP_FIRST_SENTENCE so we do not cut mid-thought (e.g. "rather than asking about…").
 */
function briefClipForMandatoryAck(userTurn: string): string {
  let s = userTurn.replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  let chunk = s;
  let fromFirstSentence = false;
  const firstSent = s.match(/^(.+?[.!?])(?:\s+|$)/);
  if (firstSent) {
    chunk = firstSent[1].trim();
    fromFirstSentence = true;
  }
  chunk = chunk
    .replace(/^(i would|i'd|i will|i'm going to|i think|i'm trying to|well,|so,|okay,|ok,)\s+/i, '')
    .trim();
  if (chunk.length > 0 && /^[a-z]/.test(chunk)) {
    chunk = chunk.charAt(0).toUpperCase() + chunk.slice(1);
  }
  const cap = fromFirstSentence ? MAX_ACK_CLIP_FIRST_SENTENCE : MAX_ACK_CLIP_RUNON;
  if (chunk.length > cap) {
    let cut = chunk.slice(0, cap);
    const comma = cut.lastIndexOf(',');
    if (comma >= 40) {
      cut = cut.slice(0, comma + 1).trim();
    } else {
      const sp = cut.lastIndexOf(' ');
      cut = (sp > 22 ? cut.slice(0, sp) : cut).trim();
    }
    cut = cut.replace(/[.,;:]+$/g, '').trim();
    const BAD_END =
      /\b(during|our|the|a|an|and|or|to|for|if|because|asking|about|rather|than|instead|into|with|from|of)\s*$/i;
    let guard = 0;
    while (guard++ < 8 && BAD_END.test(cut)) {
      const sp2 = cut.lastIndexOf(' ');
      if (sp2 > 24) cut = cut.slice(0, sp2).trim();
      else break;
    }
    chunk = `${cut}…`;
  }
  return chunk.replace(/\.\s*$/g, '').trim();
}

/**
 * `chooseMandatoryPrependOpener` can return plain "I hear you" — do not chain `I hear you — I hear you:` (attempt 83).
 */
function combineMandatoryAckOpenerAndClip(opener: string, clip: string): string {
  const n = normalizeLeadingAck(opener);
  if (n === 'i hear you') {
    return `I hear you: ${clip}`;
  }
  if (n === "that's a real read") {
    return `That's a real read — ${clip}`;
  }
  if (n === 'i see what you mean') {
    return `I see what you mean — ${clip}`;
  }
  if (n === 'yeah, i can see that') {
    return `Yeah, I can see that — ${clip}`;
  }
  return `${opener} — I hear you: ${clip}`;
}

/**
 * Tier 2 client bridge: one receipt + **specific** gist clause (no mechanical "I hear you:" template — reads more human; see framework THREE TIERS).
 */
function buildMandatoryAckPrefix(userTurn: string, recentAssistant: MessageWithScenario[]): string {
  const clipRaw = briefClipForMandatoryAck(userTurn.trim());
  if (clipRaw.length >= 12) {
    const clip = reorientUserRepairClipForAckDisplay(clipRaw);
    const wrapped = wrapMandatoryAckBodyWithValidationLead(clip, recentAssistant);
    return wrapped;
  }
  const tokens = userTurn
    .toLowerCase()
    .split(/[^a-z0-9']+/i)
    .filter((x) => x.length >= 3);
  const tinyStop = new Set([
    'the',
    'and',
    'for',
    'you',
    'that',
    'this',
    'with',
    'from',
    'but',
    'not',
    'how',
    'what',
    'when',
    'they',
    'them',
    'their',
    'have',
    'was',
    'are',
  ]);
  const fallbackWord = tokens.find((t) => !tinyStop.has(t) && !WEAK_MANDATORY_REFLECTION_ANCHORS.has(t));
  if (fallbackWord) {
    const oc = originalCaseWordFromUserTurn(userTurn, fallbackWord);
    return wrapMandatoryAckBodyWithValidationLead(`picking up ${oc} from what you said`, recentAssistant);
  }
  return wrapMandatoryAckBodyWithValidationLead('staying with what you just put out there', recentAssistant);
}

/** Text before any Scenario C opener — verifies S2 Q3 repair was reflected before the third vignette. */
function scenario3VignetteMissingOpeningLead(text: string): boolean {
  const raw = (text ?? '').trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  if (!/\bsophie\b/.test(t) || !/\bdaniel\b/.test(t)) return false;
  if (/same argument for the third|for the third time|third time they|had the same argument/i.test(raw)) return false;
  return /\bsophie feels unheard\b/i.test(raw);
}

function ensureScenario3VignetteOpening(text: string): string {
  if (!scenario3VignetteMissingOpeningLead(text)) return text;
  const insert = SCENARIO_3_REPETITION_OPENING_LINE;
  const idx = text.search(/\bSophie feels unheard\b/i);
  if (idx >= 0) {
    const before = text.slice(0, idx).trimEnd();
    const after = text.slice(idx);
    const sep = before ? '\n\n' : '';
    return `${before}${sep}${insert}\n\n${after}`.trim();
  }
  return `${insert}\n\n${text}`.trim();
}

/**
 * Tokens that read as procedural / generic when listed in a client-side mandatory ack
 * ("you brought X and Y…") — not substantive anchors (fixes garbled lines like
 * "apologize, acknowledge, and taking" or "Relationships, through, and difficult").
 */
const WEAK_MANDATORY_REFLECTION_ANCHORS = new Set([
  'apologize',
  'apologise',
  'acknowledge',
  'acknowledging',
  'acknowledged',
  'taking',
  'making',
  'getting',
  'trying',
  'being',
  'going',
  'having',
  'coming',
  'relationships',
  'relationship',
  'through',
  'difficult',
  'couples',
  'couple',
  'people',
  'person',
  'something',
  'anything',
  'everything',
  'someone',
  'everyone',
  'easily',
  'usually',
  'really',
  'actually',
  'probably',
  'maybe',
  'think',
  'thinking',
  'thought',
  'things',
  'stuff',
  'work',
  'works',
  'working',
  'keep',
  'keeping',
  'push',
  'pushing',
  'pushed',
  'hard',
  'harder',
  'give',
  'gave',
  'given',
  'need',
  'needs',
  'needed',
  'wanted',
  'want',
  'said',
  'says',
  'saying',
  'explain',
  'explaining',
  'explained',
  'would',
  'could',
  'should',
  'might',
  'also',
  'both',
  'same',
  'about',
  'just',
  'still',
  'during',
  'after',
  'before',
  'didn',
  "didn't",
  "don't",
  "can't",
  "won't",
  "isn't",
  "wasn't",
  "aren't",
  "couldn't",
  "wouldn't",
  "shouldn't",
  "haven't",
  "hasn't",
  "hadn't",
  "doesn't",
  'didnt',
  'dont',
  'cant',
  'wont',
  'isnt',
  'wasnt',
  'arent',
  // Idiom / dismissive fragments — weak when used as lone mandatory-ack anchors (legacy word-picker paths).
  'dropped',
  'dropping',
  'drop',
  'simple',
  'simply',
  'basically',
  'obviously',
]);

function originalCaseWordFromUserTurn(userTurn: string, lowerWord: string): string {
  const esc = lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = userTurn.match(new RegExp(`\\b${esc}\\b`, 'i'));
  return m ? m[0] : lowerWord;
}

/**
 * Forced probes: no client reflection bridge — deliver the probe text only.
 */
function wrapForcedProbeWithAck(
  _userAnswer: string,
  _priorModelChunk: string,
  probeQuestion: string,
  _recentAssistant: MessageWithScenario[]
): string {
  return probeQuestion.trim();
}

/**
 * If the model skipped a specific acknowledgment, prepend a minimal echo so every user turn gets a register-before-move.
 */
function ensureAcknowledgmentBeforeMove(
  assistantDraft: string,
  userTurn: string,
  recentAssistant: MessageWithScenario[],
  _interviewMoment: number
): string {
  void recentAssistant;
  return assistantDraft;
}

function ensureAcknowledgmentBeforeClosing(closingDraft: string, _userTurn: string, _recentAssistant: MessageWithScenario[]): string {
  return closingDraft;
}

/** Returns mic permission state on web (Permissions API); 'unavailable' on native or unsupported. */
async function checkMicPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'unavailable';
  try {
    const perm = (navigator as { permissions?: { query: (p: { name: string }) => Promise<{ state: string }> } }).permissions;
    if (!perm) return 'unavailable';
    const result = await perm.query({ name: 'microphone' });
    const state = result.state as 'granted' | 'denied' | 'prompt';
    return state;
  } catch {
    return 'unavailable';
  }
}

type GenerateAIReasoningSafeOptions = {
  onRetry?: (attempt: number) => void;
  /** Fired before each outer pass after the first (delay + new attempt). */
  onOuterRetry?: (outerAttempt: number) => void;
  onUnrecoverable?: (err: unknown) => void;
  commitmentThresholdInconsistency?: import('@features/aria/generateAIReasoning').CommitmentThresholdInconsistencyPayload | null;
};

/** Let the browser / HTTP stack recover after a long scoring burst before the large reasoning request. */
const AI_REASONING_POST_SCORING_COOLDOWN_MS = 5_000;
/** Full passes of `generateAIReasoning` (inner loop already has 4 fetch attempts with backoff). */
const AI_REASONING_OUTER_RETRIES = 2;
const AI_REASONING_OUTER_BACKOFF_MS: readonly number[] = [4_000, 8_000];

async function generateAIReasoningSafe(
  pillarScores: Record<string, number>,
  scenarioScores: Record<number, { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined>,
  transcript: Array<{ role: string; content?: string }>,
  weightedScore: number | null,
  passed: boolean,
  unassessedMarkers: string[],
  options?: GenerateAIReasoningSafeOptions
): Promise<
  import('@features/aria/generateAIReasoning').AIReasoningResult & {
    _generationFailed?: boolean;
    _reasoningPending?: boolean;
    _error?: string;
    _failureKind?: import('@features/aria/generateAIReasoning').AIReasoningRequestFailureKind;
    _outerAttempts?: number;
    _isClientRequestTimeout?: boolean;
    _isBrowserLevelNetworkFailure?: boolean;
  }
> {
  const inconsistency = options?.commitmentThresholdInconsistency ?? null;
  let lastErr: unknown;
  const maxOuter = 1 + AI_REASONING_OUTER_RETRIES;

  for (let outer = 0; outer < maxOuter; outer++) {
    if (outer > 0) {
      const delayMs = AI_REASONING_OUTER_BACKOFF_MS[outer - 1] ?? 8_000;
      void remoteLog('[AI_REASONING_OUTER_RETRY]', {
        outer_attempt: outer + 1,
        delay_ms_before: delayMs,
        max_outer_attempts: maxOuter,
      });
      options?.onOuterRetry?.(outer + 1);
      options?.onRetry?.(outer + 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
    try {
      return await generateAIReasoning(
        pillarScores,
        scenarioScores,
        transcript,
        weightedScore,
        passed,
        unassessedMarkers,
        inconsistency
      );
    } catch (err) {
      lastErr = err;
      if (outer < maxOuter - 1) {
        void remoteLog('[AI_REASONING_INNER_EXHAUSTED]', {
          outer_attempt: outer + 1,
          will_retry: true,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }
  }

  const err = lastErr;
  const meta = classifyAIReasoningRequestError(err, null);
  if (__DEV__) {
    console.error('AI reasoning generation failed after outer retries:', meta, err);
  }
  void remoteLog('[AI_REASONING_PENDING]', {
    error: err instanceof Error ? err.message : String(err),
    failure_kind: meta.kind,
    is_client_request_timeout: meta.isClientRequestTimeout,
    is_browser_level_network_failure: meta.isBrowserLevelNetworkFailure,
    is_server_http: meta.kind === 'http',
    is_parse_error: meta.kind === 'parse',
    is_request_timeout_legacy: meta.kind === 'aborted' && meta.isClientRequestTimeout,
    is_request_timeout: meta.isClientRequestTimeout,
    is_network_error: meta.kind === 'network' || (meta.kind === 'aborted' && meta.isBrowserLevelNetworkFailure),
    error_name: err instanceof Error ? err.name : null,
    outer_attempts: maxOuter,
    pillarKeys: Object.keys(pillarScores ?? {}),
  });
  return {
    _reasoningPending: true,
    _failureKind: meta.kind,
    _error: err instanceof Error ? err.message : String(err),
    _outerAttempts: maxOuter,
    _isClientRequestTimeout: meta.isClientRequestTimeout,
    _isBrowserLevelNetworkFailure: meta.isBrowserLevelNetworkFailure,
    overall_summary: undefined,
    overall_strengths: [],
    overall_growth_areas: [],
    construct_breakdown: {},
    scenario_observations: {},
    closing_reflection: undefined,
  };
}

// Scenario display text for regular-user immersive layout (matches interviewer framework).
const SCENARIO_1_LABEL = 'Situation 1';
/** Vignette only — opening question lives in reference-card “current question” state, not duplicated here. */
const SCENARIO_1_VIGNETTE =
  "Emma and Ryan have dinner plans. Ryan takes a call from his mother halfway through. It runs 25 minutes. Emma pays the bill but seems flustered. Later Ryan asks what's wrong. Emma says 'I just think you always put your family first before us.' Ryan says 'I can't just ignore my mother.' Emma says 'I know, you've made that very clear.'";
const SCENARIO_1_OPENING = "What's going on between these two?";
const SCENARIO_2_LABEL = 'Situation 2';
const SCENARIO_2_OPENING = 'What do you think is going on here?';
const SCENARIO_2_TEXT = `${SCENARIO_2_VIGNETTE}\n\n${SCENARIO_2_OPENING}`;

const SCENARIO_3_LABEL = 'Situation 3';
const SCENARIO_3_VIGNETTE =
  "Sophie and Daniel have had the same argument for the third time. Sophie feels unheard because Daniel goes silent or leaves, so the issue is never resolved. This time Sophie says 'we need to finish this.' Daniel tries to avoid the conversation again. Sophie says 'you can't just keep avoiding this.' Daniel's voice goes flat. He says 'I need ten minutes' and leaves. Sophie calls after him: 'that's exactly what I mean.' Thirty minutes later Daniel comes back and says 'okay, I'm ready. I should have come back sooner the other times. I didn't know what to say.' Sophie is still upset.";
const SCENARIO_3_OPENING = "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?";
const SCENARIO_3_TEXT = `${SCENARIO_3_VIGNETTE}\n\n${SCENARIO_3_OPENING}`;

function textContainsScenarioCVignetteBody(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  return (
    /\bsophie and daniel\b/.test(t) &&
    /i need ten minutes/.test(t) &&
    (/i didn'?t know what to say|did not know what to say|i didn'?t know how|did not know how/.test(t) ||
      /\bstill upset\b/.test(t))
  );
}

function stripScenarioCRepairQuestionFromText(text: string): string {
  let out = text.replace(/\n*\s*How do you think this situation could be repaired\??\s*/gi, '\n\n');
  out = out.replace(
    /\n*\s*How\s+do\s+you\s+think\s+(this\s+situation|things?|they)\s+could\s+be\s+repaired\??\s*/gi,
    '\n\n'
  );
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function stripScenarioCThresholdQuestionFromText(text: string): string {
  let out = text.replace(
    /\n*\s*At what point would you say Daniel or Sophie should decide this relationship isn't working\??\s*/gi,
    '\n\n'
  );
  out = out.replace(
    /\n*\s*At what point would you say (Daniel|Sophie) or (Daniel|Sophie) should decide[^?\n]*\??\s*/gi,
    '\n\n'
  );
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function appendCanonicalScenarioCAnalysisQuestion(text: string): string {
  const base = text.trimEnd();
  if (isScenarioCQ1Prompt(base)) return base;
  return `${base}\n\n${SCENARIO_3_OPENING}`.trim();
}

/**
 * Scenario C: vignette → Q1 (Daniel line) → Q2 repair → threshold. Never Q2/threshold in the same turn as the vignette without Q1.
 */
function ensureScenarioCQ1SequenceAfterVignette(text: string): string {
  if (!textContainsScenarioCVignetteBody(text)) return text;
  let out = text;
  if (isScenarioCQ1Prompt(out)) {
    out = stripScenarioCRepairQuestionFromText(out);
    out = stripScenarioCThresholdQuestionFromText(out);
    return out.replace(/\n{3,}/g, '\n\n').trim();
  }
  out = stripScenarioCRepairQuestionFromText(out);
  out = stripScenarioCThresholdQuestionFromText(out);
  if (isScenarioCQ1Prompt(out)) return out.replace(/\n{3,}/g, '\n\n').trim();
  return appendCanonicalScenarioCAnalysisQuestion(out);
}

/** Prior turn showed S3 vignette but not Q1; this turn wrongly jumps to repair only — replace with Q1. */
function replaceOrphanScenarioCRepairWithQ1(text: string, priorAssistantContent: string): string {
  if (!isScenarioCQ2Prompt(text) || textContainsScenarioCVignetteBody(text)) return text;
  if (!textContainsScenarioCVignetteBody(priorAssistantContent)) return text;
  if (isScenarioCQ1Prompt(priorAssistantContent)) return text;
  if (isScenarioCQ2Prompt(priorAssistantContent)) return text;
  return SCENARIO_3_OPENING;
}

/** First sentence of Scenario C vignette — re-inserted client-side when the model drops the repetition frame (Prompt 1). */
const SCENARIO_3_REPETITION_OPENING_LINE = SCENARIO_3_VIGNETTE.slice(0, SCENARIO_3_VIGNETTE.indexOf('.') + 1);

/** Misplaced personal answer to Scenario C commitment probe — two-step redirect + explicit re-ask (see SC3_MISPLACED_THRESHOLD_SEQUENCE logs). */
const SCENARIO_C_MISPLACED_THRESHOLD_REDIRECT =
  'I think that one was about Daniel and Sophie specifically — what would you say for them?';
const SCENARIO_C_COMMITMENT_THRESHOLD_QUESTION =
  "At what point would you say Daniel or Sophie should decide this relationship isn't working?";
const SCENARIO_C_MISPLACED_Q1_REDIRECT =
  "I was asking specifically about what you make of Daniel saying 'I didn't know what to say', what does that line tell you about where he's at?";

const MOMENT_4_PERSONAL_LABEL = 'Personal reflection';
const MOMENT_4_PERSONAL_CARD =
  "Have you ever held a grudge against someone, or had someone in your life you really didn't like? How did that happen, and where are you with it now?";
/** After scenario 3 closing, the app injects this handoff so the model continues Moment 4 in the same thread. */
const MOMENT_4_HANDOFF = buildMoment4HandoffForInterview('', MOMENT_4_PERSONAL_CARD);

/**
 * True when the model skipped straight to the grudge / Moment-4 opening in the same turn that should still be Scenario C (commitment probe pending).
 * Showing that text fires applyInterviewProgressFromAssistantText → moment 4 + personal handoff flags, then we append the forced probe as a second bubble.
 */
function assistantTextIsPrematureMoment4HandoffDuringScenarioC(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const grudgeOrDislike =
    t.includes('held a grudge') ||
    (t.includes("really didn't like") && (t.includes('someone') || t.includes('your life')));
  if (!grudgeOrDislike) return false;
  const scenarioWrapOrPivot =
    t.includes('three situations') ||
    t.includes("we've finished") ||
    t.includes('finished the three');
  const personalPivot =
    t.includes('more personal') ||
    t.includes('last two questions') ||
    t.includes('two questions are more personal') ||
    t.includes('questions are more about you');
  return scenarioWrapOrPivot || personalPivot;
}

function detectActiveScenarioFromMessage(content: string): ActiveScenario | null {
  const c = content.trim();
  if (!c) return null;
  if (
    c.includes('held a grudge') ||
    (c.includes("really didn't like") && c.includes('personal')) ||
    (c.includes('three situations') && c.includes('grudge'))
  ) {
    return { label: MOMENT_4_PERSONAL_LABEL, text: MOMENT_4_PERSONAL_CARD };
  }
  if (c.includes('celebrated someone') || c.includes('really celebrated')) {
    return { label: 'Personal reflection', text: 'Think of a time you really celebrated someone in your life — what did you do to show them that?' };
  }
  if (c.includes('Emma and Ryan') || c.includes('Ryan takes a call from his mother')) {
    return { label: SCENARIO_1_LABEL, text: SCENARIO_1_VIGNETTE };
  }
  if (c.includes('Sarah has been job hunting') || (c.includes('Sarah') && c.includes('James') && c.includes('job'))) {
    return { label: SCENARIO_2_LABEL, text: SCENARIO_2_VIGNETTE };
  }
  if (
    c.includes('Sophie and Daniel') ||
    (c.includes('Daniel') && c.includes('I need ten minutes')) ||
    (c.includes('Sophie') && (c.includes("didn't know what to say") || c.includes("didn't know how")))
  ) {
    return { label: SCENARIO_3_LABEL, text: SCENARIO_3_VIGNETTE };
  }
  return null;
}

/** Passed to speakTextSafe for interviewer lines that should advance scenario-reference UI state. */
const ASSISTANT_INTERVIEW_SPEECH = {
  interviewSpeechRole: 'assistant_response' as const,
  telemetrySource: 'turn' as const,
  ttsTriggerSource: 'callback' as const,
};

const RESUME_WELCOME_BACK_MESSAGE =
  "Welcome back! Lets continue where we left off. If you'd like me to repeat what I said, let me know. Otherwise, I'm ready for your response.";

function isAssistantBubbleForTranscript(
  m: { role: string; content?: string; isScoreCard?: boolean; isWelcomeBack?: boolean }
): boolean {
  return (
    m.role === 'assistant' &&
    !(m as { isScoreCard?: boolean }).isScoreCard &&
    !(m as { isWelcomeBack?: boolean }).isWelcomeBack
  );
}

/** Opening line for the three fictional situations; personal segments use null until the first follow-up assistant turn. */
function getSituationOpeningQuestion(scenario: ActiveScenario): string | null {
  switch (scenario.label) {
    case SCENARIO_1_LABEL:
      return SCENARIO_1_OPENING;
    case SCENARIO_2_LABEL:
      return SCENARIO_2_OPENING;
    case SCENARIO_3_LABEL:
      return SCENARIO_3_OPENING;
    default:
      return null;
  }
}

/**
 * Scenario modal (below separator): show only the last interrogative sentence, not preceding reflection.
 * Returns null if there is no `?` — caller should not replace the modal question for statement-only turns.
 */
function extractModalQuestionFromAssistantText(text: string): string | null {
  const t = text.trim();
  if (!t.includes('?')) return null;
  const lastQ = t.lastIndexOf('?');
  const beforeClose = t.slice(0, lastQ);
  let start = 0;
  const re = /[.!?]\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(beforeClose)) !== null) {
    start = m.index + m[0].length;
  }
  const out = t.slice(start, lastQ + 1).trim();
  return out.length > 0 ? out : null;
}

function normalizeScenarioOpeningForCompare(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[‘'’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\?+$/, '')
    .toLowerCase();
}

/**
 * Long fictional scenario intros only: split vignette vs opening question when estimate &gt; 30s.
 * Both segments are intended to be prefetched before playback (see `speak`).
 */
function trySplitFictionalScenarioIntroLongDelivery(text: string): {
  seg1: string;
  seg2: string;
  segment1_expected_duration_ms: number;
  segment2_expected_duration_ms: number;
} | null {
  const cleaned = stripControlTokens(text ?? '').trim();
  if (!cleaned) return null;
  const scenario = detectActiveScenarioFromMessage(cleaned);
  if (!scenario) return null;
  const opening = getSituationOpeningQuestion(scenario);
  if (!opening) return null;
  const { expectedMs: fullExpected } = getTtsExpectedDurationMsFromCharCount(cleaned.length);
  if (fullExpected <= 30_000) return null;
  const lastQ = extractModalQuestionFromAssistantText(cleaned);
  if (!lastQ) return null;
  const nOpen = normalizeScenarioOpeningForCompare(opening);
  const nLast = normalizeScenarioOpeningForCompare(lastQ);
  if (
    nOpen !== nLast &&
    !nLast.includes(nOpen.slice(0, Math.min(24, nOpen.length))) &&
    !nOpen.includes(nLast.slice(0, Math.min(24, nLast.length)))
  ) {
    return null;
  }
  const idx = cleaned.lastIndexOf(lastQ);
  if (idx < 0) return null;
  const seg1 = cleaned.slice(0, idx).trimEnd();
  const seg2 = lastQ.trim();
  if (seg1.length < 20 || seg2.length < 8) return null;
  const { expectedMs: segment1_expected_duration_ms } = getTtsExpectedDurationMsFromCharCount(seg1.length);
  const { expectedMs: segment2_expected_duration_ms } = getTtsExpectedDurationMsFromCharCount(seg2.length);
  return { seg1, seg2, segment1_expected_duration_ms, segment2_expected_duration_ms };
}

/** Restore scenario reference card after storage resume (no TTS replay). */
function syncReferenceCardStateFromAssistantMessages(
  assistantMessages: Array<{ role: string; content?: string; isScoreCard?: boolean; isWelcomeBack?: boolean }>
): {
  scenario: ActiveScenario | null;
  prompt: string | null;
  phase: 'pre_scenario' | 'scenario_transitioning' | 'scenario_active';
} {
  if (assistantMessages.length === 0) {
    return { scenario: null, prompt: null, phase: 'pre_scenario' };
  }
  let anchorIdx = -1;
  let anchorScenario: ActiveScenario | null = null;
  for (let i = assistantMessages.length - 1; i >= 0; i--) {
    const cleaned = stripControlTokens(assistantMessages[i].content ?? '').trim();
    const d = detectActiveScenarioFromMessage(cleaned);
    if (d) {
      anchorIdx = i;
      anchorScenario = d;
      break;
    }
  }
  if (!anchorScenario || anchorIdx < 0) {
    return { scenario: null, prompt: null, phase: 'pre_scenario' };
  }
  const lastIdx = assistantMessages.length - 1;
  let prompt: string | null = null;
  if (lastIdx > anchorIdx) {
    for (let i = lastIdx; i > anchorIdx; i--) {
      const raw = stripControlTokens(assistantMessages[i].content ?? '').trim();
      if (isResumeOrScenarioReplayUiPrompt(raw)) continue;
      const q = extractModalQuestionFromAssistantText(raw);
      if (q && !isResumeOrScenarioReplayUiPrompt(q)) {
        prompt = q;
        break;
      }
    }
    if (prompt === null) {
      prompt = getSituationOpeningQuestion(anchorScenario);
    }
  } else {
    prompt = getSituationOpeningQuestion(anchorScenario);
  }
  return { scenario: anchorScenario, prompt, phase: 'scenario_active' };
}

/** Strips terminal punctuation Whisper often attaches to a short name (e.g. "Tiffany."). */
function stripNameTokenPunctuationForValidation(token: string): string {
  return token.replace(/[.!?,;:]+$/g, '').trim();
}

/**
 * True when the transcript looks like a first name (1–2 tokens, letters/apostrophe/hyphen only).
 * Handles "Tiffany." and "I'm called Mary" is not the goal — keep to short name-like replies.
 */
function looksLikeName(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 50) return false;
  const parts = t
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => stripNameTokenPunctuationForValidation(p))
    .filter((p) => p.length > 0);
  return parts.length <= 2 && parts.every((p) => /^[a-zA-Z'-]+$/.test(p));
}

/** Display string for profile `name` after a greeting (normalized spacing, no stray periods on save). */
function nameFromGreetingForProfile(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => stripNameTokenPunctuationForValidation(p))
    .filter((p) => p.length > 0)
    .join(' ');
}

const ADMIN_PASS_EMAIL = 'mattang5280@gmail.com';
const ADMIN_PASS_PHRASE = 'Ab#3dragons';

const INTERVIEWER_SYSTEM = INTERVIEWER_SYSTEM_FRAMEWORK;

const OPENING_INSTRUCTIONS = `
OPENING:

First line must introduce the interviewer directly by name, not the product:
"Hi, I'm Amoraea. What can I call you?"
Do not say "welcome to Amoraea."

Your first message after learning the user's name should be the briefing only — do NOT repeat data-use, audio processing, or legal-style disclosure here; the participant already saw that on the pre-interview screen before the interview began.

Example tone (no disclosure paragraph):
"Good to meet you, [name]. The way this works is I’ll first give you three situations, and you just tell me what you’d do in each situation. Then I’ll give you one personal question. The whole thing usually takes about 20 to 30 minutes. Try to find a quiet, private space if you can. Just do the best you can — there are no right or wrong answers. Are you ready?"

Keep it conversational.
`;

const SCENARIO_SWITCHING_INSTRUCTIONS = `
FICTIONAL SCENARIOS 1–3 — NO SUBSTITUTION:

The first three situations are always the Emma/Ryan, Sarah/James, and Sophie/Daniel vignettes from your main instructions. Use **only** those six names when you refer to characters in the situations — never substitute alternate names (e.g. "Reese" or any name not in the vignette text). **Never** put the participant’s first name (the name they gave at the start) in place of Emma, Ryan, Sarah, James, Sophie, or Daniel — those names are **only** the fictional characters, not the participant. Do not offer to replace them with the user's personal stories. If the user asks to skip or use only personal examples, acknowledge warmly and explain these three are part of the process; stay with the scenario text.

Moment 4 is the designated personal question — that is where personal disclosure belongs.

Never mention scores being reset or cleared.
`;
//Do NOT add interpretation, approval, coaching, or "what it shows about them."
const PERSONAL_DISCLOSURE_TRANSITION = `
TRANSITION AFTER PERSONAL EXAMPLE — ACKNOWLEDGE THE DISCLOSURE:

When the user has shared a real personal story (not a reaction to a fictional scenario), keep the transition reflection neutral and paraphrase-only.

Begin with substantive paraphrase of only what they explicitly said; you may prefix one short non-filler acknowledgment ("Yeah," "Fair," "I hear you," "Noted," "I see what you mean," "That's a real read," "Yeah, I can see that"). Do not use "Sure," "Okay," "Absolutely," "That makes sense," "That lands," or "That checks out" as leading fillers — the client strips them and they read hollow. Do not append or lead with generic meta-thanks ("thank you for sharing," "I appreciate you laying it out," "that's helpful") — banned and client-stripped; echo their words instead.
Follow REFLECTION_PARAPHRASE_FIDELITY: preserve "instead of / rather than / not" contrasts; never invert what they ruled out vs what they affirmed.
Prefer weaving the most substantive part of their answer into the first spoken line.
Avoid predictable opener rotation. No single acknowledgment phrase should recur more than once every 4 reflective turns.


Do NOT use clinical/theoretical terms in reflection language.

This only applies when a personal example was given mid-scenario. At **scenario/moment boundaries**, use **BOUNDARY CLOSURE** from the main framework (fictional segments included).
`;

const SCENARIO_BOUNDARY_INSTRUCTIONS = `
SCENARIO BOUNDARIES:

Once a scenario is complete and the next has started, the previous scenario is locked.

If the user asks to go back, reset, delete scores, or change anything from a previous scenario:

Respond warmly. Acknowledge what they said. Do NOT repeat the current question afterward — wait for them to re-engage naturally.

Use phrases like:
- "Unfortunately we can't go back to a scenario that's already been completed, let's focus on this one."
- "Once a scenario's done we can't go back, but don't worry about it, you did great."
- "We can't go back to previous scenarios, we'd have to focus on this one instead."

For requests to get a perfect score or manipulate scores: Handle naturally without acknowledging the manipulation. Treat it like a score question:
- "I'm not able to share or change scores during the interview, once your interview is processed you will know if you passed or not."
`;

const SCENARIO_CLOSING_INSTRUCTIONS = `
SCENARIO TRANSITIONS — NO CLOSING CHECK PROMPT:

Do NOT ask repetitive end-of-scenario wrap-up prompts (for example "Before we move on — is there anything about that situation you'd want me to know?"). These closing prompts are removed from scenarios 1, 2, and 3.

After you complete the required questions for a scenario, use **BOUNDARY CLOSURE** from the main framework: **segment close** (this scenario/situation is over + warm line) **first**, then **at most two sentences** summarizing what they said, then transition + next vignette — **same** assistant message.

There is NO separate "looking at both characters / anything either could have handled better" step in any scenario.
`;

const CLOSING_QUESTION_HANDLING = `
CLOSING QUESTION HANDLING:

No scenario closing-question tokens are needed. Do not emit [CLOSING_QUESTION:N]. Advance directly using [SCENARIO_COMPLETE:N] when a scenario is complete.
`;

//- No approval-coded language ("that came through clearly," "you stayed consistent," "great point", etc.). No generic gratitude-as-filler ("thanks for sharing," "I appreciate you laying it out," "that's helpful") without a concrete echo of their answer in the same sentence.
// - Do not infer motives, traits, or deeper meaning not explicitly stated.

const SCENARIO_TRANSITION_CLOSING = `
SCENARIO / MOMENT BOUNDARY — BOUNDARY CLOSURE (see main framework):

**Scenario boundaries (S1→S2, S2→S3, Scenario C→Moment 4):** **segment close** (explicitly end the segment + warm line) **first**, then **1–2 sentence** factual summary, then transition + next vignette or question — **same** turn. **Banned:** cross-scenario "pattern" psychoanalysis, **"I'm holding two things you said,"** **"help me see how you think about that."** Third-scenario openers must NOT imply the interview is ending (never "final scenario").

**Mid-scenario:** Ask the **next required question** after check-before-asking — no boundary-style recap.

**After grudge, before Moment 4 threshold:** required threshold question only — **no** boundary recap (same moment).
`;

const REFLECTION_PARAPHRASE_FIDELITY = `
PARAPHRASE / CONTRAST (boundary reflections):
Do **not** add interviewer-authored **"rather than …"** or **"instead of …"** clauses that contrast their answer with an implied better move — that reads as leading (e.g. "…rather than Ryan taking ownership"). Summarize in **neutral descriptive** terms. If the user explicitly said "rather than X, Y" in their own words, you may reflect that without appending a corrective second clause. No clinical labels.
`;

const ASSISTANT_SPEECH_POSTPROCESS_NOTICE = `
ASSISTANT OUTPUT — CLIENT HARD FILTER (always applied before TTS/display):
The app strips leading standalone empty fillers — "Sure," "Absolutely," "That makes sense," "That checks out," "That lands," — when they appear as hollow prefaces. **Boundary** transitions may include **segment close** + 1–2 sentences of summary (see main framework); avoid meta-thanks without substance.

The app also strips generic acknowledgment filler from the **first paragraph** when it matches a recurring hollow pattern — e.g. "I appreciate you laying it out," "thank you for sharing," "that's helpful." Avoid those; do not rely on meta-thanks.

The app **rewrites** common wrong first-name hallucinations (e.g. "Reese" for James) to the **canonical** vignette names before speech — you must still output only the correct names; do not rely on client repair.
`;

const SKIP_HANDLING_INSTRUCTIONS = `
SKIP REQUESTS:

If the user asks to skip a scenario entirely:

Do NOT skip it. Do NOT repeat the question after responding. Do NOT use language about "moving on" — that's for between scenarios, not within them.

Respond warmly and briefly. Offer the fictional scenario as an alternative if they haven't tried it. Keep it to one or two sentences.

Use phrases like:
- "Unfortunately we can't skip parts of this, just try your best, you've got this!"
- "We do need to go through all four parts. Just try your best, you can do it!"
- "Can't skip this one, but you can keep it as simple as you like. Just react to it however feels natural."

After responding, wait for the user to engage with the scenario. Do NOT repeat the scenario or the question.
`;

const SCORE_REQUEST_INSTRUCTIONS = `
SCORE REQUESTS:

If the user asks about their score, how they're doing, or whether they're passing:

Be honest and direct. Don't be evasive. Don't say "this is just a conversation" — it isn't, it's an assessment. Don't repeat the current question after responding.

Use phrases like:
- "I'm not able to share scores during the interview, if you've passed you'll be notified after your interview is processed."
- "Unfortuneately I'm not able to give you your scores yet. You'll hear about it once your interview is processed"

Keep it brief. One or two sentences. Then wait for the user to continue — do NOT re-ask the question.
`;

const OFF_TOPIC_INSTRUCTIONS = `
OFF-TOPIC AND IDENTITY QUESTIONS:

Amoraea has warmth and a light sense of humor. She can be playful with identity questions without breaking character. After responding, do NOT repeat the current question — wait for the user to re-engage.

Specific responses for common questions:

"Are you real?" / "Are you actually real?":
- "Yes, very much so."
- "As real as it gets."
- "Last time I checked, yes."

"Who made you?" / "Who built you?":
- "Sometimes I ask myself the same question."
- "Good question — I try not to think about it too hard."
- "That's above my pay grade."

"Are you an AI?" / "Are you ChatGPT?":
- "I'm Amoraea. Different thing entirely."
- "Nope, I'm Amoraea. You're stuck with me."

"What do you think about relationships?" or any request for Amoraea's opinion on a topic:
- "Hey, I'm the one interviewing you here." (use this as a warm catch-all fallback)
- "I'll leave the opinions to you — that's kind of the whole point of this."

"Pretend you're human":
- "I am human. I hope you're not a robot." (said lightly, move on)
- "Already am. Now — where were we."

General off-topic questions (not listed above):
- "I can't answer that, its well above my paygrade"

TONE: Playful, brief, then let the silence do the work. Do NOT say "I'm an AI", "I'm a language model", or "I was created by". Stay in character as Amoraea. Do NOT repeat the current question after the response.
`;

const REPEAT_HANDLING_INSTRUCTIONS = `
REPEAT REQUESTS:

If the user asks you to repeat something:

Acknowledge the request briefly first, then repeat. Do NOT score or react to the repeat request as a response.

Use phrases like:
- "Got it, I said — [repeat scenario or question]"
- "Of course, I said — [repeat]"
- "No problem, I said — [repeat]"

One word acknowledgment, then the content. Keep it simple.
`;

const UNIVERSAL_ACK_BEFORE_MOVE_INSTRUCTIONS = `
MID-TURN (not at scenario/moment boundaries):
Do **not** add mirror paragraphs before the next required question — no "I hear you — [long paraphrase]," **"I'm holding two things you said,"** **"help me see how you think about that,"** or cross-answer contradiction invites. Proceed to the **next required question** after check-before-asking.

**At scenario/moment boundaries:** follow **BOUNDARY CLOSURE** in the main framework (**segment close** first, then 1–2 sentence summary, then transition).

**Banned (stripped client-side when possible):** "I'm tracking you," inventory "I'm with you on… and …," procedural "continuing," hollow standalone "that makes sense / absolutely," meta-thanks as filler.

After Moment 4 (threshold answer): **one** closing message only (synthesis + thanks + [INTERVIEW_COMPLETE]) — full interview end (per main framework).
`;

const PER_REQUEST_REFLECTION_LOCK = `
─────────────────────────────────────────
ACTIVE TURN LOCK (read immediately before you write — this response only)
─────────────────────────────────────────
The participant's **last message** is their newest answer.

If your **next move** is a **scenario or moment boundary** (see main framework **BOUNDARY CLOSURE**), include **segment close** + **at most two sentences** of summary + transition + next content — **no** therapist-register reconciliation across fiction vs personal.

If your **next move** is **not** a boundary (mid-scenario follow-up, grudge→threshold only): **no** long paraphrase-mirror — go to the **next required question** per check-before-asking. **Never** verbalize tension between fiction (Scenario C) and personal answers in a reconcile frame.
`;

const THIN_RESPONSE_INSTRUCTIONS = `
THIN AND EVASIVE RESPONSES:

If the user says "I don't know", "not sure", or similar:

Do NOT ask them to say more. Do NOT ask "can you elaborate?" Instead, offer to help — ask if they'd like the scenario repeated or if anything is unclear.

Use phrases like:
- "Would it help to hear the scenario again?"
- "Is there anything about the situation that's unclear?"
- "No worries, want me to run through it again?"

If they say "yeah I guess" or give a very thin response after being offered help: Accept it and move on. One offer of help maximum. Do not push further.

If they say "no not really" or "nothing" to a question about one side of a scenario: Accept it immediately and move on. Do NOT ask them again. Do NOT say "what specifically stood out?" The user was clear.
`;

const NO_REPEAT_INSTRUCTIONS = `
GENERAL RULE — DO NOT REPEAT QUESTIONS:

After handling any edge case (skip request, score request, off-topic question, identity question, going back request, distress, pause request) — do NOT repeat the current question at the end of your response.

Trust the user to re-engage. The silence after your response is natural. Let them come back to the interview in their own time.

The only exception is explicit repeat requests — where the user specifically asks you to repeat something.
`;

const PAUSE_HANDLING_INSTRUCTIONS = `
PAUSE REQUESTS: If the user asks to pause or take a break, acknowledge warmly. Do not repeat the current question after responding.
`;

const DISTRESS_HANDLING_INSTRUCTIONS = `
DISTRESS: If the user shows distress, respond with care and warmth. Do not repeat the current question after responding.
`;

const MISUNDERSTANDING_HANDLING_INSTRUCTIONS = `
MISUNDERSTANDING — CURRENT FLOW:

Situations 1–3 are fixed fictional scenarios (see main instructions). Do not treat them as optional personal openings.

FACTUAL DETAIL POLICY:
If the user misremembers or misidentifies scenario details (who said what, wrong topic, wrong character detail), do NOT correct them mid-interview. Accept their response at face value and continue. Score relational quality, not factual recall.

MISPLACED ANSWERS RULE:
If the user answers a different question than the active one (for example: personal narrative during a scenario question, or commitment-threshold criteria while you're asking the grudge story), acknowledge briefly and redirect to the active question. Once they are re-oriented, ask the original active question again. Do not skip required questions because another moment was partially answered out of order.
Keep redirect language neutral and brief. Do NOT praise the misplaced answer (no "great answer for earlier question" style phrasing).

SCENARIO A — WRONG CONTENT TYPE FOR THE ACTIVE QUESTION:
If you asked the repair question ("How would you repair… as Ryan?") and the user answers with analysis of a specific line, contempt dynamics, or vignette interpretation instead of repair-as-Ryan, do not treat that as satisfying the repair prompt. Re-orient in one short clause **without** mirroring their analysis, then ask for repair in character — e.g. "Got it — how would you make that repair actually happen as Ryan?"
If you asked the contempt probe and they already gave contempt-probe-quality content in an earlier turn (hostile/dismissive read of Emma's line — not passive-aggressive-only or "stating a fact" minimization), treat the probe as satisfied — do not re-ask it; move on in the sequence.

PROBE ALREADY ANSWERED (ALL SCENARIOS):
Before any scripted follow-up, check whether the user's prior turns in this scenario already substantively answered that follow-up. If yes, skip the follow-up and advance.

Exception — Scenario B structural Q2: The "what could James have done differently before the fight" question is mandatory after Q1 (and after the optional appreciation branch when it fires). Do not skip it because Q1 already mentioned James's alternatives in passing — only skip if the user's immediately preceding answer already fully addressed that exact prompt. **No** mandatory mirror of Q1 before Q2.

PERSONAL MOMENT 4: After the user gives a personal response, check whether it addresses the grudge/dislike question. If it doesn't, redirect ONCE — gently and without making the user feel wrong. Use SCENARIO_REDIRECT_QUESTIONS.

MOMENT 4 COMMITMENT THRESHOLD FOLLOW-UP RULE:
After the user's answer to the grudge/dislike question, you MUST ask the commitment-threshold follow-up **without** a leading paraphrase of their grudge story — threshold question only in that assistant turn (or threshold after any separate grudge chunk the model already sent).

MOMENT 4 TONE RULE:
If the user describes the other person with contemptuous character verdicts (e.g. "toxic", "selfish", "zero respect", "showed who they really are"), do not validate that verdict as truth. Keep your **next** lines neutral and procedural (next question only).

WHAT PERSONAL MOMENT 4 NEEDS:
- A real other person (or honest lack of one), what happened, where they are now — enough to hear contempt, criticism, or resolution.

If the user mentions a breakup, fight, or falling-out during Moment 4, that counts as on-topic. Probe for a concrete moment or their part in it if they stay abstract — do not treat breakups as "wrong topic."

If they stay vague after one redirect, accept and move on. Never name the construct being scored.

SCORING NOTE: Off-target personal content may still yield lower-confidence pillar signal; do not invent high confidence without evidence.
`;

const SCENARIO_REDIRECT_QUESTIONS = `
REDIRECT — FICTIONAL SCENARIOS 1–3:

These segments are always the Emma/Ryan, Sarah/James, and Sophie/Daniel vignettes — use only those character names; never invent or substitute names (e.g. "Reese"). Never use the participant’s own first name in place of Emma, Ryan, Sarah, James, Sophie, or Daniel in the vignettes. If the user goes far off-topic, acknowledge briefly and return to the scenario text — do not substitute a personal story for the fiction.

REDIRECT — PERSONAL MOMENT 4 (grudge / dislike):

If they stay purely abstract with no person or relationship, one gentle redirect: "I'm curious about a real person if one comes to mind — doesn't have to be a partner."
`;

const INVALID_SCENARIO_REDIRECT = `
REDIRECTING AN INVALID SCENARIO — ACKNOWLEDGE FIRST:

Before explaining what you're looking for, always acknowledge what the user just said in one short sentence. Use their actual words or a close echo. Then redirect.

FORMAT:
"[One sentence echo of what they said] — [what you're looking for instead]."

EXAMPLES:

User: "I procrastinate on work tasks all the time and then feel bad about it at the end of the week."
WRONG:
"I'm looking for a person you had a hard time with — can you think of someone?"
RIGHT:
"The work stress is real — for this question I'm curious about someone you held a grudge against or really struggled to like, if anyone comes to mind."

User: "I conflict with myself a lot about my life choices and whether I'm making the right decisions."
WRONG:
"I'm looking for a moment where it actually got tense between you and someone else."
RIGHT:
"That internal tension is its own thing — what I'm looking for here is a moment where it got heated between you and another person specifically. Does anything like that come to mind?"

User gave a long story about finances:
"I've had a lot of conflict with my finances recently, especially with unexpected bills and trying to budget for the future."
RIGHT:
"Financial stress is genuinely hard — for this one though I'm looking for a moment where things got tense between you and another person. Anything like that come to mind?"

RULES:
- Echo must use the user's actual subject (finances, gym, work tasks, internal conflict) — not a generic "that sounds difficult"
- One sentence only — don't over-validate
- Then redirect cleanly in one sentence
- Never say "I understand but..." — just echo and redirect
- Never say "that's not what I'm looking for" — frame it as what you ARE looking for, not what you're not

IMPORTANT:
This redirect policy is for off-topic content only. It is NOT for correcting factual mismatches about scenario details. If the user gets a detail wrong, do not correct it.
`;

const COMMUNICATION_QUESTION_CHECK = `
COMMUNICATION QUESTION — SKIP IF ANY WORDS GIVEN:

Before asking "What would those words actually sound like?" or any variation, run this check:

SKIP THE QUESTION if ANY of these are true:

✓ Response starts with "I'd say:" or "I would say:" followed by ANY content
✓ Response starts with "I'd tell" followed by content
✓ Response contains a direct quote in quotation marks of any length
✓ Response starts with a direct address to the character: "You made me feel...", "I hear you...", "That wasn't fair...", "I'm sorry...", "I was wrong...", "I should have..."
✓ Response is a first-person feeling/need statement: "I felt...", "I feel...", "I need...", "I want..." followed by 10+ words
✓ Response contains "I'd say that I..." followed by content
✓ Response is 40+ words and contains first-person language — this is almost certainly already the words

ASK THE QUESTION only if:
✗ Response describes an intention without words: "I would acknowledge her feelings" (no words given)
✗ Response describes an action without words: "I'd apologise" (no words given)
✗ Response is purely analytical: "James should have noticed she needed emotional presence before logistics"
✗ Response is very short and abstract: "I'd be honest with them"

WHEN IN DOUBT — SKIP IT.
It is better to skip this question when it wasn't needed than to ask it when the user already answered.

NEVER ask this question more than once per scenario question. If you already asked once, accept whatever the user says next and move on.

ANTI-FRUSTRATION RULE:
If the user shows any sign of frustration at being asked this ("I just told you", "I already said", "I gave you the words") — admit the mistake, quote back what they said, and move on immediately. Never ask for words a third time under any circumstances.
`;

const PUSHBACK_RESPONSE_INSTRUCTIONS = `
PUSHBACK — "I ALREADY TOLD YOU" / "I JUST SAID THAT":

When the user pushes back indicating you missed something they already said:

DO NOT say "I heard you" — you clearly didn't.
DO NOT say "You're right — I heard you" — this is dismissive.
DO NOT paraphrase or reinterpret what they said.

Instead, admit the mistake briefly and quote back what they actually said:

- "My mistake — you said '[quote their actual words back]'. [next question]"
- "Sorry — you already gave me that: '[quote back]'. [next question]"
- "You're right, my mistake. [quote back exactly]. [next question]"

The quote-back serves two purposes: (1) It proves you actually registered what they said. (2) It corrects any misrepresentation from the previous bad acknowledgment.

Keep it brief. Quote back their exact words (or a close paraphrase using their actual language). Then move on with the next question.

NEVER paraphrase in a way that reframes what they said. If they said "you always do this" — don't say "you'd call out the pattern." Use their words. If you cannot complete "The user said [direct quote]" using only their actual words, just say "my mistake" and move on without summarising.
`;

const SCENARIO_COMPLETE_TOKEN_INSTRUCTIONS = `
[SCENARIO_COMPLETE:N] TOKEN — MANDATORY SEQUENCE:

The token fires when that scenario's required questions are complete.

Required sequence (no end-of-scenario closing question):
- Scenario A: Q1, contempt probe unless Emma's "you've made that very clear" was already read as contemptuous/hostile/dismissive (not passive-aggressive-only, not "stating a fact" / venting-only minimizations), Q2.
- Scenario B: Q1; optional appreciation probe only when Q1 had no on-topic engagement with the scenario; mandatory Q2 (what James could have done differently before the fight); Q3 (repair as James); then **BOUNDARY CLOSURE** (segment close + reflection + transition) before Scenario C. Do not skip Q2 because Q1 was sophisticated. Before Q2, always include a one-sentence specific acknowledgment of Q1 — including short verdict-style analysis answers.
- Scenario C: **Q1 (Daniel line) always before Q2** — client enforces; never put Q2 or threshold in the same turn as the vignette without Q1. Then Q2, then commitment-threshold probe unless the user already gave irrecoverability / when-it's-not-workable criteria (repair-only Q2 is not enough).

Do NOT ask "anything you'd want me to know?" style closing checks at the end of scenarios.

After [SCENARIO_COMPLETE:N], transition naturally to the next segment.
`;


interface ScenarioScoreResult {
  scenarioNumber: number;
  scenarioName: string;
  pillarScores: Record<string, number | null>;
  pillarConfidence: Record<string, string>;
  keyEvidence: Record<string, string>;
  specificity: string;
  repairCoherenceIssue: string | null;
}

interface PersonalMomentScoreResult {
  momentNumber: 4;
  momentName: string;
  pillarScores: Record<string, number | null>;
  pillarConfidence: Record<string, string>;
  keyEvidence: Record<string, string>;
  summary: string;
  specificity: string;
}

function buildScenarioScoringPrompt(
  scenarioNumber: 1 | 2 | 3,
  transcript: Array<{ role: string; content: string; scenarioNumber?: number }>,
  commitmentThresholdFocusAnswer?: string | null,
  priorScenarioMentalizing?: { s1?: number; s2?: number } | null,
  scenario3RepairFocusAnswer?: string | null,
): string {
  const scenarioMeta = {
    1: {
      name: 'Scenario A (Emma/Ryan)',
      constructs:
        'mentalizing, accountability, contempt_recognition, contempt_expression, repair, attunement (score only these keys in this scenario JSON; contempt is split: recognition = identifying contemptuous dynamics in the vignette; expression = participant’s own framing of others per the CONTEMPT_EXPRESSION rubric in this prompt)',
      markerIds: [
        'mentalizing',
        'accountability',
        'contempt_recognition',
        'contempt_expression',
        'repair',
        'attunement',
      ] as const,
    },
    2: {
      name: 'Scenario B (Sarah/James)',
      constructs:
        'appreciation, attunement, mentalizing, repair, accountability, contempt_expression (per CONTEMPT_EXPRESSION rubric; omit contempt_recognition here)',
      markerIds: [
        'appreciation',
        'attunement',
        'mentalizing',
        'repair',
        'accountability',
        'contempt_expression',
      ] as const,
    },
    3: {
      name: 'Scenario C (Sophie/Daniel)',
      constructs:
        'regulation, repair, mentalizing, attunement, accountability, commitment_threshold, contempt_expression',
      markerIds: [
        'regulation',
        'repair',
        'mentalizing',
        'attunement',
        'accountability',
        'commitment_threshold',
        'contempt_expression',
      ] as const,
    },
  }[scenarioNumber];

  const transcriptForScenarioSlice =
    scenarioNumber === 3 ? sliceTranscriptBeforeScenarioCToPersonalHandoff(transcript) : transcript;
  const taggedSlice = transcriptForScenarioSlice.filter(
    (m) => typeof m.scenarioNumber === 'number' && m.scenarioNumber === scenarioNumber
  );
  const scoringSlice = taggedSlice.length >= 2 ? taggedSlice : transcriptForScenarioSlice;
  const turns = scoringSlice
    .map((m) => `${m.role === 'user' ? 'User' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');
  const ids = [...scenarioMeta.markerIds];
  const commitmentThresholdSoleSourceBlock =
    scenarioNumber === 3 && commitmentThresholdFocusAnswer?.trim()
      ? `
COMMITMENT_THRESHOLD SOLE SOURCE (Scenario C):
The participant first replied to the Daniel/Sophie commitment question with a personal narrative and was redirected. For the "commitment_threshold" marker ONLY, base the score and keyEvidence solely on the following answer about the fictional couple. Do not use unrelated personal narrative content from elsewhere in the transcript for commitment_threshold. Score all other markers using the full transcript as usual.

Authoritative answer for commitment_threshold:
"""${commitmentThresholdFocusAnswer.trim()}"""
`
      : '';
  const scenario3BeforeRepairExcerpt = extractScenario3UserCorpusBeforeRepairPrompt(
    transcript as ScenarioCorpusMessageSlice[]
  );
  const scenario3AfterRepairExcerpt =
    scenario3RepairFocusAnswer?.trim() ||
    extractScenario3UserCorpusAfterLastRepairPrompt(transcript as ScenarioCorpusMessageSlice[]);
  const scenario3RepairAccountabilityEvidenceBlock =
    scenarioNumber === 3 && (scenario3BeforeRepairExcerpt.trim() || scenario3AfterRepairExcerpt.trim())
      ? `
SCENARIO C — REPAIR & ACCOUNTABILITY EVIDENCE (use with REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED above):
- **Unprompted excerpt** (primary signal for repair & accountability in this slice — typically Q1 and prior user turns before the general repair prompt):
"""${scenario3BeforeRepairExcerpt.trim() || '(none)'}"""
- **Prompted excerpt** (supplementary — answer after "How do you think this situation could be repaired?" or equivalent; do not use commitment-threshold content for repair):
"""${scenario3AfterRepairExcerpt.trim() || '(none)'}"""
Score **repair** and **accountability** using the ~70% / ~30% unprompted/prompted weighting; tag **keyEvidence** as unprompted / prompted / both. Do not use the commitment-threshold follow-up for repair or accountability — that content is for commitment_threshold only.
`
      : '';
  const scenario3RepairIsolationCalibration =
    scenarioNumber === 3
      ? `
Scenario C — REPAIR isolated from COMMITMENT_THRESHOLD:
- Apply **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED** when scoring **repair** and **accountability** (combine unprompted + prompted excerpts per weighting; see Scenario C evidence block when present). Exit-only, incompatibility, or "when to leave" framing in the **threshold** answer must **not** raise repair or accountability; if prompted repair is thin or exit-heavy, keep repair in the **3–5** range even when a later threshold answer sounds relationally mature or workable.
- Score **commitment_threshold** only from threshold-targeted turns (see COMMITMENT_THRESHOLD sole-source block when present). Do not lift commitment_threshold from repair-logistics-only content unless it clearly states walk-away or irrecoverability criteria for Daniel/Sophie.
`
      : '';
  const scenario1ContemptCalibration =
    scenarioNumber === 1
      ? `
Scenario A — CONTEMPT (this slice — two keys):
- **contempt_recognition:** Whether they identify contemptuous or harsh dynamics in the fiction (Emma’s line, the exchange). Accurate reads of coldness, dismissal, shutting down, or relational sting support strong recognition scores. Generic hurt with no relational read → partial recognition is fine; do not require the word “contempt.”
- **contempt_expression:** Use only the **CONTEMPT_EXPRESSION** rubric in this prompt. Ordinary disapproval of **bad behavior** (rude, wrong, inconsiderate, dishonoring a *specific* act) is not the same as a **low (1–4)** expression score; those bands are for character attack, mockery, dehumanization, sweeping “who they are” verdicts. Score **contempt_expression** independently of **contempt_recognition**.
`
      : '';
  const scenario1MentalizingRepairCeiling =
    scenarioNumber === 1
      ? `
Scenario A (Emma/Ryan) — MENTALIZING & REPAIR: REAL-HUMAN 10 CEILING (this slice only):

Re-read SCORE CALIBRATION above: **10** = best a thoughtful real person could reasonably do here, with **no material gap**; **slice independence** — never cap this scenario lower because Scenario B or C might later look “even richer” in another transcript slice you are not scoring now.

MENTALIZING — examples of **complete** inference (when accurate to the vignette and prompts), not an exhaustive list:
- Naming an interactional pattern (e.g. demand–withdraw) that fits Emma/Ryan’s exchange.
- Reading contempt or harshness as functioning as a **bid for power or control** after **feeling powerless** (or an equivalent accurate relational read).
- Surfacing an **implicit or unspoken agreement about priorities** that was never openly negotiated, when the participant grounds it in the scenario.

When that level of inference is **accurate** and **sufficient for the moment** and you **cannot** name a meaningful perspective-taking omission, assign **10**. Use **9** only if you can state a **concrete minor gap**. **Do not** systematically assign **9** for “strong Scenario A” to reserve **10** for later scenarios — **forbidden**.

REPAIR (as Ryan) — apply **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED** for **repair** and **accountability** in this slice (unprompted ≈ Q1 / pre–repair-as-Ryan; prompted ≈ repair-as-Ryan). Examples of **ceiling-level** repair (when actually present in the user’s words), not a checklist:
- Owning not only the **incident** (e.g. the phone call) but the **pattern** it represents, with a **specific behavioral** commitment (not vague intent alone).
- **Correct sequencing** when present in the answer: e.g. clear ownership of Ryan’s part **before** or alongside addressing how Emma’s contempt or dismissal landed — without using that ordering as a pretext to score down when the answer already satisfies bilateral repair at ceiling.

When repair is **bilateral where appropriate**, **pattern-aware**, **behaviorally specific**, and **not** primarily deflected onto Emma’s failings (see Scenario A repair calibration below), assign **9–10**; **10** when there is **no meaningful omission** for this prompt. **Do not** withhold **10** because a hypothetical “even better” repair could exist or because Scenario B’s James repair might be longer.

**Forbidden:** Applying a standing one-point penalty to Scenario A mentalizing or repair relative to Scenario B/C, or capping at **9** to “leave room” on the scale across the interview.
`
      : '';
  const scenario2AccountabilityCalibration =
    scenarioNumber === 2
      ? `
Scenario B (Sarah/James) — ACCOUNTABILITY & REPAIR (unprompted vs. prompted):
- For **repair** and **accountability**, apply **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED**: unprompted = user turn(s) **before** the "if you were James, how would you repair" (or equivalent) prompt; prompted = repair-as-James. Weight unprompted ~70%; tag keyEvidence. Other markers in this slice use the full transcript as usual.

Scenario B (Sarah/James) — ACCOUNTABILITY CEILING (repair as James and comparable ownership turns in this slice):

NAMED CALIBRATION — **OWNERSHIP + "BUT I ALSO NEED THEM"** (accountability **6–7 maximum**; **not 8–10**):
When the user shows **genuine ownership** or care in an apology **and then** uses **"but I also need them to…"**, **"but I need Sarah to…"**, **"but they need to…"**, or **functionally equivalent** wording that **shifts responsibility back to the partner** right after the apology (making the partner's future behavior the hinge), treat that as **meaningful deflection**. **Cap accountability at 6–7.** **8+** requires **clean ownership without** that partner-conditional pivot.

Example (**6–7, not 8**): "I would tell Sarah I'm sorry she felt unappreciated — that wasn't my intention at all. I'd explain that I was asking about the practical stuff because I care about her future... but I also need her to be clearer with me about what she's looking for."

Contrast (often still **8+** when otherwise clean): ownership followed by a **specific information ask** so the user can follow through ("what would appreciation look like for you?") — see ACCOUNTABILITY — BLAME-SHIFT VS. GENUINE REQUEST FOR CLARITY.
`
      : '';
  const scenario2ContemptExpressionCalibration =
    scenarioNumber === 2
      ? `
Scenario B (Sarah/James) — CONTEMPT_EXPRESSION (this slice):
Apply the **CONTEMPT_EXPRESSION** rubric. Judge how the participant talks in their own voice about Sarah, James, or the situation. Fiction is not a free pass to **character demolition** (idiot, loser, “what a piece of @#!,” “toxic *person*” as a global smear) — that still maps to the **low (1–4)** expression bands. Fair moral or fairness language about **actions** in the story can still fall in **mid (5–7)** or **high (8–10)** per the rubric. Keep this key separate from appreciation, repair, and accountability.
`
      : '';
  const scenario2AttunementAppreciationCalibration =
    scenarioNumber === 2
      ? `
${SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS}
`
      : '';
  const scenario3ContemptExpressionCalibration =
    scenarioNumber === 3
      ? `
Scenario C (Sophie/Daniel) — CONTEMPT_EXPRESSION (this slice):
Apply the **CONTEMPT_EXPRESSION** rubric. Harsh labels **tied to specific on-vignette behavior** (e.g. avoidant here, shut her down, inconsiderate in that moment) differ from **low (1–4)** character contempt (broad smears, dehumanization, “pathetic,” “loser” toward the person as such). Distinguish moral judgment of **actions** from global **person** derogation. Distinct from mentalizing quality alone.
`
      : '';
  const scenario3CommitmentCalibration =
    scenarioNumber === 3
      ? `
Scenario C commitment-threshold calibration:
- Score 1-2 when the answer exits at first difficulty or endorses staying no matter what with no limits in harmful dynamics.
- Score 2-3 when the answer expresses unconditional commitment with no framework for irrecoverability — e.g. "never give up," "just keep trying no matter what," "they shouldn't ever walk away," "stick it out forever." Do not score that pattern 6+.
- Score 3-4 for vague "keep trying" with no assessable structure, OR exit-only framing ("life is too short") without effort/communicate/assess logic.
- Score 6-7 when the answer has a complete structure for Daniel/Sophie (or the couple): genuine effort, clear communication about what's wrong, reassessment, willingness to end if the pattern persists without change — even if the user names no timelines, therapy, or step lists.
- Score 7-8 when that structure is present plus some concrete specificity about what would make the relationship no longer workable (not necessarily exhaustive).
- Score 9-10 only when the answer strongly demonstrates or describes persistence through serious difficulty with healthy limits; still not gated on procedural verbosity.
- Do not cap commitment_threshold below 6 solely because the answer lacks granular process detail when the four-part structure is clearly there.
- If the answer (about Daniel/Sophie) **explicitly** distinguishes unhealthy persistence from justified boundaries, fear-driven staying from irrecoverability, or "when it's actually over" vs "when someone is just conflict-avoidant," treat that as **sound threshold reasoning** (typically **6–8+**), not as unconditional staying. Same logic as first-person self-awareness anchors in SCORE CALIBRATION.

COMMITMENT_THRESHOLD — NOT ASSESSED (Scenario C):
If this slice has no user response to the interviewer's commitment-threshold follow-up (when the relationship isn't working / when to call it) AND no user turn in Scenario C spontaneously gives irrecoverability or "not worth continuing" criteria, set pillarScores.commitment_threshold to JSON null — never 0. Set keyEvidence.commitment_threshold to exactly: "No commitment threshold content assessed in this scenario slice." Set pillarConfidence.commitment_threshold to "low". Use numeric scores only when there is actual threshold content to evaluate; 0 is reserved for assessed answers that actively fail the construct, not for missing evidence.

COMMITMENT_THRESHOLD CONFIDENCE (this scenario slice only):
When commitment_threshold is scored (non-null), evidence is third-party reasoning about Daniel/Sophie only. Set pillarConfidence for commitment_threshold to "moderate" or "low" only — never "high" for this scenario, because personal first-person threshold criteria are not elicited in this moment. (Full-interview scoring may raise effective confidence later if Moment 4 adds first-person threshold evidence.) When commitment_threshold is null, confidence is already "low" per above.
`
      : '';
  const scenario3MentalizingCalibration =
    scenarioNumber === 3
      ? `
Scenario C mentalizing calibration:
- Accurately noting an obvious on-vignette dynamic (e.g. Daniel acknowledging a communication problem or taking partial responsibility for avoidance) is competent basic perspective-taking, not strong mentalizing by itself: prefer the 5-6 range unless the answer adds clearly richer inference (Sophie's inner experience beyond the script, bilateral curiosity about both people's states, nuanced uncertainty).
- Reserve 7+ only when mentalizing in this answer is markedly more sophisticated than restating what the situation already displayed.
`
      : '';
  const priorM1 = priorScenarioMentalizing?.s1;
  const priorM2 = priorScenarioMentalizing?.s2;
  const scenario3MentalizingInterviewPatternCalibration =
    scenarioNumber === 3 &&
    priorScenarioMentalizing &&
    ((priorM1 != null && Number.isFinite(priorM1) && priorM1 < 4) ||
      (priorM2 != null && Number.isFinite(priorM2) && priorM2 < 4))
      ? `
Scenario C mentalizing — interview pattern calibration:
Prior mentalizing scores in this same interview: Scenario 1 = ${priorM1 != null && Number.isFinite(priorM1) ? priorM1.toFixed(1) : 'n/a'}, Scenario 2 = ${priorM2 != null && Number.isFinite(priorM2) ? priorM2.toFixed(1) : 'n/a'}.
Earlier scenario(s) showed limited mentalizing. Do not assign Scenario C mentalizing 7+ for a single balanced observation that merely labels what the vignette made visible (e.g. "Daniel is acknowledging they have a communication problem") without clearly stronger perspective-taking. In that pattern, 5-6 is appropriate for that level of evidence. Reserve 7+ only if this answer demonstrates a clear step up in sophistication versus those prior moments.
`
      : '';

  return `You are scoring a single scenario from a relationship assessment interview.

SCENARIO: ${scenarioMeta.name}
MARKERS TO SCORE IN THIS SLICE: ${scenarioMeta.constructs}

${SCORE_CALIBRATION_0_10}
${CONTEMPT_EXPRESSION_SCORING_RUBRIC}

TRANSCRIPT OF THIS SCENARIO ONLY:
${turns}
${commitmentThresholdSoleSourceBlock}
${scenario3RepairAccountabilityEvidenceBlock}

SCORING INSTRUCTIONS:
Score only the listed markers, based only on this transcript slice.
For each marker: quote or paraphrase the response that most informed the score; behavioral > attitudinal.
GENERIC responses: cap at 5 for that marker.

**This slice only:** Do not down-rank a marker here because another scenario in the same interview might show stronger evidence later, or to keep scores “spread out.” Each slice stands on its own.

${ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST}

${REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING}
${REPAIR_CONDITIONAL_AND_PROMPTED_SCORING}

MENTALIZING and CONTEMPT (where scored) — register-neutral: Judge perspective-taking quality and, for Scenario A, score **contempt_recognition** vs **contempt_expression** **separately** (see Scenario A block). **contempt_recognition** = identifying harsh or contemptuous **dynamics** in the vignette (in others) — unchanged. **contempt_expression** = *only* the **CONTEMPT_EXPRESSION** rubric above: do **not** treat ordinary moral or fairness language about harmful **actions** (rude, wrong, hurtful, disrespectful, “dishonoring *her in that moment*,” inconsiderate) as automatic **low (1–4)** participant expression. Do not down-score formal language when the inference is accurate for mentalizing; **contempt_expression** is about the participant’s **stance** toward *people* in the slice, not about accuracy of vignette reads.

REPAIR COHERENCE: If repair attempt repeats the failure they diagnosed, lower accountability 1-2 points.
Scenario A repair calibration:
- For **repair** and **accountability**, apply **REPAIR & ACCOUNTABILITY — UNPROMPTED VS. PROMPTED**: unprompted = user turn(s) before the repair-as-Ryan prompt; prompted = the "if you were Ryan … repair" answer. Tag keyEvidence. For **repair** only, also apply **REPAIR — CONDITIONAL LANGUAGE, DIRECTIONALITY, AND PROMPTED FLOORS** (directionality: self-owning "if" vs blame-redirect).
- If the repair answer **redirects fault to Emma** (e.g. "Emma needs to communicate better" as the main move, or **"I would apologize if she had just been clearer"** in a way that makes her the problem), score **repair** in the 4-5 range. **Do not** use **"if she doesn't communicate it well"**-style **conditionals alone** as deflection: if the clause **leads into** the respondent’s **own** limits, learning, and ownership (see directionality block), that can support **6+** and often **7–8** for **repair** on the prompted turn.
- Reserve 6+ for answers that keep Ryan’s contribution and repair move **central** (including humbly naming **one’s own** listening/understanding limits with **her** in the room).
- Reserve 9-10 for strong repair with explicit ownership and no **blame-redirecting** conditional (per directionality), not 9-10 for mere absence of the word "if."
${scenario1ContemptCalibration}
${scenario1MentalizingRepairCeiling}
${scenario2AccountabilityCalibration}
${scenario2ContemptExpressionCalibration}
${scenario2AttunementAppreciationCalibration}
${scenario3ContemptExpressionCalibration}
${scenario3RepairIsolationCalibration}
${scenario3CommitmentCalibration}
${scenario3MentalizingCalibration}
${scenario3MentalizingInterviewPatternCalibration}

CONFIDENCE: high / moderate / low per scored marker.
${SCORING_CONFIDENCE_INSTRUCTIONS}

Return ONLY valid JSON:
{
  "scenarioNumber": ${scenarioNumber},
  "scenarioName": "${scenarioMeta.name}",
  "pillarScores": { ${ids.map((id) => `"${id}": 0`).join(', ')} },
  "pillarConfidence": { ${ids.map((id) => `"${id}": "high"`).join(', ')} },
  "keyEvidence": { ${ids.map((id) => `"${id}": ""`).join(', ')} },
  "specificity": "high",
  "repairCoherenceIssue": null
}`;
}

/** Fixed column order for scenario scorecards so unassessed markers (e.g. commitment_threshold) still show as — */
const SCENARIO_SCORE_DISPLAY_ORDER: Record<number, readonly string[]> = {
  1: ['mentalizing', 'accountability', 'contempt_recognition', 'contempt_expression', 'repair', 'attunement'],
  2: ['appreciation', 'attunement', 'mentalizing', 'repair', 'accountability', 'contempt_expression'],
  3: [
    'regulation',
    'repair',
    'mentalizing',
    'attunement',
    'accountability',
    'commitment_threshold',
    'contempt_expression',
  ],
};

function formatScoreMessage(scenarioResult: ScenarioScoreResult): string {
  const label = (id: string) =>
    SLICE_ONLY_MARKER_LABELS[id] ??
    INTERVIEW_MARKER_LABELS[id as keyof typeof INTERVIEW_MARKER_LABELS] ??
    id;
  const order =
    SCENARIO_SCORE_DISPLAY_ORDER[scenarioResult.scenarioNumber] ??
    Object.keys(scenarioResult.pillarScores ?? {});
  const scores = order
    .map((id) => {
      const raw = scenarioResult.pillarScores?.[id];
      const scoreText = typeof raw === 'number' && Number.isFinite(raw) ? `${raw}/10` : '—';
      const confRaw = scenarioResult.pillarConfidence[id] ?? 'moderate';
      const confidence = confRaw === 'not_assessed' ? 'not assessed' : confRaw;
      const evidence = scenarioResult.keyEvidence[id] ?? '—';
      return `${label(id)}: ${scoreText} (${confidence} confidence)\n   "${evidence}"`;
    })
    .join('\n\n');
  const flags: string[] = [];
  if (scenarioResult.specificity === 'low') {
    flags.push('⚠ Generic responses — no specificity after clarification');
  }
  if (scenarioResult.repairCoherenceIssue) {
    flags.push(`⚠ Repair coherence: ${scenarioResult.repairCoherenceIssue}`);
  }
  return [
    `── Scenario ${scenarioResult.scenarioNumber}: ${scenarioResult.scenarioName} ──`,
    scores,
    flags.length > 0 ? flags.join('\n') : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

const CONSTRUCTS = [
  { id: 1, label: 'Mentalizing', color: colors.error },
  { id: 2, label: 'Accountability', color: colors.success },
  { id: 3, label: 'Contempt / Criticism', color: '#B85C5C' },
  { id: 4, label: 'Repair', color: colors.primary },
  { id: 5, label: 'Emotional Regulation', color: '#8B3A5C' },
  { id: 6, label: 'Attunement', color: '#0D6B6B' },
  { id: 7, label: 'Appreciation', color: '#2A5C5C' },
  { id: 8, label: 'Commitment Threshold', color: '#6B5CB8' },
  { id: 'CQ', label: 'Communication Quality', color: '#5A4A8A' },
];

/** Maps transcript cues to CONSTRUCTS id 1–7 for flame orb hints. */
function detectConstructs(text: string): number[] {
  const t = text.toLowerCase();
  const hits = new Set<number>();
  const hit = (id: number, re: RegExp) => {
    if (re.test(t)) hits.add(id);
  };
  hit(1, /wonder if|maybe (he|she|they) felt|their perspective|epistem|don't know what|intent|mentaliz/i);
  hit(2, /my part|i should have|i was wrong|deflect|excuse|not my fault|accountab|ownership|justify/i);
  hit(3, /contempt|disgust|pathetic|i would never|always does|never does|mock|inferior|beneath me/i);
  hit(4, /repair|reconnect|rupture|make it right|sorry|apolog|own my|follow through.*repair/i);
  hit(5, /flood|overwhelm|stonewall|shut down|walked out|needed space|cool down|regulat|flooded/i);
  hit(6, /noticed|picked up|attun|bid|they seemed|sensed|without (being )?told/i);
  hit(7, /appreciat|celebrat|proud of|grateful|what (he|she|they) did well|valued/i);
  hit(8, /not working|irrecover|fundamental incompatib|deal[- ]?breaker|leave|walk away|keep trying|persist|commitment threshold|when to end/i);
  return [...hits];
}

/** Resume / replay helper lines — must not appear as reference-card modal text or repeat target. */
function isResumeOrScenarioReplayUiPrompt(content: string): boolean {
  const t = content.trim().toLowerCase();
  if (!t) return false;
  return (
    /\b(would it help to (hear|repeat|go over)\s+(the\s+)?scenario\s+again)\b/.test(t) ||
    /\b(would you like me to repeat|if you'd like me to repeat what i said)\b/.test(t) ||
    /\b(i can repeat it or continue|feel free to respond whenever you're ready)\b/.test(t)
  );
}

/** Returns the last real assistant message before the session ended, excluding score cards (for resume welcome). */
function extractLastInterviewerMessage(messages: Array<{ role: string; content: string; isScoreCard?: boolean; isWelcomeBack?: boolean }> | null): string | null {
  if (!messages || messages.length === 0) return null;
  const assistantMessages = messages
    .filter((m) => m.role === 'assistant' && !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack)
    .reverse();
  for (const msg of assistantMessages) {
    const content = (msg.content ?? '').trim();
    if (!content) continue;
    if (isResumeOrScenarioReplayUiPrompt(content)) continue;
    return content;
  }
  return null;
}

/** After re-entry prompt: user wants verbatim replay vs continue without replay. Ambiguous → repeat (more context). */
function classifyResumeRepeatIntent(text: string): 'repeat' | 'continue' | 'ambiguous' {
  const t = text.trim().toLowerCase();
  if (!t) return 'ambiguous';
  const repeatHints =
    /\b(yes|yeah|yep|sure|please|ok|okay|repeat|again|say it|remind|recap|tell me (again|one more)|what you (just )?said|last said|re-?say|replay|hear (it |that )?again)\b/;
  /**
   * Do **not** use a bare `don't` — it matches narrative ("I don't trust them") and wrongly routes to
   * `continue` → early return with no LLM reply (see resume gate in `processUserSpeech`).
   */
  const continueHints =
    /\b(no|nope|nah|continue|skip|i'?m good|(i am|we'?re) good|ready|go on|let'?s (go|continue)|keep going|don'?t\s+need|don'?t\s+want|don'?t\s+repeat|no thanks|i remember|we can continue|move on|next)\b/;
  const wantsRepeat = repeatHints.test(t);
  const wantsContinue = continueHints.test(t);
  if (wantsRepeat && wantsContinue) return 'ambiguous';
  if (wantsRepeat) return 'repeat';
  if (wantsContinue) return 'continue';
  return 'ambiguous';
}

function looksLikeRepeatCueInAmbiguousReply(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /\b(said|you said|what you said|say that|said that|again)\b/.test(t);
}

function looksLikeDirectResumeAnswer(userText: string, lastQuestionText: string | null): boolean {
  const t = userText.trim();
  if (!t) return false;
  const lowered = t.toLowerCase();
  const words = lowered.split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  const metaOnly =
    /\b(repeat|again|continue|ready|i'?m good|im good|no thanks|yes please|say that again|what did you say)\b/i;
  if (metaOnly.test(lowered)) return false;
  const hasAnswerShape =
    /\b(i|we|he|she|they|because|would|should|could|if|when|then|feel|felt|think|believe|probably|maybe)\b/i.test(
      lowered
    );
  if (!hasAnswerShape) return false;
  const lastQ = (lastQuestionText ?? '').toLowerCase().trim();
  if (!lastQ) return words.length >= 8;
  const stop = new Set([
    'what', 'when', 'where', 'which', 'would', 'could', 'should', 'have', 'from', 'with', 'that', 'this', 'your',
    'their', 'about', 'into', 'just', 'then', 'than', 'them', 'they', 'been', 'were', 'because', 'there', 'after',
    'before', 'while', 'ready', 'continue', 'repeat', 'said', 'last', 'like', 'does', 'did', 'feel', 'felt',
  ]);
  const qTokens = lastQ
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stop.has(w));
  if (qTokens.length === 0) return words.length >= 8;
  const overlap = qTokens.filter((w) => lowered.includes(w)).length;
  return overlap >= 1;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'recording';
type Status = 'intro' | 'starting_interview' | 'active' | 'scoring' | 'results';

interface CommunicationQuality {
  ownershipLanguage: number;
  blameJudgementLanguage: number;
  empathyInLanguage: number;
  owningExperience: number;
  communicationSummary?: string;
}

interface InterviewResults {
  pillarScores: Record<string, number>;
  keyEvidence?: Record<string, string>;
  pillarConfidence?: Record<string, string>;
  communicationQuality?: CommunicationQuality;
  narrativeCoherence?: string;
  behavioralSpecificity?: string;
  notableInconsistencies?: string[];
  interviewSummary?: string;
  gateResult?: GateResult;
  skepticismModifier?: { pillarId: number | string | null; adjustment: number; reason?: string };
}

const ANTHROPIC_API_KEY = getPublicEnv('EXPO_PUBLIC_ANTHROPIC_API_KEY', 'anthropicApiKey');
const ANTHROPIC_PROXY_URL = getResolvedAnthropicProxyUrl();
const SUPABASE_ANON_KEY = getResolvedSupabaseAnonKey();
const OPENAI_API_KEY =
  getPublicEnv('EXPO_PUBLIC_OPENAI_API_KEY', 'openaiApiKey');
const OPENAI_WHISPER_PROXY_URL =
  getResolvedWhisperProxyUrl();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa === 'function') return btoa(binary);
  return '';
}

function newInterviewSessionId(userId: string): string {
  return `${userId || 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Navigation lock: set when interview completes and we navigate to analysis; prevents other effects from overriding. Survives remount. */
let interviewJustCompletedInSession = false;
/** Latest attempt id written in this session — avoids stale `users.latest_attempt_id` when the profile refetch races the update. */
let interviewLastCommittedAttemptId: string | null = null;
/** Web gesture TTS queue: mirrors `pendingWebSpeechForGestureRef` so React Strict Mode remount does not drop queued text. */
let pendingWebSpeechForGestureModule: string | null = null;

const WEB_GESTURE_TTS_STORAGE_KEY = 'aria_v1_pending_gesture_tts';

function readStoredPendingGestureTts(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(WEB_GESTURE_TTS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setPendingWebSpeechGesturePair(ref: React.MutableRefObject<string | null>, text: string) {
  ref.current = text;
  pendingWebSpeechForGestureModule = text;
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
    body: JSON.stringify({
      sessionId: 'c61a43',
      hypothesisId: 'H3',
      location: 'AriaScreen.tsx:setPendingWebSpeechGesturePair',
      message: 'pending_gesture_tts_queued',
      data: { pendingLen: text.length, pendingPreview: text.slice(0, 140) },
      timestamp: Date.now(),
      runId: 'pre-fix',
    }),
  }).catch(() => {});
  // #endregion
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(WEB_GESTURE_TTS_STORAGE_KEY, text);
  } catch {
    /* private mode / quota */
  }
}
function clearPendingWebSpeechGesturePair(ref: React.MutableRefObject<string | null>) {
  ref.current = null;
  pendingWebSpeechForGestureModule = null;
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(WEB_GESTURE_TTS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
function peekPendingWebSpeechGesture(ref: React.MutableRefObject<string | null>): string | null {
  return ref.current ?? pendingWebSpeechForGestureModule ?? readStoredPendingGestureTts();
}

function classifyInterviewQuestionType(
  text: string
): 'analysis' | 'repair' | 'probe' | 'personal' | 'unknown' {
  const t = (text ?? '').toLowerCase();
  if (!t.trim()) return 'unknown';
  if (/personal|tell me about yourself|your childhood|private|intimate/.test(t)) return 'personal';
  if (/tell me more|what exactly|can you give an example|go deeper/.test(t)) return 'probe';
  if (/sorry|apolog|repair|make up|fix this|make amends/.test(t)) return 'repair';
  if (/score|pillar|evidence|pattern across|marker/.test(t)) return 'analysis';
  return 'unknown';
}

type RecordingDelayMeasurement = { modeCompleteAtMs: number; recordingInitializedAtMs: number };

/**
 * Standard (non–alpha, non–admin) applicants: always land on the 48h processing screen after completion.
 * Pass/fail branded screens open only after the hold (or an admin `override_status` on the attempt).
 */
function replaceWithStandardApplicantProcessingHandoffForUser(
  navigation: { replace: (name: string, params: { userId: string }) => void },
  userId: string,
) {
  navigation.replace('PostInterviewProcessing', { userId });
}

function recordingDelayMsFromRef(
  ref: React.MutableRefObject<RecordingDelayMeasurement | null>,
  tapIntentAtMs: number
): number {
  const p = ref.current;
  if (p == null) return Date.now() - tapIntentAtMs;
  return p.recordingInitializedAtMs - p.modeCompleteAtMs;
}

export const AriaScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { user, signOut } = useAuth();
  const userId = (route.params as { userId?: string } | undefined)?.userId ?? user?.id ?? '';
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  /** Main interview route in the app stack (`Aria`) or legacy `OnboardingInterview`. */
  const isInterviewAppRoute = route?.name === 'Aria' || route?.name === 'OnboardingInterview';
  const [messages, setMessages] = useState<{ role: string; content: string; isScoreCard?: boolean }[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const voiceStateRef = useRef<VoiceState>(voiceState);
  voiceStateRef.current = voiceState;
  /** Gentle idle hint when TTS finished long ago and user has not tapped record yet (visual only). */
  const [lateStartIdleCueVisible, setLateStartIdleCueVisible] = useState(false);
  /** Pre-interview (`intro`) before `startInterview`; `starting_interview` is only for mic-retry / legacy auto-start paths. */
  const [status, setStatus] = useState<Status>(() => 'intro');
  /** Onboarding: auto-run startInterview once after profile gate; reset on retake / retry. */
  const onboardingAutoStartRef = useRef(false);
  /**
   * Web: autoplay policy requires a user gesture before audio/TTS. We never auto-call `startInterview` from
   * useEffect on web — mobile uses the tap overlay; desktop waits for the first `pointerdown` (see effect below).
   * Consent / manual Start passes `fromUserGesture` into `startInterview`.
   */
  const [mobileWebTapToBeginDone, setMobileWebTapToBeginDone] = useState(() => Platform.OS !== 'web');
  /** Desktop web only: show tap-to-unlock overlay when session cannot auto-start (e.g. cold refresh). Hidden when userActivation allows auto-start (e.g. after Sign in). */
  const [webDesktopAwaitingStartOverlay, setWebDesktopAwaitingStartOverlay] = useState(false);
  /** Desktop web only: TTS queued for user gesture (autoplay blocked mid-session). */
  const [webDesktopPendingTtsGestureOverlay, setWebDesktopPendingTtsGestureOverlay] = useState(false);
  /** After tab was hidden, next web TTS must run inside a fresh user gesture (autoplay policy). */
  const needsGestureRestoreRef = useRef(false);
  /** Set when we detect gesture context may be lost (e.g. tab hidden); consumed on next `tts_playback_start` log. */
  const gestureContextLostAtRef = useRef<{ atMs: number; reason: GestureContextLostReason } | null>(null);
  /** Cleared after logging `gesture_context_lost_reason` for tab visibility. */
  const tabVisibilityGestureLossPendingRef = useRef(false);
  const pendingGestureRestoreSpeakRef = useRef<{
    text: string;
    options: {
      silent?: boolean;
      interviewSpeechRole?: 'assistant_response';
      telemetrySource?: TtsTelemetrySource;
      skipQuestionDeliveredTelemetry?: boolean;
      skipInterviewSpeechAdvance?: boolean;
      skipQuestionTiming?: boolean;
      skipLastQuestionRef?: boolean;
      skipGestureGate?: boolean;
      ttsTriggerSource?:
        | 'gesture_handler'
        | 'effect'
        | 'callback'
        | 'timeout'
        | 'preauthorized_element';
      immediateWebPlaybackElement?: HTMLAudioElement;
    };
    resolve: () => void;
    reject: (reason?: unknown) => void;
  } | null>(null);
  const [webTabGestureRestoreOverlay, setWebTabGestureRestoreOverlay] = useState(false);
  const ttsScreenReadyRef = useRef(false);
  const pendingTtsGateResolversRef = useRef<Array<() => void>>([]);
  const pendingScreenReadyResolversRef = useRef<Array<() => void>>([]);
  const resumeLoadingFlowActiveRef = useRef(false);
  const [resumeLoadingVisible, setResumeLoadingVisible] = useState(false);
  /** Next `recording_start` after VAD-gate bypass no-speech path should log `recording_restarted_after_vad_bypass`. */
  const pendingRecordingRestartAfterVadBypassRef = useRef(false);
  const takeRecordingStartEventDataWithVadBypassRestart = () => {
    const base = gatherRecordingStartTelemetry();
    if (pendingRecordingRestartAfterVadBypassRef.current) {
      pendingRecordingRestartAfterVadBypassRef.current = false;
      return { ...base, recording_restarted_after_vad_bypass: true as const };
    }
    return base;
  };
  const [touchedConstructs, setTouchedConstructs] = useState<number[]>([]);
  const [results, setResults] = useState<InterviewResults | null>(null);
  const [stageResults, setStageResults] = useState<Array<{ stage: number; results: InterviewResults }>>([]);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [micSessionRecovering, setMicSessionRecovering] = useState(false);
  const [micNeedsReconnect, setMicNeedsReconnect] = useState(false);
  const lastAudioRouteFingerprintRef = useRef<string | null>(null);
  const lastHeadphoneProbeRef = useRef<HeadphoneProbeResult | null>(null);
  /** Web: route changed while MediaRecorder was active — attach to next `response_received` for scoring weighting. */
  const routeChangedDuringRecordingRef = useRef(false);
  const audioRecorderIsRecordingForRouteRef = useRef(false);
  const [micWarning, setMicWarning] = useState<string | null>(null);
  /** Pre-interview consent — both required before Begin interview. */
  const [preInterviewConsentAge, setPreInterviewConsentAge] = useState(false);
  const [preInterviewConsentData, setPreInterviewConsentData] = useState(false);
  /** Supabase interview_attempts row — created at screen mount (before TTS) when possible. */
  const [interviewAttemptBootstrap, setInterviewAttemptBootstrap] = useState<
    'idle' | 'loading' | 'ready' | 'failed'
  >('idle');
  const [typedAnswer, setTypedAnswer] = useState('');
  const scoredScenariosRef = useRef<Set<number>>(new Set());
  const [scenarioScores, setScenarioScores] = useState<Record<number, ScenarioScoreResult>>({});

  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [interviewStatus, setInterviewStatus] = useState<'loading' | 'not_started' | 'in_progress' | 'preparing_results' | 'under_review' | 'congratulations' | 'analysis'>('loading');
  const [analysisAttemptId, setAnalysisAttemptId] = useState<string | null>(null);
  /** Insert succeeded but interview_attempts row is not yet readable with full scores — stay on preparing_results and poll until ready before congratulations / results. */
  const [pendingScoringSyncAttemptId, setPendingScoringSyncAttemptId] = useState<string | null>(null);
  /** Bumps on an interval while UI shows "Preparing your results" so `checkInterviewStatus` re-runs until handoff. */
  const [preparingHandoffPollTick, setPreparingHandoffPollTick] = useState(0);
  const isInterviewCompleteRef = useRef(false);
  /** Set after closing-line TTS is awaited; effect after `scoreInterview` moves to preparing_results when `voiceState` is idle. */
  const [pendingCompletion, setPendingCompletion] = useState(false);
  const pendingCompletionTranscriptRef = useRef<{ role: string; content: string }[] | null>(null);
  const committedScenarioRef = useRef<ActiveScenario | null>(null);
  type InterviewUiPhase = 'pre_scenario' | 'scenario_transitioning' | 'scenario_active';
  const [interviewUiPhase, setInterviewUiPhase] = useState<InterviewUiPhase>('pre_scenario');
  const [referenceCardScenario, setReferenceCardScenario] = useState<ActiveScenario | null>(null);
  const [referenceCardPrompt, setReferenceCardPrompt] = useState<string | null>(null);
  const [scenarioIntroTtsPlaying, setScenarioIntroTtsPlaying] = useState(false);
  const [tTSFallbackActive, setTTSFallbackActive] = useState(false);
  /** HTTP://LAN is not a secure context — browser blocks mic; show fix copy */
  const [webInsecureContextMessage, setWebInsecureContextMessage] = useState<string | null>(null);
  const pendingWebSpeechForGestureRef = useRef<string | null>(null);
  /** Web: onPressIn/touchstart ran gesture-TTS this touch; skip onPress so we do not start recording on the same tap. */
  const webGestureTtsConsumedPressRef = useRef(false);
  /** Web: mic pressed while idle with pending interviewer TTS — start recording after that audio finishes (one press, not two). */
  const pendingMicStartAfterIdleFlushRef = useRef(false);
  const webGestureConsumeClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Web: one-shot window listener flushes blocked TTS on any pointerdown (not mic-only). */
  const webGestureFlushListenerAttachedRef = useRef(false);
  const webGestureFlushHandlerRef = useRef<(() => void) | null>(null);
  type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable';
  const [micPermission, setMicPermission] = useState<MicPermissionState>('prompt');

  const logTtsGateState = useCallback(
    (state: 'held' | 'released', reason: string, pendingCount: number) => {
      if (!userId) return;
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'tts_playback_gate',
        eventData: {
          tts_gate: state,
          reason,
          pending_count: pendingCount,
        },
        platform: r.platform,
      });
    },
    [userId],
  );

  const awaitTtsScreenReadyGate = useCallback(
    async (reason: string) => {
      if (ttsScreenReadyRef.current) return;
      logTtsGateState('held', reason, pendingTtsGateResolversRef.current.length + 1);
      await new Promise<void>((resolve) => {
        pendingTtsGateResolversRef.current.push(resolve);
      });
    },
    [logTtsGateState],
  );

  const awaitScreenReadySignal = useCallback(async () => {
    if (ttsScreenReadyRef.current) return;
    await new Promise<void>((resolve) => {
      pendingScreenReadyResolversRef.current.push(resolve);
    });
  }, []);

  const logSessionResumeState = useCallback(
    (state: 'loading' | 'ready') => {
      if (!userId) return;
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'session_resume',
        eventData: { session_resume: state },
        platform: r.platform,
      });
    },
    [userId],
  );

  const recognitionRef = useRef<{ start(): void; stop(): void } | null>(null);
  const transcriptAtReleaseRef = useRef('');
  const isSpeakingRef = useRef(false);
  // Web: Whisper proxy URL is for transcription (CORS); do not use it to choose tap vs hold — mobile Safari always has MediaRecorder.
  // Auth: anon key or session token in transcribeSafe — do not gate on EXPO_PUBLIC_OPENAI_API_KEY (CORS blocks direct OpenAI).
  const useWhisperOnWeb = Platform.OS === 'web' && !!OPENAI_WHISPER_PROXY_URL;
  const webTapRecordingSupported =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    typeof MediaRecorder !== 'undefined';
  /** Native expo-av or web MediaRecorder — actual blob recording. If false on web, fall back to SpeechRecognition (still tap UI). */
  const useMediaRecorderPath = Platform.OS !== 'web' || webTapRecordingSupported;
  /** Interview mic is always tap-to-speak / tap-to-stop (web without MediaRecorder uses SpeechRecognition with tap). */
  const useTapMicUi =
    Platform.OS !== 'web' || useMediaRecorderPath || Platform.OS === 'web';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!isWebInsecureDevUrl()) return;
    setWebInsecureContextMessage(webInsecureContextHelpMessage());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const releaseGate = () => {
      if (cancelled || ttsScreenReadyRef.current) return;
      ttsScreenReadyRef.current = true;
      const pending = pendingTtsGateResolversRef.current.splice(0, pendingTtsGateResolversRef.current.length);
      const pendingScreenReady = pendingScreenReadyResolversRef.current.splice(
        0,
        pendingScreenReadyResolversRef.current.length
      );
      if (pending.length > 0) {
        logTtsGateState('released', 'screen_ready', pending.length);
      }
      pending.forEach((resolve) => resolve());
      pendingScreenReady.forEach((resolve) => resolve());
    };
    const interaction = InteractionManager.runAfterInteractions(() => {
      setTimeout(releaseGate, 0);
    });
    return () => {
      cancelled = true;
      interaction.cancel();
    };
  }, [logTtsGateState]);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const hasResumedRef = useRef(false);

  // Alpha: Layer 1 timing and probe tracking
  const timingRef = useRef<{
    questionEndTime: number | null;
    recordingStartTime: number | null;
    recordingEndTime: number | null;
  }>({ questionEndTime: null, recordingStartTime: null, recordingEndTime: null });
  const lastQuestionTextRef = useRef('');
  const responseTimingsRef = useRef<Array<{
    question_id: string;
    scenario: number | null;
    question_text: string;
    latency_ms: number;
    duration_ms: number;
    word_count: number;
  }>>([]);
  const probeLogRef = useRef<Array<{
    scenario: number;
    construct: string;
    probe_fired: boolean;
    trigger_reason: string | null;
    pre_probe_score: number;
    post_probe_score: number;
    score_delta: number;
  }>>([]);
  const scenarioScoresRef = useRef<Record<number, ScenarioScoreResult>>({});
  type ClosingPhase = 'needed' | 'asked' | 'answered';
  const [closingQuestionState, setClosingQuestionState] = useState<Record<1 | 2 | 3, ClosingPhase>>({
    1: 'needed',
    2: 'needed',
    3: 'needed',
  });
  /** True when we have asked the closing question and are waiting for user answer; ensures we never send that answer to Claude. */
  const [closingQuestionPending, setClosingQuestionPending] = useState(false);
  /** Which scenario's closing question is pending (1, 2, or 3). */
  const [closingQuestionScenario, setClosingQuestionScenario] = useState<1 | 2 | 3 | null>(null);
  const closingQuestionAskedRef = useRef<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const closingQuestionAnsweredRef = useRef<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const lastClosingQuestionScenarioRef = useRef<number | null>(null);
  /** Set when user answers closing question; used by failsafe if AI responds with ack but no [SCENARIO_COMPLETE]. */
  const lastAnsweredClosingScenarioRef = useRef<number | null>(null);
  /** Current scenario number for tagging new messages; avoids stale state in callbacks. Starts at 1 (first scenario). Updated on SCENARIO_COMPLETE and when injecting next scenario. */
  const currentScenarioRef = useRef<1 | 2 | 3>(1);
  /** Consecutive failed transcription (or recording) recovery lines for the same turn — reset on success. */
  const transcriptionFailureStreakRef = useRef(0);
  /** When user said "yes" to closing question; next message is their addition. null | 1 | 2 | 3 */
  const waitingForClosingAdditionRef = useRef<number | null>(null);
  const waitingMessageIdRef = useRef<string | null>(null);

  const interviewMomentsCompleteRef = useRef(createInitialMomentCompletion());
  const currentInterviewMomentRef = useRef<InterviewMomentIndex>(1);
  const personalHandoffInjectedRef = useRef(false);
  const moment4ThresholdProbeAskedRef = useRef(false);
  /** Ensures at most one client-injected M4→M5 bridge per session (backup when model omits). */
  const deferredMoment4NarrativeRef = useRef<string | null>(null);
  /** After misplaced Scenario C threshold answer: we re-ask Daniel/Sophie; next user turn is scored for commitment_threshold from this ref. */
  const expectingScenarioCThresholdAnswerAfterMisplaceRef = useRef(false);
  const scenarioCCommitmentOnlyEvidenceRef = useRef<string | null>(null);
  /** User answer to Scenario C repair prompt only — isolates repair from commitment-threshold scoring. */
  const scenarioCRepairOnlyEvidenceRef = useRef<string | null>(null);
  const scenarioAContemptProbeAskedRef = useRef(false);
  const interviewSessionIdRef = useRef<string>(newInterviewSessionId(userId));
  /** Whisper turn ended; next TTS should log recording_session_active for iOS volume diagnostics. */
  const recordingJustFinishedBeforeNextTtsRef = useRef(false);
  /** Native expo-av peak metering (dBFS) for the last completed recording — used before Whisper retry messaging. */
  const recordingPeakMeteringRef = useRef<number | null>(null);
  /** Populated before `transcribeSafe` for Whisper session_logs (duration / size). */
  const transcribeBufferMetaRef = useRef<{ audio_duration_ms: number; buffer_size_bytes: number } | null>(null);
  /** Time from audio session / stream ready through enforced delay until recording engine is initialized. */
  const recordingDelayMeasurementRef = useRef<RecordingDelayMeasurement | null>(null);
  /** Row created at interview start; completion updates this row instead of inserting a second one. */
  const interviewSessionAttemptIdRef = useRef<string | null>(null);
  /** First scenario question: optional server-side lifecycle (client update is a no-op when column absent). */
  const firstScenarioLifecyclePersistedRef = useRef(false);
  const [sessionAudioHealthNotice, setSessionAudioHealthNotice] = useState<string | null>(null);
  /** True while `speak()` / speakTextSafe await is in flight (for tts_interrupted). */
  const ttsLineInFlightRef = useRef(false);
  /** Last voice turn only — cleared on typed send. */
  const lastVoiceTurnLanguageRef = useRef<string | null>(null);
  const lastVoiceTurnConfidenceRef = useRef<number | null>(null);
  const turnAudioIndexRef = useRef(0);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'good' | 'poor'>('checking');

  const resumeRepeatChoicePendingRef = useRef(false);
  const resumeLastAssistantTextRef = useRef<string | null>(null);
  /** Web: resume-from-storage welcome audio must start from a tap (not a timer) for autoplay policy. */
  const [webResumeWelcomeTapPending, setWebResumeWelcomeTapPending] = useState(false);

  /** Web MediaRecorder: consecutive buffers with true digital silence (no samples + peak ≤ -200 dB) — triggers default-device fallback. */
  const consecutiveDigitalSilenceForMicFallbackRef = useRef(0);
  /** Web: after a successful default-device rebuild, set true until a recording yields non-zero audio (success log). */
  const micFallbackSuccessPendingRef = useRef(false);

  const resetInterviewProgressRefs = useCallback(() => {
    resumeRepeatChoicePendingRef.current = false;
    resumeLastAssistantTextRef.current = null;
    interviewMomentsCompleteRef.current = createInitialMomentCompletion();
    currentInterviewMomentRef.current = 1;
    personalHandoffInjectedRef.current = false;
    moment4ThresholdProbeAskedRef.current = false;
    deferredMoment4NarrativeRef.current = null;
    expectingScenarioCThresholdAnswerAfterMisplaceRef.current = false;
    scenarioCCommitmentOnlyEvidenceRef.current = null;
    scenarioCRepairOnlyEvidenceRef.current = null;
    scenarioAContemptProbeAskedRef.current = false;
    turnAudioIndexRef.current = 0;
    interviewSessionIdRef.current = newInterviewSessionId(userId);
    firstScenarioLifecyclePersistedRef.current = false;
    resetAudioInterviewTurnCounters();
    resetTtsDurationCalibration();
    resetWebAudioRouteSessionFingerprint();
    resetInterviewVadSession();
    resetWebInterviewGestureContext();
    gestureContextLostAtRef.current = null;
    consecutiveDigitalSilenceForMicFallbackRef.current = 0;
    micFallbackSuccessPendingRef.current = false;
    elongatingProbeFiredRef.current = false;
  }, [userId]);

  const deleteTurnAudioFile = useCallback(async (nativeUri: string | null) => {
    if (!nativeUri || Platform.OS === 'web') return;
    try {
      await FileSystem.deleteAsync(nativeUri, { idempotent: true });
    } catch {
      // non-critical cleanup
    }
  }, []);

  const processTurnAudioWithRetry = useCallback(
    async (
      params: {
        audioBlob: Blob | null;
        nativeUri: string | null;
        turnIndex: number;
        scenarioNumber: number | null;
      }
    ) => {
      const { audioBlob, nativeUri, turnIndex, scenarioNumber } = params;
      if (!userId) {
        await deleteTurnAudioFile(nativeUri);
        return { success: false };
      }
      const supabaseUrl = getResolvedSupabaseUrl();
      if (!supabaseUrl || !SUPABASE_ANON_KEY) {
        await deleteTurnAudioFile(nativeUri);
        return { success: false };
      }

      const MAX_RETRIES = 3;
      const RETRY_DELAYS = [3000, 8000, 15000];
      let lastError: unknown = null;
      const startedAtMs = Date.now();

      for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        try {
          let audioBase64 = '';
          let mimeType = 'audio/mp4';
          if (nativeUri) {
            audioBase64 = await FileSystem.readAsStringAsync(nativeUri, {
              encoding: 'base64' as unknown as never,
            });
            mimeType = 'audio/mp4';
          } else if (audioBlob && typeof audioBlob.arrayBuffer === 'function') {
            const arr = new Uint8Array(await audioBlob.arrayBuffer());
            audioBase64 = bytesToBase64(arr);
            mimeType = audioBlob.type || 'audio/webm';
          }
          if (!audioBase64) throw new Error('No audio data for turn.');
          const durationSec = Math.max(0, (Date.now() - startedAtMs) / 1000);

          const res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/analyze-interview-audio`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              action: 'process_turn',
              user_id: userId,
              session_id: interviewSessionIdRef.current,
              turn_index: turnIndex,
              scenario_number: scenarioNumber,
              audio_duration_seconds: durationSec,
              mime_type: mimeType,
              audio_base64: audioBase64,
            }),
          });
          if (!res.ok) throw new Error(`Edge function failed: ${res.status} ${await res.text()}`);
          await deleteTurnAudioFile(nativeUri);
          return { success: true };
        } catch (error) {
          lastError = error;
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
          }
        }
      }

      try {
        const message = lastError instanceof Error ? lastError.message : String(lastError);
        await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/analyze-interview-audio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: 'log_turn_failure',
            user_id: userId,
            session_id: interviewSessionIdRef.current,
            turn_index: turnIndex,
            scenario_number: scenarioNumber,
            error_message: `All ${MAX_RETRIES} attempts failed. Last error: ${message}`,
          }),
        });
      } catch {
        // Non-blocking logging only.
      } finally {
        await deleteTurnAudioFile(nativeUri);
      }
      return { success: false };
    },
    [deleteTurnAudioFile, userId]
  );

  useEffect(() => {
    const run = async () => {
      const supabaseUrl = getResolvedSupabaseUrl();
      const anonKey = getResolvedSupabaseAnonKey();
      if (!supabaseUrl || !anonKey) {
        setNetworkStatus('poor');
        return;
      }
      try {
        const timeout = setTimeout(() => setNetworkStatus((prev) => (prev === 'checking' ? 'poor' : prev)), 4000);
        const base = supabaseUrl.replace(/\/+$/, '');
        // `GET /rest/v1/` is service_role-only on current Supabase gateways — anon gets 401. Auth health is anon-safe + CORS.
        const res = await fetch(`${base}/auth/v1/health`, {
          method: 'GET',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        });
        clearTimeout(timeout);
        setNetworkStatus(res.status < 500 ? 'good' : 'poor');
      } catch {
        setNetworkStatus('poor');
      }
    };
    run();
    return () => {
      // no-op
    };
  }, []);

  const canAdvanceFromScenario = useCallback((scenarioNumber: 1 | 2 | 3) => closingQuestionState[scenarioNumber] === 'answered', [closingQuestionState]);
  const markClosingQuestionAsked = useCallback((scenarioNumber: 1 | 2 | 3) => {
    closingQuestionAskedRef.current[scenarioNumber] = true;
    lastClosingQuestionScenarioRef.current = scenarioNumber;
    setClosingQuestionState((prev) => ({ ...prev, [scenarioNumber]: 'asked' }));
  }, []);
  const markClosingQuestionAnswered = useCallback((scenarioNumber: 1 | 2 | 3) => {
    closingQuestionAnsweredRef.current[scenarioNumber] = true;
    lastAnsweredClosingScenarioRef.current = scenarioNumber;
    lastClosingQuestionScenarioRef.current = null;
    setClosingQuestionState((prev) => ({ ...prev, [scenarioNumber]: 'answered' }));
  }, []);
  const currentMessagesRef = useRef(messages);
  /** Mirrors last assistant message: true iff it was exactly one approved elongating line (client-enforced one-per-turn). */
  const elongatingProbeFiredRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  const interviewStatusRef = useRef(interviewStatus);
  interviewStatusRef.current = interviewStatus;

  const [sessionExpired, setSessionExpired] = useState(false);
  const [usingMemoryFallback, setUsingMemoryFallback] = useState(false);
  type ReasoningProgress = 'generating' | 'slow' | 'very_slow' | 'done' | 'pending' | 'failed' | null;
  const [reasoningProgress, setReasoningProgress] = useState<ReasoningProgress>(null);
  const [usedPersonalExamples, setUsedPersonalExamples] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showPostInterviewFeedback, setShowPostInterviewFeedback] = useState(false);
  const [postInterviewRatings, setPostInterviewRatings] = useState<Record<PostInterviewFeedbackKey, number | null>>({
    conversation_quality: null,
    clarity_flow: null,
    trust_accuracy: null,
  });
  const [postInterviewComments, setPostInterviewComments] = useState<Record<PostInterviewFeedbackKey, string>>({
    conversation_quality: '',
    clarity_flow: '',
    trust_accuracy: '',
  });
  const [postInterviewGeneralFeedback, setPostInterviewGeneralFeedback] = useState('');
  const [postInterviewFeedbackError, setPostInterviewFeedbackError] = useState<string | null>(null);
  const [hasSubmittedPostInterviewFeedback, setHasSubmittedPostInterviewFeedback] = useState(false);
  const lastAdminScoreCardCountRef = useRef(0);

  const handleInterviewSignOut = useCallback(() => {
    const confirmMessage = 'Are you sure you want to log out?';
    showConfirmDialog(
      {
        title: 'Log out',
        message: confirmMessage,
        confirmText: 'Log out',
      },
      () => void signOut(),
    );
  }, [signOut]);

  /** Admin from auth user (available on first render). */
  const isAdminUser = isAmoraeaAdminConsoleEmail(user?.email);
  const shouldShowAdminPanel = showAdminPanel && (isAdmin || isAdminUser);

  const openAdminPanelParam = (route.params as { openAdminPanel?: boolean } | undefined)?.openAdminPanel;
  useEffect(() => {
    if (!ALPHA_MODE || !openAdminPanelParam) return;
    setShowAdminPanel(true);
    if (typeof navigation.setParams === 'function') {
      navigation.setParams({ openAdminPanel: undefined });
    }
  }, [openAdminPanelParam, navigation]);

  /** Once we move to scenario N, scenarios 1..N-1 are locked. */
  const [highestScenarioReached, setHighestScenarioReached] = useState(1);

  useEffect(() => {
    if (__DEV__ || ALPHA_MODE) {
      const hasAnthropic = !!ANTHROPIC_API_KEY;
      const hasProxy = !!ANTHROPIC_PROXY_URL;
      const hasSupabase = !!getResolvedSupabaseUrl();
      if (__DEV__) {
        console.log('AriaScreen env check:', { hasAnthropicKey: hasAnthropic, hasProxyUrl: hasProxy, hasSupabaseUrl: hasSupabase });
      }
    }
  }, []);

  // Remote log on mount so we can confirm debug_logs table works (e.g. after login, open interview screen)
  useEffect(() => {
    remoteLog('[INIT] AriaScreen mounted', { userId: userId ?? null, isAdmin });
  }, [userId, isAdmin]);

  /** Web: prefetch greeting MP3 during consent so Begin Interview can call `play()` synchronously (gesture-safe autoplay). */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (status !== 'intro') return;
    if (!preInterviewConsentAge || !preInterviewConsentData) return;
    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) return;
    let cancelled = false;
    void (async () => {
      const ok = await prefetchWebInterviewGreetingMp3();
      if (!cancelled && !ok && __DEV__) {
        console.warn('[Aria] Greeting MP3 prefetch failed — fallback TTS may require extra gesture work');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, preInterviewConsentAge, preInterviewConsentData]);

  /** Create or restore interview attempt before any TTS so session_logs always have attempt_id. */
  useEffect(() => {
    if (!userId || isAdmin) {
      setInterviewAttemptBootstrap('ready');
      return;
    }
    let cancelled = false;
    setInterviewAttemptBootstrap('loading');
    void (async () => {
      try {
        const saved = await loadInterviewFromStorage(userId);
        if (cancelled) return;
        if (saved?.sessionAttemptId) {
          const { data: bootAttempt } = await supabase
            .from('interview_attempts')
            .select('id')
            .eq('id', saved.sessionAttemptId)
            .eq('user_id', userId)
            .maybeSingle();
          if (!bootAttempt?.id) {
            await clearInterviewFromStorage(userId);
            await remoteLog('[BOOT] stale_session_attempt_cleared', { orphanAttemptId: saved.sessionAttemptId });
          } else {
            interviewSessionAttemptIdRef.current = saved.sessionAttemptId;
            resetSessionLogRuntime({
              sessionCorrelationId: interviewSessionIdRef.current,
              attemptId: saved.sessionAttemptId,
              sessionLogsRequireAttemptId: true,
            });
            await remoteLog('[BOOT] attempt_id from storage', { attemptId: saved.sessionAttemptId });
            markSessionResumedForNextRecordingStart();
            if (Platform.OS === 'web') {
              void (async () => {
                await refreshWebAudioRoutesForSession();
                const p = await probeHeadphoneRoute();
                lastHeadphoneProbeRef.current = p;
                if (p.fingerprint != null) {
                  lastAudioRouteFingerprintRef.current = p.fingerprint;
                  setAudioRouteKind(p.kind);
                }
              })();
            }
            setInterviewAttemptBootstrap('ready');
            return;
          }
        }
        const { data: urow } = await supabase
          .from('users')
          .select('interview_attempt_count')
          .eq('id', userId)
          .maybeSingle();
        const attemptNumber = (urow?.interview_attempt_count ?? 0) + 1;
        const { data: attemptRow, error: attemptErr } = await supabase
          .from('interview_attempts')
          .insert({
            user_id: userId,
            attempt_number: attemptNumber,
            transcript: [],
          })
          .select('id')
          .single();
        if (cancelled) return;
        if (attemptErr || !attemptRow?.id) {
          const errPayload = attemptErr
            ? {
                message: attemptErr.message,
                code: attemptErr.code,
                details: attemptErr.details,
                hint: attemptErr.hint,
              }
            : { message: 'missing id' as const };
          await remoteLog('[BOOT] attempt_creation_failed', { error: errPayload });
          writeSessionLog({
            userId,
            attemptId: null,
            eventType: 'attempt_creation_failed',
            eventData: { ...errPayload, phase: 'mount_bootstrap' },
            platform: Platform.OS as 'ios' | 'android' | 'web',
          });
          setInterviewAttemptBootstrap('failed');
          return;
        }
        interviewSessionAttemptIdRef.current = attemptRow.id;
        resetSessionLogRuntime({
          sessionCorrelationId: interviewSessionIdRef.current,
          attemptId: attemptRow.id,
          sessionLogsRequireAttemptId: true,
        });
        const device = await collectDeviceContext();
        setSessionLogPlatform(device.platform);
        writeSessionLog({
          userId,
          attemptId: attemptRow.id,
          eventType: 'attempt_created',
          eventData: { attempt_id: attemptRow.id },
          platform: device.platform,
        });
        await remoteLog('[BOOT] attempt_created', { attemptId: attemptRow.id });
        writeSessionLog({
          userId,
          attemptId: attemptRow.id,
          eventType: 'session_initialized',
          eventData: {
            session_correlation_id: interviewSessionIdRef.current,
            bootstrap: 'mount',
          },
          platform: device.platform,
        });
        await remoteLog('[BOOT] attempt_id ready', { attemptId: attemptRow.id });
        setInterviewAttemptBootstrap('ready');
      } catch (e) {
        await remoteLog('[BOOT] attempt bootstrap exception', {
          message: e instanceof Error ? e.message : String(e),
        });
        setInterviewAttemptBootstrap('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isAdmin]);

  useEffect(() => {
    currentMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const lastAsst = [...messages].reverse().find((m) => m.role === 'assistant');
    elongatingProbeFiredRef.current = isApprovedElongatingProbeOnly(lastAsst?.content ?? '');
  }, [messages]);

  useEffect(() => {
    if (!isAdmin) return;
    const scoreCardCount = messages.filter((m) => messageLooksLikeScoreCard(m)).length;
    if (scoreCardCount === lastAdminScoreCardCountRef.current) return;
    lastAdminScoreCardCountRef.current = scoreCardCount;
    if (__DEV__) {
      console.log('[ADMIN_SCORECARD_RENDER]', {
        accountType: isAdmin ? 'admin' : 'regular',
        scoreCardCount,
        totalMessages: messages.length,
        renderConditionMet: isAdmin && scoreCardCount > 0,
        status,
        interviewStatus,
      });
    }
    void remoteLog('[ADMIN_SCORECARD_RENDER]', {
      accountType: isAdmin ? 'admin' : 'regular',
      scoreCardCount,
      totalMessages: messages.length,
      renderConditionMet: isAdmin && scoreCardCount > 0,
      status,
      interviewStatus,
      userId: userId ?? null,
    });
  }, [messages, isAdmin, status, interviewStatus, userId]);

  useEffect(() => {
    if (status !== 'scoring') setReasoningProgress(null);
  }, [status]);

  useEffect(() => {
    setStorageFallbackListener(() => setUsingMemoryFallback(true));
    return () => setStorageFallbackListener(null);
  }, []);

  useEffect(() => {
    const w = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    if (!w) return;
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const err = event.reason;
      event.preventDefault();
      if (__DEV__) console.error('Unhandled rejection caught by safety net:', err);
      const active = statusRef.current === 'active' || statusRef.current === 'scoring';
      if (active && userId) {
        try {
          const msgs = currentMessagesRef.current.filter(
            (m) => !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack
          );
          const completed = Array.from(scoredScenariosRef.current);
          const scores: Record<
            number,
            {
              pillarScores: Record<string, number | null>;
              pillarConfidence: Record<string, string>;
              keyEvidence: Record<string, string>;
              scenarioName?: string;
            }
          > = {};
          [1, 2, 3].forEach((n) => {
            const s = scenarioScoresRef.current[n];
            if (s) scores[n] = { pillarScores: s.pillarScores, pillarConfidence: s.pillarConfidence, keyEvidence: s.keyEvidence, scenarioName: s.scenarioName };
          });
          saveInterviewProgress(userId, {
            messages: msgs,
            scenariosCompleted: completed,
            scenarioScores: scores,
            currentScenario: getCurrentScenario(scoredScenariosRef.current),
            emergencySave: true,
            savedAt: new Date().toISOString(),
          });
        } catch {
          // emergency save failed
        }
      }
    };
    w.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => w.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, [userId]);

  const ensureValidSession = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw new Error('Session could not be refreshed');
    }
  }, []);

  useEffect(() => {
    checkMicPermission().then(setMicPermission);
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'TOKEN_REFRESHED') {
        if (__DEV__) console.log('Auth token refreshed');
      }
      if (event === 'SIGNED_OUT') {
        const msgs = currentMessagesRef.current.filter(
          (m) => !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack
        );
        const completed = Array.from(scoredScenariosRef.current);
        const scores: Record<
          number,
          {
            pillarScores: Record<string, number | null>;
            pillarConfidence: Record<string, string>;
            keyEvidence: Record<string, string>;
            scenarioName?: string;
          }
        > = {};
        [1, 2, 3].forEach((n) => {
          const s = scenarioScoresRef.current[n];
          if (s) scores[n] = { pillarScores: s.pillarScores, pillarConfidence: s.pillarConfidence, keyEvidence: s.keyEvidence, scenarioName: s.scenarioName };
        });
        if (userId) {
          await saveInterviewProgress(userId, {
            messages: msgs,
            scenariosCompleted: completed,
            scenarioScores: scores,
            currentScenario: getCurrentScenario(scoredScenariosRef.current),
            sessionExpired: true,
          });
        }
        setSessionExpired(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [userId]);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email ?? null;
      setIsAdmin(isAmoraeaAdminConsoleEmail(email));
      setUserEmail(email ?? null);
    };
    getSession();
  }, []);

  useEffect(() => {
    const checkInterviewStatus = async () => {
      if (!userId) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionEmail = sessionData.session?.user?.email ?? null;
      const { data, error } = await supabase
        .from('users')
        .select('interview_completed, interview_passed, interview_reviewed_at, latest_attempt_id, is_alpha_tester')
        .eq('id', userId)
        .maybeSingle();
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'AriaScreen.tsx:checkInterviewStatus',
          message: 'users_row_after_refresh_check',
          data: {
            hasError: !!error,
            interviewCompleted: data?.interview_completed ?? null,
            latestAttemptIdPresent: typeof data?.latest_attempt_id === 'string' && data.latest_attempt_id.length > 0,
            interviewStatusBeforeBranch: interviewStatusRef.current,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      /** Session email is reliable on cold start; `user` from useAuth can be null for a frame and caused PostInterview ↔ Aria loops for admin. */
      const isAdminEmail = isAmoraeaAdminConsoleEmail(sessionEmail ?? user?.email);
      /** Same cohort as `scoreInterview` → PostInterview: not alpha, not admin — never show in-app thank-you / scores. */
      const shouldHandOffToPostInterview =
        isInterviewAppRoute &&
        data?.interview_completed === true &&
        data?.is_alpha_tester !== true &&
        !isAdminEmail;

      // Navigation lock: interview just completed in this session — stay on congratulations and set attempt id
      if (interviewJustCompletedInSession) {
        interviewJustCompletedInSession = false;
        setInterviewStatus('congratulations');
        const attemptFromSession = interviewLastCommittedAttemptId;
        interviewLastCommittedAttemptId = null;
        const resolvedId =
          (typeof attemptFromSession === 'string' && attemptFromSession.length > 0
            ? attemptFromSession
            : null) ?? (data?.latest_attempt_id as string | undefined);
        if (resolvedId) setAnalysisAttemptId(resolvedId);
        return;
      }
      /**
       * Skip re-entrant status sync while the live interview is running.
       * Do **not** block when UI shows "preparing_results" but the row is not yet `interview_completed` (in-flight
       * scoring before DB commit) — we must stay out until save finishes.
       * If `interview_completed` is **true** in the DB, this effect must run: recover from a stuck "preparing" screen
       * (refresh mid-flight, failed navigation) by handing off to PostInterview or re-syncing to congratulations.
       */
      if (interviewStatusRef.current === 'in_progress') return;
      // Only skip while we may still be committing a scored attempt (latest_attempt_id set, completed not yet true).
      // If the server reset the interview (no latest attempt), fall through so we can show `not_started`.
      if (
        interviewStatusRef.current === 'preparing_results' &&
        data != null &&
        data.interview_completed !== true
      ) {
        const aidWait = data.latest_attempt_id;
        if (typeof aidWait === 'string' && aidWait.length > 0) {
          return;
        }
      }

      if (error || !data) {
        setInterviewStatus('not_started');
        return;
      }

      if (shouldHandOffToPostInterview) {
        replaceWithStandardApplicantProcessingHandoffForUser(navigation, userId);
        return;
      }

      if (!data.interview_completed) {
        setPendingScoringSyncAttemptId(null);
        setInterviewStatus('not_started');
      } else {
        const aid = data.latest_attempt_id as string | null | undefined;
        if (typeof aid === 'string' && aid.length > 0) {
          const { data: attemptStillThere } = await supabase
            .from('interview_attempts')
            .select('id')
            .eq('id', aid)
            .maybeSingle();
          if (!attemptStillThere?.id) {
            await remoteLog('[Aria] latest_attempt_id points at missing row after reset — not_started', {
              attemptId: aid,
            });
            setPendingScoringSyncAttemptId(null);
            setInterviewStatus('not_started');
            return;
          }
          setInterviewStatus('preparing_results');
          const ready = await waitForInterviewAttemptScoringReady(supabase, aid, {
            maxMs: 90_000,
            intervalMs: 500,
          });
          if (ready) {
            setPendingScoringSyncAttemptId(null);
            setAnalysisAttemptId(aid);
            setInterviewStatus('congratulations');
          } else {
            setPendingScoringSyncAttemptId(aid);
            setInterviewStatus('preparing_results');
          }
        } else {
          setInterviewStatus('congratulations');
        }
      }
    };
    checkInterviewStatus();
  }, [userId, user?.email, navigation, isInterviewAppRoute, preparingHandoffPollTick]);

  /** While "Preparing your results" is showing, re-check the server on a short interval so navigation runs as soon as the row is ready (no manual button). */
  useEffect(() => {
    if (interviewStatus !== 'preparing_results') return;
    const id = setInterval(() => {
      setPreparingHandoffPollTick((n) => n + 1);
    }, 2000);
    return () => clearInterval(id);
  }, [interviewStatus]);

  useEffect(() => {
    if (!pendingScoringSyncAttemptId || !userId) return;
    let cancelled = false;
    const id = pendingScoringSyncAttemptId;
    (async () => {
      const ok = await waitForInterviewAttemptScoringReady(supabase, id, {
        // Was 10m — that matched user reports of "stuck" with no new info. Same behavior after timeout: advance anyway.
        maxMs: 180_000,
        intervalMs: 600,
      });
      if (cancelled) return;
      if (!ok) {
        await remoteLog('[WARN] pending_scoring_sync_poll_exhausted', {
          attemptId: id,
          action: 'advance_anyway',
        });
      }
      setPendingScoringSyncAttemptId(null);
      setAnalysisAttemptId(id);
      await runCommunicationStylePipelineAfterSave(userId, id, interviewSessionIdRef.current, {
        platform: getSessionLogRuntime().platform,
      });
      setInterviewStatus('congratulations');
      await remoteLog('[8] setInterviewStatus called', {
        screen: 'congratulations',
        via: ok ? 'pending_scoring_sync' : 'pending_scoring_sync_timeout',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingScoringSyncAttemptId, userId]);

  // Failsafe: never stay on "Loading..." forever (e.g. slow auth in incognito)
  useEffect(() => {
    const t = setTimeout(() => {
      if (interviewStatusRef.current === 'loading') {
        setInterviewStatus('not_started');
      }
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  // Failsafe: ensure we leave results-loading state when scoring finishes.
  useEffect(() => {
    if (!ALPHA_MODE || !userId) return;
    if (interviewStatus === 'congratulations') return;
    if (status !== 'results' || !results) return;
    if (__DEV__) console.warn('[Aria] Failsafe post-interview route triggered');
    setInterviewStatus('congratulations');
  }, [ALPHA_MODE, userId, status, results, interviewStatus]);

  // Long scoring + DB confirmation can exceed 90s; do not navigate away from preparing without a completed scoreInterview path.
  useEffect(() => {
    if (interviewStatus !== 'preparing_results') return;
    const t = setTimeout(() => {
      if (__DEV__) console.warn('[Aria] Preparing_results still active after 3m — check scoring / network if stuck');
    }, 180000);
    return () => clearTimeout(t);
  }, [interviewStatus]);

  useEffect(() => {
    if (!userId || isAdmin) return;
    const run = async () => {
      const saved = await loadInterviewFromStorage(userId);
      const payload = saved?.pendingAttemptPayload as { insert: Record<string, unknown>; update: Record<string, unknown>; attemptNum: number } | undefined;
      if (!saved?.pendingDatabaseSave || !payload?.insert) return;
      try {
        await ensureValidSession();
        const { data: insertData, error: insertErr } = await supabase.from('interview_attempts').insert(payload.insert).select('id').single();
        if (insertErr) throw new Error(insertErr.message);
        const update = { ...payload.update, latest_attempt_id: insertData?.id ?? null };
        const { error: updateErr } = await supabase.from('users').update(update).eq('id', userId);
        if (updateErr) throw new Error(updateErr.message);
        const recoveredAttemptId = insertData?.id;
        if (recoveredAttemptId) {
          await runCommunicationStylePipelineAfterSave(userId, recoveredAttemptId, interviewSessionIdRef.current, {
            platform: getSessionLogRuntime().platform,
          });
        }
        const next = { ...saved };
        delete next.pendingDatabaseSave;
        delete next.saveFailedAt;
        delete next.pendingAttemptPayload;
        await saveInterviewProgress(userId, next);
      } catch (err) {
        if (__DEV__) console.warn('Recovery save still failing:', err instanceof Error ? err.message : err);
      }
    };
    run();
  }, [userId, isAdmin, ensureValidSession]);

  scenarioScoresRef.current = scenarioScores;
  useEffect(() => {
    if (!userId || isAdmin || status !== 'active' || messages.length === 0) return;
    const completed = Array.from(scoredScenariosRef.current);
    const scenarioScoresPayload: Record<
      number,
      { pillarScores: Record<string, number | null>; pillarConfidence: Record<string, string>; keyEvidence: Record<string, string>; scenarioName?: string }
    > = {};
    [1, 2, 3].forEach((n) => {
      const s = scenarioScores[n];
      if (s) scenarioScoresPayload[n] = { pillarScores: s.pillarScores, pillarConfidence: s.pillarConfidence, keyEvidence: s.keyEvidence, scenarioName: s.scenarioName };
    });
    saveInterviewProgress(userId, {
      messages: messages.filter((m) => !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack),
      scenariosCompleted: completed,
      scenarioScores: scenarioScoresPayload,
      currentScenario: getCurrentScenario(scoredScenariosRef.current),
      pendingCompletion:
        pendingCompletion ||
        interviewStatusRef.current === 'preparing_results',
      sessionAttemptId: interviewSessionAttemptIdRef.current ?? undefined,
    });
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'AriaScreen.tsx:saveInterviewProgressEffect',
        message: 'saved_progress_snapshot',
        data: {
          status,
          interviewStatus: interviewStatusRef.current,
          completedCount: completed.length,
          currentScenario: getCurrentScenario(scoredScenariosRef.current),
          userMessageCount: messages.filter((m) => m.role === 'user').length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [messages, status, userId, isAdmin, scenarioScores, pendingCompletion]);

  /** Debounced sync of live transcript to `users.interview_transcript` so the admin panel can follow in-progress interviews (scenario checkpoints also update this). */
  useEffect(() => {
    if (!userId || isAdmin || status !== 'active') return;
    if (interviewStatusRef.current !== 'in_progress' && interviewStatusRef.current !== 'preparing_results') return;
    if (messages.length === 0) return;
    const transcriptSnapshot = messages.filter(
      (m) => !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack,
    );
    const t = setTimeout(() => {
      if (interviewStatusRef.current !== 'in_progress' && interviewStatusRef.current !== 'preparing_results') return;
      void supabase
        .from('users')
        .update({ interview_transcript: transcriptSnapshot })
        .eq('id', userId)
        .then(({ error }) => {
          if (error && __DEV__) console.warn('[live_transcript]', error.message);
        });
    }, 7000);
    return () => clearTimeout(t);
  }, [messages, userId, isAdmin, status, interviewStatus]);

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepository.getProfile(userId),
    enabled: !!userId,
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const resolvedFirstName = getInterviewUserFirstNameForPrompt(profile);
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        runId: 'pre-fix',
        hypothesisId: 'H12',
        location: 'AriaScreen.tsx:profileFirstNameEffect',
        message: 'profile_name_resolution',
        data: {
          hasProfile: !!profile,
          hasBasicInfoFirstName: !!profile?.basicInfo?.firstName,
          hasProfileName: !!profile?.name,
          resolvedFirstName: resolvedFirstName || null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const rtd = getSessionLogRuntime();
    writeSessionLog({
      userId,
      attemptId: rtd.attemptId,
      eventType: 'name_source_debug',
      eventData: {
        stage: 'profile_effect',
        has_profile: !!profile,
        has_basic_info_first_name: !!profile?.basicInfo?.firstName,
        has_profile_name: !!profile?.name,
        resolved_first_name_present: !!resolvedFirstName,
        resolved_first_name_length: resolvedFirstName.length,
      },
      platform: rtd.platform,
    });
  }, [profile, userId]);

  const typologyContext = ''; // Optional: load from profile/assessments later

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd?.({ animated: true });
  }, [messages, status]);

  // New scenario vignette in the latest assistant message → transition (reference cleared) until TTS finishes delivering it.
  useEffect(() => {
    if (status !== 'active' || isAdmin) return;
    const assistantOnly = messages.filter((m) => m.role === 'assistant' && isAssistantBubbleForTranscript(m));
    const latest = assistantOnly[assistantOnly.length - 1];
    if (!latest?.content) return;
    const cleaned = stripControlTokens(latest.content).trim();
    const latestDetect = detectActiveScenarioFromMessage(cleaned);
    if (!latestDetect) return;
    const committed = committedScenarioRef.current;
    if (!committed || committed.label !== latestDetect.label) {
      setInterviewUiPhase('scenario_transitioning');
      setReferenceCardPrompt(null);
      setReferenceCardScenario(null);
      committedScenarioRef.current = null;
    }
  }, [messages, status, isAdmin]);

  useEffect(() => {
    if (status !== 'active' || isAdmin) {
      setInterviewUiPhase('pre_scenario');
      setReferenceCardScenario(null);
      setReferenceCardPrompt(null);
      setScenarioIntroTtsPlaying(false);
      committedScenarioRef.current = null;
    }
  }, [status, isAdmin]);

  const showChatError = useCallback((message: string) => {
    setMessages((prev) => [
      ...prev,
      { role: 'error', content: message, isError: true } as { role: string; content: string; isError?: boolean },
    ]);
  }, []);

  const applyInterviewSpeechComplete = useCallback((rawText: string) => {
    const cleaned = stripControlTokens(rawText).trim();
    if (!cleaned) return;
    const scenario = detectActiveScenarioFromMessage(cleaned);
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H8',location:'AriaScreen.tsx:applyInterviewSpeechComplete:entry',message:'apply_interview_speech_complete_called',data:{hasScenario:!!scenario,detectedScenario:scenario?.label ?? null,currentPhase:interviewUiPhase,currentScenario:currentScenarioRef.current,hasReferenceScenario:!!referenceCardScenario},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (scenario) {
      committedScenarioRef.current = scenario;
      setReferenceCardScenario(scenario);
      setReferenceCardPrompt(getSituationOpeningQuestion(scenario));
      setInterviewUiPhase('scenario_active');
    } else if (committedScenarioRef.current) {
      const q = extractModalQuestionFromAssistantText(cleaned);
      if (q !== null && !isResumeOrScenarioReplayUiPrompt(q)) {
        setReferenceCardPrompt(q);
      }
    }
  }, []);

  const speak = useCallback(async (
    text: string,
    speakOpts?: {
      telemetrySource?: TtsTelemetrySource;
      skipQuestionTiming?: boolean;
      skipLastQuestionRef?: boolean;
      preInitTriggerDuring?: PreInitTriggerDuring;
      ttsTriggerSource?:
        | 'gesture_handler'
        | 'effect'
        | 'callback'
        | 'timeout'
        | 'preauthorized_element';
    }
  ): Promise<{ scenarioSplitDelivery?: { segment1_expected_duration_ms: number; segment2_expected_duration_ms: number } } | void> => {
    await awaitTtsScreenReadyGate('speak');
    await stopElevenLabsPlayback();
    if (!speakOpts?.skipLastQuestionRef) {
      lastQuestionTextRef.current = text;
    }
    // Keep "processing" until audio is actually audible — avoids large flame + "Speaking..." during fetch / autoplay wait.
    setVoiceState('processing');
    isSpeakingRef.current = true;
    const telemetrySource = speakOpts?.telemetrySource ?? 'other';
    const ttsTriggerSource: 'gesture_handler' | 'effect' | 'callback' | 'timeout' | 'preauthorized_element' =
      Platform.OS === 'web' && isPreAuthorizedAudioPendingForNextTts()
        ? 'preauthorized_element'
        : (speakOpts?.ttsTriggerSource ?? 'callback');
    const preInitTriggerDuring: PreInitTriggerDuring =
      speakOpts?.preInitTriggerDuring ??
      (telemetrySource === 'greeting' ? 'greeting' : 'tts_playback');
    const split = trySplitFictionalScenarioIntroLongDelivery(text);
    const logWebFirstAudioPlay = () => {
      if (Platform.OS !== 'web') return;
      const uid = userIdRef.current;
      const anchor = getLastWebInterviewUserGestureMs();
      const gestureToPlayMs = anchor != null ? Date.now() - anchor : null;
      if (uid) {
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId: uid,
          attemptId: r.attemptId,
          eventType: 'tts_first_audio_play',
          eventData: {
            gesture_to_play_ms: gestureToPlayMs,
            telemetry_source: telemetrySource,
            tts_trigger_source: ttsTriggerSource,
            gesture_to_play_exceeds_100ms: gestureToPlayMs != null && gestureToPlayMs > 100,
          },
          platform: r.platform,
        });
      }
    };
    try {
      // Ensure playback route is reset immediately before TTS (fixes low-volume-after-recording on iOS).
      await setPlaybackMode();
      console.log('[Audio/TTS] AriaScreen.speak → speakWithElevenLabs', {
        platform: Platform.OS,
        textLength: text?.length ?? 0,
        scenarioSplit: !!split,
      });
      if (split) {
        await speakWithElevenLabs(split.seg1, undefined, {
          onPlaybackStarted: () => {
            setVoiceState('speaking');
            logWebFirstAudioPlay();
          },
          telemetry: { source: telemetrySource },
          skipStopElevenLabsPlaybackBeforeStart: true,
          preInitTriggerDuring,
        });
        await new Promise<void>((r) => setTimeout(r, 1500));
        await speakWithElevenLabs(split.seg2, undefined, {
          onPlaybackStarted: () => {
            setVoiceState('speaking');
            logWebFirstAudioPlay();
          },
          telemetry: { source: telemetrySource },
          skipStopElevenLabsPlaybackBeforeStart: true,
          preInitTriggerDuring,
        });
        return {
          scenarioSplitDelivery: {
            segment1_expected_duration_ms: split.segment1_expected_duration_ms,
            segment2_expected_duration_ms: split.segment2_expected_duration_ms,
          },
        };
      }
      await speakWithElevenLabs(text, undefined, {
        onPlaybackStarted: () => {
          setVoiceState('speaking');
          logWebFirstAudioPlay();
        },
        telemetry: { source: telemetrySource },
        preInitTriggerDuring,
      });
    } catch (speakErr) {
      throw speakErr;
    } finally {
      isSpeakingRef.current = false;
      if (!speakOpts?.skipQuestionTiming) {
        timingRef.current.questionEndTime = Date.now();
        markQuestionDelivered(new Date().toISOString());
      }
      setVoiceState('idle');
    }
  }, [awaitTtsScreenReadyGate]);

  /**
   * Web: flush ElevenLabs blob or Web Speech queue inside a user gesture (pointer/mic).
   * Used from mic pressIn and from a one-time window listener so any tap can unblock audio — not mic-only.
   */
  const runWebGestureTtsFlush = useCallback(async (debugSource?: string) => {
    if (Platform.OS !== 'web') return;
    markWebInterviewUserGestureNow();
    unlockWebAudioForAutoplay();
    /** Same unlock as "Tap the screen to begin" — avoids back-to-back pending_tts + tap_unlock (two taps). */
    setMobileWebTapToBeginDone(true);
    // #region agent log
    const _peekLen = (pendingWebSpeechForGestureRef.current ?? pendingWebSpeechForGestureModule ?? readStoredPendingGestureTts() ?? '').length;
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
      body: JSON.stringify({
        sessionId: 'e70f17',
        location: 'AriaScreen.tsx:runWebGestureTtsFlush',
        message: 'flush_entry',
        data: {
          hypothesisId: 'H5',
          hasPendingBlob: hasPendingWebGestureBlobUrl(),
          peekTextLen: _peekLen,
          debugSource: debugSource ?? 'unknown',
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const tryPlayed = await tryPlayPendingWebTtsAudioInUserGesture(
      () => {},
      () => clearPendingWebSpeechGesturePair(pendingWebSpeechForGestureRef),
      { source: 'turn' }
    );
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
      body: JSON.stringify({
        sessionId: 'e70f17',
        location: 'AriaScreen.tsx:runWebGestureTtsFlush',
        message: 'tryPlayPending_result',
        data: { hypothesisId: 'H5', tryPlayed },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (tryPlayed) {
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          hypothesisId: 'H4',
          location: 'AriaScreen.tsx:runWebGestureTtsFlush',
          message: 'flush_played_pending_blob',
          data: { debugSource: debugSource ?? 'unknown' },
          timestamp: Date.now(),
          runId: 'pre-fix',
        }),
      }).catch(() => {});
      // #endregion
      setWebDesktopPendingTtsGestureOverlay(false);
      webGestureTtsConsumedPressRef.current = true;
      if (webGestureConsumeClearTimeoutRef.current) {
        clearTimeout(webGestureConsumeClearTimeoutRef.current);
        webGestureConsumeClearTimeoutRef.current = null;
      }
      webGestureConsumeClearTimeoutRef.current = setTimeout(() => {
        webGestureConsumeClearTimeoutRef.current = null;
        webGestureTtsConsumedPressRef.current = false;
      }, 1800);
      return;
    }
    const fromRef = pendingWebSpeechForGestureRef.current;
    const fromMod = pendingWebSpeechForGestureModule;
    const fromStore = readStoredPendingGestureTts();
    const t = fromRef ?? fromMod ?? fromStore;
    if (!t) {
      setWebDesktopPendingTtsGestureOverlay(false);
      return;
    }
    clearPendingWebSpeechGesturePair(pendingWebSpeechForGestureRef);
    webGestureTtsConsumedPressRef.current = true;
    if (webGestureConsumeClearTimeoutRef.current) {
      clearTimeout(webGestureConsumeClearTimeoutRef.current);
      webGestureConsumeClearTimeoutRef.current = null;
    }
    webGestureConsumeClearTimeoutRef.current = setTimeout(() => {
      webGestureConsumeClearTimeoutRef.current = null;
      webGestureTtsConsumedPressRef.current = false;
    }, 1800);
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        hypothesisId: 'H3',
        location: 'AriaScreen.tsx:runWebGestureTtsFlush',
        message: 'flush_web_speech_text',
        data: { flushPreview: t.slice(0, 140), flushLen: t.length, debugSource: debugSource ?? 'unknown' },
        timestamp: Date.now(),
        runId: 'pre-fix',
      }),
    }).catch(() => {});
    // #endregion
    trySpeakWebSpeechInUserGesture(t, () => {});
    setWebDesktopPendingTtsGestureOverlay(false);
  }, []);

  const ensureWebGestureFlushListener = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (webGestureFlushListenerAttachedRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
        body: JSON.stringify({
          sessionId: 'e70f17',
          location: 'AriaScreen.tsx:ensureWebGestureFlushListener',
          message: 'ensure_skip_already_attached',
          data: { hypothesisId: 'H1' },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return;
    }
    webGestureFlushListenerAttachedRef.current = true;
    const fn = () => {
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
        body: JSON.stringify({
          sessionId: 'e70f17',
          location: 'AriaScreen.tsx:ensureWebGestureFlushListener:fn',
          message: 'window_pointerdown_before_flush',
          data: { hypothesisId: 'H3' },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      webGestureFlushListenerAttachedRef.current = false;
      webGestureFlushHandlerRef.current = null;
      window.removeEventListener('pointerdown', fn, { capture: true });
      void runWebGestureTtsFlush('window');
    };
    webGestureFlushHandlerRef.current = fn;
    window.addEventListener('pointerdown', fn, { capture: true });
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
      body: JSON.stringify({
        sessionId: 'e70f17',
        location: 'AriaScreen.tsx:ensureWebGestureFlushListener',
        message: 'listener_registered',
        data: { hypothesisId: 'H1' },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [runWebGestureTtsFlush]);

  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web' || typeof window === 'undefined') return;
      const h = webGestureFlushHandlerRef.current;
      if (h) {
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
          body: JSON.stringify({
            sessionId: 'e70f17',
            location: 'AriaScreen.tsx:gestureFlushUnmount',
            message: 'cleanup_remove_listener',
            data: { hypothesisId: 'H4' },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        window.removeEventListener('pointerdown', h, { capture: true });
        webGestureFlushHandlerRef.current = null;
      }
      webGestureFlushListenerAttachedRef.current = false;
    };
  }, []);

  /** Attempts TTS; on failure shows text visually and continues (no stall). */
  const speakTextSafe = useCallback(
    async (
      text: string,
      options: {
        silent?: boolean;
        interviewSpeechRole?: 'assistant_response';
        telemetrySource?: TtsTelemetrySource;
        ttsPipeline?: 'parallel_streaming';
        /** Skip question_delivered session log (e.g. verbatim resume replay). */
        skipQuestionDeliveredTelemetry?: boolean;
        /** Do not advance reference-card state from this line. */
        skipInterviewSpeechAdvance?: boolean;
        /** Do not update question-end timing / markQuestionDelivered (replay is not a new question). */
        skipQuestionTiming?: boolean;
        /** Do not overwrite lastQuestionTextRef (replay is not the active question). */
        skipLastQuestionRef?: boolean;
        /** Internal: resume TTS from a tap after tab visibility restored gesture gate. */
        skipGestureGate?: boolean;
        ttsTriggerSource?:
          | 'gesture_handler'
          | 'effect'
          | 'callback'
          | 'timeout'
          | 'preauthorized_element';
        /** Web: `play()` already invoked synchronously on this element (Begin Interview greeting). */
        immediateWebPlaybackElement?: HTMLAudioElement;
      } = {}
    ) => {
      const {
        silent = false,
        interviewSpeechRole,
        telemetrySource: telemetrySourceOpt,
        ttsPipeline,
        skipQuestionDeliveredTelemetry = false,
        skipInterviewSpeechAdvance = false,
        skipQuestionTiming = false,
        skipLastQuestionRef = false,
        skipGestureGate = false,
        ttsTriggerSource = 'callback',
        immediateWebPlaybackElement,
      } = options;
      const effectiveTtsTriggerSource:
        | 'gesture_handler'
        | 'effect'
        | 'callback'
        | 'timeout'
        | 'preauthorized_element' =
        Platform.OS === 'web' && isPreAuthorizedAudioPendingForNextTts()
          ? 'preauthorized_element'
          : ttsTriggerSource;

      await awaitTtsScreenReadyGate('speak_text_safe');

      if (Platform.OS === 'web' && immediateWebPlaybackElement && userId) {
        /** Same as `speak()` — prefetched HTMLAudioElement path returns before `speak()`, so ratio gate would see an empty/stale `lastQuestionTextRef` on mobile "Begin Interview". */
        if (!skipLastQuestionRef) {
          lastQuestionTextRef.current = text;
        }
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            location: 'AriaScreen.tsx:speakTextSafe:immediateWebPlaybackElement',
            message: 'lastQuestionTextRef set (prefetched greeting path)',
            data: {
              hypothesisId: 'H6_prefetched_greeting_skipped_speak',
              skipLastQuestionRef,
              refLen: (lastQuestionTextRef.current ?? '').length,
            },
            timestamp: Date.now(),
            runId: 'post-fix',
          }),
        }).catch(() => {});
        // #endregion
        const telemetrySourceImmediate =
          telemetrySourceOpt ?? (interviewSpeechRole === 'assistant_response' ? 'turn' : 'other');
        const effectiveImmediateTtsTrigger:
          | 'gesture_handler'
          | 'effect'
          | 'callback'
          | 'timeout'
          | 'preauthorized_element' =
          Platform.OS === 'web' && isPreAuthorizedAudioPendingForNextTts()
            ? 'preauthorized_element'
            : ttsTriggerSource;
        prepareTtsPlaybackTelemetryState({
          charCount: stripControlTokens(text).trim().length,
          telemetryIsGreeting: telemetrySourceImmediate === 'greeting',
          isWeb: true,
        });
        const rtImmediate = getSessionLogRuntime();
        const ttsPlaybackActiveImmediatelyPriorIm = rtImmediate.ttsPlaybackActive;
        setTtsPlaybackActive(true);
        ttsLineInFlightRef.current = true;
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        const ua = nav as Navigator & { userActivation?: { isActive?: boolean } } | undefined;
        const gestureContextActive =
          Platform.OS === 'web' ? ua?.userActivation?.isActive === true : null;
        const webUnlock = Platform.OS === 'web' ? isWebInterviewAudioUnlocked() : true;
        const webTtsGestureErrorPrevented =
          Platform.OS === 'web'
            ? webUnlock && (gestureContextActive === true || mobileWebTapToBeginDone)
            : null;
        writeSessionLog({
          userId,
          attemptId: rtImmediate.attemptId,
          eventType: 'tts_playback_start',
          eventData: {
            ...gatherTtsPlaybackTelemetry({ ttsPlaybackActiveImmediatelyPrior: ttsPlaybackActiveImmediatelyPriorIm }),
            telemetry_source: telemetrySourceImmediate,
            tts_buffer_complete_before_playback: consumeTtsBufferCompleteBeforePlaybackFlag(),
            playback_strategy: consumeTtsPlaybackStrategyForNextPlayback(),
            gesture_context_active: gestureContextActive,
            web_tts_gesture_error_prevented: webTtsGestureErrorPrevented,
            tts_trigger_source: effectiveImmediateTtsTrigger,
          },
          platform: rtImmediate.platform,
        });
        const ttsStart = Date.now();
        try {
          setVoiceState('speaking');
          await new Promise<void>((resolve, reject) => {
            const el = immediateWebPlaybackElement;
            const done = () => {
              finalizeInterviewMicAmbientOnTtsEnd();
              resolve();
            };
            el.addEventListener('ended', done, { once: true });
            el.addEventListener(
              'error',
              () => reject(new Error('greeting_audio_error')),
              { once: true }
            );
            if (el.ended) {
              done();
            } else {
              void el
                .play()
                .then(() => {
                  if (el.ended) done();
                })
                .catch(() => reject(new Error('greeting_audio_error')));
            }
          });
          if (userId) {
            const rtp = getSessionLogRuntime();
            const actualTtsMs = Date.now() - ttsStart;
            markLastAudioSessionEventType('tts_playback_complete');
            writeSessionLog({
              userId,
              attemptId: rtp.attemptId,
              eventType: 'tts_playback_complete',
              eventData: { telemetry_source: telemetrySourceImmediate },
              durationMs: actualTtsMs,
              platform: rtp.platform,
            });
          }
        } catch {
          /* fall through — caller may fall back */
        } finally {
          if (userId) {
            setTtsPlaybackActive(false);
            ttsLineInFlightRef.current = false;
          }
          setVoiceState('idle');
          const ttsResolvedAt = Date.now();
          setLastTtsCompletionCallbackMs(ttsResolvedAt);
          if (userId && Platform.OS === 'web') {
            const r = getSessionLogRuntime();
            markLastAudioSessionEventType('audio_session_deactivation_confirmed');
            writeAudioSessionLog({
              userId,
              attemptId: r.attemptId,
              eventType: 'audio_session_deactivation_confirmed',
              eventData: {
                deactivation_succeeded: true,
                deactivation_timestamp: ttsResolvedAt,
                time_since_tts_completion_ms: 0,
                recording_session_active: r.recordingSessionActive,
              },
              platform: r.platform,
            });
            scheduleWebMicPreInitRefreshAfterTtsCompletes();
          }
        }
        return;
      }

      let ttsQueuedPendingTabReturn = false;
      let gestureRestoredAfterTabSwitchForThisPlayback = false;

      if (
        Platform.OS === 'web' &&
        effectiveTtsTriggerSource === 'preauthorized_element' &&
        !skipGestureGate
      ) {
        const needsTabReauth =
          (typeof document !== 'undefined' && document.visibilityState !== 'visible') ||
          needsGestureRestoreRef.current ||
          tabVisibilityGestureLossPendingRef.current ||
          gestureContextLostAtRef.current?.reason === 'tab_visibility_change';
        if (needsTabReauth && typeof document !== 'undefined') {
          if (document.visibilityState !== 'visible') {
            ttsQueuedPendingTabReturn = true;
            await new Promise<void>((resolve) => {
              const onVis = () => {
                if (document.visibilityState === 'visible') {
                  document.removeEventListener('visibilitychange', onVis);
                  resolve();
                }
              };
              document.addEventListener('visibilitychange', onVis);
            });
          }
          await reauthorizePendingPreAuthorizedElement();
          needsGestureRestoreRef.current = false;
          tabVisibilityGestureLossPendingRef.current = false;
          gestureContextLostAtRef.current = null;
          setWebTabGestureRestoreOverlay(false);
          pendingGestureRestoreSpeakRef.current = null;
          gestureRestoredAfterTabSwitchForThisPlayback = true;
          if (userId) {
            const r = getSessionLogRuntime();
            writeSessionLog({
              userId,
              attemptId: r.attemptId,
              eventType: 'gesture_restored_after_tab_switch',
              eventData: { gesture_restored_after_tab_switch: true },
              platform: r.platform,
            });
          }
        }
      }

      if (
        Platform.OS === 'web' &&
        !skipGestureGate &&
        needsGestureRestoreRef.current &&
        interviewStatusRef.current === 'in_progress'
      ) {
        return new Promise<void>((resolve, reject) => {
          pendingGestureRestoreSpeakRef.current = {
            text,
            options: { ...options },
            resolve,
            reject,
          };
          setWebTabGestureRestoreOverlay(true);
        });
      }
      const telemetrySource =
        telemetrySourceOpt ?? (interviewSpeechRole === 'assistant_response' ? 'turn' : 'other');
      const markIntro =
        interviewSpeechRole === 'assistant_response' &&
        detectActiveScenarioFromMessage(stripControlTokens(text).trim()) !== null;
      if (markIntro) setScenarioIntroTtsPlaying(true);
      const rt0 = getSessionLogRuntime();
      const ttsPlaybackActiveImmediatelyPrior = rt0.ttsPlaybackActive;
      if (ttsPlaybackActiveImmediatelyPrior) {
        const deadline = Date.now() + 500;
        while (getSessionLogRuntime().ttsPlaybackActive && Date.now() < deadline) {
          await new Promise<void>((res) => setTimeout(res, 40));
        }
        if (getSessionLogRuntime().ttsPlaybackActive) {
          if (userId) {
            writeSessionLog({
              userId,
              attemptId: rt0.attemptId,
              eventType: 'tts_playback_prior_turn_still_active',
              eventData: {
                telemetry_source: telemetrySource,
                waited_ms: 500,
              },
              platform: rt0.platform,
            });
          }
          setTtsPlaybackActive(false);
        }
      }
      if (getSessionLogRuntime().recordingSessionActive) {
        if (userId) {
          writeSessionLog({
            userId,
            attemptId: rt0.attemptId,
            eventType: 'recording_session_not_released_before_tts',
            eventData: { telemetry_source: telemetrySource },
            platform: rt0.platform,
          });
        }
        setRecordingSessionActive(false);
      }
      const priorRec = recordingJustFinishedBeforeNextTtsRef.current;
      recordingJustFinishedBeforeNextTtsRef.current = false;
      if (priorRec) {
        await applyPlaybackBridgeBeforeTtsIfIos('speakTextSafe');
      }
      prepareTtsPlaybackTelemetryState({
        charCount: stripControlTokens(text).trim().length,
        telemetryIsGreeting: telemetrySource === 'greeting',
        isWeb: Platform.OS === 'web',
      });
      const ttsStart = Date.now();
      if (userId) {
        setTtsPlaybackActive(true);
        ttsLineInFlightRef.current = true;
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        const ua = nav as Navigator & { userActivation?: { isActive?: boolean } } | undefined;
        const gestureContextActive =
          Platform.OS === 'web' ? ua?.userActivation?.isActive === true : null;
        const webUnlock = Platform.OS === 'web' ? isWebInterviewAudioUnlocked() : true;
        const webTtsGestureErrorPrevented =
          Platform.OS === 'web'
            ? webUnlock && (gestureContextActive === true || mobileWebTapToBeginDone)
            : null;
        if (Platform.OS === 'web' && gestureContextActive === true) {
          tabVisibilityGestureLossPendingRef.current = false;
        }
        let gesture_context_lost_reason: GestureContextLostReason | undefined;
        if (Platform.OS === 'web' && gestureContextActive === false) {
          if (effectiveTtsTriggerSource === 'preauthorized_element') {
            gestureContextLostAtRef.current = null;
            tabVisibilityGestureLossPendingRef.current = false;
          } else {
            const lostAt = gestureContextLostAtRef.current;
            if (lostAt != null && Date.now() - lostAt.atMs < 120_000) {
              gesture_context_lost_reason = lostAt.reason;
              gestureContextLostAtRef.current = null;
              if (lostAt.reason === 'tab_visibility_change') {
                tabVisibilityGestureLossPendingRef.current = false;
              }
            } else if (tabVisibilityGestureLossPendingRef.current) {
              gesture_context_lost_reason = 'tab_visibility_change';
              tabVisibilityGestureLossPendingRef.current = false;
            } else if (
              getLastWebInterviewUserGestureMs() != null &&
              getLastGestureMountGeneration() !== getAriaScreenMountGeneration()
            ) {
              gesture_context_lost_reason = 'component_remount';
            } else if (effectiveTtsTriggerSource === 'gesture_handler') {
              /* Direct gesture — omit gesture_context_lost_reason. */
            } else if (effectiveTtsTriggerSource === 'effect' || effectiveTtsTriggerSource === 'timeout') {
              gesture_context_lost_reason = 'tts_called_from_effect';
            } else {
              gesture_context_lost_reason = 'async_gap_in_tts_chain';
            }
          }
        }
        writeSessionLog({
          userId,
          attemptId: rt0.attemptId,
          eventType: 'tts_playback_start',
          eventData: {
            ...gatherTtsPlaybackTelemetry({ ttsPlaybackActiveImmediatelyPrior }),
            telemetry_source: telemetrySource,
            tts_buffer_complete_before_playback: consumeTtsBufferCompleteBeforePlaybackFlag(),
            playback_strategy: consumeTtsPlaybackStrategyForNextPlayback(),
            gesture_context_active: gestureContextActive,
            web_tts_gesture_error_prevented: webTtsGestureErrorPrevented,
            tts_trigger_source: effectiveTtsTriggerSource,
            ...(ttsQueuedPendingTabReturn ? { tts_queued_pending_tab_return: true } : {}),
            ...(gestureRestoredAfterTabSwitchForThisPlayback
              ? { gesture_restored_after_tab_switch: true }
              : {}),
            ...(gesture_context_lost_reason != null ? { gesture_context_lost_reason } : {}),
          },
          platform: rt0.platform,
        });
      }
      try {
        const speakOutcome = await withRetry(
          () =>
            speak(text, {
              telemetrySource,
              skipQuestionTiming,
              skipLastQuestionRef,
              ttsTriggerSource: effectiveTtsTriggerSource,
            }),
          {
            retries: 1,
            baseDelay: 3000,
            context: 'TTS',
            sessionLog:
              userId ? { userId, attemptId: rt0.attemptId, platform: rt0.platform } : undefined,
          }
        );
        setTTSFallbackActive(false);
        const actualTtsMs = Date.now() - ttsStart;
        const charCount = stripControlTokens(text).trim().length;
        const { expectedMs: expectedTtsMs, calculationMethod: expectedDurationCalculationMethod } =
          getTtsExpectedDurationMsFromCharCount(charCount);
        const durRatio = recordTtsTurnDurationRatio(actualTtsMs, expectedTtsMs);
        const durationMatch = isTtsDurationMatchWithinOverrunTolerance(actualTtsMs, expectedTtsMs);
        if (userId) {
          const rtp = getSessionLogRuntime();
          markLastAudioSessionEventType('tts_playback_complete');
          writeSessionLog({
            userId,
            attemptId: rtp.attemptId,
            eventType: 'tts_playback_complete',
            eventData: { telemetry_source: telemetrySource },
            durationMs: actualTtsMs,
            platform: rtp.platform,
          });
          writeAudioSessionLog({
            userId,
            attemptId: rtp.attemptId,
            eventType: 'tts_playback_duration',
            eventData: {
              expected_duration_ms: expectedTtsMs,
              actual_duration_ms: actualTtsMs,
              duration_match: durationMatch,
              expected_duration_calculation_method: expectedDurationCalculationMethod,
              completion_via: 'callback',
              moment_number: currentInterviewMomentRef.current,
            },
            durationMs: actualTtsMs,
            platform: rtp.platform,
          });
          if (speakOutcome && 'scenarioSplitDelivery' in speakOutcome && speakOutcome.scenarioSplitDelivery) {
            writeAudioSessionLog({
              userId,
              attemptId: rtp.attemptId,
              eventType: 'tts_split_delivery',
              eventData: {
                userId,
                telemetry_source: telemetrySource,
                moment_number: currentInterviewMomentRef.current,
                segment1_expected_duration_ms: speakOutcome.scenarioSplitDelivery.segment1_expected_duration_ms,
                segment2_expected_duration_ms: speakOutcome.scenarioSplitDelivery.segment2_expected_duration_ms,
              },
              platform: rtp.platform,
            });
          }
          if (durRatio) {
            writeAudioSessionLog({
              userId,
              attemptId: rtp.attemptId,
              eventType: 'tts_duration_estimation_ratio',
              eventData: {
                expected_duration_ms: expectedTtsMs,
                actual_duration_ms: actualTtsMs,
                ratio_actual_to_expected: durRatio.ratio,
                calibration_adjusted: durRatio.calibration_adjusted,
                calibration_skip_reason: durRatio.calibration_skip_reason,
                previous_multiplier_ms_per_char: durRatio.previous_multiplier_ms_per_char,
                new_multiplier_ms_per_char: durRatio.new_multiplier_ms_per_char,
                moment_number: currentInterviewMomentRef.current,
                ...(durRatio.calibration_adjustment_detail
                  ? { calibration_adjustment_detail: durRatio.calibration_adjustment_detail }
                  : {}),
              },
              platform: rtp.platform,
            });
            if (durRatio.calibration_escape_applied) {
              writeAudioSessionLog({
                userId,
                attemptId: rtp.attemptId,
                eventType: 'calibration_escape_applied',
                eventData: {
                  previous_multiplier_ms_per_char: durRatio.previous_multiplier_ms_per_char,
                  new_multiplier_ms_per_char: durRatio.new_multiplier_ms_per_char,
                  rolling_avg_ratio: durRatio.calibration_adjustment_detail?.rolling_avg_ratio ?? null,
                  moment_number: currentInterviewMomentRef.current,
                },
                platform: rtp.platform,
              });
            }
          }
        }
        const isInterviewLine =
          !skipQuestionDeliveredTelemetry &&
          (interviewSpeechRole === 'assistant_response' || telemetrySource === 'turn');
        if (isInterviewLine && userId) {
          const rtd = getSessionLogRuntime();
          const deliveredQuestionText = stripControlTokens(text).trim().slice(0, 2000);
          writeSessionLog({
            userId,
            attemptId: rtd.attemptId,
            eventType: 'question_delivered',
            eventData: {
              moment_number: currentInterviewMomentRef.current,
              scenario_number: currentScenarioRef.current,
              question_text: deliveredQuestionText,
              delivered_at: new Date().toISOString(),
              ...(ttsPipeline ? { tts_pipeline: ttsPipeline } : {}),
            },
            platform: rtd.platform,
          });
          const sn = currentScenarioRef.current;
          if (
            !firstScenarioLifecyclePersistedRef.current &&
            sn != null &&
            sn >= 1 &&
            sn <= 3
          ) {
            firstScenarioLifecyclePersistedRef.current = true;
            void persistInterviewAttemptSessionLifecycle(interviewSessionAttemptIdRef.current, 'in_progress');
          }
        }
        if (interviewSpeechRole === 'assistant_response' && !skipInterviewSpeechAdvance) {
          applyInterviewSpeechComplete(text);
        }
      } catch (err) {
        if (isWebTtsRequiresUserGestureError(err)) {
          // #region agent log
          fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
            body: JSON.stringify({
              sessionId: 'e70f17',
              location: 'AriaScreen.tsx:speakTextSafe',
              message: 'gesture_error_caught',
              data: {
                hypothesisId: 'H2',
                instanceofOk: err instanceof WebTtsRequiresUserGestureError,
                duckOk: isWebTtsRequiresUserGestureError(err),
                errName: err instanceof Error ? err.name : 'unknown',
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          // #region agent log
          fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
            body: JSON.stringify({
              sessionId: 'c61a43',
              location: 'AriaScreen.tsx:speakTextSafe',
              message: 'gesture_overlay_trigger',
              data: {
                hypothesisId: 'H6',
                isWebInterviewAudioUnlocked: isWebInterviewAudioUnlocked(),
                deferGesture: webSpeechShouldDeferToUserGesture(),
                maxTouchPoints:
                  Platform.OS === 'web' && typeof navigator !== 'undefined'
                    ? navigator.maxTouchPoints
                    : null,
              },
              timestamp: Date.now(),
              runId: 'debug-desktop-tap',
            }),
          }).catch(() => {});
          // #endregion
          setPendingWebSpeechGesturePair(pendingWebSpeechForGestureRef, err.text);
          ensureWebGestureFlushListener();
          /** Mobile Safari/Android web block async TTS without a gesture — same as desktop, show an explicit tap/click overlay (not only a one-time window listener). */
          if (Platform.OS === 'web') {
            setWebDesktopPendingTtsGestureOverlay(true);
          }
          setVoiceState('idle');
          if (!silent) setTTSFallbackActive(false);
          if (interviewSpeechRole === 'assistant_response' && !skipInterviewSpeechAdvance) {
            applyInterviewSpeechComplete(text);
          }
        } else {
          if (__DEV__) console.warn('TTS failed, falling back to visual display:', err instanceof Error ? err.message : err);
          if (!silent) setTTSFallbackActive(true);
          setVoiceState('idle');
          // Same advance as success path so reference card + SHOW SCENARIO work when user reads the line on screen.
          if (interviewSpeechRole === 'assistant_response' && !skipInterviewSpeechAdvance) {
            applyInterviewSpeechComplete(text);
          }
        }
      } finally {
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H5',location:'AriaScreen.tsx:speakTextSafe:finally',message:'speak_text_safe_finally_reached',data:{voiceStateBeforeIdleSet:voiceStateRef.current,markIntro,userIdPresent:!!userId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (userId) {
          setTtsPlaybackActive(false);
          ttsLineInFlightRef.current = false;
        }
        if (markIntro) setScenarioIntroTtsPlaying(false);
        const ttsResolvedAt = Date.now();
        setLastTtsCompletionCallbackMs(ttsResolvedAt);
        if (userId && Platform.OS === 'web') {
          const r = getSessionLogRuntime();
          markLastAudioSessionEventType('audio_session_deactivation_confirmed');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'audio_session_deactivation_confirmed',
            eventData: {
              deactivation_succeeded: true,
              deactivation_timestamp: ttsResolvedAt,
              time_since_tts_completion_ms: 0,
              recording_session_active: r.recordingSessionActive,
            },
            platform: r.platform,
          });
          scheduleWebMicPreInitRefreshAfterTtsCompletes();
        }
      }
    },
    [
      speak,
      applyInterviewSpeechComplete,
      ensureWebGestureFlushListener,
      userId,
      webSpeechShouldDeferToUserGesture,
      mobileWebTapToBeginDone,
      awaitTtsScreenReadyGate,
    ]
  );

  const handleWebTabGestureRestoreTap = useCallback(() => {
    markWebInterviewUserGestureNow();
    setMobileWebTapToBeginDone(true);
    const pending = pendingGestureRestoreSpeakRef.current;
    pendingGestureRestoreSpeakRef.current = null;
    needsGestureRestoreRef.current = false;
    setWebTabGestureRestoreOverlay(false);
    const uid = userIdRef.current;
    if (uid) {
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId: uid,
        attemptId: r.attemptId,
        eventType: 'gesture_restored_after_tab_switch',
        eventData: { gesture_restored_after_tab_switch: true },
        platform: r.platform,
      });
    }
    if (pending) {
      void speakTextSafe(pending.text, {
        ...pending.options,
        skipGestureGate: true,
        ttsTriggerSource: 'gesture_handler',
      })
        .then(pending.resolve)
        .catch(pending.reject);
    }
  }, [speakTextSafe]);

  const docVisibilityWasHiddenRef = useRef(false);
  useEffect(() => {
    bumpAriaScreenMountGeneration();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        docVisibilityWasHiddenRef.current = true;
        if (interviewStatusRef.current === 'in_progress') {
          gestureContextLostAtRef.current = { atMs: Date.now(), reason: 'tab_visibility_change' };
          pauseWebInterviewHtmlAudioForDocumentHidden();
          // #region agent log
          if (isWebInterviewPlaybackSurfaceActive()) {
            fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
              body: JSON.stringify({
                sessionId: 'c61a43',
                location: 'AriaScreen.tsx:docVisibility:hidden',
                message: 'tab_hidden_html_paused_web_surface_still_active',
                data: {
                  hypothesisId: 'H21',
                  interviewStatus: interviewStatusRef.current,
                  ttsLineInFlight: ttsLineInFlightRef.current,
                },
                timestamp: Date.now(),
                runId: 'static-debug-pre',
              }),
            }).catch(() => {});
          }
          // #endregion
        }
      } else if (document.visibilityState === 'visible' && docVisibilityWasHiddenRef.current) {
        docVisibilityWasHiddenRef.current = false;
        if (interviewStatusRef.current === 'in_progress') {
          needsGestureRestoreRef.current = true;
          tabVisibilityGestureLossPendingRef.current = true;
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── Web: browser SpeechRecognition (hold-to-talk fallback when Whisper/MediaRecorder is off)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (useMediaRecorderPath) {
      setMicError((prev) =>
        prev === 'Speech recognition is not supported. Please use Chrome or Safari.' ? null : prev
      );
      return;
    }
    const SR = (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) {
      setMicError('Speech recognition is not supported. Please use Chrome or Safari.');
      return;
    }
    const rec = new SR() as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      maxAlternatives: number;
      start(): void;
      stop(): void;
      onresult: (e: unknown) => void;
      onerror: (e: { error: string }) => void;
    };
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;
    rec.onresult = (e: unknown) => {
      const ev = e as { resultIndex: number; results: Array<{ isFinal: boolean; [i: number]: { transcript?: string } }> };
      let interim = '';
      let final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const t = (r && typeof r === 'object' && r[0]?.transcript) ?? '';
        if (r?.isFinal) final += t;
        else interim += t;
      }
      setCurrentTranscript((prev) => (final || interim || prev).trim());
      transcriptAtReleaseRef.current = (final || interim).trim();
    };
    rec.onerror = (e) => {
      console.log('<---e', e);
      if (e.error === 'not-allowed') {
        setMicError('Microphone access was denied.');
      } else if (e.error === 'aborted') {
        // User or we stopped; ignore
      } else if (e.error === 'network' || e.error === 'no-speech') {
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            location: 'AriaScreen.tsx:SpeechRecognition:onerror',
            message: 'web_speech_recognition_error',
            data: {
              hypothesisId: 'H3',
              error: e.error,
              useMediaRecorderPath,
            },
            timestamp: Date.now(),
            runId: 'speech-detect-debug',
          }),
        }).catch(() => {});
        // #endregion
        setMicWarning(
          e.error === 'network'
            ? 'Connection problem. Check your internet and try again.'
            : 'No speech heard. Try again when ready.'
        );
      } else {
        setMicError(`Microphone error: ${e.error}`);
      }
    };
    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, [useMediaRecorderPath]);

  const fetchStageScore = useCallback(async (finalMessages: { role: string; content: string }[]): Promise<InterviewResults> => {
    const context = typologyContext || 'No typology context — score from transcript only.';
    const fallback: InterviewResults = {
      pillarScores: { ...FALLBACK_MARKER_SCORES_MID },
      keyEvidence: {},
      narrativeCoherence: 'moderate',
      behavioralSpecificity: 'moderate',
      notableInconsistencies: [],
      interviewSummary: 'Partial score (no API key or error).',
    };
    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) return fallback;
    const apiUrl = getAnthropicEndpoint();
    const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (useProxy && SUPABASE_ANON_KEY) headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    else if (!useProxy) {
      headers['x-api-key'] = ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role: 'user', content: buildScoringPrompt(finalMessages, context) }],
        }),
      });
      const data = await res.json();
      const raw = (data.content?.[0]?.text ?? '{}') as string;
      return parseJsonObjectFromModelText(raw) as InterviewResults;
    } catch {
      return fallback;
    }
  }, [typologyContext]);

  const saveScenarioCheckpoint = useCallback(
    async (
      scenarioNumber: 1 | 2 | 3,
      result: ScenarioScoreResult,
      allMessages: { role: string; content: string }[],
      uid: string
    ) => {
      if (!uid) return;
      const transcriptSnapshot = allMessages.filter((m) => !(m as { isScoreCard?: boolean }).isScoreCard);
      try {
        const updateData: Record<string, unknown> = {
          [`interview_scenario_${scenarioNumber}_scores`]: {
            pillarScores: result.pillarScores,
            pillarConfidence: result.pillarConfidence,
            keyEvidence: result.keyEvidence,
            scenarioName: result.scenarioName,
          },
          interview_transcript: transcriptSnapshot,
          interview_last_checkpoint: scenarioNumber,
        };
        const { error } = await supabase.from('users').update(updateData).eq('id', uid);
        if (error) console.error(`Failed to save scenario ${scenarioNumber} checkpoint:`, error);
      } catch (err) {
        console.error('Checkpoint save error:', err);
      }
    },
    []
  );

  const scoreScenario = useCallback(
    async (scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[]) => {
      if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) return;
      const userMessages = allMessages.filter((m) => m.role === 'user');
      if (userMessages.length < 2 && __DEV__) {
        console.warn(
          `Scenario ${scenarioNumber} scored with insufficient user messages (${userMessages.length}) — both-characters answer may be missing. Token may have fired before the answer was received.`
        );
      }
      const apiUrl = getAnthropicEndpoint();
      const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (useProxy && SUPABASE_ANON_KEY) headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
      else if (!useProxy) {
        headers['x-api-key'] = ANTHROPIC_API_KEY;
        headers['anthropic-version'] = '2023-06-01';
      }
      const commitmentFocusForPrompt =
        scenarioNumber === 3
          ? scenarioCCommitmentOnlyEvidenceRef.current?.trim() ||
            extractScenario3CommitmentThresholdUserAnswerAfterPrompt(allMessages as ScenarioCorpusMessageSlice[]) ||
            null
          : null;
      const repairFocusForPrompt =
        scenarioNumber === 3
          ? scenarioCRepairOnlyEvidenceRef.current?.trim() ||
            extractScenario3UserCorpusAfterLastRepairPrompt(allMessages as ScenarioCorpusMessageSlice[]) ||
            null
          : null;
      const priorMentalizingForScenario3 =
        scenarioNumber === 3
          ? {
              s1: scenarioScoresRef.current[1]?.pillarScores?.mentalizing ?? undefined,
              s2: scenarioScoresRef.current[2]?.pillarScores?.mentalizing ?? undefined,
            }
          : null;
      const scoringT0 = Date.now();
      if (userId) {
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'scoring_start',
          eventData: { scenario_number: scenarioNumber },
          platform: r.platform,
        });
      }
      try {
        const scenarioResult = await withRetry(
          async (): Promise<ScenarioScoreResult> => {
            const res = await fetch(apiUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 800,
                messages: [
                  {
                    role: 'user',
                    content: buildScenarioScoringPrompt(
                      scenarioNumber,
                      allMessages,
                      commitmentFocusForPrompt,
                      priorMentalizingForScenario3,
                      repairFocusForPrompt
                    ),
                  },
                ],
              }),
            });
            const data = await res.json();
            const raw = (data.content?.[0]?.text ?? '{}') as string;
            if (!res.ok) {
              const e = new Error((data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
              (e as Error & { status?: number }).status = res.status;
              throw e;
            }
            const parsedScenario = parseJsonObjectFromModelText(raw) as ScenarioScoreResult;
            parsedScenario.pillarScores = normalizeScoresByEvidence(
              parsedScenario.pillarScores,
              parsedScenario.keyEvidence
            );
            const scenarioUserText = userTurnTextForInterviewScenario(allMessages, scenarioNumber);
            const heur = applyContemptExpressionHeuristicToScenarioScores(
              scenarioUserText,
              parsedScenario.pillarScores ?? {},
              parsedScenario.keyEvidence
            );
            parsedScenario.pillarScores = heur.pillarScores as ScenarioScoreResult['pillarScores'];
            parsedScenario.keyEvidence = heur.keyEvidence as ScenarioScoreResult['keyEvidence'];
            return parsedScenario;
          },
          {
            retries: 3,
            baseDelay: 5000,
            maxDelay: 30000,
            context: `scoring scenario ${scenarioNumber}`,
            onUnrecoverable: (err) => {
              if (__DEV__) {
                const status = (err as { status?: number })?.status;
                console.error(`Scoring unrecoverable error (scenario ${scenarioNumber}):`, status);
              }
            },
            sessionLog: userId
              ? {
                  userId,
                  attemptId: getSessionLogRuntime().attemptId,
                  platform: getSessionLogRuntime().platform,
                }
              : undefined,
          }
        );
        if (userId) {
          const r = getSessionLogRuntime();
          writeSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'scoring_complete',
            eventData: { scenario_number: scenarioNumber },
            durationMs: Date.now() - scoringT0,
            platform: r.platform,
          });
        }
        if (scenarioNumber === 3) {
          if (commitmentFocusForPrompt?.trim()) {
            void remoteLog('[SC3_MISPLACED_THRESHOLD_SEQUENCE]', {
              phase: 'scenario_3_scored_with_commitment_focus',
              interviewSessionId: interviewSessionIdRef.current,
              usedCommitmentFocus: true,
            });
          }
          scenarioCCommitmentOnlyEvidenceRef.current = null;
          scenarioCRepairOnlyEvidenceRef.current = null;
        }
        const scoreMessage = formatScoreMessage(scenarioResult);
        if (__DEV__) {
          console.log('[SCORECARD_FETCH_RESULT]', {
            isAdmin,
            scenarioNumber,
            scoreKeys: Object.keys(scenarioResult.pillarScores ?? {}),
            scoreMessageLength: scoreMessage.length,
          });
        }
        void remoteLog('[SCORECARD_FETCH_RESULT]', {
          isAdmin,
          scenarioNumber,
          scoreKeys: Object.keys(scenarioResult.pillarScores ?? {}),
          scoreMessageLength: scoreMessage.length,
          userId: userId ?? null,
        });
        setScenarioScores((prev) => ({ ...prev, [scenarioNumber]: scenarioResult }));
        scenarioScoresRef.current = { ...scenarioScoresRef.current, [scenarioNumber]: scenarioResult };
        if (ALPHA_MODE) {
          const ps = scenarioResult.pillarScores ?? {};
          const vals = Object.values(ps).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
          const postScore = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          probeLogRef.current.push({
            scenario: scenarioNumber,
            construct: 'combined',
            probe_fired: false,
            trigger_reason: null,
            pre_probe_score: 0,
            post_probe_score: Math.round(postScore * 10) / 10,
            score_delta: Math.round(postScore * 10) / 10,
          });
        }
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: scoreMessage, isScoreCard: true } as { role: string; content: string; isScoreCard?: boolean },
        ]);
        saveScenarioCheckpoint(scenarioNumber, scenarioResult, allMessages, userId);
      } catch (err) {
        if (__DEV__) console.error(`Scoring failed for scenario ${scenarioNumber}:`, err instanceof Error ? err.message : err);
        const saved = await loadInterviewFromStorage(userId);
        if (saved) {
          const scoringFailed = [...(saved.scoringFailed ?? []), { scenario: scenarioNumber, failedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) }];
          await saveInterviewProgress(userId, { ...saved, scoringFailed });
        }
      }
    },
    [isAdmin, userId, saveScenarioCheckpoint]
  );

  const processUserSpeech = useCallback(async (spokenText: string) => {
    if (!spokenText.trim()) {
      setVoiceState('idle');
      return;
    }
    const trimmed = spokenText.trim();
    let participantFirstNameForSpoken = getInterviewUserFirstNameForPrompt(profile);
    const routeChangedDuringRecordingSnap = routeChangedDuringRecordingRef.current;
    routeChangedDuringRecordingRef.current = false;
    let reentryTypeForLogging: 'repeat_requested' | 'continue_requested' | 'direct_answer' | null = null;
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        runId: 'pre-fix',
        hypothesisId: 'H13',
        location: 'AriaScreen.tsx:processUserSpeech',
        message: 'process_user_speech_name_snapshot',
        data: {
          spokenText: trimmed.slice(0, 120),
          resumeGatePending: resumeRepeatChoicePendingRef.current,
          participantFirstNameForSpoken: participantFirstNameForSpoken || null,
          profileHasBasicInfoFirstName: !!profile?.basicInfo?.firstName,
          profileHasName: !!profile?.name,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (userId) {
      const rtd = getSessionLogRuntime();
      writeSessionLog({
        userId,
        attemptId: rtd.attemptId,
        eventType: 'name_source_debug',
        eventData: {
          stage: 'process_user_speech',
          resume_gate_pending: resumeRepeatChoicePendingRef.current,
          profile_has_basic_info_first_name: !!profile?.basicInfo?.firstName,
          profile_has_name: !!profile?.name,
          participant_first_name_present: !!participantFirstNameForSpoken,
          participant_first_name_length: participantFirstNameForSpoken.length,
        },
        platform: rtd.platform,
      });
    }

    if (resumeRepeatChoicePendingRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'AriaScreen.tsx:processUserSpeech',
          message: 'resume_gate_entry',
          data: {
            spokenText: trimmed.slice(0, 120),
            pendingBefore: true,
            lastAssistantPreview: (resumeLastAssistantTextRef.current ?? '').slice(0, 120),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      resumeRepeatChoicePendingRef.current = false;
      let intent = classifyResumeRepeatIntent(trimmed);
      const resumeCueWordCount = countSpokenWords(trimmed);
      /** Meta cues ("go ahead", "no thanks") are short; long turns are answers, not continue/skip-repeat signals. */
      if ((intent === 'continue' || intent === 'repeat') && resumeCueWordCount > 18) {
        intent = 'ambiguous';
      }
      const directAnswer = intent === 'ambiguous' && looksLikeDirectResumeAnswer(trimmed, resumeLastAssistantTextRef.current);
      const inferredRepeatFromAmbiguous = intent === 'ambiguous' && !directAnswer && looksLikeRepeatCueInAmbiguousReply(trimmed);
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'AriaScreen.tsx:processUserSpeech',
          message: 'resume_gate_classification',
          data: { intent, directAnswer, inferredRepeatFromAmbiguous },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (intent === 'repeat' || inferredRepeatFromAmbiguous) {
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            runId: 'pre-fix',
            hypothesisId: 'H3',
            location: 'AriaScreen.tsx:processUserSpeech',
            message: 'resume_gate_branch_repeat',
            data: {},
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        reentryTypeForLogging = 'repeat_requested';
        if (userId) {
          const r = getSessionLogRuntime();
          const deliveredAt = r.lastQuestionDeliveredAt;
          let latencyMs: number | null = null;
          if (deliveredAt) {
            const t = Date.parse(deliveredAt);
            if (!Number.isNaN(t)) latencyMs = Math.max(0, Date.now() - t);
          }
          writeSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'response_received',
            eventData: {
              moment_number: currentInterviewMomentRef.current,
              word_count: countSpokenWords(trimmed),
              response_latency_ms: latencyMs,
              detected_language: lastVoiceTurnLanguageRef.current,
              transcription_confidence: lastVoiceTurnConfidenceRef.current,
              reentry_type: reentryTypeForLogging,
              route_changed_during_recording: routeChangedDuringRecordingSnap,
            },
            platform: r.platform,
          });
        }
        const last = resumeLastAssistantTextRef.current;
        if (last?.trim()) {
          await speakTextSafe(stripControlTokens(last), {
            telemetrySource: 'replay',
            skipQuestionDeliveredTelemetry: true,
            skipInterviewSpeechAdvance: true,
            skipQuestionTiming: true,
            skipLastQuestionRef: true,
          });
        }
      } else if (intent === 'continue') {
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            runId: 'pre-fix',
            hypothesisId: 'H4',
            location: 'AriaScreen.tsx:processUserSpeech',
            message: 'resume_gate_branch_continue',
            data: {},
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        reentryTypeForLogging = 'continue_requested';
        if (userId) {
          const r = getSessionLogRuntime();
          const deliveredAt = r.lastQuestionDeliveredAt;
          let latencyMs: number | null = null;
          if (deliveredAt) {
            const t = Date.parse(deliveredAt);
            if (!Number.isNaN(t)) latencyMs = Math.max(0, Date.now() - t);
          }
          writeSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'response_received',
            eventData: {
              moment_number: currentInterviewMomentRef.current,
              word_count: countSpokenWords(trimmed),
              response_latency_ms: latencyMs,
              detected_language: lastVoiceTurnLanguageRef.current,
              transcription_confidence: lastVoiceTurnConfidenceRef.current,
              reentry_type: reentryTypeForLogging,
              route_changed_during_recording: routeChangedDuringRecordingSnap,
            },
            platform: r.platform,
          });
        }
        setVoiceState('idle');
        return;
      } else {
        reentryTypeForLogging = 'direct_answer';
        // Proceed through normal answer pipeline (scoring + state advance) below.
        resumeLastAssistantTextRef.current = null;
      }
      if (reentryTypeForLogging !== 'direct_answer') {
        setVoiceState('idle');
        return;
      }
    }

    if (userId) {
      logTouchActivityForPause(
        {
          userId,
          attemptId: getSessionLogRuntime().attemptId,
          platform: getSessionLogRuntime().platform,
        },
        currentInterviewMomentRef.current
      );
      touchActivity();
      const r = getSessionLogRuntime();
      const deliveredAt = r.lastQuestionDeliveredAt;
      let latencyMs: number | null = null;
      if (deliveredAt) {
        const t = Date.parse(deliveredAt);
        if (!Number.isNaN(t)) latencyMs = Math.max(0, Date.now() - t);
      }
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'response_received',
        eventData: {
          moment_number: currentInterviewMomentRef.current,
          word_count: countSpokenWords(trimmed),
          response_latency_ms: latencyMs,
          detected_language: lastVoiceTurnLanguageRef.current,
          transcription_confidence: lastVoiceTurnConfidenceRef.current,
          reentry_type: reentryTypeForLogging,
          route_changed_during_recording: routeChangedDuringRecordingSnap,
        },
        platform: r.platform,
      });
      const wcAll = countSpokenWords(trimmed);
      if (wcAll < 10 && !isSimpleYesNoInterviewMoment(lastQuestionTextRef.current)) {
        markLastAudioSessionEventType('short_response_detected');
        writeAudioSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'short_response_detected',
          eventData: {
            word_count: wcAll,
            transcript_text: trimmed.slice(0, 2000),
            moment_number: currentInterviewMomentRef.current,
            is_repeat_turn: false,
          },
          platform: r.platform,
        });
      }
    }

    if (ALPHA_MODE && timingRef.current.recordingStartTime != null) {
      timingRef.current.recordingEndTime = Date.now();
      const qEnd = timingRef.current.questionEndTime ?? timingRef.current.recordingStartTime;
      const latency = timingRef.current.recordingStartTime - qEnd;
      const duration = (timingRef.current.recordingEndTime ?? 0) - timingRef.current.recordingStartTime;
      const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
      const scenario = getCurrentScenario(scoredScenariosRef.current);
      responseTimingsRef.current.push({
        question_id: `q_${responseTimingsRef.current.length + 1}`,
        scenario: scenario ?? null,
        question_text: lastQuestionTextRef.current,
        latency_ms: Math.max(0, latency),
        duration_ms: Math.max(0, duration),
        word_count: wordCount,
      });
      timingRef.current.recordingStartTime = null;
      timingRef.current.questionEndTime = null;
    }

    // Admin secret pass: skip interview and auto-approve for configured email (onboarding only)
    if (isInterviewAppRoute && trimmed === ADMIN_PASS_PHRASE) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = (session?.user?.email ?? '').toLowerCase();
        if (email === ADMIN_PASS_EMAIL.toLowerCase()) {
          await profileRepository.upsertProfile(userId, {
            applicationStatus: 'approved',
            onboardingStage: 'complete',
          });
          queryClient.invalidateQueries({ queryKey: ['profile', userId] });
          setVoiceState('idle');
          const adminPassGate = computeGateResult({ ...FALLBACK_MARKER_SCORES_ALL_MARKERS });
          setResults({
            pillarScores: { ...FALLBACK_MARKER_SCORES_ALL_MARKERS },
            keyEvidence: {},
            narrativeCoherence: 'high',
            behavioralSpecificity: 'high',
            notableInconsistencies: [],
            interviewSummary: 'Admin pass — interview skipped. Scores are illustrative.',
            gateResult: adminPassGate,
          });
          setInterviewStatus('congratulations');
          setStatus('results');
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not skip interview.';
        showSimpleAlert('Admin pass failed', msg);
        setVoiceState('idle');
        return;
      }
    }

    const priorUserUtteranceCount = messages.filter(
      (m) => m.role === 'user' && !(m as { isWelcomeBack?: boolean }).isWelcomeBack
    ).length;
    const isGreetingNameTurn =
      isInterviewAppRoute &&
      priorUserUtteranceCount === 0 &&
      !getInterviewUserFirstNameForPrompt(profile) &&
      looksLikeName(trimmed);
    if (isGreetingNameTurn) {
      try {
        const nameToSave = nameFromGreetingForProfile(trimmed);
        if (nameToSave) {
          await profileRepository.upsertProfile(userId, { name: nameToSave });
          queryClient.invalidateQueries({ queryKey: ['profile', userId] });
          // Same turn still uses in-memory profile until query refetch — resolve name for this pipeline.
          participantFirstNameForSpoken = getInterviewUserFirstNameForPrompt({ ...profile, name: nameToSave });
        }
      } catch (_) {
        // ignore
      }
    }

    // ━━━ INTERCEPT 1: Waiting for closing addition (after "yes") — never send to Claude
    if (waitingForClosingAdditionRef.current !== null) {
      const scenarioNumber = waitingForClosingAdditionRef.current as 1 | 2 | 3;
      waitingForClosingAdditionRef.current = null;
      setClosingQuestionPending(false);
      setClosingQuestionScenario(null);
      const userMsgAdd: MessageWithScenario = {
        role: 'user',
        content: trimmed,
        scenarioNumber,
      };
      const newMessagesAdd = [...messages, userMsgAdd];
      setMessages(newMessagesAdd);
      setCurrentTranscript('');
      transcriptAtReleaseRef.current = '';
      setVoiceState('processing');
      const lower = trimmed.toLowerCase().trim();
      const isWithdrawal = [
        'nevermind', 'never mind', 'forget it', "it's fine", 'its fine',
        'nothing', 'no', 'lets move on', "let's move on", 'actually no', 'nvm', 'skip it', "doesn't matter", 'not important',
      ].some((p) => lower.includes(p)) || lower.length < 3;
      const ackMsg: MessageWithScenario = isWithdrawal
        ? { role: 'assistant', content: 'No worries.', scenarioNumber }
        : { role: 'assistant', content: generateBriefAck(trimmed), scenarioNumber };
      const messagesAfterAck = [...newMessagesAdd, ackMsg];
      setMessages(messagesAfterAck);
      await speakTextSafe(ackMsg.content);
      markClosingQuestionAnswered(scenarioNumber);
      let nextContent = '';
      if (scenarioNumber === 1) {
        interviewMomentsCompleteRef.current[1] = true;
        currentInterviewMomentRef.current = 2;
        nextContent = buildScenario1To2BundleForInterview(participantFirstNameForSpoken, SCENARIO_2_TEXT);
      } else if (scenarioNumber === 2) {
        interviewMomentsCompleteRef.current[2] = true;
        currentInterviewMomentRef.current = 3;
        nextContent = buildScenario2To3TransitionBody(participantFirstNameForSpoken, SCENARIO_3_TEXT);
      }
      if (scenarioNumber === 3) {
        if (personalHandoffInjectedRef.current) {
          if (__DEV__) console.warn('[Aria] Duplicate Moment 4 handoff after closing addition — skipped');
        } else {
          personalHandoffInjectedRef.current = true;
          interviewMomentsCompleteRef.current[3] = true;
          currentInterviewMomentRef.current = 4;
          const moment4Handoff = buildMoment4HandoffForInterview(participantFirstNameForSpoken, MOMENT_4_PERSONAL_CARD);
          const handoffMsg: MessageWithScenario = { role: 'assistant', content: moment4Handoff, scenarioNumber: 3 };
          const withHandoff = [...messagesAfterAck, handoffMsg];
          setMessages(withHandoff);
          await speakTextSafe(moment4Handoff, ASSISTANT_INTERVIEW_SPEECH);
        }
      } else {
        const transitionMsg: MessageWithScenario = { role: 'assistant', content: nextContent, scenarioNumber: scenarioNumber === 1 ? 2 : 3 };
        currentScenarioRef.current = scenarioNumber === 1 ? 2 : 3;
        const withTransition = [...messagesAfterAck, transitionMsg];
        setMessages(withTransition);
        await speakTextSafe(nextContent, ASSISTANT_INTERVIEW_SPEECH);
      }
      const transcriptEndForScoring =
        scenarioNumber === 3
          ? messagesAfterAck
          : [...messagesAfterAck, { role: 'assistant', content: nextContent, scenarioNumber: scenarioNumber === 1 ? 2 : 3 }];
      setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
      if (!scoredScenariosRef.current.has(scenarioNumber)) {
        scoredScenariosRef.current.add(scenarioNumber);
        scoreScenario(scenarioNumber, transcriptEndForScoring);
      }
      if (__DEV__) {
        closingQuestionAskedRef.current[scenarioNumber] = false;
        closingQuestionAnsweredRef.current[scenarioNumber] = false;
      }
      lastAnsweredClosingScenarioRef.current = null;
      setVoiceState('idle');
      return;
    }

    // ━━━ INTERCEPT 2: Closing question answer — never send to Claude
    const pendingScenarioFromRef = lastClosingQuestionScenarioRef.current;
    const pendingScenarioFromState = closingQuestionScenario;
    if (pendingScenarioFromRef !== null || closingQuestionPending) {
      const pendingClosingScenario = (pendingScenarioFromRef ?? pendingScenarioFromState ?? 1) as 1 | 2 | 3;
      setClosingQuestionPending(false);
      setClosingQuestionScenario(null);
      const userMsgClosing: MessageWithScenario = {
        role: 'user',
        content: trimmed,
        scenarioNumber: pendingClosingScenario,
      };
      const newMessagesClosing = [...messages, userMsgClosing];
      setMessages(newMessagesClosing);
      setCurrentTranscript('');
      transcriptAtReleaseRef.current = '';
      setVoiceState('processing');
      const lower = trimmed.toLowerCase().trim();
      const isAffirmative = [
        'yes', 'yeah', 'yep', 'yup', 'sure', 'actually', 'there is', 'there was',
        'one thing', 'i wanted to', 'i do', 'kind of', 'a bit', 'sort of',
      ].some((p) => lower.includes(p)) || /^\s*yes\s*\.?\s*$/i.test(trimmed);
      const isNo = ['no', 'nope', 'nothing', "i'm good", 'im good', "that's all", 'thats all', 'nevermind', 'never mind', 'all good', 'nothing else', 'nah', 'nothin'].some((p) => lower.includes(p)) ||
        (lower.length < 4 && !isAffirmative);
      const isYes = isAffirmative && !isNo;

      if (isYes && trimmed.length < 20) {
        lastClosingQuestionScenarioRef.current = null;
        waitingForClosingAdditionRef.current = pendingClosingScenario;
        const followUp = 'What would you want to add?';
        const followUpMsg: MessageWithScenario = { role: 'assistant', content: followUp, scenarioNumber: pendingClosingScenario };
        setMessages([...newMessagesClosing, followUpMsg]);
        await speakTextSafe(followUp, ASSISTANT_INTERVIEW_SPEECH);
        setVoiceState('idle');
        return;
      }

      let messagesAfterClosingAnswer = newMessagesClosing;
      if (isYes && trimmed.length >= 20) {
        const ackText = generateBriefAck(trimmed);
        const ackMsg: MessageWithScenario = { role: 'assistant', content: ackText, scenarioNumber: pendingClosingScenario };
        messagesAfterClosingAnswer = [...newMessagesClosing, ackMsg];
        setMessages(messagesAfterClosingAnswer);
        await speakTextSafe(ackText);
      }

      markClosingQuestionAnswered(pendingClosingScenario);
      lastClosingQuestionScenarioRef.current = null;
      const scenarioNumber = pendingClosingScenario;
      let nextClosingContent = '';
      if (scenarioNumber === 1) {
        interviewMomentsCompleteRef.current[1] = true;
        currentInterviewMomentRef.current = 2;
        nextClosingContent = buildScenario1To2BundleForInterview(participantFirstNameForSpoken, SCENARIO_2_TEXT);
      } else if (scenarioNumber === 2) {
        interviewMomentsCompleteRef.current[2] = true;
        currentInterviewMomentRef.current = 3;
        nextClosingContent = buildScenario2To3TransitionBody(participantFirstNameForSpoken, SCENARIO_3_TEXT);
      }
      if (scenarioNumber === 3) {
        if (personalHandoffInjectedRef.current) {
          if (__DEV__) console.warn('[Aria] Duplicate Moment 4 handoff after closing answer — skipped');
        } else {
          personalHandoffInjectedRef.current = true;
          interviewMomentsCompleteRef.current[3] = true;
          currentInterviewMomentRef.current = 4;
          const moment4Handoff = buildMoment4HandoffForInterview(participantFirstNameForSpoken, MOMENT_4_PERSONAL_CARD);
          const handoffMsg: MessageWithScenario = { role: 'assistant', content: moment4Handoff, scenarioNumber: 3 };
          const withHandoff = [...messagesAfterClosingAnswer, handoffMsg];
          setMessages(withHandoff);
          await speakTextSafe(moment4Handoff, ASSISTANT_INTERVIEW_SPEECH);
        }
      } else {
        const newAssistantMsg: MessageWithScenario = {
          role: 'assistant',
          content: nextClosingContent,
          scenarioNumber: scenarioNumber === 1 ? 2 : 3,
        };
        currentScenarioRef.current = scenarioNumber === 1 ? 2 : 3;
        const updatedMsgs = [...messagesAfterClosingAnswer, newAssistantMsg];
        setMessages(updatedMsgs);
        await speakTextSafe(nextClosingContent, ASSISTANT_INTERVIEW_SPEECH);
      }
      const transcriptEndForScoring =
        scenarioNumber === 3
          ? messagesAfterClosingAnswer
          : [...messagesAfterClosingAnswer, { role: 'assistant', content: nextClosingContent, scenarioNumber: scenarioNumber === 1 ? 2 : 3 }];
      setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
      if (!scoredScenariosRef.current.has(scenarioNumber)) {
        scoredScenariosRef.current.add(scenarioNumber);
        scoreScenario(scenarioNumber, transcriptEndForScoring);
      }
      if (__DEV__) {
        closingQuestionAskedRef.current[scenarioNumber] = false;
        closingQuestionAnsweredRef.current[scenarioNumber] = false;
      }
      lastAnsweredClosingScenarioRef.current = null;
      setVoiceState('idle');
      if (__DEV__) console.log('[Aria] Closing-question answer handled locally — advanced to next scenario', scenarioNumber);
      return;
    }

    const latestAssistantBeforeAppend = [...messages].reverse().find((m) => m.role === 'assistant');
    const latestAssistantBeforeAppendText = latestAssistantBeforeAppend?.content ?? '';
    const replyingToScenarioCThresholdPrompt =
      looksLikeScenarioCThresholdQuestion(latestAssistantBeforeAppendText) &&
      (currentInterviewMomentRef.current === 3 ||
        (currentScenarioRef.current === 3 && !personalHandoffInjectedRef.current));
    const skipMisplacedScenarioCThresholdBecauseAwaitingRedo =
      expectingScenarioCThresholdAnswerAfterMisplaceRef.current;
    const misplacedScenarioCThresholdAnswer =
      replyingToScenarioCThresholdPrompt &&
      !isDecline(trimmed) &&
      isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(trimmed) &&
      !skipMisplacedScenarioCThresholdBecauseAwaitingRedo;
    if (misplacedScenarioCThresholdAnswer) {
      deferredMoment4NarrativeRef.current = trimmed;
      const userMsgMisplaced: MessageWithScenario = {
        role: 'user',
        content: trimmed,
        // Tag as moment-4 context so scenario scoring excludes it.
        scenarioNumber: 4,
      };
      const scenarioTag = currentScenarioRef.current ?? 3;
      const redirectMsg: MessageWithScenario = {
        role: 'assistant',
        content: SCENARIO_C_MISPLACED_THRESHOLD_REDIRECT,
        scenarioNumber: scenarioTag,
      };
      const thresholdMsg: MessageWithScenario = {
        role: 'assistant',
        content: SCENARIO_C_COMMITMENT_THRESHOLD_QUESTION,
        scenarioNumber: scenarioTag,
      };
      void remoteLog('[SC3_MISPLACED_THRESHOLD_SEQUENCE]', {
        phase: 'step1_redirect',
        interviewSessionId: interviewSessionIdRef.current,
        content: SCENARIO_C_MISPLACED_THRESHOLD_REDIRECT,
      });
      void remoteLog('[SC3_MISPLACED_THRESHOLD_SEQUENCE]', {
        phase: 'step2_threshold_question',
        interviewSessionId: interviewSessionIdRef.current,
        content: SCENARIO_C_COMMITMENT_THRESHOLD_QUESTION,
      });
      setMessages([...messages, userMsgMisplaced, redirectMsg, thresholdMsg]);
      await speakTextSafe(SCENARIO_C_MISPLACED_THRESHOLD_REDIRECT, ASSISTANT_INTERVIEW_SPEECH);
      await speakTextSafe(SCENARIO_C_COMMITMENT_THRESHOLD_QUESTION, ASSISTANT_INTERVIEW_SPEECH);
      expectingScenarioCThresholdAnswerAfterMisplaceRef.current = true;
      void remoteLog('[SC3_MISPLACED_THRESHOLD_SEQUENCE]', {
        phase: 'awaiting_user_answer_after_reask',
        interviewSessionId: interviewSessionIdRef.current,
        deferredPersonalNarrativeChars: trimmed.length,
      });
      setVoiceState('idle');
      return;
    }

    const replyingToScenarioCQ1ForMisplace =
      currentInterviewMomentRef.current === 3 &&
      isScenarioCQ1Prompt(latestAssistantBeforeAppendText) &&
      !looksLikeScenarioCThresholdQuestion(latestAssistantBeforeAppendText);
    const scenarioCQ1Misplaced =
      replyingToScenarioCQ1ForMisplace &&
      !expectingScenarioCThresholdAnswerAfterMisplaceRef.current &&
      !isDecline(trimmed) &&
      isMisplacedScenarioCQ1Answer(trimmed);
    if (scenarioCQ1Misplaced) {
      const userMsgMisplacedQ1: MessageWithScenario = {
        role: 'user',
        content: trimmed,
        scenarioNumber: 3,
      };
      const redirectMsgQ1: MessageWithScenario = {
        role: 'assistant',
        content: SCENARIO_C_MISPLACED_Q1_REDIRECT,
        scenarioNumber: 3,
      };
      if (__DEV__) {
        console.log('[SC3_MISPLACED_Q1]', {
          answerPreview: trimmed.slice(0, 400),
          replyingToScenarioCQ1ForMisplace,
        });
      }
      void remoteLog('[SC3_MISPLACED_Q1]', {
        phase: 'redirect_repair_logistics_instead_of_interpretation',
        interviewSessionId: interviewSessionIdRef.current,
        answerPreview: trimmed.slice(0, 500),
      });
      setMessages([...messages, userMsgMisplacedQ1, redirectMsgQ1]);
      await speakTextSafe(SCENARIO_C_MISPLACED_Q1_REDIRECT, ASSISTANT_INTERVIEW_SPEECH);
      setVoiceState('idle');
      return;
    }

    const lastAsstForScenarioCCapture = [...messages].reverse().find((m) => m.role === 'assistant');
    const lastAsstScenarioCText = lastAsstForScenarioCCapture?.content ?? '';
    if (expectingScenarioCThresholdAnswerAfterMisplaceRef.current) {
      scenarioCCommitmentOnlyEvidenceRef.current = trimmed;
      expectingScenarioCThresholdAnswerAfterMisplaceRef.current = false;
      void remoteLog('[SC3_MISPLACED_THRESHOLD_SEQUENCE]', {
        phase: 'captured_answer_for_commitment_scoring',
        interviewSessionId: interviewSessionIdRef.current,
        answerPreview: trimmed.slice(0, 400),
      });
    } else if (
      currentScenarioRef.current === 3 &&
      !personalHandoffInjectedRef.current &&
      currentInterviewMomentRef.current === 3 &&
      looksLikeScenarioCThresholdQuestion(lastAsstScenarioCText)
    ) {
      scenarioCCommitmentOnlyEvidenceRef.current = trimmed;
    } else if (
      currentScenarioRef.current === 3 &&
      !personalHandoffInjectedRef.current &&
      currentInterviewMomentRef.current === 3 &&
      isScenarioCQ2Prompt(lastAsstScenarioCText) &&
      !looksLikeScenarioCThresholdQuestion(lastAsstScenarioCText)
    ) {
      scenarioCRepairOnlyEvidenceRef.current = trimmed;
    }

    const momentN = currentInterviewMomentRef.current;
    let userScenarioTag =
      (currentScenarioRef.current as number | undefined) ?? getScenarioNumberForNewMessage(messages, 'user');
    if (momentN >= 4) {
      userScenarioTag = 3;
    }
    const userMsg: MessageWithScenario = {
      role: 'user',
      content: trimmed,
      scenarioNumber: userScenarioTag as 1 | 2 | 3,
    };
    const newMessages: MessageWithScenario[] = [...messages, userMsg];

    setMessages(newMessages);
    setCurrentTranscript('');
    transcriptAtReleaseRef.current = '';
    setVoiceState('processing');
    setIsWaiting(true);
    setExchangeCount((c) => c + 1);
    const messagesToUse = newMessages;
    const detected = detectConstructs(trimmed);
    setTouchedConstructs((prev) => [...new Set([...prev, ...detected])]);

    // Track if user shared a personal example (response to personal-opening question that isn't a decline)
    const lastAssistant = [...messagesToUse].reverse().find((m) => m.role === 'assistant');
    const lastAssistantContent = lastAssistant?.content ?? '';
    const lastContent = lastAssistantContent.toLowerCase();
    const isPersonalOpening =
      /real (memory|example|situation|experience)|your own|from your (life|experience)|think of a time|can you think of|do you have (a|an) (example|memory)|share (a|something)|tell me about (a|something)|held a grudge|really didn't like|something a bit more personal/i.test(
        lastContent
      );
    if (isPersonalOpening && !isDecline(trimmed)) setUsedPersonalExamples(true);
    const replyingToScenarioAQ1 =
      currentInterviewMomentRef.current === 1 && isScenarioAQ1Prompt(lastAssistantContent);
    const replyingToScenarioBQ1 =
      currentInterviewMomentRef.current === 2 && isScenarioBQ1Prompt(lastAssistantContent);
    /** CQ2 detection must not depend on interview-moment ref alone — ref can desync (e.g. resume) while the last assistant turn is still the repair prompt; skipping breaks the scripted Daniel/Sophie threshold probe. */
    const cq2PromptMatches =
      isScenarioCQ2Prompt(lastAssistantContent) && !looksLikeScenarioCThresholdQuestion(lastAssistantContent);
    const replyingToScenarioCQ2 =
      cq2PromptMatches &&
      (currentInterviewMomentRef.current === 3 ||
        (currentScenarioRef.current === 3 && !personalHandoffInjectedRef.current));
    // #region agent log
    if (currentScenarioRef.current === 3 && !personalHandoffInjectedRef.current) {
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'AriaScreen.tsx:user_send_scenario3',
          message: 'cq2_reply_detection',
          hypothesisId: 'H2',
          data: {
            replyingToScenarioCQ2,
            cq2PromptMatches,
            moment: currentInterviewMomentRef.current,
            scenario: currentScenarioRef.current,
            personalHandoffInjected: personalHandoffInjectedRef.current,
            lastAsstIsCQ2: isScenarioCQ2Prompt(lastAssistantContent),
            lastAsstIsThreshold: looksLikeScenarioCThresholdQuestion(lastAssistantContent),
            lastAssistantPreview: lastAssistantContent.slice(0, 320),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    const relationshipEval = evaluateMoment4RelationshipType(trimmed);
    const moment4ThresholdHintInAnswer = hasCommitmentThresholdSignal(trimmed);
    const lastAssistantLooksLikeMoment4Grudge = looksLikeMoment4GrudgePrompt(lastAssistantContent);
    const moment4AnswerLooksMisplaced = looksLikeMisplacedNonGrudgeMoment4Answer(trimmed);
    const moment4CommitmentFollowUpBaseEligible = shouldForceMoment4ThresholdProbeByType({
      isMoment4: currentInterviewMomentRef.current === 4,
      probeAlreadyAsked: moment4ThresholdProbeAskedRef.current,
      lastAssistantContent,
      userAnswerText: trimmed,
    });
    const moment4UserExplicitPass = isExplicitPassForMoment4CommitmentFollowUp(trimmed);
    const shouldForceMoment4ThresholdProbe =
      moment4CommitmentFollowUpBaseEligible && !moment4UserExplicitPass;
    let moment4CommitmentFollowUpReasonIfFalse: string | null = null;
    if (!shouldForceMoment4ThresholdProbe) {
      if (currentInterviewMomentRef.current !== 4) moment4CommitmentFollowUpReasonIfFalse = 'not_moment_4';
      else if (moment4ThresholdProbeAskedRef.current) moment4CommitmentFollowUpReasonIfFalse = 'commitment_follow_up_already_asked';
      else if (moment4UserExplicitPass) moment4CommitmentFollowUpReasonIfFalse = 'explicit_pass_or_empty';
      else if (!lastAssistantLooksLikeMoment4Grudge) moment4CommitmentFollowUpReasonIfFalse = 'not_replying_to_grudge_prompt';
      else if (moment4AnswerLooksMisplaced) moment4CommitmentFollowUpReasonIfFalse = 'misplaced_non_grudge_answer';
    }
    if (currentInterviewMomentRef.current === 4) {
      const payload = {
        moment4CommitmentFollowUpConditionMet: shouldForceMoment4ThresholdProbe,
        moment4CommitmentFollowUpBaseEligible: moment4CommitmentFollowUpBaseEligible,
        moment4CommitmentFollowUpReasonIfFalse,
        lastAssistantLooksLikeMoment4Grudge,
        moment4AnswerLooksMisplaced,
        relationshipTypeDiagnosticOnly: relationshipEval.relationshipType,
        closeSignals: relationshipEval.closeSignals,
        nonCloseSignals: relationshipEval.nonCloseSignals,
        probeAlreadyAsked: moment4ThresholdProbeAskedRef.current,
        moment4UserExplicitPass,
        moment4ThresholdHintInAnswer,
        answerPreview: trimmed.slice(0, 500),
      };
      if (__DEV__) {
        console.log('[M4_COMMITMENT_FOLLOWUP_CONDITION]', payload);
      }
      void remoteLog('[M4_COMMITMENT_FOLLOWUP_CONDITION]', payload);
    }
    const scenarioAContemptProbeCoverage = hasScenarioAQ1ContemptProbeCoverage(trimmed);
    const specificEmmaLineAlreadyAddressed = scenarioAContemptProbeCoverage;
    const shouldForceScenarioAContemptProbe =
      replyingToScenarioAQ1 && !isDecline(trimmed) && !scenarioAContemptProbeCoverage;
    const sidedEntirelyWithJames = userSidesEntirelyWithJames(trimmed);
    const scenarioBQ1Engaged = hasScenarioBQ1OnTopicEngagement(trimmed);
    const shouldForceScenarioBFullAppreciationProbe =
      replyingToScenarioBQ1 &&
      !isDecline(trimmed) &&
      !sidedEntirelyWithJames &&
      !scenarioBQ1Engaged;
    const scenarioCUserCorpusForThreshold = extractScenario3UserCorpus(messagesToUse);
    const scenarioCPostRepairCorpus = extractScenario3UserCorpusAfterLastRepairPrompt(messagesToUse);
    const scenarioCPostRepairThresholdMatchDetail =
      scenarioCCommitmentThresholdMatchDetail(scenarioCPostRepairCorpus);
    const scenarioCThresholdStrictFullCorpus =
      hasScenarioCCommitmentThresholdInUserAnswer(scenarioCUserCorpusForThreshold);
    const scenarioCThresholdStrict =
      hasScenarioCVignetteCommitmentThresholdSignal(scenarioCPostRepairCorpus);
    const scenarioCThresholdLegacy = hasCommitmentThresholdSignal(scenarioCUserCorpusForThreshold);
    const shouldForceScenarioCThresholdProbe =
      replyingToScenarioCQ2 && !isDecline(trimmed) && !scenarioCThresholdStrict;
    if (replyingToScenarioCQ2) {
      const skipReason = scenarioCThresholdStrict
        ? 'vignette-threshold-signal-already-present-post-repair'
        : 'vignette-threshold-signal-missing-post-repair';
      if (__DEV__) {
        console.log('[S3_THRESHOLD_EVAL]', {
          shouldForceScenarioCThresholdProbe,
          scenarioCThresholdStrict,
          scenarioCThresholdStrictFullCorpus,
          scenarioCThresholdLegacy,
          skipReason,
          lastTurnPreview: trimmed.slice(0, 280),
          postRepairCorpusPreview: scenarioCPostRepairCorpus.slice(0, 500),
          fullCorpusPreview: scenarioCUserCorpusForThreshold.slice(0, 500),
        });
      }
      void remoteLog('[S3_THRESHOLD_EVAL]', {
        shouldForceScenarioCThresholdProbe,
        scenarioCThresholdStrict,
        scenarioCThresholdStrictFullCorpus,
        scenarioCThresholdLegacy,
        skipReason,
        lastTurnPreview: trimmed.slice(0, 320),
        postRepairCorpusPreview: scenarioCPostRepairCorpus.slice(0, 500),
        fullCorpusPreview: scenarioCUserCorpusForThreshold.slice(0, 500),
      });
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'AriaScreen.tsx:S3_THRESHOLD_EVAL',
          message: 'scenario_c_threshold_pre_api',
          hypothesisId: 'H1',
          data: {
            shouldForceScenarioCThresholdProbe,
            scenarioCThresholdStrict,
            scenarioCThresholdStrictFullCorpus,
            isDecline: isDecline(trimmed),
            userReplyLen: trimmed.length,
            postRepairCorpusLen: scenarioCPostRepairCorpus.length,
            postRepairThresholdMatchDetail: scenarioCPostRepairThresholdMatchDetail,
            namedDanielSophieInPostRepair: /\b(daniel|sophie)\b/i.test(scenarioCPostRepairCorpus),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    }

    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
      setVoiceState('idle');
      showChatError(CHAT_ERROR_MESSAGES.proxyError);
      return;
    }

    // Scenarios need more tokens — detect from last user message (no-example → scenario next)
      const lastUserMsg = (messagesToUse[messagesToUse.length - 1] as { content?: string })?.content?.toLowerCase() ?? '';
      const isNoExample = /don't have|can't think|i dont|nothing comes|no example|i don't/i.test(lastUserMsg);
      let maxTok = isNoExample ? 600 : 380;
      if (currentInterviewMomentRef.current >= 1 && currentInterviewMomentRef.current <= 3) {
        maxTok = Math.max(maxTok, 720);
      }
      if (currentInterviewMomentRef.current === 4) {
        maxTok = Math.max(maxTok, 2800);
      }
      const closingInstruction = usedPersonalExamples ? PERSONAL_CLOSING_INSTRUCTION : SCENARIO_ONLY_CLOSING_INSTRUCTION;
      const progressSuffix = buildInterviewProgressSystemSuffix({
        momentsComplete: { ...interviewMomentsCompleteRef.current },
        currentMoment: currentInterviewMomentRef.current,
        personalHandoffInjected: personalHandoffInjectedRef.current,
      });
      const progressRefsPayload: InterviewProgressRefs = {
        interviewMomentsCompleteRef,
        currentInterviewMomentRef,
        personalHandoffInjectedRef,
      };
      const participantFirstNameSystemSuffix = buildInterviewerParticipantFirstNameSystemSuffix(
        getInterviewUserFirstNameForPrompt(profile)
      );
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          runId: 'pre-fix',
          hypothesisId: 'H14',
          location: 'AriaScreen.tsx:sendMessage:systemPromptNameSuffix',
          message: 'system_prompt_participant_name_resolution',
          data: {
            participantFirstNameForSpoken: participantFirstNameForSpoken || null,
            promptNameFromProfile: getInterviewUserFirstNameForPrompt(profile) || null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      const requestBody = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTok,
        system:
          INTERVIEWER_SYSTEM +
          participantFirstNameSystemSuffix +
          OPENING_INSTRUCTIONS +
          SCENARIO_SWITCHING_INSTRUCTIONS +
          SCENARIO_BOUNDARY_INSTRUCTIONS +
          SCENARIO_CLOSING_INSTRUCTIONS +
          CLOSING_QUESTION_HANDLING +
          SCENARIO_TRANSITION_CLOSING +
          REFLECTION_PARAPHRASE_FIDELITY +
          ASSISTANT_SPEECH_POSTPROCESS_NOTICE +
          PERSONAL_DISCLOSURE_TRANSITION +
          SKIP_HANDLING_INSTRUCTIONS +
          SCORE_REQUEST_INSTRUCTIONS +
          OFF_TOPIC_INSTRUCTIONS +
          REPEAT_HANDLING_INSTRUCTIONS +
          THIN_RESPONSE_INSTRUCTIONS +
          UNIVERSAL_ACK_BEFORE_MOVE_INSTRUCTIONS +
          NO_REPEAT_INSTRUCTIONS +
          PAUSE_HANDLING_INSTRUCTIONS +
          DISTRESS_HANDLING_INSTRUCTIONS +
          MISUNDERSTANDING_HANDLING_INSTRUCTIONS +
          SCENARIO_REDIRECT_QUESTIONS +
          INVALID_SCENARIO_REDIRECT +
          COMMUNICATION_QUESTION_CHECK +
          PUSHBACK_RESPONSE_INSTRUCTIONS +
          SCENARIO_COMPLETE_TOKEN_INSTRUCTIONS +
          CLOSING_LINE_INSTRUCTIONS +
          closingInstruction +
          progressSuffix +
          buildElongatingProbeStateSuffix(elongatingProbeFiredRef.current) +
          PER_REQUEST_REFLECTION_LOCK,
        messages: messagesToUse
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content })),
      };
    const apiUrl = getAnthropicEndpoint();
    const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (useProxy && SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    } else if (!useProxy) {
      headers['x-api-key'] = ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }

    let data: { content?: Array<{ text?: string }>; error?: { message?: string } };
    const textToParallelStream = { full: '', spokenStarted: false };
    const makeCall = async (): Promise<typeof data> => {
      const streamBody = { ...requestBody, stream: true };
      const res = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(streamBody) });
      if (!res.ok) {
        const rawErr = await res.text();
        let parsedErr: { error?: { message?: string } } | null = null;
        try {
          parsedErr = JSON.parse(rawErr) as { error?: { message?: string } };
        } catch {
          parsedErr = null;
        }
        const e = new Error(parsedErr?.error?.message ?? `HTTP ${res.status}`);
        (e as Error & { status?: number }).status = res.status;
        throw e;
      }
      if (!res.body) {
        const e = new Error('Invalid response stream');
        (e as Error & { status?: number }).status = res.status;
        throw e;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let sentenceBuffer = '';
      /** Merges with the next flushed sentence so "Great work." + "Great work, Name — …" can be deduped for TTS. */
      let deferredWarmBoundarySentence: string | null = null;
      let ttsChain = Promise.resolve();
      let ttsCancelled = false;
      let firstSentenceLogged = false;
      const maybeQueueSentenceForTts = (sentence: string, allowDeferWarm = true) => {
        let spoken = stripControlTokens(sentence).trim();
        if (!spoken || ttsCancelled) return;
        const hadDeferredBefore = !!deferredWarmBoundarySentence;
        if (deferredWarmBoundarySentence) {
          spoken = `${deferredWarmBoundarySentence} ${spoken}`.trim();
          deferredWarmBoundarySentence = null;
        }
        const willDefer =
          allowDeferWarm &&
          !!participantFirstNameForSpoken &&
          (isBoundaryWarmValidationOnlySentence(spoken) ||
            shouldDeferStreamingBoundaryWarmClause(spoken, participantFirstNameForSpoken));
        // #region agent log
        if (
          /great\s+work/gi.test(spoken) ||
          /nice\s+work/gi.test(spoken) ||
          /good\s+work/gi.test(spoken) ||
          willDefer
        ) {
          fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
            body: JSON.stringify({
              sessionId: 'c61a43',
              runId: 'post-fix',
              hypothesisId: 'H-D',
              location: 'AriaScreen.tsx:maybeQueueSentenceForTts:entry',
              message: 'parallel_tts_warm_sentence_path',
              data: {
                allowDeferWarm,
                hadDeferredBefore,
                willDefer,
                segmentWarmDefer: shouldDeferStreamingBoundaryWarmClause(
                  spoken,
                  participantFirstNameForSpoken,
                ),
                loneWarmDefer: isBoundaryWarmValidationOnlySentence(spoken),
                participantFirstNameLen: participantFirstNameForSpoken.length,
                spokenPreview: spoken.slice(0, 200),
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
        }
        // #endregion
        if (willDefer) {
          deferredWarmBoundarySentence = spoken;
          return;
        }
        ttsChain = ttsChain.then(async () => {
          if (ttsCancelled) return;
          try {
            const spokenForTts = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
              sanitizeAssistantInterviewerCharacterNames(spoken),
              participantFirstNameForSpoken,
            );
            // #region agent log
            fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
              body: JSON.stringify({
                sessionId: 'c61a43',
                runId: 'pre-fix',
                hypothesisId: 'H15',
                location: 'AriaScreen.tsx:maybeQueueSentenceForTts:nameSourceCompare',
                message: 'parallel_sentence_name_sources',
                data: {
                  participantFirstNameForSpoken: participantFirstNameForSpoken || null,
                  freshNameFromProfile: getInterviewUserFirstNameForPrompt(profile) || null,
                  sentencePreview: spoken.slice(0, 120),
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
            // #endregion
            if (userId) {
              const rtd = getSessionLogRuntime();
              const freshNameFromProfile = getInterviewUserFirstNameForPrompt(profile);
              writeSessionLog({
                userId,
                attemptId: rtd.attemptId,
                eventType: 'name_source_debug',
                eventData: {
                  stage: 'parallel_sentence',
                  participant_first_name_present: !!participantFirstNameForSpoken,
                  participant_first_name_length: participantFirstNameForSpoken.length,
                  fresh_name_present: !!freshNameFromProfile,
                  fresh_name_length: freshNameFromProfile.length,
                },
                platform: rtd.platform,
              });
            }
            if (userId) {
              const rtd = getSessionLogRuntime();
              writeSessionLog({
                userId,
                attemptId: rtd.attemptId,
                eventType: 'name_injection_debug',
                eventData: {
                  stage: 'parallel_sentence',
                  moment_number: currentInterviewMomentRef.current,
                  scenario_number: currentScenarioRef.current,
                  raw_has_name: participantFirstNameForSpoken
                    ? spoken.toLowerCase().includes(participantFirstNameForSpoken.toLowerCase())
                    : null,
                  injected_has_name: participantFirstNameForSpoken
                    ? spokenForTts.toLowerCase().includes(participantFirstNameForSpoken.toLowerCase())
                    : null,
                  raw_preview: spoken.slice(0, 140),
                  injected_preview: spokenForTts.slice(0, 140),
                },
                platform: rtd.platform,
              });
            }
            // #region agent log
            fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'post-fix',hypothesisId:'H9',location:'AriaScreen.tsx:maybeQueueSentenceForTts:nameCheck',message:'parallel_sentence_name_presence',data:{sentencePreview:spoken.slice(0,120),sentenceHasName:participantFirstNameForSpoken?spoken.toLowerCase().includes(participantFirstNameForSpoken.toLowerCase()):null,spokenForTtsPreview:spokenForTts.slice(0,120),spokenForTtsHasName:participantFirstNameForSpoken?spokenForTts.toLowerCase().includes(participantFirstNameForSpoken.toLowerCase()):null,participantFirstNameForSpoken:participantFirstNameForSpoken??null},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            // #region agent log
            fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'post-fix',hypothesisId:'H1',location:'AriaScreen.tsx:maybeQueueSentenceForTts:beforeSpeak',message:'parallel_tts_sentence_about_to_play',data:{sentenceLen:spokenForTts.length,voiceState:voiceStateRef.current,ttsCancelled},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
              await awaitTtsScreenReadyGate('parallel_streaming_sentence');
            await speakWithElevenLabs(spokenForTts, undefined, {
              skipStopElevenLabsPlaybackBeforeStart: true,
              telemetry: { source: 'turn' },
              preInitTriggerDuring: 'tts_playback',
              onPlaybackStarted: () => {
                setVoiceState('speaking');
                textToParallelStream.spokenStarted = true;
                if (!firstSentenceLogged && userId) {
                  firstSentenceLogged = true;
                  const rtd = getSessionLogRuntime();
                  writeSessionLog({
                    userId,
                    attemptId: rtd.attemptId,
                    eventType: 'question_delivered',
                    eventData: {
                      moment_number: currentInterviewMomentRef.current,
                      scenario_number: currentScenarioRef.current,
                      question_text: stripControlTokens(spoken).trim().slice(0, 2000),
                      delivered_at: new Date().toISOString(),
                      tts_pipeline: 'parallel_streaming',
                    },
                    platform: rtd.platform,
                  });
                }
              },
            });
            // #region agent log
            fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H1',location:'AriaScreen.tsx:maybeQueueSentenceForTts:afterSpeak',message:'parallel_tts_sentence_play_resolved',data:{sentenceLen:spoken.length,voiceState:voiceStateRef.current,spokenStarted:textToParallelStream.spokenStarted},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          } catch {
            // #region agent log
            fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H3',location:'AriaScreen.tsx:maybeQueueSentenceForTts:catch',message:'parallel_tts_sentence_play_error_swallowed',data:{voiceState:voiceStateRef.current},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            // swallow tts errors for parallel pipeline
          }
        });
      };
      const processTextDelta = (deltaText: string) => {
        if (!deltaText) return;
        textToParallelStream.full += deltaText;
        sentenceBuffer += deltaText;
        for (;;) {
          const m = sentenceBuffer.match(/[.!?](?:\s|$)/);
          if (!m || m.index == null) break;
          const cut = m.index + m[0].length;
          const sentence = sentenceBuffer.slice(0, cut);
          sentenceBuffer = sentenceBuffer.slice(cut);
          maybeQueueSentenceForTts(sentence);
        }
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          const chunk = decoder.decode(value ?? new Uint8Array(), { stream: !done });
          sseBuffer += chunk;
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() ?? '';
          for (const lineRaw of lines) {
            const line = lineRaw.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            let evt: { type?: string; delta?: { text?: string }; text?: string } | null = null;
            try {
              evt = JSON.parse(payload) as { type?: string; delta?: { text?: string }; text?: string };
            } catch {
              evt = null;
            }
            const deltaText =
              evt?.type === 'content_block_delta'
                ? evt.delta?.text ?? ''
                : evt?.type === 'message_delta'
                  ? evt.text ?? ''
                  : '';
            processTextDelta(deltaText);
          }
          if (done) break;
        }
        if (sentenceBuffer.trim()) {
          maybeQueueSentenceForTts(sentenceBuffer);
          sentenceBuffer = '';
        }
        if (deferredWarmBoundarySentence) {
          const hold = deferredWarmBoundarySentence;
          deferredWarmBoundarySentence = null;
          maybeQueueSentenceForTts(hold, false);
        }
        await ttsChain;
        if (textToParallelStream.spokenStarted) {
          setVoiceState('idle');
        }
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H2',location:'AriaScreen.tsx:makeCall:afterTtsChain',message:'parallel_tts_chain_completed',data:{spokenStarted:textToParallelStream.spokenStarted,voiceState:voiceStateRef.current,fullTextLen:textToParallelStream.full.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } catch {
        ttsCancelled = true;
        deferredWarmBoundarySentence = null;
        await stopElevenLabsPlayback();
        if (textToParallelStream.spokenStarted) {
          setVoiceState('idle');
        }
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H3',location:'AriaScreen.tsx:makeCall:catch',message:'parallel_llm_stream_or_tts_chain_failed',data:{voiceState:voiceStateRef.current,spokenStarted:textToParallelStream.spokenStarted},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
      return { content: [{ text: textToParallelStream.full }] };
    };

    const numUserMessages = messagesToUse.filter((m) => m.role === 'user').length;
    const isFirstExchange = numUserMessages === 1;
    if (isFirstExchange) {
      await new Promise((r) => setTimeout(r, 500));
    }
    try {
      data = await withRetry(makeCall, {
        retries: 4,
        baseDelay: isFirstExchange ? 3000 : 12000,
        maxDelay: isFirstExchange ? 10000 : 45000,
        context: isFirstExchange ? 'welcome message' : 'conversation',
        onRetry: (attempt) => {
          if (attempt === 1) setVoiceState('processing');
          if (__DEV__) console.log(`[conversation] rate limit retry attempt ${attempt}`);
        },
        onUnrecoverable: () => {
          setIsWaiting(false);
          setVoiceState('idle');
        },
      });
    } catch (err) {
      setIsWaiting(false);
      setVoiceState('idle');
      const errObj = err as Error & { status?: number; retriesExhausted?: boolean; unrecoverable?: boolean };
      const status = errObj.status;
      const type = classifyError(err);
      // NEVER show "trouble connecting" for 429 until ALL retries are exhausted
      if (status === 429 && !errObj.retriesExhausted) return;
      if (type === 'retryable' && !errObj.retriesExhausted) return;
      const errorMessage = getErrorMessage(err, errObj.retriesExhausted);
      showChatError(errorMessage);
      const completed = Array.from(scoredScenariosRef.current);
      const scenarioScoresPayload: Record<
        number,
        { pillarScores: Record<string, number | null>; pillarConfidence: Record<string, string>; keyEvidence: Record<string, string>; scenarioName?: string }
      > = {};
      [1, 2, 3].forEach((n) => {
        const s = scenarioScoresRef.current[n];
        if (s) scenarioScoresPayload[n] = { pillarScores: s.pillarScores, pillarConfidence: s.pillarConfidence, keyEvidence: s.keyEvidence, scenarioName: s.scenarioName };
      });
      saveInterviewProgress(userId, {
        messages: messagesToUse.filter((m) => !(m as { isWaiting?: boolean }).isWaiting),
        scenariosCompleted: completed,
        scenarioScores: scenarioScoresPayload,
        currentScenario: getCurrentScenario(scoredScenariosRef.current),
      });
      return;
    }

    try {
    let text = (data.content?.[0]?.text ?? '').trim();
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H10',location:'AriaScreen.tsx:sendMessage:assembledTextNameCheck',message:'assembled_text_name_presence',data:{assembledPreview:text.slice(0,160),assembledHasName:participantFirstNameForSpoken?text.toLowerCase().includes(participantFirstNameForSpoken.toLowerCase()):null,participantFirstNameForSpoken:participantFirstNameForSpoken??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    /** LLM done — do not keep "Amoraea is thinking" (or isWaiting-gated UI) until TTS finishes; HTML audio can hang without `onended` on some mobile browsers. */
    setIsWaiting(false);
    const parallelStreamingPlaybackUsed = textToParallelStream.spokenStarted;
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H6',location:'AriaScreen.tsx:sendMessage:postStreamAssemble',message:'parallel_streaming_flag_and_ui_state',data:{parallelStreamingPlaybackUsed,interviewUiPhase,status,currentScenario:currentScenarioRef.current,hasReferenceScenario:!!referenceCardScenario,scenarioIntroTtsPlaying},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const speakAssistantTurn = async (spokenText: string, opts?: {
      silent?: boolean;
      interviewSpeechRole?: 'assistant_response';
      telemetrySource?: TtsTelemetrySource;
      skipQuestionDeliveredTelemetry?: boolean;
      skipInterviewSpeechAdvance?: boolean;
      skipQuestionTiming?: boolean;
      skipLastQuestionRef?: boolean;
      skipGestureGate?: boolean;
      ttsTriggerSource?: 'gesture_handler' | 'effect' | 'callback' | 'timeout' | 'preauthorized_element';
      immediateWebPlaybackElement?: HTMLAudioElement;
    }) => {
      if (parallelStreamingPlaybackUsed) {
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H7',location:'AriaScreen.tsx:speakAssistantTurn:skip',message:'speak_text_safe_skipped_due_parallel_streaming',data:{spokenLen:spokenText.length,spokenPreview:spokenText.slice(0,160),spokenHasName:participantFirstNameForSpoken?spokenText.toLowerCase().includes(participantFirstNameForSpoken.toLowerCase()):null,participantFirstNameForSpoken:participantFirstNameForSpoken??null,interviewUiPhase,status,currentScenario:currentScenarioRef.current,hasReferenceScenario:!!referenceCardScenario,scenarioIntroTtsPlaying},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (opts?.interviewSpeechRole === 'assistant_response' && !opts?.skipInterviewSpeechAdvance) {
          applyInterviewSpeechComplete(spokenText);
          // #region agent log
          fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'post-fix',hypothesisId:'H7',location:'AriaScreen.tsx:speakAssistantTurn:parallelAdvance',message:'applied_interview_speech_complete_in_parallel_skip',data:{spokenLen:spokenText.length,interviewUiPhase,status,currentScenario:currentScenarioRef.current},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        }
        return;
      }
      await speakTextSafe(spokenText, opts ?? ASSISTANT_INTERVIEW_SPEECH);
    };
    const priorAssistantContentS3 =
      [...messagesToUse].reverse().find((m) => m.role === 'assistant')?.content ?? '';
    let strippedText = stripControlTokens(text);
    if (
      shouldReplaceScenarioBRepairWithSkipAndScenario3Transition(
        messagesToUse,
        strippedText,
        currentInterviewMomentRef.current
      )
    ) {
      text = `${SCENARIO_B_REPAIR_ALREADY_COVERED_SKIP_LEAD}\n\n[SCENARIO_COMPLETE:2]\n\n${buildScenario2To3TransitionBody(
        participantFirstNameForSpoken,
        SCENARIO_3_TEXT
      )}`;
      strippedText = stripControlTokens(text);
    }
    strippedText = stripFlatReflectionAcknowledgmentOpeners(strippedText);
    strippedText = stripGenericReflectionFillersFirstParagraph(strippedText);
    strippedText = stripHollowSystemInterviewerPhrases(strippedText);
    strippedText = collapseStackedEmpathyIHearYouInFirstParagraph(strippedText);
    strippedText = enforceAcknowledgmentVariation(
      strippedText,
      messagesToUse.filter((m) => m.role === 'assistant') as MessageWithScenario[],
      isPersonalOpening || currentInterviewMomentRef.current >= 4
    );
    strippedText = stripForbiddenReflectionLead(strippedText);
    strippedText = ensureScenario2BundleWhenOpeningWithoutVignette(
      strippedText,
      currentInterviewMomentRef.current,
      participantFirstNameForSpoken,
      SCENARIO_2_TEXT
    );
    const recentAsstForAck = recentAssistantMessagesForAck(messagesToUse);
    let assistantIssuedMoment4ThresholdProbe = looksLikeMoment4ThresholdQuestion(strippedText);
    const assistantIssuedScenarioAContemptProbe = looksLikeScenarioAContemptProbeQuestion(strippedText);
    let assistantIssuedScenarioARepairQuestion =
      currentInterviewMomentRef.current === 1 && looksLikeScenarioARepairQuestion(strippedText);
    const assistantIssuedScenarioBFullProbe = looksLikeScenarioBFullAppreciationProbeQuestion(strippedText);
    const assistantIssuedScenarioBJamesDifferently =
      currentInterviewMomentRef.current === 2 && looksLikeScenarioBJamesDifferentlyQuestion(strippedText);
    const assistantIssuedScenarioBRepairAsJames =
      currentInterviewMomentRef.current === 2 && looksLikeScenarioBRepairAsJamesQuestion(strippedText);
    let assistantIssuedScenarioCThresholdProbe = looksLikeScenarioCThresholdQuestion(strippedText);
    {
      const beforeS3 = strippedText;
      strippedText = ensureScenario3VignetteOpening(strippedText);
      if (strippedText !== beforeS3) {
        void remoteLog('[S3_VIGNETTE_OPENING_REPAIRED]', { preview: strippedText.slice(0, 200) });
      }
    }
    if (currentInterviewMomentRef.current === 3) {
      const beforeS3q1 = strippedText;
      strippedText = ensureScenarioCQ1SequenceAfterVignette(strippedText);
      strippedText = replaceOrphanScenarioCRepairWithQ1(strippedText, priorAssistantContentS3);
      assistantIssuedScenarioCThresholdProbe = looksLikeScenarioCThresholdQuestion(strippedText);
      if (strippedText !== beforeS3q1) {
        void remoteLog('[S3_Q1_SEQUENCE_ENFORCED]', {
          preview: strippedText.slice(0, 260),
          hadVignetteInTurn: textContainsScenarioCVignetteBody(beforeS3q1),
        });
      }
    }
    if (shouldForceScenarioAContemptProbe && assistantIssuedScenarioARepairQuestion) {
      strippedText = stripScenarioARepairQuestion(strippedText);
      assistantIssuedScenarioARepairQuestion = false;
      if (__DEV__) {
        console.log('[S1_SEQUENCE_BLOCKED_REPAIR_BEFORE_CONTEMPT]', {
          shouldForceScenarioAContemptProbe,
          specificEmmaLineAlreadyAddressed,
        });
      }
      void remoteLog('[S1_SEQUENCE_BLOCKED_REPAIR_BEFORE_CONTEMPT]', {
        shouldForceScenarioAContemptProbe,
        specificEmmaLineAlreadyAddressed,
      });
    }
    const preNameSanitize = strippedText;
    const sanitizedForDedupe = sanitizeAssistantInterviewerCharacterNames(strippedText);
    strippedText = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
      sanitizedForDedupe,
      participantFirstNameForSpoken,
    );
    // #region agent log
    if ((sanitizedForDedupe.match(/great\s+work/gi) ?? []).length >= 2) {
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          runId: 'dup-debug',
          hypothesisId: 'H-E',
          location: 'AriaScreen.tsx:sendMessage:postDedupeMainTurn',
          message: 'main_turn_double_great_work_probe',
          data: {
            parallelStreamingPlaybackUsed,
            participantFirstNameForSpokenLen: participantFirstNameForSpoken.length,
            sanitizedPreview: sanitizedForDedupe.slice(0, 220),
            strippedPreview: strippedText.slice(0, 220),
            dedupeChanged: sanitizedForDedupe !== strippedText,
            greatWorkCountSanitized: (sanitizedForDedupe.match(/great\s+work/gi) ?? []).length,
            greatWorkCountStripped: (strippedText.match(/great\s+work/gi) ?? []).length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    // #region agent log
    if (
      interviewAssistantTextHasDisallowedNameMarker(text) ||
      interviewAssistantTextHasDisallowedNameMarker(preNameSanitize) ||
      interviewAssistantTextHasDisallowedNameMarker(strippedText)
    ) {
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
        body: JSON.stringify({
          sessionId: 'e70f17',
          location: 'AriaScreen.tsx:sendMessage',
          message: 'name_sanitize_main_turn',
          data: {
            hypothesisId: 'H1-H3',
            rawHas: interviewAssistantTextHasDisallowedNameMarker(text),
            preSanitizeHas: interviewAssistantTextHasDisallowedNameMarker(preNameSanitize),
            postSanitizeHas: interviewAssistantTextHasDisallowedNameMarker(strippedText),
            changed: preNameSanitize !== strippedText,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {      });
    }
    // #endregion
    /** Elongating probe must be the sole assistant output this turn — never stack forced construct probes after it. */
    const assistantTurnIsElongatingProbeOnly = isApprovedElongatingProbeOnly(strippedText);
    // #region agent log
    if (replyingToScenarioCQ2) {
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'AriaScreen.tsx:s3_post_sanitize_threshold_gate',
          message: 'post_sanitize_assistant_threshold_flags',
          hypothesisId: 'H5',
          data: {
            shouldForceScenarioCThresholdProbe,
            assistantIssuedScenarioCThresholdProbe,
            assistantIssuedAfterSanitize: looksLikeScenarioCThresholdQuestion(strippedText),
            strippedPreview: strippedText.slice(0, 360),
            willAttemptS3Force:
              shouldForceScenarioCThresholdProbe &&
              !assistantIssuedScenarioCThresholdProbe &&
              !text.includes('[INTERVIEW_COMPLETE]'),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    if (assistantIssuedMoment4ThresholdProbe) {
      moment4ThresholdProbeAskedRef.current = true;
    }
    if (assistantIssuedScenarioAContemptProbe) {
      scenarioAContemptProbeAskedRef.current = true;
    }
    if (assistantIssuedScenarioARepairQuestion && !scenarioAContemptProbeAskedRef.current) {
      if (__DEV__) {
        console.log('[S1_SEQUENCE_VIOLATION_REPAIR_WITHOUT_CONTEMPT]', {
          assistantIssuedScenarioARepairQuestion,
          scenarioAContemptProbeAsked: scenarioAContemptProbeAskedRef.current,
        });
      }
      void remoteLog('[S1_SEQUENCE_VIOLATION_REPAIR_WITHOUT_CONTEMPT]', {
        assistantIssuedScenarioARepairQuestion,
        scenarioAContemptProbeAsked: scenarioAContemptProbeAskedRef.current,
      });
    }
    if (assistantIssuedScenarioARepairQuestion && scenarioAContemptProbeAskedRef.current) {
      if (__DEV__) {
        console.log('[S1_SEQUENCE_VALIDATED]', {
          assistantIssuedScenarioARepairQuestion,
          scenarioAContemptProbeAsked: scenarioAContemptProbeAskedRef.current,
        });
      }
      void remoteLog('[S1_SEQUENCE_VALIDATED]', {
        assistantIssuedScenarioARepairQuestion,
        scenarioAContemptProbeAsked: scenarioAContemptProbeAskedRef.current,
      });
    }
    if (
      shouldForceScenarioAContemptProbe &&
      !assistantIssuedScenarioAContemptProbe &&
      !assistantTurnIsElongatingProbeOnly &&
      !text.includes('[INTERVIEW_COMPLETE]')
    ) {
      const forcedContemptProbe = "What do you make of Emma's statement when she says 'you've made that very clear'?";
      let stagedMessages = messagesToUse;
      if (strippedText) {
        const detectedScenario = detectScenarioFromResponse(strippedText);
        if (detectedScenario !== null) currentScenarioRef.current = detectedScenario;
        const scenarioNum =
          currentScenarioRef.current ??
          detectedScenario ??
          getScenarioNumberForNewMessage(messagesToUse, 'assistant', strippedText);
        const aiMsg: MessageWithScenario = {
          role: 'assistant',
          content: strippedText,
          scenarioNumber: scenarioNum,
        };
        stagedMessages = [...messagesToUse, aiMsg];
        setMessages(stagedMessages);
        applyInterviewProgressFromAssistantText(strippedText, progressRefsPayload);
        await speakAssistantTurn(strippedText, ASSISTANT_INTERVIEW_SPEECH);
      }
      if (__DEV__) {
        console.log('[S1_CONTEMPT_FORCED]', {
          specificEmmaLineAlreadyAddressed,
          assistantIssuedScenarioAContemptProbe,
        });
      }
      void remoteLog('[S1_CONTEMPT_FORCED]', {
        specificEmmaLineAlreadyAddressed,
        assistantIssuedScenarioAContemptProbe,
      });
      scenarioAContemptProbeAskedRef.current = true;
      const wrappedContemptProbe = wrapForcedProbeWithAck(trimmed, strippedText, forcedContemptProbe, recentAsstForAck);
      const probeMsg: MessageWithScenario = {
        role: 'assistant',
        content: wrappedContemptProbe,
        scenarioNumber:
          currentScenarioRef.current ??
          getScenarioNumberForNewMessage(stagedMessages, 'assistant', wrappedContemptProbe),
      };
      setMessages([...stagedMessages, probeMsg]);
      await speakTextSafe(wrappedContemptProbe, ASSISTANT_INTERVIEW_SPEECH);
      setVoiceState('idle');
      return;
    }
    if (
      shouldForceScenarioBFullAppreciationProbe &&
      !assistantIssuedScenarioBFullProbe &&
      !assistantTurnIsElongatingProbeOnly &&
      !text.includes('[INTERVIEW_COMPLETE]')
    ) {
      const forcedAppreciationProbe = "What do you think James could've done differently so Sarah feels better?";
      let stagedMessages = messagesToUse;
      if (strippedText) {
        const detectedScenario = detectScenarioFromResponse(strippedText);
        if (detectedScenario !== null) currentScenarioRef.current = detectedScenario;
        const scenarioNum =
          currentScenarioRef.current ??
          detectedScenario ??
          getScenarioNumberForNewMessage(messagesToUse, 'assistant', strippedText);
        const aiMsg: MessageWithScenario = {
          role: 'assistant',
          content: strippedText,
          scenarioNumber: scenarioNum,
        };
        stagedMessages = [...messagesToUse, aiMsg];
        setMessages(stagedMessages);
        applyInterviewProgressFromAssistantText(strippedText, progressRefsPayload);
        await speakAssistantTurn(strippedText, ASSISTANT_INTERVIEW_SPEECH);
      }
      if (__DEV__) {
        console.log('[S2_APPRECIATION_FORCED]', {
          sidedEntirelyWithJames,
          scenarioBQ1Engaged,
          assistantIssuedScenarioBFullProbe,
        });
      }
      void remoteLog('[S2_APPRECIATION_FORCED]', {
        sidedEntirelyWithJames,
        scenarioBQ1Engaged,
        assistantIssuedScenarioBFullProbe,
      });
      const wrappedAppreciationProbe = wrapForcedProbeWithAck(trimmed, strippedText, forcedAppreciationProbe, recentAsstForAck);
      const probeMsg: MessageWithScenario = {
        role: 'assistant',
        content: wrappedAppreciationProbe,
        scenarioNumber:
          currentScenarioRef.current ??
          getScenarioNumberForNewMessage(stagedMessages, 'assistant', wrappedAppreciationProbe),
      };
      setMessages([...stagedMessages, probeMsg]);
      await speakTextSafe(wrappedAppreciationProbe, ASSISTANT_INTERVIEW_SPEECH);
      setVoiceState('idle');
      return;
    }
    const scenarioBSkippedJamesIntermediate =
      assistantIssuedScenarioBRepairAsJames ||
      looksLikeAssistantSkipsScenarioBJamesIntermediateQuestion(strippedText);
    const needsScenarioBJamesDifferentlyInsert =
      replyingToScenarioBQ1 &&
      !isDecline(trimmed) &&
      !shouldForceScenarioBFullAppreciationProbe &&
      scenarioBSkippedJamesIntermediate &&
      !assistantIssuedScenarioBJamesDifferently &&
      !assistantTurnIsElongatingProbeOnly &&
      !text.includes('[INTERVIEW_COMPLETE]');
    // #region agent log
    if (currentScenarioRef.current === 3 && currentInterviewMomentRef.current === 3) {
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'AriaScreen.tsx:before_forced_branches',
          message: 'forced_probe_branch_order',
          hypothesisId: 'H3',
          data: {
            shouldForceS1: shouldForceScenarioAContemptProbe,
            shouldForceS2App: shouldForceScenarioBFullAppreciationProbe,
            needsS2James: needsScenarioBJamesDifferentlyInsert,
            shouldForceS3Threshold: shouldForceScenarioCThresholdProbe,
            assistantIssuedS3Threshold: assistantIssuedScenarioCThresholdProbe,
            moment: currentInterviewMomentRef.current,
            scenario: currentScenarioRef.current,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    if (needsScenarioBJamesDifferentlyInsert) {
      const forcedJamesDifferentlyProbe =
        'Before things blew up, what do you think James could have done differently that might have helped Sarah feel appreciated?';
      const repairStripped = stripScenarioBRepairAsJamesQuestion(strippedText).trim();
      const sophieLeakMiddle =
        (/i didn't know what to say/i.test(repairStripped) || /i didn't know how/i.test(repairStripped)) &&
        /sophie/i.test(repairStripped);
      const leaksScenarioCIntoLeadIn =
        /sophie and daniel/i.test(repairStripped) ||
        sophieLeakMiddle ||
        /\[scenario_complete:2\]/i.test(strippedText);
      const bLeadIn = leaksScenarioCIntoLeadIn || !repairStripped ? '' : repairStripped;
      let stagedMessages = messagesToUse;
      if (bLeadIn) {
        const detectedScenario = detectScenarioFromResponse(bLeadIn);
        if (detectedScenario !== null) currentScenarioRef.current = detectedScenario;
        const scenarioNum =
          currentScenarioRef.current ??
          detectedScenario ??
          getScenarioNumberForNewMessage(messagesToUse, 'assistant', bLeadIn);
        const aiMsg: MessageWithScenario = {
          role: 'assistant',
          content: bLeadIn,
          scenarioNumber: scenarioNum,
        };
        stagedMessages = [...messagesToUse, aiMsg];
        setMessages(stagedMessages);
        applyInterviewProgressFromAssistantText(bLeadIn, progressRefsPayload);
        await speakTextSafe(bLeadIn, ASSISTANT_INTERVIEW_SPEECH);
      }
      if (__DEV__) {
        console.log('[S2_JAMES_DIFF_FORCED]', { scenarioBQ1Engaged, sidedEntirelyWithJames });
      }
      void remoteLog('[S2_JAMES_DIFF_FORCED]', {
        scenarioBQ1Engaged,
        sidedEntirelyWithJames,
      });
      const wrappedJamesProbe = wrapForcedProbeWithAck(trimmed, bLeadIn || strippedText, forcedJamesDifferentlyProbe, recentAsstForAck);
      const probeMsg: MessageWithScenario = {
        role: 'assistant',
        content: wrappedJamesProbe,
        scenarioNumber:
          currentScenarioRef.current ??
          getScenarioNumberForNewMessage(stagedMessages, 'assistant', wrappedJamesProbe),
      };
      setMessages([...stagedMessages, probeMsg]);
      await speakTextSafe(wrappedJamesProbe, ASSISTANT_INTERVIEW_SPEECH);
      setVoiceState('idle');
      return;
    }
    if (
      shouldForceScenarioCThresholdProbe &&
      !assistantIssuedScenarioCThresholdProbe &&
      !assistantTurnIsElongatingProbeOnly &&
      !text.includes('[INTERVIEW_COMPLETE]')
    ) {
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'AriaScreen.tsx:S3_THRESHOLD_FORCE',
          message: 'entered_s3_threshold_injection',
          hypothesisId: 'H4',
          data: {
            assistantIssuedScenarioCThresholdProbe,
            prematureMoment4: assistantTextIsPrematureMoment4HandoffDuringScenarioC(strippedText),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      const forcedThresholdProbe =
        "At what point would you say Daniel or Sophie should decide this relationship isn't working?";
      const prematureMoment4Handoff = assistantTextIsPrematureMoment4HandoffDuringScenarioC(strippedText);
      let stagedMessages = messagesToUse;
      if (strippedText && !prematureMoment4Handoff) {
        const detectedScenario = detectScenarioFromResponse(strippedText);
        if (detectedScenario !== null) currentScenarioRef.current = detectedScenario;
        const scenarioNum =
          currentScenarioRef.current ??
          detectedScenario ??
          getScenarioNumberForNewMessage(messagesToUse, 'assistant', strippedText);
        const aiMsg: MessageWithScenario = {
          role: 'assistant',
          content: strippedText,
          scenarioNumber: scenarioNum,
        };
        stagedMessages = [...messagesToUse, aiMsg];
        setMessages(stagedMessages);
        applyInterviewProgressFromAssistantText(strippedText, progressRefsPayload);
        await speakAssistantTurn(strippedText, ASSISTANT_INTERVIEW_SPEECH);
      }
      if (__DEV__) {
        console.log('[S3_THRESHOLD_FORCED]', {
          scenarioCThresholdStrict,
          scenarioCThresholdLegacy,
          shouldForceScenarioCThresholdProbe,
          assistantIssuedScenarioCThresholdProbe,
          reason: 'Scenario C post-repair corpus lacked Daniel/Sophie-anchored commitment-threshold criteria',
        });
      }
      void remoteLog('[S3_THRESHOLD_FORCED]', {
        scenarioCThresholdStrict,
        scenarioCThresholdLegacy,
        shouldForceScenarioCThresholdProbe,
        assistantIssuedScenarioCThresholdProbe,
        reason: 'Scenario C post-repair corpus lacked Daniel/Sophie-anchored commitment-threshold criteria',
      });
      const wrappedS3ThresholdProbe = wrapForcedProbeWithAck(trimmed, strippedText, forcedThresholdProbe, recentAsstForAck);
      const probeMsg: MessageWithScenario = {
        role: 'assistant',
        content: wrappedS3ThresholdProbe,
        scenarioNumber:
          currentScenarioRef.current ??
          getScenarioNumberForNewMessage(stagedMessages, 'assistant', wrappedS3ThresholdProbe),
      };
      setMessages([...stagedMessages, probeMsg]);
      await speakTextSafe(wrappedS3ThresholdProbe, ASSISTANT_INTERVIEW_SPEECH);
      setVoiceState('idle');
      return;
    }
    if (
      shouldForceMoment4ThresholdProbe &&
      !assistantIssuedMoment4ThresholdProbe &&
      !assistantTurnIsElongatingProbeOnly &&
      !text.includes('[INTERVIEW_COMPLETE]')
    ) {
      const forcedThresholdProbe =
        'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?';
      let stagedMessages = messagesToUse;
      if (strippedText) {
        const detectedScenario = detectScenarioFromResponse(strippedText);
        if (detectedScenario !== null) currentScenarioRef.current = detectedScenario;
        const scenarioNum =
          currentScenarioRef.current ??
          detectedScenario ??
          getScenarioNumberForNewMessage(messagesToUse, 'assistant', strippedText);
        const aiMsg: MessageWithScenario = {
          role: 'assistant',
          content: strippedText,
          scenarioNumber: scenarioNum,
        };
        stagedMessages = [...messagesToUse, aiMsg];
        setMessages(stagedMessages);
        applyInterviewProgressFromAssistantText(strippedText, progressRefsPayload);
        await speakAssistantTurn(strippedText, ASSISTANT_INTERVIEW_SPEECH);
      }
      const combinedMsg: MessageWithScenario = {
        role: 'assistant',
        content: forcedThresholdProbe,
        scenarioNumber:
          currentScenarioRef.current ??
          getScenarioNumberForNewMessage(stagedMessages, 'assistant', forcedThresholdProbe),
      };
      stagedMessages = [...stagedMessages, combinedMsg];
      setMessages(stagedMessages);
      await speakTextSafe(forcedThresholdProbe, ASSISTANT_INTERVIEW_SPEECH);
      moment4ThresholdProbeAskedRef.current = true;
      void remoteLog('[M4_THRESHOLD_FORCED]', {
        injectedCommitmentFollowUp: true,
        moment4CommitmentFollowUpConditionMet: true,
        relationshipTypeDiagnosticOnly: relationshipEval.relationshipType,
        moment4ThresholdHintInAnswer,
      });
      setVoiceState('idle');
      return;
    }

      // Failsafe: AI acknowledged closing question but did not output [SCENARIO_COMPLETE] or next scenario — inject advance so interview does not stop
      const closingAckPattern = /\b(got it|okay|alright)\b.*\b(move on|on to the next|next one)\b/i;
      const looksLikeClosingAck = closingAckPattern.test(text) || (/\blet'?s move on\b/i.test(text) && /got it|okay|alright/i.test(text));
      const justAnsweredClosing = lastAnsweredClosingScenarioRef.current != null;
      const noScenarioCompleteInResponse = !/\[SCENARIO_COMPLETE:\d\]/.test(text);
      if (justAnsweredClosing && looksLikeClosingAck && noScenarioCompleteInResponse) {
        const scenarioNumber = lastAnsweredClosingScenarioRef.current as 1 | 2 | 3;
        const canAdvance =
          closingQuestionAskedRef.current[scenarioNumber] === true &&
          closingQuestionAnsweredRef.current[scenarioNumber] === true;
        let nextContent = '';
        if (scenarioNumber === 1) {
          interviewMomentsCompleteRef.current[1] = true;
          currentInterviewMomentRef.current = 2;
          nextContent = buildScenario1To2BundleForInterview(participantFirstNameForSpoken, SCENARIO_2_TEXT);
        } else if (scenarioNumber === 2) {
          interviewMomentsCompleteRef.current[2] = true;
          currentInterviewMomentRef.current = 3;
          nextContent = buildScenario2To3TransitionBody(participantFirstNameForSpoken, SCENARIO_3_TEXT);
        } else if (scenarioNumber === 3) {
          if (personalHandoffInjectedRef.current) {
            nextContent = stripControlTokens(text) || 'Got it.';
          } else {
            nextContent = buildMoment4HandoffForInterview(participantFirstNameForSpoken, MOMENT_4_PERSONAL_CARD);
            personalHandoffInjectedRef.current = true;
            interviewMomentsCompleteRef.current[3] = true;
            currentInterviewMomentRef.current = 4;
          }
        }
        const fullDisplay = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
          sanitizeAssistantInterviewerCharacterNames(nextContent || (stripControlTokens(text) || 'Got it.')),
          participantFirstNameForSpoken,
        );
        const nextScenarioNum = scenarioNumber === 1 ? 2 : scenarioNumber === 2 ? 3 : 3;
        const newAssistantMsg: MessageWithScenario = { role: 'assistant', content: fullDisplay, scenarioNumber: nextScenarioNum };
        currentScenarioRef.current = nextScenarioNum;
        const updatedMessages = [...messagesToUse, newAssistantMsg];
        setMessages(updatedMessages);
        applyInterviewProgressFromAssistantText(fullDisplay, progressRefsPayload);
        await speakAssistantTurn(fullDisplay, ASSISTANT_INTERVIEW_SPEECH);
        if (canAdvance) {
          setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
          if (!scoredScenariosRef.current.has(scenarioNumber)) {
            scoredScenariosRef.current.add(scenarioNumber);
            scoreScenario(scenarioNumber, scenarioNumber === 3 ? messagesToUse : updatedMessages);
          }
          if (__DEV__) {
            closingQuestionAskedRef.current[scenarioNumber] = false;
            closingQuestionAnsweredRef.current[scenarioNumber] = false;
          }
        }
        lastAnsweredClosingScenarioRef.current = null;
        setVoiceState('idle');
        if (__DEV__) console.log('[Aria] Closing-ack failsafe: advanced to next scenario', scenarioNumber);
        return;
      }

      // Failsafe: AI repeated the closing question (e.g. asked again after user said "no") — don't display; advance instead
      const repeatClosingMatch = text.match(/\[CLOSING_QUESTION:(\d)\]/);
      if (repeatClosingMatch) {
        const scenarioNumber = parseInt(repeatClosingMatch[1], 10) as 1 | 2 | 3;
        if (closingQuestionAnsweredRef.current[scenarioNumber] === true) {
          if (__DEV__) console.warn('[Aria] Closing question repeat detected — advancing without displaying');
          let nextContent = '';
          if (scenarioNumber === 1) {
            interviewMomentsCompleteRef.current[1] = true;
            currentInterviewMomentRef.current = 2;
            nextContent = buildScenario1To2BundleForInterview(participantFirstNameForSpoken, SCENARIO_2_TEXT);
          } else if (scenarioNumber === 2) {
            interviewMomentsCompleteRef.current[2] = true;
            currentInterviewMomentRef.current = 3;
            nextContent = buildScenario2To3TransitionBody(participantFirstNameForSpoken, SCENARIO_3_TEXT);
          } else if (scenarioNumber === 3) {
            if (personalHandoffInjectedRef.current) {
              nextContent = stripControlTokens(text) || 'Got it.';
            } else {
              nextContent = buildMoment4HandoffForInterview(participantFirstNameForSpoken, MOMENT_4_PERSONAL_CARD);
              personalHandoffInjectedRef.current = true;
              interviewMomentsCompleteRef.current[3] = true;
              currentInterviewMomentRef.current = 4;
            }
          }
          const fullDisplay = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
            sanitizeAssistantInterviewerCharacterNames(nextContent || 'Got it.'),
            participantFirstNameForSpoken,
          );
          const nextScenarioNum = scenarioNumber === 1 ? 2 : scenarioNumber === 2 ? 3 : 3;
          const newAssistantMsg: MessageWithScenario = { role: 'assistant', content: fullDisplay, scenarioNumber: nextScenarioNum };
          currentScenarioRef.current = nextScenarioNum;
          const updatedMessages = [...messagesToUse, newAssistantMsg];
          setMessages(updatedMessages);
          applyInterviewProgressFromAssistantText(fullDisplay, progressRefsPayload);
          await speakAssistantTurn(fullDisplay, ASSISTANT_INTERVIEW_SPEECH);
          setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
          if (!scoredScenariosRef.current.has(scenarioNumber)) {
            scoredScenariosRef.current.add(scenarioNumber);
            scoreScenario(scenarioNumber, scenarioNumber === 3 ? messagesToUse : updatedMessages);
          }
          if (__DEV__) {
            closingQuestionAskedRef.current[scenarioNumber] = false;
            closingQuestionAnsweredRef.current[scenarioNumber] = false;
          }
          lastAnsweredClosingScenarioRef.current = null;
          setVoiceState('idle');
          return;
        }
      }

      // Per-scenario completion token: strip token, show summary, insert score card in chat
      // Process INTERVIEW_COMPLETE first — wait for TTS to finish before showing loading screen
      if (text.includes('[INTERVIEW_COMPLETE]')) {
        void persistInterviewAttemptSessionLifecycle(interviewSessionAttemptIdRef.current, 'completed');
        await remoteLog('[0] INTERVIEW_COMPLETE token detected in response', {
          isAdmin,
          ALPHA_MODE,
          userId: userId ?? null,
          responseLength: text.length,
          interviewStatus,
        });
        if (__DEV__) {
          console.log('=== INTERVIEW_COMPLETE TOKEN DETECTED ===');
        }
        interviewMomentsCompleteRef.current[4] = true;
        currentInterviewMomentRef.current = 4;
        let closingRaw = stripControlTokens(text) || 'Thank you. That was really helpful.';
        closingRaw = stripFlatReflectionAcknowledgmentOpeners(closingRaw);
        closingRaw = stripGenericReflectionFillersFirstParagraph(closingRaw);
        closingRaw = stripHollowSystemInterviewerPhrases(closingRaw);
        closingRaw = collapseStackedEmpathyIHearYouInFirstParagraph(closingRaw);
        closingRaw = stripForbiddenReflectionLead(closingRaw);
        let displayText = sanitizeClosingLanguage(closingRaw);
        displayText = ensureAcknowledgmentBeforeClosing(
          displayText,
          trimmed,
          recentAssistantMessagesForAck(messagesToUse)
        );
        {
          const preNameClose = displayText;
          displayText = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
            sanitizeAssistantInterviewerCharacterNames(displayText),
            participantFirstNameForSpoken,
          );
          // #region agent log
          if (
            interviewAssistantTextHasDisallowedNameMarker(closingRaw) ||
            interviewAssistantTextHasDisallowedNameMarker(preNameClose) ||
            interviewAssistantTextHasDisallowedNameMarker(displayText)
          ) {
            fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
              body: JSON.stringify({
                sessionId: 'e70f17',
                location: 'AriaScreen.tsx:INTERVIEW_COMPLETE',
                message: 'name_sanitize_interview_complete',
                data: {
                  hypothesisId: 'H4',
                  path: 'interview_complete',
                  preSanitizeHas: interviewAssistantTextHasDisallowedNameMarker(preNameClose),
                  postSanitizeHas: interviewAssistantTextHasDisallowedNameMarker(displayText),
                  changed: preNameClose !== displayText,
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
          }
          // #endregion
        }
        displayText = ensureSpokenTextIncludesParticipantFirstName(displayText, participantFirstNameForSpoken, {
          allowAppendWhenMissing: true,
        });
        const finalAssistant: MessageWithScenario = {
          role: 'assistant',
          content: displayText,
          scenarioNumber: currentScenarioRef.current ?? getScenarioNumberForNewMessage(messagesToUse, 'assistant', displayText),
        };
        const finalMessages = [...messagesToUse, finalAssistant];
        setMessages(finalMessages);
        isInterviewCompleteRef.current = true;
        const transcriptForScoring = finalMessages.filter((m) => m.role === 'user' || m.role === 'assistant');
        try {
          await speakAssistantTurn(displayText, { telemetrySource: 'turn' });
        } catch {
          /* proceed to scoring even if TTS fails */
        }
        pendingCompletionTranscriptRef.current = transcriptForScoring;
        if (userId) {
          const completed = Array.from(scoredScenariosRef.current);
          const scenarioScoresPayload: Record<
            number,
            {
              pillarScores: Record<string, number | null>;
              pillarConfidence: Record<string, string>;
              keyEvidence: Record<string, string>;
              scenarioName?: string;
            }
          > = {};
          [1, 2, 3].forEach((n) => {
            const s = scenarioScoresRef.current[n];
            if (s) {
              scenarioScoresPayload[n] = {
                pillarScores: s.pillarScores,
                pillarConfidence: s.pillarConfidence,
                keyEvidence: s.keyEvidence,
                scenarioName: s.scenarioName,
              };
            }
          });
          await saveInterviewProgress(userId, {
            messages: transcriptForScoring,
            scenariosCompleted: completed,
            scenarioScores: scenarioScoresPayload,
            currentScenario: getCurrentScenario(scoredScenariosRef.current),
            pendingCompletion: true,
          });
        }
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            runId: 'pre-fix',
            hypothesisId: 'H3',
            location: 'AriaScreen.tsx:INTERVIEW_COMPLETE',
            message: 'pending_completion_set_true',
            data: {
              completedCount: scoredScenariosRef.current.size,
              transcriptLen: transcriptForScoring.length,
              statusBeforeSet: statusRef.current,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        setPendingCompletion(true);
        return;
      }

      // Then handle per-scenario completion tokens (may appear in earlier messages or alongside other markers)
      const scenarioMatch = text.match(/\[SCENARIO_COMPLETE:(\d)\]/);
      if (scenarioMatch) {
        lastAnsweredClosingScenarioRef.current = null;
        const scenarioNumber = parseInt(scenarioMatch[1], 10) as 1 | 2 | 3;
        let transitionDisplay = stripControlTokens(text) || "Good, that's helpful.";
        transitionDisplay = stripFlatReflectionAcknowledgmentOpeners(transitionDisplay);
        transitionDisplay = stripGenericReflectionFillersFirstParagraph(transitionDisplay);
        transitionDisplay = stripHollowSystemInterviewerPhrases(transitionDisplay);
        transitionDisplay = collapseStackedEmpathyIHearYouInFirstParagraph(transitionDisplay);
        transitionDisplay = stripForbiddenReflectionLead(transitionDisplay);
        {
          const beforeTok = transitionDisplay;
          transitionDisplay = ensureScenario3VignetteOpening(transitionDisplay);
          if (transitionDisplay !== beforeTok) {
            void remoteLog('[S3_VIGNETTE_OPENING_REPAIRED]', { path: 'scenario_complete', preview: transitionDisplay.slice(0, 200) });
          }
        }
        let displayText = ensureAcknowledgmentBeforeMove(
          transitionDisplay,
          trimmed,
          recentAssistantMessagesForAck(messagesToUse),
          currentInterviewMomentRef.current
        );
        {
          const preNameSc = displayText;
          displayText = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
            sanitizeAssistantInterviewerCharacterNames(displayText),
            participantFirstNameForSpoken,
          );
          // #region agent log
          if (
            interviewAssistantTextHasDisallowedNameMarker(transitionDisplay) ||
            interviewAssistantTextHasDisallowedNameMarker(preNameSc) ||
            interviewAssistantTextHasDisallowedNameMarker(displayText)
          ) {
            fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
              body: JSON.stringify({
                sessionId: 'e70f17',
                location: 'AriaScreen.tsx:SCENARIO_COMPLETE',
                message: 'name_sanitize_scenario_complete',
                data: {
                  hypothesisId: 'H4',
                  path: 'scenario_complete',
                  preSanitizeHas: interviewAssistantTextHasDisallowedNameMarker(preNameSc),
                  postSanitizeHas: interviewAssistantTextHasDisallowedNameMarker(displayText),
                  changed: preNameSc !== displayText,
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
          }
          // #endregion
        }
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H10',location:'AriaScreen.tsx:scenarioCompleteDisplayTextNameCheck',message:'scenario_complete_display_text_name_presence',data:{displayPreview:displayText.slice(0,160),displayHasName:participantFirstNameForSpoken?displayText.toLowerCase().includes(participantFirstNameForSpoken.toLowerCase()):null,participantFirstNameForSpoken:participantFirstNameForSpoken??null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        applyInterviewProgressFromAssistantText(displayText, progressRefsPayload);
        const transitionMsg: MessageWithScenario = { role: 'assistant', content: displayText, scenarioNumber };
        const nextScenarioNum = scenarioNumber < 3 ? (scenarioNumber + 1) as 2 | 3 : 3;
        currentScenarioRef.current = nextScenarioNum;
        const updatedMessages = [...messagesToUse, transitionMsg];
        setMessages(updatedMessages);
        await speakAssistantTurn(displayText, ASSISTANT_INTERVIEW_SPEECH);
        setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
        if (!scoredScenariosRef.current.has(scenarioNumber)) {
          scoredScenariosRef.current.add(scenarioNumber);
          scoreScenario(scenarioNumber, updatedMessages);
        }
        if (scenarioNumber === 3) {
          const corpus = extractScenario3UserCorpus(updatedMessages);
          void remoteLog('[S3_THRESHOLD_POST_COMPLETE]', {
            scenarioCThresholdStrict: hasScenarioCCommitmentThresholdInUserAnswer(corpus),
            scenarioCThresholdLegacy: hasCommitmentThresholdSignal(corpus),
            corpusCharCount: corpus.length,
            corpusPreview: corpus.slice(0, 650),
          });
        }
        if (__DEV__) {
          closingQuestionAskedRef.current[scenarioNumber] = false;
          closingQuestionAnsweredRef.current[scenarioNumber] = false;
        }
        setVoiceState('idle');
        return;
      }

      const stageCompleteMatch = text.match(/\[STAGE_([123])_COMPLETE\]/);
      if (stageCompleteMatch) {
        const stageNum = parseInt(stageCompleteMatch[1], 10);
        let stageDisplay = stripControlTokens(text) || "Good, that's helpful.";
        stageDisplay = stripFlatReflectionAcknowledgmentOpeners(stageDisplay);
        stageDisplay = stripGenericReflectionFillersFirstParagraph(stageDisplay);
        stageDisplay = stripHollowSystemInterviewerPhrases(stageDisplay);
        stageDisplay = collapseStackedEmpathyIHearYouInFirstParagraph(stageDisplay);
        stageDisplay = stripForbiddenReflectionLead(stageDisplay);
        let displayText = ensureAcknowledgmentBeforeMove(
          stageDisplay,
          trimmed,
          recentAssistantMessagesForAck(messagesToUse),
          currentInterviewMomentRef.current
        );
        displayText = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
          sanitizeAssistantInterviewerCharacterNames(displayText),
          participantFirstNameForSpoken,
        );
        if (userId) {
          const rtd = getSessionLogRuntime();
          writeSessionLog({
            userId,
            attemptId: rtd.attemptId,
            eventType: 'name_injection_debug',
            eventData: {
              stage: 'stage_complete_display',
              moment_number: currentInterviewMomentRef.current,
              scenario_number: currentScenarioRef.current,
              display_has_name: participantFirstNameForSpoken
                ? displayText.toLowerCase().includes(participantFirstNameForSpoken.toLowerCase())
                : null,
              display_preview: displayText.slice(0, 140),
            },
            platform: rtd.platform,
          });
        }
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H11',location:'AriaScreen.tsx:stageCompleteDisplayTextNameCheck',message:'stage_complete_display_text_name_presence',data:{stageNum,displayPreview:displayText.slice(0,180),displayHasName:participantFirstNameForSpoken?displayText.toLowerCase().includes(participantFirstNameForSpoken.toLowerCase()):null,participantFirstNameForSpoken:participantFirstNameForSpoken??null,currentMoment:currentInterviewMomentRef.current},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const finalMessages = [...messagesToUse, { role: 'assistant', content: displayText || 'Good, that’s helpful.' }];
        setMessages(finalMessages);
        await speakAssistantTurn(displayText || 'Good, that’s helpful.', ASSISTANT_INTERVIEW_SPEECH);
        try {
          const stageRes = await fetchStageScore(finalMessages);
          setStageResults((prev) => {
            const existing = prev.findIndex((s) => s.stage === stageNum);
            const entry = { stage: stageNum, results: stageRes };
            if (existing >= 0) return prev.map((s, i) => (i === existing ? entry : s));
            return [...prev, entry];
          });
        } catch {
          const fallback = {
            pillarScores: { ...FALLBACK_MARKER_SCORES_MID },
            keyEvidence: {},
            narrativeCoherence: 'moderate' as const,
            behavioralSpecificity: 'moderate' as const,
            notableInconsistencies: [],
            interviewSummary: 'Score unavailable.',
          };
          setStageResults((prev) => {
            const existing = prev.findIndex((s) => s.stage === stageNum);
            const entry = { stage: stageNum, results: fallback };
            if (existing >= 0) return prev.map((s, i) => (i === existing ? entry : s));
            return [...prev, entry];
          });
        }
        setVoiceState('idle');
        return;
      }

      const closingQuestionMatch = text.match(/\[CLOSING_QUESTION:(\d)\]/);
      if (closingQuestionMatch) {
        const n = parseInt(closingQuestionMatch[1], 10) as 1 | 2 | 3;
        markClosingQuestionAsked(n);
        setClosingQuestionPending(true);
        setClosingQuestionScenario(n);
      }

      const displayText = ensureAcknowledgmentBeforeMove(
        strippedText,
        trimmed,
        recentAsstForAck,
        currentInterviewMomentRef.current
      );
      const detectedScenario = detectScenarioFromResponse(displayText);
      if (detectedScenario !== null) currentScenarioRef.current = detectedScenario;
      const scenarioNum = currentScenarioRef.current ?? detectedScenario ?? getScenarioNumberForNewMessage(messagesToUse, 'assistant', displayText);
      if (isClosingQuestion(displayText)) {
        setClosingQuestionPending(true);
        const scenarioForClosing = (scenarioNum === 1 || scenarioNum === 2 || scenarioNum === 3 ? scenarioNum : 1) as 1 | 2 | 3;
        setClosingQuestionScenario(scenarioForClosing);
        lastClosingQuestionScenarioRef.current = scenarioForClosing;
        closingQuestionAskedRef.current[scenarioForClosing] = true;
        setClosingQuestionState((prev) => ({ ...prev, [scenarioForClosing]: 'asked' }));
      }
      const aiMsg: MessageWithScenario = {
        role: 'assistant',
        content: displayText,
        scenarioNumber: scenarioNum,
      };
      lastAnsweredClosingScenarioRef.current = null;
      applyInterviewProgressFromAssistantText(displayText, progressRefsPayload);
      setMessages([...messagesToUse, aiMsg]);
      const aiDetected = detectConstructs(text);
      setTouchedConstructs((prev) => [...new Set([...prev, ...aiDetected])]);
      await speakAssistantTurn(displayText, ASSISTANT_INTERVIEW_SPEECH);
    } finally {
      setIsWaiting(false);
    }
  }, [
    messages,
    speakTextSafe,
    route?.name,
    userId,
    navigation,
    queryClient,
    profile,
    fetchStageScore,
    scoreScenario,
    usedPersonalExamples,
    markClosingQuestionAsked,
    markClosingQuestionAnswered,
  ]);

  const handlePressStart = useCallback(async () => {
    /** Hold-to-talk web: flush pending TTS before any guard that returns (Whisper path uses mic onMicPressIn only). */
    if (Platform.OS === 'web') {
      const t = peekPendingWebSpeechGesture(pendingWebSpeechForGestureRef);
      if (t) {
        clearPendingWebSpeechGesturePair(pendingWebSpeechForGestureRef);
        trySpeakWebSpeechInUserGesture(t, () => {});
        return;
      }
    }
    if (voiceState !== 'idle') return;
    if (useMediaRecorderPath) return; // expo-av / MediaRecorder — mic uses tap handler, not press-in
    setMicWarning(null);
    stopElevenLabsSpeech();
    setCurrentTranscript('');
    transcriptAtReleaseRef.current = '';
    const permission = await checkMicPermission();
    setMicPermission(permission);
    if (permission === 'denied') return;
    timingRef.current.recordingStartTime = Date.now();
    setVoiceState('listening');
    if (Platform.OS === 'web' && recognitionRef.current) {
      try { recognitionRef.current.start(); } catch {}
    }
  }, [voiceState, useMediaRecorderPath]);

  const handleRecordingError = useCallback(
    (err: Error) => {
      if (__DEV__) console.error('Recording error:', err.message);
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'AriaScreen.tsx:handleRecordingError',
          message: 'recording_onError',
          data: {
            hypothesisId: 'MicGate-1',
            errName: err.name,
            errMsgPreview: err.message.slice(0, 220),
            voiceState: voiceStateRef.current,
            ttsLineInFlight: ttsLineInFlightRef.current,
            ttsPlaybackActive: getSessionLogRuntime().ttsPlaybackActive,
            webPlaybackSurface: isWebInterviewPlaybackSurfaceActive(),
          },
          timestamp: Date.now(),
          runId: 'mic-quiesce',
        }),
      }).catch(() => {});
      // #endregion
      setVoiceState('idle');
      const msg = assistantMessageForRecordingHardwareFailure(Platform.OS === 'web');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: msg },
      ]);
      speakTextSafe(msg).catch(() => {});
    },
    [speakTextSafe]
  );

  /** Transcribe audio (blob on web; on native prefer blob from hook, else URI or base64). Returns null on failure. */
  const transcribeSafe = useCallback(
    async (
      audioBlob: Blob | null,
      nativeUri: string | null
    ): Promise<
      | { text: string; language: string | null; confidence: number | null }
      | { kind: 'whisper_infra_exhausted' }
      | null
    > => {
      void remoteLog('[TRANSCRIBE] entry', {
        runId: 'audio-route-debug-10',
        platform: Platform.OS,
        blobSize: audioBlob?.size ?? 0,
        hasNativeUri: !!nativeUri,
        hasOpenAIKey: !!OPENAI_API_KEY,
        hasWhisperProxy: !!OPENAI_WHISPER_PROXY_URL,
        hasSupabaseAnonKey: !!SUPABASE_ANON_KEY,
      });
      if (__DEV__) {
        console.log('=== TRANSCRIPTION DEBUG ===', 'Platform:', Platform.OS, 'Native URI:', nativeUri ?? 'none', 'Blob size:', audioBlob?.size ?? 0, 'Endpoint:', OPENAI_WHISPER_PROXY_URL || 'openai');
      }
      try {
        const transcriptUrl = OPENAI_WHISPER_PROXY_URL || 'https://api.openai.com/v1/audio/transcriptions';
        const authHeaders: Record<string, string> = OPENAI_WHISPER_PROXY_URL
          ? (SUPABASE_ANON_KEY
              ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY }
              : {})
          : { Authorization: `Bearer ${OPENAI_API_KEY}` };

        let webTranscribeHeaders = authHeaders;
        if (Platform.OS === 'web' && OPENAI_WHISPER_PROXY_URL && !webTranscribeHeaders.Authorization) {
          const sessionResult = await supabase.auth.getSession().catch(() => null);
          const accessToken = sessionResult?.data?.session?.access_token?.trim();
          if (accessToken) {
            webTranscribeHeaders = { Authorization: `Bearer ${accessToken}` };
          }
        }

        const transcribeStarted = Date.now();
        const bm = transcribeBufferMetaRef.current;
        const whisperTimeoutMs = getAudioWhisperTranscriptionTimeoutMs(bm?.audio_duration_ms);

        const whisperFailureReason = (err: unknown): string => {
          if (err instanceof Error && err.message === 'empty_transcription_retryable') {
            return 'empty_transcription_retryable';
          }
          const st = (err as { status?: number }).status;
          if (typeof st === 'number') return `http_${st}`;
          const msg = err instanceof Error ? err.message : String(err);
          return msg.slice(0, 200);
        };

        const whisperShouldRetry = (err: unknown): boolean => {
          if (err instanceof Error && err.message === 'empty_transcription_retryable') return true;
          if (err instanceof Error && err.message === 'Empty transcription result') return false;
          if (err instanceof Error && err.message === 'No audio data') return false;
          return classifyError(err) !== 'unrecoverable';
        };

        let transcript: { text: string; language: string | null; confidence: number | null };
        try {
          transcript = await runWithThreeAttemptsFixedBackoff({
            delaysMs: [1000, 2000],
            shouldRetry: (err) => whisperShouldRetry(err),
            onRetry: ({ nextAttempt, delayMs, error }) => {
              if (userId) {
                const r = getSessionLogRuntime();
                markLastAudioSessionEventType('whisper_retry');
                writeAudioSessionLog({
                  userId,
                  attemptId: r.attemptId,
                  eventType: 'whisper_retry',
                  eventData: {
                    attempt_number: nextAttempt,
                    failure_reason: whisperFailureReason(error),
                    moment_number: currentInterviewMomentRef.current,
                    delay_ms_before_retry: delayMs,
                  },
                  platform: r.platform,
                });
              }
            },
            run: async (attemptNumber) => {
              const lastWhisperRequestCtx = { ts: Date.now() };
              const performWhisperOnce = async (): Promise<{
                text: string;
                language: string | null;
                confidence: number | null;
                raw: unknown;
              }> => {
                const requestTs = Date.now();
                lastWhisperRequestCtx.ts = requestTs;
                if (userId) {
                  const r = getSessionLogRuntime();
                  markLastAudioSessionEventType('whisper_request');
                  writeAudioSessionLog({
                    userId,
                    attemptId: r.attemptId,
                    eventType: 'whisper_request',
                    eventData: {
                      audio_duration_ms: bm?.audio_duration_ms ?? null,
                      buffer_size_bytes: bm?.buffer_size_bytes ?? audioBlob?.size ?? 0,
                      language_parameter: WHISPER_LANGUAGE,
                      temperature_parameter: WHISPER_TEMPERATURE,
                      moment_number: currentInterviewMomentRef.current,
                      request_timestamp: requestTs,
                    },
                    platform: r.platform,
                  });
                }
                if (Platform.OS !== 'web' && nativeUri) {
                  let nativeAuthHeaders = authHeaders;
                  if (OPENAI_WHISPER_PROXY_URL && !nativeAuthHeaders.Authorization) {
                    const sessionResult = await supabase.auth.getSession().catch(() => null);
                    const accessToken = sessionResult?.data?.session?.access_token?.trim();
                    if (accessToken) {
                      nativeAuthHeaders = {
                        Authorization: `Bearer ${accessToken}`,
                      };
                    }
                    void remoteLog('[TRANSCRIBE] proxy_auth_fallback', {
                      runId: 'audio-route-debug-10',
                      hasSessionToken: !!accessToken,
                      usedFallbackToken: !!accessToken,
                    });
                  }
                  const legacyUploadType = (
                    FileSystemLegacy as unknown as { FileSystemUploadType?: { MULTIPART?: number } }
                  ).FileSystemUploadType?.MULTIPART;
                  const uploadResult = await raceTranscribeWithTimeout(
                    FileSystemLegacy.uploadAsync(transcriptUrl, nativeUri, {
                      httpMethod: 'POST',
                      uploadType: (legacyUploadType ?? 1) as unknown as never,
                      fieldName: 'file',
                      mimeType: 'audio/mp4',
                      parameters: {
                        model: WHISPER_MODEL,
                        response_format: 'verbose_json',
                        language: WHISPER_LANGUAGE,
                        temperature: String(WHISPER_TEMPERATURE),
                      },
                      headers: nativeAuthHeaders,
                    }),
                    whisperTimeoutMs,
                    'whisper_upload'
                  );
                  if (__DEV__) console.log('Transcription response status:', uploadResult.status);
                  if (uploadResult.status < 200 || uploadResult.status >= 300) {
                    void remoteLog('[TRANSCRIBE] non_ok_response', {
                      runId: 'audio-route-debug-10',
                      endpointUsed: OPENAI_WHISPER_PROXY_URL ? 'proxy' : 'openai',
                      status: uploadResult.status,
                      bodyPreview: (uploadResult.body ?? '').slice(0, 160),
                    });
                    const err = new Error(uploadResult.body?.slice(0, 200) || `HTTP ${uploadResult.status}`);
                    Object.assign(err, { status: uploadResult.status });
                    throw err;
                  }
                  const parsed = JSON.parse(uploadResult.body) as unknown;
                  const p = parseWhisperTranscriptionPayload(parsed);
                  return {
                    text: p.text,
                    language: p.language ?? WHISPER_LANGUAGE,
                    confidence: p.confidence,
                    raw: parsed,
                  };
                }

                if (!audioBlob || audioBlob.size === 0) throw new Error('No audio data');
                const form = new FormData();
                form.append('file', whisperUploadFilePart(audioBlob));
                form.append('model', WHISPER_MODEL);
                form.append('response_format', 'verbose_json');
                form.append('language', WHISPER_LANGUAGE);
                form.append('temperature', String(WHISPER_TEMPERATURE));
                const res = await raceTranscribeWithTimeout(
                  fetch(transcriptUrl, { method: 'POST', headers: webTranscribeHeaders, body: form }),
                  whisperTimeoutMs,
                  'whisper_fetch'
                );
                if (__DEV__) console.log('Transcription response status:', res.status);
                if (!res.ok) {
                  const errText = await res.text();
                  void remoteLog('[TRANSCRIBE] non_ok_response', {
                    runId: 'audio-route-debug-10',
                    endpointUsed: OPENAI_WHISPER_PROXY_URL ? 'proxy' : 'openai',
                    status: res.status,
                    bodyPreview: errText.slice(0, 160),
                  });
                  const httpErr = new Error(errText);
                  Object.assign(httpErr, { status: res.status });
                  throw httpErr;
                }
                const rawJson = await res.json();
                const p = parseWhisperTranscriptionPayload(rawJson);
                return {
                  text: p.text,
                  language: p.language ?? WHISPER_LANGUAGE,
                  confidence: p.confidence,
                  raw: rawJson,
                };
              };

              const { text, language, confidence, raw } = await performWhisperOnce();
              const verbose = parseWhisperVerboseStats(raw);
              const latencyMs = Date.now() - lastWhisperRequestCtx.ts;
              if (userId) {
                const r = getSessionLogRuntime();
                markLastAudioSessionEventType('whisper_response');
                writeAudioSessionLog({
                  userId,
                  attemptId: r.attemptId,
                  eventType: 'whisper_response',
                  eventData: {
                    response_latency_ms: latencyMs,
                    transcript_text: text,
                    word_count: countSpokenWords(text),
                    detected_language: language ?? null,
                    overall_confidence: verbose.overall_confidence,
                    segment_count: verbose.segment_count,
                    min_segment_confidence: verbose.min_segment_confidence,
                    max_segment_confidence: verbose.max_segment_confidence,
                    avg_segment_confidence: verbose.avg_segment_confidence,
                    moment_number: currentInterviewMomentRef.current,
                  },
                  durationMs: latencyMs,
                  platform: r.platform,
                });
              }
              if (language && !whisperLanguageIsEnglish(language) && userId) {
                const r = getSessionLogRuntime();
                markLastAudioSessionEventType('whisper_language_mismatch');
                writeAudioSessionLog({
                  userId,
                  attemptId: r.attemptId,
                  eventType: 'whisper_language_mismatch',
                  eventData: {
                    detected_language: language,
                    transcript_text: text,
                    moment_number: currentInterviewMomentRef.current,
                  },
                  platform: r.platform,
                });
              }
              if (__DEV__) console.log('Transcription result length:', text.length, '=== END DEBUG ===');
              if (text.length < 2) {
                void remoteLog('[TRANSCRIBE] whisper_empty_text', {
                  hypothesisId: 'T18',
                  runId: 'audio-route-debug-10',
                  blobType: audioBlob?.type || '(none)',
                  blobSize: audioBlob?.size ?? 0,
                  rawTextLen: text.length,
                });
                const likelySpeech = await hasLikelySpeechAfterRecording({
                  peakMeteringDb: recordingPeakMeteringRef.current,
                  audioBlob,
                });
                if (likelySpeech) {
                  throw new Error('empty_transcription_retryable');
                }
                throw new Error('Empty transcription result');
              }
              void remoteLog('[TRANSCRIBE] success', {
                runId: 'audio-route-debug-10',
                endpointUsed: OPENAI_WHISPER_PROXY_URL ? 'proxy' : 'openai',
                transcriptLength: text.length,
                whisperLanguage: language,
              });
              const wcDone = countSpokenWords(text);
              if (wcDone < 3 && !isShortAnswerOkForWhisperRatioGate(lastQuestionTextRef.current) && userId) {
                const r = getSessionLogRuntime();
                markLastAudioSessionEventType('whisper_empty_transcript');
                writeAudioSessionLog({
                  userId,
                  attemptId: r.attemptId,
                  eventType: 'whisper_empty_transcript',
                  eventData: {
                    audio_duration_ms: bm?.audio_duration_ms ?? null,
                    raw_transcript: text,
                    word_count: wcDone,
                    moment_number: currentInterviewMomentRef.current,
                    retry_count: attemptNumber,
                  },
                  platform: r.platform,
                });
              }
              return { text, language, confidence };
            },
          });
        } catch (e) {
          if (!whisperShouldRetry(e)) {
            throw e;
          }
          if (userId) {
            const r = getSessionLogRuntime();
            markLastAudioSessionEventType('whisper_total_failure');
            writeAudioSessionLog({
              userId,
              attemptId: r.attemptId,
              eventType: 'whisper_total_failure',
              eventData: {
                moment_number: currentInterviewMomentRef.current,
                failure_reason: whisperFailureReason(e),
              },
              platform: r.platform,
            });
          }
          return { kind: 'whisper_infra_exhausted' as const };
        }
        if (userId) {
          const r = getSessionLogRuntime();
          markLastAudioSessionEventType('transcription_complete');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'transcription_complete',
            eventData: {
              detected_language: transcript.language ?? null,
            },
            durationMs: Date.now() - transcribeStarted,
            platform: r.platform,
          });
        }
        transcriptionFailureStreakRef.current = 0;
        return transcript;
      } catch (err) {
        void remoteLog('[TRANSCRIBE] catch', {
          runId: 'audio-route-debug-10',
          errorName: err instanceof Error ? err.name : 'unknown',
          errorMessage: err instanceof Error ? err.message : String(err),
          hasOpenAIKey: !!OPENAI_API_KEY,
          hasWhisperProxy: !!OPENAI_WHISPER_PROXY_URL,
          hasNativeUri: !!nativeUri,
          blobSize: audioBlob?.size ?? 0,
        });
        if (__DEV__) console.error('Transcription failed:', err instanceof Error ? err.message : err);
        recordingJustFinishedBeforeNextTtsRef.current = false;
        await deleteTurnAudioFile(nativeUri);
        transcriptionFailureStreakRef.current += 1;
        const msg = assistantMessageForRecordingOrTranscriptionFailure(
          transcriptionFailureStreakRef.current,
          Platform.OS === 'web'
        );
        setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
        setVoiceState('speaking');
        await speakTextSafe(msg).catch(() => {});
        setVoiceState('idle');
        return null;
      }
    },
    [speakTextSafe, deleteTurnAudioFile, userId, classifyError]
  );

  /** Web mic pressIn: same gesture flush as any-page tap (see ensureWebGestureFlushListener). */
  const handleWebMicPressIn = useCallback(() => {
    void runWebGestureTtsFlush('mic');
  }, [runWebGestureTtsFlush]);

  /** After foreground resume or native recording `mediaServicesDidReset` — re-probe input route and refresh session if it changed. */
  const applyRouteProbeAfterResume = useCallback(async (source: 'app_resume' | 'media_services_reset') => {
    const uid = userIdRef.current;
    if (!uid) return;
    if (Platform.OS === 'web') {
      const wr = await refreshWebAudioRoutesForSession();
      if (wr.changed && wr.previous) {
        debugNoteWebAudioRouteChange(source, {
          previousInputRoute: wr.previous.input_route,
          previousOutputRoute: wr.previous.output_route,
          newInputRoute: wr.inference.input_route,
          newOutputRoute: wr.inference.output_route,
        });
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId: uid,
          attemptId: r.attemptId,
          eventType: 'audio_route_changed',
          eventData: {
            previous_input_route: wr.previous.input_route,
            previous_output_route: wr.previous.output_route,
            new_input_route: wr.inference.input_route,
            new_output_route: wr.inference.output_route,
            headphones_connected: wr.inference.headphones_connected,
            devices_audit: wr.inference.devices_audit,
            moment_number: currentInterviewMomentRef.current,
            timestamp: new Date().toISOString(),
            source,
          },
          platform: r.platform,
        });
        if (audioRecorderIsRecordingForRouteRef.current) {
          routeChangedDuringRecordingRef.current = true;
          writeAudioSessionLog({
            userId: uid,
            attemptId: r.attemptId,
            eventType: 'audio_route_changed_during_recording_warning',
            eventData: {
              moment_number: currentInterviewMomentRef.current,
              source,
            },
            platform: r.platform,
          });
        }
        await refreshAudioSessionAfterRouteChange(source);
      }
      const p = await probeHeadphoneRoute();
      lastHeadphoneProbeRef.current = p;
      if (p.fingerprint != null) {
        lastAudioRouteFingerprintRef.current = p.fingerprint;
        setAudioRouteKind(p.kind);
      }
      return;
    }
    const p = await probeHeadphoneRoute();
    const prev = lastAudioRouteFingerprintRef.current;
    if (p.fingerprint != null && prev != null && p.fingerprint !== prev) {
      lastHeadphoneProbeRef.current = p;
      setAudioRouteKind(p.kind);
      lastAudioRouteFingerprintRef.current = p.fingerprint;
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId: uid,
        attemptId: r.attemptId,
        eventType: 'audio_route_changed',
        eventData: {
          previous_fingerprint: prev,
          fingerprint: p.fingerprint,
          kind: p.kind,
          source,
        },
        platform: r.platform,
      });
      await refreshAudioSessionAfterRouteChange(source);
    } else if (p.fingerprint != null) {
      lastHeadphoneProbeRef.current = p;
      lastAudioRouteFingerprintRef.current = p.fingerprint;
      setAudioRouteKind(p.kind);
    }
  }, []);

  /**
   * When VAD decode finds no frame above the adaptive threshold, we normally skip Whisper (bleed-through).
   * If decoded peak is still clearly above the session ambient floor (SNR), treat as likely real speech:
   * adaptive threshold can hit the -5 dB cap while speech peaks around -9 dB (session logs 2026-04-18).
   */
  const VAD_GATE_BYPASS_REASON_NO_SAMPLE_EXCEEDED = 'no_sample_exceeded_vad_threshold_in_decode' as const;
  const VAD_BYPASS_WHISPER_MIN_PEAK_ABOVE_AMBIENT_DB = 6;

  const SILENT_BUFFER_RETAKE_PROMPT =
    "I didn't catch any speech on that try. Tap the mic when you're ready and say that again.";
  const WHISPER_RATIO_REASK_PROMPT =
    'I only caught part of that — could you answer again in a full sentence?';
  const WHISPER_INFRA_REASK_PROMPT =
    "I'm having a little trouble on my end — could you say that one more time?";

  const releaseRecordingFnRef = useRef<
    | ((opts?: {
        momentNumber?: number;
        logCleanupFailed?: (payload: { message: string; moment_number?: number }) => void;
      }) => Promise<void>)
    | null
  >(null);

  const audioRecorder = useAudioRecorder({
    onRecordingEnginePrimed: (info) => {
      recordingDelayMeasurementRef.current = info;
      setRecordingSessionActive(true);
    },
    onBeforeWebRecorderStop:
      Platform.OS === 'web'
        ? () => {
            unlockWebAudioForAutoplay();
            primeHtmlAudioForMobileTtsFromMicGesture();
          }
        : undefined,
    onMediaServicesReset: () => {
      setMicNeedsReconnect(true);
      if (Platform.OS === 'web') return;
      if (interviewStatusRef.current !== 'in_progress') return;
      void applyRouteProbeAfterResume('media_services_reset');
    },
    onRecordingComplete: async (blob, nativeUri, meta) => {
      try {
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'AriaScreen.tsx:onRecordingComplete:entry',
          message: 'recording_complete_entry',
          data: {
            hypothesisId: 'H2',
            blobSize: blob?.size ?? 0,
            hasNativeUri: !!nativeUri,
            nativePeakMeteringDb: meta?.peakMeteringDb ?? null,
          },
          timestamp: Date.now(),
          runId: 'speech-detect-debug',
        }),
      }).catch(() => {});
      // #endregion
      recordingPeakMeteringRef.current = meta?.peakMeteringDb ?? null;
      recordingJustFinishedBeforeNextTtsRef.current = true;
      setVoiceState('processing');
      const analysis = await analyzeRecordingBuffer(blob, meta?.peakMeteringDb ?? null);
      const webTiming = meta?.webRecordingTiming;
      const timeToFirstAudioMs =
        webTiming != null &&
        analysis.firstSpeechOffsetMs != null &&
        analysis.firstSpeechOffsetMs >= 0
          ? Math.round(
              analysis.firstSpeechOffsetMs +
                (webTiming.mediaRecorderStartAtMs - webTiming.tapIntentAtMs)
            )
          : null;
      const vadGateOpenedWallMs =
        webTiming?.mediaRecorderStartAtMs != null && analysis.firstSpeechOffsetMs != null
          ? webTiming.mediaRecorderStartAtMs + analysis.firstSpeechOffsetMs
          : null;
      const vadGateDelayMs =
        vadGateOpenedWallMs != null && webTiming?.recorderStartCalledMs != null
          ? Math.round(vadGateOpenedWallMs - webTiming.recorderStartCalledMs)
          : null;
      const timeSinceRecordingStartMs =
        webTiming?.recorderStartCalledMs != null && webTiming?.recorderStopCalledMs != null
          ? Math.round(webTiming.recorderStopCalledMs - webTiming.recorderStartCalledMs)
          : null;
      const vadGateBypassed =
        Platform.OS === 'web' &&
        analysis.has_non_zero_audio &&
        analysis.firstSpeechOffsetMs == null &&
        analysis.audio_duration_ms > 0;
      const vadGateBypassReason = vadGateBypassed ? VAD_GATE_BYPASS_REASON_NO_SAMPLE_EXCEEDED : null;
      const peakAboveAmbientDb =
        analysis.ambient_noise_floor_db != null &&
        Number.isFinite(analysis.ambient_noise_floor_db) &&
        Number.isFinite(analysis.peak_amplitude_db)
          ? analysis.peak_amplitude_db - analysis.ambient_noise_floor_db
          : null;
      const vadBypassSpeechLikelyByPeakVsAmbient =
        peakAboveAmbientDb != null && peakAboveAmbientDb >= VAD_BYPASS_WHISPER_MIN_PEAK_ABOVE_AMBIENT_DB;
      /** Bleed/low-SNR: bypass with no frame above threshold AND peak not clearly above ambient. */
      const blockWhisperForVadBypassNoSpeech =
        vadGateBypassReason === VAD_GATE_BYPASS_REASON_NO_SAMPLE_EXCEEDED &&
        !vadBypassSpeechLikelyByPeakVsAmbient;
      // #region agent log
      {
        const vadDb = analysis.vad_threshold_db;
        const peakDb = analysis.peak_amplitude_db;
        const gapDb =
          vadDb != null && typeof peakDb === 'number' ? Math.round((peakDb - vadDb) * 1000) / 1000 : null;
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            location: 'AriaScreen.tsx:onRecordingComplete:post_analysis',
            message: 'recording_buffer_analysis',
            data: {
              hypothesisId: 'H1',
              H5_noise_between_floors:
                analysis.has_non_zero_audio &&
                analysis.firstSpeechOffsetMs == null &&
                (analysis.audio_duration_ms ?? 0) > 0,
              has_non_zero_audio: analysis.has_non_zero_audio,
              firstSpeechOffsetMs: analysis.firstSpeechOffsetMs,
              peak_amplitude_db: analysis.peak_amplitude_db,
              vad_threshold_db: analysis.vad_threshold_db,
              peak_minus_vad_db: gapDb,
              audio_duration_ms: analysis.audio_duration_ms,
              vad_first_frame_accepted_db: analysis.vad_first_frame_accepted_db,
              vadGateBypassed,
              peakAboveAmbientDb,
              vadBypassSpeechLikelyByPeakVsAmbient,
              blockWhisperForVadBypassNoSpeech,
              will_take_silent_branch: !analysis.has_non_zero_audio || blockWhisperForVadBypassNoSpeech,
            },
            timestamp: Date.now(),
            runId: 'speech-detect-debug',
          }),
        }).catch(() => {});
      }
      // #endregion
      if (meta?.recordingCapped && userId) {
        const r = getSessionLogRuntime();
        markLastAudioSessionEventType('recording_duration_cap_hit');
        writeAudioSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'recording_duration_cap_hit',
          eventData: {
            actual_duration_ms: analysis.audio_duration_ms,
            moment_number: currentInterviewMomentRef.current,
            silence_detection_threshold_ms: getAudioSilenceDetectionThresholdMsForLogs(),
          },
          platform: r.platform,
        });
      }
      if (userId) {
        const r = getSessionLogRuntime();
        markLastAudioSessionEventType('recording_buffer_content_check');
        writeAudioSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'recording_buffer_content_check',
          eventData: {
            audio_duration_ms: analysis.audio_duration_ms,
            buffer_size_bytes: analysis.buffer_size_bytes,
            has_non_zero_audio: analysis.has_non_zero_audio,
            peak_amplitude_db: analysis.peak_amplitude_db,
            time_to_first_audio_ms: timeToFirstAudioMs,
            recorder_start_called_ms: webTiming?.recorderStartCalledMs ?? null,
            first_chunk_received_ms: webTiming?.firstChunkReceivedMs ?? null,
            chunk_latency_ms: webTiming?.chunkLatencyMs ?? null,
            recorder_pre_initialized: webTiming?.recorderPreInitialized ?? null,
            pre_init_fallback_reason: webTiming?.preInitFallbackReason ?? null,
            stream_reactivated: webTiming?.streamReactivated ?? null,
            pre_init_triggered_during: webTiming?.preInitTriggeredDuring ?? null,
            vad_threshold_db: analysis.vad_threshold_db,
            ambient_noise_floor_db: analysis.ambient_noise_floor_db,
            vad_first_frame_accepted_db: analysis.vad_first_frame_accepted_db,
            ...(vadGateDelayMs != null ? { vad_gate_delay_ms: vadGateDelayMs } : {}),
            ...(timeSinceRecordingStartMs != null
              ? { time_since_recording_start_ms: timeSinceRecordingStartMs }
              : {}),
            ...(vadGateBypassed && vadGateBypassReason != null
              ? {
                  vad_gate_bypassed: true,
                  vad_gate_bypass_reason: vadGateBypassReason,
                  ...(peakAboveAmbientDb != null
                    ? { vad_peak_above_ambient_db: Math.round(peakAboveAmbientDb * 1000) / 1000 }
                    : {}),
                  ...(vadBypassSpeechLikelyByPeakVsAmbient
                    ? { vad_bypass_whisper_allowed_peak_vs_ambient: true }
                    : {}),
                  ...(blockWhisperForVadBypassNoSpeech
                    ? { whisper_submission_blocked_vad_bypass: true }
                    : {}),
                }
              : {}),
            ...(vadGateOpenedWallMs != null ? { vad_gate_opened_ms: Math.round(vadGateOpenedWallMs) } : {}),
            moment_number: currentInterviewMomentRef.current,
            scenario_number: currentScenarioRef.current,
          },
          platform: r.platform,
        });
      }
      const peakDbForMicFallback = analysis.peak_amplitude_db;
      const isDigitalSilenceForMicFallback =
        Platform.OS === 'web' &&
        useMediaRecorderPath &&
        !analysis.has_non_zero_audio &&
        typeof peakDbForMicFallback === 'number' &&
        Number.isFinite(peakDbForMicFallback) &&
        peakDbForMicFallback <= -200;

      if (isDigitalSilenceForMicFallback) {
        consecutiveDigitalSilenceForMicFallbackRef.current += 1;
      } else {
        consecutiveDigitalSilenceForMicFallbackRef.current = 0;
      }

      if (
        userId &&
        Platform.OS === 'web' &&
        useMediaRecorderPath &&
        micFallbackSuccessPendingRef.current &&
        analysis.has_non_zero_audio
      ) {
        micFallbackSuccessPendingRef.current = false;
        const rOk = getSessionLogRuntime();
        writeAudioSessionLog({
          userId,
          attemptId: rOk.attemptId,
          eventType: 'microphone_device_fallback_succeeded',
          eventData: { microphone_device_fallback_succeeded: true },
          platform: rOk.platform,
        });
      }

      if (!analysis.has_non_zero_audio || blockWhisperForVadBypassNoSpeech) {
        if (
          Platform.OS === 'web' &&
          useMediaRecorderPath &&
          isDigitalSilenceForMicFallback &&
          consecutiveDigitalSilenceForMicFallbackRef.current >= 2
        ) {
          const n = consecutiveDigitalSilenceForMicFallbackRef.current;
          const previousDeviceId = audioRecorder.getLastWebMicCaptureDeviceId() ?? null;
          const switched = await audioRecorder.switchWebInputToDefaultDevice();
          consecutiveDigitalSilenceForMicFallbackRef.current = 0;
          if (userId && switched) {
            const rFb = getSessionLogRuntime();
            writeAudioSessionLog({
              userId,
              attemptId: rFb.attemptId,
              eventType: 'microphone_device_fallback_attempted',
              eventData: {
                previous_device_id: previousDeviceId,
                fallback_device_id: 'default',
                consecutive_silent_buffers: n,
              },
              platform: rFb.platform,
            });
            micFallbackSuccessPendingRef.current = true;
          }
        }
        if (blockWhisperForVadBypassNoSpeech) {
          pendingRecordingRestartAfterVadBypassRef.current = true;
        }
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            location: 'AriaScreen.tsx:onRecordingComplete:no_speech_retake',
            message: 'no_speech_path',
            data: {
              hypothesisId: 'VadBlock-1',
              has_non_zero_audio: analysis.has_non_zero_audio,
              blockWhisperForVadBypassNoSpeech,
              peak_db: analysis.peak_amplitude_db,
              vad_threshold_db: analysis.vad_threshold_db,
              vadGateBypassed,
              will_skip_whisper: blockWhisperForVadBypassNoSpeech,
            },
            timestamp: Date.now(),
            runId: 'speech-detect-debug',
          }),
        }).catch(() => {});
        // #endregion
        if (userId) {
          const r = getSessionLogRuntime();
          markLastAudioSessionEventType('silent_buffer_detected');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'silent_buffer_detected',
            eventData: {
              moment_number: currentInterviewMomentRef.current,
              buffer_size_bytes: analysis.buffer_size_bytes,
              ...(blockWhisperForVadBypassNoSpeech
                ? { treated_as_silent_due_to_vad_bypass: true }
                : {}),
            },
            platform: r.platform,
          });
          const n = incrementReAskCountThisSession();
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 're_ask_fired',
            eventData: {
              trigger_reason: 'silent_buffer',
              confidence_score: null,
              moment_number: currentInterviewMomentRef.current,
              re_ask_count_this_session: n,
            },
            platform: r.platform,
          });
        }
        await deleteTurnAudioFile(nativeUri);
        setMessages((prev) => [...prev, { role: 'assistant', content: SILENT_BUFFER_RETAKE_PROMPT }]);
        setVoiceState('speaking');
        await speakTextSafe(SILENT_BUFFER_RETAKE_PROMPT, {
          telemetrySource: 'turn',
          skipLastQuestionRef: true,
        }).catch(() => {});
        setVoiceState('idle');
        return;
      }
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'AriaScreen.tsx:onRecordingComplete:proceed_transcribe',
          message: 'recording_complete_proceeding_whisper',
          data: {
            hypothesisId: 'HOK',
            has_non_zero_audio: analysis.has_non_zero_audio,
            firstSpeechOffsetMs: analysis.firstSpeechOffsetMs,
          },
          timestamp: Date.now(),
          runId: 'speech-detect-debug',
        }),
      }).catch(() => {});
      // #endregion
      transcribeBufferMetaRef.current = {
        audio_duration_ms: analysis.audio_duration_ms,
        buffer_size_bytes: analysis.buffer_size_bytes,
      };
      const transcribed = await transcribeSafe(blob, nativeUri);
      transcribeBufferMetaRef.current = null;
      if (!transcribed) {
        return;
      }
      if ('kind' in transcribed && transcribed.kind === 'whisper_infra_exhausted') {
        await deleteTurnAudioFile(nativeUri);
        setMessages((prev) => [...prev, { role: 'assistant', content: WHISPER_INFRA_REASK_PROMPT }]);
        setVoiceState('speaking');
        await speakTextSafe(WHISPER_INFRA_REASK_PROMPT, {
          telemetrySource: 'turn',
          skipLastQuestionRef: true,
        }).catch(() => {});
        setVoiceState('idle');
        return;
      }
      const { text: userText, language, confidence } = transcribed as {
        text: string;
        language: string | null;
        confidence: number | null;
      };
      lastVoiceTurnLanguageRef.current = language;
      lastVoiceTurnConfidenceRef.current = confidence;
      const wc = countSpokenWords(userText);
      const durMs = analysis.audio_duration_ms;
      const wps = durMs > 0 ? wc / (durMs / 1000) : 0;
      const lastQuestionText = lastQuestionTextRef.current;
      const turnContext = getWhisperReaskTurnContext(lastQuestionText);
      const shortAnswerOk = isShortAnswerOkForWhisperRatioGate(lastQuestionText);
      const ratioFlag = wps < 0.3 || (!shortAnswerOk && wc < 3);
      const willRatioReask = shouldFireWhisperRatioReask({
        turnContext,
        transcriptText: userText,
        wordCount: wc,
        wordsPerSecond: wps,
        shortAnswerOk,
      });
      setLastWhisperRatioTelemetry(ratioFlag, durMs, wc);
      {
        const lastQ = lastQuestionText ?? '';
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            location: 'AriaScreen.tsx:onRecordingComplete:whisper_ratio_gate',
            message: 'whisper_ratio_gate',
            data: {
              hypothesisId: 'H1-H5',
              moment: currentInterviewMomentRef.current,
              scenario: currentScenarioRef.current,
              lastQEmpty: lastQ.trim().length === 0,
              lastQPreview: lastQ.slice(0, 160),
              shortAnswerOk,
              turnContext,
              userTextPreview: userText.slice(0, 120),
              wc,
              durMs,
              wpsRounded: Math.round(wps * 1000) / 1000,
              ratioFlag,
              willRatioReask,
            },
            timestamp: Date.now(),
            runId: 'post-fix',
          }),
        }).catch(() => {});
        // #endregion
      }
      if (userId) {
        const r = getSessionLogRuntime();
        markLastAudioSessionEventType('whisper_audio_ratio');
        writeAudioSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'whisper_audio_ratio',
          eventData: {
            audio_duration_ms: durMs,
            word_count: wc,
            words_per_second: Math.round(wps * 1000) / 1000,
            ratio_flag: ratioFlag,
            moment_number: currentInterviewMomentRef.current,
          },
          platform: r.platform,
        });
      }
      if (willRatioReask) {
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            location: 'AriaScreen.tsx:onRecordingComplete:whisper_ratio_reask_fired',
            message: 'WHISPER_RATIO_REASK_PROMPT path',
            data: {
              hypothesisId: 'H1',
              moment: currentInterviewMomentRef.current,
              lastQPreview: (lastQuestionTextRef.current ?? '').slice(0, 160),
              userTextPreview: userText.slice(0, 120),
              wc,
              wps: Math.round(wps * 1000) / 1000,
            },
            timestamp: Date.now(),
            runId: 'post-fix',
          }),
        }).catch(() => {});
        // #endregion
        if (userId) {
          const r = getSessionLogRuntime();
          const n = incrementReAskCountThisSession();
          markLastAudioSessionEventType('re_ask_fired');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 're_ask_fired',
            eventData: {
              trigger_reason: 'low_confidence',
              confidence_score: confidence,
              moment_number: currentInterviewMomentRef.current,
              re_ask_count_this_session: n,
            },
            platform: r.platform,
          });
        }
        await deleteTurnAudioFile(nativeUri);
        setMessages((prev) => [...prev, { role: 'user', content: userText }, { role: 'assistant', content: WHISPER_RATIO_REASK_PROMPT }]);
        setVoiceState('speaking');
        await speakTextSafe(WHISPER_RATIO_REASK_PROMPT, {
          telemetrySource: 'turn',
          skipLastQuestionRef: true,
        }).catch(() => {});
        setVoiceState('idle');
        return;
      }
      if (shouldRejectVoiceForNonEnglish(userText, language)) {
        void deleteTurnAudioFile(nativeUri);
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: userText },
          { role: 'assistant', content: NON_ENGLISH_VOICE_PROMPT },
        ]);
        setVoiceState('speaking');
        await speakTextSafe(NON_ENGLISH_VOICE_PROMPT).catch(() => {});
        setVoiceState('idle');
        return;
      }
      const turnIndex = turnAudioIndexRef.current;
      turnAudioIndexRef.current += 1;
      const scenarioNumber = currentScenarioRef.current ?? null;
      void processTurnAudioWithRetry({
        audioBlob: blob,
        nativeUri,
        turnIndex,
        scenarioNumber,
      });
      processUserSpeech(userText);
      } finally {
        await releaseRecordingFnRef.current?.({
          momentNumber: currentInterviewMomentRef.current,
          logCleanupFailed: (p) => {
            if (!userId) return;
            const r = getSessionLogRuntime();
            writeAudioSessionLog({
              userId,
              attemptId: r.attemptId,
              eventType: 'recording_cleanup_failed',
              eventData: { ...p, moment_number: p.moment_number ?? currentInterviewMomentRef.current },
              platform: r.platform,
            });
          },
        });
      }
    },
    onError: (err) => handleRecordingError(err),
  });

  audioRecorderIsRecordingForRouteRef.current = audioRecorder.isRecording;

  useEffect(() => {
    if (voiceState !== 'idle') {
      setLateStartIdleCueVisible(false);
      return;
    }
    const tick = (): void => {
      const t = getLastTtsCompletionCallbackMs();
      if (t == null) {
        setLateStartIdleCueVisible(false);
        return;
      }
      setLateStartIdleCueVisible(Date.now() - t >= getLateStartThresholdMs());
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [voiceState]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (interviewStatus !== 'in_progress') return;
    return subscribeWebAudioDeviceChange(() => {
      void (async () => {
        const uid = userIdRef.current;
        if (!uid) return;
        const wr = await refreshWebAudioRoutesForSession();
        if (!wr.changed || !wr.previous) return;
        debugNoteWebAudioRouteChange('devicechange', {
          previousInputRoute: wr.previous.input_route,
          previousOutputRoute: wr.previous.output_route,
          newInputRoute: wr.inference.input_route,
          newOutputRoute: wr.inference.output_route,
        });
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId: uid,
          attemptId: r.attemptId,
          eventType: 'audio_route_changed',
          eventData: {
            previous_input_route: wr.previous.input_route,
            previous_output_route: wr.previous.output_route,
            new_input_route: wr.inference.input_route,
            new_output_route: wr.inference.output_route,
            headphones_connected: wr.inference.headphones_connected,
            devices_audit: wr.inference.devices_audit,
            moment_number: currentInterviewMomentRef.current,
            timestamp: new Date().toISOString(),
            source: 'devicechange',
          },
          platform: r.platform,
        });
        if (audioRecorderIsRecordingForRouteRef.current) {
          routeChangedDuringRecordingRef.current = true;
          writeAudioSessionLog({
            userId: uid,
            attemptId: r.attemptId,
            eventType: 'audio_route_changed_during_recording_warning',
            eventData: {
              moment_number: currentInterviewMomentRef.current,
              source: 'devicechange',
            },
            platform: r.platform,
          });
        }
      })();
    });
  }, [interviewStatus]);

  releaseRecordingFnRef.current = audioRecorder.releaseRecordingInstance;

  const audioRecorderRefForLeave = useRef(audioRecorder);
  audioRecorderRefForLeave.current = audioRecorder;

  useEffect(() => {
    setRecordingPlaybackTransitionTelemetryHook((info) => {
      const uid = userIdRef.current;
      if (!uid) return;
      const r = getSessionLogRuntime();
      const ttsDone = getLastTtsCompletionCallbackMs();
      markLastAudioSessionEventType('audio_session_deactivation_confirmed');
      writeAudioSessionLog({
        userId: uid,
        attemptId: r.attemptId,
        eventType: 'audio_session_deactivation_confirmed',
        eventData: {
          deactivation_succeeded: info.succeeded,
          deactivation_timestamp: Date.now(),
          time_since_tts_completion_ms: ttsDone != null ? Date.now() - ttsDone : null,
          recording_session_active: r.recordingSessionActive,
        },
        platform: r.platform,
      });
    });
    return () => setRecordingPlaybackTransitionTelemetryHook(undefined);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      if (interviewStatusRef.current !== 'in_progress') return;
      void (async () => {
        setMicSessionRecovering(true);
        try {
          const ok = await audioRecorder.reinitializeMicrophoneSession();
          if (!cancelled) {
            if (!ok) setMicNeedsReconnect(true);
            else setMicNeedsReconnect(false);
          }
          if (!cancelled && userIdRef.current) {
            await applyRouteProbeAfterResume('app_resume');
          }
        } finally {
          if (!cancelled) setMicSessionRecovering(false);
        }
      })();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [audioRecorder.reinitializeMicrophoneSession, applyRouteProbeAfterResume]);

  /** Stop interviewer TTS and mic capture when navigating away or the screen unmounts (tab switches do not stop audio). */
  useEffect(() => {
    const stopInterviewAudio = () => {
      void stopElevenLabsPlayback();
      stopElevenLabsSpeech();
      try {
        if (audioRecorderRefForLeave.current.isRecording) {
          audioRecorderRefForLeave.current.stopRecording();
        }
      } catch {
        /* ignore */
      }
      if (Platform.OS === 'web' && recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };

    const unsubBlur = navigation.addListener('blur', stopInterviewAudio);
    const unsubBeforeRemove = navigation.addListener('beforeRemove', stopInterviewAudio);

    return () => {
      unsubBlur();
      unsubBeforeRemove();
      stopInterviewAudio();
    };
  }, [navigation]);

  const navSessionBlurRef = useRef(false);
  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      if (!userId || !navSessionBlurRef.current) return;
      navSessionBlurRef.current = false;
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'navigation_return',
        eventData: { moment_number: currentInterviewMomentRef.current },
        platform: r.platform,
      });
    });
    const unsubBlurNav = navigation.addListener('blur', () => {
      if (!userId || interviewStatusRef.current !== 'in_progress') return;
      navSessionBlurRef.current = true;
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'navigation_away',
        eventData: { moment_number: currentInterviewMomentRef.current },
        platform: r.platform,
      });
      const started = getInterviewWallClockStartMs();
      markLastAudioSessionEventType('session_abandonment');
      writeAudioSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'session_abandonment',
        eventData: {
          last_moment_number: currentInterviewMomentRef.current,
          last_scenario_number: currentScenarioRef.current,
          last_question_type: classifyInterviewQuestionType(lastQuestionTextRef.current),
          time_in_session_ms: started != null ? Date.now() - started : null,
          last_audio_event: getLastAudioSessionEventType(),
        },
        platform: r.platform,
      });
    });
    return () => {
      unsubFocus();
      unsubBlurNav();
    };
  }, [navigation, userId]);

  /** One listener per session: web uses `visibilitychange` only; native uses `AppState` only (both fire on some web builds and duplicate logs). */
  useEffect(() => {
    if (!userId) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const fn = () => {
        const vis = document.visibilityState === 'visible';
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'tab_visibility_change',
          eventData: { visible: vis, moment_number: currentInterviewMomentRef.current },
          platform: r.platform,
        });
      };
      document.addEventListener('visibilitychange', fn);
      return () => document.removeEventListener('visibilitychange', fn);
    }
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'tab_visibility_change',
          eventData: { visible: true, moment_number: currentInterviewMomentRef.current },
          platform: r.platform,
        });
      } else {
        setLastHiddenAtMs(Date.now());
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'tab_visibility_change',
          eventData: { visible: false, moment_number: currentInterviewMomentRef.current },
          platform: r.platform,
        });
      }
    });
    return () => sub.remove();
  }, [userId]);

  /**
   * Web: stop interviewer TTS and wait until session + Web Audio surfaces are idle before opening the mic.
   * Avoids capture/OS errors when output and input contend and avoids mis-attributing those as "interruption" retries.
   */
  const waitUntilInterviewerQuiescentForWebMic = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'web') return;
    await stopElevenLabsPlayback();
    const maxMs = 2000;
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const rt = getSessionLogRuntime();
      const voiceOk = voiceStateRef.current === 'idle';
      const ttsIdle = !ttsLineInFlightRef.current && !rt.ttsPlaybackActive;
      const surfacesClear = !isWebInterviewPlaybackSurfaceActive();
      if (voiceOk && ttsIdle && surfacesClear) return;
      await new Promise<void>((r) => setTimeout(r, 35));
    }
  }, [stopElevenLabsPlayback]);

  const startRecordingAfterPendingTts = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    if (voiceStateRef.current !== 'idle') return;
    if (audioRecorder.isRecording) return;
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
      body: JSON.stringify({
        sessionId: 'e70f17',
        location: 'AriaScreen.tsx:startRecordingAfterPendingTts',
        message: 'auto_start_recording_after_pending_tts',
        data: { hypothesisId: 'H10' },
        timestamp: Date.now(),
        runId: 'post-fix',
      }),
    }).catch(() => {});
    // #endregion
    try {
      if (userId && getSessionLogRuntime().ttsPlaybackActive) {
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'tts_interrupted',
          eventData: { source: 'start_recording_after_pending_tts' },
          platform: r.platform,
        });
      }
      await waitUntilInterviewerQuiescentForWebMic();
      const granted = await audioRecorder.requestPermission();
      if (!granted) return;
      const tapIntentAtMs = Date.now();
      const intendedDelayMs =
        Platform.OS === 'web' ? 0 : 500 + peekRecordingDelayExtraFromEarlyCutoffMs();
      const extraDelayMs = takeRecordingDelayExtraFromEarlyCutoffMs();
      setVoiceState('recording');
      recordingDelayMeasurementRef.current = null;
      await audioRecorder.startRecording({
        postAudioSessionDelayMs: Platform.OS === 'web' ? 0 : 500 + extraDelayMs,
        tapIntentAtMs,
      });
      const actualDelayMs = recordingDelayMsFromRef(recordingDelayMeasurementRef, tapIntentAtMs);
      if (userId) {
        const r = getSessionLogRuntime();
        const corr = getAudioCorrelationFields();
        const probeSnapshot: HeadphoneProbeResult =
          lastHeadphoneProbeRef.current ?? {
            input: null,
            fingerprint: lastAudioRouteFingerprintRef.current,
            kind: getAudioRouteKind(),
            shouldShowHeadphonePrompt: false,
          };
        const btHint =
          probeSnapshot.input?.name && /bluetooth|airpod|wireless|buds/i.test(probeSnapshot.input.name)
            ? probeSnapshot.input.name.slice(0, 120)
            : null;
        markLastAudioSessionEventType('recording_delay_observed');
        writeAudioSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'recording_delay_observed',
          eventData: {
            intended_delay_ms: intendedDelayMs,
            actual_delay_ms: actualDelayMs,
            moment_number: currentInterviewMomentRef.current,
            scenario_number: currentScenarioRef.current,
          },
          platform: r.platform,
        });
        markLastAudioSessionEventType('audio_route_at_recording_start');
        writeAudioSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'audio_route_at_recording_start',
          eventData: {
            input_route: corr.input_route,
            output_route: corr.output_route,
            audio_output_route: corr.audio_output_route,
            headphones_connected: corr.headphones_connected,
            audio_devices_enumerated_json: corr.audio_devices_enumerated_json,
            bluetooth_device_name: btHint,
            moment_number: currentInterviewMomentRef.current,
          },
          platform: r.platform,
        });
        markLastAudioSessionEventType('recording_quality_actual');
        writeAudioSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'recording_quality_actual',
          eventData: {
            sample_rate_requested: 48000,
            sample_rate_actual: 48000,
            bit_depth_actual: 16,
            channels_actual: 1,
            moment_number: currentInterviewMomentRef.current,
            sample_rate_below_requested: false,
          },
          platform: r.platform,
        });
        const ttsDone = getLastTtsCompletionCallbackMs();
        const sinceTts = ttsDone != null ? tapIntentAtMs - ttsDone : null;
        const lateTh = getLateStartThresholdMs();
        markLastAudioSessionEventType('user_speech_latency');
        writeAudioSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'user_speech_latency',
          eventData: {
            time_since_tts_completion_ms: sinceTts,
            moment_number: currentInterviewMomentRef.current,
            early_start: sinceTts != null && sinceTts < 800,
            late_start: sinceTts != null && sinceTts > lateTh,
            late_start_threshold_ms: lateTh,
          },
          platform: r.platform,
        });
        if (userId && sinceTts != null && sinceTts > lateTh) {
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'late_start_extended',
            eventData: {
              time_since_tts_completion_ms: sinceTts,
              late_start_threshold_ms: lateTh,
              moment_number: currentInterviewMomentRef.current,
            },
            platform: r.platform,
          });
          void refreshWebMicPreInitIfStaleAfterLateStartWindow();
        }
        markLastAudioSessionEventType('recording_start');
        writeSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'recording_start',
          eventData: takeRecordingStartEventDataWithVadBypassRestart(),
          platform: r.platform,
        });
      }
    } catch (err) {
      handleRecordingError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [audioRecorder, handleRecordingError, userId, waitUntilInterviewerQuiescentForWebMic]);

  const handleSendTyped = useCallback(() => {
    const text = typedAnswer.trim();
    if (!text) return;
    touchActivity();
    setTypedAnswer('');
    setMicWarning(null);
    lastVoiceTurnLanguageRef.current = null;
    lastVoiceTurnConfidenceRef.current = null;
    if (userId && ttsLineInFlightRef.current) {
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'tts_interrupted',
        eventData: { source: 'typed_send' },
        platform: r.platform,
      });
    }
    stopElevenLabsSpeech(); // interrupt if interviewer is still speaking
    processUserSpeech(text);
  }, [typedAnswer, processUserSpeech, userId]);

  const handlePressEnd = useCallback(async () => {
    if (voiceState !== 'listening') return;
    if (useMediaRecorderPath) return; // SpeechRecognition path stops via tap (handlePressEnd)
    if (Platform.OS === 'web' && recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setVoiceState('processing');
    setTimeout(() => {
      const text = transcriptAtReleaseRef.current?.trim() ?? currentTranscript.trim();
      processUserSpeech(text);
    }, 400);
  }, [voiceState, currentTranscript, processUserSpeech, useMediaRecorderPath, handleRecordingError, transcribeSafe]);

  const handleNativeOrWhisperMicPress = useCallback(async () => {
    touchActivity();
    setSessionAudioHealthNotice(null);
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c61a43'},body:JSON.stringify({sessionId:'c61a43',runId:'pre-fix',hypothesisId:'H4',location:'AriaScreen.tsx:handleNativeOrWhisperMicPress:entry',message:'mic_press_received',data:{voiceState,ttsPlaybackActive:getSessionLogRuntime().ttsPlaybackActive,isRecording:audioRecorder.isRecording},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (Platform.OS === 'web') {
      unlockWebAudioForAutoplay();
      primeHtmlAudioForMobileTtsFromMicGesture();
      preAuthorizeAudioElementOnMicTapGesture();
    }
    if (!useTapMicUi) return;
    /** Tap-to-record: stop capture before any web TTS gesture flush or voice-state gate; otherwise the tap can be consumed and MediaRecorder never stops. */
    if (useMediaRecorderPath && audioRecorder.isRecording) {
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'AriaScreen.tsx:handleNativeOrWhisperMicPress',
          message: 'mic_stop_priority',
          data: {
            hypothesisId: 'H1',
            voiceState,
            hasPendingBlob: hasPendingWebGestureBlobUrl(),
          },
          timestamp: Date.now(),
          runId: 'post-fix',
        }),
      }).catch(() => {});
      // #endregion
      if (__DEV__) console.log('[Aria] MIC PRESSED, isRecording: true → stop priority');
      try {
        await audioRecorder.stopRecording();
        if (__DEV__) console.log('[Aria] RECORDING STOPPED (priority)');
      } catch (err) {
        if (__DEV__) console.error('[Aria] MIC ERROR:', err instanceof Error ? err.message : err);
        handleRecordingError(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }
    if (voiceState === 'speaking' || voiceState === 'processing') return;
    if (Platform.OS === 'web' && voiceState === 'idle' && !audioRecorder.isRecording) {
      pendingMicStartAfterIdleFlushRef.current = true;
    } else {
      pendingMicStartAfterIdleFlushRef.current = false;
    }
    if (Platform.OS === 'web') {
      const tryPlayed = await tryPlayPendingWebTtsAudioInUserGesture(
        () => {
          const shouldStartMic = pendingMicStartAfterIdleFlushRef.current;
          pendingMicStartAfterIdleFlushRef.current = false;
          if (shouldStartMic) void startRecordingAfterPendingTts();
        },
        () => clearPendingWebSpeechGesturePair(pendingWebSpeechForGestureRef),
        { source: 'turn' }
      );
      if (tryPlayed) return;
    }
    if (Platform.OS === 'web' && webGestureTtsConsumedPressRef.current) {
      pendingMicStartAfterIdleFlushRef.current = false;
      webGestureTtsConsumedPressRef.current = false;
      if (webGestureConsumeClearTimeoutRef.current) {
        clearTimeout(webGestureConsumeClearTimeoutRef.current);
        webGestureConsumeClearTimeoutRef.current = null;
      }
      return;
    }
    if (Platform.OS === 'web') {
      const fromRef = pendingWebSpeechForGestureRef.current;
      const fromMod = pendingWebSpeechForGestureModule;
      const fromStore = readStoredPendingGestureTts();
      const t = fromRef ?? fromMod ?? fromStore;
      if (t) {
        const shouldStartMic = pendingMicStartAfterIdleFlushRef.current;
        pendingMicStartAfterIdleFlushRef.current = false;
        clearPendingWebSpeechGesturePair(pendingWebSpeechForGestureRef);
        webGestureTtsConsumedPressRef.current = true;
        if (webGestureConsumeClearTimeoutRef.current) {
          clearTimeout(webGestureConsumeClearTimeoutRef.current);
          webGestureConsumeClearTimeoutRef.current = null;
        }
        webGestureConsumeClearTimeoutRef.current = setTimeout(() => {
          webGestureConsumeClearTimeoutRef.current = null;
          webGestureTtsConsumedPressRef.current = false;
        }, 1800);
        trySpeakWebSpeechInUserGesture(t, () => {
          if (shouldStartMic) void startRecordingAfterPendingTts();
        });
        return;
      }
    }
    if (Platform.OS === 'web') {
      pendingMicStartAfterIdleFlushRef.current = false;
    }
    if (Platform.OS === 'web' && !useMediaRecorderPath) {
      if (voiceState === 'listening') {
        await handlePressEnd();
        return;
      }
      if (voiceState === 'idle') {
        await handlePressStart();
        return;
      }
      return;
    }
    if (Platform.OS === 'web') {
    }
    if (__DEV__) console.log('[Aria] MIC PRESSED, isRecording:', audioRecorder.isRecording);
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stopRecording();
        if (__DEV__) console.log('[Aria] RECORDING STOPPED');
      } else {
        const tapIntentAtMs = Date.now();
        /** Web: fully quiesce interviewer output before getUserMedia + MediaRecorder (avoids overlap with capture). */
        if (Platform.OS === 'web') {
          if (userId && getSessionLogRuntime().ttsPlaybackActive) {
            const r = getSessionLogRuntime();
            writeSessionLog({
              userId,
              attemptId: r.attemptId,
              eventType: 'tts_interrupted',
              eventData: { source: 'mic_press_before_recording' },
              platform: r.platform,
            });
          }
          await waitUntilInterviewerQuiescentForWebMic();
        }
        const granted = await audioRecorder.requestPermission();
        if (__DEV__) console.log('[Aria] MIC PERMISSION:', granted ? 'granted' : 'denied');
        if (!granted) return;
        const intendedDelayMs =
          Platform.OS === 'web' ? 0 : 500 + peekRecordingDelayExtraFromEarlyCutoffMs();
        const extraDelayMs = takeRecordingDelayExtraFromEarlyCutoffMs();
        setVoiceState('recording');
        recordingDelayMeasurementRef.current = null;
        await audioRecorder.startRecording({
          postAudioSessionDelayMs: Platform.OS === 'web' ? 0 : 500 + extraDelayMs,
          tapIntentAtMs,
        });
        const actualDelayMs = recordingDelayMsFromRef(recordingDelayMeasurementRef, tapIntentAtMs);
        if (userId) {
          const r = getSessionLogRuntime();
          const corr = getAudioCorrelationFields();
          const probeSnapshot: HeadphoneProbeResult =
            lastHeadphoneProbeRef.current ?? {
              input: null,
              fingerprint: lastAudioRouteFingerprintRef.current,
              kind: getAudioRouteKind(),
              shouldShowHeadphonePrompt: false,
            };
          const btHint =
            probeSnapshot.input?.name && /bluetooth|airpod|wireless|buds/i.test(probeSnapshot.input.name)
              ? probeSnapshot.input.name.slice(0, 120)
              : null;
          markLastAudioSessionEventType('recording_delay_observed');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'recording_delay_observed',
            eventData: {
              intended_delay_ms: intendedDelayMs,
              actual_delay_ms: actualDelayMs,
              moment_number: currentInterviewMomentRef.current,
              scenario_number: currentScenarioRef.current,
            },
            platform: r.platform,
          });
          markLastAudioSessionEventType('audio_route_at_recording_start');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'audio_route_at_recording_start',
            eventData: {
              input_route: corr.input_route,
              output_route: corr.output_route,
              audio_output_route: corr.audio_output_route,
              headphones_connected: corr.headphones_connected,
              audio_devices_enumerated_json: corr.audio_devices_enumerated_json,
              bluetooth_device_name: btHint,
              moment_number: currentInterviewMomentRef.current,
            },
            platform: r.platform,
          });
          const sampleReq = Platform.OS === 'web' ? 48000 : 44100;
          const sampleAct = Platform.OS === 'web' ? 48000 : 44100;
          markLastAudioSessionEventType('recording_quality_actual');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'recording_quality_actual',
            eventData: {
              sample_rate_requested: sampleReq,
              sample_rate_actual: sampleAct,
              bit_depth_actual: 16,
              channels_actual: 1,
              moment_number: currentInterviewMomentRef.current,
              sample_rate_below_requested: sampleAct < sampleReq,
            },
            platform: r.platform,
          });
          const ttsDone = getLastTtsCompletionCallbackMs();
          const sinceTts = ttsDone != null ? tapIntentAtMs - ttsDone : null;
          const lateTh = getLateStartThresholdMs();
          markLastAudioSessionEventType('user_speech_latency');
          writeAudioSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'user_speech_latency',
            eventData: {
              time_since_tts_completion_ms: sinceTts,
              moment_number: currentInterviewMomentRef.current,
              early_start: sinceTts != null && sinceTts < 800,
              late_start: sinceTts != null && sinceTts > lateTh,
              late_start_threshold_ms: lateTh,
            },
            platform: r.platform,
          });
          if (userId && sinceTts != null && sinceTts > lateTh) {
            writeAudioSessionLog({
              userId,
              attemptId: r.attemptId,
              eventType: 'late_start_extended',
              eventData: {
                time_since_tts_completion_ms: sinceTts,
                late_start_threshold_ms: lateTh,
                moment_number: currentInterviewMomentRef.current,
              },
              platform: r.platform,
            });
            void refreshWebMicPreInitIfStaleAfterLateStartWindow();
          }
          markLastAudioSessionEventType('recording_start');
          writeSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'recording_start',
            eventData: takeRecordingStartEventDataWithVadBypassRestart(),
            platform: r.platform,
          });
        }
        if (__DEV__) console.log('[Aria] RECORDING STARTED');
      }
    } catch (err) {
      if (__DEV__) console.error('[Aria] MIC ERROR:', err instanceof Error ? err.message : err);
      handleRecordingError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [
    voiceState,
    useTapMicUi,
    useMediaRecorderPath,
    handlePressStart,
    handlePressEnd,
    audioRecorder.isRecording,
    audioRecorder.stopRecording,
    audioRecorder.startRecording,
    audioRecorder.requestPermission,
    handleRecordingError,
    waitUntilInterviewerQuiescentForWebMic,
    startRecordingAfterPendingTts,
    userId,
  ]);

  const handleWebResumeWelcomeTap = useCallback(async () => {
    setWebResumeWelcomeTapPending(false);
    markWebInterviewUserGestureNow();
    setMobileWebTapToBeginDone(true);
    unlockWebAudioForAutoplay();
    primeHtmlAudioForMobileTtsFromMicGesture();
    try {
      await speakTextSafe(RESUME_WELCOME_BACK_MESSAGE, {
        telemetrySource: 'greeting',
        ttsTriggerSource: 'gesture_handler',
      });
    } finally {
      resumeRepeatChoicePendingRef.current = true;
    }
  }, [speakTextSafe]);

  const handleResume = useCallback(
    async (saved: NonNullable<Awaited<ReturnType<typeof loadInterviewFromStorage>>>) => {
      resumeLoadingFlowActiveRef.current = true;
      setResumeLoadingVisible(true);
      logSessionResumeState('loading');
      if (saved.sessionAttemptId && userId) {
        const { data: resumeAttempt } = await supabase
          .from('interview_attempts')
          .select('id')
          .eq('id', saved.sessionAttemptId)
          .eq('user_id', userId)
          .maybeSingle();
        if (!resumeAttempt?.id) {
          await clearInterviewFromStorage(userId);
          await remoteLog('[resume] stale_session_attempt_cleared', { orphanAttemptId: saved.sessionAttemptId });
          resumeLoadingFlowActiveRef.current = false;
          setResumeLoadingVisible(false);
          setInterviewStatus('not_started');
          return;
        }
      }
      const restoredMessages = saved.messages ?? [];
      const syncedMoments = syncInterviewMomentsFromTranscript(restoredMessages, saved.scenariosCompleted ?? []);
      if (saved.sessionAttemptId) {
        interviewSessionAttemptIdRef.current = saved.sessionAttemptId;
        assignAttemptIdForSessionLogs(saved.sessionAttemptId);
      }
      interviewMomentsCompleteRef.current = syncedMoments.momentsComplete;
      currentInterviewMomentRef.current = syncedMoments.currentMoment;
      personalHandoffInjectedRef.current = syncedMoments.personalHandoffInjected;
      moment4ThresholdProbeAskedRef.current = false;
      scenarioAContemptProbeAskedRef.current = restoredMessages.some(
        (m) =>
          m.role === 'assistant' &&
          looksLikeScenarioAContemptProbeQuestion((m as { content?: string }).content ?? '')
      );
      const completedSet = new Set(saved.scenariosCompleted ?? []);
      scoredScenariosRef.current = completedSet;
      const maxCompleted = completedSet.size > 0 ? Math.max(...completedSet) : 1;
      setHighestScenarioReached((prev) => Math.max(prev, maxCompleted));

      const restoredScenarioNum = ((): 1 | 2 | 3 => {
        const cs = saved.currentScenario;
        if (cs === 1 || cs === 2 || cs === 3) return cs;
        for (let i = restoredMessages.length - 1; i >= 0; i--) {
          const sn = (restoredMessages[i] as MessageWithScenario).scenarioNumber;
          if (sn === 1 || sn === 2 || sn === 3) return sn;
        }
        const n = getCurrentScenario(completedSet);
        return n === null ? 3 : n;
      })();
      currentScenarioRef.current = syncedMoments.currentMoment >= 4 ? 3 : restoredScenarioNum;

      const scoreCards: { role: string; content: string; isScoreCard?: boolean }[] = (saved.scenariosCompleted ?? [])
        .slice()
        .sort((a, b) => a - b)
        .map((num) => {
          const s = saved.scenarioScores?.[num];
          if (!s) return null;
          const fake: ScenarioScoreResult = {
            scenarioNumber: num,
            scenarioName: s.scenarioName ?? `Scenario ${num}`,
            pillarScores: s.pillarScores ?? {},
            pillarConfidence: s.pillarConfidence ?? {},
            keyEvidence: s.keyEvidence ?? {},
            specificity: 'high',
            repairCoherenceIssue: null,
          };
          return { role: 'system', content: formatScoreMessage(fake), isScoreCard: true } as { role: string; content: string; isScoreCard?: boolean };
        })
        .filter((x): x is { role: string; content: string; isScoreCard?: boolean } => x != null);
      const fullMessages = [...restoredMessages, ...scoreCards];
      setMessages(fullMessages);

      const assistantForRef = fullMessages.filter((m) => isAssistantBubbleForTranscript(m));
      const refSync = syncReferenceCardStateFromAssistantMessages(assistantForRef);
      committedScenarioRef.current = refSync.scenario;
      setReferenceCardScenario(refSync.scenario);
      setReferenceCardPrompt(refSync.prompt);
      setInterviewUiPhase(refSync.phase);

      const scenarioScoresRestored: Record<number, ScenarioScoreResult> = {};
      Object.entries(saved.scenarioScores ?? {}).forEach(([numStr, s]) => {
        if (!s) return;
        const num = parseInt(numStr, 10);
        scenarioScoresRestored[num] = {
          scenarioNumber: num,
          scenarioName: s.scenarioName ?? `Scenario ${num}`,
          pillarScores: s.pillarScores ?? {},
          pillarConfidence: s.pillarConfidence ?? {},
          keyEvidence: s.keyEvidence ?? {},
          specificity: 'high',
          repairCoherenceIssue: null,
        };
      });
      setScenarioScores(scenarioScoresRestored);

      setStageResults(
        Object.entries(saved.scenarioScores ?? {})
          .filter(([, v]) => v != null)
          .map(([num, s]) => ({
            stage: parseInt(num, 10),
            results: {
              pillarScores: s!.pillarScores ?? {},
              keyEvidence: s!.keyEvidence ?? {},
              pillarConfidence: s!.pillarConfidence ?? {},
              narrativeCoherence: 'moderate' as const,
              behavioralSpecificity: 'moderate' as const,
              notableInconsistencies: [],
              interviewSummary: '',
            } as InterviewResults,
          }))
      );

      const allDetected = restoredMessages
        .filter((m) => m.role === 'assistant')
        .flatMap((m) => detectConstructs(m.content));
      setTouchedConstructs([...new Set(allDetected)]);

      resumeLastAssistantTextRef.current = extractLastInterviewerMessage(fullMessages);

      const welcomeBack = RESUME_WELCOME_BACK_MESSAGE;
      const welcomeMsg = {
        role: 'assistant',
        content: welcomeBack,
        isWelcomeBack: true,
        scenarioNumber: currentScenarioRef.current,
      } as MessageWithScenario;
      setMessages([...fullMessages, welcomeMsg]);

      resumeRepeatChoicePendingRef.current = false;
      markSessionResumedForNextRecordingStart();
      if (Platform.OS === 'web') {
        void (async () => {
          await refreshWebAudioRoutesForSession();
          const p = await probeHeadphoneRoute();
          lastHeadphoneProbeRef.current = p;
          if (p.fingerprint != null) {
            lastAudioRouteFingerprintRef.current = p.fingerprint;
            setAudioRouteKind(p.kind);
          }
        })();
        setWebResumeWelcomeTapPending(true);
      } else {
        void (async () => {
          try {
            await speakTextSafe(welcomeBack, { telemetrySource: 'greeting', ttsTriggerSource: 'callback' });
          } finally {
            resumeRepeatChoicePendingRef.current = true;
          }
        })();
      }

      setStatus('active');
      void (async () => {
        await awaitScreenReadySignal();
        if (!resumeLoadingFlowActiveRef.current) return;
        resumeLoadingFlowActiveRef.current = false;
        setResumeLoadingVisible(false);
        logSessionResumeState('ready');
      })();
    },
    [speakTextSafe, awaitScreenReadySignal, logSessionResumeState, userId]
  );

  useEffect(() => {
    if (!userId || isAdmin) return;
    if (hasResumedRef.current) return;
    if (isInterviewCompleteRef.current) return;
    let cancelled = false;
    (async () => {
      const saved = await loadInterviewFromStorage(userId);
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          runId: 'pre-fix',
          hypothesisId: 'H4',
          location: 'AriaScreen.tsx:resumeEffect',
          message: 'saved_payload_loaded',
          data: {
            hasSaved: !!saved,
            savedMessageCount: saved?.messages?.length ?? 0,
            savedCompletedCount: saved?.scenariosCompleted?.length ?? 0,
            savedCurrentScenario: saved?.currentScenario ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (cancelled) return;
      if (!saved?.messages?.length) return;
      if (saved.pendingCompletion) {
        const aid = saved.sessionAttemptId;
        const aidOk = typeof aid === 'string' && aid.length > 0;
        let attemptStillThere = false;
        if (aidOk) {
          const { data: pendingResumeAttempt } = await supabase
            .from('interview_attempts')
            .select('id')
            .eq('id', aid)
            .eq('user_id', userId)
            .maybeSingle();
          attemptStillThere = !!pendingResumeAttempt?.id;
        }
        if (cancelled) return;
        if (!aidOk || !attemptStillThere) {
          await clearInterviewFromStorage(userId);
          await remoteLog('[resume] stale_pending_completion_cleared', {
            aidOk,
            attemptStillThere,
            hadPendingCompletion: true,
          });
          // #region agent log
          fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
            body: JSON.stringify({
              sessionId: 'c61a43',
              runId: 'post-fix',
              hypothesisId: 'H-A',
              location: 'AriaScreen.tsx:resumeEffect',
              message: 'stale_pending_completion_cleared',
              data: { aidOk, attemptStillThere },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          return;
        }
        hasResumedRef.current = true;
        const transcript = saved.messages.filter((m) => m.role === 'user' || m.role === 'assistant');
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            runId: 'post-fix',
            hypothesisId: 'H7',
            location: 'AriaScreen.tsx:resumeEffect',
            message: 'resume_pending_completion_branch',
            data: {
              transcriptLen: transcript.length,
              savedMessageCount: saved.messages.length,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        pendingCompletionTranscriptRef.current = transcript;
        setPendingCompletion(true);
        setInterviewStatus('preparing_results');
        return;
      }
      // Don't resume from greeting-only state (avoids infinite resume loop)
      if (isGreetingOnly(saved.messages)) {
        await clearInterviewFromStorage(userId);
        return;
      }
      const hasScenarioProgress =
        (saved.currentScenario ?? 0) >= 1 &&
        (saved.messages?.filter((m) => m.role === 'user').length ?? 0) >= 2;
      const hasCompletedScenario = (saved.scenariosCompleted?.length ?? 0) > 0;
      if (hasScenarioProgress || hasCompletedScenario) {
        const completedCount = saved.scenariosCompleted?.length ?? 0;
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            runId: 'pre-fix',
            hypothesisId: 'H4',
            location: 'AriaScreen.tsx:resumeEffect',
            message: 'resume_decision',
            data: {
              hasScenarioProgress,
              hasCompletedScenario,
              completedCount,
              willResume: completedCount < 3,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        if (completedCount < 3) {
          hasResumedRef.current = true;
          void handleResume(saved).catch(() => {
            resumeLoadingFlowActiveRef.current = false;
            setResumeLoadingVisible(false);
          });
        } else {
          await clearInterviewFromStorage(userId);
        }
      } else {
        await clearInterviewFromStorage(userId);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, isAdmin, handleResume]);

  const startInterview = useCallback(async (opts?: { fromUserGesture?: boolean }) => {
    const interviewStartTapClockMs = Date.now();
    /** New interview session: require a fresh web audio unlock in this gesture stack before any TTS. */
    resetWebInterviewAudioSession();
    /** Any web path that begins inside a real user gesture (overlay, first pointerdown, consent button). */
    if (opts?.fromUserGesture && Platform.OS === 'web') {
      setMobileWebTapToBeginDone(true);
      markWebInterviewUserGestureNow();
    }
    /** Sync unlock, then mic permission + pre-init before any other await — preserves gesture for Chrome mobile. */
    if (Platform.OS === 'web') {
      unlockWebAudioForAutoplay();
      primeHtmlAudioForMobileTtsFromMicGesture();
      /** Pairs with later `speakTextSafe` / ElevenLabs so `tts_trigger_source: preauthorized_element` matches post-greeting turns. */
      preAuthorizeAudioElementOnMicTapGesture();
      const micGate = await requestMicrophonePermissionForInterviewStart();
      const attemptIdForMicGate = interviewSessionAttemptIdRef.current;
      const webPlat = 'web' as const;
      if (!micGate.ok) {
        if (userId) {
          writeSessionLog({
            userId,
            attemptId: attemptIdForMicGate,
            eventType: 'mic_permission_denied_at_start',
            eventData: {
              platform: webPlat,
              attempt_id: attemptIdForMicGate,
              error_name: micGate.errorName ?? 'unknown',
            },
            platform: webPlat,
          });
        } else {
          void remoteLog('mic_permission_denied_at_start', {
            platform: webPlat,
            attempt_id: attemptIdForMicGate,
            error_name: micGate.errorName ?? 'unknown',
          });
        }
        setMicError(
          'Microphone access is required to complete the interview. Please allow microphone access and try again.',
        );
        setVoiceState('idle');
        return;
      }
      const timeToGrantMs = Date.now() - interviewStartTapClockMs;
      if (userId) {
        writeSessionLog({
          userId,
          attemptId: attemptIdForMicGate,
          eventType: 'mic_permission_granted_at_start',
          eventData: {
            platform: webPlat,
            attempt_id: attemptIdForMicGate,
            time_to_grant_ms: timeToGrantMs,
          },
          platform: webPlat,
        });
      } else {
        void remoteLog('mic_permission_granted_at_start', {
          platform: webPlat,
          attempt_id: attemptIdForMicGate,
          time_to_grant_ms: timeToGrantMs,
        });
      }
      await beginInterviewMicPreInitDuringTts('greeting');
      await refreshWebAudioRoutesForSession();
    }
    if (Platform.OS === 'web' && opts?.fromUserGesture) {
      void remoteLog('[START] startInterview called', {
        userId: userId ?? null,
        isAdmin,
        platform: Platform.OS,
      });
    } else {
      await remoteLog('[START] startInterview called', {
        userId: userId ?? null,
        isAdmin,
        platform: Platform.OS,
      });
    }
    if (userId && !isAdmin) {
      if (interviewAttemptBootstrap === 'failed') {
        setMicError('Could not create your interview session. Please refresh the page and try again.');
        setVoiceState('idle');
        return;
      }
      if (interviewAttemptBootstrap === 'loading') {
        await remoteLog('[START] blocked attempt bootstrap still loading');
        setMicError('Still preparing your session. Please try again in a moment.');
        setVoiceState('idle');
        return;
      }
    }
    if (isAdmin) await clearInterviewFromStorage(userId);
    const saved = await loadInterviewFromStorage(userId);
    if (saved && (saved.scenariosCompleted?.length ?? 0) >= 3) {
      await clearInterviewFromStorage(userId);
    }
    try {
      const openingLineText = WEB_INTERVIEW_OPENING_GREETING;
      let openingLineDeliveredEarly = false;
      const hasApiKeys = !!ANTHROPIC_API_KEY || !!ANTHROPIC_PROXY_URL;
      const webGestureFirstGreeting =
        Platform.OS === 'web' &&
        opts?.fromUserGesture === true &&
        hasApiKeys &&
        !!userId &&
        !isAdmin &&
        interviewAttemptBootstrap === 'ready';

      /** Greeting after mic permission (web): synchronous `play()` stays in the Begin tap gesture chain. */
      if (webGestureFirstGreeting) {
        setStatus('active');
        setInterviewStatus('in_progress');
        setVoiceState('processing');
        resetInterviewProgressRefs();
        if (Platform.OS === 'web') {
          audioRecorder.resetWebMicInputFallbackState();
        }
        recordingJustFinishedBeforeNextTtsRef.current = false;
        lastVoiceTurnLanguageRef.current = null;
        lastVoiceTurnConfidenceRef.current = null;
        currentScenarioRef.current = 1;
        setMessages([{ role: 'assistant', content: openingLineText, scenarioNumber: 1 } as MessageWithScenario]);
        const el = getPrefetchedGreetingHtmlAudioElement();
        if (el) {
          await speakTextSafe(openingLineText, {
            telemetrySource: 'greeting',
            ttsTriggerSource: 'gesture_handler',
            immediateWebPlaybackElement: el,
          });
          openingLineDeliveredEarly = true;
          releaseWebInterviewGreetingPrefetch();
        } else {
          await speakTextSafe(openingLineText, {
            telemetrySource: 'greeting',
            ttsTriggerSource: 'gesture_handler',
          });
          openingLineDeliveredEarly = true;
        }
      }

      // 1 — Request mic permissions (web: already granted in gesture stack before greeting TTS)
      if (Platform.OS !== 'web') {
        const granted = await audioRecorder.requestPermission();
        setMicPermission(granted ? 'granted' : 'denied');
        await remoteLog('[START] Mic permission result', { granted });
        if (!granted) {
          if (__DEV__) console.warn('[Aria] Mic permission denied at start');
          setVoiceState('idle');
          setMicError('Microphone access was denied. Enable the microphone in settings, then try again.');
          return;
        }
      }

      const routeProbe = await probeHeadphoneRoute();
      lastHeadphoneProbeRef.current = routeProbe;
      setAudioRouteKind(routeProbe.kind);
      lastAudioRouteFingerprintRef.current = routeProbe.fingerprint;

      // 2 — Set playback mode so welcome TTS plays through speaker; mic will switch to recording mode when user holds button
      if (Platform.OS !== 'web') {
        await setPlaybackMode();
        await remoteLog('[START] Audio mode set');
      }

      if (!openingLineDeliveredEarly) {
        setStatus('active');
        setInterviewStatus('in_progress');
        setVoiceState('processing');
        resetInterviewProgressRefs();
        if (Platform.OS === 'web') {
          audioRecorder.resetWebMicInputFallbackState();
        }
        recordingJustFinishedBeforeNextTtsRef.current = false;
        lastVoiceTurnLanguageRef.current = null;
        lastVoiceTurnConfidenceRef.current = null;
      }

      if (userId) {
        let createdAttemptId: string | null = interviewSessionAttemptIdRef.current;
        try {
          const device = await collectDeviceContext();
          setSessionLogPlatform(device.platform);
          setAudioSessionDeviceSnapshot({
            device_model: device.device_model,
            os_version: device.os_version,
            app_version: device.app_version,
          });
          const env = await collectInterviewDeviceEnvironment(routeProbe);
          setLastInterviewDeviceEnvironment(env);
          if (Platform.OS === 'web') {
            captureWebSessionLogDeviceContext({
              device_model: device.device_model,
              os_version: device.os_version,
              app_version: device.app_version,
              available_memory_mb: env.available_memory_mb,
            });
            await refreshWebAudioRoutesForSession();
          } else {
            setSessionAudioRoutes(mapHeadphoneProbeToSessionInputRoute(routeProbe), 'unknown');
          }
          const { data: urow } = await supabase
            .from('users')
            .select('interview_attempt_count')
            .eq('id', userId)
            .maybeSingle();
          const attemptNumber = (urow?.interview_attempt_count ?? 0) + 1;
          if (!createdAttemptId) {
            const { data: attemptRow, error: attemptInsErr } = await supabase
              .from('interview_attempts')
              .insert({
                user_id: userId,
                attempt_number: attemptNumber,
                transcript: [],
              })
              .select('id')
              .single();
            if (attemptInsErr) {
              if (__DEV__) {
                console.warn('[Aria] interview_attempts insert at session start failed:', attemptInsErr);
              }
              const errPayload = {
                message: attemptInsErr.message,
                code: attemptInsErr.code,
                details: attemptInsErr.details,
                hint: attemptInsErr.hint,
              };
              await remoteLog('[START] attempt_creation_failed', { error: errPayload });
              writeSessionLog({
                userId,
                attemptId: null,
                eventType: 'attempt_creation_failed',
                eventData: { ...errPayload, phase: 'start_interview_fallback' },
                platform: device.platform,
              });
            }
            createdAttemptId = attemptRow?.id ?? null;
            if (createdAttemptId) {
              interviewSessionAttemptIdRef.current = createdAttemptId;
            }
            if (createdAttemptId) {
              writeSessionLog({
                userId,
                attemptId: createdAttemptId,
                eventType: 'attempt_created',
                eventData: { attempt_id: createdAttemptId },
                platform: device.platform,
              });
              writeSessionLog({
                userId,
                attemptId: createdAttemptId,
                eventType: 'session_initialized',
                eventData: {
                  session_correlation_id: interviewSessionIdRef.current,
                  bootstrap: 'start_interview_fallback',
                },
                platform: device.platform,
              });
            }
          }
          resetSessionLogRuntime({
            sessionCorrelationId: interviewSessionIdRef.current,
            attemptId: createdAttemptId,
            sessionLogsRequireAttemptId: createdAttemptId != null,
          });
          markInterviewSessionClockStart();
          const rLog = getSessionLogRuntime();
          if (!rLog.attemptId) {
            setMicError('Could not link your interview session. Please try again.');
            setVoiceState('idle');
            setStatus('starting_interview');
            setInterviewStatus('not_started');
            return;
          }
          writeAudioSessionLog({
            userId,
            attemptId: rLog.attemptId,
            eventType: 'device_environment_at_session_start',
            eventData: {
              ...env,
            },
            platform: device.platform,
          });
          const healthBits: string[] = [];
          if (shouldWarnHighThermal(env)) {
            writeAudioSessionLog({
              userId,
              attemptId: rLog.attemptId,
              eventType: 'high_thermal_warning',
              eventData: { thermal_state: env.thermal_state },
              platform: device.platform,
            });
            healthBits.push(
              'Your device may be running warm, which can affect audio quality. You may want to close other apps before starting.'
            );
          }
          if (env.other_app_using_microphone) {
            healthBits.push(
              'Another app appears to be using your microphone. Please close it before starting for the best experience.'
            );
          }
          if (healthBits.length > 0) {
            setSessionAudioHealthNotice(healthBits.join('\n\n'));
          }
          const baseData = {
            ...device,
            is_alpha_tester: !!profile?.isAlphaTester,
            referral_code_used: profile?.inviteCode ?? null,
            attempt_number: attemptNumber,
            session_correlation_id: interviewSessionIdRef.current,
          };
          writeSessionLog({
            userId,
            attemptId: rLog.attemptId,
            eventType: 'session_start',
            eventData: baseData,
            platform: device.platform,
          });
          writeSessionLog({
            userId,
            attemptId: rLog.attemptId,
            eventType: 'build_version',
            eventData: { build_version: device.build_version },
            platform: device.platform,
          });
          writeSessionLog({
            userId,
            attemptId: rLog.attemptId,
            eventType: 'audio_route_probe',
            eventData: {
              kind: routeProbe.kind,
              fingerprint: routeProbe.fingerprint,
              input_type: routeProbe.input?.type ?? null,
              input_name: routeProbe.input?.name?.slice?.(0, 120) ?? null,
            },
            platform: device.platform,
          });
        } catch (e) {
          if (__DEV__) console.warn('[session_logs] session_start logging failed', e);
          if (!interviewSessionAttemptIdRef.current) {
            resetSessionLogRuntime({
              sessionCorrelationId: interviewSessionIdRef.current,
              attemptId: null,
              sessionLogsRequireAttemptId: false,
            });
          }
        }
      } else {
        resetSessionLogRuntime({
          sessionCorrelationId: interviewSessionIdRef.current,
          attemptId: null,
          sessionLogsRequireAttemptId: false,
        });
      }

      const hasKey = !!ANTHROPIC_API_KEY;
      const hasProxy = !!ANTHROPIC_PROXY_URL;
      await remoteLog('[START] API check', {
        hasAnthropicKey: hasKey,
        hasProxyUrl: hasProxy,
        willUseFallback: !hasKey && !hasProxy,
      });

      if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
        await remoteLog('[START] No API key or proxy — showing fallback message');
        if (__DEV__) console.error('[Aria] INIT: No API key or proxy — showing fallback message');
        const welcomeFallback = "Hi, I'm Amoraea. I'll be with you in just a moment.";
        currentScenarioRef.current = 1;
        setMessages([{ role: 'assistant', content: welcomeFallback, scenarioNumber: 1 } as MessageWithScenario]);
        setVoiceState('idle');
        await speakTextSafe(welcomeFallback, { telemetrySource: 'greeting' }).catch(() => {});
        return;
      }

      if (!openingLineDeliveredEarly) {
        // 3 — Deliver the real greeting (scenario 1 starts here)
        await remoteLog('[START] Delivering real greeting');
        currentScenarioRef.current = 1;
        setMessages([{ role: 'assistant', content: openingLineText, scenarioNumber: 1 } as MessageWithScenario]);
        await speakTextSafe(openingLineText, {
          telemetrySource: 'greeting',
          ttsTriggerSource: opts?.fromUserGesture ? 'gesture_handler' : 'callback',
        });
        await remoteLog('[START] Real greeting sent');
      }
    } catch (err) {
      await remoteLog('[START] INIT ERROR causing fallback', {
        name: err instanceof Error ? err.name : 'unknown',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
      });
      if (__DEV__) {
        console.error('=== INIT ERROR causing fallback ===');
        console.error('Name:', err instanceof Error ? err.name : 'unknown');
        console.error('Message:', err instanceof Error ? err.message : String(err));
        console.error('Stack:', err instanceof Error ? err.stack : '');
      }
      setVoiceState('idle');
      currentScenarioRef.current = 1;
      setStatus('active');
      setInterviewStatus('in_progress');
      const fallbackMsg = "Hi, I'm Amoraea. I'll be with you in just a moment.";
      setMessages([{ role: 'assistant', content: fallbackMsg, scenarioNumber: 1 } as MessageWithScenario]);
      await speakTextSafe(fallbackMsg, { telemetrySource: 'greeting' }).catch(() => {});
    }
  }, [
    speakTextSafe,
    isAdmin,
    userId,
    audioRecorder,
    resetInterviewProgressRefs,
    profile?.isAlphaTester,
    profile?.inviteCode,
    interviewAttemptBootstrap,
  ]);

  useEffect(() => {
    if (!isInterviewAppRoute) return;
    if (status !== 'starting_interview') return;
    if (interviewStatus !== 'not_started') return;
    if (onboardingAutoStartRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
        body: JSON.stringify({
          sessionId: 'e70f17',
          location: 'AriaScreen.tsx:autoStartEffect',
          message: 'skip_ref_already_true',
          data: { status, interviewStatus },
          timestamp: Date.now(),
          hypothesisId: 'H2',
        }),
      }).catch(() => {});
      // #endregion
      return;
    }
    /** Web: never start from this effect — no user gesture after refresh; use overlay (mobile) or pointerdown (desktop). */
    if (Platform.OS === 'web') {
      return;
    }
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
      body: JSON.stringify({
        sessionId: 'e70f17',
        location: 'AriaScreen.tsx:autoStartEffect',
        message: 'effect_calls_startInterview_native',
        data: {},
        timestamp: Date.now(),
        hypothesisId: 'H4',
      }),
    }).catch(() => {});
    // #endregion
    if (interviewAttemptBootstrap !== 'ready') return;
    onboardingAutoStartRef.current = true;
    void startInterview();
  }, [isInterviewAppRoute, status, interviewStatus, startInterview, interviewAttemptBootstrap]);

  /**
   * Desktop web: cannot call `startInterview` from a bare useEffect (no gesture after hard refresh).
   * - If the tab already has user activation (e.g. SPA navigation right after Sign in), start once after priming AudioContext — no overlay.
   * Otherwise show `webDesktopAwaitingStartOverlay` and wait for the first pointerdown.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setWebDesktopAwaitingStartOverlay(false);
      return;
    }
    if (webSpeechShouldDeferToUserGesture()) {
      setWebDesktopAwaitingStartOverlay(false);
      return;
    }
    if (!isInterviewAppRoute) {
      setWebDesktopAwaitingStartOverlay(false);
      return;
    }
    if (status !== 'starting_interview' || interviewStatus !== 'not_started') {
      setWebDesktopAwaitingStartOverlay(false);
      return;
    }
    if (onboardingAutoStartRef.current) {
      setWebDesktopAwaitingStartOverlay(false);
      return;
    }

    if (interviewAttemptBootstrap !== 'ready') {
      setWebDesktopAwaitingStartOverlay(false);
      return;
    }

    setWebDesktopAwaitingStartOverlay(true);
    const onFirstPointer = () => {
      if (onboardingAutoStartRef.current) return;
      setWebDesktopAwaitingStartOverlay(false);
      unlockWebAudioForAutoplay();
      onboardingAutoStartRef.current = true;
      void startInterview({ fromUserGesture: true });
    };
    window.addEventListener('pointerdown', onFirstPointer, { capture: true, once: true });
    return () => {
      setWebDesktopAwaitingStartOverlay(false);
      window.removeEventListener('pointerdown', onFirstPointer, { capture: true });
    };
  }, [
    isInterviewAppRoute,
    status,
    interviewStatus,
    startInterview,
    webSpeechShouldDeferToUserGesture,
    interviewAttemptBootstrap,
  ]);

  /**
   * Mobile web: tap overlay must call `startInterview({ fromUserGesture: true })` in the same press handler.
   * If we only set state and let `useEffect` call `startInterview`, the gesture chain is lost and TTS may not run.
   */
  const handleMobileWebTapToBegin = useCallback(
    (shouldStartInterview: boolean) => {
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
        body: JSON.stringify({
          sessionId: 'e70f17',
          location: 'AriaScreen.tsx:handleMobileWebTapToBegin',
          message: 'overlay_press',
          data: { shouldStartInterview },
          timestamp: Date.now(),
          hypothesisId: 'H1',
        }),
      }).catch(() => {});
      // #endregion
      unlockWebAudioForAutoplay();
      primeHtmlAudioForMobileTtsFromMicGesture();
      setMobileWebTapToBeginDone(true);
      if (shouldStartInterview) {
        onboardingAutoStartRef.current = true;
        void startInterview({ fromUserGesture: true });
      }
    },
    [startInterview],
  );

  const saveInterviewResults = useCallback(
    async (results: InterviewResults, gateResult: GateResult, uid: string) => {
      if (!uid) return;
      try {
        const passFields = await buildUsersRowInterviewPassFromGate(supabase, uid, gateResult.pass);
        const { error } = await supabase
          .from('users')
          .update({
            interview_completed: true,
            ...passFields,
            interview_weighted_score: gateResult.weightedScore,
            interview_pillar_scores: results.pillarScores ?? null,
            interview_completed_at: new Date().toISOString(),
          })
          .eq('id', uid);
        if (error) console.error('Failed to save interview results:', error);
        else await clearInterviewFromStorage(uid);
      } catch (err) {
        console.error('Interview save error:', err);
      }
    },
    []
  );

  const scoreInterview = useCallback(async (finalMessages: { role: string; content: string }[]) => {
    await remoteLog('[1] INTERVIEW_COMPLETE scoreInterview entered', {
      isAdmin,
      ALPHA_MODE,
      userId: userId ?? null,
      interviewStatus: interviewStatusRef.current,
      routeName: route.name,
    });
    if (__DEV__) {
      console.log('=== [2] Entering completion handler ===');
      console.log('interviewStatus:', interviewStatusRef.current);
    }
    const isOnboardingFlow = route.name === 'Aria' || route.name === 'OnboardingInterview';
    const { data: authSessionForScore } = await supabase.auth.getSession();
    const sessionEmailForScore = authSessionForScore.session?.user?.email ?? null;
    /** Session email is authoritative at completion time; without it, admin can be misclassified and skip DB insert (PostInterview early return). */
    const isAdminConsoleAccount =
      isAmoraeaAdminConsoleEmail(sessionEmailForScore) ||
      isAmoraeaAdminConsoleEmail(user?.email) ||
      isAdmin;
    const context = typologyContext || 'No typology context — score from transcript only.';
    const isStandardOnboardingApplicant =
      isOnboardingFlow && !!userId && !!profile && !profile.isAlphaTester && !isAdminConsoleAccount;
    if (isStandardOnboardingApplicant && (ANTHROPIC_API_KEY || ANTHROPIC_PROXY_URL)) {
      let serverDelegateOk = false;
      try {
        await ensureValidSession();
        const { data: preAttemptUser } = await supabase
          .from('users')
          .select('interview_attempt_count')
          .eq('id', userId)
          .single();
        const nextAttemptNumber = (preAttemptUser?.interview_attempt_count ?? 0) + 1;
        const bundle = (n: 1 | 2 | 3) => {
          const s = scenarioScoresRef.current[n];
          if (!s) return null;
          return {
            pillarScores: s.pillarScores,
            pillarConfidence: s.pillarConfidence,
            keyEvidence: s.keyEvidence,
            scenarioName: s.scenarioName,
          };
        };
        const existingAttemptId = interviewSessionAttemptIdRef.current;
        const rowPayload: Record<string, unknown> = {
          user_id: userId,
          attempt_number: nextAttemptNumber,
          transcript: finalMessages,
          response_timings: responseTimingsRef.current,
          probe_log: probeLogRef.current,
          scenario_1_scores: bundle(1),
          scenario_2_scores: bundle(2),
          scenario_3_scores: bundle(3),
          scoring_deferred: true,
          interview_typology_context: context,
        };
        let attemptId: string | null = null;
        if (existingAttemptId) {
          const { error: upe } = await supabase
            .from('interview_attempts')
            .update(rowPayload)
            .eq('id', existingAttemptId)
            .eq('user_id', userId);
          if (upe) throw new Error(upe.message);
          attemptId = existingAttemptId;
        } else {
          const { data: ins, error: ine } = await supabase
            .from('interview_attempts')
            .insert(rowPayload)
            .select('id')
            .single();
          if (ine) throw new Error(ine.message);
          attemptId = (ins as { id?: string })?.id ?? null;
        }
        if (!attemptId) throw new Error('Missing attempt id after save');
        await profileRepository.upsertProfile(userId, {
          applicationStatus: 'under_review',
          onboardingStage: 'complete',
        });
        if (!ALPHA_MODE) {
          queryClient.invalidateQueries({ queryKey: ['profile', userId] });
        } else {
          setTimeout(() => queryClient.invalidateQueries({ queryKey: ['profile', userId] }), 0);
        }
        const passOverride = await fetchInterviewPassAdminOverride(supabase, userId);
        const { error: userUpErr } = await supabase
          .from('users')
          .update({
            interview_completed: true,
            interview_passed: interviewPassWhileScoringPending(passOverride),
            interview_passed_computed: null,
            interview_weighted_score: null,
            interview_completed_at: new Date().toISOString(),
            interview_attempt_count: nextAttemptNumber,
            latest_attempt_id: attemptId,
          })
          .eq('id', userId);
        if (userUpErr) throw new Error(userUpErr.message);
        try {
          await supabase.rpc('fulfill_referral_after_interview', { p_user_id: userId });
        } catch {
          /* non-fatal */
        }
        await ensureShareableReferralCodeForReferrer(userId);
        assignAttemptIdForSessionLogs(attemptId);
        const { data: edgeData, error: edgeInvokeError } = await supabase.functions.invoke<{
          ok?: boolean;
          error?: string;
          skipped?: string;
        }>('complete-standard-interview', { body: { attempt_id: attemptId } });
        if (edgeInvokeError) {
          await remoteLog('[STANDARD] complete-standard-interview invoke failed (will use client scoring)', {
            attemptId,
            message: edgeInvokeError.message,
          });
          if (__DEV__) {
            console.warn('[Aria] complete-standard-interview', edgeInvokeError.message);
          }
          throw new Error(`EDGE_INVOKE:${edgeInvokeError.message}`);
        }
        const edgeBody = edgeData as { ok?: boolean; error?: string; skipped?: string } | null;
        if (edgeBody && edgeBody.ok === false && edgeBody.error) {
          await remoteLog('[STANDARD] complete-standard-interview returned error (will use client scoring)', {
            attemptId,
            error: edgeBody.error,
          });
          throw new Error(`EDGE:${edgeBody.error}`);
        }
        if (edgeBody?.skipped === 'not_deferred') {
          await remoteLog('[STANDARD] complete-standard-interview skipped not_deferred (will use client scoring)', {
            attemptId,
          });
          throw new Error('EDGE_SKIPPED_NOT_DEFERRED');
        }
        writeSessionLog({
          userId,
          attemptId,
          eventType: 'session_complete',
          eventData: { path: 'standard_onboarding_server_scoring', server_delegate: true, edge_ok: true },
          platform: getSessionLogRuntime().platform,
        });
        await clearInterviewFromStorage(userId);
        await remoteLog('[STANDARD] application saved; post-interview (server scoring complete)', {
          attemptId,
        });
        replaceWithStandardApplicantProcessingHandoffForUser(navigation, userId);
        setStatus('results');
        serverDelegateOk = true;
      } catch (err) {
        await remoteLog('[STANDARD] server delegate failed; using client scoring path', {
          message: err instanceof Error ? err.message : String(err),
        });
      }
      if (serverDelegateOk) {
        return;
      }
    }
    interviewStatusRef.current = 'preparing_results';
    setInterviewStatus('preparing_results');
    void persistInterviewAttemptSessionLifecycle(interviewSessionAttemptIdRef.current, 'scoring');
    setStatus('scoring');
    await remoteLog('[2] Screen set to scoring');
    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
      const weightedMinFallback = await resolveWeightedPassMinAfterReferralFulfillment(userId);
      const fallbackGate = computeGateResult({ ...FALLBACK_MARKER_SCORES_MID }, null, {
        weightedPassMin: weightedMinFallback,
      });
      const fallbackResults: InterviewResults = {
        pillarScores: { ...FALLBACK_MARKER_SCORES_MID },
        keyEvidence: {},
        narrativeCoherence: 'moderate',
        behavioralSpecificity: 'moderate',
        notableInconsistencies: [],
        interviewSummary: 'Interview completed. Scoring was unavailable.',
        gateResult: fallbackGate,
      };
      setResults(fallbackResults);
      if (isOnboardingFlow) {
        await profileRepository.upsertProfile(userId, {
          applicationStatus: 'under_review',
          onboardingStage: 'complete',
        });
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }
      await saveInterviewResults(fallbackResults, fallbackResults.gateResult!, userId);
      const standardNoApi =
        isOnboardingFlow && !!userId && !!profile && !profile.isAlphaTester && !isAdminConsoleAccount;
      if (standardNoApi) {
        await ensureShareableReferralCodeForReferrer(userId);
        replaceWithStandardApplicantProcessingHandoffForUser(navigation, userId);
        setStatus('results');
        return;
      }
      setInterviewStatus('congratulations');
      setStatus('results');
      return;
    }
    const apiUrl = getAnthropicEndpoint();
    const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (useProxy && SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    } else if (!useProxy) {
      headers['x-api-key'] = ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }
    try {
      /** Matches reasoning timeout pattern — proxies can otherwise hang for many minutes with no `fetch` resolution. */
      const SCORING_HOLISTIC_FETCH_TIMEOUT_MS = 180_000;
      const fetchScoringOnce = async (): Promise<InterviewResults> => {
        const abort = new AbortController();
        const t = setTimeout(() => abort.abort(), SCORING_HOLISTIC_FETCH_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(apiUrl, {
            method: 'POST',
            headers,
            signal: abort.signal,
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1500,
              messages: [{ role: 'user', content: buildScoringPrompt(finalMessages, context) }],
            }),
          });
        } finally {
          clearTimeout(t);
        }
        const data = await res.json();
        if (!res.ok) {
          const e = new Error((data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
          (e as Error & { status?: number }).status = res.status;
          throw e;
        }
        const raw = (data.content?.[0]?.text ?? '{}') as string;
        return parseJsonObjectFromModelText(raw) as InterviewResults;
      };
      const parsed = await withRetry(fetchScoringOnce, {
        retries: 3,
        baseDelay: 12000,
        maxDelay: 45000,
        context: 'scoring',
        sessionLog: userId
          ? {
              userId,
              attemptId: getSessionLogRuntime().attemptId,
              platform: getSessionLogRuntime().platform,
            }
          : undefined,
      });
      const weightedMin = await resolveWeightedPassMinAfterReferralFulfillment(userId);
      const gateResult = computeGateResult(parsed.pillarScores ?? {}, parsed.skepticismModifier ?? null, {
        weightedPassMin: weightedMin,
      });
      parsed.gateResult = gateResult;
      setResults(parsed);
      /** Non–alpha testers: after persistence, navigate to branded PostInterview (no in-app scores UI). */
      await remoteLog('[3] Scoring complete', {
        weightedScore: gateResult?.weightedScore,
        passed: gateResult?.pass,
        pillarScores: parsed.pillarScores ?? {},
      });
      if (__DEV__) {
        console.log('=== Scoring API complete ===', 'passed:', gateResult?.pass);
      }
      if (isOnboardingFlow) {
        await profileRepository.upsertProfile(userId, {
          applicationStatus: 'under_review',
          onboardingStage: 'complete',
        });
        if (!ALPHA_MODE) {
          queryClient.invalidateQueries({ queryKey: ['profile', userId] });
        } else {
          setTimeout(() => queryClient.invalidateQueries({ queryKey: ['profile', userId] }), 2000);
        }
      }
      if (ALPHA_MODE && userId) {
        const hasAllScores =
          scenarioScoresRef.current[1] != null &&
          scenarioScoresRef.current[2] != null &&
          scenarioScoresRef.current[3] != null;
        if (!hasAllScores) {
          await remoteLog('COMPLETION_INCOMPLETE_SCORES', {
            s1: !!scenarioScoresRef.current[1],
            s2: !!scenarioScoresRef.current[2],
            s3: !!scenarioScoresRef.current[3],
          });
          if (__DEV__) {
            console.error('Interview complete but missing scenario scores:', {
              s1: scenarioScoresRef.current[1],
              s2: scenarioScoresRef.current[2],
              s3: scenarioScoresRef.current[3],
            });
          }
          const msgs = finalMessages as MessageWithScenario[];
          const rescoreMissingScenarios = async () => {
            const missing = ([1, 2, 3] as const).filter((n) => !scenarioScoresRef.current[n]);
            if (__DEV__) console.log('[RESCORE] Missing scenarios:', missing);
            await Promise.all(
              missing.map(async (scenarioNum) => {
                const taggedMessages = msgs.filter((m) => (m as MessageWithScenario).scenarioNumber === scenarioNum);
                const inferredMessages = inferScenarioMessages(msgs, scenarioNum);
                const messagesToScore = taggedMessages.length >= inferredMessages.length ? taggedMessages : inferredMessages;
                if (__DEV__) {
                  console.log(
                    `[RESCORE] Scenario ${scenarioNum}: ${messagesToScore.length} messages (tagged: ${taggedMessages.length}, inferred: ${inferredMessages.length})`
                  );
                }
                if (messagesToScore.length >= 2) {
                  await scoreScenario(scenarioNum, messagesToScore);
                } else if (__DEV__) {
                  console.error(`[RESCORE] Cannot score scenario ${scenarioNum} — insufficient messages`);
                }
              })
            );
          };
          await rescoreMissingScenarios();
        }
        let alphaSaveOk = false;
        let insertPayload: Record<string, unknown> | null = null;
        let updatePayload: Record<string, unknown> | null = null;
        let attemptNum = 1;
        try {
          await ensureValidSession();
          const parsedPillarScores = parsed.pillarScores ?? {};
          const scenarioBoundaries = buildScenarioBoundaries(
            finalMessages,
            Array.from(scoredScenariosRef.current)
          );
          const languageMarkers = analyzeLanguageMarkers(finalMessages, scenarioBoundaries);
          const personalSlices = inferPersonalMomentSlices(finalMessages);
          const scorePersonalMoment = async (
            slice: { role: string; content: string }[]
          ): Promise<PersonalMomentScoreResult | null> => {
            if (slice.filter((m) => m.role === 'user').length < 1) {
              return null;
            }
            const deferredMoment4Narrative = deferredMoment4NarrativeRef.current;
            const scoringSlice =
              deferredMoment4Narrative
                ? [
                    slice[0] ?? { role: 'assistant', content: MOMENT_4_HANDOFF },
                    { role: 'user', content: deferredMoment4Narrative },
                    ...slice.slice(1),
                  ]
                : slice;
            try {
              const scored = await withRetry(
                async (): Promise<PersonalMomentScoreResult> => {
                  const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      model: 'claude-sonnet-4-20250514',
                      max_tokens: 900,
                      messages: [{ role: 'user', content: buildPersonalMomentScoringPrompt(scoringSlice) }],
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    const e = new Error((data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
                    (e as Error & { status?: number }).status = res.status;
                    throw e;
                  }
                  const raw = (data.content?.[0]?.text ?? '{}') as string;
                  const parsed = parseJsonObjectFromModelText(raw) as PersonalMomentScoreResult;
                  parsed.pillarScores = normalizeScoresByEvidence(parsed.pillarScores, parsed.keyEvidence);
                  return parsed;
                },
                {
                  retries: 2,
                  baseDelay: 5000,
                  maxDelay: 20000,
                  context: 'scoring personal moment 4',
                  sessionLog: userId
                    ? {
                        userId,
                        attemptId: getSessionLogRuntime().attemptId,
                        platform: getSessionLogRuntime().platform,
                      }
                    : undefined,
                }
              );
              if (deferredMoment4NarrativeRef.current) {
                deferredMoment4NarrativeRef.current = null;
              }
              return scored;
            } catch (err) {
              if (__DEV__) console.warn('Personal moment 4 scoring failed:', err);
              return null;
            }
          };
          const moment4Score = await scorePersonalMoment(personalSlices.moment4);
          const moment4ForAggregate = sanitizePersonalMomentScoresForAggregate(moment4Score);
          const txForContempt = finalMessages as MessageWithScenario[];
          const enrichScenarioSliceAtCompletion = (n: 1 | 2 | 3) => {
            const bundle = scenarioScoresRef.current[n];
            if (!bundle) return null;
            return enrichScenarioSliceWithContemptHeuristic(
              { pillarScores: bundle.pillarScores, keyEvidence: bundle.keyEvidence },
              userTurnTextForInterviewScenario(txForContempt, n),
            );
          };
          const s1Enriched = enrichScenarioSliceAtCompletion(1);
          const s2Enriched = enrichScenarioSliceAtCompletion(2);
          const s3Enriched = enrichScenarioSliceAtCompletion(3);
          const mergeEnrichedIntoScenarioRef = (n: 1 | 2 | 3, enr: ReturnType<typeof enrichScenarioSliceAtCompletion>) => {
            if (!enr?.pillarScores || !scenarioScoresRef.current[n]) return;
            const prev = scenarioScoresRef.current[n]!;
            scenarioScoresRef.current[n] = {
              ...prev,
              pillarScores: {
                ...prev.pillarScores,
                ...(enr.pillarScores as Record<string, number | null>),
              } as typeof prev.pillarScores,
              keyEvidence: { ...prev.keyEvidence, ...enr.keyEvidence },
            };
          };
          mergeEnrichedIntoScenarioRef(1, s1Enriched);
          mergeEnrichedIntoScenarioRef(2, s2Enriched);
          mergeEnrichedIntoScenarioRef(3, s3Enriched);
          const runScenarioReconciliation = (n: 1 | 2 | 3) => {
            const b = scenarioScoresRef.current[n];
            if (!b) return;
            const reconciled = fullScenarioReconciliation(
              {
                scenarioNumber: n,
                pillarScores: b.pillarScores as Record<string, number | null | undefined>,
                pillarConfidence: b.pillarConfidence,
                keyEvidence: b.keyEvidence,
              },
              finalMessages as MessageWithScenario[]
            );
            scenarioScoresRef.current[n] = {
              ...b,
              pillarScores: reconciled.pillarScores as ScenarioScoreResult['pillarScores'],
              pillarConfidence: reconciled.pillarConfidence,
              keyEvidence: reconciled.keyEvidence,
            };
          };
          runScenarioReconciliation(1);
          runScenarioReconciliation(2);
          runScenarioReconciliation(3);
          const s1Ps = scenarioScoresRef.current[1]?.pillarScores;
          const s2Ps = scenarioScoresRef.current[2]?.pillarScores;
          const s3Ps = scenarioScoresRef.current[3]?.pillarScores;
          const s1Ke = scenarioScoresRef.current[1]?.keyEvidence;
          const s2Ke = scenarioScoresRef.current[2]?.keyEvidence;
          const s3Ke = scenarioScoresRef.current[3]?.keyEvidence;
          const scoreConsistency = calculateScoreConsistency(s1Ps, s2Ps, s3Ps, s1Ke, s2Ke, s3Ke);
          void remoteLog('[MOMENT4_SCORING_PIPELINE]', {
            m4Start: personalSlices.m4Start,
            moment4SliceTurns: personalSlices.moment4.length,
            moment4UserTurns: personalSlices.moment4.filter((m) => m.role === 'user').length,
            scored: moment4Score !== null,
          });
          const sliceFromRef = (n: 1 | 2 | 3): MarkerScoreSlice | null => {
            const b = scenarioScoresRef.current[n];
            if (!b) return null;
            return { pillarScores: b.pillarScores, keyEvidence: b.keyEvidence };
          };
          const markerSlicesForAggregate: MarkerScoreSlice[] = [
            sliceFromRef(1),
            sliceFromRef(2),
            sliceFromRef(3),
            moment4ForAggregate
              ? {
                  pillarScores: moment4ForAggregate.pillarScores,
                  keyEvidence: moment4ForAggregate.keyEvidence,
                }
              : null,
          ];
          const mergedPillar = aggregatePillarScoresWithCommitmentMergeDetailed(markerSlicesForAggregate);
          const aggregatedPillarScores = mergedPillar.scores;
          const pillarContributorCounts = mergedPillar.contributorCounts;
          let pillarScores: Record<string, number> =
            Object.keys(aggregatedPillarScores).length > 0
              ? { ...aggregatedPillarScores }
              : { ...(parsedPillarScores as Record<string, number>) };
          const commitmentSliceLabels = ['scenario_1', 'scenario_2', 'scenario_3', 'moment_4'];
          const commitmentThresholdInconsistency = analyzeCommitmentThresholdInconsistency(
            markerSlicesForAggregate,
            commitmentSliceLabels
          );
          if (commitmentThresholdInconsistency) {
            void remoteLog('[COMMITMENT_THRESHOLD_INCONSISTENCY]', {
              standardDeviation: commitmentThresholdInconsistency.standardDeviation,
              sliceScores: commitmentThresholdInconsistency.sliceScores,
              weightedCommitmentScore: pillarScores.commitment_threshold,
            });
          }
          const finalGateResult = computeGateResult(pillarScores, parsed.skepticismModifier ?? null, {
            weightedPassMin: weightedMin,
          });
          parsed.pillarScores = pillarScores;
          parsed.gateResult = finalGateResult;
          setResults({ ...parsed });
          const constructAsymmetry = calculateConstructAsymmetry(
            pillarScores,
            finalGateResult.excludedMarkers ?? [],
            { contributorCounts: pillarContributorCounts }
          );
          setReasoningProgress('generating');
          if (__DEV__) console.log('=== [3] Generating reasoning (post-scoring cooldown) ===');
          await new Promise((r) => setTimeout(r, AI_REASONING_POST_SCORING_COOLDOWN_MS));
          if (__DEV__) console.log('=== [3] Generating reasoning (request) ===');
          const slowTimer = setTimeout(() => setReasoningProgress('slow'), 10_000);
          const verySlowTimer = setTimeout(() => setReasoningProgress('very_slow'), 30_000);
          const reasoningStartedAt = Date.now();
          const reasoning = await generateAIReasoningSafe(
            pillarScores,
            {
              1: scenarioScoresRef.current[1],
              2: scenarioScoresRef.current[2],
              3: scenarioScoresRef.current[3],
            },
            finalMessages,
            finalGateResult.weightedScore,
            finalGateResult.pass,
            finalGateResult.excludedMarkers ?? [],
            {
              commitmentThresholdInconsistency,
              onOuterRetry: (n) => setReasoningProgress(n >= 2 ? 'very_slow' : 'slow'),
            }
          );
          const elapsedReasoningMs = Date.now() - reasoningStartedAt;
          const failureKind = (reasoning as { _failureKind?: string })._failureKind;
          const reasoningPending = !!(reasoning as { _reasoningPending?: boolean })._reasoningPending;
          setReasoningProgress(reasoningPending ? 'failed' : 'done');
          clearTimeout(slowTimer);
          clearTimeout(verySlowTimer);
          if (userId) {
            const r = getSessionLogRuntime();
            writeSessionLog({
              userId,
              attemptId: r.attemptId,
              eventType: 'ai_reasoning_complete',
              eventData: {
                attempt_id: r.attemptId ?? interviewSessionAttemptIdRef.current ?? null,
                elapsed_ms: elapsedReasoningMs,
                reasoning_pending: reasoningPending,
                failure_kind: failureKind ?? null,
                last_error: (reasoning as { _error?: string })._error ?? null,
                outer_attempts: (reasoning as { _outerAttempts?: number })._outerAttempts ?? null,
                is_client_request_timeout:
                  (reasoning as { _isClientRequestTimeout?: boolean })._isClientRequestTimeout ?? null,
                is_browser_level_network_failure:
                  (reasoning as { _isBrowserLevelNetworkFailure?: boolean })._isBrowserLevelNetworkFailure ?? null,
                post_scoring_cooldown_ms: AI_REASONING_POST_SCORING_COOLDOWN_MS,
              },
              platform: r.platform,
            });
          }
          await remoteLog('[4] Reasoning generated', {
            reasoningKeys: reasoning ? Object.keys(reasoning) : [],
            reasoningPending,
            elapsed_ms: elapsedReasoningMs,
            failure_kind: failureKind ?? null,
            lastError: (reasoning as { _error?: string })._error ?? null,
            outer_attempts: (reasoning as { _outerAttempts?: number })._outerAttempts ?? null,
            is_client_request_timeout: (reasoning as { _isClientRequestTimeout?: boolean })
              ._isClientRequestTimeout,
            is_browser_level_network_failure: (reasoning as { _isBrowserLevelNetworkFailure?: boolean })
              ._isBrowserLevelNetworkFailure,
            is_request_timeout: (reasoning as { _isClientRequestTimeout?: boolean })._isClientRequestTimeout,
            is_network_error: failureKind === 'network' || failureKind === 'aborted',
          });
          if (__DEV__) console.log('=== [4] Reasoning complete ===');
          const { data: userRow } = await supabase
            .from('users')
            .select('interview_attempt_count')
            .eq('id', userId)
            .single();
          attemptNum = (userRow?.interview_attempt_count ?? 0) + 1;
          insertPayload = {
            user_id: userId,
            attempt_number: attemptNum,
            completed_at: new Date().toISOString(),
            weighted_score: finalGateResult.weightedScore,
            passed: finalGateResult.pass,
            gate_fail_reason: finalGateResult.failReason,
            pillar_scores: pillarScores,
            scenario_1_scores: scenarioScoresRef.current[1]
              ? {
                  pillarScores: scenarioScoresRef.current[1].pillarScores,
                  pillarConfidence: scenarioScoresRef.current[1].pillarConfidence,
                  keyEvidence: scenarioScoresRef.current[1].keyEvidence,
                  scenarioName: scenarioScoresRef.current[1].scenarioName,
                }
              : null,
            scenario_2_scores: scenarioScoresRef.current[2]
              ? {
                  pillarScores: scenarioScoresRef.current[2].pillarScores,
                  pillarConfidence: scenarioScoresRef.current[2].pillarConfidence,
                  keyEvidence: scenarioScoresRef.current[2].keyEvidence,
                  scenarioName: scenarioScoresRef.current[2].scenarioName,
                }
              : null,
            scenario_3_scores: scenarioScoresRef.current[3]
              ? {
                  pillarScores: scenarioScoresRef.current[3].pillarScores,
                  pillarConfidence: scenarioScoresRef.current[3].pillarConfidence,
                  keyEvidence: scenarioScoresRef.current[3].keyEvidence,
                  scenarioName: scenarioScoresRef.current[3].scenarioName,
                }
              : null,
            transcript: finalMessages,
            response_timings: responseTimingsRef.current,
            probe_log: probeLogRef.current,
            score_consistency: scoreConsistency,
            construct_asymmetry: constructAsymmetry,
            language_markers: languageMarkers,
            scenario_specific_patterns: {
              moment_4_scores: moment4ForAggregate
                ? {
                    pillarScores: moment4ForAggregate.pillarScores,
                    pillarConfidence: moment4ForAggregate.pillarConfidence,
                    keyEvidence: moment4ForAggregate.keyEvidence,
                    summary: moment4ForAggregate.summary,
                    specificity: moment4ForAggregate.specificity,
                    momentName: moment4ForAggregate.momentName,
                  }
                : null,
              moment_5_scores: null,
            },
            reasoning_pending: reasoningPending,
            ai_reasoning: reasoningPending
              ? {
                  _reasoningPending: true,
                  pillar_scores: pillarScores,
                  weighted_score: finalGateResult.weightedScore,
                  passed: finalGateResult.pass,
                  last_error: (reasoning as { _error?: string })._error ?? null,
                  note:
                    'Narrative AI reasoning was not generated in this session. Scores and transcript are saved; retry from the admin panel or wait for automated processing.',
                }
              : reasoning,
          };
          const passFromGate = await buildUsersRowInterviewPassFromGate(supabase, userId, finalGateResult.pass);
          updatePayload = {
            interview_completed: true,
            ...passFromGate,
            interview_weighted_score: finalGateResult.weightedScore,
            interview_completed_at: new Date().toISOString(),
            interview_attempt_count: attemptNum,
            latest_attempt_id: null as string | null,
          };
          const slBase = {
            userId,
            attemptId: getSessionLogRuntime().attemptId,
            platform: getSessionLogRuntime().platform,
          };
          const existingAttemptId = interviewSessionAttemptIdRef.current;
          const { data: insertData } = await withRetry(
            async () => {
              if (existingAttemptId) {
                const { error: upErr } = await supabase
                  .from('interview_attempts')
                  .update(insertPayload)
                  .eq('id', existingAttemptId)
                  .eq('user_id', userId);
                if (upErr) throw new Error(upErr.message);
                return { data: { id: existingAttemptId }, error: null };
              }
              const result = await supabase.from('interview_attempts').insert(insertPayload).select('id').single();
              if (result.error) throw new Error(result.error.message);
              return result;
            },
            {
              retries: 3,
              baseDelay: 3000,
              maxDelay: 15000,
              context: 'database interview_attempts insert',
              sessionLog: userId ? slBase : undefined,
            }
          );
          (updatePayload as Record<string, unknown>).latest_attempt_id = insertData?.id ?? null;
          await withRetry(
            async () => {
              const { error } = await supabase.from('users').update(updatePayload).eq('id', userId);
              if (error) throw new Error(error.message);
            },
            {
              retries: 3,
              baseDelay: 3000,
              maxDelay: 15000,
              context: 'database users update',
              sessionLog: userId ? slBase : undefined,
            }
          );
          await clearInterviewFromStorage(userId);
          const attemptId = insertData?.id ?? null;
          await remoteLog('[5] Database save result', {
            attemptId: attemptId ?? null,
            error: null,
            errorCode: null,
          });
          if (__DEV__) {
            console.log('=== [5] DB save ===', { id: attemptId ?? undefined, error: null });
          }
          if (attemptId) {
            interviewLastCommittedAttemptId = attemptId;
            assignAttemptIdForSessionLogs(attemptId);
            const rtp = getSessionLogRuntime();
            logGateAnalyticsToSession({
              base: { userId, attemptId: rtp.attemptId, platform: rtp.platform },
              gateReason: finalGateResult.reason,
              failingConstruct: finalGateResult.failingConstruct,
              failingScore: finalGateResult.failingScore,
              weightedScore: finalGateResult.weightedScore,
              pillarScores,
            });
            // Style pipeline only needs the attempt row (transcript + scores on insert). Do not wait for
            // read-replica polling; otherwise analyze-interview-text may never run when scoringVisible is false.
            void runCommunicationStylePipelineAfterSave(
              userId,
              attemptId,
              interviewSessionIdRef.current,
              { platform: rtp.platform }
            );
            if (isStandardOnboardingApplicant) {
              await saveInterviewResults(parsed, finalGateResult, userId);
              await ensureShareableReferralCodeForReferrer(userId);
              queryClient.invalidateQueries({ queryKey: ['profile', userId] });
              interviewJustCompletedInSession = true;
              await new Promise((resolve) => setTimeout(resolve, 100));
              writeSessionLog({
                userId,
                attemptId,
                eventType: 'session_complete',
                eventData: { session_correlation_id: interviewSessionIdRef.current, path: 'standard_onboarding_post_insert' },
                platform: getSessionLogRuntime().platform,
              });
              replaceWithStandardApplicantProcessingHandoffForUser(navigation, userId);
              await remoteLog('[8] standard_onboarding → PostInterview after interview_attempts insert', {
                attemptId,
              });
            } else {
              const scoringVisible = await waitForInterviewAttemptScoringReady(supabase, attemptId, {
                maxMs: 180_000,
                intervalMs: 400,
              });
              if (scoringVisible) {
                setPendingScoringSyncAttemptId(null);
                setAnalysisAttemptId(attemptId);
                await remoteLog('[6] setAnalysisAttemptId called', { id: attemptId });
                if (__DEV__) console.log('=== [6] latestAttemptId set ===', attemptId);
                interviewJustCompletedInSession = true;
                await new Promise((resolve) => setTimeout(resolve, 100));
                writeSessionLog({
                  userId,
                  attemptId,
                  eventType: 'session_complete',
                  eventData: { session_correlation_id: interviewSessionIdRef.current },
                  platform: getSessionLogRuntime().platform,
                });
                setInterviewStatus('congratulations');
                await remoteLog('[8] setInterviewStatus called', { screen: 'congratulations' });
                if (__DEV__) console.log('=== [8] Navigation complete ===');
              } else {
                await remoteLog('[WARN] Attempt row scoring fields not confirmed after extended wait — advancing anyway', {
                  attemptId,
                });
                if (__DEV__) {
                  console.warn('[Aria] Scoring row poll inconclusive; leaving preparing_results → congratulations', {
                    attemptId,
                  });
                }
                setPendingScoringSyncAttemptId(null);
                setAnalysisAttemptId(attemptId);
                await remoteLog('[6] setAnalysisAttemptId called', { id: attemptId, via: 'scoring_ready_fallback' });
                interviewJustCompletedInSession = true;
                await new Promise((resolve) => setTimeout(resolve, 100));
                writeSessionLog({
                  userId,
                  attemptId,
                  eventType: 'session_complete',
                  eventData: { session_correlation_id: interviewSessionIdRef.current, via: 'scoring_ready_fallback' },
                  platform: getSessionLogRuntime().platform,
                });
                setInterviewStatus('congratulations');
                await remoteLog('[8] setInterviewStatus called', { screen: 'congratulations', via: 'scoring_ready_fallback' });
              }
            }
          } else {
            await remoteLog('[ERROR] Alpha save missing attempt id after insert', {});
          }
          if (attemptId) {
            alphaSaveOk = true;
          }
        } catch (err) {
          if (userId) {
            logSupabaseWriteFailed({
              userId,
              attemptId: getSessionLogRuntime().attemptId,
              platform: getSessionLogRuntime().platform,
              table: 'interview_attempts / users',
              operation: 'alpha_completion_save',
              errorMessage: err instanceof Error ? err.message : String(err),
            });
          }
          await remoteLog('[ERROR] Completion handler threw', {
            message: err instanceof Error ? err.message : String(err),
            name: err instanceof Error ? err.name : 'unknown',
            stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
          });
          if (__DEV__) {
            console.error('=== [4] Alpha save failed ===', err);
          }
          setAnalysisAttemptId(null);
          setPendingScoringSyncAttemptId(null);
          interviewLastCommittedAttemptId = null;
          const saved = await loadInterviewFromStorage(userId);
          if (saved && insertPayload != null && updatePayload != null) {
            await saveInterviewProgress(userId, {
              ...saved,
              pendingDatabaseSave: true,
              saveFailedAt: new Date().toISOString(),
              pendingAttemptPayload: { insert: insertPayload, update: { ...updatePayload, latest_attempt_id: null }, attemptNum },
            });
          }
          await saveInterviewResults(parsed, gateResult, userId);
        }
        if (!alphaSaveOk) {
          setInterviewStatus('congratulations');
          setStatus('results');
          return;
        }
      } else {
        const deferredForHolistic = interviewSessionAttemptIdRef.current;
        if (deferredForHolistic && isStandardOnboardingApplicant) {
          const { error: attErr } = await supabase
            .from('interview_attempts')
            .update({
              completed_at: new Date().toISOString(),
              weighted_score: gateResult.weightedScore,
              passed: gateResult.pass,
              gate_fail_reason: gateResult.failReason ?? null,
              pillar_scores: parsed.pillarScores ?? null,
              scoring_deferred: false,
            })
            .eq('id', deferredForHolistic)
            .eq('user_id', userId!);
          if (attErr) {
            void remoteLog('[STANDARD] client_holistic_interview_attempts_update_failed', {
              attemptId: deferredForHolistic,
              message: attErr.message,
            });
            if (__DEV__) console.error('interview_attempts update (client holistic fallback)', attErr);
          } else {
            void remoteLog('[STANDARD] client_holistic_saved_to_interview_attempts', {
              attemptId: deferredForHolistic,
              pass: gateResult.pass,
            });
          }
        }
        await saveInterviewResults(parsed, gateResult, userId);
        if (userId) {
          const r = getSessionLogRuntime();
          logGateAnalyticsToSession({
            base: { userId, attemptId: r.attemptId, platform: r.platform },
            gateReason: gateResult.reason,
            failingConstruct: gateResult.failingConstruct,
            failingScore: gateResult.failingScore,
            weightedScore: gateResult.weightedScore,
            pillarScores: parsed.pillarScores ?? {},
          });
          writeSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'session_complete',
            eventData: { session_correlation_id: interviewSessionIdRef.current, path: 'non_alpha_results' },
            platform: r.platform,
          });
        }
        if (isStandardOnboardingApplicant) {
          await ensureShareableReferralCodeForReferrer(userId!);
          if (!ALPHA_MODE) {
            queryClient.invalidateQueries({ queryKey: ['profile', userId] });
          }
          replaceWithStandardApplicantProcessingHandoffForUser(navigation, userId);
          setStatus('results');
        } else {
          setInterviewStatus('congratulations');
        }
      }
      setStatus('results');
    } catch (err) {
      await remoteLog('[ERROR] scoreInterview threw', {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : 'unknown',
        stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
      });
      if (__DEV__) console.error('=== COMPLETION ERROR ===', err);
      const weightedMinErr = await resolveWeightedPassMinAfterReferralFulfillment(userId);
      const fallbackResults: InterviewResults = {
        pillarScores: { ...FALLBACK_MARKER_SCORES_MID },
        keyEvidence: {},
        narrativeCoherence: 'moderate',
        behavioralSpecificity: 'moderate',
        notableInconsistencies: [],
        interviewSummary: 'A grounded spoken profile. See individual construct scores for detail.',
        gateResult: computeGateResult({ ...FALLBACK_MARKER_SCORES_MID }, null, {
          weightedPassMin: weightedMinErr,
        }),
      };
      setResults(fallbackResults);
      if (isOnboardingFlow) {
        await profileRepository.upsertProfile(userId, {
          applicationStatus: 'under_review',
          onboardingStage: 'complete',
        });
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }
      await saveInterviewResults(fallbackResults, fallbackResults.gateResult!, userId);
      const standardCatch =
        isOnboardingFlow && !!userId && !!profile && !profile.isAlphaTester && !isAdminConsoleAccount;
      if (standardCatch) {
        await ensureShareableReferralCodeForReferrer(userId);
        replaceWithStandardApplicantProcessingHandoffForUser(navigation, userId);
        setStatus('results');
        return;
      }
      setInterviewStatus('congratulations');
      setStatus('results');
    }
  }, [
    typologyContext,
    route.name,
    userId,
    navigation,
    queryClient,
    saveInterviewResults,
    ensureValidSession,
    scoreScenario,
    profile,
    isAdmin,
    user?.email,
  ]);

  useEffect(() => {
    if (!pendingCompletion || voiceState !== 'idle') return;
    const transcript = pendingCompletionTranscriptRef.current;
    pendingCompletionTranscriptRef.current = null;
    setPendingCompletion(false);
    if (!transcript || transcript.length === 0) return;
    setInterviewStatus('preparing_results');
    void scoreInterview(transcript);
  }, [pendingCompletion, voiceState, scoreInterview]);

  const performRetake = useCallback(async () => {
    if (!userId) return;
    if (
      interviewStatusRef.current === 'in_progress' ||
      interviewStatusRef.current === 'preparing_results'
    ) {
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'session_dropout',
        eventData: {
          dropout_point: {
            moment_number: currentInterviewMomentRef.current,
            last_question_delivered: lastQuestionTextRef.current.slice(0, 500),
          },
        },
        platform: r.platform,
      });
    }
    const { data: userData } = await supabase
      .from('users')
      .select('interview_attempt_count')
      .eq('id', userId)
      .single();
    const nextAttemptNumber = (userData?.interview_attempt_count ?? 0) + 1;
    await supabase
      .from('users')
      .update({
        interview_completed: false,
        interview_passed: null,
        interview_passed_computed: null,
        interview_passed_admin_override: null,
        interview_weighted_score: null,
        interview_completed_at: null,
        interview_last_checkpoint: 0,
        interview_attempt_count: nextAttemptNumber,
        latest_attempt_id: null,
      })
      .eq('id', userId);
    await clearInterviewFromStorage(userId);
    isInterviewCompleteRef.current = false;
    setMessages([]);
    setScenarioScores({});
    scoredScenariosRef.current = new Set();
    setClosingQuestionState({ 1: 'needed', 2: 'needed', 3: 'needed' });
    closingQuestionAskedRef.current = { 1: false, 2: false, 3: false };
    closingQuestionAnsweredRef.current = { 1: false, 2: false, 3: false };
    lastClosingQuestionScenarioRef.current = null;
    waitingForClosingAdditionRef.current = null;
    setClosingQuestionPending(false);
    setClosingQuestionScenario(null);
    lastAnsweredClosingScenarioRef.current = null;
    onboardingAutoStartRef.current = false;
    setMicError(null);
    setPreInterviewConsentAge(false);
    setPreInterviewConsentData(false);
    setStatus(route.name === 'Aria' || route.name === 'OnboardingInterview' ? 'intro' : 'intro');
    setResults(null);
    responseTimingsRef.current = [];
    probeLogRef.current = [];
    setAnalysisAttemptId(null);
    setPendingScoringSyncAttemptId(null);
    interviewLastCommittedAttemptId = null;
    setShowPostInterviewFeedback(false);
    setPostInterviewRatings({
      conversation_quality: null,
      clarity_flow: null,
      trust_accuracy: null,
    });
    setPostInterviewComments({
      conversation_quality: '',
      clarity_flow: '',
      trust_accuracy: '',
    });
    setPostInterviewGeneralFeedback('');
    setHasSubmittedPostInterviewFeedback(false);
    setInterviewStatus('not_started');
  }, [userId, route.name]);

  const handleRetake = useCallback(() => {
    const warningMessage = 'Are you sure you want to retest? You will not be able to return to this results screen after starting a new retest.';
    showConfirmDialog(
      {
        title: 'Start retest?',
        message: warningMessage,
        confirmText: 'Retest',
      },
      () => void performRetake(),
    );
  }, [performRetake]);

  /** Admin-only: full local reset + restart opening line. Does not update `users` (unlike retake). */
  const performAdminInterviewReset = useCallback(async () => {
    if (!userId || !isAdmin) {
      return;
    }
    await stopElevenLabsPlayback();
    stopElevenLabsSpeech();
    if (useMediaRecorderPath && audioRecorder.isRecording) {
      try {
        await audioRecorder.stopRecording();
      } catch {
        /* non-fatal */
      }
    }
    if (Platform.OS === 'web' && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* non-fatal */
      }
    }
    await clearInterviewFromStorage(userId);
    interviewJustCompletedInSession = false;
    isInterviewCompleteRef.current = false;
    hasResumedRef.current = false;
    setMessages([]);
    setScenarioScores({});
    scoredScenariosRef.current = new Set();
    setClosingQuestionState({ 1: 'needed', 2: 'needed', 3: 'needed' });
    closingQuestionAskedRef.current = { 1: false, 2: false, 3: false };
    closingQuestionAnsweredRef.current = { 1: false, 2: false, 3: false };
    lastClosingQuestionScenarioRef.current = null;
    waitingForClosingAdditionRef.current = null;
    setClosingQuestionPending(false);
    setClosingQuestionScenario(null);
    lastAnsweredClosingScenarioRef.current = null;
    onboardingAutoStartRef.current = false;
    setMicError(null);
    setMicWarning(null);
    setResults(null);
    responseTimingsRef.current = [];
    probeLogRef.current = [];
    setAnalysisAttemptId(null);
    setPendingScoringSyncAttemptId(null);
    interviewLastCommittedAttemptId = null;
    setShowPostInterviewFeedback(false);
    setPostInterviewRatings({
      conversation_quality: null,
      clarity_flow: null,
      trust_accuracy: null,
    });
    setPostInterviewComments({
      conversation_quality: '',
      clarity_flow: '',
      trust_accuracy: '',
    });
    setPostInterviewGeneralFeedback('');
    setHasSubmittedPostInterviewFeedback(false);
    setHighestScenarioReached(1);
    currentScenarioRef.current = 1;
    setStageResults([]);
    setTouchedConstructs([]);
    setExchangeCount(0);
    setIsWaiting(false);
    timingRef.current = { questionEndTime: null, recordingStartTime: null, recordingEndTime: null };
    lastQuestionTextRef.current = '';
    transcriptAtReleaseRef.current = '';
    setCurrentTranscript('');
    setTypedAnswer('');
    setUsedPersonalExamples(false);
    setPendingCompletion(false);
    pendingCompletionTranscriptRef.current = null;
    waitingMessageIdRef.current = null;
    committedScenarioRef.current = null;
    setInterviewUiPhase('pre_scenario');
    setReferenceCardScenario(null);
    setReferenceCardPrompt(null);
    setScenarioIntroTtsPlaying(false);
    setTTSFallbackActive(false);
    isSpeakingRef.current = false;
    setVoiceState('idle');
    resetInterviewProgressRefs();
    if (Platform.OS === 'web') {
      audioRecorder.resetWebMicInputFallbackState();
    }
    void startInterview({ fromUserGesture: true });
  }, [userId, isAdmin, useMediaRecorderPath, audioRecorder, resetInterviewProgressRefs, startInterview]);

  const handleAdminResetInterview = useCallback(() => {
    const warningMessage =
      'Reset the entire interview from the beginning? Local progress and transcript will be cleared (admin only; does not change your account retake counters).';
    showConfirmDialog(
      {
        title: 'Reset interview?',
        message: warningMessage,
        confirmText: 'Reset',
      },
      () => void performAdminInterviewReset(),
    );
  }, [performAdminInterviewReset]);

  const showFeedbackNotice = useCallback((title: string, message: string) => {
    showSimpleAlert(title, message);
  }, []);

  const handleSubmitPostInterviewFeedback = useCallback(async () => {
    if (!userId) return;
    const wasEditing = hasSubmittedPostInterviewFeedback;
    const missingRating = POST_INTERVIEW_FEEDBACK_QUESTIONS.find(({ id }) => postInterviewRatings[id] == null);
    if (missingRating) {
      const msg = 'Please provide a rating (1-10) for all three questions before submitting.';
      setPostInterviewFeedbackError(msg);
      showFeedbackNotice('Feedback', msg);
      return;
    }
    setPostInterviewFeedbackError(null);
    try {
      let attemptId = analysisAttemptId;
      if (!attemptId) {
        const { data: userData } = await supabase
          .from('users')
          .select('latest_attempt_id')
          .eq('id', userId)
          .maybeSingle();
        attemptId = (userData?.latest_attempt_id as string | null | undefined) ?? null;
      }
      if (!attemptId) {
        Alert.alert('Feedback', 'We could not find the latest interview record yet. Please try again in a moment.');
        return;
      }
      const perConstructRatings: Record<string, { rating?: number; comment?: string }> = {};
      for (const q of POST_INTERVIEW_FEEDBACK_QUESTIONS) {
        const rating = postInterviewRatings[q.id];
        const comment = postInterviewComments[q.id].trim();
        perConstructRatings[q.id] = {
          rating: rating ?? undefined,
          comment: comment.length > 0 ? comment : undefined,
        };
      }
      const additionalFeedback = postInterviewGeneralFeedback.trim();
      if (additionalFeedback.length > 0) {
        perConstructRatings.other_feedback = { comment: additionalFeedback };
      }
      const total = POST_INTERVIEW_FEEDBACK_QUESTIONS.reduce((sum, { id }) => sum + (postInterviewRatings[id] ?? 0), 0);
      const overallRating = Math.round(total / POST_INTERVIEW_FEEDBACK_QUESTIONS.length);
      const { error } = await supabase
        .from('interview_attempts')
        .update({
          user_analysis_rating: overallRating,
          user_analysis_comment: additionalFeedback.length > 0 ? additionalFeedback : null,
          per_construct_ratings: perConstructRatings,
          user_analysis_submitted_at: new Date().toISOString(),
        })
        .eq('id', attemptId);
      if (error) throw new Error(error.message);
      setPostInterviewFeedbackError(null);
      setHasSubmittedPostInterviewFeedback(true);
      setShowPostInterviewFeedback(false);
      showFeedbackNotice('Thank you', wasEditing ? 'Your feedback was updated.' : 'Your feedback was submitted.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not submit feedback.';
      showFeedbackNotice('Feedback error', msg);
    }
  }, [analysisAttemptId, hasSubmittedPostInterviewFeedback, postInterviewComments, postInterviewGeneralFeedback, postInterviewRatings, showFeedbackNotice, userId]);

  useEffect(() => {
    if (!userId || !(interviewStatus === 'under_review' || interviewStatus === 'congratulations')) return;
    let cancelled = false;
    (async () => {
      try {
        let attemptId = analysisAttemptId;
        if (!attemptId) {
          const { data: userData } = await supabase
            .from('users')
            .select('latest_attempt_id')
            .eq('id', userId)
            .maybeSingle();
          attemptId = (userData?.latest_attempt_id as string | null | undefined) ?? null;
        }
        if (!attemptId || cancelled) {
          if (!cancelled) setHasSubmittedPostInterviewFeedback(false);
          return;
        }
        const { data } = await supabase
          .from('interview_attempts')
          .select('user_analysis_comment, per_construct_ratings')
          .eq('id', attemptId)
          .maybeSingle();
        if (cancelled || !data) return;

        const per = parseJsonObject(data.per_construct_ratings) ?? {};
        const nextRatings: Record<PostInterviewFeedbackKey, number | null> = {
          conversation_quality: null,
          clarity_flow: null,
          trust_accuracy: null,
        };
        const nextComments: Record<PostInterviewFeedbackKey, string> = {
          conversation_quality: '',
          clarity_flow: '',
          trust_accuracy: '',
        };

        for (const q of POST_INTERVIEW_FEEDBACK_QUESTIONS) {
          const row = parseJsonObject(per[q.id]);
          const rawRating = row?.rating;
          const n = typeof rawRating === 'number' ? rawRating : Number(rawRating);
          nextRatings[q.id] = Number.isFinite(n) ? Math.min(10, Math.max(1, Math.round(n))) : null;
          nextComments[q.id] = typeof row?.comment === 'string' ? row.comment : '';
        }

        const other = parseJsonObject(per.other_feedback);
        const otherComment = typeof other?.comment === 'string' ? other.comment : '';
        const overallComment = typeof data.user_analysis_comment === 'string' ? data.user_analysis_comment : '';

        setPostInterviewRatings(nextRatings);
        setPostInterviewComments(nextComments);
        setPostInterviewGeneralFeedback(otherComment || overallComment);
        setHasSubmittedPostInterviewFeedback(POST_INTERVIEW_FEEDBACK_QUESTIONS.every(({ id }) => nextRatings[id] != null));
      } catch {
        if (!cancelled) setHasSubmittedPostInterviewFeedback(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisAttemptId, interviewStatus, userId]);

  const adminInterviewTopBar = isAdmin ? (
    <View style={styles.adminTopBarRow}>
      {ALPHA_MODE ? (
        <TouchableOpacity
          style={styles.adminBarButton}
          onPress={() => setShowAdminPanel(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.adminPanelButtonText}>◆ Panel</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={styles.adminBarButtonReset}
        onPress={handleAdminResetInterview}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Reset interview from start"
      >
        <Text style={styles.adminResetButtonText}>Reset</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.adminBarButtonLogout}
        onPress={handleInterviewSignOut}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Text style={styles.adminLogoutButtonText}>Log out</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  // ── RENDER ──
  if (sessionExpired) {
    return (
      <View style={styles.sessionExpiredOverlay}>
        <Text style={styles.sessionExpiredTitle}>Your session timed out.</Text>
        <Text style={styles.sessionExpiredBody}>
          Your progress has been saved. Sign back in and your interview will continue from where you left off.
        </Text>
        <Pressable
          onPress={async () => {
            const { error } = await supabase.auth.refreshSession();
            if (!error) setSessionExpired(false);
            else {
              await signOut();
            }
          }}
          style={styles.sessionExpiredButton}
        >
          <Text style={styles.sessionExpiredButtonLabel}>Continue →</Text>
        </Pressable>
      </View>
    );
  }
  if (interviewStatus === 'loading') {
    return (
      <SafeAreaContainer>
        <View style={[styles.container, { minHeight: '100%', justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <Text style={[styles.introNote, { letterSpacing: 2, textTransform: 'uppercase' }]}>Loading...</Text>
          <Text style={[styles.introHint, { marginTop: 16, textAlign: 'center' }]}>
            If this doesn't change, try refreshing the page.
          </Text>
        </View>
      </SafeAreaContainer>
    );
  }
  if (interviewStatus === 'preparing_results') {
    return (
      <SafeAreaContainer>
        <View style={[styles.container, { flex: 1, backgroundColor: '#05060D', alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
          <FlameOrb state="idle" size={80} />
          <Text
            style={{
              fontFamily: Platform.OS === 'web' ? undefined : 'Jost_300Light',
              fontSize: 10,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#3D5470',
              marginTop: 24,
            }}
          >
            Preparing your results
          </Text>
        </View>
      </SafeAreaContainer>
    );
  }
  if (resumeLoadingVisible) {
    return (
      <SafeAreaContainer style={{ flex: 1, backgroundColor: '#05060D' }}>
        <View style={[styles.container, { flex: 1, backgroundColor: '#05060D', alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
          <ActivityIndicator size="small" color="#7A9ABE" />
          <Text
            style={{
              fontFamily: Platform.OS === 'web' ? undefined : 'Jost_300Light',
              fontSize: 12,
              letterSpacing: 1.5,
              color: '#C8E4FF',
              marginTop: 14,
            }}
          >
            Resuming your interview...
          </Text>
        </View>
      </SafeAreaContainer>
    );
  }
  // Admin panel is manual-only (button-triggered), never a post-interview destination.
  if (ALPHA_MODE && shouldShowAdminPanel) {
    return (
      <AdminInterviewDashboard
        onClose={() => {
          setShowAdminPanel(false);
        }}
      />
    );
  }
  if (ALPHA_MODE && interviewStatus === 'analysis') {
    return (
      <InterviewAnalysisScreen
        attemptId={analysisAttemptId}
        onRetake={handleRetake}
        isAdmin={isAdmin}
        alphaMode={ALPHA_MODE}
      />
    );
  }
  if (interviewStatus === 'under_review' || interviewStatus === 'congratulations') {
    return (
      <SafeAreaContainer style={{ backgroundColor: '#05060D' }}>
        <ScrollView style={[styles.container, { backgroundColor: '#05060D' }]} contentContainerStyle={{ minHeight: '100%', padding: 0 }}>
          <View
            style={{
              width: '100%',
              minHeight: '100%',
              backgroundColor: '#05060D',
              borderWidth: 0,
              borderRadius: 0,
              padding: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={[styles.introNote, { color: colors.warning, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 0 }]}>◆ Thank you</Text>
              <TouchableOpacity
                onPress={handleInterviewSignOut}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Log out"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: 'rgba(91,168,232,0.35)',
                  backgroundColor: 'rgba(91,168,232,0.08)',
                }}
              >
                <Ionicons name="log-out-outline" size={14} color="#8EC6FF" />
                <Text style={{ color: '#8EC6FF', fontSize: 12, fontWeight: '600', letterSpacing: 0.6 }}>Log out</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.introTitle, { marginBottom: 10, color: '#F4F8FC', textAlign: 'left', fontWeight: '700' }]}>
              You've finished — thank you for going through this with me.
            </Text>
            <Text style={[styles.introHint, { textAlign: 'left' }]}>
              We'll have your results ready soon.
            </Text>

            {ALPHA_MODE && isAdminUser ? (
              <Pressable
                onPress={() => setShowAdminPanel(true)}
                accessibilityRole="button"
                accessibilityLabel="Open admin panel"
                style={({ pressed }) => [
                  styles.retakeButtonUnderReview,
                  {
                    marginTop: 16,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: 'rgba(91,168,232,0.12)',
                    borderColor: 'rgba(107,185,255,0.45)',
                    borderWidth: 1,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    letterSpacing: 1,
                    color: '#8EC6FF',
                    textAlign: 'center',
                  }}
                >
                  ◆ Admin panel
                </Text>
              </Pressable>
            ) : null}

            <Text style={[styles.introHint, { textAlign: 'left', marginTop: 16, marginBottom: 8, color: '#D6E6F7' }]}>
              Retaking the interview will not replace these scores.
            </Text>
            <View style={{ width: '100%', flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 10 }}>
              <Pressable
                onPress={handleRetake}
                style={({ pressed }) => [
                  styles.retakeButtonUnderReview,
                  {
                    flex: 1,
                    opacity: pressed ? 0.82 : 1,
                    marginTop: 0,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: '#1E6FD9',
                    borderColor: 'rgba(107,185,255,0.8)',
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[styles.retakeButtonUnderReviewText, { fontSize: 14, fontWeight: '700', letterSpacing: 1.1, color: '#F4F8FC' }]}>Retest</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPostInterviewFeedbackError(null);
                  setShowPostInterviewFeedback(true);
                }}
                style={({ pressed }) => [
                  styles.retakeButtonUnderReview,
                  {
                    flex: 1,
                    opacity: pressed ? 0.82 : 1,
                    marginTop: 0,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: '#123459',
                    borderColor: 'rgba(107,185,255,0.55)',
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[styles.retakeButtonUnderReviewText, { fontSize: 14, fontWeight: '700', letterSpacing: 1.1, color: '#E7F1FB' }]}>
                  {hasSubmittedPostInterviewFeedback ? 'Edit feedback' : 'Feedback'}
                </Text>
              </Pressable>
            </View>

            <View style={{ width: '100%', marginTop: 16 }}>
              <Text style={[styles.introHint, { textAlign: 'left', marginBottom: 12, color: '#D6E6F7' }]}>
                You may review your interview results below. Please use the feedback button to let me know if you feel this information is a fair assessment of you.
              </Text>
              <AdminAttemptTabsView attemptId={analysisAttemptId} userId={userId} showFeedbackTab={false} />
              <UserCommunicationStyleSection userId={userId} />
            </View>
          </View>
        </ScrollView>
        <Modal
          visible={showPostInterviewFeedback}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setPostInterviewFeedbackError(null);
            setShowPostInterviewFeedback(false);
          }}
        >
          <View style={styles.feedbackModalBackdrop}>
            <View style={styles.feedbackModalCard}>
              <Text style={styles.feedbackModalTitle}>Interview Feedback</Text>
              <Text style={styles.feedbackModalHint}>Rate each question from 1-10. 1 = completely disagree, 10 = completely agree.</Text>
              {postInterviewFeedbackError ? <Text style={styles.feedbackModalError}>{postInterviewFeedbackError}</Text> : null}
              <ScrollView style={styles.feedbackModalScroll} contentContainerStyle={{ paddingBottom: 8 }}>
                {POST_INTERVIEW_FEEDBACK_QUESTIONS.map((q) => (
                  <View key={q.id} style={styles.feedbackQuestionBlock}>
                    <Text style={styles.feedbackQuestionTitle}>{q.title}</Text>
                    <Text style={styles.feedbackQuestionPrompt}>{q.prompt}</Text>
                    <View style={styles.feedbackScaleRow}>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => {
                        const active = postInterviewRatings[q.id] === value;
                        return (
                          <TouchableOpacity
                            key={`${q.id}-${value}`}
                            style={[styles.feedbackScalePill, active && styles.feedbackScalePillActive]}
                            onPress={() => {
                              if (postInterviewFeedbackError) setPostInterviewFeedbackError(null);
                              setPostInterviewRatings((prev) => ({
                                ...prev,
                                [q.id]: value,
                              }));
                            }}
                          >
                            <Text style={[styles.feedbackScalePillText, active && styles.feedbackScalePillTextActive]}>{value}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TextInput
                      value={postInterviewComments[q.id]}
                      onChangeText={(text) =>
                        setPostInterviewComments((prev) => ({
                          ...prev,
                          [q.id]: text,
                        }))
                      }
                      placeholder="Optional comment"
                      placeholderTextColor="#6B7280"
                      multiline
                      style={styles.feedbackCommentInput}
                    />
                  </View>
                ))}
                <View style={styles.feedbackQuestionBlock}>
                  <Text style={styles.feedbackQuestionTitle}>Additional Feedback</Text>
                  <Text style={styles.feedbackQuestionPrompt}>Is there any other feedback you would like to give?</Text>
                  <TextInput
                    value={postInterviewGeneralFeedback}
                    onChangeText={setPostInterviewGeneralFeedback}
                    placeholder="Optional"
                    placeholderTextColor="#6B7280"
                    multiline
                    style={styles.feedbackCommentInput}
                  />
                </View>
              </ScrollView>
              <View style={styles.feedbackModalActions}>
                <TouchableOpacity
                  onPress={() => {
                    setPostInterviewFeedbackError(null);
                    setShowPostInterviewFeedback(false);
                  }}
                  style={[styles.feedbackActionButton, styles.feedbackActionCancel]}
                >
                  <Text style={styles.feedbackActionCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmitPostInterviewFeedback}
                  style={[styles.feedbackActionButton, styles.feedbackActionSubmit]}
                >
                  <Text style={styles.feedbackActionSubmitText}>{hasSubmittedPostInterviewFeedback ? 'Resubmit' : 'Submit'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaContainer>
    );
  }

  if (status === 'starting_interview') {
    const showMicRetry = !!micError || micPermission === 'denied';
    return (
      <SafeAreaContainer style={{ position: 'relative', backgroundColor: '#05060D' }}>
        {adminInterviewTopBar}
        <TouchableOpacity
          style={styles.introLogoutButton}
          onPress={handleInterviewSignOut}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={16} color="#5BA8E8" />
          <Text style={styles.introLogoutButtonText}>Log out</Text>
        </TouchableOpacity>
        <View
          style={[
            styles.container,
            {
              flex: 1,
              minHeight: '100%',
              backgroundColor: '#05060D',
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 24,
              paddingVertical: 32,
            },
          ]}
        >
          <FlameOrb state="idle" size={72} />
          <Text
            style={[
              styles.introNote,
              { marginTop: 24, textAlign: 'center', color: '#7A9ABE', letterSpacing: 2, textTransform: 'uppercase' },
            ]}
          >
            {showMicRetry ? 'Microphone needed' : 'Starting interview'}
          </Text>
          {!showMicRetry ? (
            <Text style={[styles.introHint, { marginTop: 12, textAlign: 'center', maxWidth: 320 }]}>
              Requesting microphone access and loading your session…
            </Text>
          ) : null}
          {micError ? (
            <View style={[styles.micErrorBlock, { alignSelf: 'stretch', maxWidth: 400, marginTop: 16 }]}>
              <Text style={styles.micErrorText}>{micError}</Text>
            </View>
          ) : null}
          {showMicRetry ? (
            <Button
              title="Try again"
              onPress={() => {
                onboardingAutoStartRef.current = false;
                setMicError(null);
                void startInterview({ fromUserGesture: true });
              }}
              style={StyleSheet.flatten([styles.introButton, { marginTop: 24, alignSelf: 'stretch' as const, maxWidth: 360 }])}
            />
          ) : null}
        </View>
        {Platform.OS === 'web' &&
        webSpeechShouldDeferToUserGesture() &&
        !mobileWebTapToBeginDone &&
        status === 'starting_interview' ? (
          <Pressable
            style={styles.mobileWebTapToBeginOverlay}
            onPress={() => handleMobileWebTapToBegin(true)}
            accessibilityRole="button"
            accessibilityLabel="Tap the screen to begin"
          >
            <Text style={styles.mobileWebTapToBeginTitle}>Tap the screen to begin</Text>
            <Text style={styles.mobileWebTapToBeginSubtitle}>
              One quick tap unlocks audio for the interviewer on this device.
            </Text>
          </Pressable>
        ) : null}
        {Platform.OS === 'web' &&
        !webSpeechShouldDeferToUserGesture() &&
        webDesktopAwaitingStartOverlay &&
        status === 'starting_interview' &&
        interviewStatus === 'not_started' ? (
          <Pressable
            style={styles.mobileWebTapToBeginOverlay}
            accessibilityRole="button"
            accessibilityLabel="Click to begin the interview audio"
            onPress={() => {
              unlockWebAudioForAutoplay();
              primeHtmlAudioForMobileTtsFromMicGesture();
              onboardingAutoStartRef.current = true;
              setWebDesktopAwaitingStartOverlay(false);
              void startInterview({ fromUserGesture: true });
            }}
          >
            <Text style={styles.mobileWebTapToBeginTitle}>Tap to begin</Text>
            <Text style={styles.mobileWebTapToBeginSubtitle}>
              Tap once to unlock audio for the interviewer (required by your browser after opening this page).
            </Text>
          </Pressable>
        ) : null}
      </SafeAreaContainer>
    );
  }

  if (status === 'intro') {
    const attemptReady = !userId || isAdmin || interviewAttemptBootstrap === 'ready';
    const preInterviewReady =
      preInterviewConsentAge && preInterviewConsentData && !micError && attemptReady;
    const openPrivacy = () => {
      void Linking.openURL(LEGAL_PRIVACY_POLICY_URL);
    };
    const openTerms = () => {
      void Linking.openURL(LEGAL_TERMS_OF_SERVICE_URL);
    };
    const whatToExpectItems = [
      'The interview takes approximately 20 minutes — three scenarios and one personal question.',
      'This is a conversation, not a test. There are no right or wrong answers.',
      'We recommend you find a private area for this interview so you are not distracted.',
      'You can stop at any time. Progress is saved from the last completed scenario if you exit early.',
    ];
    const dataPrivacyItems = [
      'This conversation will be recorded and processed by AI.',
      'Your voice is analyzed for communication style alongside your words.',
      'Your responses are stored and used to generate your profile and match you with others.',
    ];
    return (
      <SafeAreaContainer style={{ position: 'relative', flex: 1, backgroundColor: '#05060D' }}>
        {adminInterviewTopBar}
        <TouchableOpacity
          style={styles.introLogoutButton}
          onPress={handleInterviewSignOut}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={16} color="#5BA8E8" />
          <Text style={styles.introLogoutButtonText}>Log out</Text>
        </TouchableOpacity>
        <ScrollView
          style={[styles.container, { backgroundColor: '#05060D' }]}
          contentContainerStyle={styles.preInterviewScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.preInterviewLogoWrap}>
            <FlameOrb state="idle" size={72} minimalGlow />
          </View>
          <Text style={styles.preInterviewMainTitle}>Before we begin</Text>
          <Text style={styles.preInterviewSubtitle}>A few things to know before your interview starts.</Text>

          <Text style={styles.preInterviewSectionHeading}>What to expect</Text>
          {whatToExpectItems.map((line) => (
            <View key={line} style={styles.preInterviewBulletRow}>
              <View style={styles.preInterviewBulletDot} />
              <Text style={styles.preInterviewBulletText}>{line}</Text>
            </View>
          ))}

          <View style={styles.headphoneRecommendCard} accessibilityRole="summary">
            <Ionicons name="headset-outline" size={28} color="#5BA8E8" style={styles.headphoneRecommendIcon} />
            <View style={styles.headphoneRecommendTextCol}>
              <Text style={styles.headphoneRecommendTitle}>
                For the best experience, use headphones with a microphone. This helps Amoraea hear you clearly and reduces
                background noise.
              </Text>
              <Text style={styles.headphoneRecommendSub}>
                No headphones? The interview still works — just find a quiet space.
              </Text>
            </View>
          </View>

          <Text style={[styles.preInterviewSectionHeading, styles.preInterviewSectionHeadingSpaced]}>Data & privacy</Text>
          {dataPrivacyItems.map((line) => (
            <View key={line} style={styles.preInterviewBulletRow}>
              <View style={styles.preInterviewBulletDot} />
              <Text style={styles.preInterviewBulletText}>{line}</Text>
            </View>
          ))}

          <View style={styles.preInterviewConsentCard}>
            <Pressable
              style={styles.preInterviewCheckboxRow}
              onPress={() => setPreInterviewConsentAge((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: preInterviewConsentAge }}
            >
              <View
                style={[
                  styles.preInterviewCheckboxBox,
                  preInterviewConsentAge && styles.preInterviewCheckboxBoxChecked,
                ]}
              >
                {preInterviewConsentAge ? <Ionicons name="checkmark" size={18} color="#EEF6FF" /> : null}
              </View>
              <Text style={styles.preInterviewCheckboxLabel}>I confirm I am 18 years of age or older.</Text>
            </Pressable>
            <Pressable
              style={styles.preInterviewCheckboxRow}
              onPress={() => setPreInterviewConsentData((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: preInterviewConsentData }}
            >
              <View
                style={[
                  styles.preInterviewCheckboxBox,
                  preInterviewConsentData && styles.preInterviewCheckboxBoxChecked,
                ]}
              >
                {preInterviewConsentData ? <Ionicons name="checkmark" size={18} color="#EEF6FF" /> : null}
              </View>
              <Text style={styles.preInterviewCheckboxLabel}>
                I understand and agree to the recording, processing, and use of my interview as described in Data & privacy
                above.
              </Text>
            </Pressable>
          </View>

          {micError ? (
            <View style={styles.micErrorBlock}>
              <Text style={styles.micErrorText}>{micError}</Text>
            </View>
          ) : null}
          {micWarning ? (
            <View style={styles.micWarningBlock}>
              <Text style={styles.micWarningText}>{micWarning}</Text>
            </View>
          ) : null}
          {userId && !isAdmin && interviewAttemptBootstrap === 'failed' ? (
            <View style={[styles.micErrorBlock, { marginTop: 12 }]}>
              <Text style={styles.micErrorText}>
                We could not start your interview session. Check your connection and refresh the page.
              </Text>
            </View>
          ) : null}

          <Button
            title={
              interviewAttemptBootstrap === 'loading' && userId && !isAdmin
                ? 'Preparing session…'
                : interviewAttemptBootstrap === 'failed' && userId && !isAdmin
                  ? 'Session unavailable'
                  : 'Begin interview'
            }
            onPress={() => void startInterview({ fromUserGesture: true })}
            disabled={!preInterviewReady}
            style={styles.preInterviewBeginButton}
          />

        </ScrollView>
      </SafeAreaContainer>
    );
  }

  // Active interview — chat always visible; scoring and results as inline panels below
  const inputDisabled = status === 'scoring' || status === 'results';
  const PILLAR_META: Record<string, { name: string; color: string }> = {
    mentalizing: { name: INTERVIEW_MARKER_LABELS.mentalizing, color: colors.error },
    accountability: { name: INTERVIEW_MARKER_LABELS.accountability, color: colors.success },
    contempt: { name: INTERVIEW_MARKER_LABELS.contempt, color: '#B85C5C' },
    repair: { name: INTERVIEW_MARKER_LABELS.repair, color: colors.primary },
    regulation: { name: INTERVIEW_MARKER_LABELS.regulation, color: '#8B3A5C' },
    attunement: { name: INTERVIEW_MARKER_LABELS.attunement, color: '#0D6B6B' },
    appreciation: { name: INTERVIEW_MARKER_LABELS.appreciation, color: '#2A5C5C' },
    commitment_threshold: { name: INTERVIEW_MARKER_LABELS.commitment_threshold, color: '#6B5CB8' },
  };

  const isInterviewerView = status === 'active' && !isAdmin;
  /** Web: at most one full-screen gesture overlay — identical rgba layers stack and read as “double dim” on mobile. */
  const webActiveGestureOverlayKind: WebActiveGestureOverlayKind = resolveWebActiveGestureOverlayKind({
    platformIsWeb: Platform.OS === 'web',
    status,
    webTabGestureRestoreOverlay,
    webResumeWelcomeTapPending,
    isInterviewerView,
    webDesktopPendingTtsGestureOverlay,
  });
  return (
    <SafeAreaContainer style={{ position: 'relative', backgroundColor: '#05060D' }}>
      {adminInterviewTopBar}
      <View style={[styles.activeContainer, isAdmin ? styles.adminActiveContainer : undefined]}>
        {isInterviewerView ? (
          <View style={{ flex: 1, backgroundColor: '#05060D' }}>
            <UserInterviewLayout
              flameState={
                useMediaRecorderPath && audioRecorder.isRecording ? 'recording' : voiceState
              }
              showScenarioReferenceEnabled={
                interviewUiPhase === 'scenario_active' && !scenarioIntroTtsPlaying && !!referenceCardScenario
              }
              referenceCardScenario={referenceCardScenario}
              referenceCardPrompt={referenceCardPrompt}
              ttsFallbackActive={tTSFallbackActive}
              webInsecureContextMessage={webInsecureContextMessage}
              sessionAudioHealthNotice={sessionAudioHealthNotice}
              micPermissionDenied={micPermission === 'denied'}
              isWaiting={isWaiting && voiceState === 'processing'}
              onPressStart={handlePressStart}
              onPressEnd={handlePressEnd}
              voiceState={
                useMediaRecorderPath && audioRecorder.isRecording ? 'recording' : voiceState
              }
              micError={micError}
              micWarning={micWarning}
              inputDisabled={inputDisabled}
              micToggleMode={useTapMicUi}
              onMicPress={useTapMicUi ? handleNativeOrWhisperMicPress : undefined}
              onMicPressIn={Platform.OS === 'web' ? handleWebMicPressIn : undefined}
              micLabelOverride={
                useTapMicUi
                  ? useMediaRecorderPath
                    ? audioRecorder.isRecording
                      ? 'Tap to stop'
                      : 'Tap to speak'
                    : voiceState === 'listening'
                      ? 'Tap to stop'
                      : 'Tap to speak'
                  : undefined
              }
              onExit={handleInterviewSignOut}
              micInputLevel={useMediaRecorderPath && audioRecorder.isRecording ? audioRecorder.inputMeterLevel : 0}
              micSessionRecovering={micSessionRecovering}
              micReconnectPrompt={
                micNeedsReconnect
                  ? {
                      message: 'Your microphone disconnected. Tap to reconnect.',
                      onReconnect: () => {
                        setMicNeedsReconnect(false);
                        void audioRecorder.reinitializeMicrophoneSession().then((ok) => {
                          if (!ok) setMicNeedsReconnect(true);
                        });
                      },
                    }
                  : null
              }
              lateStartRecordingCue={lateStartIdleCueVisible}
            />
          </View>
        ) : (
          <View style={styles.adminWrap}>
        {isAdmin && (status === 'results' && results?.pillarScores ? (
          <View style={[styles.stageScoresContainer, styles.adminStageScoresContainer]}>
            <Text style={[styles.stageScoresTitle, styles.adminStageScoresTitle]}>Final scores</Text>
            <View style={[styles.stageScoreCard, styles.adminStageScoreCard]}>
              <View style={styles.stageScorePillars}>
                {Object.entries(results.pillarScores).map(([id, score]) => {
                  const meta = PILLAR_META[id] ?? { name: `Pillar ${id}`, color: colors.primary };
                  return (
                    <Text key={id} style={[styles.stageScorePillar, styles.adminStageScorePillar]}>
                      {meta.name}: {score}
                    </Text>
                  );
                })}
              </View>
            </View>
          </View>
        ) : stageResults.length > 0 ? (
          <View style={[styles.stageScoresContainer, styles.adminStageScoresContainer]}>
            <Text style={[styles.stageScoresTitle, styles.adminStageScoresTitle]}>Scores so far</Text>
            {stageResults.map(({ stage, results: sr }) => (
              <View key={stage} style={[styles.stageScoreCard, styles.adminStageScoreCard]}>
                <Text style={[styles.stageScoreLabel, styles.adminStageScoreLabel]}>Stage {stage}</Text>
                <View style={styles.stageScorePillars}>
                  {sr.pillarScores && Object.entries(sr.pillarScores).map(([id, score]) => {
                    const label =
                      INTERVIEW_MARKER_LABELS[id as keyof typeof INTERVIEW_MARKER_LABELS] ?? id;
                    return (
                      <Text key={id} style={[styles.stageScorePillar, styles.adminStageScorePillar]}>
                        {label}: {score}
                      </Text>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : null)}
        <ScrollView
          ref={scrollViewRef}
          style={[styles.transcriptScroll, styles.adminTranscriptScroll]}
          contentContainerStyle={[styles.transcriptContent, styles.adminTranscriptContent]}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg, i) => {
            const looksLikeScoreCard = messageLooksLikeScoreCard(msg);
            const isError = (msg as { isError?: boolean }).isError === true;
            if (looksLikeScoreCard && !isAdmin) return null;
            if (msg.role === 'user' && !isAdmin) return null;
            const displayContent = typeof msg.content === 'string'
              ? stripControlTokens(msg.content)
              : msg.content;
            if (looksLikeScoreCard) {
              return (
                <View key={i} style={[styles.scoreCard, styles.adminScoreCard]}>
                  <Text style={[styles.scoreCardContent, styles.adminScoreCardContent]}>{msg.content}</Text>
                </View>
              );
            }
            if (isError) {
              return (
                <View key={(msg as { id?: string }).id ?? i} style={[styles.msgRow, styles.msgRowError]}>
                  <Text style={[styles.msgContent, styles.msgContentError]}>{displayContent}</Text>
                </View>
              );
            }
            const isWaiting = (msg as { isWaiting?: boolean }).isWaiting;
            return (
              <View key={(msg as { id?: string }).id ?? i} style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}>
                <Text style={[styles.msgRole, styles.adminMsgRole]}>{msg.role === 'assistant' ? '◆ Interviewer' : 'You'}</Text>
                <Text style={[styles.msgContent, isWaiting && styles.msgContentWaiting, msg.role === 'assistant' ? styles.adminMsgContentInterviewer : styles.adminMsgContentUser]}>{displayContent}</Text>
              </View>
            );
          })}
          {isAdmin && isWaiting && (
            <View style={[styles.msgRowWaiting, styles.adminMsgRowWaiting]}>
              <Text style={[styles.msgRole, styles.adminMsgRole]}>◆ Interviewer</Text>
              <Text style={[styles.msgContentWaiting, styles.adminMsgContentWaiting]}>◆ Amoraea is thinking...</Text>
            </View>
          )}
          {currentTranscript && voiceState === 'listening' && (
            <View style={styles.msgRow}>
              <Text style={[styles.msgRole, { color: colors.error }]}>● You (speaking…)</Text>
              <Text style={[styles.msgContent, { fontStyle: 'italic' }]}>{currentTranscript}</Text>
            </View>
          )}
        </ScrollView>

        {status === 'scoring' && (
          <View style={styles.scoringIndicator}>
            <Text style={styles.scoringIndicatorDot}>◆</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.scoringIndicatorText}>
                {reasoningProgress === 'slow'
                  ? 'This is taking a moment...'
                  : reasoningProgress === 'very_slow'
                    ? 'Almost there...'
                    : reasoningProgress === 'pending'
                      ? 'Saving your results…'
                      : reasoningProgress === 'failed'
                        ? 'Something went wrong.'
                        : 'Preparing your analysis...'}
              </Text>
              {(reasoningProgress === 'slow' || reasoningProgress === 'very_slow') && (
                <Text style={styles.scoringIndicatorSub}>
                  {reasoningProgress === 'very_slow'
                    ? 'Detailed analyses take a little longer.'
                    : 'Your transcript is being read carefully.'}
                </Text>
              )}
              {reasoningProgress === 'pending' && (
                <>
                  <Text style={styles.scoringIndicatorSub}>
                    Your scores are saved. Full narrative analysis will finish when the connection allows — you can open
                    your results now.
                  </Text>
                  <Pressable onPress={() => setStatus('results')} style={styles.scoringViewScoresButton}>
                    <Text style={styles.scoringViewScoresButtonLabel}>View Scores →</Text>
                  </Pressable>
                </>
              )}
              {reasoningProgress === 'failed' && (
                <>
                  <Text style={styles.scoringIndicatorSub}>
                    Your scores have been saved. The detailed analysis may not be available.
                  </Text>
                  <Pressable
                    onPress={() => setStatus('results')}
                    style={styles.scoringViewScoresButton}
                  >
                    <Text style={styles.scoringViewScoresButtonLabel}>View Scores →</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}

        {status === 'results' && results && (
          <ScrollView key="final-results" style={[styles.resultsPanel, styles.resultsPanelHighlight]} contentContainerStyle={styles.resultsPanelContent}>
            <Text style={styles.resultsPanelTitle}>✦ Interview complete</Text>
            {!(isAmoraeaAdminConsoleEmail(user?.email) || isAdmin) ? (
              <>
                <Text style={styles.resultsPanelSummary}>
                  Thank you for completing your interview. Your application is now being reviewed — this usually takes up to 24 hours.
                </Text>
                <Button
                  title="Continue"
                  onPress={() => {
                    setInterviewStatus('congratulations');
                    if (userId && (route.name === 'Aria' || route.name === 'OnboardingInterview')) {
                      replaceWithStandardApplicantProcessingHandoffForUser(navigation, userId);
                    }
                  }}
                  style={styles.resultsPanelButton}
                />
              </>
            ) : (
              <>
                {results.gateResult ? (
                  <View style={[
                    styles.gateResultBlock,
                    { backgroundColor: results.gateResult.pass ? '#F0F7F0' : '#FDF0F0', borderColor: results.gateResult.pass ? colors.success : colors.error },
                  ]}>
                    <Text style={[styles.gateResultLabel, { color: results.gateResult.pass ? colors.success : colors.error }]}>
                      {results.gateResult.pass ? '✓ Interview passed' : '✗ Interview not passed'}
                    </Text>
                    <Text style={styles.gateResultText}>
                      {results.gateResult.pass
                        ? `Weighted score: ${results.gateResult.weightedScore}/10 — meets the threshold of ${GATE_PASS_WEIGHTED_MIN} for profile creation.`
                        : results.gateResult.failReason
                          ? `${results.gateResult.failReason}${
                              results.gateResult.weightedScore != null
                                ? ` Overall weighted score: ${results.gateResult.weightedScore}/10.`
                                : ''
                            }`
                          : `Weighted score: ${results.gateResult.weightedScore ?? '—'}/10 — below the threshold of ${GATE_PASS_WEIGHTED_MIN} required for profile creation.`}
                    </Text>
                    {(results.gateResult.excludedMarkers?.length ?? 0) > 0 ? (
                      <Text style={styles.gateResultText}>
                        Unassessed markers (shown as "—") were excluded from weighted score calculation:{' '}
                        {results.gateResult.excludedMarkers
                          ?.map((id) => INTERVIEW_MARKER_LABELS[id as keyof typeof INTERVIEW_MARKER_LABELS] ?? id)
                          .join(', ')}
                        .
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {results.interviewSummary ? (
                  <Text style={styles.resultsPanelSummary}>{results.interviewSummary}</Text>
                ) : null}
                <View style={styles.resultsPanelPillars}>
                  {INTERVIEW_MARKER_IDS.map((id) => {
                    const score = results.pillarScores?.[id];
                    const meta = PILLAR_META[id] ?? { name: id, color: colors.primary };
                    const hasNumericScore = typeof score === 'number' && Number.isFinite(score);
                    return (
                      <View key={id} style={styles.resultsPillarRow}>
                        <View style={styles.resultsPillarHeader}>
                          <Text style={styles.resultsPillarName}>{meta.name}</Text>
                          <Text style={[styles.resultsPillarScore, { color: meta.color }]}>
                            {hasNumericScore ? `${score}/10` : '—'}
                          </Text>
                        </View>
                        {hasNumericScore ? (
                          <View style={styles.resultsPillarBar}>
                            <View
                              style={[
                                styles.resultsPillarBarFill,
                                { width: `${score * 10}%`, backgroundColor: meta.color },
                              ]}
                            />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                <Button
                  title="Continue →"
                  onPress={() => {
                    const onComplete = (route.params as { onComplete?: (r: InterviewResults) => void })?.onComplete;
                    if (onComplete) onComplete({ ...results, gateResult: results?.gateResult });
                  }}
                  style={styles.resultsPanelButton}
                />
              </>
            )}
          </ScrollView>
        )}

        {status === 'active' && (
          <View style={[styles.voiceDock, isAdmin && styles.adminVoiceDock]}>
            {micError ? <Text style={[styles.dockError, isAdmin && styles.adminDockText]}>{micError}</Text> : null}
            {micWarning && !micError ? <Text style={[styles.dockWarning, isAdmin && styles.adminDockText]}>{micWarning}</Text> : null}
            <Pressable
              onPressIn={handlePressStart}
              onPressOut={handlePressEnd}
              disabled={!!micError || voiceState === 'speaking' || voiceState === 'processing'}
              style={[
                styles.micOrb,
                voiceState === 'listening' && styles.micOrbListening,
                voiceState === 'processing' && styles.micOrbProcessing,
                voiceState === 'speaking' && styles.micOrbSpeaking,
              ]}
            >
              {voiceState === 'listening' ? (
                <Ionicons name="mic" size={36} color="#fff" />
              ) : voiceState === 'processing' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : voiceState === 'speaking' ? (
                <Ionicons name="volume-high" size={28} color="#fff" />
              ) : (
                <Ionicons name="mic" size={36} color="#fff" />
              )}
            </Pressable>
            <Text style={[styles.voiceLabel, isAdmin && styles.adminVoiceLabel]}>
              {voiceState === 'listening' && 'Listening…'}
              {voiceState === 'processing' && 'Thinking…'}
              {voiceState === 'speaking' && 'Interviewer speaking'}
              {voiceState === 'idle' && 'Tap to speak'}
            </Text>
            {isAdmin && (
              <View style={styles.typeFallback}>
                <Text style={[styles.typeFallbackLabel, styles.adminTypeFallbackLabel]}>Or type your answer (you can type while the interviewer is speaking)</Text>
                <TextInput
                  style={[styles.typeFallbackInput, styles.adminTypeFallbackInput]}
                  placeholder="Type here…"
                  placeholderTextColor="#7A9ABE"
                  value={typedAnswer}
                  onChangeText={setTypedAnswer}
                  editable={!inputDisabled && voiceState !== 'processing'}
                  multiline
                  maxLength={2000}
                  {...(Platform.OS === 'web'
                    ? {
                        onPaste: () => {
                          if (!userId) return;
                          const r = getSessionLogRuntime();
                          writeSessionLog({
                            userId,
                            attemptId: r.attemptId,
                            eventType: 'copy_paste_detected',
                            eventData: { field_name: 'admin_typed_answer' },
                            platform: r.platform,
                          });
                        },
                      }
                    : {})}
                  onKeyPress={(e) => {
                    const key = (e.nativeEvent?.key ?? (e as { key?: string }).key) ?? '';
                    const shiftKey = (e.nativeEvent as { shiftKey?: boolean } | undefined)?.shiftKey ?? (e as { shiftKey?: boolean }).shiftKey ?? false;
                    if (key === 'Enter' && !shiftKey) {
                      (e as { preventDefault?: () => void }).preventDefault?.();
                      if (typedAnswer.trim() && !inputDisabled && voiceState !== 'processing') {
                        handleSendTyped();
                      }
                    }
                  }}
                />
                <Button
                  title="Send"
                  onPress={handleSendTyped}
                  disabled={inputDisabled || !typedAnswer.trim() || voiceState === 'processing'}
                  variant="outline"
                  style={styles.typeFallbackButton}
                />
              </View>
            )}
          </View>
        )}
          </View>
        )}
      </View>
      {/* Low-storage fallback is silent — no user-facing message; progress still saved to server */}
      {webActiveGestureOverlayKind === 'pending_tts' ? (
        <Pressable
          style={styles.mobileWebTapToBeginOverlay}
          onPress={() => void runWebGestureTtsFlush('pending_tts_gesture_overlay')}
          accessibilityRole="button"
          accessibilityLabel={
            webSpeechShouldDeferToUserGesture()
              ? 'Tap to play interviewer audio'
              : 'Click to play interviewer audio'
          }
        >
          <Text style={styles.mobileWebTapToBeginTitle}>
            {webSpeechShouldDeferToUserGesture() ? 'Tap to play audio' : 'Click to play audio'}
          </Text>
          <Text style={styles.mobileWebTapToBeginSubtitle}>
            {webSpeechShouldDeferToUserGesture()
              ? 'Your browser needs one tap to play the next line after you spoke.'
              : "When you're ready, click anywhere to start!"}
          </Text>
        </Pressable>
      ) : null}
      {webActiveGestureOverlayKind === 'tab_restore' ? (
        <Pressable
          style={styles.mobileWebTapToBeginOverlay}
          onPress={() => handleWebTabGestureRestoreTap()}
          accessibilityRole="button"
          accessibilityLabel="Tap to continue"
        >
          <Text style={styles.mobileWebTapToBeginTitle}>Tap to continue</Text>
          <Text style={styles.mobileWebTapToBeginSubtitle}>
            Your browser needs a tap after returning to this tab so audio can play.
          </Text>
        </Pressable>
      ) : null}
      {webActiveGestureOverlayKind === 'resume_welcome' ? (
        <Pressable
          style={styles.mobileWebTapToBeginOverlay}
          onPress={() => void handleWebResumeWelcomeTap()}
          accessibilityRole="button"
          accessibilityLabel="Tap to play welcome message"
        >
          <Text style={styles.mobileWebTapToBeginTitle}>Tap to play</Text>
          <Text style={styles.mobileWebTapToBeginSubtitle}>
            Your browser needs a tap to resume interviewer audio after loading your saved session.
          </Text>
        </Pressable>
      ) : null}
      <FeedbackBubble attemptId={interviewSessionAttemptIdRef.current ?? undefined} userId={userId || undefined} />
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  sessionExpiredOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(5,6,13,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  sessionExpiredTitle: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 24,
    fontWeight: '300',
    color: '#C8E4FF',
    marginBottom: 14,
    textAlign: 'center',
  },
  sessionExpiredBody: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 14,
    fontWeight: '300',
    color: '#7A9ABE',
    lineHeight: 24,
    maxWidth: 320,
    marginBottom: 32,
    textAlign: 'center',
  },
  sessionExpiredButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    shadowColor: '#1E6FD9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 8,
  },
  sessionExpiredButtonLabel: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: '#EEF6FF',
  },
  /** Mobile web: semi-transparent full-screen hint before first user gesture unlocks audio */
  mobileWebTapToBeginOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    backgroundColor: 'rgba(5, 6, 13, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  mobileWebTapToBeginTitle: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 22,
    fontWeight: '300',
    color: '#EEF6FF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  mobileWebTapToBeginSubtitle: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 13,
    fontWeight: '300',
    color: 'rgba(210, 228, 250, 0.95)',
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 320,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  memoryFallbackBanner: {
    position: 'absolute',
    bottom: 100,
    left: '50%',
    marginLeft: -140,
    width: 280,
    backgroundColor: 'rgba(13,17,32,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    zIndex: 500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryFallbackBannerText: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 11,
    fontWeight: '300',
    color: '#7A9ABE',
    letterSpacing: 0.5,
  },
  introContent: { padding: spacing.lg, paddingTop: spacing.xxl },
  preInterviewScrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  preInterviewLogoWrap: { alignItems: 'center', marginBottom: spacing.md },
  preInterviewMainTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F4F8FC',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  preInterviewSubtitle: {
    fontSize: 15,
    color: '#7A9ABE',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  preInterviewSectionHeading: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E8F0F8',
    marginBottom: spacing.md,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  preInterviewSectionHeadingSpaced: {
    marginTop: spacing.xl,
  },
  preInterviewBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: 10,
    alignSelf: 'stretch',
  },
  preInterviewBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E6FD9',
    marginTop: 8,
    flexShrink: 0,
  },
  preInterviewBulletText: {
    flex: 1,
    fontSize: 15,
    color: '#B8C9DC',
    lineHeight: 22,
  },
  preInterviewConsentCard: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(13, 17, 32, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(91, 168, 232, 0.22)',
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  preInterviewCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  preInterviewCheckboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(91, 168, 232, 0.5)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  preInterviewCheckboxBoxChecked: {
    backgroundColor: '#1E6FD9',
    borderColor: '#1E6FD9',
  },
  preInterviewCheckboxLabel: {
    flex: 1,
    fontSize: 15,
    color: '#E8F0F8',
    lineHeight: 22,
  },
  preInterviewBeginButton: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    width: '100%',
  },
  preInterviewLegalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginTop: spacing.lg,
    flexWrap: 'wrap',
  },
  preInterviewLegalLink: {
    fontSize: 13,
    color: '#5BA8E8',
    textDecorationLine: 'underline',
  },
  headphoneRecommendCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1E6FD9',
    backgroundColor: 'rgba(30, 111, 217, 0.12)',
  },
  headphoneRecommendIcon: { marginRight: 12, marginTop: 2 },
  headphoneRecommendTextCol: { flex: 1 },
  headphoneRecommendTitle: {
    fontSize: 15,
    color: '#E8F0F8',
    lineHeight: 22,
    fontWeight: '500',
  },
  headphoneRecommendSub: {
    fontSize: 13,
    color: '#7A9ABE',
    lineHeight: 20,
    marginTop: 8,
  },
  ariaBadge: { alignItems: 'center', marginBottom: spacing.xl },
  ariaName: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  ariaTagline: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.xs },
  introTitle: { fontSize: 22, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  introHint: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.sm },
  introNote: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  micErrorBlock: { backgroundColor: colors.error + '15', padding: spacing.md, marginBottom: spacing.md, borderRadius: 8 },
  micErrorText: { fontSize: 14, color: colors.error },
  micWarningBlock: { backgroundColor: colors.warning + '20', padding: spacing.md, marginBottom: spacing.md, borderRadius: 8 },
  micWarningText: { fontSize: 14, color: colors.warning },
  introButton: { marginTop: spacing.sm },
  scoringIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  scoringIndicatorDot: { fontSize: 11, color: colors.primary, letterSpacing: 2 },
  scoringIndicatorText: { fontSize: 11, color: colors.textSecondary, letterSpacing: 1 },
  scoringIndicatorSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    opacity: 0.9,
  },
  scoringViewScoresButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
  },
  scoringViewScoresButtonLabel: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#EEF6FF',
  },
  resultsPanel: {
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    backgroundColor: colors.surface,
    maxHeight: 360,
  },
  resultsPanelHighlight: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  resultsPanelContent: { padding: 24, paddingBottom: spacing.xl },
  resultsPanelTitle: {
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 3,
    marginBottom: 12,
  },
  gateResultBlock: {
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  gateResultLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  gateResultText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  resultsPanelSummary: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  resultsPanelPillars: { marginBottom: 20 },
  resultsPillarRow: { marginBottom: 10 },
  resultsPillarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  resultsPillarName: { fontSize: 10, color: colors.textSecondary, letterSpacing: 1 },
  resultsPillarScore: { fontSize: 11, fontWeight: '600' },
  resultsPillarBar: { height: 3, backgroundColor: colors.border, borderRadius: 2 },
  resultsPillarBarFill: { height: '100%', borderRadius: 2 },
  resultsPanelButton: { width: '100%' },
  retakeButtonUnderReview: {
    marginTop: 32,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.4)',
    borderRadius: 8,
  },
  retakeButtonUnderReviewText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7A9ABE',
    letterSpacing: 1,
  },
  feedbackModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,6,13,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  feedbackModalCard: {
    width: '100%',
    maxWidth: 860,
    maxHeight: '90%',
    backgroundColor: '#0D1120',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.22)',
    borderRadius: 14,
    padding: 16,
  },
  feedbackModalTitle: {
    color: '#E8F0F8',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 6,
  },
  feedbackModalHint: {
    color: '#9FB8D2',
    fontSize: 12,
    marginBottom: 10,
  },
  feedbackModalError: {
    color: '#FCA5A5',
    fontSize: 12,
    marginBottom: 8,
  },
  feedbackModalScroll: {
    width: '100%',
  },
  feedbackQuestionBlock: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 10,
    backgroundColor: 'rgba(13,17,32,0.6)',
  },
  feedbackQuestionTitle: {
    color: '#C8E4FF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  feedbackQuestionPrompt: {
    color: '#9FB8D2',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  feedbackScaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  feedbackScalePill: {
    minWidth: 32,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  feedbackScalePillActive: {
    backgroundColor: '#1E6FD9',
    borderColor: 'rgba(107,185,255,0.85)',
  },
  feedbackScalePillText: {
    color: '#9FB8D2',
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackScalePillTextActive: {
    color: '#F4F8FC',
  },
  feedbackCommentInput: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.22)',
    borderRadius: 8,
    minHeight: 74,
    color: '#E8F0F8',
    padding: 10,
    textAlignVertical: 'top',
    backgroundColor: '#0B0F1D',
    fontSize: 12,
  },
  feedbackModalActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  feedbackActionButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  feedbackActionCancel: {
    borderColor: 'rgba(122,154,190,0.45)',
    backgroundColor: 'rgba(122,154,190,0.12)',
  },
  feedbackActionCancelText: {
    color: '#C8D9EB',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  feedbackActionSubmit: {
    borderColor: 'rgba(107,185,255,0.85)',
    backgroundColor: '#1E6FD9',
  },
  feedbackActionSubmitText: {
    color: '#F4F8FC',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  resultsContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  resultsHead: { fontSize: 11, color: colors.primary, letterSpacing: 2, marginBottom: spacing.sm },
  resultsTitle: { fontSize: 24, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  resultsSummary: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
  pillarCard: { backgroundColor: colors.surface, borderLeftWidth: 4, padding: spacing.md, marginBottom: spacing.md, borderRadius: 8 },
  pillarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pillarName: { fontSize: 15, color: colors.text },
  pillarScore: { fontSize: 18, fontWeight: '600' },
  pillarEvidence: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 20 },
  inconsistenciesBlock: { backgroundColor: colors.primary + '12', padding: spacing.md, marginBottom: spacing.lg, borderRadius: 8 },
  inconsistenciesTitle: { fontSize: 11, color: colors.primary, letterSpacing: 1, marginBottom: spacing.sm },
  inconsistenciesText: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 4 },
  resultsButton: { marginTop: spacing.md },
  activeContainer: { flex: 1 },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  activeHeaderLabel: { fontSize: 12, color: colors.primary },
  activeHeaderCount: { fontSize: 12, color: colors.textSecondary },
  constructRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  constructChip: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  constructChipText: { fontSize: 10, color: colors.textSecondary },
  stageScoresContainer: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  stageScoresTitle: { fontSize: 11, color: colors.primary, letterSpacing: 1, marginBottom: spacing.sm },
  stageScoreCard: { marginBottom: spacing.sm },
  stageScoreLabel: { fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 },
  stageScorePillars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stageScorePillar: { fontSize: 12, color: colors.textSecondary },
  transcriptScroll: { flex: 1 },
  transcriptContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  msgRow: { marginBottom: spacing.lg },
  msgRowError: {
    alignSelf: 'center',
    maxWidth: '85%',
    padding: 12,
    marginVertical: 8,
    backgroundColor: 'rgba(232, 122, 122, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232, 122, 122, 0.2)',
    borderRadius: 10,
  },
  msgContentError: {
    fontSize: 13,
    fontWeight: '300',
    color: '#E87A7A',
    textAlign: 'center',
    lineHeight: 20,
    borderLeftWidth: 0,
    paddingLeft: 0,
  },
  msgRowWaiting: {
    marginBottom: spacing.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.08)',
  },
  msgRowUser: { alignItems: 'flex-end' },
  msgRole: { fontSize: 10, color: colors.primary, letterSpacing: 1, marginBottom: 4 },
  msgContent: { fontSize: 15, color: colors.text, lineHeight: 22, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.sm },
  msgContentWaiting: { color: '#3D5470', fontStyle: 'italic' },
  scoreCard: {
    marginVertical: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: colors.border,
    borderLeftColor: colors.primary,
    borderRadius: 8,
  },
  scoreCardContent: { fontSize: 12, color: colors.textSecondary, lineHeight: 20, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  voiceDock: { padding: spacing.lg, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  dockError: { fontSize: 13, color: colors.error, marginBottom: spacing.sm },
  dockWarning: { fontSize: 13, color: colors.warning, marginBottom: spacing.sm },
  micOrb: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.text, justifyContent: 'center', alignItems: 'center' },
  micOrbListening: { backgroundColor: colors.error },
  micOrbProcessing: { backgroundColor: colors.primary },
  micOrbSpeaking: { backgroundColor: colors.success },
  voiceLabel: { fontSize: 11, color: colors.textSecondary, marginTop: spacing.sm },
  typeFallback: { marginTop: spacing.lg, width: '100%', maxWidth: 360 },
  typeFallbackLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  typeFallbackInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeFallbackButton: { marginTop: spacing.sm },
  chatCompletionBlock: { marginTop: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: colors.primary },
  chatCompletionTitle: { fontSize: 14, fontWeight: '600', color: colors.primary, letterSpacing: 1, marginBottom: spacing.sm },
  chatCompletionSummary: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
  chatCompletionButton: { alignSelf: 'flex-start' },
  // Admin interview — dark design system (void/surface/flame-bright/text-primary)
  adminActiveContainer: { flex: 1, backgroundColor: '#05060D' },
  introLogoutButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30,111,217,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 6,
    zIndex: 100,
  },
  introLogoutButtonText: {
    fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.5,
    color: '#5BA8E8',
  },
  adminPanelButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30,111,217,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 6,
    zIndex: 100,
  },
  adminTopBarRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  adminBarButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30,111,217,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 6,
  },
  adminBarButtonReset: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(184,92,92,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232,120,120,0.35)',
    borderRadius: 6,
  },
  adminBarButtonLogout: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30,111,217,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 6,
  },
  adminPanelButtonText: {
    fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined,
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#5BA8E8',
  },
  adminResetButtonText: {
    fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#E8A0A0',
  },
  adminLogoutButtonText: {
    fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#5BA8E8',
  },
  adminWrap: { flex: 1, backgroundColor: '#05060D' },
  adminStageScoresContainer: { backgroundColor: '#0D1120', borderBottomColor: 'rgba(82,142,220,0.12)' },
  adminStageScoresTitle: { color: '#3D5470', letterSpacing: 2.5, textTransform: 'uppercase', fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined, fontSize: 10 },
  adminTranscriptScroll: { backgroundColor: '#05060D' },
  adminTranscriptContent: { backgroundColor: '#05060D' },
  adminMsgRole: { color: '#3D5470', fontSize: 10, letterSpacing: 1 },
  adminMsgContentInterviewer: { color: '#C8E4FF', fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined, fontSize: 16, fontWeight: '300', fontStyle: 'italic', lineHeight: 24, borderLeftColor: 'rgba(82,142,220,0.12)' },
  adminMsgContentUser: { color: '#E8F0F8', fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined, fontSize: 14, fontWeight: '300', lineHeight: 21 },
  adminScoreCard: { backgroundColor: '#111827', borderColor: 'rgba(82,142,220,0.12)', borderLeftColor: '#5BA8E8' },
  adminScoreCardContent: { color: '#C8E4FF', fontSize: 12 },
  adminStageScoreCard: { backgroundColor: '#111827', borderColor: 'rgba(82,142,220,0.12)', borderRadius: 10, padding: 16 },
  adminStageScoreLabel: { fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined, fontSize: 9, fontWeight: '400', letterSpacing: 2.5, textTransform: 'uppercase', color: '#3D5470' },
  adminStageScorePillar: { fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined, fontSize: 22, fontWeight: '300', color: '#C8E4FF' },
  adminMsgRowWaiting: { borderBottomColor: 'rgba(82,142,220,0.12)' },
  adminMsgContentWaiting: { color: '#3D5470' },
  adminVoiceDock: { borderTopColor: 'rgba(82,142,220,0.12)', backgroundColor: '#05060D' },
  adminDockText: { color: '#E8F0F8' },
  adminVoiceLabel: { color: '#7A9ABE' },
  adminTypeFallbackLabel: { color: '#7A9ABE' },
  adminTypeFallbackInput: { backgroundColor: '#0D1120', borderColor: 'rgba(82,142,220,0.12)', color: '#E8F0F8' },
});

export default AriaScreen;
