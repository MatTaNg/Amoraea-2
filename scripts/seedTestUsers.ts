// To clean up: npx ts-node scripts/seedTestUsers.ts --clean
// (or: npm run seed-test-users -- --clean)
//
// Seeds 12 deterministic test users for compatibility algorithm v2 QA.
// Tagged in profiles.profile_json.compatibilityTestSeed — never eligible for matching
// (interview_attempts.passed = false; users.interview_passed = false).

import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { COMPATIBILITY_TEST_SEED_TAG } from '../src/features/compatibility/compatibilityTestSeedUser';
import { computePairCompatibilityScore } from '../src/features/compatibility/computePairCompatibilityScore';
import type { MappedUserCompatibilityInputs } from '../src/features/compatibility/mapMatchmakingUserToCompatibilityInputs';

const SEED_TAG = COMPATIBILITY_TEST_SEED_TAG;

function createServiceRoleSupabase(): SupabaseClient {
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

type InterviewPillars = {
  repair: number;
  contempt: number;
  accountability: number;
  regulation: number;
  mentalizing: number;
  attunement: number;
  appreciation: number;
  commitment_threshold: number;
};

type SchwartzValues = Record<string, number>;

type ConflictStyle = {
  collaborating: number;
  compromising: number;
  accommodating: number;
  avoiding: number;
  competing: number;
};

type Psychometrics = {
  rfq: number;
  gaspExternalization: number;
  scsSf: number;
  brs: number;
  anxietyTrait: number;
  npiEntitlement?: number | null;
};

type ProfileOverrides = {
  wantKids?: string;
  politics?: string;
  financesPooled?: 'Pooled' | 'Separate' | 'Hybrid';
  financialRiskComfort?: number;
  yearlyIncome?: string;
};

type SeedUserSpec = {
  index: number;
  label: string;
  slug: string;
  attachment: { anxiety: number; avoidance: number };
  values: SchwartzValues;
  pillars: InterviewPillars;
  psychometrics: Psychometrics;
  conflictStyle: ConflictStyle;
  interviewWeightedScore: number;
  profile?: ProfileOverrides;
  /** brs_low_resilience_floor in screening gate — intentional for Henry. */
  brsFloorNote?: boolean;
};

const ALICE_VALUES: SchwartzValues = {
  self_direction: 1.5,
  benevolence: 1.8,
  universalism: 1.6,
  tradition: -1.2,
  conformity: -1.0,
  security: -0.8,
  stimulation: 0.3,
  hedonism: 0.2,
  achievement: 0.4,
  power: -0.3,
};

const FRANK_VALUES: SchwartzValues = {
  tradition: 1.8,
  conformity: 1.6,
  security: 1.7,
  power: 0.8,
  achievement: 0.6,
  self_direction: -1.2,
  stimulation: -1.4,
  universalism: -0.8,
  benevolence: 0.4,
  hedonism: -0.6,
};

const GRACE_VALUES: SchwartzValues = {
  self_direction: 1.8,
  stimulation: 1.5,
  universalism: 1.7,
  benevolence: 1.5,
  hedonism: 0.8,
  tradition: -1.6,
  conformity: -1.5,
  security: -1.0,
  power: -0.8,
  achievement: 0.2,
};

const BASE_PROFILE: ProfileOverrides = {
  wantKids: 'Want kids',
  politics: 'moderate',
  financesPooled: 'Pooled',
  financialRiskComfort: 5,
  yearlyIncome: '$75,000 – $99,999',
};

const ALICE_PILLARS: InterviewPillars = {
  repair: 9,
  contempt: 2,
  accountability: 9,
  regulation: 8,
  mentalizing: 8,
  attunement: 8,
  appreciation: 8,
  commitment_threshold: 8,
};

const BOB_PILLARS: InterviewPillars = {
  repair: 8,
  contempt: 2,
  accountability: 8,
  regulation: 8,
  mentalizing: 8,
  attunement: 8,
  appreciation: 8,
  commitment_threshold: 8,
};

const BOB_PSYCHOMETRICS: Psychometrics = {
  rfq: 5.8,
  gaspExternalization: 1.6,
  scsSf: 4.3,
  brs: 5.0,
  anxietyTrait: 1.9,
  npiEntitlement: 1,
};

const BOB_CONFLICT: ConflictStyle = {
  collaborating: 60,
  compromising: 25,
  accommodating: 10,
  avoiding: 3,
  competing: 2,
};

const LIFE_DOMAIN_SLIDERS: Record<string, number> = {
  intimacy: 70,
  finance: 65,
  spirituality: 60,
  family: 75,
  health: 70,
};

const SEED_USERS: SeedUserSpec[] = [
  {
    index: 1,
    label: 'Ideal Alice',
    slug: 'alice',
    attachment: { anxiety: 1.8, avoidance: 1.9 },
    values: ALICE_VALUES,
    pillars: ALICE_PILLARS,
    psychometrics: {
      rfq: 6.2,
      gaspExternalization: 1.5,
      scsSf: 4.5,
      brs: 5.2,
      anxietyTrait: 1.8,
      npiEntitlement: 1,
    },
    conflictStyle: {
      collaborating: 65,
      compromising: 20,
      accommodating: 10,
      avoiding: 3,
      competing: 2,
    },
    interviewWeightedScore: 8.2,
  },
  {
    index: 2,
    label: 'Compatible Bob',
    slug: 'bob',
    attachment: { anxiety: 2.0, avoidance: 2.1 },
    values: {
      ...ALICE_VALUES,
      self_direction: 1.4,
      benevolence: 1.7,
      universalism: 1.5,
      tradition: -1.1,
      conformity: -0.9,
      security: -0.7,
    },
    pillars: BOB_PILLARS,
    psychometrics: BOB_PSYCHOMETRICS,
    conflictStyle: BOB_CONFLICT,
    interviewWeightedScore: 8.0,
  },
  {
    index: 3,
    label: 'Anxious Clara',
    slug: 'clara',
    attachment: { anxiety: 6.2, avoidance: 1.8 },
    values: ALICE_VALUES,
    pillars: {
      repair: 7,
      contempt: 3,
      accountability: 7,
      regulation: 6,
      mentalizing: 7,
      attunement: 7,
      appreciation: 7,
      commitment_threshold: 6,
    },
    psychometrics: {
      rfq: 4.0,
      // GASP score 3.0 — previously scored -0.10 (average band), now scores 0 (strong band) after 4-item recalibration
      gaspExternalization: 3.0,
      scsSf: 3.5,
      brs: 3.5,
      anxietyTrait: 4.8,
    },
    conflictStyle: {
      accommodating: 40,
      compromising: 30,
      collaborating: 15,
      avoiding: 10,
      competing: 5,
    },
    interviewWeightedScore: 7.2,
  },
  {
    index: 4,
    label: 'Avoidant Dan',
    slug: 'dan',
    attachment: { anxiety: 1.9, avoidance: 6.3 },
    values: ALICE_VALUES,
    pillars: {
      repair: 6,
      contempt: 4,
      accountability: 6,
      regulation: 7,
      mentalizing: 6,
      attunement: 5,
      appreciation: 6,
      commitment_threshold: 5,
    },
    psychometrics: {
      rfq: 3.8,
      gaspExternalization: 3.5,
      scsSf: 3.2,
      brs: 3.5,
      anxietyTrait: 2.5,
    },
    conflictStyle: {
      avoiding: 55,
      compromising: 25,
      accommodating: 10,
      collaborating: 7,
      competing: 3,
    },
    interviewWeightedScore: 6.8,
  },
  {
    index: 5,
    label: 'Avoidant Eve',
    slug: 'eve',
    attachment: { anxiety: 2.1, avoidance: 6.1 },
    values: ALICE_VALUES,
    pillars: {
      repair: 6,
      contempt: 4,
      accountability: 6,
      regulation: 7,
      mentalizing: 6,
      attunement: 5,
      appreciation: 6,
      commitment_threshold: 5,
    },
    psychometrics: {
      rfq: 3.8,
      gaspExternalization: 3.5,
      scsSf: 3.2,
      brs: 3.5,
      anxietyTrait: 2.5,
    },
    conflictStyle: {
      avoiding: 55,
      compromising: 25,
      accommodating: 10,
      collaborating: 7,
      competing: 3,
    },
    interviewWeightedScore: 6.8,
  },
  {
    index: 6,
    label: 'Conservative Frank',
    slug: 'frank',
    attachment: { anxiety: 2.5, avoidance: 2.5 },
    values: FRANK_VALUES,
    pillars: {
      repair: 7,
      contempt: 4,
      accountability: 7,
      regulation: 7,
      mentalizing: 6,
      attunement: 6,
      appreciation: 7,
      commitment_threshold: 8,
    },
    psychometrics: {
      rfq: 3.8,
      gaspExternalization: 3.8,
      scsSf: 3.0,
      brs: 3.5,
      anxietyTrait: 2.5,
    },
    conflictStyle: {
      compromising: 35,
      collaborating: 25,
      accommodating: 20,
      competing: 12,
      avoiding: 8,
    },
    interviewWeightedScore: 7.0,
    profile: { politics: 'conservative' },
  },
  {
    index: 7,
    label: 'Progressive Grace',
    slug: 'grace',
    attachment: { anxiety: 2.3, avoidance: 2.2 },
    values: GRACE_VALUES,
    pillars: {
      repair: 7,
      contempt: 4,
      accountability: 7,
      regulation: 7,
      mentalizing: 6,
      attunement: 6,
      appreciation: 7,
      commitment_threshold: 8,
    },
    psychometrics: {
      rfq: 3.8,
      gaspExternalization: 3.8,
      scsSf: 3.0,
      brs: 3.5,
      anxietyTrait: 2.5,
    },
    conflictStyle: {
      compromising: 35,
      collaborating: 25,
      accommodating: 20,
      competing: 12,
      avoiding: 8,
    },
    interviewWeightedScore: 7.0,
    profile: { politics: 'liberal' },
  },
  {
    index: 8,
    label: 'Low Capacity Henry',
    slug: 'henry',
    attachment: { anxiety: 3.5, avoidance: 3.5 },
    values: ALICE_VALUES,
    pillars: {
      repair: 3,
      contempt: 8,
      accountability: 3,
      regulation: 3,
      mentalizing: 3,
      attunement: 3,
      appreciation: 3,
      commitment_threshold: 3,
    },
    psychometrics: {
      rfq: 1.8,
      gaspExternalization: 5.8,
      scsSf: 1.6,
      brs: 2.0, // brs_low_resilience_floor — intentional for screening gate testing
      anxietyTrait: 4.5,
      npiEntitlement: 5,
    },
    conflictStyle: {
      competing: 50,
      avoiding: 25,
      compromising: 15,
      accommodating: 7,
      collaborating: 3,
    },
    interviewWeightedScore: 6.1,
    brsFloorNote: true,
  },
  {
    index: 9,
    label: 'Finance Mismatch Isabel',
    slug: 'isabel',
    attachment: { anxiety: 2.2, avoidance: 2.0 },
    values: ALICE_VALUES,
    pillars: BOB_PILLARS,
    psychometrics: { ...BOB_PSYCHOMETRICS, npiEntitlement: 1 },
    conflictStyle: BOB_CONFLICT,
    interviewWeightedScore: 7.8,
    profile: {
      financesPooled: 'Separate',
      financialRiskComfort: 9,
      yearlyIncome: '$250,000 – $499,999',
    },
  },
  {
    index: 10,
    label: 'Dealbreaker Jake',
    slug: 'jake',
    attachment: { anxiety: 2.0, avoidance: 2.1 },
    values: {
      ...ALICE_VALUES,
      self_direction: 1.4,
      benevolence: 1.7,
      universalism: 1.5,
      tradition: -1.1,
      conformity: -0.9,
      security: -0.7,
    },
    pillars: BOB_PILLARS,
    psychometrics: BOB_PSYCHOMETRICS,
    conflictStyle: BOB_CONFLICT,
    interviewWeightedScore: 8.0,
    profile: { wantKids: "Don't want kids" },
  },
  {
    index: 11,
    label: 'Demanding-Withdrawing Kim',
    slug: 'kim',
    attachment: { anxiety: 2.5, avoidance: 2.3 },
    values: ALICE_VALUES,
    pillars: {
      repair: 6,
      contempt: 5,
      accountability: 6,
      regulation: 5,
      mentalizing: 6,
      attunement: 5,
      appreciation: 6,
      commitment_threshold: 6,
    },
    psychometrics: {
      rfq: 3.5,
      gaspExternalization: 4.0,
      scsSf: 3.0,
      brs: 3.2,
      anxietyTrait: 3.0,
    },
    conflictStyle: {
      competing: 60,
      accommodating: 15,
      compromising: 15,
      collaborating: 6,
      avoiding: 4,
    },
    interviewWeightedScore: 6.8,
  },
  {
    index: 12,
    label: 'Disorganised Morgan',
    slug: 'morgan',
    attachment: { anxiety: 5.8, avoidance: 5.6 },
    values: ALICE_VALUES,
    pillars: {
      repair: 5,
      contempt: 6,
      accountability: 5,
      regulation: 4,
      mentalizing: 5,
      attunement: 4,
      appreciation: 5,
      commitment_threshold: 4,
    },
    psychometrics: {
      rfq: 2.5,
      gaspExternalization: 5.0,
      scsSf: 2.0,
      brs: 2.5,
      anxietyTrait: 4.0,
      npiEntitlement: 4,
    },
    conflictStyle: {
      avoiding: 35,
      competing: 30,
      compromising: 20,
      accommodating: 10,
      collaborating: 5,
    },
    interviewWeightedScore: 6.3,
  },
];

type InsertedSeedUser = { id: string; label: string; index: number; slug: string };

function mergeProfile(overrides?: ProfileOverrides): Required<ProfileOverrides> {
  return {
    wantKids: overrides?.wantKids ?? BASE_PROFILE.wantKids!,
    politics: overrides?.politics ?? BASE_PROFILE.politics!,
    financesPooled: overrides?.financesPooled ?? BASE_PROFILE.financesPooled!,
    financialRiskComfort: overrides?.financialRiskComfort ?? BASE_PROFILE.financialRiskComfort!,
    yearlyIncome: overrides?.yearlyIncome ?? BASE_PROFILE.yearlyIncome!,
  };
}

async function findSeededUserIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, profile_json')
    .not('profile_json', 'is', null);

  if (error) throw new Error(`find seeded users: ${error.message}`);

  return (data ?? [])
    .filter((row) => {
      const seed = (row.profile_json as Record<string, unknown> | null)?.compatibilityTestSeed;
      return (
        seed &&
        typeof seed === 'object' &&
        !Array.isArray(seed) &&
        (seed as Record<string, unknown>).tag === SEED_TAG
      );
    })
    .map((row) => row.id);
}

