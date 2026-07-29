import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  loadInterviewFromStorage,
  mergeInterviewStoragePayload,
  saveInterviewToStorage,
  type StoredInterviewData,
} from '@utilities/storage/InterviewStorage';
import { storedInterviewHasResumableScenarioProgress } from '@utilities/interviewResumeCursor';

/**
 * Only save to localStorage once the interview has meaningfully started.
 * Pre-interview messages (greeting, name, briefing) are not worth saving and cause resume loops if saved.
 */
export function shouldSaveToStorage(
  messages: Array<{ role: string; content: string }> | undefined,
  scenariosCompleted: number[] | undefined,
  currentScenario: 1 | 2 | 3 | null | undefined
): boolean {
  // Allow save when at least one scenario is completed (covers recovery and post-completion pending save)
  if ((scenariosCompleted?.length ?? 0) > 0) return true;
  if (
    storedInterviewHasResumableScenarioProgress({
      messages: messages ?? [],
      scenariosCompleted,
      currentScenario: currentScenario ?? undefined,
      resumeActiveScenario: currentScenario ?? null,
    })
  ) {
    return true;
  }
  // Otherwise require interview proper: scenario started and at least 2 user responses
  if (!currentScenario || currentScenario < 1) return false;
  const userMessages = (messages ?? []).filter((m) => m.role === 'user');
  if (userMessages.length < 2) return false;
  return true;
}

/**
 * Resume should not trigger if the last saved AI message was only the greeting.
 */
export function isGreetingOnly(savedMessages: Array<{ role: string; content?: string }> | undefined): boolean {
  if (!savedMessages || savedMessages.length === 0) return true;
  const userCount = savedMessages.filter((m) => m.role === 'user').length;
  /** Never treat as "greeting-only wipe" once the interview has real user turns (last line can still echo a greeting phrase). */
  if (userCount >= 2) return false;
  const aiMessages = savedMessages.filter((m) => m.role === 'assistant');
  if (aiMessages.length <= 1) return true;
  const lastAI = aiMessages[aiMessages.length - 1];
  const content = (lastAI?.content ?? '').toLowerCase();
  /** Mid-interviewer lines must not trip pre-interview greeting heuristics (second refresh after resume welcome path). */
  if (
    content.includes('welcome back') ||
    content.includes('pick up where we left off') ||
    content.includes('left off in the personal part') ||
    content.includes('repeat what i said')
  ) {
    return false;
  }
  const greetingPhrases = [
    'welcome to amoraea',
    'what can i call you',
    'what should i call you',
    'nice to meet you',
    'good to meet you',
  ];
  return greetingPhrases.some((phrase) => content.includes(phrase));
}

const RESUME_WELCOME_SPOKEN_PREFIX = 'amoraea_resume_welcome_spoken_';

/**
 * Web: in-memory only. `sessionStorage` survives full page refresh, which incorrectly suppressed
 * welcome-back TTS on reload (user never heard it again after refresh).
 */
const resumeWelcomeSpokenWebMemory = new Set<string>();
/** Synchronous guard: one in-flight welcome TTS per attempt (gesture flush + tap race). */
let resumeWelcomePlaybackLockAttemptId: string | null = null;

/** Invalidates in-flight resume welcome playback async tasks across remounts / duplicate resume. */
let resumeWelcomePlaybackGeneration = 0;

export function bumpResumeWelcomePlaybackGeneration(): number {
  resumeWelcomePlaybackGeneration += 1;
  return resumeWelcomePlaybackGeneration;
}

export function getResumeWelcomePlaybackGeneration(): number {
  return resumeWelcomePlaybackGeneration;
}

/** Set when interview audio (mic or TTS) is interrupted by app background — replay on foreground return. */
let pendingBackgroundAudioInterrupt: 'recording' | 'tts' | null = null;

export function markInterviewAudioInterruptedByBackground(
  kind: 'recording' | 'tts',
): void {
  pendingBackgroundAudioInterrupt = kind;
}

export function takeInterviewAudioInterruptedByBackground(): 'recording' | 'tts' | null {
  const kind = pendingBackgroundAudioInterrupt;
  pendingBackgroundAudioInterrupt = null;
  return kind;
}

