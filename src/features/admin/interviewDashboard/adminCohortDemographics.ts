import { calculateAgeFromBirthdate } from '@/shared/utils/ageCalculator';
import { mapGenderToUi } from '@/shared/utils/genderMapper';

export type AdminCohortGenderLabel = 'Man' | 'Woman' | 'Non-binary' | 'Unknown';

export const ADMIN_COHORT_GENDER_ORDER: AdminCohortGenderLabel[] = [
  'Man',
  'Woman',
  'Non-binary',
  'Unknown',
];

export const ADMIN_COHORT_AGE_BUCKET_ORDER = [
  '18-24',
  '25-29',
  '30-34',
  '35-39',
  '40-44',
  '45-49',
  '50+',
] as const;

export type AdminCohortAgeBucket = (typeof ADMIN_COHORT_AGE_BUCKET_ORDER)[number];

export type AdminCohortDemographicRow = {
  label: string;
  count: number;
  percentage: number;
};

export type AdminCohortDemographics = {
  cohortSize: number;
  withGender: number;
  withAge: number;
  gender: AdminCohortDemographicRow[];
  ageBuckets: AdminCohortDemographicRow[];
  ageMean: number | null;
  ageMedian: number | null;
  ageMin: number | null;
  ageMax: number | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickAgeNumber(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) return Math.round(c);
    if (typeof c === 'string' && c.trim()) {
      const n = Number.parseInt(c.trim(), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function pickBirthDate(profileJson: Record<string, unknown> | null): string | null {
  if (!profileJson) return null;
  for (const key of ['birthDate', 'birth_date', 'dateOfBirth', 'date_of_birth']) {
    const v = profileJson[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Normalize gender from profile_json or users.basic_info. */
export function normalizeAdminCohortGender(raw: unknown): AdminCohortGenderLabel | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const ui = mapGenderToUi(raw.trim());
  if (ui === 'Man' || ui === 'Woman' || ui === 'Non-binary') return ui;
  return null;
}

export function resolveAdminCohortGenderFromUser(
  basicInfo: unknown,
  profileJson?: unknown,
): AdminCohortGenderLabel | null {
  const profile = asRecord(profileJson);
  const basic = asRecord(basicInfo);
  return (
    normalizeAdminCohortGender(profile?.gender) ??
    normalizeAdminCohortGender(basic?.gender) ??
    null
  );
}

export function resolveAdminCohortAgeFromUser(
  basicInfo: unknown,
  profileJson?: unknown,
): number | null {
  const profile = asRecord(profileJson);
  const basic = asRecord(basicInfo);

  const directAge =
    pickAgeNumber(profile?.age, basic?.age) ??
    null;
  if (directAge != null) return directAge;

  const birthDate = pickBirthDate(profile);
  if (birthDate) {
    const fromBirth = calculateAgeFromBirthdate(birthDate);
    if (fromBirth >= 18 && fromBirth <= 100) return fromBirth;
  }

  return null;
}

export function adminCohortAgeBucketForAge(age: number): AdminCohortAgeBucket {
  if (age < 25) return '18-24';
  if (age < 30) return '25-29';
  if (age < 35) return '30-34';
  if (age < 40) return '35-39';
  if (age < 45) return '40-44';
  if (age < 50) return '45-49';
  return '50+';
}

function roundPct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
  }
  return sorted[mid]!;
}

export function computeAdminCohortDemographics(
  users: ReadonlyArray<{ id: string; basic_info?: unknown }>,
  profileJsonByUserId?: ReadonlyMap<string, unknown>,
): AdminCohortDemographics {
  const genderCounts = new Map<AdminCohortGenderLabel, number>(
    ADMIN_COHORT_GENDER_ORDER.map((g) => [g, 0]),
  );
  const ageBucketCounts = new Map<AdminCohortAgeBucket, number>(
    ADMIN_COHORT_AGE_BUCKET_ORDER.map((b) => [b, 0]),
  );

  let withGender = 0;
  let withAge = 0;
  const ages: number[] = [];

  for (const user of users) {
    const profileJson = profileJsonByUserId?.get(user.id);
    const gender = resolveAdminCohortGenderFromUser(user.basic_info, profileJson);
    if (gender) {
      withGender += 1;
      genderCounts.set(gender, (genderCounts.get(gender) ?? 0) + 1);
    } else {
      genderCounts.set('Unknown', (genderCounts.get('Unknown') ?? 0) + 1);
    }

    const age = resolveAdminCohortAgeFromUser(user.basic_info, profileJson);
    if (age != null) {
      withAge += 1;
      ages.push(age);
      const bucket = adminCohortAgeBucketForAge(age);
      ageBucketCounts.set(bucket, (ageBucketCounts.get(bucket) ?? 0) + 1);
    }
  }

  const gender = ADMIN_COHORT_GENDER_ORDER.map((label) => {
    const count = genderCounts.get(label) ?? 0;
    return {
      label,
      count,
      percentage: roundPct(count, users.length),
    };
  }).filter((row) => row.count > 0);

  const ageBuckets = ADMIN_COHORT_AGE_BUCKET_ORDER.map((label) => {
    const count = ageBucketCounts.get(label) ?? 0;
    return {
      label,
      count,
      percentage: roundPct(count, withAge),
    };
  }).filter((row) => row.count > 0);

  const ageMean =
    ages.length > 0
      ? Math.round((ages.reduce((sum, n) => sum + n, 0) / ages.length) * 10) / 10
      : null;

  return {
    cohortSize: users.length,
    withGender,
    withAge,
    gender,
    ageBuckets,
    ageMean,
    ageMedian: median(ages),
    ageMin: ages.length > 0 ? Math.min(...ages) : null,
    ageMax: ages.length > 0 ? Math.max(...ages) : null,
  };
}
