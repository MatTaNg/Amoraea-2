import { supabase } from '@/data/supabase/client';
import { profilesRepo } from '@/data/repos/profilesRepo';
import {
  DEFAULT_ONBOARDING_LIFE_DOMAINS,
  ONBOARDING_LIFE_DOMAIN_KEYS,
  type OnboardingLifeDomainKey,
  type OnboardingLifeDomainValues,
} from '@/shared/components/LifeDomainDistribution';
import {
  LIFE_DOMAIN_ONBOARDING_QUESTIONS,
  type LifeDomainId,
} from '@/shared/constants/lifeDomainOnboardingQuestions';

const ONBOARDING_KEY_TO_DOMAIN_ID: Record<OnboardingLifeDomainKey, LifeDomainId> = {
  intimacy: 'intimacy',
  finance: 'finance',
  spirituality: 'spirituality',
  family: 'family',
  physicalHealth: 'health',
};

const DOMAIN_ID_TO_ONBOARDING_KEY: Record<LifeDomainId, OnboardingLifeDomainKey> = {
  intimacy: 'intimacy',
  finance: 'finance',
  spirituality: 'spirituality',
  family: 'family',
  health: 'physicalHealth',
};

export function sumLifeDomainSliders(values: OnboardingLifeDomainValues): number {
  return ONBOARDING_LIFE_DOMAIN_KEYS.reduce((s, k) => s + (values[k] ?? 0), 0);
}

/** Parse slider values from merged profile JSON (camelCase or snake_case). */
export function normalizeLifeDomainsFromProfile(raw: unknown): OnboardingLifeDomainValues {
  const out: OnboardingLifeDomainValues = { ...DEFAULT_ONBOARDING_LIFE_DOMAINS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const o = raw as Record<string, unknown>;
  const pick = (key: OnboardingLifeDomainKey, ...aliases: string[]) => {
    for (const alias of [key, ...aliases]) {
      const v = o[alias];
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[key] = Math.max(0, Math.min(100, Math.round(v)));
        return;
      }
    }
  };
  pick('intimacy', 'intimacy');
  pick('finance', 'finance');
  pick('spirituality', 'spirituality');
  pick('family', 'family');
  pick('physicalHealth', 'physical_health', 'physicalHealth', 'health');
  return out;
}

/** Load slider distribution saved during onboarding (`life_domain_settings`). */
export async function fetchLifeDomainImportanceSliders(
  userId: string,
): Promise<OnboardingLifeDomainValues | null> {
  const { data, error } = await supabase
    .from('life_domain_settings')
    .select('domain_id, importance')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  if (!data?.length) return null;

  const out: OnboardingLifeDomainValues = { ...DEFAULT_ONBOARDING_LIFE_DOMAINS };
  for (const row of data) {
    const domainId = row.domain_id as LifeDomainId;
    const key = DOMAIN_ID_TO_ONBOARDING_KEY[domainId];
    if (key && typeof row.importance === 'number' && Number.isFinite(row.importance)) {
      out[key] = Math.max(0, Math.min(100, Math.round(row.importance)));
    }
  }
  return sumLifeDomainSliders(out) === 100 ? out : null;
}

/** Profile JSON first; fall back to `life_domain_settings` when sliders are missing or invalid. */
export async function resolveLifeDomainSlidersForEdit(
  userId: string,
  profile: Record<string, unknown>,
): Promise<OnboardingLifeDomainValues> {
  const fromProfile = normalizeLifeDomainsFromProfile(
    profile.lifeDomains ?? profile.life_domains,
  );
  if (sumLifeDomainSliders(fromProfile) === 100) return fromProfile;
  try {
    const fromSettings = await fetchLifeDomainImportanceSliders(userId);
    if (fromSettings) return fromSettings;
  } catch (e) {
    if (__DEV__) console.warn('[lifeDomainProfileService] settings fetch', e);
  }
  return fromProfile;
}

export function onboardingLifeDomainKeyToId(key: OnboardingLifeDomainKey): LifeDomainId {
  return ONBOARDING_KEY_TO_DOMAIN_ID[key];
}