async function deleteSeededUsers(supabase: SupabaseClient): Promise<number> {
  const ids = await findSeededUserIds(supabase);
  for (const id of ids) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw new Error(`delete user ${id}: ${error.message}`);
  }
  return ids.length;
}

async function assertNoExistingSeeds(supabase: SupabaseClient): Promise<void> {
  const ids = await findSeededUserIds(supabase);
  if (ids.length > 0) {
    throw new Error(
      `Found ${ids.length} existing compat test user(s). Re-run with --clean to remove them first.`,
    );
  }
}

async function insertSeedUser(
  supabase: SupabaseClient,
  spec: SeedUserSpec,
): Promise<InsertedSeedUser> {
  const profile = mergeProfile(spec.profile);
  const email = `compat-${SEED_TAG}-${spec.slug}@seed.amoraea.test`;
  const password = randomUUID();
  const now = new Date().toISOString();

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { compatibilityTestSeed: SEED_TAG, label: spec.label },
  });
  if (authErr || !authData.user) {
    throw new Error(`auth create ${spec.slug}: ${authErr?.message ?? 'no user'}`);
  }

  const userId = authData.user.id;

  const profileJson = {
    displayName: spec.label,
    wantKids: profile.wantKids,
    religion: 'none',
    relationshipStyle: 'monogamous',
    politics: profile.politics,
    lat: 30.2672,
    lng: -97.7431,
    matchPreferences: {
      partnerSameReligionRequired: 'No',
      relocationPreference: 'Yes',
    },
    prefPartnerPoliticalAlignmentImportance: 'No',
    compatibilityTestSeed: {
      tag: SEED_TAG,
      label: spec.label,
      index: spec.index,
      slug: spec.slug,
    },
  };

  const compatibilityData = {
    willingToRelocate: true,
    financialRiskComfort: profile.financialRiskComfort,
    alcoholFrequency: 'never',
    partnerDrinksComfort: 'yes_fine',
    cigaretteFrequency: 'never',
    partnerCigarettesComfort: 'yes_fine',
    cannabisTobaccoFrequency: 'never',
    partnerCannabisTobaccoComfort: 'yes_fine',
    recreationalDrugsFrequency: 'never',
    partnerRecreationalDrugsComfort: 'yes_fine',
  };

  const { error: usersErr } = await supabase.from('users').upsert({
    id: userId,
    email,
    display_name: spec.label,
    onboarding_completed: true,
    psychometrics_completed_at: now,
    psychometrics_rfq_score: spec.psychometrics.rfq,
    psychometrics_gasp_score: spec.psychometrics.gaspExternalization,
    psychometrics_gasp_guilt_repair_score: null,
    psychometrics_gasp_shame_withdraw_score: null,
    psychometrics_scs_sf_score: spec.psychometrics.scsSf,
    psychometrics_brs_score: spec.psychometrics.brs,
    psychometrics_anxiety_trait_score: spec.psychometrics.anxietyTrait,
    psychometrics_npi_entitlement_score: spec.psychometrics.npiEntitlement ?? null,
    interview_completed: true,
    interview_passed: false,
    interview_passed_computed: false,
    interview_passed_admin_override: null,
    interview_completed_at: now,
  });
  if (usersErr) throw new Error(`users ${spec.slug}: ${usersErr.message}`);

  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    display_name: spec.label,
    profile_json: profileJson,
  });
  if (profileErr) throw new Error(`profiles ${spec.slug}: ${profileErr.message}`);

  const { error: compatErr } = await supabase.from('compatibility').upsert({
    profile_id: userId,
    compatibility_data: compatibilityData,
  });
  if (compatErr) throw new Error(`compatibility ${spec.slug}: ${compatErr.message}`);

  const pillarScores = { ...spec.pillars };

  const { data: attemptRow, error: attemptErr } = await supabase
    .from('interview_attempts')
    .insert({
      user_id: userId,
      attempt_number: 1,
      completed_at: now,
      weighted_score: spec.interviewWeightedScore,
      modified_weighted_score: spec.interviewWeightedScore,
      passed: false,
      pillar_scores: pillarScores,
    })
    .select('id')
    .single();
  if (attemptErr || !attemptRow) {
    throw new Error(`interview_attempts ${spec.slug}: ${attemptErr?.message ?? 'no row'}`);
  }

  const { error: userAttemptErr } = await supabase
    .from('users')
    .update({
      latest_attempt_id: attemptRow.id,
      interview_attempt_count: 1,
    })
    .eq('id', userId);
  if (userAttemptErr) throw new Error(`users attempt cache ${spec.slug}: ${userAttemptErr.message}`);

  const assessmentRows = [
    {
      user_id: userId,
      instrument: 'ECR-36',
      scores: spec.attachment,
      raw_responses: {},
      completed_at: now,
    },
    {
      user_id: userId,
      instrument: 'PVQ-21',
      scores: spec.values,
      raw_responses: {},
      completed_at: now,
    },
    {
      user_id: userId,
      instrument: 'CONFLICT-30',
      scores: spec.conflictStyle,
      raw_responses: {},
      completed_at: now,
    },
  ];

  const { error: assessErr } = await supabase.from('user_assessments').upsert(assessmentRows, {
    onConflict: 'user_id,instrument',
  });
  if (assessErr) throw new Error(`user_assessments ${spec.slug}: ${assessErr.message}`);

  const lifeDomainSettings = Object.entries(LIFE_DOMAIN_SLIDERS).map(([domain_id, importance]) => ({
    user_id: userId,
    domain_id,
    importance,
  }));
  const { error: settingsErr } = await supabase.from('life_domain_settings').upsert(lifeDomainSettings, {
    onConflict: 'user_id,domain_id',
  });
  if (settingsErr) throw new Error(`life_domain_settings ${spec.slug}: ${settingsErr.message}`);

  const financeAnswers = [
    { user_id: userId, domain_id: 'finance', question_id: 'financesPooled', answer: profile.financesPooled },
    { user_id: userId, domain_id: 'finance', question_id: 'yearlyIncome', answer: profile.yearlyIncome },
  ];
  const { error: answersErr } = await supabase.from('life_domain_answers').upsert(financeAnswers, {
    onConflict: 'user_id,domain_id,question_id',
  });
  if (answersErr) throw new Error(`life_domain_answers ${spec.slug}: ${answersErr.message}`);

  if (spec.brsFloorNote) {
    console.log(
      `  [note] ${spec.label}: brs=${spec.psychometrics.brs} triggers brs_low_resilience_floor in screening gate (intentional).`,
    );
  }

  return { id: userId, label: spec.label, index: spec.index, slug: spec.slug };
}

