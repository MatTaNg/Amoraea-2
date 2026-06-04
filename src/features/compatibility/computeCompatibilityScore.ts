/**
 * Deterministic pairwise compatibility subscores and final weighted score.
 * Pure functions — no I/O.
 */

export type AttachmentProfile = {
  anxiety: number;
  avoidance: number;
};

export type ValuesProfile = {
  self_direction: number;
  stimulation: number;
  hedonism: number;
  achievement: number;
  power: number;
  security: number;
  conformity: number;
  tradition: number;
  benevolence: number;
  universalism: number;
};

export type RelationalCapacityInput = {
  repair: number;
  regulation: number;
  contempt: number;
  accountability: number;
  mentalizing: number;
  rfqScore: number | null;
  gaspGuiltRepairScore: number | null;
  gaspShameWithdrawScore: number | null;
  gaspExternalizationScore: number | null;
  scsSfScore: number | null;
  brsScore: number | null;
  anxietyTraitScore: number | null;
};

export type FinanceProfile = {
  financesPooled: string | null;
  financialRiskComfort: number | null;
  yearlyIncome: string | null;
};

export type ConflictStyleProfile = {
  competing: number;
  collaborating: number;
  compromising: number;
  avoiding: number;
  accommodating: number;
};

export type DealbreakerProfile = {
  wantKids?: string | null;
  requireSameReligion?: boolean | null;
  religion?: string | null;
  relationshipStyle?: string | null;
  willingToRelocate?: boolean | null;
  requiresPoliticalAlignment?: boolean | null;
  politics?: string | null;
  location?: { lat: number; lng: number } | null;
};

export type InterviewProcessPillars = {
  repair: number;
  accountability: number;
  contempt: number;
};

export type FinalCompatibilityScoreInput = {
  attachmentScore: number;
  valuesScore: number;
  semanticScore: number;
  financeScore: number;
  interviewProcessScore: number;
  capacityA: number;
  capacityB: number;
  interviewWeightedScoreA: number;
  interviewWeightedScoreB: number;
  sexualCommAdjustment: number;
  conflictStyleAdjustment: number;
  politicsAdjustment: number;
  psychometricSoftAdjustment: number;
  dealbreakerMultiplier: number;
};

export type FinalCompatibilityBreakdown = {
  attachment: number;
  values: number;
  semantic: number;
  finance: number;
  interviewProcess: number;
  interviewWeighted: number;
  capacityDiscount: number;
  sexualCommAdjustment: number;
  conflictStyleAdjustment: number;
  politicsAdjustment: number;
  psychometricSoftAdjustment: number;
  weightedCore: number;
};

export type FinalCompatibilityScoreResult = {
  finalScore: number;
  breakdown: FinalCompatibilityBreakdown;
};

const VALUES_KEYS: (keyof ValuesProfile)[] = [
  'self_direction',
  'stimulation',
  'hedonism',
  'achievement',
  'power',
  'security',
  'conformity',
  'tradition',
  'benevolence',
  'universalism',
];

const ATTACHMENT_HIGH_THRESHOLD = 4.0;
const ATTACHMENT_SEVERE_THRESHOLD = 6.0;
const DUAL_INSECURITY_MEAN_THRESHOLD = 4.5;
const VALUES_EPSILON = 1e-6;
const MAX_VALUES_DIM_RANGE = 3.6;
const CAPACITY_DISCOUNT_MAX = 0.2;
const CAPACITY_DISCOUNT_FLOOR = 0.7;
const CAPACITY_DISCOUNT_SCALE = 0.3;

const FINAL_WEIGHTS = {
  attachment: 0.2,
  values: 0.18,
  semantic: 0.12,
  finance: 0.1,
  interviewProcess: 0.14,
  interviewWeighted: 0.08,
} as const;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function meanInsecurity(p: AttachmentProfile): number {
  return (p.anxiety + p.avoidance) / 2;
}

function isAnxiousStyle(p: AttachmentProfile): boolean {
  return p.anxiety >= ATTACHMENT_HIGH_THRESHOLD && p.avoidance < ATTACHMENT_HIGH_THRESHOLD;
}

function isAvoidantStyle(p: AttachmentProfile): boolean {
  return p.avoidance >= ATTACHMENT_HIGH_THRESHOLD && p.anxiety < ATTACHMENT_HIGH_THRESHOLD;
}

