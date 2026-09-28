import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '@data/supabase/client';

export const SIGNUP_LEAD_TOKEN_STORAGE_KEY = '@amoraea:signup_lead_token';

export function normalizeSignupLeadToken(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

export function readSignupLeadFromWebUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return normalizeSignupLeadToken(new URLSearchParams(window.location.search).get('lead'));
}

export async function persistSignupLeadToken(token: string): Promise<void> {
  const normalized = normalizeSignupLeadToken(token);
  if (!normalized) return;
  await AsyncStorage.setItem(SIGNUP_LEAD_TOKEN_STORAGE_KEY, normalized);
}

export async function readSignupLeadToken(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(SIGNUP_LEAD_TOKEN_STORAGE_KEY);
  return normalizeSignupLeadToken(stored);
}

export async function clearSignupLeadToken(): Promise<void> {
  await AsyncStorage.removeItem(SIGNUP_LEAD_TOKEN_STORAGE_KEY);
}

export type ClaimSignupLeadResult = {
  ok: boolean;
  email?: string;
  alreadyClaimed?: boolean;
  error?: string;
};

export async function claimSignupLead(token: string): Promise<ClaimSignupLeadResult> {
  const normalized = normalizeSignupLeadToken(token);
  if (!normalized) {
    return { ok: false, error: 'Missing signup link token' };
  }

  const { data, error } = await supabase.functions.invoke('claim-signup-lead', {
    body: { token: normalized },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const payload = data as ClaimSignupLeadResult | null;
  if (!payload?.ok) {
    return {
      ok: false,
      error: typeof payload?.error === 'string' ? payload.error : 'Could not link your email',
    };
  }

  return payload;
}

export async function claimStoredSignupLeadIfPresent(): Promise<ClaimSignupLeadResult | null> {
  const token = await readSignupLeadToken();
  if (!token) return null;

  const result = await claimSignupLead(token);
  if (result.ok) {
    await clearSignupLeadToken();
  }
  return result;
}
