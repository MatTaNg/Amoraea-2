import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearInterviewFromStorage,
  getCurrentScenario,
  getStorageKey,
  loadInterviewFromStorage,
  saveInterviewToStorage,
  type StoredInterviewData,
} from '../InterviewStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('InterviewStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('getStorageKey prefixes user id', () => {
    expect(getStorageKey('abc')).toBe('amoraea_interview_abc');
  });

  it('saveInterviewToStorage round-trips via loadInterviewFromStorage', async () => {
    await saveInterviewToStorage('user-1', {
      messages: [{ role: 'user', content: 'hi' }],
      scenariosCompleted: [],
      scenarioScores: {},
      currentScenario: 1,
    });

    const loaded = await loadInterviewFromStorage('user-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.userId).toBe('user-1');
    expect(loaded!.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('round-trips pendingCompletion flag (post-interview refresh / scoring resume)', async () => {
    await saveInterviewToStorage('user-2', {
      messages: [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
      ],
      scenariosCompleted: [],
      scenarioScores: {},
      currentScenario: 1,
      pendingCompletion: true,
    });
    const loaded = await loadInterviewFromStorage('user-2');
    expect(loaded?.pendingCompletion).toBe(true);
  });

  it('loadInterviewFromStorage returns null for wrong version', async () => {
    const key = getStorageKey('user-1');
    const bad: StoredInterviewData = {
      version: 2 as unknown as 1,
      userId: 'user-1',
      lastSavedAt: new Date().toISOString(),
      messages: [],
      scenariosCompleted: [],
      scenarioScores: {},
      currentScenario: null,
    };
    await AsyncStorage.setItem(key, JSON.stringify(bad));

    await expect(loadInterviewFromStorage('user-1')).resolves.toBeNull();
  });

  it('clearInterviewFromStorage removes key', async () => {
    await saveInterviewToStorage('user-1', {
      messages: [],
      scenariosCompleted: [],
      scenarioScores: {},
      currentScenario: null,
    });
    await clearInterviewFromStorage('user-1');
    await expect(loadInterviewFromStorage('user-1')).resolves.toBeNull();
  });

  it('saveInterviewToStorage no-ops when userId empty', async () => {
    await saveInterviewToStorage('', {
      messages: [],
      scenariosCompleted: [],
      scenarioScores: {},
      currentScenario: null,
    });
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.filter((k) => k.includes('amoraea_interview'))).toHaveLength(0);
  });
});

describe('getCurrentScenario', () => {
  it('returns 1 when nothing completed', () => {
    expect(getCurrentScenario([])).toBe(1);
    expect(getCurrentScenario(new Set())).toBe(1);
  });

  it('advances through completed scenarios', () => {
    expect(getCurrentScenario([1])).toBe(2);
    expect(getCurrentScenario([1, 2])).toBe(3);
    expect(getCurrentScenario([1, 2, 3])).toBe(null);
  });
});
