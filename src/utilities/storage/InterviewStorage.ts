import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'amoraea_interview_';

const memoryFallback = new Map<string, string>();
let onFallbackListener: (() => void) | null = null;

export function setStorageFallbackListener(cb: (() => void) | null): void {
  onFallbackListener = cb;
}

const safeAsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
      memoryFallback.set(key, value);
    } catch (err) {
      console.warn('AsyncStorage unavailable, using memory fallback:', err instanceof Error ? err.message : err);
      memoryFallback.set(key, value);
      onFallbackListener?.();
      const isQuota = err instanceof Error && (err as Error & { name?: string }).name === 'QuotaExceededError';
      if (isQuota) {
        try {
          const allKeys = await AsyncStorage.getAllKeys();
          const interviewKeys = allKeys.filter(
            (k) => k.startsWith(KEY_PREFIX) && k !== key
          );
          for (const k of interviewKeys) await AsyncStorage.removeItem(k);
          await AsyncStorage.setItem(key, value);
          memoryFallback.set(key, value);
        } catch {
          // still failing — memory fallback only
        }
      }
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
      memoryFallback.delete(key);
    } catch {
      memoryFallback.delete(key);
    }
  },
};

export const getStorageKey = (userId: string) => `${KEY_PREFIX}${userId}`;

export interface StoredScenarioScores {
  [key: number]: {
    pillarScores: Record<string, number | null>;
    pillarConfidence: Record<string, string>;
    keyEvidence: Record<string, string>;
    scenarioName?: string;
  } | null;
}

export interface StoredInterviewData {
  version: number;
  userId: string;
  attemptNumber?: number;
  messages: Array<{ role: string; content: string; scenarioNumber?: number; interviewMoment?: number }>;
  scenariosCompleted: number[];
  scenarioScores: StoredScenarioScores;
  lastSavedAt: string;
  currentScenario: 1 | 2 | 3 | null;
  /** Scenario in progress (set at scenario start, cleared when checkpoint scores save). Mirrors interview_attempts.resume_active_scenario. */
  resumeActiveScenario?: 1 | 2 | 3 | null;
  /** Set when DB save failed; recovery can retry on next load */
  pendingDatabaseSave?: boolean;
  saveFailedAt?: string;
  /** Payload for recovery save (interview_attempts insert + users update) */
  pendingAttemptPayload?: unknown;
  /** Scoring failures by scenario for debugging */
  scoringFailed?: Array<{ scenario: number; failedAt: string; error: string }>;
  /** Partial or complete emotion modal answers (sequential A–D letters). */
  emotionItemResponses?: string[];
  /** Set when auth session expired so UI can show "session timed out" and re-auth */
  sessionExpired?: boolean;
  /** True when final prompt was answered and scoring/preparing-results was pending on refresh. */
  pendingCompletion?: boolean;
  /** `interview_attempts.id` for this in-progress session (created at interview start). */
  sessionAttemptId?: string;
  /**
   * True once the scripted Moment 5 conflict-validity clarification was delivered (client inject).
   * Persisted so tab return / remount does not reset sequencing vs. the transcript.
   */
  moment_5_clarification_fired?: boolean;
  /** Set by unhandled-rejection safety net */
  emergencySave?: boolean;
  savedAt?: string;
  /** Scenarios whose first assessable opening question TTS completed (resume checkpoint). */
  scenarioOpeningDeliveredFor?: Array<1 | 2 | 3>;
  /** Confirmed scenario skip count (moments 1–3) — survives resume when in-memory refs reset. */
  scenarioSkipConfirmedCount?: number;
  /** Last assessable question text at save time — used to replay question-only on resume. */
  lastQuestionText?: string | null;
  /** Audio interrupt kind when navigation-away flush ran — avoids full scenario replay after recording interrupt. */
  navigationAwayAudioInterrupt?: 'recording' | 'tts';
  /** True when flush ran from AppState background (app switch / kill) rather than navigation blur. */
  backgroundProgressFlush?: boolean;
}

/** Merge prior disk snapshot with a patch without dropping fields omitted from `patch` (partial saves). */
export function mergeInterviewStoragePayload(
  prior: StoredInterviewData | null,
  patch: Omit<StoredInterviewData, 'version' | 'userId' | 'lastSavedAt'>
): Omit<StoredInterviewData, 'version' | 'userId' | 'lastSavedAt'> {
  if (!prior) return patch;
  const { version: _v, userId: _u, lastSavedAt: _l, ...rest } = prior;
  return { ...rest, ...patch };
}

export async function saveInterviewToStorage(
  userId: string,
  data: Omit<StoredInterviewData, 'version' | 'userId' | 'lastSavedAt'>
): Promise<void> {
  if (!userId) return;
  try {
    const key = getStorageKey(userId);
    const payload: StoredInterviewData = {
      version: 1,
      userId,
      lastSavedAt: new Date().toISOString(),
      attemptNumber: data.attemptNumber ?? 1,
      ...data,
    };
    await safeAsyncStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to save interview to storage:', err);
  }
}

export async function loadInterviewFromStorage(userId: string): Promise<StoredInterviewData | null> {
  if (!userId) return null;
  try {
    const key = getStorageKey(userId);
    const raw = await safeAsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredInterviewData;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch (err) {
    console.error('Failed to load interview from storage:', err);
    return null;
  }
}

export async function clearInterviewFromStorage(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await safeAsyncStorage.removeItem(getStorageKey(userId));
  } catch (err) {
    console.error('Failed to clear interview from storage:', err);
  }
}

export function getCurrentScenario(completedSet: Set<number> | number[]): 1 | 2 | 3 | null {
  const set = completedSet instanceof Set ? completedSet : new Set(completedSet);
  if (!set || set.size === 0) return 1;
  if (set.has(1) && !set.has(2)) return 2;
  if (set.has(2) && !set.has(3)) return 3;
  if (set.has(3)) return null;
  return 1;
}