export function resumeWelcomeSpokenKey(attemptId: string): string {
  return `${RESUME_WELCOME_SPOKEN_PREFIX}${attemptId}`;
}

const PREPARING_RESULTS_SESSION_PREFIX = 'amoraea_preparing_results_';

export function preparingResultsSessionKey(userId: string): string {
  return `${PREPARING_RESULTS_SESSION_PREFIX}${userId}`;
}

/** Survives React remount / strict-mode double mount while scoreInterview runs (web sessionStorage). */
export function markPreparingResultsSession(userId: string): void {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(preparingResultsSessionKey(userId), '1');
  }
}

export function clearPreparingResultsSession(userId: string): void {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(preparingResultsSessionKey(userId));
  }
}

export function hasPreparingResultsSession(userId: string): boolean {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(preparingResultsSessionKey(userId)) === '1';
}

/** Each storage resume / refresh should offer welcome TTS again; clears legacy web sessionStorage too. */
export async function clearResumeWelcomeSpokenForHydration(attemptId: string | null | undefined): Promise<void> {
  if (!attemptId) return;
  resumeWelcomeSpokenWebMemory.delete(attemptId);
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(resumeWelcomeSpokenKey(attemptId));
    return;
  }
  try {
    await AsyncStorage.removeItem(resumeWelcomeSpokenKey(attemptId));
  } catch {
    /* non-fatal */
  }
}

export async function wasResumeWelcomeSpoken(attemptId: string | null | undefined): Promise<boolean> {
  if (!attemptId) return false;
  if (Platform.OS === 'web') {
    return resumeWelcomeSpokenWebMemory.has(attemptId);
  }
  const key = resumeWelcomeSpokenKey(attemptId);
  try {
    return (await AsyncStorage.getItem(key)) === '1';
  } catch {
    return false;
  }
}

export async function markResumeWelcomeSpoken(attemptId: string | null | undefined): Promise<void> {
  if (!attemptId) return;
  if (Platform.OS === 'web') {
    resumeWelcomeSpokenWebMemory.add(attemptId);
    return;
  }
  const key = resumeWelcomeSpokenKey(attemptId);
  try {
    await AsyncStorage.setItem(key, '1');
  } catch {
    /* non-fatal */
  }
}

export function tryAcquireResumeWelcomePlayback(attemptId: string | null | undefined): boolean {
  if (!attemptId) return false;
  if (resumeWelcomeSpokenWebMemory.has(attemptId)) return false;
  if (resumeWelcomePlaybackLockAttemptId === attemptId) return false;
  resumeWelcomePlaybackLockAttemptId = attemptId;
  return true;
}

/** Block turn processing for the full resume playback window (even if welcome was spoken before). */
export function acquireResumeWelcomePlaybackLock(attemptId: string | null | undefined): void {
  if (!attemptId) return;
  resumeWelcomePlaybackLockAttemptId = attemptId;
}

export function releaseResumeWelcomePlaybackLock(attemptId: string | null | undefined): void {
  if (attemptId && resumeWelcomePlaybackLockAttemptId === attemptId) {
    resumeWelcomePlaybackLockAttemptId = null;
  }
}

export function clearResumeWelcomePlaybackLock(): void {
  resumeWelcomePlaybackLockAttemptId = null;
}

export function isResumeWelcomePlaybackLocked(attemptId: string | null | undefined): boolean {
  return attemptId != null && resumeWelcomePlaybackLockAttemptId === attemptId;
}

/**
 * Save interview progress only when there is meaningful progress (avoids resume loop from pre-interview state).
 */
export async function saveInterviewProgress(
  userId: string,
  state: Omit<StoredInterviewData, 'version' | 'userId' | 'lastSavedAt'>
): Promise<void> {
  if (
    !shouldSaveToStorage(state.messages, state.scenariosCompleted, state.currentScenario)
  ) {
    return;
  }
  const prior = await loadInterviewFromStorage(userId);
  await saveInterviewToStorage(userId, mergeInterviewStoragePayload(prior, state));
}
