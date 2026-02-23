import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'human_design_';

export interface HumanDesignData {
  dateOfBirth: string | null; // YYYY-MM-DD
  timeOfBirth: string | null; // HH:mm
  placeOfBirth: string | null;
}

export async function getHumanDesign(userId: string): Promise<HumanDesignData | null> {
  try {
    const json = await AsyncStorage.getItem(KEY_PREFIX + userId);
    if (!json) return null;
    return JSON.parse(json) as HumanDesignData;
  } catch {
    return null;
  }
}

export async function setHumanDesign(userId: string, data: HumanDesignData): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + userId, JSON.stringify(data));
}