export type OnboardingLifeDomainsSliders = {
  intimacy?: number;
  finance?: number;
  spirituality?: number;
  family?: number;
  physicalHealth?: number;
};

export async function syncLifeDomainImportanceFromOnboarding(
  userId: string,
  lifeDomains: OnboardingLifeDomainsSliders,
): Promise<void> {
  const mappedSettings = [
    { domain_id: 'intimacy', importance: Number(lifeDomains.intimacy ?? 0) },
    { domain_id: 'finance', importance: Number(lifeDomains.finance ?? 0) },
    { domain_id: 'spirituality', importance: Number(lifeDomains.spirituality ?? 0) },
    { domain_id: 'family', importance: Number(lifeDomains.family ?? 0) },
    { domain_id: 'health', importance: Number(lifeDomains.physicalHealth ?? 0) },
  ].map((row) => ({
    domain_id: row.domain_id,
    importance: Math.max(0, Math.min(100, Math.round(row.importance))),
  }));

  const { error } = await supabase.from('life_domain_settings').upsert(
    mappedSettings.map((row) => ({
      user_id: userId,
      domain_id: row.domain_id,
      importance: row.importance,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'user_id,domain_id' },
  );
  if (error) throw new Error(error.message);

  await profilesRepo.updateProfile(userId, {
    lifeDomains: {
      intimacy: mappedSettings.find((r) => r.domain_id === 'intimacy')!.importance,
      finance: mappedSettings.find((r) => r.domain_id === 'finance')!.importance,
      spirituality: mappedSettings.find((r) => r.domain_id === 'spirituality')!.importance,
      family: mappedSettings.find((r) => r.domain_id === 'family')!.importance,
      physicalHealth: mappedSettings.find((r) => r.domain_id === 'health')!.importance,
    },
  });
}

export async function upsertLifeDomainAnswer(
  userId: string,
  domainId: LifeDomainId,
  questionId: string,
  patch: { answer?: string | null; show_on_match?: boolean },
): Promise<void> {
  const { error } = await supabase.from('life_domain_answers').upsert(
    {
      user_id: userId,
      domain_id: domainId,
      question_id: questionId,
      show_on_match: patch.show_on_match ?? false,
      answer: patch.answer ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,domain_id,question_id' },
  );
  if (error) throw new Error(error.message);
}

/** @deprecated Placeholder rows are not required; {@link upsertLifeDomainAnswer} upserts on save. */
export async function ensureLifeDomainQuestionsExist(
  _userId: string,
  _domainId: LifeDomainId,
): Promise<void> {
  /* no-op: removed N+1 select/insert per question (caused hung onboarding on spirituality step). */
}

export type LifeDomainAnswersMap = Partial<Record<LifeDomainId, Record<string, string>>>;

export async function fetchLifeDomainAnswersMap(userId: string): Promise<LifeDomainAnswersMap> {
  const { data, error } = await supabase
    .from('life_domain_answers')
    .select('domain_id, question_id, answer')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  const out: LifeDomainAnswersMap = {};
  for (const row of data ?? []) {
    const domainId = row.domain_id as LifeDomainId;
    const answer = row.answer;
    if (!out[domainId]) out[domainId] = {};
    if (answer != null && String(answer).trim() !== '') {
      out[domainId]![row.question_id] = String(answer).trim();
    }
  }
  return out;
}

export async function saveLifeDomainAnswersFromOnboarding(
  userId: string,
  answersByDomain: LifeDomainAnswersMap,
): Promise<void> {
  for (const domainId of Object.keys(answersByDomain) as LifeDomainId[]) {
    const domainAnswers = answersByDomain[domainId];
    if (!domainAnswers) continue;
    for (const [questionId, raw] of Object.entries(domainAnswers)) {
      const answer = raw?.trim() ?? '';
      if (!answer) continue;
      await upsertLifeDomainAnswer(userId, domainId, questionId, {
        answer,
        show_on_match: false,
      });
    }
  }
}
