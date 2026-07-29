import AsyncStorage from '@react-native-async-storage/async-storage';

export const REFERRAL_COMPLETION_CONGRATS_PENDING_KEY =
  '@amoraea:referral_completion_congrats_pending';
export const REFERRAL_COMPLETION_CONGRATS_SEEN_KEY =
  '@amoraea:referral_completion_congrats_seen';

export function referralCompletionCongratsPendingKey(userId: string): string {
  return `${REFERRAL_COMPLETION_CONGRATS_PENDING_KEY}:${userId}`;
}

export function referralCompletionCongratsSeenKey(userId: string): string {
  return `${REFERRAL_COMPLETION_CONGRATS_SEEN_KEY}:${userId}`;
}

export async function markReferralCompletionCongratsPending(userId: string): Promise<void> {
  await AsyncStorage.setItem(referralCompletionCongratsPendingKey(userId), '1');
}

export async function clearReferralCompletionCongratsPending(userId: string): Promise<void> {
  await AsyncStorage.removeItem(referralCompletionCongratsPendingKey(userId));
}

export async function markReferralCompletionCongratsSeen(userId: string): Promise<void> {
  await AsyncStorage.setItem(referralCompletionCongratsSeenKey(userId), '1');
}
