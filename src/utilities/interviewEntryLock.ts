import AsyncStorage from '@react-native-async-storage/async-storage';

/** In-memory lock: user tapped Continue and entered the interview stack screen. */
const enteredInterviewFlowUserIds = new Set<string>();

function storageKey(userId: string): string {
  return `@amoraea/interview_flow_entered:${userId}`;
}

export function markUserEnteredInterviewFlow(userId: string): void {
  if (!userId) return;
  enteredInterviewFlowUserIds.add(userId);
  void (async () => {
    try {
      await AsyncStorage.setItem(storageKey(userId), '1');
    } catch {
      /* best-effort */
    }
  })();
}

export async function hydrateUserEnteredInterviewFlowFromStorage(
  userId: string,
): Promise<boolean> {
  if (userHasEnteredInterviewFlow(userId)) return true;
  if (!userId) return false;
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (raw === '1') {
      enteredInterviewFlowUserIds.add(userId);
      return true;
    }
  } catch {
    /* best-effort */
  }
  return false;
}

export async function clearUserEnteredInterviewFlow(userId: string): Promise<void> {
  if (!userId) return;
  enteredInterviewFlowUserIds.delete(userId);
  try {
    await AsyncStorage.removeItem(storageKey(userId));
  } catch {
    /* best-effort */
  }
}

export function userHasEnteredInterviewFlow(userId: string): boolean {
  return userId.length > 0 && enteredInterviewFlowUserIds.has(userId);
}
