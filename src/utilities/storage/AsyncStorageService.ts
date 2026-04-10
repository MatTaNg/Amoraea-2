import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingState } from '@domain/models/OnboardingState';

const ONBOARDING_STATE_KEY = '@amoraea:onboarding_state';
const RETRY_QUEUE_KEY = '@amoraea:retry_queue';
const CONNECTED_NETWORKS_KEY = '@amoraea:connected_networks';
const INTERVIEW_FRAMING_ACK_KEY = '@amoraea:interview_framing_ack';

export interface RetryQueueItem {
  userId: string;
  update: unknown;
  timestamp: string;
}

export class AsyncStorageService {
  async saveOnboardingState(state: OnboardingState): Promise<void> {
    try {
      await AsyncStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      throw new Error(`Failed to save onboarding state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getOnboardingState(): Promise<OnboardingState | null> {
    try {
      const data = await AsyncStorage.getItem(ONBOARDING_STATE_KEY);
      if (!data) return null;
      return JSON.parse(data) as OnboardingState;
    } catch (error) {
      return null;
    }
  }

  async clearOnboardingState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ONBOARDING_STATE_KEY);
    } catch (error) {
      // Ignore errors on clear
    }
  }

  async addToRetryQueue(item: RetryQueueItem): Promise<void> {
    try {
      const queue = await this.getRetryQueue();
      queue.push(item);
      await AsyncStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      // Ignore errors on retry queue
    }
  }

  async getRetryQueue(): Promise<RetryQueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(RETRY_QUEUE_KEY);
      if (!data) return [];
      return JSON.parse(data) as RetryQueueItem[];
    } catch (error) {
      return [];
    }
  }

  async clearRetryQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(RETRY_QUEUE_KEY);
    } catch (error) {
      // Ignore errors on clear
    }
  }

  async removeRetryQueueItem(index: number): Promise<void> {
    try {
      const queue = await this.getRetryQueue();
      queue.splice(index, 1);
      await AsyncStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      // Ignore errors
    }
  }

  async addConnectedNetwork(userId: string, networkId: string): Promise<void> {
    try {
      const key = `${CONNECTED_NETWORKS_KEY}:${userId}`;
      const data = await AsyncStorage.getItem(key);
      const networks: string[] = data ? JSON.parse(data) : [];
      if (!networks.includes(networkId)) {
        networks.push(networkId);
        await AsyncStorage.setItem(key, JSON.stringify(networks));
      }
    } catch (error) {
      // Ignore errors
    }
  }

  async getConnectedNetworks(userId: string): Promise<string[]> {
    try {
      const key = `${CONNECTED_NETWORKS_KEY}:${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      return [];
    }
  }

  /** Set after the user taps "Begin interview" on Interview Framing so that screen is not shown again on next launch. */
  async setInterviewFramingAcknowledged(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`${INTERVIEW_FRAMING_ACK_KEY}:${userId}`, '1');
    } catch {
      // best-effort
    }
  }

  async getInterviewFramingAcknowledged(userId: string): Promise<boolean> {
    try {
      const v = await AsyncStorage.getItem(`${INTERVIEW_FRAMING_ACK_KEY}:${userId}`);
      return v === '1';
    } catch {
      return false;
    }
  }
}

