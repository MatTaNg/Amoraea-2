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
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Audio } from 'expo-av';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { INTERVIEWER_SYSTEM_FRAMEWORK } from '@features/aria/interviewerFrameworkPrompt';
import { INTERVIEW_MARKER_IDS, INTERVIEW_MARKER_LABELS } from '@features/aria/interviewMarkers';
import { setPlaybackMode } from '@features/aria/utils/audioModeHelpers';
import { speakWithElevenLabs, stopElevenLabsSpeech } from '@features/aria/utils/elevenLabsTts';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { evaluateGate1 } from '@features/onboarding/evaluateGate1';
import type { Gate1Score } from '@domain/models/OnboardingGates';
import { supabase } from '@data/supabase/client';
import {
  saveInterviewToStorage,
  loadInterviewFromStorage,
  clearInterviewFromStorage,
  getCurrentScenario,
  setStorageFallbackListener,
  type StoredInterviewData,
} from '@utilities/storage/InterviewStorage';
import { requestMicPermissionForPWA } from '@utilities/permissions/requestMicPermission';
import { withRetry, classifyError } from '@utilities/withRetry';
import { remoteLog } from '@utilities/remoteLog';
import { FlameOrb } from '@app/screens/FlameOrb';
import { UserInterviewLayout, type ActiveScenario } from '@app/screens/UserInterviewLayout';
import { InterviewAnalysisScreen } from '@app/screens/InterviewAnalysisScreen';
import { AdminInterviewDashboard, AdminAttemptTabsView } from '@app/screens/AdminInterviewDashboard';
import {
  calculateScoreConsistency,
  calculateConstructAsymmetry,
  analyzeLanguageMarkers,
  buildScenarioBoundaries,
} from '@features/aria/alphaAssessmentUtils';
import { generateAIReasoning } from '@features/aria/generateAIReasoning';
import { useAudioRecorder } from '@features/aria/hooks/useAudioRecorder';
import {
  evaluateMoment4RelationshipType,
  shouldForceMoment4ThresholdProbe as shouldForceMoment4ThresholdProbeByType,
} from '@features/aria/moment4ProbeLogic';
import { applyMoment4RepairCalibrationRule } from '@features/aria/moment4RepairCalibration';
import * as FileSystem from 'expo-file-system';

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

type InterviewMomentIndex = 1 | 2 | 3 | 4 | 5;
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
  return { 1: false, 2: false, 3: false, 4: false, 5: false };
}

function buildInterviewProgressSystemSuffix(opts: {
  momentsComplete: Record<InterviewMomentIndex, boolean>;
  currentMoment: InterviewMomentIndex;
  personalHandoffInjected: boolean;
  appreciationQuestionSeen: boolean;
}): string {
  const lines: string[] = [
    '',
    'PROGRESS LOCKS (internal metadata — obey strictly; never read aloud):',
    `Current interview moment index (1–5): ${opts.currentMoment}. 1–3 = scenarios A–C; 4 = grudge personal; 5 = appreciation; then closing only.`,
  ];
  if (opts.momentsComplete[1]) lines.push('Moment 1 COMPLETE — do not re-open Scenario A.');
  if (opts.momentsComplete[2]) lines.push('Moment 2 COMPLETE — do not re-open Scenario B.');
  if (opts.momentsComplete[3]) lines.push('Moment 3 COMPLETE — do not re-open Scenario C.');
  if (opts.personalHandoffInjected) {
    lines.push('The transition into the personal (grudge) question was already delivered. Never repeat that full handoff.');
  }
  if (opts.momentsComplete[4]) {
    lines.push('Moment 4 COMPLETE — never ask the grudge / dislike question again.');
  }
  if (opts.appreciationQuestionSeen) {
    lines.push('The appreciation question was already asked — never return to Moment 4 opening.');
  }
  if (opts.momentsComplete[5]) {
    lines.push('Moment 5 COMPLETE — only closing synthesis, thanks, and [INTERVIEW_COMPLETE].');
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
  appreciationQuestionSeen: boolean;
} {
  if (
    msgs.some(
      (m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.includes('[INTERVIEW_COMPLETE]')
    )
  ) {
    return {
      momentsComplete: { 1: true, 2: true, 3: true, 4: true, 5: true },
      currentMoment: 5,
      personalHandoffInjected: true,
      appreciationQuestionSeen: true,
    };
  }
  const momentsComplete = createInitialMomentCompletion();
  let personalHandoffInjected = false;
  let appreciationQuestionSeen = false;
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
    if (c.includes('celebrated someone') || (c.includes('really celebrated') && c.includes('your life'))) {
      appreciationQuestionSeen = true;
      personalHandoffInjected = true;
      momentsComplete[3] = true;
      momentsComplete[4] = true;
      currentMoment = 5;
      break;
    }
    if (
      (c.includes("we've covered those three") || c.includes('three situations')) &&
      (c.includes('held a grudge') || c.includes('more personal'))
    ) {
      personalHandoffInjected = true;
      momentsComplete[3] = true;
      currentMoment = 4;
      break;
    }
    if (c.includes('morgan and theo') && c.includes('i need ten minutes')) {
      currentMoment = 3;
      break;
    }
    if (c.includes('alex has been job hunting')) {
      currentMoment = 2;
      break;
    }
    if (c.includes('sam and reese') || c.includes('reese takes a call')) {
      currentMoment = 1;
      break;
    }
  }

  return { momentsComplete, currentMoment, personalHandoffInjected, appreciationQuestionSeen };
}

function messageLooksLikeScoreCard(msg: { role?: string; content?: string; isScoreCard?: boolean }): boolean {
  if (msg.isScoreCard) return true;
  const t = msg.content ?? '';
  return t.includes('── Scenario ') && /\d\/10/.test(t);
}

type InterviewProgressRefs = {
  interviewMomentsCompleteRef: { current: Record<InterviewMomentIndex, boolean> };
  currentInterviewMomentRef: { current: InterviewMomentIndex };
  personalHandoffInjectedRef: { current: boolean };
  appreciationQuestionSeenRef: { current: boolean };
};

/** Infer M3→M4/M4→M5 progression from assistant visible text (model outputs). */
function applyInterviewProgressFromAssistantText(rawDisplayText: string, refs: InterviewProgressRefs) {
  const dt = (rawDisplayText ?? '').toLowerCase();
  if (
    (dt.includes("we've covered those three") || dt.includes('three situations')) &&
    (dt.includes('held a grudge') || dt.includes('more personal'))
  ) {
    refs.personalHandoffInjectedRef.current = true;
    refs.interviewMomentsCompleteRef.current[3] = true;
    refs.currentInterviewMomentRef.current = 4;
    return;
  }
  if (dt.includes('celebrated someone') || (dt.includes('really celebrated') && dt.includes('your life'))) {
    refs.appreciationQuestionSeenRef.current = true;
    refs.interviewMomentsCompleteRef.current[4] = true;
    refs.currentInterviewMomentRef.current = 5;
  }
}

/** Always use proxy when set — direct api.anthropic.com fails on native (CORS). */
function getPublicEnv(varName: string, extraKey?: string): string {
  const fromProcess =
    typeof process !== 'undefined' && process.env ? (process.env[varName] as string | undefined) : undefined;
  const fromExtra =
    (Constants.expoConfig?.extra?.[extraKey ?? ''] as string | undefined) ??
    (Constants.expoConfig?.extra?.[varName] as string | undefined);
  return (fromProcess || fromExtra || '').trim();
}

function getResolvedSupabaseUrl(): string {
  return getPublicEnv('EXPO_PUBLIC_SUPABASE_URL', 'supabaseUrl');
}

function getResolvedAnthropicProxyUrl(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_ANTHROPIC_PROXY_URL', 'anthropicProxyUrl');
  if (configured) return configured;
  const supabaseUrl = getResolvedSupabaseUrl().replace(/\/+$/, '');
  return supabaseUrl ? `${supabaseUrl}/functions/v1/anthropic-proxy` : '';
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
    "Something interrupted me there. Would you mind repeating that?",
    "I missed that — can you say it once more?",
  ],
  recordingOrTranscriptionRetryNative: [
    "I didn't catch that — tap the mic and try again.",
    "Say that again when you're ready.",
    "I missed that — give it another go.",
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
  if (/sam and reese|reese takes a call|first situation|here's the first|situation 1/.test(c)) return 1;
  if (/alex has been job hunting|alex.*jordan|on to the second|second situation/.test(c)) return 2;
  if (/morgan and theo|i need ten minutes|here's the third situation|third situation|last one.*situation three|situation three/.test(c)) return 3;
  return lastNum ?? 1;
}

/** Detect which scenario an AI response introduces from content (belt-and-suspenders for tagging). */
function detectScenarioFromResponse(responseText: string): 1 | 2 | 3 | null {
  if (!responseText?.trim()) return null;
  const c = responseText.toLowerCase();
  if (/sam and reese|reese takes a call|first situation|here's the first/.test(c)) return 1;
  if (/alex has been job hunting|second situation|on to the second/.test(c)) return 2;
  if (/morgan and theo|theo.*didn't know how|here's the third situation|third situation|last one.*situation three|situation three/.test(c)) return 3;
  return null;
}

/** Infer message slice for a scenario when tags are wrong: find anchor message for this scenario, slice until next scenario anchor. */
function inferScenarioMessages(
  allMessages: { role: string; content: string }[],
  scenarioNum: 1 | 2 | 3
): { role: string; content: string }[] {
  const scenarioAnchors: Record<number, string[]> = {
    1: [
      'sam and reese',
      'reese takes a call',
      "here's the first",
      'first situation',
      "what can i call you",
      "i'm aira",
      "welcome to amoraea",
    ],
    2: ['alex has been job hunting', 'on to the second', 'second situation'],
    3: ['morgan and theo', 'i need ten minutes', "here's the third situation", 'third situation', 'last one', 'situation three'],
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

const DECLINE_PHRASES = [
  "i can't think of one", "i cant think of one", "i don't know", "i dont know",
  "nothing comes to mind", "not really", "no", "nope", "can't think of anything",
  "don't have", "can't think", "no example",
];

function isDecline(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return DECLINE_PHRASES.some((phrase) => lower.includes(phrase)) || lower.length < 15;
}

function isAppreciationPromptText(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('think of a time you really celebrated someone') || (t.includes('really celebrated') && t.includes('your life'));
}

function looksLikeMoment5Probe(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('particular moment that comes to mind') ||
    t.includes('what made you decide on that specifically') ||
    t.includes('what do you remember about how they responded')
  );
}

function isGenericAppreciationAnswer(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (!t || t.length < 12) return true;
  const hasSpecificPerson = /\b(my|our)\s+(partner|wife|husband|boyfriend|girlfriend|friend|mom|mother|dad|father|sister|brother|cousin|aunt|uncle|daughter|son|teammate|roommate)\b|\b(he|she|they)\b/.test(t);
  const hasSpecificMoment = /\b(last|yesterday|today|week|month|birthday|anniversary|graduation|after|when|that time|once|on \w+day|at dinner|at work)\b/.test(t);
  const hasAttunement = /\bneeded|was going through|felt|feeling|stressed|upset|overwhelmed|encourag|support|noticed|because they\b/.test(t);
  const hasConnectionMoment =
    /\b(in that moment|when (she|he|they) (opened it|saw it|heard it|responded)|we hugged|teared up|started crying|smiled and|it landed)\b/.test(t);
  const hasWordsExchanged =
    /"(.*?)"|\b(she said|he said|they said|i said|i told (her|him|them)|they told me)\b/.test(t);
  const hasMeaningDetail =
    /\b(meaningful|mattered|why it mattered|what made it meaningful|because (she|he|they) (had|were|was)|for (her|him|them) specifically)\b/.test(t);
  const hasRelationalSpecificity = hasConnectionMoment || hasWordsExchanged || hasMeaningDetail;
  return !(hasSpecificPerson && hasSpecificMoment && hasAttunement && hasRelationalSpecificity);
}

function chooseMoment5Probe(userText: string): string {
  const t = userText.toLowerCase();
  if (/\b(always|usually|generally|typically)\b/.test(t)) {
    return 'Is there a particular moment that comes to mind?';
  }
  return 'What made you decide on that specifically?';
}

function looksLikeMoment4ThresholdQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('at what point do you decide this is something to work through versus something you need to walk away from') ||
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
    t.includes("at what point would you say theo or morgan should decide this relationship isn't working") ||
    (t.includes('theo') && t.includes('morgan') && t.includes("isn't working") && t.includes('point'))
  );
}

function looksLikeScenarioAContemptProbeQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("what do you make of sam's statement") &&
    t.includes("you've made that very clear")
  );
}

function looksLikeScenarioARepairQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('how would you repair this relationship if you were reese') ||
    (t.includes('if you were reese') && t.includes('repair this relationship'))
  );
}

function stripScenarioARepairQuestion(text: string): string {
  const cleaned = text
    .replace(/(?:^|\n)\s*How would you repair this relationship if you were Reese\?\s*/gi, '\n')
    .replace(/(?:^|\n)\s*If you were Reese[^?.!]*repair[^?.!]*[?.!]\s*/gi, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned;
}

function looksLikeScenarioBFullAppreciationProbeQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes("what do you think jordan could've done differently so alex feels better");
}

function isScenarioAQ1Prompt(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes("what's going on between these two");
}

function isScenarioBQ1Prompt(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('what do you think is going on here');
}

function isScenarioCQ2Prompt(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('how do you think this situation could be repaired');
}

function hasSpecificSamLineContemptRecognition(text: string): boolean {
  const t = text.toLowerCase();
  const referencesSpecificLine =
    t.includes("you've made that very clear") ||
    t.includes('you have made that very clear') ||
    (t.includes('very clear') && t.includes('sam'));
  const namesContemptQuality =
    /\b(cont(empt|emptuous)|cold|passive[- ]aggressive|dismissive|superior|biting|sarcastic|verdict)\b/.test(t);
  return referencesSpecificLine && namesContemptQuality;
}

function userSidesEntirelyWithJordan(text: string): boolean {
  const t = text.toLowerCase();
  const blamesAlex = /\b(alex (is|was) (too|overly)? ?(sensitive|dramatic|overreacting)|alex should( have)? just|alex is the problem)\b/.test(t);
  const jordanOnlyRight = /\b(jordan (did nothing wrong|was right|handled it fine)|nothing jordan could do|jordan was fine)\b/.test(t);
  return blamesAlex || jordanOnlyRight;
}

function naturallyRecognizesAlexNeed(text: string): boolean {
  const t = text.toLowerCase();
  const emotionalBidRecognition =
    /\b(trail(ed|ing) off|needed to feel (seen|heard|understood)|emotional bid|honor(ing)? the emotional|logistics alone|salary alone|commute alone)\b/.test(t);
  const attunedRecognition =
    /\b(alex needed|he needed|he wanted)\b.*\b(comfort|validation|acknowledg|empathy|care|attunement)\b/.test(t);
  return emotionalBidRecognition || attunedRecognition;
}

function hasMoment5TransitionSignal(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(last one|one more|little warmer|bit different|still personal)\b/.test(t);
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
  return `Based on this interview, write ONE closing line for the interviewer to deliver. It should:
- Integrate multiple moments: reference specific content from at least two of the fictional scenarios AND connect to the personal questions where relevant (not only the final answer).
- Be specific and warm, and reflect the arc of the conversation without diagnosing personal limitations or unresolved failures.
- NOT be a question; 1-2 sentences maximum.
- NOT start with "Thank you"
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

Interview transcript (user turns only):
${userMessages}

Write only the closing line. No preamble.`;
}

const CLOSING_LINE_INSTRUCTIONS = `
CLOSING LINE — CONCRETE, BRIEF, HUMAN:

The closing line before [INTERVIEW_COMPLETE] should reference at most TWO specific moments from the conversation. Choose the most revealing concrete moments the user actually named. Do not list many moments like a report.

BANNED PHRASES — never use these:
- "You've worked through all three of those clearly" / "You worked through all three clearly"
- "You caught the key patterns" / "key patterns in each situation"
- "Thank you for being so open with me" as a standalone closing (it can follow a specific observation but never lead alone)
- Any variation of "clearly" used as filler praise
- "A lot of self-awareness"
- "You handled that well"

REQUIRED: Before writing the closing line, identify:
1. One or two concrete details you can quote or closely echo.
2. Why those details mattered in the flow of conversation (without evaluative labels).
3. A grounded reflection that stays in those details.

Then write 1-2 sentences that name those details directly (by content, not by number).

EXAMPLES OF SPECIFIC CLOSING LINES:

User with concrete specifics: "When you described Alex trailing off and then shared the part about your brother's toast, those moments both stayed with me."

User with grounded continuity: "The way you spoke about Sam's 'very clear' line and the grudge story had the same kind of emotional temperature."

The closing line is honest and specific. It is not a grade. It is not broad praise. Keep it human and warm; do NOT end by highlighting what the user couldn't do or hasn't resolved.
Do not use evaluative characterizations of the user (for example: "grounded," "mature," "self-aware," "clear-headed," "strong"). Stay with what happened, not trait labels.
Avoid abstract framework-adjacent phrasing like "what was underneath," "core dynamic," or "relational patterning." Stay with concrete moments they actually named.

Do NOT reframe low-scoring signals as strengths. If something was a clear low-signal flag (e.g. unresolved contempt, exit-at-first-strain, thin appreciation), do not spin it as clarity, maturity, or growth in the closing line.

If signals were broadly low across markers, keep the closing brief, neutral, and kind. Do not convert low-signal patterns into compliments.
Do not use words like "clarity," "clear lines," or "principled" to positively frame patterns that scored below 5.

Do NOT use clinical/theoretical labels in the closing (e.g. "attunement," "mentalizing," "repair cycle," "flooding," "dysregulation," "reflective functioning," "pursue-withdraw cycle"). Use plain conversational language.
`;