/** ECR-R anxiety/avoidance pair compatibility with anxious–avoidant and homogamy penalties. */
export function computeAttachmentScore(a: AttachmentProfile, b: AttachmentProfile): number {
  const dist = Math.hypot(a.anxiety - b.anxiety, a.avoidance - b.avoidance);
  const similarity = clamp01(1 - dist / 7.5);
  const pairSecurity = clamp01(
    1 - (meanInsecurity(a) + meanInsecurity(b)) / 14,
  );
  let score = clamp01(similarity * 0.45 + pairSecurity * 0.55);

  const anxiousAvoidantTrap =
    (isAnxiousStyle(a) && isAvoidantStyle(b)) || (isAnxiousStyle(b) && isAvoidantStyle(a));
  if (anxiousAvoidantTrap) {
    const anxiousLevel = Math.max(
      isAnxiousStyle(a) ? a.anxiety : b.anxiety,
      isAnxiousStyle(b) ? b.anxiety : a.anxiety,
    );
    const avoidantLevel = Math.max(
      isAvoidantStyle(a) ? a.avoidance : b.avoidance,
      isAvoidantStyle(b) ? b.avoidance : a.avoidance,
    );
    score -= 0.1 + 0.22 * (anxiousLevel / 7) * (avoidantLevel / 7);
  }

  if (a.avoidance >= ATTACHMENT_SEVERE_THRESHOLD && b.avoidance >= ATTACHMENT_SEVERE_THRESHOLD) {
    const homogamySeverity = (a.avoidance + b.avoidance) / 14 - ATTACHMENT_SEVERE_THRESHOLD / 7;
    score -= 0.35 + 0.25 * Math.max(0, homogamySeverity);
  }

  if (
    meanInsecurity(a) > DUAL_INSECURITY_MEAN_THRESHOLD &&
    meanInsecurity(b) > DUAL_INSECURITY_MEAN_THRESHOLD
  ) {
    const excess =
      (meanInsecurity(a) + meanInsecurity(b) - 2 * DUAL_INSECURITY_MEAN_THRESHOLD) / 5;
    score -= 0.28 + 0.2 * Math.max(0, excess);
  }

  return clamp01(score);
}

function prosocialBaseline(profile: ValuesProfile): number {
  const benevolence = profile.benevolence ?? 0;
  const universalism = profile.universalism ?? 0;
  return clamp01(0.5 + (benevolence + universalism) / 8);
}

/** Schwartz MRAT-centered value alignment with prosocial baseline boost. */
export function computeValuesScore(a: ValuesProfile, b: ValuesProfile): number {
  let sumSqDiff = 0;
  for (const key of VALUES_KEYS) {
    const diff = (a[key] ?? 0) - (b[key] ?? 0);
    sumSqDiff += diff * diff;
  }
  const rmsDiff = Math.sqrt(sumSqDiff / VALUES_KEYS.length);
  const maxRms = MAX_VALUES_DIM_RANGE;
  const alignment = clamp01(1 - rmsDiff / maxRms);

  let varianceGuard = 1;
  const meanA =
    VALUES_KEYS.reduce((s, k) => s + (a[k] ?? 0), 0) / VALUES_KEYS.length;
  const meanB =
    VALUES_KEYS.reduce((s, k) => s + (b[k] ?? 0), 0) / VALUES_KEYS.length;
  const varA = VALUES_KEYS.reduce((s, k) => s + ((a[k] ?? 0) - meanA) ** 2, 0);
  const varB = VALUES_KEYS.reduce((s, k) => s + ((b[k] ?? 0) - meanB) ** 2, 0);
  if (varA < VALUES_EPSILON && varB < VALUES_EPSILON) {
    varianceGuard = 0.92;
  }

  const prosocial = (prosocialBaseline(a) + prosocialBaseline(b)) / 2;
  const prosocialWeight = alignment < 0.55 ? 0.06 : 0.18;
  return clamp01(alignment * varianceGuard * (1 - prosocialWeight) + prosocial * prosocialWeight);
}

function normalizePillarScore(score: number, max: number): number {
  return clamp01(score / max);
}

function normalizeInvertedPillar(score: number, max: number): number {
  return clamp01(1 - score / max);
}

function defaultMid(v: number | null | undefined): number {
  return v == null || !Number.isFinite(v) ? 0.5 : clamp01(v / 7);
}

