import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearUserEnteredInterviewFlow,
  hydrateUserEnteredInterviewFlowFromStorage,
  markUserEnteredInterviewFlow,
  userHasEnteredInterviewFlow,
} from '@utilities/interviewEntryLock';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

describe('interviewEntryLock', () => {
  const userId = 'user-welcome-continue';

  beforeEach(async () => {
    await clearUserEnteredInterviewFlow(userId);
    jest.mocked(AsyncStorage.getItem).mockReset().mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockReset().mockResolvedValue(undefined);
    jest.mocked(AsyncStorage.removeItem).mockReset().mockResolvedValue(undefined);
  });

  it('marks entry in memory and persists to storage', () => {
    markUserEnteredInterviewFlow(userId);
    expect(userHasEnteredInterviewFlow(userId)).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `@amoraea/interview_flow_entered:${userId}`,
      '1',
    );
  });

  it('hydrates memory from persisted storage', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('1');
    await expect(hydrateUserEnteredInterviewFlowFromStorage(userId)).resolves.toBe(true);
    expect(userHasEnteredInterviewFlow(userId)).toBe(true);
  });

  it('clears memory and storage on interview completion reset', async () => {
    markUserEnteredInterviewFlow(userId);
    await clearUserEnteredInterviewFlow(userId);
    expect(userHasEnteredInterviewFlow(userId)).toBe(false);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      `@amoraea/interview_flow_entered:${userId}`,
    );
  });
});
