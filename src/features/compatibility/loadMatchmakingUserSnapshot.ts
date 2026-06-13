/**
 * Load {@link MatchmakingUserSnapshot} + mapping extras from Supabase for pairwise scoring scripts.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CompatibilityFormData } from '@/domain/models/CompatibilityForm';
import {
  normalizeLifeDomainsFromProfile,
  type OnboardingLifeDomainValues,
} from '@/shared/constants/normalizeLifeDomainsFromProfile';
import type { MatchmakingUserMappingExtras } from './mapMatchmakingUserToCompatibilityInputs';
import type {
  MatchmakingInterviewSnapshot,
  MatchmakingPostInterviewTypology,
  MatchmakingPreferencesSnapshot,
  MatchmakingProfileSnapshot,
  MatchmakingUserSnapshot,
} from './matchmakingPairPayload';

export type LoadedMatchmakingUser = {
  snapshot: MatchmakingUserSnapshot;
  extras: MatchmakingUserMappingExtras;
};

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function profileJsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

function mapPillarScores(raw: unknown): MatchmakingInterviewSnapshot['pillarScores'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: NonNullable<MatchmakingInterviewSnapshot['pillarScores']> = {};
  for (const key of [
    'mentalizing',
    'accountability',
    'contempt',
    'repair',
    'regulation',
    'attunement',
    'appreciation',
    'commitment_threshold',
  ] as const) {
    const v = num(o[key]);
    if (v != null) out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapLifeDomainAnswers(
  rows: Array<{ domain_id: string; question_id: string; answer: string | null }> | null,
  sliderSeed: OnboardingLifeDomainValues,
): MatchmakingProfileSnapshot['lifeDomains'] {
  const answers: NonNullable<NonNullable<MatchmakingProfileSnapshot['lifeDomains']>['answers']> = {};

  for (const row of rows ?? []) {
    if (!row.answer) continue;
    const domain = row.domain_id as keyof typeof answers;
    if (!answers[domain]) answers[domain] = {};
    answers[domain][row.question_id] = row.answer;
  }

  return {
    intimacy: sliderSeed.intimacy,
    finance: sliderSeed.finance,
    spirituality: sliderSeed.spirituality,
    family: sliderSeed.family,
    physicalHealth: sliderSeed.physicalHealth,
    answers: Object.keys(answers).length > 0 ? answers : undefined,
  };
}

async function fetchLatestInterview(
  supabase: SupabaseClient,
  userId: string,
): Promise<MatchmakingInterviewSnapshot | undefined> {
  const { data, error } = await supabase
    .from('interview_attempts')
    .select('id, passed, weighted_score, modified_weighted_score, pillar_scores')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`interview_attempts: ${error.message}`);
  if (!data) return undefined;

  return {
    attemptId: String(data.id),
    passed: data.passed,
    weightedScore: num(data.weighted_score),
    modifiedWeightedScore: num(data.modified_weighted_score),
    pillarScores: mapPillarScores(data.pillar_scores),
  };
}

async function fetchAssessments(
  supabase: SupabaseClient,
  userId: string,
): Promise<MatchmakingPostInterviewTypology> {
  const { data, error } = await supabase
    .from('user_assessments')
    .select('instrument, scores')
    .eq('user_id', userId)
    .in('instrument', ['ECR-36', 'PVQ-21', 'CONFLICT-30']);

  if (error) throw new Error(`user_assessments: ${error.message}`);

  const out: MatchmakingPostInterviewTypology = {};
  for (const row of data ?? []) {
    const scores = (row.scores as Record<string, number>) ?? {};
    if (row.instrument === 'ECR-36') {
      out.attachment = {
        anxiety: num(scores.anxiety),
        avoidance: num(scores.avoidance),
      };
    } else if (row.instrument === 'PVQ-21') {
      out.values = { ...scores };
    } else if (row.instrument === 'CONFLICT-30') {
      out.conflictStyle = {
        competing: num(scores.competing),
        collaborating: num(scores.collaborating),
        compromising: num(scores.compromising),
        avoiding: num(scores.avoiding),
        accommodating: num(scores.accommodating),
      };
    }
  }
  return out;
}

/** Load one user's snapshot for v2 compatibility scoring. */
export async function loadMatchmakingUserSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<LoadedMatchmakingUser> {
  const [profileRes, userRes, interview, assessments, compatRes, settingsRes, answersRes] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('profile_json')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('users')
        .select(
          'psychometrics_rfq_score, psychometrics_gasp_score, psychometrics_brs_score, psychometrics_scs_sf_score, psychometrics_dweck_score, psychometrics_anxiety_trait_score, psychometrics_npi_entitlement_score, psychometrics_sexual_communication_score',
        )
        .eq('id', userId)
        .maybeSingle(),
      fetchLatestInterview(supabase, userId),
      fetchAssessments(supabase, userId),
      supabase
        .from('compatibility')
        .select('compatibility_data')
        .eq('profile_id', userId)
        .maybeSingle(),
      supabase.from('life_domain_settings').select('domain_id, importance').eq('user_id', userId),
      supabase
        .from('life_domain_answers')
        .select('domain_id, question_id, answer')
        .eq('user_id', userId),
    ]);

  if (profileRes.error) throw new Error(`profiles: ${profileRes.error.message}`);
  if (userRes.error) throw new Error(`users: ${userRes.error.message}`);
  if (compatRes.error) throw new Error(`compatibility: ${compatRes.error.message}`);
  if (settingsRes.error) throw new Error(`life_domain_settings: ${settingsRes.error.message}`);
  if (answersRes.error) throw new Error(`life_domain_answers: ${answersRes.error.message}`);

  const profileJson = profileJsonObject(profileRes.data?.profile_json);
  const compatibilityData = (compatRes.data?.compatibility_data ??
    {}) as Partial<CompatibilityFormData>;

  const slidersFromSettings: Record<string, number> = {};
  for (const row of settingsRes.data ?? []) {
    if (typeof row.importance === 'number') {
      const domainId = String(row.domain_id);
      const key =
        domainId === 'health'
          ? 'physicalHealth'
          : domainId === 'intimacy' ||
              domainId === 'finance' ||
              domainId === 'spirituality' ||
              domainId === 'family'
            ? domainId
            : null;
      if (key) slidersFromSettings[key] = row.importance;
    }
  }

  const lifeDomainsFromProfile = normalizeLifeDomainsFromProfile(
    profileJson.lifeDomains ?? profileJson.life_domains,
  );
  const lifeDomains = mapLifeDomainAnswers(answersRes.data, lifeDomainsFromProfile);
  if (Object.keys(slidersFromSettings).length > 0) {
    lifeDomains.intimacy = slidersFromSettings.intimacy ?? lifeDomainsFromProfile.intimacy;
    lifeDomains.finance = slidersFromSettings.finance ?? lifeDomainsFromProfile.finance;
    lifeDomains.spirituality = slidersFromSettings.spirituality ?? lifeDomainsFromProfile.spirituality;
    lifeDomains.family = slidersFromSettings.family ?? lifeDomainsFromProfile.family;
    lifeDomains.physicalHealth =
      slidersFromSettings.physicalHealth ?? lifeDomainsFromProfile.physicalHealth;
  }

  const matchPreferences =
    profileJson.matchPreferences && typeof profileJson.matchPreferences === 'object'
      ? (profileJson.matchPreferences as MatchmakingPreferencesSnapshot['matchPreferences'])
      : undefined;

  const profile: MatchmakingProfileSnapshot = {
    displayName: str(profileJson.displayName ?? profileJson.display_name),
    relationshipStyle: str(profileJson.relationshipStyle ?? profileJson.relationship_type),
    wantKids: str(profileJson.wantKids ?? profileJson.want_kids),
    religion: str(profileJson.religion),
    politics: str(profileJson.politics),
    location: str(profileJson.location),
    lifeDomains,
  };

  const lat = num(profileJson.lat ?? profileJson.location_latitude);
  const lon = num(profileJson.lon ?? profileJson.location_longitude ?? profileJson.lng);

  const userRow = userRes.data ?? {};
  const extras: MatchmakingUserMappingExtras = {
    compatibilityData,
    profileJson,
    locationCoords: lat != null && lon != null ? { lat, lng: lon } : null,
    npiEntitlementScore: num(userRow.psychometrics_npi_entitlement_score),
    anxietyTraitScore: num(userRow.psychometrics_anxiety_trait_score),
    gaspExternalizationScore: num(userRow.psychometrics_gasp_score),
    prefPartnerPoliticalAlignmentImportance: str(
      profileJson.prefPartnerPoliticalAlignmentImportance,
    ),
  };

  const snapshot: MatchmakingUserSnapshot = {
    userId,
    eligibleForMatching: interview?.passed === true,
    interview,
    preInterviewPsychometrics: {
      rfqScore: num(userRow.psychometrics_rfq_score),
      gaspScore: num(userRow.psychometrics_gasp_score),
      brsScore: num(userRow.psychometrics_brs_score),
      scsSfScore: num(userRow.psychometrics_scs_sf_score),
      dweckScore: num(userRow.psychometrics_dweck_score),
    },
    postInterviewTypology: {
      ...assessments,
      sexualCommunicationMean: num(userRow.psychometrics_sexual_communication_score),
    },
    profile,
    preferences: {
      relationshipType: str(profileJson.relationshipStyle ?? profileJson.relationship_type),
      willingToRelocate: compatibilityData.willingToRelocate ?? null,
      matchPreferences,
    },
  };

  return { snapshot, extras };
}

export function createServiceRoleSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)',
    );
  }
  return createClient(url, key);
}