type PairCase = {
  slugA: string;
  slugB: string;
  note: string;
};

const PAIR_MATRIX: PairCase[] = [
  { slugA: 'alice', slugB: 'bob', note: 'HIGHEST SCORE: both secure, matched values, high capacity' },
  { slugA: 'alice', slugB: 'clara', note: 'MODERATE: secure + anxious, mild penalty' },
  { slugA: 'alice', slugB: 'dan', note: 'MODERATE-LOW: secure + avoidant, some penalty' },
  { slugA: 'alice', slugB: 'henry', note: 'REDUCED: capacity discount fires on Henry' },
  { slugA: 'alice', slugB: 'isabel', note: 'REDUCED: finance misalignment only' },
  { slugA: 'alice', slugB: 'jake', note: 'EXACTLY ZERO: dealbreaker multiplier' },
  { slugA: 'clara', slugB: 'dan', note: 'LOW: severe anxious-avoidant penalty' },
  { slugA: 'dan', slugB: 'eve', note: 'LOW: avoidant homogamy penalty fires' },
  { slugA: 'frank', slugB: 'grace', note: 'LOW VALUES: opposite value profiles' },
  { slugA: 'frank', slugB: 'frank', note: 'HIGH VALUES: identical conservative profiles' },
  { slugA: 'henry', slugB: 'henry', note: 'VERY LOW: dual low capacity, both discounts' },
  { slugA: 'kim', slugB: 'dan', note: 'DEMAND-WITHDRAW: conflict style penalty fires' },
  { slugA: 'morgan', slugB: 'morgan', note: 'DUAL INSECURITY: both penalties compound' },
];