/** Single-user relational capacity from interview pillars and psychometrics. */
export function computeRelationalCapacity(user: RelationalCapacityInput): number {
  const interview =
    normalizePillarScore(user.repair, 10) * 0.22 +
    normalizePillarScore(user.regulation, 10) * 0.2 +
    normalizeInvertedPillar(user.contempt, 10) * 0.18 +
    normalizePillarScore(user.accountability, 10) * 0.18 +
    normalizePillarScore(user.mentalizing, 10) * 0.12;

  const gaspGuilt = defaultMid(user.gaspGuiltRepairScore);
  const gaspShame = user.gaspShameWithdrawScore == null ? 0.5 : clamp01(1 - user.gaspShameWithdrawScore / 7);
  const gaspExt =
    user.gaspExternalizationScore == null ? 0.5 : clamp01(1 - user.gaspExternalizationScore / 7);
  const rfq = user.rfqScore == null ? 0.5 : clamp01(user.rfqScore / 7);
  const scsSf = user.scsSfScore == null ? 0.5 : clamp01(user.scsSfScore / 5);
  const brs = user.brsScore == null ? 0.5 : clamp01(user.brsScore / 5);
  const anxietyTrait =
    user.anxietyTraitScore == null ? 0.5 : clamp01(1 - (user.anxietyTraitScore - 1) / 4);

  const psych =
    gaspGuilt * 0.15 +
    gaspShame * 0.12 +
    gaspExt * 0.12 +
    rfq * 0.18 +
    scsSf * 0.15 +
    brs * 0.13 +
    anxietyTrait * 0.15;

  return clamp01(interview * 0.58 + psych * 0.42);
}

/** Discount applied to final score when either partner has low relational capacity. */
export function computeCapacityDiscount(capacityA: number, capacityB: number): number {
  const minCap = Math.min(clamp01(capacityA), clamp01(capacityB));
  const raw = Math.max(0, (CAPACITY_DISCOUNT_FLOOR - minCap) * CAPACITY_DISCOUNT_SCALE);
  return Math.min(CAPACITY_DISCOUNT_MAX, raw);
}

function normalizeRiskComfort(v: number | null): number {
  if (v == null || !Number.isFinite(v)) return 0.5;
  return clamp01((v - 1) / 8);
}

function incomeTierScore(income: string | null): number {
  if (!income) return 0.5;
  const tiers = [
    'Under $25,000',
    '$25,000 – $49,999',
    '$50,000 – $74,999',
    '$75,000 – $99,999',
    '$100,000 – $149,999',
    '$150,000+',
  ];
  const idx = tiers.findIndex((t) => t === income);
  if (idx < 0) return 0.5;
  return idx / (tiers.length - 1);
}

/** Finance pooling, risk comfort, and income tier alignment. */
export function computeFinanceAlignment(a: FinanceProfile, b: FinanceProfile): number {
  const poolA = (a.financesPooled ?? '').toLowerCase();
  const poolB = (b.financesPooled ?? '').toLowerCase();
  const poolMatch = poolA === poolB && poolA.length > 0 ? 1 : poolA && poolB ? 0.35 : 0.5;

  const riskA = normalizeRiskComfort(a.financialRiskComfort);
  const riskB = normalizeRiskComfort(b.financialRiskComfort);
  const riskAlign = clamp01(1 - Math.abs(riskA - riskB));

  const incomeA = incomeTierScore(a.yearlyIncome);
  const incomeB = incomeTierScore(b.yearlyIncome);
  const incomeAlign = clamp01(1 - Math.abs(incomeA - incomeB));

  return clamp01(poolMatch * 0.5 + riskAlign * 0.3 + incomeAlign * 0.2);
}

function kidsWantMismatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const yes = /^(yes|want)/i.test(a);
  const no = /don'?t want|no kids/i.test(a);
  const yesB = /^(yes|want)/i.test(b);
  const noB = /don'?t want|no kids/i.test(b);
  return (yes && noB) || (no && yesB);
}

function religionMismatch(a: DealbreakerProfile, b: DealbreakerProfile): boolean {
  const reqA = a.requireSameReligion === true;
  const reqB = b.requireSameReligion === true;
  if (!reqA && !reqB) return false;
  const relA = (a.religion ?? '').trim().toLowerCase();
  const relB = (b.religion ?? '').trim().toLowerCase();
  if (!relA || !relB) return false;
  return relA !== relB;
}

function politicsMismatch(a: DealbreakerProfile, b: DealbreakerProfile): boolean {
  const reqA = a.requiresPoliticalAlignment === true;
  const reqB = b.requiresPoliticalAlignment === true;
  if (!reqA && !reqB) return false;
  const polA = (a.politics ?? '').trim().toLowerCase();
  const polB = (b.politics ?? '').trim().toLowerCase();
  if (!polA || !polB) return false;
  const incompatible =
    (polA === 'liberal' && polB === 'conservative') ||
    (polA === 'conservative' && polB === 'liberal');
  return incompatible;
}