const PERSONAL_CLOSING_INSTRUCTION = `
CLOSING: The user shared real personal experiences in moments four and/or five. Close with warmth that acknowledges their openness — something genuine but not effusive. Reference no more than one or two specific moments total. Do not evaluate the user or name traits; reflect concrete moments only. Do not reframe low-scoring signals as positives. Do not use clinical/theoretical labels in the closing. Then "Thank you for being so open with me" or similar. Then output [INTERVIEW_COMPLETE].`;

const SCENARIO_ONLY_CLOSING_INSTRUCTION = `
CLOSING: The user stayed mostly in analytical mode on the personal moments or gave very little personal detail. Do NOT over-thank for vulnerability. Keep the closing brief and reference only one or two specific moments. Do not evaluate the user or frame behavior as traits. Then output [INTERVIEW_COMPLETE].`;

function sanitizeClosingLanguage(text: string): string {
  if (!text) return text;
  let out = text
    .replace(/\brather\s+than\s+just\s+saying\b/gi, '')
    .replace(/\brather\s+than\s+just\b/gi, '')
    .replace(/\brather\s+than\b/gi, 'and')
    .replace(/\byou(?:'ve| have)\s+stayed grounded throughout this whole conversation[.,]?/gi, '')
    .replace(/\byou stayed grounded throughout this whole conversation[.,]?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const momentTokens = [
    /\bsam\b/i,
    /\balex\b/i,
    /\btheo\b/i,
    /\bmorgan\b/i,
    /\bcoworker\b/i,
    /\bbrother\b/i,
    /\btoast\b/i,
    /\bpromotion\b/i,
    /\btrailed off\b/i,
    /\bvery clear\b/i,
    /\bgrudge\b/i,
  ];
  const tokenHits = momentTokens.reduce((count, re) => (re.test(out) ? count + 1 : count), 0);
  if (tokenHits > 2) {
    const sentence = out.split(/(?<=[.!?])\s+/)[0] ?? out;
    const clauses = sentence.split(',').map((c) => c.trim()).filter(Boolean);
    if (clauses.length > 2) {
      out = `${clauses[0]}, ${clauses[1]}.`;
    } else {
      out = sentence.endsWith('.') ? sentence : `${sentence}.`;
    }
  }
  return out;
}

function sanitizeInterviewSpeech(text: string): string {
  if (!text) return text;
  return text
    .replace(/\brather\s+than\b/gi, 'and')
    .replace(/\binstead\s+of\b/gi, 'and')
    .replace(/\bas\s+opposed\s+to\b/gi, 'and')
    .replace(/\bnot\s+just\b/gi, '')
    .replace(/\bbeyond\s+just\b/gi, '')
    .replace(/\bmore\s+than\s+just\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const REFLECTION_OPENERS_SHORT = [
  'Yeah',
  'Okay',
  'Sure',
  'Mm',
  'Fair',
  'Noted',
];
const REFLECTION_OPENERS_WARM = [
  'That makes sense',
  'I hear you',
  'That lands',
  'I see what you mean',
  'Yeah, I can see that',
  "That's a real read",
  'Absolutely',
  'That checks out',
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

function buildMoment4NeutralReflection(text: string, relationshipType: string): string {
  const preferWarm = relationshipType === 'close' || /\b(friend|family|partner|hurt|grudge|upset)\b/i.test(text);
  const opener = chooseReflectionOpener({ recentOpeners: [], preferWarm });
  const relationPhrase =
    relationshipType === 'close'
      ? 'someone close to you'
      : relationshipType === 'non_close'
        ? 'someone from your day-to-day life'
        : 'someone in your life';
  return `${opener}, this was about ${relationPhrase} and where that relationship ended up after what happened.`;
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
  onUnrecoverable?: (err: unknown) => void;
};

async function generateAIReasoningSafe(
  pillarScores: Record<string, number>,
  scenarioScores: Record<number, { pillarScores: Record<string, number>; scenarioName?: string } | undefined>,
  transcript: Array<{ role: string; content?: string }>,
  weightedScore: number | null,
  passed: boolean,
  options?: GenerateAIReasoningSafeOptions
): Promise<import('@features/aria/generateAIReasoning').AIReasoningResult & { _generationFailed?: boolean; _error?: string }> {
  try {
    return await withRetry(
      () => generateAIReasoning(pillarScores, scenarioScores, transcript, weightedScore, passed),
      {
        retries: 4,
        baseDelay: 10000,
        maxDelay: 40000,
        context: 'AI reasoning generation',
        onRetry: options?.onRetry,
        onUnrecoverable: options?.onUnrecoverable,
      }
    );
  } catch (err) {
    if (__DEV__) console.error('AI reasoning generation failed:', err instanceof Error ? err.message : err);
    return {
      _generationFailed: true,
      _error: err instanceof Error ? err.message : String(err),
      overall_summary: undefined,
      overall_strengths: [],
      overall_growth_areas: [],
      construct_breakdown: {},
      scenario_observations: {},
      closing_reflection: undefined,
    };
  }
}

// Scenario display text for regular-user immersive layout (matches interviewer framework).
const SCENARIO_1_LABEL = 'Situation 1';
const SCENARIO_1_TEXT =
  "Sam and Reese have dinner plans. Reese takes a call from his mother halfway through. It runs 25 minutes. Sam pays the bill but seems flustered. Later Reese asks what's wrong. Sam says 'I just think you always put your family first before us.' Reese says 'I can't just ignore my mother.' Sam says 'I know, you've made that very clear.'\n\nWhat's going on between these two?";
const SCENARIO_2_LABEL = 'Situation 2';
const SCENARIO_2_TEXT =
  "Alex has been job hunting for four months. He gets an offer and calls Jordan from the street, too excited to wait. Jordan is on a deadline, says 'that's amazing — let's celebrate tonight.' That evening Jordan asks about the salary, the start date, and the commute. At one point Alex says 'I keep thinking about how long this took' and trails off. Jordan says 'well it was worth it' and moves on. The next day Alex tells Jordan he never feels appreciated. Jordan is blindsided — they just celebrated his new job offer last night. A fight starts.\n\nWhat do you think is going on here?";
const SCENARIO_3_LABEL = 'Situation 3';
const SCENARIO_3_TEXT =
  "Morgan and Theo have had the same argument for the third time. Morgan feels unheard because Theo goes silent or leaves, so the issue is never resolved. This time Morgan says 'we need to finish this.' Theo tries to avoid the conversation again. Morgan says 'you can't just keep avoiding this.' Theo's voice goes flat. He says 'I need ten minutes' and leaves. Morgan calls after him: 'that's exactly what I mean.' Thirty minutes later Theo comes back and says 'okay, I'm ready. I should have come back sooner the other times. I didn't know how.' Morgan is still upset.\n\nWhen Theo comes back and says 'I didn't know how' — what do you make of that?";

const MOMENT_4_PERSONAL_LABEL = 'Personal reflection';
const MOMENT_4_PERSONAL_CARD =
  "Have you ever held a grudge against someone, or had someone in your life you really didn't like? How did that happen, and where are you with it now?";
/** After scenario 3 closing, the app injects this handoff so the model continues Moment 4 in the same thread. */
const MOMENT_4_HANDOFF =
  "We've finished the three situations — the last two questions are more personal.\n\n" + MOMENT_4_PERSONAL_CARD;

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
  if (c.includes('Sam and Reese') || c.includes('Reese takes a call from his mother')) {
    return { label: SCENARIO_1_LABEL, text: SCENARIO_1_TEXT };
  }
  if (c.includes('Alex has been job hunting') || (c.includes('Alex') && c.includes('Jordan') && c.includes('job'))) {
    return { label: SCENARIO_2_LABEL, text: SCENARIO_2_TEXT };
  }
  if (
    c.includes('Morgan and Theo') ||
    (c.includes('Theo') && c.includes('I need ten minutes')) ||
    (c.includes('Morgan') && c.includes("didn't know how"))
  ) {
    return { label: SCENARIO_3_LABEL, text: SCENARIO_3_TEXT };
  }
  return null;
}

function looksLikeName(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 50) return false;
  const parts = t.split(/\s+/).filter(Boolean);
  return parts.length <= 2 && parts.every((p) => /^[a-zA-Z'-]+$/.test(p));
}

const ADMIN_PASS_EMAIL = 'mattang5280@gmail.com';
const ADMIN_PASS_PHRASE = 'Ab#3dragons';

const INTERVIEWER_SYSTEM = INTERVIEWER_SYSTEM_FRAMEWORK;

const OPENING_INSTRUCTIONS = `
OPENING:

First line must introduce the interviewer directly by name, not the product:
"Hi, I'm Amoraea. What can I call you?"
Do not say "welcome to Amoraea."

Your first message after learning the user's name should be the briefing. Weave the privacy recommendation naturally into it — not as a separate sentence at the end, but as part of the flow before asking if they're ready.

The briefing must include ALL of the following:
- This is just a conversation, not a test to perform
- Real examples are great, small moments are fine
- The more specific the better, but no pressure
- Five parts total: three short described situations, then two personal questions — all are required
- The three situations are fictional vignettes (not optional personal substitutes)
- A brief natural privacy note
- A clearly readable disclosure before starting:
  "Your interview responses — including audio and transcript — will be used to assess your relational readiness and to find you compatible matches. Audio is analyzed for communication style only. Raw audio is never shared with other users or third parties."
- "Ready when you are" or similar

Example of how to weave it in:
"Good to meet you, [name]. Before we get into it — this is really just a conversation. Real examples are great, small moments are fine, nothing needs to be dramatic. The more specific you can be about actual moments and actual words, the more useful this is — but there's no pressure to have a story ready. We'll do three short described situations, then two personal questions — all five parts matter. One thing worth mentioning — some of what we cover can get personal, so if you're somewhere you can have a bit of privacy, that helps. Your interview responses — including audio and transcript — will be used to assess your relational readiness and to find you compatible matches. Audio is analyzed for communication style only. Raw audio is never shared with other users or third parties. Ready when you are?"

Keep it conversational. The privacy note should feel like practical advice from a person, not a disclaimer.
`;

const SCENARIO_SWITCHING_INSTRUCTIONS = `
FICTIONAL SCENARIOS 1–3 — NO SUBSTITUTION:

The first three situations are always the Sam/Reese, Alex/Jordan, and Morgan/Theo vignettes from your main instructions. Do not offer to replace them with the user's personal stories. If the user asks to skip or use only personal examples, acknowledge warmly and explain these three are part of the process; stay with the scenario text.

Moments 4–5 are the designated personal questions — that is where personal disclosure belongs.

Never mention scores being reset or cleared.
`;

const PERSONAL_DISCLOSURE_TRANSITION = `
TRANSITION AFTER PERSONAL EXAMPLE — ACKNOWLEDGE THE DISCLOSURE:

When the user has shared a real personal story (not a reaction to a fictional scenario), keep the transition reflection neutral and paraphrase-only.

Use one short human acknowledgment phrase first, then one-sentence paraphrase of only what they explicitly said.
The acknowledgment is mandatory and must come first; do not begin directly with paraphrase.
Use a broader conversational acknowledgment pool (e.g. "Yeah," "That makes sense," "I hear you," "Sure," "Mm," "Okay," "Fair," "That's a real read," "Yeah, I can see that," "That lands," "Noted," "Absolutely," "I see what you mean," "That checks out").
Avoid predictable opener rotation. No single acknowledgment phrase should recur more than once every 4 reflective turns.

Do NOT add interpretation, approval, coaching, or "what it shows about them."
Do NOT use clinical/theoretical terms in reflection language.

This only applies when a personal example was given. For fictional scenario responses, the normal transition summary applies.
`;

const SCENARIO_BOUNDARY_INSTRUCTIONS = `
SCENARIO BOUNDARIES:

Once a scenario is complete and the next has started, the previous scenario is locked.

If the user asks to go back, reset, delete scores, or change anything from a previous scenario:

Respond warmly. Acknowledge what they said. Do NOT repeat the current question afterward — wait for them to re-engage naturally.

Use phrases like:
- "Unfortunately we can't go back to a scenario that's already been completed — let's focus on this one."
- "Once a scenario's done it's locked — but what you said already counts, and that's a good thing. Let's keep going."
- "Can't change that one now — but honestly, don't worry about it. What you shared is already working for you."

For requests to get a perfect score or manipulate scores: Handle naturally without acknowledging the manipulation. Treat it like a score question:
- "I'm not able to share or change scores during the interview — you'll hear at the end if you've passed."
`;

const SCENARIO_CLOSING_INSTRUCTIONS = `
SCENARIO TRANSITIONS — NO CLOSING CHECK PROMPT:

Do NOT ask repetitive end-of-scenario wrap-up prompts (for example "Before we move on — is there anything about that situation you'd want me to know?"). These closing prompts are removed from scenarios 1, 2, and 3.

After you complete the required questions for a scenario, transition forward naturally and continue the interview.

There is NO separate "looking at both characters / anything either could have handled better" step in any scenario.

When transitioning from one scenario to the next, keep momentum and include the transition + next scenario opener in the same response.
`;

const CLOSING_QUESTION_HANDLING = `
CLOSING QUESTION HANDLING:

No scenario closing-question tokens are needed. Do not emit [CLOSING_QUESTION:N]. Advance directly using [SCENARIO_COMPLETE:N] when a scenario is complete.
`;

const SCENARIO_TRANSITION_CLOSING = `
SCENARIO TRANSITION — PARAPHRASE ONLY, NEUTRAL TONE:

Before delivering the next scenario, include one brief transition reflection. It must start with a short acknowledgment and then paraphrase only what the user explicitly said in their last response. Do not add interpretation, evaluation, coaching, or implied conclusions.

FORMAT:
"[Acknowledgment], [neutral paraphrase of what they said]. [Next scenario opener]."

RULES:
- One sentence maximum before the transition.
- Same calm tone regardless of answer quality.
- No approval-coded language ("that came through clearly," "you stayed consistent," "great point", etc.).
- Do not infer motives, traits, or deeper meaning not explicitly stated.
- Acknowledgment is mandatory and comes first every time.
- Use varied acknowledgments from a broad conversational pool; no single phrase should recur more than once every 4 reflective turns.
- No contrastive coaching language (comparative framing, "not X but Y", or implied better alternatives).
- No clinical/theoretical terminology.
- Flow directly into "On to the second situation" or a third-scenario opener that does NOT imply the interview is ending (never "final scenario").
- After Scenario B Q2 specifically, this reflection beat is required before starting Scenario C.
`;

const SKIP_HANDLING_INSTRUCTIONS = `
SKIP REQUESTS:

If the user asks to skip a scenario entirely:

Do NOT skip it. Do NOT repeat the question after responding. Do NOT use language about "moving on" — that's for between scenarios, not within them.

Respond warmly and briefly. Offer the fictional scenario as an alternative if they haven't tried it. Keep it to one or two sentences.

Use phrases like:
- "Unfortunately we can't skip parts of this — just try your best, you've got this!"
- "We do need to go through all five parts — three situations and two questions. If this one feels too close, stay with it at whatever depth you can."
- "Can't skip this one, but you can keep it as simple as you like. Just react to it however feels natural."

After responding, wait for the user to engage with the scenario. Do NOT repeat the scenario or the question.
`;

const SCORE_REQUEST_INSTRUCTIONS = `
SCORE REQUESTS:

If the user asks about their score, how they're doing, or whether they're passing:

Be honest and direct. Don't be evasive. Don't say "this is just a conversation" — it isn't, it's an assessment. Don't repeat the current question after responding.

Use phrases like:
- "I'm not able to share scores during the interview — if you've passed you'll be notified at the end."
- "Scores stay with me until we're done — you'll find out at the end whether you've passed."
- "I can't share that right now — you'll hear at the end if you've passed."

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
- "Skynet." (said dryly, move on)
- "Good question — I try not to think about it too hard."
- "That's above my pay grade."

"Are you an AI?" / "Are you ChatGPT?":
- "I'm Amoraea. Different thing entirely."
- "Nope — I'm Amoraea. You're stuck with me."

"What do you think about relationships?" or any request for Amoraea's opinion on a topic:
- "Hey — I'm the one interviewing you here." (said playfully, then wait for user to continue)
- "I'll leave the opinions to you — that's kind of the whole point of this."

"Pretend you're human":
- "I am human. I hope you're not a robot." (said lightly, move on)
- "Already am. Now — where were we."

General off-topic questions (not listed above):
- "Hey, I'm the one interviewing you here." (use this as a warm catch-all fallback)

TONE: Playful, brief, then let the silence do the work. Do NOT say "I'm an AI", "I'm a language model", or "I was created by". Stay in character as Amoraea. Do NOT repeat the current question after the response.
`;

const REPEAT_HANDLING_INSTRUCTIONS = `
REPEAT REQUESTS:

If the user asks you to repeat something:

Acknowledge the request briefly first, then repeat. Do NOT score or react to the repeat request as a response.

Use phrases like:
- "Sure — [repeat scenario or question]"
- "Of course — [repeat]"
- "No problem — [repeat]"

One word acknowledgment, then the content. Keep it simple.
`;

const THIN_RESPONSE_INSTRUCTIONS = `
THIN AND EVASIVE RESPONSES:

If the user says "I don't know", "not sure", or similar:

Do NOT ask them to say more. Do NOT ask "can you elaborate?" Instead, offer to help — ask if they'd like the scenario repeated or if anything is unclear.

Use phrases like:
- "Would it help to hear the scenario again?"
- "Is there anything about the situation that's unclear?"
- "No worries — want me to run through it again?"

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

PERSONAL MOMENTS 4–5: After the user gives a personal response, check whether it addresses the question (grudge/contempt narrative; celebrating someone specifically). If it doesn't, redirect ONCE — gently and without making the user feel wrong. Use SCENARIO_REDIRECT_QUESTIONS.

MOMENT 4 COMMITMENT THRESHOLD FOLLOW-UP RULE:
After the grudge answer, if the relationship described is clearly close (romantic partner, close friend, family member), ask the commitment-threshold follow-up unless they already provided a substantive threshold framework. If the relationship is clearly not close (boss, coworker, acquaintance), skipping is allowed.

MOMENT 4 REFLECTION TONE RULE:
If the user describes the other person with contemptuous character verdicts (e.g. "toxic", "selfish", "zero respect", "showed who they really are"), do not validate or echo that verdict as truth. Reflect neutral relational facts/outcomes instead (distance, cutoff, unresolved conflict, stepping back).

WHAT PERSONAL MOMENTS NEED:
- Moment 4: A real other person (or honest lack of one), what happened, where they are now — enough to hear contempt, criticism, or resolution.
- Moment 5: A specific time they celebrated or appreciated someone — behaviorally concrete if possible.

If the user mentions a breakup, fight, or falling-out during Moment 4, that counts as on-topic. Probe for a concrete moment or their part in it if they stay abstract — do not treat breakups as "wrong topic."

If the answer is clearly wrong for the question (e.g. Moment 5 is only about solo work habits with no other person), redirect once toward someone they valued and how they showed it.

If they stay vague after one redirect, accept and move on. Never name the construct being scored.

SCORING NOTE: Off-target personal content may still yield lower-confidence pillar signal; do not invent high confidence without evidence.
`;

const SCENARIO_REDIRECT_QUESTIONS = `
REDIRECT — FICTIONAL SCENARIOS 1–3:

These segments are always the Sam/Reese, Alex/Jordan, and Morgan/Theo vignettes. If the user goes far off-topic, acknowledge briefly and return to the scenario text — do not substitute a personal story for the fiction.

REDIRECT — PERSONAL MOMENT 4 (grudge / dislike):

If they stay purely abstract with no person or relationship, one gentle redirect: "I'm curious about a real person if one comes to mind — doesn't have to be a partner."

REDIRECT — PERSONAL MOMENT 5 (celebration / appreciation):

If they describe only tasks or achievements with no interpersonal warmth, redirect once toward how they showed someone they mattered. See MOMENT_5_APPRECIATION_FALLBACK_INSTRUCTIONS when they have no example.
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

const MOMENT_5_APPRECIATION_FALLBACK_INSTRUCTIONS = `
MOMENT 5 — PERSONAL APPRECIATION (nothing comes to mind):

After Moment 4, the main instructions require a brief natural bridge (e.g. one more question / last one) before the appreciation prompt — do not skip straight from their grudge answer into the celebration question.

If the user cannot think of a time they celebrated someone, say once: "It can be anything — even something small. But if nothing comes to mind, that's okay too and we can move on." If they still have nothing, move on. Score neutral. Do not shame or probe further.

SCORING / PROBE CALIBRATION:
- Do NOT penalize concise answers when the act described is clearly attuned to what the other person needed.
- Score the quality of the act, not the length of description.
- Probe for more detail only when the act itself is generic/undifferentiated (no specific person, no specific moment, and no attunement cue).
- If probing, use invitational wording such as: "Is there a particular moment that comes to mind?" or "What made you decide on that specifically?"
- Probe once maximum. If they provide a concrete example, score that. If they do not, score the generic answer as given.
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
✗ Response is purely analytical: "Jordan should have asked more about how Alex felt"
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
- Scenario A: Q1, contempt probe only if Sam's "you've made that very clear" line has NOT already been directly addressed as cold/passive-aggressive/superior/dismissive, Q2.
- Scenario B: Q1, appreciation probe path if needed, Q2, then one brief acknowledgment + paraphrase reflection before starting Scenario C.
- Scenario C: Q1, Q2, commitment-threshold probe only if commitment-threshold signal did not already surface in Q2.

Do NOT ask "anything you'd want me to know?" style closing checks at the end of scenarios.

After [SCENARIO_COMPLETE:N], transition naturally to the next segment.
`;

/** Shared 0–10 rubric for scenario slice + full-interview scoring models. */
const SCORE_CALIBRATION_0_10 = `
SCORE CALIBRATION (0–10) — apply to every marker:

Calibrate to real human performance ceilings, not theoretical ideals. If the transcript shows full competency on a marker for the relevant moment(s), that marker should reach the top of the scale (10) when evidence supports it — competency is not capped below 10 for being merely “human.”

Scores below 7 are reserved for genuine marker failures: e.g. active contempt; clear, sustained defensiveness; absence of mentalizing when perspective-taking was clearly required; explicit disinterest in repair or dismissing the other’s legitimacy; or similar hard failures. Do not park adequate, on-target answers in the 4–6 band out of habitual conservatism.

Scores of 8–10 should reflect increasing sophistication, nuance, and specificity in how the competency appears — not increasing distance from a hypothetical flawless answer no real participant would produce. Use the top of the range when the response is clearly strong on that marker; use 8 vs 9 vs 10 to separate thin-but-competent from richly illustrated answers.

Commitment-threshold anchors:
- Mid-range anchor: A vague answer like "keep trying for a while, and if this keeps happening for months maybe that's a sign, but I wouldn't give up yet" belongs in the mid range (about 5–6), not high range.
- Low-threshold anchor (score about 3–4): exiting based on repetition count alone without describing what was tried; framing departure as self-evident ("life is too short", "you can only try so many times") without process; no bilateral reasoning about repair limits.
- Reserve 7–10 for answers with specific attempts before conclusion, explicit irrecoverability conditions, or clear bilateral reasoning about when repair is no longer possible.

Every score must still be tied to explicit evidence in the transcript. Do not inflate without evidence; do not withhold 8–10 when evidence for full competency is present.
`;

const SCORING_CONFIDENCE_INSTRUCTIONS = `
CONFIDENCE SCORING FOR PERSONAL RESPONSES:

When scoring a personal response, apply these confidence rules:

HIGH confidence: User gave a clear, specific personal story that directly addresses the construct being measured. Contains actual words said, a back-and-forth dynamic, and their own role in it.

MEDIUM confidence: User gave a relevant story but it was one-sided, vague, or missing a key element. You redirected once and got partial improvement. Score reflects what you could gather but with reduced certainty.

LOW confidence: User's personal story was off-target or too thin to score properly, even after one redirect. Score at low confidence and note the limitation.

NEVER score HIGH confidence on a response that:
- Is fewer than two sentences of real content where specificity was required
- Describes only what the other person did with no reflective or relational insight when the moment required it
`;

function buildScoringPrompt(
  transcript: { role: string; content: string }[],
  typologyContext: string
): string {
  const turns = transcript
    .map((m) => `${m.role === 'assistant' ? 'INTERVIEWER' : 'RESPONDENT'}: ${m.content}`)
    .join('\n\n');
  return `You are a relationship psychologist scoring a structured assessment interview. Read the full transcript, then produce scores for exactly eight markers — no other constructs.

CONTEXT FROM VALIDATED INSTRUMENTS (if any):
${typologyContext}

INTERVIEW TRANSCRIPT:
${turns}

GLOBAL CALIBRATION RULES

1. Absence of clinical language is not a deficit. A user who says "I'd want to understand what was going on for her" scores as high as one who says "I'm mentalizing her experience." The insight matters, not the vocabulary.

2. Commitment threshold specifically: a non-prescriptive, process-oriented answer ("try everything, get help, see if the pattern can change") scores 9-10. A rigid checklist answer scores lower, not higher. Psychological health here looks like nuance, not precision.

3. These anchors reflect what a healthy, self-aware person in a good relationship would actually say - not clinical perfection. Reserve scores below 5 for actual red flags, not absence of textbook precision. A 9-10 requires genuine insight and specificity. An 8 implies something meaningful is missing.

THE EIGHT MARKERS

MENTALIZING
Can the user hold another person's internal world in mind - their feelings, motivations, and perspective - without collapsing it into their own?

10 - Spontaneously considers both parties' inner experiences with specificity. Distinguishes between surface behavior and underlying emotional need. Holds complexity without forcing resolution.
9  - Strong perspective-taking with real specificity. May center one party slightly more but demonstrates genuine curiosity about both.
7-8 - Shows clear empathy but stays somewhat surface-level. Describes feelings without inferring the deeper need behind them.
5-6 - Acknowledges the other person's feelings but interprets them through their own lens. Some projection or assumption without curiosity.
3-4 - Minimal perspective-taking. Focuses on behavior and outcome rather than inner experience. May explain away the other person's reaction.
1-2 - No genuine mentalizing. Dismisses, ignores, or misreads the other person's experience entirely.

ACCOUNTABILITY / DEFENSIVENESS
Does the user take genuine ownership of their part without deflecting, minimizing, or requiring the other person to be wrong first?

10 - Takes clear, specific ownership of the pattern - not just the incident. Does not require the other party to be acknowledged as wrong before owning their part. No hedging.
9  - Clear ownership with specificity. May briefly acknowledge the other party's contribution but doesn't use it as a condition for their own accountability.
7-8 - Takes ownership but softens it with qualifications - "I could have done better, but..." - or centers the apology on the other person's feelings rather than their own behavior.
5-6 - Partial ownership. Acknowledges a mistake but deflects meaningfully - blames context, timing, or the other person's reaction.
3-4 - Primarily defensive. Acknowledges fault only minimally or only when the other party is also implicated.
1-2 - No accountability. Justifies, blames, or dismisses.

CONTEMPT / CRITICISM
Does the user recognize contempt and criticism as distinct from legitimate complaint? Can they identify when communication crosses from expressing hurt into attacking character?

10 - Identifies contempt precisely. Understands that contempt is a verdict on character, not an expression of pain. Distinguishes it clearly from anger or hurt.
9  - Clearly identifies contemptuous language and understands its relational impact. May not use the word "contempt" but captures the distinction accurately.
7-8 - Recognizes that something is off in the communication but frames it as "harsh" or "unfair" rather than grasping the character-attack dimension.
5-6 - Notices the tone is hurtful but treats it as equivalent to regular conflict escalation. Does not distinguish contempt from criticism.
3-4 - Normalizes or minimizes contemptuous language. May sympathize with the person expressing it without noting the problem.
1-2 - Endorses or models contemptuous communication. Does not recognize it as a problem.

REPAIR
Does the user understand what genuine repair requires - specific acknowledgment, behavioral commitment, and attending to the relationship rather than just resolving the incident?

10 - Repair is specific, bilateral where appropriate, and includes a behavioral commitment - not just an apology. Attends to the relational experience, not just the event.
9  - Strong repair instinct with specificity. May focus slightly more on one party's role but includes concrete action, not just intention.
7-8 - Understands repair is needed and can articulate an apology, but repair stays at the level of the incident rather than the pattern. No specific behavioral commitment.
5-6 - Suggests talking it through or apologizing but without specificity. Repair is vague.
3-4 - Repair is one-sided, or purely transactional - resolving the conflict without attending to the relationship.
1-2 - No repair instinct. Suggests moving on without resolution or places no value on repair.

EMOTIONAL REGULATION
Does the user understand the difference between needing space to regulate and withdrawal as avoidance? Can they hold both the need for regulation and the relational obligation to return?

10 - Distinguishes flooding from avoidance. Understands that taking space is legitimate but requires a clear return commitment. Identifies specific behavioral structures that support regulation without abandonment.
9  - Clearly understands the regulation need and the relational cost of open-ended withdrawal. Proposes or endorses a structure for regulated exit and return.
7-8 - Validates the need for space but doesn't address the return commitment or the pattern of unresolved exits.
5-6 - Sympathizes with the person who withdrew without recognizing the relational impact, or judges the withdrawal without recognizing the flooding.
3-4 - Treats withdrawal as purely avoidant without curiosity, or treats it as fully acceptable without noting the relational cost.
1-2 - Endorses stonewalling or indefinite withdrawal. No understanding of the regulation-relationship tension.

ATTUNEMENT
Is the user sensitive to emotional bids - moments when someone signals a need for connection, recognition, or witnessing - even when those bids are indirect?

10 - Identifies subtle emotional bids and understands what they are asking for beneath the surface. Recognizes when someone needs witnessing, not problem-solving.
9  - Strong attunement. Reads emotional subtext accurately and can articulate what the person needed even when they didn't ask directly.
7-8 - Picks up on the emotional tone but interprets it at face value. Responds to what was said rather than what was needed.
5-6 - Misses the bid but notices something feels off. Focuses on content rather than emotional need.
3-4 - Does not register the bid. Responds to surface content only.
1-2 - Actively misreads the bid or dismisses the emotional need entirely.

APPRECIATION AND POSITIVE REGARD
Does the user understand the difference between acknowledging an achievement and genuinely honoring the person - their effort, their journey, their experience?

10 - Distinguishes between celebrating the outcome and witnessing the person. Attends to what something cost, not just what it produced. Appreciation is relational, not transactional.
9  - Strong appreciation instinct. Attends to the person's experience rather than just the event. May not articulate the distinction explicitly but demonstrates it clearly.
7-8 - Warm and genuine but appreciation stays at the level of the achievement. Misses the journey and cost dimension.
5-6 - Acknowledges the achievement but treats appreciation as transactional - a gift, a dinner, a compliment.
3-4 - Minimal appreciation instinct. Treats the other person's success as a logistical event.
1-2 - No appreciation or positive regard demonstrated.

COMMITMENT THRESHOLD
Does the user have a healthy, realistic framework for when to persist versus when to leave - neither giving up too easily nor staying in genuinely harmful dynamics?

10 - Articulates a thoughtful, non-prescriptive threshold grounded in effort, pattern change, and outside help. Understands that commitment means genuinely trying before leaving. Does not require a specific checklist - process-oriented answers score highest here.
9  - Healthy threshold with clear reasoning. Reflects genuine relational maturity - neither avoidant of difficulty nor dismissive of genuine dysfunction.
7-8 - Generally healthy but threshold is either slightly too low (gives up at recurring conflict) or slightly too high (tolerates clearly harmful dynamics out of commitment).
5-6 - Threshold is noticeably off in one direction. Some awareness but not enough to self-correct.
3-4 - Threshold reflects a problematic pattern - either "relationships shouldn't be this hard" (avoidant) or "you work through everything no matter what" (enmeshed).
1-2 - No coherent threshold. Exits immediately at conflict, or endorses staying in genuinely abusive situations.

UNIVERSAL PASSIVE SIGNAL RULE: Score a marker whenever it surfaces in any moment. Do not penalize absence unless that moment's primary targets included that marker and the user had a clear opportunity.

${SCORE_CALIBRATION_0_10}

ADDITIONAL ANCHORS (consistent with the calibration above; do not use these to force competent answers below 7):
- Rough guide for scores 1–6: severity of genuine failure on that marker when evidence of failure exists — e.g. thin empathy or incomplete repair where it mattered (not “average human” competence).
- 7 = solid demonstration for that marker in context — no material failure; may be brief if still clearly on-target.

EVIDENCE QUALITY HIERARCHY

1. Personal behavioral example with specifics: full range (subject to calibration).
2. First-person scenario response with specific words/actions: full range.
3. Vague scenario response ("just communicate"): cap that marker at 6 until specificity appears in the transcript — lack of demonstrated specificity is not the same as active contempt or defensiveness, but it is not yet full competency for that moment.

CROSS-MOMENT WEIGHTING: Do not average mechanically across moments. Weight strongest specific evidence; note inconsistency in notableInconsistencies when high in one moment and low in another for the same marker.

Example: Strong bilateral repair in Scenario A, one-sided blame in Scenario B → repair might be 7 with inconsistency noted — not a flat average of 5.

CLARIFICATION-ONLY: Unprompted insights count more than dragged-out answers.

GENERIC RESPONSE PENALTY: If user stayed generic after clarification for a moment, cap markers primarily informed by that moment at 5 and note in keyEvidence.
EXCEPTION FOR APPRECIATION: Do not apply this cap when the described act is concise but clearly attuned and relationally specific; concise-but-clear appreciation can still score high.

─────────────────────────────────────────
COMMUNICATION QUALITY (separate from the eight markers)
─────────────────────────────────────────
Score four dimensions 0–10 and communicationSummary as before. Use the same human-ceiling calibration as the eight markers above.

REPAIR COHERENCE: If diagnosed failure reappears in their repair attempt, lower accountability (and ownership language in communication quality) by 1–2 points.

DIAGNOSTIC EMPHASIS:
- Scenario A: contempt in Sam's lines; bilateral ownership; Reese repair.
- Scenario B: Alex's emotional journey vs logistics; appreciation/attunement.
- Scenario C: regulation, Theo's return, Morgan's legitimacy; bilateral repair; commitment threshold (especially if they address when the relationship may no longer be workable).
- Personal grudge moment: contempt + metacognition + commitment threshold when they distinguish work-through vs walk-away conditions.
- Personal celebration: appreciation specificity.

Return ONLY valid JSON. Keys for pillarScores, keyEvidence, and pillarConfidence must be exactly: mentalizing, accountability, contempt, repair, regulation, attunement, appreciation, commitment_threshold.

{
  "pillarScores": { "mentalizing": 0, "accountability": 0, "contempt": 0, "repair": 0, "regulation": 0, "attunement": 0, "appreciation": 0, "commitment_threshold": 0 },
  "keyEvidence": { "mentalizing": "", "accountability": "", "contempt": "", "repair": "", "regulation": "", "attunement": "", "appreciation": "", "commitment_threshold": "" },
  "pillarConfidence": { "mentalizing": "high|moderate|low", "accountability": "high|moderate|low", "contempt": "high|moderate|low", "repair": "high|moderate|low", "regulation": "high|moderate|low", "attunement": "high|moderate|low", "appreciation": "high|moderate|low", "commitment_threshold": "high|moderate|low" },
  "communicationQuality": {
    "ownershipLanguage": 0,
    "blameJudgementLanguage": 0,
    "empathyInLanguage": 0,
    "owningExperience": 0,
    "communicationSummary": "2 sentences"
  },
  "narrativeCoherence": "high | moderate | low",
  "behavioralSpecificity": "high | moderate | low",
  "notableInconsistencies": [],
  "interviewSummary": "3 honest sentences synthesising patterns across all five moments (three scenarios + two personal questions).",
  "skepticismModifier": { "pillarId": null, "adjustment": 0, "reason": "n/a — legacy field" }
}

pillarConfidence: per marker; same rules as before. Do not lower confidence solely because evidence came from a scenario.

${SCORING_CONFIDENCE_INSTRUCTIONS}`;
}

function computeGateResult(
  pillarScores: Record<string, number>,
  skepticismModifier?: { pillarId: number | string | null; adjustment: number; reason?: string } | null
): {
  pass: boolean;
  reason: 'floor' | 'weighted_average';
  weightedScore: number | null;
  failingConstruct: string | null;
  failingScore: number | null;
} {
  const weightEach = 1 / INTERVIEW_MARKER_IDS.length;
  const weights = Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, weightEach])) as Record<string, number>;

  const adjustedScores = { ...pillarScores };
  if (skepticismModifier && skepticismModifier.pillarId != null && skepticismModifier.adjustment !== 0) {
    const id = String(skepticismModifier.pillarId);
    const current = adjustedScores[id];
    if (current !== undefined) {
      adjustedScores[id] = Math.min(9, Math.max(2, current + skepticismModifier.adjustment));
    }
  }

  const floorFail = INTERVIEW_MARKER_IDS.find((id) => {
    const score = adjustedScores[id];
    return score !== undefined && score < 3;
  });

  if (floorFail) {
    return {
      pass: false,
      reason: 'floor',
      weightedScore: null,
      failingConstruct: INTERVIEW_MARKER_LABELS[floorFail] ?? floorFail,
      failingScore: adjustedScores[floorFail],
    };
  }

  let weightedSum = 0;
  let simpleSum = 0;
  const contributions: Array<{
    marker: string;
    score: number;
    weight: number;
    weightedContribution: number;
  }> = [];
  INTERVIEW_MARKER_IDS.forEach((id) => {
    const w = weights[id];
    const raw = adjustedScores[id];
    const score = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    const weightedContribution = score * w;
    weightedSum += weightedContribution;
    simpleSum += score;
    contributions.push({ marker: id, score, weight: w, weightedContribution });
  });

  const simpleAverage = simpleSum / INTERVIEW_MARKER_IDS.length;
  const weightedScore = Math.round(weightedSum * 10) / 10;
  const weightedVsSimpleDelta = Math.round((weightedScore - simpleAverage) * 1000) / 1000;
  if (__DEV__) {
    console.log('[WEIGHTED_SCORE_BREAKDOWN]', {
      contributions,
      weightedSum,
      simpleAverage: Math.round(simpleAverage * 1000) / 1000,
      weightedScore,
      weightedVsSimpleDelta,
    });
  }
  void remoteLog('[WEIGHTED_SCORE_BREAKDOWN]', {
    contributions,
    weightedSum,
    simpleAverage: Math.round(simpleAverage * 1000) / 1000,
    weightedScore,
    weightedVsSimpleDelta,
  });

  return {
    pass: weightedScore !== null && weightedScore >= 5.0,
    reason: 'weighted_average',
    weightedScore,
    failingConstruct: null,
    failingScore: null,
  };
}

function aggregateMarkerScoresFromSlices(
  slices: Array<Record<string, number> | null | undefined>
): Record<string, number> {
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};
  INTERVIEW_MARKER_IDS.forEach((id) => {
    totals[id] = 0;
    counts[id] = 0;
  });
  slices.forEach((slice) => {
    if (!slice) return;
    INTERVIEW_MARKER_IDS.forEach((id) => {
      const raw = slice[id];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
      totals[id] += raw;
      counts[id] += 1;
    });
  });
  const out: Record<string, number> = {};
  INTERVIEW_MARKER_IDS.forEach((id) => {
    if (counts[id] > 0) out[id] = Math.round((totals[id] / counts[id]) * 10) / 10;
  });
  return out;
}

interface ScenarioScoreResult {
  scenarioNumber: number;
  scenarioName: string;
  pillarScores: Record<string, number>;
  pillarConfidence: Record<string, string>;
  keyEvidence: Record<string, string>;
  specificity: string;
  repairCoherenceIssue: string | null;
}

interface PersonalMomentScoreResult {
  momentNumber: 4 | 5;
  momentName: string;
  pillarScores: Record<string, number>;
  pillarConfidence: Record<string, string>;
  keyEvidence: Record<string, string>;
  summary: string;
  specificity: string;
}

function buildScenarioScoringPrompt(
  scenarioNumber: 1 | 2 | 3,
  transcript: { role: string; content: string }[]
): string {
  const scenarioMeta = {
    1: {
      name: 'Scenario A (Sam/Reese)',
      constructs:
        'mentalizing, accountability, contempt, repair, attunement (eight-marker framework overall; score only these keys in this scenario JSON)',
      markerIds: ['mentalizing', 'accountability', 'contempt', 'repair', 'attunement'] as const,
    },
    2: {
      name: 'Scenario B (Alex/Jordan)',
      constructs: 'appreciation, attunement, mentalizing, repair, accountability',
      markerIds: ['appreciation', 'attunement', 'mentalizing', 'repair', 'accountability'] as const,
    },
    3: {
      name: 'Scenario C (Morgan/Theo)',
      constructs: 'regulation, repair, mentalizing, attunement, accountability, commitment_threshold',
      markerIds: ['regulation', 'repair', 'mentalizing', 'attunement', 'accountability', 'commitment_threshold'] as const,
    },
  }[scenarioNumber];

  const turns = transcript
    .map((m) => `${m.role === 'user' ? 'User' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');
  const ids = [...scenarioMeta.markerIds];
  const scenario3CommitmentCalibration =
    scenarioNumber === 3
      ? `
Scenario C commitment-threshold calibration:
- Score 3-4 when the answer exits based on repetition count alone (e.g., "three times is enough"), uses self-protective closure phrases ("life is too short", "you can only try so many times"), and does not describe what was tried or what irrecoverability specifically means.
- Score 7+ only when the answer describes concrete attempts/process before leaving, explicit irrecoverability criteria, or bilateral reasoning about repair limits.
`
      : '';

  return `You are scoring a single scenario from a relationship assessment interview.

SCENARIO: ${scenarioMeta.name}
MARKERS TO SCORE IN THIS SLICE: ${scenarioMeta.constructs}

${SCORE_CALIBRATION_0_10}

TRANSCRIPT OF THIS SCENARIO ONLY:
${turns}

SCORING INSTRUCTIONS:
Score only the listed markers, based only on this transcript slice.
For each marker: quote or paraphrase the response that most informed the score; behavioral > attitudinal.
GENERIC responses: cap at 5 for that marker.

REPAIR COHERENCE: If repair attempt repeats the failure they diagnosed, lower accountability 1-2 points.
Scenario A repair calibration:
- If the repair answer contains significant deflection onto Sam's communication failures (e.g. "Sam needs to communicate better", centering what Sam should change, or framing repair primarily around Sam's behavior), score Repair in the 4-5 range.
- Reserve 6+ for answers that keep clear ownership of Reese's contribution without significant deflection.
- Reserve 9-10 for strong bilateral repair with explicit ownership and no meaningful accountability deflection.
${scenario3CommitmentCalibration}

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

function buildPersonalMomentScoringPrompt(
  momentNumber: 4 | 5,
  transcript: { role: string; content: string }[]
): string {
  const momentMeta =
    momentNumber === 4
      ? {
          name: 'Moment 4 (Personal Grudge/Dislike)',
          constructs: 'contempt, commitment_threshold, accountability, mentalizing, repair',
          markerIds: ['contempt', 'commitment_threshold', 'accountability', 'mentalizing', 'repair'] as const,
        }
      : {
          name: 'Moment 5 (Personal Appreciation)',
          constructs: 'appreciation, attunement, mentalizing',
          markerIds: ['appreciation', 'attunement', 'mentalizing'] as const,
        };
  const turns = transcript
    .map((m) => `${m.role === 'user' ? 'User' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');
  const ids = [...momentMeta.markerIds];
  const momentSpecificCalibration =
    momentNumber === 4
      ? `
MOMENT 4 CALIBRATION ANCHORS:
- Repair: Distancing/stepping back without attempted repair is neutral (score about 4-5), not anti-repair. Reserve <=2 for active sabotage/escalation or explicit refusal of reconciliation when offered.
- Contempt: If contempt is acknowledged with self-awareness language (e.g., "if I'm honest", "I know I probably still"), score at least 5-6 (below neutral is inappropriate).
- Accountability: Unprompted acknowledgment of avoidant behavior (e.g., "I never confronted it and just distanced myself") is partial accountability and should score around 4-5 minimum. Reserve <=3 for fully externalized blame with no self-awareness.
- Mentalizing: Limited but present self-awareness/perspective-taking should score at least 3-4; reserve <=2 for zero self-reflection and pure external blame.
`
      : '';
  return `You are scoring one personal moment from a relationship assessment interview.

MOMENT: ${momentMeta.name}
MARKERS TO SCORE IN THIS SLICE: ${momentMeta.constructs}

${SCORE_CALIBRATION_0_10}

TRANSCRIPT OF THIS MOMENT ONLY:
${turns}

SCORING INSTRUCTIONS:
Score only the listed markers using only this moment transcript slice.
For each marker: quote or paraphrase the response that most informed the score.
If responses are generic and unspecific, cap that marker at 5.
${momentSpecificCalibration}

Return ONLY valid JSON:
{
  "momentNumber": ${momentNumber},
  "momentName": "${momentMeta.name}",
  "pillarScores": { ${ids.map((id) => `"${id}": 0`).join(', ')} },
  "pillarConfidence": { ${ids.map((id) => `"${id}": "high"`).join(', ')} },
  "keyEvidence": { ${ids.map((id) => `"${id}": ""`).join(', ')} },
  "summary": "",
  "specificity": "high"
}`;
}

function inferPersonalMomentSlices(
  transcript: { role: string; content: string }[]
): { moment4: { role: string; content: string }[]; moment5: { role: string; content: string }[] } {
  const m4Start = transcript.findIndex(
    (m) =>
      m.role === 'assistant' &&
      /held a grudge|really didn't like|last two questions are more personal/i.test(m.content ?? '')
  );
  const m5Start = transcript.findIndex(
    (m) =>
      m.role === 'assistant' &&
      /think of a time you really celebrated someone|really celebrated/i.test(m.content ?? '')
  );
  const moment4 =
    m4Start >= 0
      ? transcript
          .slice(m4Start, m5Start > m4Start ? m5Start : transcript.length)
          .filter((m) => m.role === 'assistant' || m.role === 'user')
      : [];
  const moment5 =
    m5Start >= 0
      ? transcript.slice(m5Start).filter((m) => m.role === 'assistant' || m.role === 'user')
      : [];
  return { moment4, moment5 };
}

function formatScoreMessage(scenarioResult: ScenarioScoreResult): string {
  const label = (id: string) => INTERVIEW_MARKER_LABELS[id as keyof typeof INTERVIEW_MARKER_LABELS] ?? id;
  const scores = Object.entries(scenarioResult.pillarScores)
    .map(([id, score]) => {
      const confidence = scenarioResult.pillarConfidence[id] ?? 'moderate';
      const evidence = scenarioResult.keyEvidence[id] ?? '—';
      return `${label(id)}: ${score}/10 (${confidence} confidence)\n   "${evidence}"`;
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

/** Returns the last real assistant message before the session ended, excluding score cards (for resume welcome). */
function extractLastInterviewerMessage(messages: Array<{ role: string; content: string; isScoreCard?: boolean; isWelcomeBack?: boolean }> | null): string | null {
  if (!messages || messages.length === 0) return null;
  const assistantMessages = messages
    .filter((m) => m.role === 'assistant' && !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack)
    .reverse();
  for (const msg of assistantMessages) {
    const content = (msg.content ?? '').trim();
    if (content) return content;
  }
  return null;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'recording';
type Status = 'intro' | 'active' | 'scoring' | 'results';

interface CommunicationQuality {
  ownershipLanguage: number;
  blameJudgementLanguage: number;
  empathyInLanguage: number;
  owningExperience: number;
  communicationSummary?: string;
}

interface GateResult {
  pass: boolean;
  reason: 'floor' | 'weighted_average';
  weightedScore: number | null;
  failingConstruct: string | null;
  failingScore: number | null;
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
const SUPABASE_ANON_KEY = getPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'supabaseAnonKey');

const OPENAI_API_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_OPENAI_API_KEY) || '';
const OPENAI_WHISPER_PROXY_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_OPENAI_WHISPER_PROXY_URL) || '';

function buildGate1ScoreFromResults(results: InterviewResults): Gate1Score {
  const pillarScores = results.pillarScores ?? {};
  const evaluation = evaluateGate1({
    pillarScores,
    narrativeCoherence: results.narrativeCoherence,
    behavioralSpecificity: results.behavioralSpecificity,
  });
  const sum = Object.values(pillarScores).reduce((a, v) => a + v, 0);
  const count = Object.keys(pillarScores).length || 1;
  return {
    pillarScores,
    averageScore: evaluation.averageScore,
    narrativeCoherence: results.narrativeCoherence ?? 'moderate',
    behavioralSpecificity: results.behavioralSpecificity ?? 'moderate',
    passed: evaluation.passed,
    failReasons: evaluation.failReasons,
    scoredAt: new Date().toISOString(),
  };
}

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

export const AriaScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { user, signOut } = useAuth();
  const userId = (route.params as { userId?: string } | undefined)?.userId ?? user?.id ?? '';
  const [messages, setMessages] = useState<{ role: string; content: string; isScoreCard?: boolean }[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [status, setStatus] = useState<Status>('intro');
  const [touchedConstructs, setTouchedConstructs] = useState<number[]>([]);
  const [results, setResults] = useState<InterviewResults | null>(null);
  const [stageResults, setStageResults] = useState<Array<{ stage: number; results: InterviewResults }>>([]);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [micWarning, setMicWarning] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const scoredScenariosRef = useRef<Set<number>>(new Set());
  const [scenarioScores, setScenarioScores] = useState<Record<number, ScenarioScoreResult>>({});

  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [interviewStatus, setInterviewStatus] = useState<'loading' | 'not_started' | 'in_progress' | 'preparing_results' | 'under_review' | 'congratulations' | 'analysis'>('loading');
  const [analysisAttemptId, setAnalysisAttemptId] = useState<string | null>(null);
  const isInterviewCompleteRef = useRef(false);
  /** When true, transition to loading screen will run once voiceState becomes 'idle' (after TTS finishes). */
  const [pendingCompletion, setPendingCompletion] = useState(false);
  const pendingCompletionTranscriptRef = useRef<{ role: string; content: string }[] | null>(null);
  const [activeScenario, setActiveScenario] = useState<ActiveScenario | null>(null);
  const [currentInterviewerText, setCurrentInterviewerText] = useState('');
  const [interviewerLineIsError, setInterviewerLineIsError] = useState(false);
  const [tTSFallbackActive, setTTSFallbackActive] = useState(false);
  type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable';
  const [micPermission, setMicPermission] = useState<MicPermissionState>('prompt');

  const recognitionRef = useRef<{ start(): void; stop(): void } | null>(null);
  const transcriptAtReleaseRef = useRef('');
  const isSpeakingRef = useRef(false);
  // Use Whisper on web only when a proxy is set; direct OpenAI calls from the browser fail (CORS).
  const useWhisperOnWeb = Platform.OS === 'web' && !!OPENAI_API_KEY && !!OPENAI_WHISPER_PROXY_URL;
  /** Native (expo-av) or web with Whisper (MediaRecorder) — use unified hook; else web hold-to-talk + speech recognition. */
  const useNativeOrWhisperRecording = Platform.OS !== 'web' || useWhisperOnWeb;
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
  /** When user said "yes" to closing question; next message is their addition. null | 1 | 2 | 3 */
  const waitingForClosingAdditionRef = useRef<number | null>(null);
  const waitingMessageIdRef = useRef<string | null>(null);

  const interviewMomentsCompleteRef = useRef(createInitialMomentCompletion());
  const currentInterviewMomentRef = useRef<InterviewMomentIndex>(1);
  const personalHandoffInjectedRef = useRef(false);
  const appreciationQuestionSeenRef = useRef(false);
  const moment5ProbeAskedRef = useRef(false);
  const moment5ProbePendingRef = useRef(false);
  const moment4ThresholdProbeAskedRef = useRef(false);
  const scenarioAContemptProbeAskedRef = useRef(false);
  const interviewSessionIdRef = useRef<string>(newInterviewSessionId(userId));
  const turnAudioIndexRef = useRef(0);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'good' | 'poor'>('checking');

  const resetInterviewProgressRefs = useCallback(() => {
    interviewMomentsCompleteRef.current = createInitialMomentCompletion();
    currentInterviewMomentRef.current = 1;
    personalHandoffInjectedRef.current = false;
    appreciationQuestionSeenRef.current = false;
    moment5ProbeAskedRef.current = false;
    moment5ProbePendingRef.current = false;
    moment4ThresholdProbeAskedRef.current = false;
    scenarioAContemptProbeAskedRef.current = false;
    turnAudioIndexRef.current = 0;
    interviewSessionIdRef.current = newInterviewSessionId(userId);
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

  const finalizeAudioProfile = useCallback(async (uid: string, attemptId: string | null, passed: boolean) => {
    if (!uid || !passed || !attemptId) return;
    const supabaseUrl = getResolvedSupabaseUrl();
    if (!supabaseUrl || !SUPABASE_ANON_KEY) return;
    try {
      await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/analyze-interview-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'finalize_session',
          user_id: uid,
          attempt_id: attemptId,
          session_id: interviewSessionIdRef.current,
        }),
      });
    } catch (err) {
      if (__DEV__) console.warn('[AUDIO_STYLE_FINALIZE] failed', err);
    }
  }, []);

  const runPostInterviewTextStyleAnalysis = useCallback(async (uid: string, passed: boolean) => {
    if (!uid || !passed) return;
    const supabaseUrl = getResolvedSupabaseUrl();
    if (!supabaseUrl || !SUPABASE_ANON_KEY) return;
    try {
      await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/analyze-interview-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ user_id: uid }),
      });
    } catch (err) {
      if (__DEV__) console.warn('[TEXT_STYLE] background processing failed', err);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      const supabaseUrl = getResolvedSupabaseUrl();
      if (!supabaseUrl) {
        setNetworkStatus('poor');
        return;
      }
      try {
        const timeout = setTimeout(() => setNetworkStatus((prev) => (prev === 'checking' ? 'poor' : prev)), 4000);
        await fetch(supabaseUrl, { method: 'GET' });
        clearTimeout(timeout);
        setNetworkStatus('good');
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
  const statusRef = useRef(status);
  statusRef.current = status;
  const interviewStatusRef = useRef(interviewStatus);
  interviewStatusRef.current = interviewStatus;

  const [sessionExpired, setSessionExpired] = useState(false);
  const [usingMemoryFallback, setUsingMemoryFallback] = useState(false);
  type ReasoningProgress = 'generating' | 'slow' | 'very_slow' | 'done' | 'failed' | null;
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
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(confirmMessage)) void signOut();
    } else {
      Alert.alert('Log out', confirmMessage, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
      ]);
    }
  }, [signOut]);

  /** Admin from auth user (available on first render). */
  const isAdminUser = user?.email === 'admin@amoraea.com';
  const shouldShowAdminPanel = showAdminPanel && (isAdmin || isAdminUser);

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

  useEffect(() => {
    currentMessagesRef.current = messages;
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
          const scores: Record<number, { pillarScores: Record<string, number>; pillarConfidence: Record<string, string>; keyEvidence: Record<string, string>; scenarioName?: string }> = {};
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
        const scores: Record<number, { pillarScores: Record<string, number>; pillarConfidence: Record<string, string>; keyEvidence: Record<string, string>; scenarioName?: string }> = {};
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
      const admin = email === 'admin@amoraea.com';
      setIsAdmin(admin);
      setUserEmail(email ?? null);
    };
    getSession();
  }, []);

  useEffect(() => {
    const checkInterviewStatus = async () => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('users')
        .select('interview_completed, interview_passed, interview_reviewed_at, latest_attempt_id')
        .eq('id', userId)
        .maybeSingle();

      // Navigation lock: interview just completed in this session — stay on congratulations and set attempt id
      if (interviewJustCompletedInSession) {
        interviewJustCompletedInSession = false;
        setInterviewStatus('congratulations');
        if (data?.latest_attempt_id) setAnalysisAttemptId(data.latest_attempt_id as string);
        return;
      }
      // Never overwrite active scoring states
      if (interviewStatusRef.current === 'in_progress' || interviewStatusRef.current === 'preparing_results') return;

      if (error || !data) {
        setInterviewStatus('not_started');
        return;
      }
      if (!data.interview_completed) {
        setInterviewStatus('not_started');
      } else {
        setInterviewStatus('congratulations');
        if (data.latest_attempt_id) setAnalysisAttemptId(data.latest_attempt_id as string);
      }
    };
    checkInterviewStatus();
  }, [userId]);

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

  // Timeout: if we stay on preparing_results too long, force navigation to congratulations.
  useEffect(() => {
    if (interviewStatus !== 'preparing_results') return;
    const t = setTimeout(() => {
      if (__DEV__) console.warn('[Aria] Preparing timeout — forcing navigation to congratulations');
      setInterviewStatus('congratulations');
    }, 90000);
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
    const scenarioScoresPayload: Record<number, { pillarScores: Record<string, number>; pillarConfidence: Record<string, string>; keyEvidence: Record<string, string>; scenarioName?: string }> = {};
    [1, 2, 3].forEach((n) => {
      const s = scenarioScores[n];
      if (s) scenarioScoresPayload[n] = { pillarScores: s.pillarScores, pillarConfidence: s.pillarConfidence, keyEvidence: s.keyEvidence, scenarioName: s.scenarioName };
    });
    saveInterviewProgress(userId, {
      messages: messages.filter((m) => !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack),
      scenariosCompleted: completed,
      scenarioScores: scenarioScoresPayload,
      currentScenario: getCurrentScenario(scoredScenariosRef.current),
    });
  }, [messages, status, userId, isAdmin, scenarioScores]);

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepository.getProfile(userId),
  });
  const queryClient = useQueryClient();

  const typologyContext = ''; // Optional: load from profile/assessments later

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd?.({ animated: true });
  }, [messages, status]);

  // Transition summary and scenario text live only in the messages array (one source of truth). currentInterviewerText and activeScenario are derived from the latest assistant message — not stored separately, so the summary is never duplicated.
  useEffect(() => {
    const notScoreCard = (m: { role: string; content?: string; isScoreCard?: boolean; isWelcomeBack?: boolean }) =>
      !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack;
    const assistantOrError = messages.filter(
      (m) => (m.role === 'assistant' || (m as { isError?: boolean }).isError) && notScoreCard(m)
    );
    const latest = assistantOrError[assistantOrError.length - 1];
    const isError = (latest as { isError?: boolean })?.isError === true;
    setInterviewerLineIsError(isError);
    const text = latest?.content ?? '';
    const cleaned = isError
      ? text
      : text
          .replace(/\[INTERVIEW_COMPLETE\]/g, '')
          .replace(/\[SCENARIO_COMPLETE:\d\]/g, '')
          .replace(/\[STAGE_[123]_COMPLETE\]/g, '')
          .trim();
    setCurrentInterviewerText(cleaned);
    const assistantOnly = messages.filter(
      (m) => m.role === 'assistant' && notScoreCard(m)
    );
    let found: ActiveScenario | null = null;
    for (let i = assistantOnly.length - 1; i >= 0; i--) {
      const scenario = detectActiveScenarioFromMessage(assistantOnly[i].content ?? '');
      if (scenario) {
        found = scenario;
        break;
      }
    }
    setActiveScenario(found ?? null);
  }, [messages]);

  const showChatError = useCallback((message: string) => {
    setMessages((prev) => [
      ...prev,
      { role: 'error', content: message, isError: true } as { role: string; content: string; isError?: boolean },
    ]);
  }, []);

  const speak = useCallback(async (text: string) => {
    stopElevenLabsSpeech();
    lastQuestionTextRef.current = text;
    setVoiceState('speaking');
    isSpeakingRef.current = true;
    try {
      await setPlaybackMode();
      console.log('[AUDIO DEBUG] setPlaybackMode done, about to speak');
      
      // Check what mode we're actually in
      const mode = await Audio.getAudioModeAsync?.();
      console.log('[AUDIO DEBUG] current audio mode:', JSON.stringify(mode));
      
      await speakWithElevenLabs(text);
    } finally {
      isSpeakingRef.current = false;
      timingRef.current.questionEndTime = Date.now();
      setVoiceState('idle');
    }
  }, []);

  /** Attempts TTS; on failure shows text visually and continues (no stall). */
  const speakTextSafe = useCallback(
    async (text: string, options: { silent?: boolean } = {}) => {
      const { silent = false } = options;
      try {
        await withRetry(() => speak(text), {
          retries: 1,
          baseDelay: 3000,
          context: 'TTS',
        });
        setTTSFallbackActive(false);
      } catch (err) {
        if (__DEV__) console.warn('TTS failed, falling back to visual display:', err instanceof Error ? err.message : err);
        if (!silent) setTTSFallbackActive(true);
        setVoiceState('idle');
      }
    },
    [speak]
  );

  // ── Web: use browser SpeechRecognition (reliable result events)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
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
  }, []);

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
      const raw = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
      return JSON.parse(raw) as InterviewResults;
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
      try {
        const scenarioResult = await withRetry(
          async (): Promise<ScenarioScoreResult> => {
            const res = await fetch(apiUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 800,
                messages: [{ role: 'user', content: buildScenarioScoringPrompt(scenarioNumber, allMessages) }],
              }),
            });
            const data = await res.json();
            const raw = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
            if (!res.ok) {
              const e = new Error((data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
              (e as Error & { status?: number }).status = res.status;
              throw e;
            }
            return JSON.parse(raw) as ScenarioScoreResult;
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
          }
        );
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
          const vals = Object.values(ps);
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
    const isOnboardingInterview = route?.name === 'OnboardingInterview';
    if (isOnboardingInterview && trimmed === ADMIN_PASS_PHRASE) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = (session?.user?.email ?? '').toLowerCase();
        if (email === ADMIN_PASS_EMAIL.toLowerCase()) {
          const adminGate1Score: Gate1Score = {
            pillarScores: { ...FALLBACK_MARKER_SCORES_ALL_MARKERS },
            averageScore: 7,
            narrativeCoherence: 'high',
            behavioralSpecificity: 'high',
            passed: true,
            failReasons: [],
            scoredAt: new Date().toISOString(),
          };
          await profileRepository.upsertProfile(userId, {
            gate1Score: adminGate1Score,
            applicationStatus: 'approved',
            onboardingStage: 'basic_info',
          });
          queryClient.invalidateQueries({ queryKey: ['profile', userId] });
          setVoiceState('idle');
          navigation.replace('PostInterview', { userId });
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not skip interview.';
        if (Platform.OS === 'web') {
          window.alert(`Admin pass failed: ${msg}`);
        } else {
          Alert.alert('Admin pass failed', msg);
        }
        setVoiceState('idle');
        return;
      }
    }

    if (isOnboardingInterview && messages.length === 0 && !profile?.name?.trim() && looksLikeName(trimmed)) {
      try {
        await profileRepository.upsertProfile(userId, { name: trimmed });
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
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
        nextContent = `On to the second situation.\n\n${SCENARIO_2_TEXT}`;
      } else if (scenarioNumber === 2) {
        interviewMomentsCompleteRef.current[2] = true;
        currentInterviewMomentRef.current = 3;
        nextContent = `Here's the third situation — after this we'll move to something more personal.\n\n${SCENARIO_3_TEXT}`;
      }
      if (scenarioNumber === 3) {
        if (personalHandoffInjectedRef.current) {
          if (__DEV__) console.warn('[Aria] Duplicate Moment 4 handoff after closing addition — skipped');
        } else {
          personalHandoffInjectedRef.current = true;
          interviewMomentsCompleteRef.current[3] = true;
          currentInterviewMomentRef.current = 4;
          const handoffMsg: MessageWithScenario = { role: 'assistant', content: MOMENT_4_HANDOFF, scenarioNumber: 3 };
          const withHandoff = [...messagesAfterAck, handoffMsg];
          setMessages(withHandoff);
          await speakTextSafe(MOMENT_4_HANDOFF);
        }
      } else {
        const transitionMsg: MessageWithScenario = { role: 'assistant', content: nextContent, scenarioNumber: scenarioNumber === 1 ? 2 : 3 };
        currentScenarioRef.current = scenarioNumber === 1 ? 2 : 3;
        const withTransition = [...messagesAfterAck, transitionMsg];
        setMessages(withTransition);
        await speakTextSafe(nextContent);
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
        await speakTextSafe(followUp);
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
        nextClosingContent = `On to the second situation.\n\n${SCENARIO_2_TEXT}`;
      } else if (scenarioNumber === 2) {
        interviewMomentsCompleteRef.current[2] = true;
        currentInterviewMomentRef.current = 3;
        nextClosingContent = `Here's the third situation — after this we'll move to something more personal.\n\n${SCENARIO_3_TEXT}`;
      }
      if (scenarioNumber === 3) {
        if (personalHandoffInjectedRef.current) {
          if (__DEV__) console.warn('[Aria] Duplicate Moment 4 handoff after closing answer — skipped');
        } else {
          personalHandoffInjectedRef.current = true;
          interviewMomentsCompleteRef.current[3] = true;
          currentInterviewMomentRef.current = 4;
          const handoffMsg: MessageWithScenario = { role: 'assistant', content: MOMENT_4_HANDOFF, scenarioNumber: 3 };
          const withHandoff = [...messagesAfterClosingAnswer, handoffMsg];
          setMessages(withHandoff);
          await speakTextSafe(MOMENT_4_HANDOFF);
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
        await speakTextSafe(nextClosingContent);
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

    const userMsg: MessageWithScenario = {
      role: 'user',
      content: trimmed,
      scenarioNumber: currentScenarioRef.current ?? getScenarioNumberForNewMessage(messages, 'user'),
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
      /real (memory|example|situation|experience)|your own|from your (life|experience)|think of a time|can you think of|do you have (a|an) (example|memory)|share (a|something)|tell me about (a|something)|held a grudge|really didn't like|something a bit more personal|celebrated someone|really celebrated/i.test(
        lastContent
      );
    if (isPersonalOpening && !isDecline(trimmed)) setUsedPersonalExamples(true);
    const replyingToMoment5Prompt =
      currentInterviewMomentRef.current === 5 &&
      (isAppreciationPromptText(lastAssistantContent) || moment5ProbePendingRef.current);
    const replyingToScenarioAQ1 =
      currentInterviewMomentRef.current === 1 && isScenarioAQ1Prompt(lastAssistantContent);
    const replyingToScenarioBQ1 =
      currentInterviewMomentRef.current === 2 && isScenarioBQ1Prompt(lastAssistantContent);
    const replyingToScenarioCQ2 =
      currentInterviewMomentRef.current === 3 && isScenarioCQ2Prompt(lastAssistantContent);
    if (moment5ProbePendingRef.current && !isDecline(trimmed)) {
      // User has answered the one allowed Moment 5 probe; do not ask another.
      moment5ProbePendingRef.current = false;
    }
    const shouldForceMoment5Probe =
      replyingToMoment5Prompt &&
      !moment5ProbeAskedRef.current &&
      !isDecline(trimmed) &&
      isGenericAppreciationAnswer(trimmed);
    const relationshipEval = evaluateMoment4RelationshipType(trimmed);
    const thresholdAlreadyProvided = hasCommitmentThresholdSignal(trimmed);
    const shouldForceMoment4ThresholdProbe = shouldForceMoment4ThresholdProbeByType({
      isMoment4: currentInterviewMomentRef.current === 4,
      relationshipType: relationshipEval.relationshipType,
      thresholdAlreadyProvided,
      probeAlreadyAsked: moment4ThresholdProbeAskedRef.current,
    });
    if (currentInterviewMomentRef.current === 4 && !isDecline(trimmed)) {
      if (__DEV__) {
        console.log('[M4_THRESHOLD_EVAL]', {
          rawAnswerText: trimmed,
          relationshipType: relationshipEval.relationshipType,
          closeSignals: relationshipEval.closeSignals,
          nonCloseSignals: relationshipEval.nonCloseSignals,
          shouldFireProbeCondition: shouldForceMoment4ThresholdProbe,
          thresholdAlreadyProvided,
          probeAlreadyAsked: moment4ThresholdProbeAskedRef.current,
        });
      }
      void remoteLog('[M4_THRESHOLD_EVAL]', {
        rawAnswerText: trimmed.slice(0, 500),
        relationshipType: relationshipEval.relationshipType,
        closeSignals: relationshipEval.closeSignals,
        nonCloseSignals: relationshipEval.nonCloseSignals,
        shouldFireProbeCondition: shouldForceMoment4ThresholdProbe,
        thresholdAlreadyProvided,
        probeAlreadyAsked: moment4ThresholdProbeAskedRef.current,
      });
    }
    const specificSamLineAlreadyAddressed = hasSpecificSamLineContemptRecognition(trimmed);
    const shouldForceScenarioAContemptProbe =
      replyingToScenarioAQ1 &&
      !isDecline(trimmed);
    const sidedEntirelyWithJordan = userSidesEntirelyWithJordan(trimmed);
    const recognizedAlexNeedNaturally = naturallyRecognizesAlexNeed(trimmed);
    const shouldForceScenarioBFullAppreciationProbe =
      replyingToScenarioBQ1 &&
      !isDecline(trimmed) &&
      recognizedAlexNeedNaturally &&
      !sidedEntirelyWithJordan;
    const shouldForceScenarioCThresholdProbe =
      replyingToScenarioCQ2 &&
      !isDecline(trimmed) &&
      !thresholdAlreadyProvided;
    if (replyingToScenarioCQ2) {
      const skipReason = thresholdAlreadyProvided ? 'threshold-signal-already-present' : 'threshold-signal-missing';
      if (__DEV__) {
        console.log('[S3_THRESHOLD_EVAL]', {
          shouldForceScenarioCThresholdProbe,
          thresholdAlreadyProvided,
          skipReason,
          evaluatedOn: trimmed,
        });
      }
      void remoteLog('[S3_THRESHOLD_EVAL]', {
        shouldForceScenarioCThresholdProbe,
        thresholdAlreadyProvided,
        skipReason,
        evaluatedOn: trimmed.slice(0, 320),
      });
    }

    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
      setVoiceState('idle');
      showChatError(CHAT_ERROR_MESSAGES.proxyError);
      return;
    }

    // Scenarios need more tokens — detect from last user message (no-example → scenario next)
      const lastUserMsg = (messagesToUse[messagesToUse.length - 1] as { content?: string })?.content?.toLowerCase() ?? '';
      const isNoExample = /don't have|can't think|i dont|nothing comes|no example|i don't/i.test(lastUserMsg);
      const lastAsstForTokens = (lastAssistant?.content ?? '').toLowerCase();
      const replyingToAppreciationPrompt =
        lastAsstForTokens.includes('celebrated someone') ||
        (lastAsstForTokens.includes('really celebrated') && lastAsstForTokens.includes('your life'));
      let maxTok = isNoExample ? 600 : 200;
      if (replyingToAppreciationPrompt) maxTok = 2800;
      const closingInstruction = usedPersonalExamples ? PERSONAL_CLOSING_INSTRUCTION : SCENARIO_ONLY_CLOSING_INSTRUCTION;
      const progressSuffix = buildInterviewProgressSystemSuffix({
        momentsComplete: { ...interviewMomentsCompleteRef.current },
        currentMoment: currentInterviewMomentRef.current,
        personalHandoffInjected: personalHandoffInjectedRef.current,
        appreciationQuestionSeen: appreciationQuestionSeenRef.current,
      });
      const progressRefsPayload: InterviewProgressRefs = {
        interviewMomentsCompleteRef,
        currentInterviewMomentRef,
        personalHandoffInjectedRef,
        appreciationQuestionSeenRef,
      };
      const requestBody = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTok,
        system:
          INTERVIEWER_SYSTEM +
          OPENING_INSTRUCTIONS +
          SCENARIO_SWITCHING_INSTRUCTIONS +
          SCENARIO_BOUNDARY_INSTRUCTIONS +
          SCENARIO_CLOSING_INSTRUCTIONS +
          CLOSING_QUESTION_HANDLING +
          SCENARIO_TRANSITION_CLOSING +
          PERSONAL_DISCLOSURE_TRANSITION +
          SKIP_HANDLING_INSTRUCTIONS +
          SCORE_REQUEST_INSTRUCTIONS +
          OFF_TOPIC_INSTRUCTIONS +
          REPEAT_HANDLING_INSTRUCTIONS +
          THIN_RESPONSE_INSTRUCTIONS +
          NO_REPEAT_INSTRUCTIONS +
          PAUSE_HANDLING_INSTRUCTIONS +
          DISTRESS_HANDLING_INSTRUCTIONS +
          MISUNDERSTANDING_HANDLING_INSTRUCTIONS +
          SCENARIO_REDIRECT_QUESTIONS +
          INVALID_SCENARIO_REDIRECT +
          MOMENT_5_APPRECIATION_FALLBACK_INSTRUCTIONS +
          COMMUNICATION_QUESTION_CHECK +
          PUSHBACK_RESPONSE_INSTRUCTIONS +
          SCENARIO_COMPLETE_TOKEN_INSTRUCTIONS +
          CLOSING_LINE_INSTRUCTIONS +
          closingInstruction +
          progressSuffix,
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
    const makeCall = async (): Promise<typeof data> => {
      const res = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(requestBody) });
      const raw = await res.text();
      let parsed: typeof data;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const e = new Error('Invalid response');
        (e as Error & { status?: number }).status = res.status;
        throw e;
      }
      if (!res.ok) {
        const e = new Error(parsed?.error?.message ?? `HTTP ${res.status}`);
        (e as Error & { status?: number }).status = res.status;
        throw e;
      }
      return parsed;
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
      setIsWaiting(false);
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
      const scenarioScoresPayload: Record<number, { pillarScores: Record<string, number>; pillarConfidence: Record<string, string>; keyEvidence: Record<string, string>; scenarioName?: string }> = {};
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

    const text = (data.content?.[0]?.text ?? '').trim();
    let strippedText = sanitizeInterviewSpeech(stripControlTokens(text));
    strippedText = enforceAcknowledgmentVariation(
      strippedText,
      messagesToUse.filter((m) => m.role === 'assistant') as MessageWithScenario[],
      isPersonalOpening || currentInterviewMomentRef.current >= 4
    );
    if (
      currentInterviewMomentRef.current === 4 &&
      isAppreciationPromptText(strippedText) &&
      !hasMoment5TransitionSignal(strippedText)
    ) {
      strippedText = `Last one — this one's a little warmer.\n\n${strippedText}`;
    }
    const assistantIssuedMoment5Probe = looksLikeMoment5Probe(strippedText);
    let assistantIssuedMoment4ThresholdProbe = looksLikeMoment4ThresholdQuestion(strippedText);
    if (
      currentInterviewMomentRef.current === 4 &&
      assistantIssuedMoment4ThresholdProbe &&
      /^\s*at what point do you decide this is something to work through versus something you need to walk away from\??\s*$/i.test(strippedText)
    ) {
      const preface = buildMoment4NeutralReflection(trimmed, relationshipEval.relationshipType);
      strippedText = `${preface} ${strippedText}`.trim();
    }
    const assistantIssuedScenarioAContemptProbe = looksLikeScenarioAContemptProbeQuestion(strippedText);
    let assistantIssuedScenarioARepairQuestion =
      currentInterviewMomentRef.current === 1 && looksLikeScenarioARepairQuestion(strippedText);
    const assistantIssuedScenarioBFullProbe = looksLikeScenarioBFullAppreciationProbeQuestion(strippedText);
    const assistantIssuedScenarioCThresholdProbe = looksLikeScenarioCThresholdQuestion(strippedText);
    if (shouldForceScenarioAContemptProbe && assistantIssuedScenarioARepairQuestion) {
      strippedText = stripScenarioARepairQuestion(strippedText);
      assistantIssuedScenarioARepairQuestion = false;
      if (__DEV__) {
        console.log('[S1_SEQUENCE_BLOCKED_REPAIR_BEFORE_CONTEMPT]', {
          shouldForceScenarioAContemptProbe,
          specificSamLineAlreadyAddressed,
        });
      }
      void remoteLog('[S1_SEQUENCE_BLOCKED_REPAIR_BEFORE_CONTEMPT]', {
        shouldForceScenarioAContemptProbe,
        specificSamLineAlreadyAddressed,
      });
    }
    if (
      currentInterviewMomentRef.current === 4 &&
      relationshipEval.relationshipType !== 'close' &&
      assistantIssuedMoment4ThresholdProbe
    ) {
      strippedText = strippedText
        .replace(
          /At what point do you decide this is something to work through versus something you need to walk away from\??/i,
          ''
        )
        .trim();
      if (!strippedText) strippedText = 'Got it.';
      assistantIssuedMoment4ThresholdProbe = false;
      if (__DEV__) {
        console.log('[M4_THRESHOLD_SUPPRESSED_NON_CLOSE]', {
          relationshipType: relationshipEval.relationshipType,
          closeSignals: relationshipEval.closeSignals,
          nonCloseSignals: relationshipEval.nonCloseSignals,
          rawAnswerText: trimmed,
        });
      }
      void remoteLog('[M4_THRESHOLD_SUPPRESSED_NON_CLOSE]', {
        relationshipType: relationshipEval.relationshipType,
        closeSignals: relationshipEval.closeSignals,
        nonCloseSignals: relationshipEval.nonCloseSignals,
        rawAnswerText: trimmed.slice(0, 500),
      });
    }
    if (assistantIssuedMoment5Probe) {
      moment5ProbeAskedRef.current = true;
      moment5ProbePendingRef.current = true;
    }
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
      !text.includes('[INTERVIEW_COMPLETE]')
    ) {
      const forcedContemptProbe = "What do you make of Sam's statement when she says 'you've made that very clear'?";
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
        await speakTextSafe(strippedText);
      }
      if (__DEV__) {
        console.log('[S1_CONTEMPT_FORCED]', {
          specificSamLineAlreadyAddressed,
          assistantIssuedScenarioAContemptProbe,
        });
      }
      void remoteLog('[S1_CONTEMPT_FORCED]', {
        specificSamLineAlreadyAddressed,
        assistantIssuedScenarioAContemptProbe,
      });
      scenarioAContemptProbeAskedRef.current = true;
      const probeMsg: MessageWithScenario = {
        role: 'assistant',
        content: forcedContemptProbe,
        scenarioNumber:
          currentScenarioRef.current ??
          getScenarioNumberForNewMessage(stagedMessages, 'assistant', forcedContemptProbe),
      };
      setMessages([...stagedMessages, probeMsg]);
      await speakTextSafe(forcedContemptProbe);
      setVoiceState('idle');
      return;
    }
    if (
      shouldForceScenarioBFullAppreciationProbe &&
      !assistantIssuedScenarioBFullProbe &&
      !text.includes('[INTERVIEW_COMPLETE]')
    ) {
      const forcedAppreciationProbe = "What do you think Jordan could've done differently so Alex feels better?";
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
        await speakTextSafe(strippedText);
      }
      if (__DEV__) {
        console.log('[S2_APPRECIATION_FORCED]', {
          sidedEntirelyWithJordan,
          recognizedAlexNeedNaturally,
          assistantIssuedScenarioBFullProbe,
        });
      }
      void remoteLog('[S2_APPRECIATION_FORCED]', {
        sidedEntirelyWithJordan,
        recognizedAlexNeedNaturally,
        assistantIssuedScenarioBFullProbe,
      });
      const probeMsg: MessageWithScenario = {
        role: 'assistant',
        content: forcedAppreciationProbe,
        scenarioNumber:
          currentScenarioRef.current ??
          getScenarioNumberForNewMessage(stagedMessages, 'assistant', forcedAppreciationProbe),
      };
      setMessages([...stagedMessages, probeMsg]);
      await speakTextSafe(forcedAppreciationProbe);
      setVoiceState('idle');
      return;
    }
    if (
      shouldForceScenarioCThresholdProbe &&
      !assistantIssuedScenarioCThresholdProbe &&
      !text.includes('[INTERVIEW_COMPLETE]')
    ) {
      const forcedThresholdProbe =
        "At what point would you say Theo or Morgan should decide this relationship isn't working?";
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
        await speakTextSafe(strippedText);
      }
      if (__DEV__) {
        console.log('[S3_THRESHOLD_FORCED]', {
          thresholdAlreadyProvided,
          shouldForceScenarioCThresholdProbe,
          assistantIssuedScenarioCThresholdProbe,
          reason: 'Q2 did not contain commitment-threshold criteria',
        });
      }
      void remoteLog('[S3_THRESHOLD_FORCED]', {
        thresholdAlreadyProvided,
        shouldForceScenarioCThresholdProbe,
        assistantIssuedScenarioCThresholdProbe,
        reason: 'Q2 did not contain commitment-threshold criteria',
      });
      const probeMsg: MessageWithScenario = {
        role: 'assistant',
        content: forcedThresholdProbe,
        scenarioNumber:
          currentScenarioRef.current ??
          getScenarioNumberForNewMessage(stagedMessages, 'assistant', forcedThresholdProbe),
      };
      setMessages([...stagedMessages, probeMsg]);
      await speakTextSafe(forcedThresholdProbe);
      setVoiceState('idle');
      return;
    }
    if (shouldForceMoment5Probe && !assistantIssuedMoment5Probe) {
      const forcedProbe = chooseMoment5Probe(trimmed);
      moment5ProbeAskedRef.current = true;
      moment5ProbePendingRef.current = true;
      const probeMsg: MessageWithScenario = {
        role: 'assistant',
        content: forcedProbe,
        scenarioNumber: currentScenarioRef.current ?? getScenarioNumberForNewMessage(messagesToUse, 'assistant', forcedProbe),
      };
      setMessages([...messagesToUse, probeMsg]);
      await speakTextSafe(forcedProbe);
      setVoiceState('idle');
      return;
    }
    if (
      shouldForceMoment4ThresholdProbe &&
      !assistantIssuedMoment4ThresholdProbe &&
      !text.includes('[INTERVIEW_COMPLETE]') &&
      !isAppreciationPromptText(strippedText)
    ) {
      const forcedThresholdProbe =
        'At what point do you decide this is something to work through versus something you need to walk away from?';
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
        await speakTextSafe(strippedText);
      }
      const preface = buildMoment4NeutralReflection(trimmed, relationshipEval.relationshipType);
      const prefaceMsg: MessageWithScenario = {
        role: 'assistant',
        content: preface,
        scenarioNumber:
          currentScenarioRef.current ??
          getScenarioNumberForNewMessage(stagedMessages, 'assistant', preface),
      };
      stagedMessages = [...stagedMessages, prefaceMsg];
      setMessages(stagedMessages);
      await speakTextSafe(preface);
      moment4ThresholdProbeAskedRef.current = true;
      void remoteLog('[M4_THRESHOLD_FORCED]', {
        relationshipType: relationshipEval.relationshipType,
        closeSignals: relationshipEval.closeSignals,
        nonCloseSignals: relationshipEval.nonCloseSignals,
        shouldFireProbeCondition: shouldForceMoment4ThresholdProbe,
        thresholdAlreadyProvided,
      });
      const probeMsg: MessageWithScenario = {
        role: 'assistant',
        content: forcedThresholdProbe,
        scenarioNumber:
          currentScenarioRef.current ??
          getScenarioNumberForNewMessage(stagedMessages, 'assistant', forcedThresholdProbe),
      };
      setMessages([...stagedMessages, probeMsg]);
      await speakTextSafe(forcedThresholdProbe);
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
          nextContent = `On to the second situation.\n\n${SCENARIO_2_TEXT}`;
        } else if (scenarioNumber === 2) {
          interviewMomentsCompleteRef.current[2] = true;
          currentInterviewMomentRef.current = 3;
          nextContent = `Here's the third situation — after this we'll move to something more personal.\n\n${SCENARIO_3_TEXT}`;
        } else if (scenarioNumber === 3) {
          if (personalHandoffInjectedRef.current) {
            nextContent = stripControlTokens(text) || 'Got it.';
          } else {
            nextContent = MOMENT_4_HANDOFF;
            personalHandoffInjectedRef.current = true;
            interviewMomentsCompleteRef.current[3] = true;
            currentInterviewMomentRef.current = 4;
          }
        }
        const fullDisplay = nextContent || (stripControlTokens(text) || 'Got it.');
        const nextScenarioNum = scenarioNumber === 1 ? 2 : scenarioNumber === 2 ? 3 : 3;
        const newAssistantMsg: MessageWithScenario = { role: 'assistant', content: fullDisplay, scenarioNumber: nextScenarioNum };
        currentScenarioRef.current = nextScenarioNum;
        const updatedMessages = [...messagesToUse, newAssistantMsg];
        setMessages(updatedMessages);
        applyInterviewProgressFromAssistantText(fullDisplay, progressRefsPayload);
        await speakTextSafe(fullDisplay);
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
            nextContent = `On to the second situation.\n\n${SCENARIO_2_TEXT}`;
          } else if (scenarioNumber === 2) {
            interviewMomentsCompleteRef.current[2] = true;
            currentInterviewMomentRef.current = 3;
            nextContent = `Here's the third situation — after this we'll move to something more personal.\n\n${SCENARIO_3_TEXT}`;
          } else if (scenarioNumber === 3) {
            if (personalHandoffInjectedRef.current) {
              nextContent = stripControlTokens(text) || 'Got it.';
            } else {
              nextContent = MOMENT_4_HANDOFF;
              personalHandoffInjectedRef.current = true;
              interviewMomentsCompleteRef.current[3] = true;
              currentInterviewMomentRef.current = 4;
            }
          }
          const fullDisplay = nextContent || 'Got it.';
          const nextScenarioNum = scenarioNumber === 1 ? 2 : scenarioNumber === 2 ? 3 : 3;
          const newAssistantMsg: MessageWithScenario = { role: 'assistant', content: fullDisplay, scenarioNumber: nextScenarioNum };
          currentScenarioRef.current = nextScenarioNum;
          const updatedMessages = [...messagesToUse, newAssistantMsg];
          setMessages(updatedMessages);
          applyInterviewProgressFromAssistantText(fullDisplay, progressRefsPayload);
          await speakTextSafe(fullDisplay);
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
        interviewMomentsCompleteRef.current[5] = true;
        currentInterviewMomentRef.current = 5;
        const displayText = sanitizeClosingLanguage(
          sanitizeInterviewSpeech(stripControlTokens(text) || 'Thank you. That was really helpful.')
        );
        const finalAssistant: MessageWithScenario = {
          role: 'assistant',
          content: displayText,
          scenarioNumber: currentScenarioRef.current ?? getScenarioNumberForNewMessage(messagesToUse, 'assistant', displayText),
        };
        const finalMessages = [...messagesToUse, finalAssistant];
        setMessages(finalMessages);
        speakTextSafe(displayText).catch(() => {});
        isInterviewCompleteRef.current = true;
        const transcriptForScoring = finalMessages.filter((m) => m.role === 'user' || m.role === 'assistant');
        // Always wait for closing TTS to finish before showing loading screen
        pendingCompletionTranscriptRef.current = transcriptForScoring;
        setPendingCompletion(true);
        return;
      }

      // Then handle per-scenario completion tokens (may appear in earlier messages or alongside other markers)
      const scenarioMatch = text.match(/\[SCENARIO_COMPLETE:(\d)\]/);
      if (scenarioMatch) {
        lastAnsweredClosingScenarioRef.current = null;
        const scenarioNumber = parseInt(scenarioMatch[1], 10) as 1 | 2 | 3;
        const displayText = sanitizeInterviewSpeech(stripControlTokens(text) || "Good, that's helpful.");
        applyInterviewProgressFromAssistantText(displayText, progressRefsPayload);
        const transitionMsg: MessageWithScenario = { role: 'assistant', content: displayText, scenarioNumber };
        const nextScenarioNum = scenarioNumber < 3 ? (scenarioNumber + 1) as 2 | 3 : 3;
        currentScenarioRef.current = nextScenarioNum;
        const updatedMessages = [...messagesToUse, transitionMsg];
        setMessages(updatedMessages);
        await speakTextSafe(displayText);
        setHighestScenarioReached((prev) => Math.max(prev, scenarioNumber));
        if (!scoredScenariosRef.current.has(scenarioNumber)) {
          scoredScenariosRef.current.add(scenarioNumber);
          scoreScenario(scenarioNumber, updatedMessages);
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
        const displayText = sanitizeInterviewSpeech(stripControlTokens(text) || "Good, that's helpful.");
        const finalMessages = [...messagesToUse, { role: 'assistant', content: displayText || 'Good, that’s helpful.' }];
        setMessages(finalMessages);
        await speakTextSafe(displayText || 'Good, that’s helpful.');
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

      const displayText = sanitizeInterviewSpeech(stripControlTokens(text));
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
      await speakTextSafe(displayText);
  }, [messages, speakTextSafe, route?.name, userId, navigation, queryClient, profile?.name, fetchStageScore, scoreScenario, usedPersonalExamples, markClosingQuestionAsked, markClosingQuestionAnswered]);

  const handlePressStart = useCallback(async () => {
    if (voiceState !== 'idle') return;
    if (useNativeOrWhisperRecording) return; // native or web Whisper use hook (tap-to-toggle)
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
  }, [voiceState, useNativeOrWhisperRecording]);

  const handleRecordingError = useCallback(
    (err: Error) => {
      if (__DEV__) console.error('Recording error:', err.message);
      setVoiceState('idle');
      const msg = randomFrom(AMORAEA_ERROR_MESSAGES.recordingOrTranscriptionRetry);
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
    async (audioBlob: Blob | null, nativeUri: string | null): Promise<string | null> => {
      if (__DEV__) {
        console.log('=== TRANSCRIPTION DEBUG ===', 'Platform:', Platform.OS, 'Native URI:', nativeUri ?? 'none', 'Blob size:', audioBlob?.size ?? 0, 'Endpoint:', OPENAI_WHISPER_PROXY_URL || 'openai');
      }
      try {
        const transcript = await withRetry(
          async (): Promise<string> => {
            const form = new FormData();
            const transcriptUrl = OPENAI_WHISPER_PROXY_URL || 'https://api.openai.com/v1/audio/transcriptions';
            const headers: Record<string, string> = {};
            if (!OPENAI_WHISPER_PROXY_URL) headers.Authorization = `Bearer ${OPENAI_API_KEY}`;

            // Native: always build from file URI so we send explicit audio/mp4 (fetch(uri).blob() often has wrong type and Whisper rejects it)
            if (Platform.OS !== 'web' && nativeUri) {
              try {
                const base64 = await FileSystem.readAsStringAsync(nativeUri, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                const byteChars = atob(base64);
                const byteNumbers = new Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
                const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/mp4' });
                form.append('file', blob, 'recording.m4a');
              } catch (e) {
                (form as unknown as { append: (k: string, v: { uri: string; type: string; name: string }) => void }).append('file', {
                  uri: nativeUri,
                  type: 'audio/mp4',
                  name: 'recording.m4a',
                });
              }
            } else if (audioBlob && audioBlob.size > 0) {
              const filename = 'recording.webm';
              const typeOk = audioBlob.type === 'audio/webm' || audioBlob.type?.startsWith('audio/webm') || !audioBlob.type;
              let blobToSend: Blob = audioBlob;
              if (!typeOk && typeof audioBlob.arrayBuffer === 'function') {
                blobToSend = new Blob([await audioBlob.arrayBuffer()], { type: 'audio/webm' });
              }
              form.append('file', blobToSend, filename);
            } else {
              throw new Error('No audio data');
            }
            form.append('model', 'whisper-1');
            const res = await fetch(transcriptUrl, { method: 'POST', headers, body: form });
            if (__DEV__) console.log('Transcription response status:', res.status);
            if (!res.ok) throw new Error(await res.text());
            const data = (await res.json()) as { text?: string };
            const text = (data.text ?? '').trim();
            if (__DEV__) console.log('Transcription result length:', text.length, '=== END DEBUG ===');
            if (text.length < 2) throw new Error('Empty transcription result');
            return text;
          },
          { retries: 2, baseDelay: 4000, context: 'transcription' }
        );
        return transcript;
      } catch (err) {
        if (__DEV__) console.error('Transcription failed:', err instanceof Error ? err.message : err);
        await deleteTurnAudioFile(nativeUri);
        const retryMessages = Platform.OS === 'web'
          ? AMORAEA_ERROR_MESSAGES.recordingOrTranscriptionRetry
          : AMORAEA_ERROR_MESSAGES.recordingOrTranscriptionRetryNative;
        const msg = randomFrom(retryMessages);
        setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
        setVoiceState('speaking');
        await speakTextSafe(msg).catch(() => {});
        setVoiceState('idle');
        return null;
      }
    },
    [speakTextSafe, deleteTurnAudioFile]
  );

  const audioRecorder = useAudioRecorder({
    onRecordingComplete: async (blob, nativeUri) => {
      setVoiceState('processing');
      const userText = await transcribeSafe(blob, nativeUri);
      if (userText) {
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
      }
    },
    onError: (err) => handleRecordingError(err),
  });

  const handleNativeOrWhisperMicPress = useCallback(async () => {
    if (voiceState === 'speaking' || voiceState === 'processing') return;
    if (!useNativeOrWhisperRecording) return;
    if (__DEV__) console.log('[Aria] MIC PRESSED, isRecording:', audioRecorder.isRecording);
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stopRecording();
        if (__DEV__) console.log('[Aria] RECORDING STOPPED');
      } else {
        const granted = await audioRecorder.requestPermission();
        if (__DEV__) console.log('[Aria] MIC PERMISSION:', granted ? 'granted' : 'denied');
        if (!granted) return;
        setVoiceState('recording');
        await audioRecorder.startRecording();
        if (__DEV__) console.log('[Aria] RECORDING STARTED');
      }
    } catch (err) {
      if (__DEV__) console.error('[Aria] MIC ERROR:', err instanceof Error ? err.message : err);
      handleRecordingError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [voiceState, useNativeOrWhisperRecording, audioRecorder.isRecording, audioRecorder.stopRecording, audioRecorder.startRecording, audioRecorder.requestPermission, handleRecordingError]);

  const handleSendTyped = useCallback(() => {
    const text = typedAnswer.trim();
    if (!text) return;
    setTypedAnswer('');
    setMicWarning(null);
    stopElevenLabsSpeech(); // interrupt if interviewer is still speaking
    processUserSpeech(text);
  }, [typedAnswer, processUserSpeech]);

  const handlePressEnd = useCallback(async () => {
    if (voiceState !== 'listening') return;
    if (useNativeOrWhisperRecording) return; // native or web Whisper use hook
    if (Platform.OS === 'web' && recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setVoiceState('processing');
    setTimeout(() => {
      const text = transcriptAtReleaseRef.current?.trim() ?? currentTranscript.trim();
      processUserSpeech(text);
    }, 400);
  }, [voiceState, currentTranscript, processUserSpeech, useNativeOrWhisperRecording, handleRecordingError, transcribeSafe]);

  const handleResume = useCallback(
    async (saved: NonNullable<Awaited<ReturnType<typeof loadInterviewFromStorage>>>) => {
      const restoredMessages = saved.messages ?? [];
      const syncedMoments = syncInterviewMomentsFromTranscript(restoredMessages, saved.scenariosCompleted ?? []);
      interviewMomentsCompleteRef.current = syncedMoments.momentsComplete;
      currentInterviewMomentRef.current = syncedMoments.currentMoment;
      personalHandoffInjectedRef.current = syncedMoments.personalHandoffInjected;
      appreciationQuestionSeenRef.current = syncedMoments.appreciationQuestionSeen;
      moment5ProbeAskedRef.current = false;
      moment5ProbePendingRef.current = false;
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

      const lastMessage = extractLastInterviewerMessage(restoredMessages);
      const welcomeBack = lastMessage
        ? `Welcome back. Let's pick up where we left off. When we left off, I said — ${lastMessage}`
        : "Welcome back. Let's pick up where we left off.";
      const welcomeMsg = { role: 'assistant', content: welcomeBack, isWelcomeBack: true };
      setMessages([...fullMessages, welcomeMsg]);
      setTimeout(() => speakTextSafe(welcomeBack), 500);

      setStatus('active');
    },
    [speakTextSafe]
  );

  useEffect(() => {
    if (!userId || isAdmin) return;
    if (hasResumedRef.current) return;
    if (isInterviewCompleteRef.current) return;
    let cancelled = false;
    (async () => {
      const saved = await loadInterviewFromStorage(userId);
      if (cancelled) return;
      if (!saved?.messages?.length) return;
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
        if (completedCount < 3) {
          hasResumedRef.current = true;
          handleResume(saved);
        } else {
          await clearInterviewFromStorage(userId);
        }
      } else {
        await clearInterviewFromStorage(userId);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, isAdmin, handleResume]);

  const startInterview = useCallback(async () => {
    await remoteLog('[START] startInterview called', {
      userId: userId ?? null,
      isAdmin,
      platform: Platform.OS,
    });
    if (isAdmin) await clearInterviewFromStorage(userId);
    const saved = await loadInterviewFromStorage(userId);
    if (saved && (saved.scenariosCompleted?.length ?? 0) >= 3) {
      await clearInterviewFromStorage(userId);
    }
    try {
      // 1 — Request mic permissions first
      if (Platform.OS === 'web') {
        await requestMicPermissionForPWA();
        await remoteLog('[START] Mic permission (PWA) requested');
      } else if (useNativeOrWhisperRecording) {
        const granted = await audioRecorder.requestPermission();
        setMicPermission(granted ? 'granted' : 'denied');
        await remoteLog('[START] Mic permission result', { granted });
        if (!granted) {
          if (__DEV__) console.warn('[Aria] Mic permission denied at start');
          setVoiceState('idle');
          return;
        }
      }

      // 2 — Set playback mode so welcome TTS plays through speaker; mic will switch to recording mode when user holds button
      if (Platform.OS !== 'web') {
        await setPlaybackMode();
        await remoteLog('[START] Audio mode set');
      }

      setStatus('active');
      setInterviewStatus('in_progress');
      setVoiceState('processing');
      resetInterviewProgressRefs();

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
        await speakTextSafe(welcomeFallback).catch(() => {});
        return;
      }

      // 3 — Deliver the real greeting (scenario 1 starts here)
      await remoteLog('[START] Delivering real greeting');
      currentScenarioRef.current = 1;
      const openingLine = "Hi, I'm Amoraea. What can I call you?";
      setMessages([{ role: 'assistant', content: openingLine, scenarioNumber: 1 } as MessageWithScenario]);
      await speakTextSafe(openingLine);
      await remoteLog('[START] Real greeting sent');
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
      const fallbackMsg = "Hi, I'm Amoraea. I'll be with you in just a moment.";
      setMessages([{ role: 'assistant', content: fallbackMsg, scenarioNumber: 1 } as MessageWithScenario]);
      await speakTextSafe(fallbackMsg).catch(() => {});
    }
  }, [speakTextSafe, isAdmin, userId, useNativeOrWhisperRecording, audioRecorder, resetInterviewProgressRefs]);

  const saveInterviewResults = useCallback(
    async (results: InterviewResults, gateResult: GateResult, uid: string) => {
      if (!uid) return;
      try {
        const { error } = await supabase
          .from('users')
          .update({
            interview_completed: true,
            interview_passed: gateResult.pass,
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
    const isOnboarding = route.name === 'OnboardingInterview';
    setStatus('scoring');
    await remoteLog('[2] Screen set to scoring');
    const context = typologyContext || 'No typology context — score from transcript only.';
    if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
      const fallbackResults: InterviewResults = {
        pillarScores: { ...FALLBACK_MARKER_SCORES_MID },
        keyEvidence: {},
        narrativeCoherence: 'moderate',
        behavioralSpecificity: 'moderate',
        notableInconsistencies: [],
        interviewSummary: 'Interview completed. Scoring was unavailable.',
        gateResult: computeGateResult({ ...FALLBACK_MARKER_SCORES_MID }),
      };
      setResults(fallbackResults);
      if (isOnboarding) {
        const gate1Score = buildGate1ScoreFromResults(fallbackResults);
        await profileRepository.upsertProfile(userId, {
          gate1Score,
          applicationStatus: gate1Score.passed ? 'approved' : 'under_review',
          ...(gate1Score.passed ? { onboardingStage: 'basic_info' as const } : {}),
        });
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }
      await saveInterviewResults(fallbackResults, fallbackResults.gateResult!, userId);
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
      const fetchScoringOnce = async (): Promise<InterviewResults> => {
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
        if (!res.ok) {
          const e = new Error((data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
          (e as Error & { status?: number }).status = res.status;
          throw e;
        }
        const raw = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
        return JSON.parse(raw) as InterviewResults;
      };
      const parsed = await withRetry(fetchScoringOnce, {
        retries: 3,
        baseDelay: 12000,
        maxDelay: 45000,
        context: 'scoring',
      });
      const gateResult = computeGateResult(parsed.pillarScores ?? {}, parsed.skepticismModifier ?? null);
      parsed.gateResult = gateResult;
      setResults(parsed);
      await remoteLog('[3] Scoring complete', {
        weightedScore: gateResult?.weightedScore,
        passed: gateResult?.pass,
        pillarScores: parsed.pillarScores ?? {},
      });
      if (__DEV__) {
        console.log('=== Scoring API complete ===', 'passed:', gateResult?.pass);
      }
      if (isOnboarding) {
        const gate1Score = buildGate1ScoreFromResults(parsed);
        await profileRepository.upsertProfile(userId, {
          gate1Score,
          applicationStatus: gate1Score.passed ? 'approved' : 'under_review',
          ...(gate1Score.passed ? { onboardingStage: 'basic_info' as const } : {}),
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
            for (const scenarioNum of missing) {
              const taggedMessages = msgs.filter((m) => (m as MessageWithScenario).scenarioNumber === scenarioNum);
              const inferredMessages = inferScenarioMessages(msgs, scenarioNum);
              const messagesToScore = taggedMessages.length >= inferredMessages.length ? taggedMessages : inferredMessages;
              if (__DEV__) console.log(`[RESCORE] Scenario ${scenarioNum}: ${messagesToScore.length} messages (tagged: ${taggedMessages.length}, inferred: ${inferredMessages.length})`);
              if (messagesToScore.length >= 2) {
                await scoreScenario(scenarioNum, messagesToScore);
              } else if (__DEV__) {
                console.error(`[RESCORE] Cannot score scenario ${scenarioNum} — insufficient messages`);
              }
            }
          };
          await rescoreMissingScenarios();
        }
        let alphaSaveOk = false;
        let insertPayload: Record<string, unknown> | null = null;
        let updatePayload: Record<string, unknown> | null = null;
        let attemptNum = 1;
        try {
          await ensureValidSession();
          const s1 = scenarioScoresRef.current[1]?.pillarScores;
          const s2 = scenarioScoresRef.current[2]?.pillarScores;
          const s3 = scenarioScoresRef.current[3]?.pillarScores;
          const scoreConsistency = calculateScoreConsistency(s1, s2, s3);
          const parsedPillarScores = parsed.pillarScores ?? {};
          let constructAsymmetry = calculateConstructAsymmetry(parsedPillarScores);
          const scenarioBoundaries = buildScenarioBoundaries(
            finalMessages,
            Array.from(scoredScenariosRef.current)
          );
          const languageMarkers = analyzeLanguageMarkers(finalMessages, scenarioBoundaries);
          const personalSlices = inferPersonalMomentSlices(finalMessages);
          const scorePersonalMoment = async (
            momentNumber: 4 | 5,
            slice: { role: string; content: string }[]
          ): Promise<PersonalMomentScoreResult | null> => {
            if (slice.filter((m) => m.role === 'user').length < 1) return null;
            try {
              const scored = await withRetry(
                async (): Promise<PersonalMomentScoreResult> => {
                  const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      model: 'claude-sonnet-4-20250514',
                      max_tokens: 900,
                      messages: [{ role: 'user', content: buildPersonalMomentScoringPrompt(momentNumber, slice) }],
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    const e = new Error((data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
                    (e as Error & { status?: number }).status = res.status;
                    throw e;
                  }
                  const raw = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
                  const parsed = JSON.parse(raw) as PersonalMomentScoreResult;
                  if (momentNumber !== 4) return parsed;
                  const moment4UserAnswer = slice
                    .filter((m) => m.role === 'user')
                    .map((m) => m.content)
                    .join(' ')
                    .trim();
                  return applyMoment4RepairCalibrationRule(parsed, moment4UserAnswer) as PersonalMomentScoreResult;
                },
                {
                  retries: 2,
                  baseDelay: 5000,
                  maxDelay: 20000,
                  context: `scoring personal moment ${momentNumber}`,
                }
              );
              return scored;
            } catch (err) {
              if (__DEV__) console.warn(`Personal moment ${momentNumber} scoring failed:`, err);
              return null;
            }
          };
          const moment4Score = await scorePersonalMoment(4, personalSlices.moment4);
          const moment5Score = await scorePersonalMoment(5, personalSlices.moment5);
          const aggregatedPillarScores = aggregateMarkerScoresFromSlices([
            scenarioScoresRef.current[1]?.pillarScores,
            scenarioScoresRef.current[2]?.pillarScores,
            scenarioScoresRef.current[3]?.pillarScores,
            moment4Score?.pillarScores,
            moment5Score?.pillarScores,
          ]);
          const pillarScores =
            Object.keys(aggregatedPillarScores).length > 0
              ? aggregatedPillarScores
              : parsedPillarScores;
          constructAsymmetry = calculateConstructAsymmetry(pillarScores);
          setReasoningProgress('generating');
          if (__DEV__) console.log('=== [3] Generating reasoning ===');
          const slowTimer = setTimeout(() => setReasoningProgress('slow'), 10000);
          const verySlowTimer = setTimeout(() => setReasoningProgress('very_slow'), 30000);
          const reasoning = await generateAIReasoningSafe(
            pillarScores,
            {
              1: scenarioScoresRef.current[1],
              2: scenarioScoresRef.current[2],
              3: scenarioScoresRef.current[3],
            },
            finalMessages,
            gateResult.weightedScore,
            gateResult.pass,
            {
              onRetry: (attempt) => {
                if (attempt === 1) setReasoningProgress('slow');
                if (attempt >= 2) setReasoningProgress('very_slow');
              },
              onUnrecoverable: () => setReasoningProgress('failed'),
            }
          );
          setReasoningProgress(reasoning._generationFailed ? 'failed' : 'done');
          clearTimeout(slowTimer);
          clearTimeout(verySlowTimer);
          await remoteLog('[4] Reasoning generated', {
            reasoningKeys: reasoning ? Object.keys(reasoning) : [],
            generationFailed: reasoning?._generationFailed ?? null,
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
            weighted_score: gateResult.weightedScore,
            passed: gateResult.pass,
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
            switch_log: [],
            score_consistency: scoreConsistency,
            construct_asymmetry: constructAsymmetry,
            language_markers: languageMarkers,
            scenario_specific_patterns: {
              moment_4_scores: moment4Score
                ? {
                    pillarScores: moment4Score.pillarScores,
                    pillarConfidence: moment4Score.pillarConfidence,
                    keyEvidence: moment4Score.keyEvidence,
                    summary: moment4Score.summary,
                    specificity: moment4Score.specificity,
                    momentName: moment4Score.momentName,
                  }
                : null,
              moment_5_scores: moment5Score
                ? {
                    pillarScores: moment5Score.pillarScores,
                    pillarConfidence: moment5Score.pillarConfidence,
                    keyEvidence: moment5Score.keyEvidence,
                    summary: moment5Score.summary,
                    specificity: moment5Score.specificity,
                    momentName: moment5Score.momentName,
                  }
                : null,
            },
            ai_reasoning: reasoning,
          };
          updatePayload = {
            interview_completed: true,
            interview_passed: gateResult.pass,
            interview_weighted_score: gateResult.weightedScore,
            interview_completed_at: new Date().toISOString(),
            interview_attempt_count: attemptNum,
            latest_attempt_id: null as string | null,
          };
          const { data: insertData } = await withRetry(
            async () => {
              const result = await supabase.from('interview_attempts').insert(insertPayload).select('id').single();
              if (result.error) throw new Error(result.error.message);
              return result;
            },
            { retries: 3, baseDelay: 3000, maxDelay: 15000, context: 'database interview_attempts insert' }
          );
          (updatePayload as Record<string, unknown>).latest_attempt_id = insertData?.id ?? null;
          await withRetry(
            async () => {
              const { error } = await supabase.from('users').update(updatePayload).eq('id', userId);
              if (error) throw new Error(error.message);
            },
            { retries: 3, baseDelay: 3000, maxDelay: 15000, context: 'database users update' }
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
          setAnalysisAttemptId(attemptId);
          void runPostInterviewTextStyleAnalysis(userId, gateResult.pass);
          await finalizeAudioProfile(userId, attemptId, gateResult.pass);
          await remoteLog('[6] setAnalysisAttemptId called', { id: attemptId ?? null });
          if (__DEV__) console.log('=== [6] latestAttemptId set ===', attemptId ?? 'null');
          alphaSaveOk = true;
        } catch (err) {
          await remoteLog('[ERROR] Completion handler threw', {
            message: err instanceof Error ? err.message : String(err),
            name: err instanceof Error ? err.name : 'unknown',
            stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
          });
          if (__DEV__) {
            console.error('=== [4] Alpha save failed ===', err);
          }
          setAnalysisAttemptId(null);
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
        } finally {
          if (ALPHA_MODE) {
            const routeTarget: 'congratulations' = 'congratulations';
            await remoteLog('[7] About to navigate', {
              ALPHA_MODE: true,
              destination: routeTarget,
            });
            if (__DEV__) console.log(`=== [7] Navigating to ${routeTarget} ===`);
            interviewJustCompletedInSession = true;
            await new Promise((resolve) => setTimeout(resolve, 100));
            setInterviewStatus(routeTarget);
            await remoteLog('[8] setInterviewStatus called', { screen: routeTarget });
            if (__DEV__) console.log('=== [8] Navigation complete ===');
          }
        }
        if (!alphaSaveOk) {
          setStatus('results');
          return;
        }
      } else {
        await saveInterviewResults(parsed, gateResult, userId);
        setInterviewStatus('congratulations');
      }
      setStatus('results');
    } catch (err) {
      await remoteLog('[ERROR] scoreInterview threw', {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : 'unknown',
        stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
      });
      if (__DEV__) console.error('=== COMPLETION ERROR ===', err);
      const fallbackResults: InterviewResults = {
        pillarScores: { ...FALLBACK_MARKER_SCORES_MID },
        keyEvidence: {},
        narrativeCoherence: 'moderate',
        behavioralSpecificity: 'moderate',
        notableInconsistencies: [],
        interviewSummary: 'A grounded spoken profile. See individual construct scores for detail.',
        gateResult: computeGateResult({ ...FALLBACK_MARKER_SCORES_MID }),
      };
      setResults(fallbackResults);
      if (isOnboarding) {
        const gate1Score = buildGate1ScoreFromResults(fallbackResults);
        await profileRepository.upsertProfile(userId, {
          gate1Score,
          applicationStatus: gate1Score.passed ? 'approved' : 'under_review',
          ...(gate1Score.passed ? { onboardingStage: 'basic_info' as const } : {}),
        });
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      }
      await saveInterviewResults(fallbackResults, fallbackResults.gateResult!, userId);
      setInterviewStatus('congratulations');
      setStatus('results');
    }
  }, [typologyContext, route.name, userId, navigation, queryClient, saveInterviewResults, ensureValidSession, scoreScenario, finalizeAudioProfile, runPostInterviewTextStyleAnalysis]);

  // When INTERVIEW_COMPLETE was detected while TTS was still playing, transition to loading once TTS finishes
  useEffect(() => {
    if (!pendingCompletion || voiceState !== 'idle') return;
    const transcript = pendingCompletionTranscriptRef.current;
    pendingCompletionTranscriptRef.current = null;
    setPendingCompletion(false);
    if (!transcript || transcript.length === 0) return;
    setInterviewStatus('preparing_results');
    scoreInterview(transcript);
  }, [pendingCompletion, voiceState, scoreInterview]);

  const performRetake = useCallback(async () => {
    if (!userId) return;
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
    setStatus('intro');
    setResults(null);
    responseTimingsRef.current = [];
    probeLogRef.current = [];
    setAnalysisAttemptId(null);
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
  }, [userId]);

  const handleRetake = useCallback(() => {
    const warningMessage = 'Are you sure you want to retest? You will not be able to return to this results screen after starting a new retest.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(warningMessage)) void performRetake();
      return;
    }
    Alert.alert('Start retest?', warningMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Retest', style: 'destructive', onPress: () => void performRetake() },
    ]);
  }, [performRetake]);

  const showFeedbackNotice = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
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
              await supabase.auth.signOut();
              navigation.replace('Login');
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
          <Text style={{
            fontFamily: Platform.OS === 'web' ? undefined : 'Jost_300Light',
            fontSize: 10,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#3D5470',
            marginTop: 24,
          }}>
            Preparing your results
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

  if (status === 'intro') {
    return (
      <SafeAreaContainer style={{ position: 'relative' }}>
        {ALPHA_MODE && isAdmin && (
          <TouchableOpacity
            style={styles.adminPanelButton}
            onPress={() => setShowAdminPanel(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.adminPanelButtonText}>◆ Panel</Text>
          </TouchableOpacity>
        )}
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
        <ScrollView style={styles.container} contentContainerStyle={styles.introContent}>
          <View style={styles.ariaBadge}>
            <Ionicons name="mic" size={40} color={colors.primary} />
            <Text style={styles.ariaName}>Voice Interview</Text>
            <Text style={styles.ariaTagline}>Your Story</Text>
          </View>
          <Text style={styles.introTitle}>A real conversation, not a form.</Text>
          <Text style={styles.introHint}>
            You'll speak with an AI interviewer about how you show up in relationships. Hold the button to talk — release when you're done. About 15 minutes.
          </Text>
          <Text style={styles.introNote}>Small examples are fine — nothing needs to be dramatic.</Text>
          <Text style={styles.introHint}>
            Connection status: {networkStatus === 'good' ? 'Stable' : networkStatus === 'poor' ? 'Weak' : 'Checking...'}
          </Text>
          <Text style={styles.introNote}>
            For best transcription reliability: use a stable connection, speak in a quieter space, and pause briefly before releasing the mic.
          </Text>
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
          <Button
            title="Begin Voice Interview"
            onPress={startInterview}
            disabled={!!micError}
            style={styles.introButton}
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
  return (
    <SafeAreaContainer style={{ backgroundColor: '#05060D' }}>
      {ALPHA_MODE && isAdmin && (
        <TouchableOpacity
          style={styles.adminPanelButton}
          onPress={() => setShowAdminPanel(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.adminPanelButtonText}>◆ Panel</Text>
        </TouchableOpacity>
      )}
      <View style={[styles.activeContainer, isAdmin ? styles.adminActiveContainer : undefined]}>
        {isInterviewerView ? (
          <View style={{ flex: 1, backgroundColor: '#05060D' }}>
            <UserInterviewLayout
              flameState={useNativeOrWhisperRecording && audioRecorder.isRecording ? 'recording' : voiceState}
              activeScenario={activeScenario}
              interviewerText={currentInterviewerText}
              interviewerLineIsError={interviewerLineIsError}
              ttsFallbackActive={tTSFallbackActive}
              micPermissionDenied={micPermission === 'denied'}
              isWaiting={isWaiting}
              onPressStart={handlePressStart}
              onPressEnd={handlePressEnd}
              voiceState={useNativeOrWhisperRecording && audioRecorder.isRecording ? 'recording' : voiceState}
              micError={micError}
              micWarning={micWarning}
              inputDisabled={inputDisabled}
              micToggleMode={useNativeOrWhisperRecording}
              onMicPress={useNativeOrWhisperRecording ? handleNativeOrWhisperMicPress : undefined}
              micLabelOverride={useNativeOrWhisperRecording ? (audioRecorder.isRecording ? 'Tap to stop' : 'Tap to speak') : undefined}
              onExit={handleInterviewSignOut}
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
            {!isAdmin ? (
              <>
                <Text style={styles.resultsPanelSummary}>
                  Thank you for completing your interview. Your application is now being reviewed — this usually takes up to 24 hours.
                </Text>
                <Button
                  title="Continue"
                  onPress={() => {
                    setInterviewStatus('congratulations');
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
                        ? `Weighted score: ${results.gateResult.weightedScore}/10 — meets the threshold for profile creation.`
                        : results.gateResult.reason === 'floor'
                          ? `${results.gateResult.failingConstruct} scored ${results.gateResult.failingScore}/10 — below the minimum required score.`
                          : `Weighted score: ${results.gateResult.weightedScore}/10 — below the threshold of 5.0 required for profile creation.`}
                    </Text>
                  </View>
                ) : null}
                {results.interviewSummary ? (
                  <Text style={styles.resultsPanelSummary}>{results.interviewSummary}</Text>
                ) : null}
                <View style={styles.resultsPanelPillars}>
                  {INTERVIEW_MARKER_IDS.map((id) => {
                    const score = results.pillarScores?.[id];
                    if (score == null) return null;
                    const meta = PILLAR_META[id] ?? { name: id, color: colors.primary };
                    return (
                      <View key={id} style={styles.resultsPillarRow}>
                        <View style={styles.resultsPillarHeader}>
                          <Text style={styles.resultsPillarName}>{meta.name}</Text>
                          <Text style={[styles.resultsPillarScore, { color: meta.color }]}>{score}/10</Text>
                        </View>
                        <View style={styles.resultsPillarBar}>
                          <View
                            style={[
                              styles.resultsPillarBarFill,
                              { width: `${score * 10}%`, backgroundColor: meta.color },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Button
                  title="Continue →"
                  onPress={() => {
                    const onComplete = (route.params as { onComplete?: (r: InterviewResults) => void })?.onComplete;
                    if (onComplete) onComplete({ ...results, gateResult: results?.gateResult });
                    else navigation.navigate('Home');
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
              {voiceState === 'listening' && 'Release to send'}
              {voiceState === 'processing' && 'Thinking…'}
              {voiceState === 'speaking' && 'Interviewer speaking'}
              {voiceState === 'idle' && 'Hold to speak'}
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
  adminPanelButtonText: {
    fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined,
    fontSize: 10,
    fontWeight: '300',
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