function specToMappedInputs(spec: SeedUserSpec, userId: string): MappedUserCompatibilityInputs {
  const profile = mergeProfile(spec.profile);
  return {
    userId,
    dealbreaker: {
      wantKids: profile.wantKids,
      partnerSameReligionRequired: 'No',
      religion: 'none',
      relationshipStyle: 'monogamous',
      willingToRelocate: true,
      relocationPreference: 'Yes',
      prefPartnerPoliticalAlignmentImportance: 'No',
      politics: profile.politics,
      location: { lat: 30.2672, lng: -97.7431 },
      substance: {
        alcoholFrequency: 'never',
        partnerDrinksComfort: 'yes_fine',
        cigaretteFrequency: 'never',
        partnerCigarettesComfort: 'yes_fine',
        cannabisTobaccoFrequency: 'never',
        partnerCannabisTobaccoComfort: 'yes_fine',
        recreationalDrugsFrequency: 'never',
        partnerRecreationalDrugsComfort: 'yes_fine',
      },
    },
    relationalCapacity: {
      repair: spec.pillars.repair,
      regulation: spec.pillars.regulation,
      contempt: spec.pillars.contempt,
      accountability: spec.pillars.accountability,
      mentalizing: spec.pillars.mentalizing,
      rfqScore: spec.psychometrics.rfq,
      gaspExternalizationScore: spec.psychometrics.gaspExternalization,
      scsSfScore: spec.psychometrics.scsSf,
      brsScore: spec.psychometrics.brs,
      anxietyTraitScore: spec.psychometrics.anxietyTrait,
      dweckScore: null,
    },
    attachment: spec.attachment,
    values: spec.values,
    finance: {
      financesPooled: profile.financesPooled,
      financialRiskComfort: profile.financialRiskComfort,
      yearlyIncome: profile.yearlyIncome,
    },
    lifeDomainSettings: {
      intimacy: LIFE_DOMAIN_SLIDERS.intimacy,
      finance: LIFE_DOMAIN_SLIDERS.finance,
      spirituality: LIFE_DOMAIN_SLIDERS.spirituality,
      family: LIFE_DOMAIN_SLIDERS.family,
      physicalHealth: LIFE_DOMAIN_SLIDERS.health,
    },
    interviewProcess: {
      repair: spec.pillars.repair,
      accountability: spec.pillars.accountability,
      contempt: spec.pillars.contempt,
    },
    interviewWeightedScore: spec.interviewWeightedScore,
    conflictStyle: spec.conflictStyle,
    politics: { politics: profile.politics },
    psychometricSoft: {
      npiEntitlementScore: spec.psychometrics.npiEntitlement ?? null,
      dweckScore: null,
      scsSfScore: spec.psychometrics.scsSf,
    },
    sexualCommunicationMean: null,
  };
}