/** Hard dealbreaker multiplier: 0 blocks the pair, 1 allows full score. */
export function computeDealbreakerMultiplier(a: DealbreakerProfile, b: DealbreakerProfile): number {
  if (kidsWantMismatch(a.wantKids, b.wantKids)) return 0;
  if (religionMismatch(a, b)) return 0;
  if (politicsMismatch(a, b)) return 0;
  return 1;
}

function dominantStyle(style: ConflictStyleProfile): keyof ConflictStyleProfile {
  const entries = Object.entries(style) as [keyof ConflictStyleProfile, number][];
  entries.sort((x, y) => y[1] - x[1]);
  return entries[0]?.[0] ?? 'collaborating';
}

/** CONFLICT-30 style soft adjustment (−0.08 … +0.03) from dominant styles and demand–withdraw. */
export function computeConflictStyleAdjustment(
  a: ConflictStyleProfile,
  b: ConflictStyleProfile,
  _conflictInstrumentMax = 100,
): number {
  const domA = dominantStyle(a);
  const domB = dominantStyle(b);

  if (domA === 'collaborating' && domB === 'collaborating') {
    const collabAvg = (a.collaborating + b.collaborating) / 200;
    return Math.min(0.03, 0.02 + collabAvg * 0.01);
  }

  const demandWithdraw =
    (domA === 'competing' && domB === 'avoiding') || (domA === 'avoiding' && domB === 'competing');
  if (demandWithdraw) {
    return -0.08;
  }

  if (domA === 'avoiding' && domB === 'avoiding') {
    return -0.04;
  }

  if (domA === 'competing' && domB === 'competing') {
    return -0.03;
  }

  return 0;
}

function normalizeInterviewWeighted(score: number): number {
  return clamp01((score - 5) / 4);
}

/** Interview pillar alignment (repair, accountability, low contempt). */
export function computeInterviewProcessScore(
  a: InterviewProcessPillars,
  b: InterviewProcessPillars,
): number {
  const repairAlign = clamp01(1 - Math.abs(a.repair - b.repair) / 10);
  const accountabilityAlign = clamp01(1 - Math.abs(a.accountability - b.accountability) / 10);
  const contemptAlign = clamp01(1 - Math.abs(a.contempt - b.contempt) / 10);
  const avgContempt = (a.contempt + b.contempt) / 2;
  const contemptQuality = clamp01(1 - avgContempt / 10);
  return clamp01(
    repairAlign * 0.35 + accountabilityAlign * 0.35 + contemptAlign * 0.15 + contemptQuality * 0.15,
  );
}

/** Weighted final compatibility with capacity discount and dealbreaker gate. */
export function computeFinalCompatibilityScore(
  input: FinalCompatibilityScoreInput,
): FinalCompatibilityScoreResult {
  const capacityDiscount = computeCapacityDiscount(input.capacityA, input.capacityB);
  const interviewWeighted =
    (normalizeInterviewWeighted(input.interviewWeightedScoreA) +
      normalizeInterviewWeighted(input.interviewWeightedScoreB)) /
    2;

  const attachmentComponent = input.attachmentScore * FINAL_WEIGHTS.attachment;
  const valuesComponent = input.valuesScore * FINAL_WEIGHTS.values;
  const semanticComponent = input.semanticScore * FINAL_WEIGHTS.semantic;
  const financeComponent = input.financeScore * FINAL_WEIGHTS.finance;
  const interviewProcessComponent = input.interviewProcessScore * FINAL_WEIGHTS.interviewProcess;
  const interviewWeightedComponent = interviewWeighted * FINAL_WEIGHTS.interviewWeighted;

  const weightedCore =
    attachmentComponent +
    valuesComponent +
    semanticComponent +
    financeComponent +
    interviewProcessComponent +
    interviewWeightedComponent;

  const softSum =
    input.sexualCommAdjustment +
    input.conflictStyleAdjustment +
    input.politicsAdjustment +
    input.psychometricSoftAdjustment;

  const preMultiplier = clamp01(weightedCore + softSum - capacityDiscount);
  const finalScore = clamp01(preMultiplier * clamp01(input.dealbreakerMultiplier));

  return {
    finalScore,
    breakdown: {
      attachment: attachmentComponent,
      values: valuesComponent,
      semantic: semanticComponent,
      finance: financeComponent,
      interviewProcess: interviewProcessComponent,
      interviewWeighted: interviewWeightedComponent,
      capacityDiscount,
      sexualCommAdjustment: input.sexualCommAdjustment,
      conflictStyleAdjustment: input.conflictStyleAdjustment,
      politicsAdjustment: input.politicsAdjustment,
      psychometricSoftAdjustment: input.psychometricSoftAdjustment,
      weightedCore,
    },
  };
}
