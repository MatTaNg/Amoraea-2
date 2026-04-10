import AsyncStorage from '@react-native-async-storage/async-storage';
import { AsyncStorageService } from '../AsyncStorageService';
import { OnboardingState } from '@domain/models/OnboardingState';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
    },
  };
});

describe('AsyncStorageService', () => {
  let service: AsyncStorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.removeItem('@amoraea:onboarding_state');
    await AsyncStorage.removeItem('@amoraea:retry_queue');
    await AsyncStorage.removeItem('@amoraea:interview_framing_ack:user-1');
    await AsyncStorage.removeItem('@amoraea:interview_framing_ack:user-2');
    service = new AsyncStorageService();
  });

  describe('onboarding state', () => {
    it('saveOnboardingState persists JSON', async () => {
      const state: OnboardingState = {
        step: 2,
        name: 'A',
        age: null,
        gender: null,
        attractedTo: null,
        heightCentimeters: null,
        occupation: null,
        location: null,
        photoUris: [],
      };
      await service.saveOnboardingState(state);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const raw = await AsyncStorage.getItem('@amoraea:onboarding_state');
      expect(JSON.parse(raw!)).toEqual(state);
    });

    it('getOnboardingState returns null when missing', async () => {
      await AsyncStorage.removeItem('@amoraea:onboarding_state');
      const got = await service.getOnboardingState();
      expect(got).toBeNull();
    });

    it('clearOnboardingState removes key', async () => {
      await service.saveOnboardingState({
        step: 1,
        name: null,
        age: null,
        gender: null,
        attractedTo: null,
        heightCentimeters: null,
        occupation: null,
        location: null,
        photoUris: [],
      });
      await service.clearOnboardingState();
      expect(await service.getOnboardingState()).toBeNull();
    });
  });

  describe('interview framing ack', () => {
    it('setInterviewFramingAcknowledged writes per-user key', async () => {
      await service.setInterviewFramingAcknowledged('user-1');
      const v = await AsyncStorage.getItem('@amoraea:interview_framing_ack:user-1');
      expect(v).toBe('1');
    });

    it('getInterviewFramingAcknowledged is false until set', async () => {
      expect(await service.getInterviewFramingAcknowledged('user-2')).toBe(false);
      await service.setInterviewFramingAcknowledged('user-2');
      expect(await service.getInterviewFramingAcknowledged('user-2')).toBe(true);
    });
  });

  describe('retry queue', () => {
    it('addToRetryQueue appends and getRetryQueue returns items', async () => {
      const item = {
        userId: 'u',
        update: { foo: 1 },
        timestamp: new Date().toISOString(),
      };
      await service.addToRetryQueue(item);
      const q = await service.getRetryQueue();
      expect(q).toHaveLength(1);
      expect(q[0].userId).toBe('u');
    });
  });
});
