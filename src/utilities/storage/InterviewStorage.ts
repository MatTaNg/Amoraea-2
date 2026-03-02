import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'amoraea_interview_';

export const getStorageKey = (userId: string) => `${KEY_PREFIX}${userId}`;

export interface StoredScenarioScores {
  [key: number]: {
    pillarScores: Record<string, number>;
    pillarConfidence: Record<string, string>;
    keyEvidence: Record<string, string>;
    scenarioName?: string;
  } | null;
}

export interface StoredInterviewData {
  version: number;
  userId: string;
  messages: Array<{ role: string; content: string }>;
  scenariosCompleted: number[];
  scenarioScores: StoredScenarioScores;
  lastSavedAt: string;
  currentScenario: 1 | 2 | 3 | null;
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
      ...data,
    };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to save interview to storage:', err);
  }
}

export async function loadInterviewFromStorage(userId: string): Promise<StoredInterviewData | null> {
  if (!userId) return null;
  try {
    const key = getStorageKey(userId);
    const raw = await AsyncStorage.getItem(key);
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
    await AsyncStorage.removeItem(getStorageKey(userId));
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