async function printPairMatrix(inserted: InsertedSeedUser[]): Promise<void> {
  const bySlug = new Map(inserted.map((u) => [u.slug, u]));
  const specBySlug = new Map(SEED_USERS.map((s) => [s.slug, s]));
  console.log('\n=== Pair test matrix (v2 algorithm) ===\n');

  for (const pair of PAIR_MATRIX) {
    const userA = bySlug.get(pair.slugA);
    const userB = bySlug.get(pair.slugB);
    const specA = specBySlug.get(pair.slugA);
    const specB = specBySlug.get(pair.slugB);
    if (!userA || !userB || !specA || !specB) {
      console.log(`  [skip] ${pair.slugA} + ${pair.slugB} — user not found`);
      continue;
    }

    const result = computePairCompatibilityScore(
      specToMappedInputs(specA, userA.id),
      specToMappedInputs(specB, userB.id),
    );
    const pct = Math.round(result.finalScore * 1000) / 10;

    console.log(
      `  ${userA.label} (${userA.index}) + ${userB.label} (${userB.index}) → ${pct}% — ${pair.note}`,
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const clean = args.includes('--clean');
  const cleanOnly = clean && args.length === 1;
  const unknownArgs = args.filter((a) => a !== '--clean');
  if (unknownArgs.length > 0) {
    console.error('Usage: npx tsx --env-file=.env scripts/seedTestUsers.ts [--clean]');
    process.exit(1);
  }

  const supabase = createServiceRoleSupabase();

  if (clean) {
    const removed = await deleteSeededUsers(supabase);
    console.log(`Removed ${removed} previously seeded compat test user(s) (tag: ${SEED_TAG}).`);
  }

  if (cleanOnly) {
    return;
  }

  if (!clean) {
    await assertNoExistingSeeds(supabase);
  }

  console.log(`Seeding ${SEED_USERS.length} compat test users (tag: ${SEED_TAG})…`);
  console.log('Matching pool: excluded (interview_attempts.passed = false, users.interview_passed = false)\n');

  const inserted: InsertedSeedUser[] = [];
  for (const spec of SEED_USERS) {
    const row = await insertSeedUser(supabase, spec);
    inserted.push(row);
    console.log(`  [${spec.index}] ${spec.label} → ${row.id}`);
  }

  console.log('\n=== Seeded user IDs ===\n');
  for (const row of inserted) {
    console.log(`  ${row.index}. ${row.label}: ${row.id}`);
  }

  await printPairMatrix(inserted);

  console.log('\nScore any pair with: npm run score-pair -- <userIdA> <userIdB>');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
