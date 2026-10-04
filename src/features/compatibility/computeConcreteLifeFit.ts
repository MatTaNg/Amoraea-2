/**
 * Concrete desired-life fit from existing profile / onboarding fields.
 * Hard-blocked dimensions are omitted (the dealbreaker multiplier already zeros the pair).
 * Finance raw fields are intentionally absent — they belong only to the Finance core component.
 */

import { MAX_DISTANCE_KM } from '@config/matching/compatibilityScoring';
import { parsePartnerAlignmentImportance } from '@/shared/constants/partnerAlignmentImportance';
import type { SubstanceUseProfile } from './computeCompatibilityScore';

export type ConcreteLifeFitProfile = {
  wantKids?: string | null;
  kidsWanted?: string | null;
  kidsExisting?: string | null;
  haveKids?: string | null;
  openToAdopting?: boolean | null;
  familyKidsCount?: string | null;
  familyKidsTiming?: string | null;
  familyAdoption?: string | null;
  familyChildEducation?: string | null;
  relationshipStyle?: string | null;
  marriagePartnershipPreference?: string | null;
  religion?: string | null;
  partnerSameReligionRequired?: string | null;
  faithPracticeLevel?: string | null;
  raisingChildrenInFaith?: string | null;
  spiritualPracticeWeeklyHours?: string | null;
  politics?: string | null;
  prefPartnerPoliticalAlignmentImportance?: string | null;
  location?: { lat: number; lng: number } | null;
  willingToRelocate?: boolean | null;
  relocationPreference?: string | null;
  futureLivingLocation?: string[] | null;
  livingLocation?: string | null;
  workWeekHours?: string | null;
  hoursPerWeekQualityTime?: string | null;
  smoking?: string | null;
  drinking?: string | null;
  recreationalDrugsSocial?: string | null;
  relationshipWithPsychedelics?: string | null;
  relationshipWithCannabis?: string | null;
  substance?: SubstanceUseProfile | null;
  partnerAlignmentTobacco?: string | null;
  partnerAlignmentAlcohol?: string | null;
  partnerAlignmentRecreationalDrugs?: string | null;
  partnerAlignmentPsychedelics?: string | null;
  partnerAlignmentCannabis?: string | null;
  diet?: string | null;
  sleepSchedule?: string | null;
  petStatus?: string | null;
  hasPets?: string | null;
  partnerHasPetsPreference?: string | null;
  cleanlinessPreference?: number | null;
  sexInterestCategories?: string[] | null;
  prefPartnerSharesSexualInterests?: string | null;
  sexDrive?: string | null;
  spaceForNewRelationship?: string | null;
  sexFrequency?: string | null;
  sexFrequencyFlexible?: boolean | null;
};

/** Fields that feed concreteLifeFit. Finance keys must never appear here. */
export const CONCRETE_LIFE_FIT_INPUT_FIELDS = [
  'wantKids',
  'kidsWanted',
  'kidsExisting',
  'haveKids',
  'openToAdopting',
  'familyKidsCount',
  'familyKidsTiming',
  'familyAdoption',
  'familyChildEducation',
  'relationshipStyle',
  'marriagePartnershipPreference',
  'religion',
  'partnerSameReligionRequired',
  'faithPracticeLevel',
  'raisingChildrenInFaith',
  'spiritualPracticeWeeklyHours',
  'politics',
  'prefPartnerPoliticalAlignmentImportance',
  'location',
  'willingToRelocate',
  'relocationPreference',
  'futureLivingLocation',
  'livingLocation',
  'workWeekHours',
  'hoursPerWeekQualityTime',
  'smoking',
  'drinking',
  'recreationalDrugsSocial',
  'relationshipWithPsychedelics',
  'relationshipWithCannabis',
  'substance',
  'partnerAlignmentTobacco',
  'partnerAlignmentAlcohol',
  'partnerAlignmentRecreationalDrugs',
  'partnerAlignmentPsychedelics',
  'partnerAlignmentCannabis',
  'diet',
  'sleepSchedule',
  'petStatus',
  'hasPets',
  'partnerHasPetsPreference',
  'cleanlinessPreference',
  'sexInterestCategories',
  'prefPartnerSharesSexualInterests',
  'sexDrive',
  'spaceForNewRelationship',
  'sexFrequency',
  'sexFrequencyFlexible',
] as const;

export const CONCRETE_LIFE_FIT_EXCLUDED_FINANCE_FIELDS = [
  'financesPooled',
  'financialRiskComfort',
  'yearlyIncome',
  'financialSupportExpectation',
  'financialStructure',
  'incomeRange',
  'partnerSharesFinancialValuesImportance',
  'partnerSharesFinancialStructureImportance',
  'partnerSimilarFinancialPositionImportance',
  'debtAmount',
  'debtPayoffPlan',
] as const;

export type ConcreteLifeFitDimensionId =
  | 'children'
  | 'relationship_structure'
  | 'marriage'
  | 'religion'
  | 'politics'
  | 'location'
  | 'living_environment'
  | 'lifestyle_substances'
  | 'pets'
  | 'health_lifestyle'
  | 'work_time'
  | 'cleanliness'
  | 'intimacy_preferences';

export type ConcreteLifeFitDimensionResult = {
  id: ConcreteLifeFitDimensionId;
  score: number | null;
  skippedReason?: 'hard_filter' | 'missing';
};

export type ConcreteLifeFitResult = {
  score: number;
  dimensions: ConcreteLifeFitDimensionResult[];
  usedDimensionIds: ConcreteLifeFitDimensionId[];
  skippedHardBlockedIds: ConcreteLifeFitDimensionId[];
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function norm(v: string | null | undefined): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

function present(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.some((x) => String(x ?? '').trim() !== '');
  return true;
}

function wantsChildrenExplicitly(v: string | null | undefined): boolean {
  const s = norm(v);
  return s === 'want kids' || s === 'yes' || /^want/.test(s);
}

function doesNotWantChildrenExplicitly(v: string | null | undefined): boolean {
  const s = norm(v);
  return s === "don't want kids" || s === 'no' || /don'?t want/.test(s);
}

function isUndecidedKids(v: string | null | undefined): boolean {
  const s = norm(v);
  return s === 'undecided' || s === 'unsure' || s.includes('not sure') || s.includes('open to');
}

function normalizeRelationshipStyle(v: string | null | undefined): string {
  const s = norm(v);
  if (!s) return '';
  if (/mono/.test(s)) return 'monogamous';
  if (/poly|open|enm/.test(s)) return 'non_monogamous';
  return s;
}

function userWillingToRelocate(p: ConcreteLifeFitProfile): boolean {
  if (p.willingToRelocate === true) return true;
  return norm(p.relocationPreference) === 'yes';
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function ordinalIndex(value: string | null | undefined, ordered: readonly string[]): number | null {
  const n = norm(value);
  if (!n) return null;
  const i = ordered.findIndex((item) => norm(item) === n || n.includes(norm(item)) || norm(item).includes(n));
  return i >= 0 ? i : null;
}

function ordinalFit(a: string | null | undefined, b: string | null | undefined, ordered: readonly string[]): number | null {
  const i = ordinalIndex(a, ordered);
  const j = ordinalIndex(b, ordered);
  if (i == null || j == null) return null;
  const max = Math.max(1, ordered.length - 1);
  return 1 - Math.abs(i - j) / max;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function exactOrSkip(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!present(a) || !present(b)) return null;
  return norm(a) === norm(b) ? 1 : 0.45;
}

function flexibleMismatchScore(importanceA?: string | null, importanceB?: string | null): number {
  const parsed = [parsePartnerAlignmentImportance(importanceA), parsePartnerAlignmentImportance(importanceB)];
  if (parsed.includes('very_important')) return 0.35;
  if (parsed.includes('preference')) return 0.5;
  if (parsed.includes('doesnt_matter')) return 0.85;
  return 0.55;
}

function jaccard(a?: string[] | null, b?: string[] | null): number | null {
  const na = new Set((a ?? []).map((s) => norm(s)).filter(Boolean));
  const nb = new Set((b ?? []).map((s) => norm(s)).filter(Boolean));
  if (na.size === 0 || nb.size === 0) return null;
  let inter = 0;
  for (const x of na) if (nb.has(x)) inter += 1;
  const union = new Set([...na, ...nb]).size;
  return union === 0 ? null : inter / union;
}

const KIDS_COUNT_ORDER = ['0', '1', '2', '3', '4'] as const;
const KIDS_TIMING_ORDER = [
  'as soon as possible / within 1 year',
  'in 1–3 years',
  'in 3–5 years',
  'in 5+ years',
] as const;
const FAITH_PRACTICE_ORDER = ['never', 'occasionally', 'regularly', 'central_to_life'] as const;
const RAISING_FAITH_ORDER = [
  'not important',
  'somewhat important',
  'important',
  'very important',
  'essential, must raise children in my faith or tradition',
] as const;
const SPIRIT_HOURS_ORDER = [
  'none / not currently',
  'less than 1 hour',
  '1–3 hours',
  '4–7 hours',
  '8–15 hours',
  'more than 15 hours',
] as const;
const WORK_HOURS_ORDER = ['0_20', '21_30', '31_40', '41_50', '51_60', '60_plus'] as const;
const QUALITY_TIME_ORDER = ['0_5', '6_10', '11_15', '16_20', '21_30', '31_plus'] as const;
const SEX_DRIVE_ORDER = [
  'a few times a month',
  '1-2x a week',
  '3-5x a week',
  'daily, or almost daily',
] as const;
const SEX_FREQ_FORM_ORDER = ['rarely', 'once_week', '2_3_week', 'several_week', 'daily'] as const;
const SEX_FREQ_LIFE_ORDER = [
  'rarely / less than once a week',
  'about once a week',
  '2–3 times per week',
  '4–5 times per week',
  '6–7 times per week',
  'daily or more',
] as const;
const SPACE_ORDER = [
  "very little, i'm busy but open",
  'some, i can date slowly',
  'moderate, i can make consistent time',
  "a lot, i'm ready to prioritize a relationship",
] as const;
const SLEEP_ORDER = [
  "early riser — i'm naturally up before 7am",
  'morning person — typically up between 7–9am',
  'flexible — my schedule varies a lot',
  'night owl — i come alive in the evenings',
  'late sleeper — i naturally stay up past midnight',
] as const;

function kidsCountIndex(v: string | null | undefined): number | null {
  const s = norm(v);
  if (!s || s.includes('not sure') || s.includes('open to discussion')) return null;
  if (s.startsWith('0') || s.includes("don't want")) return 0;
  if (s === '1' || s.startsWith('1')) return 1;
  if (s === '2' || s.startsWith('2')) return 2;
  if (s === '3' || s.startsWith('3')) return 3;
  if (s.startsWith('4') || s.includes('5_plus') || s.includes('or more')) return 4;
  const i = KIDS_COUNT_ORDER.indexOf(s as (typeof KIDS_COUNT_ORDER)[number]);
  return i >= 0 ? i : null;
}

function childrenScore(
  a: ConcreteLifeFitProfile,
  b: ConcreteLifeFitProfile,
  hardFilters: readonly string[],
): number | null {
  if (hardFilters.includes('kids_want_vs_dont')) return null;
  const aWant = wantsChildrenExplicitly(a.wantKids);
  const aNo = doesNotWantChildrenExplicitly(a.wantKids);
  const bWant = wantsChildrenExplicitly(b.wantKids);
  const bNo = doesNotWantChildrenExplicitly(b.wantKids);
  const aUnd = isUndecidedKids(a.wantKids);
  const bUnd = isUndecidedKids(b.wantKids);
  if (!present(a.wantKids) && !present(b.wantKids) && !present(a.familyKidsCount) && !present(b.familyKidsCount)) {
    return null;
  }
  if ((aWant && bNo) || (aNo && bWant)) return null;

  let base: number | null = null;
  if (aWant && bWant) base = 1;
  else if (aNo && bNo) base = 1;
  else if (aUnd && bUnd) base = 0.85;
  else if ((aWant && bUnd) || (bWant && aUnd) || (aNo && bUnd) || (bNo && aUnd)) base = 0.55;
  else if (present(a.wantKids) && present(b.wantKids) && norm(a.wantKids) === norm(b.wantKids)) base = 1;

  const extras: number[] = [];
  if (aWant && bWant) {
    const ca = kidsCountIndex(a.familyKidsCount ?? a.kidsWanted);
    const cb = kidsCountIndex(b.familyKidsCount ?? b.kidsWanted);
    if (ca != null && cb != null) extras.push(1 - Math.abs(ca - cb) / 4);
    const timing = ordinalFit(a.familyKidsTiming, b.familyKidsTiming, KIDS_TIMING_ORDER);
    if (timing != null) extras.push(timing);
    if (present(a.familyAdoption) && present(b.familyAdoption)) {
      const aa = norm(a.familyAdoption);
      const bb = norm(b.familyAdoption);
      if (aa === bb) extras.push(1);
      else if (aa.includes('only want to adopt') && bb.includes('do not want to adopt')) extras.push(0.2);
      else if (bb.includes('only want to adopt') && aa.includes('do not want to adopt')) extras.push(0.2);
      else extras.push(0.7);
    } else if (a.openToAdopting != null && b.openToAdopting != null) {
      extras.push(a.openToAdopting === b.openToAdopting ? 1 : 0.65);
    }
    if (present(a.familyChildEducation) && present(b.familyChildEducation)) {
      extras.push(norm(a.familyChildEducation) === norm(b.familyChildEducation) ? 1 : 0.6);
    }
  }
  if (base == null && extras.length === 0) return null;
  if (base == null) return mean(extras);
  if (extras.length === 0) return base;
  return clamp01(base * 0.55 + (mean(extras) ?? base) * 0.45);
}

function relationshipStructureScore(
  a: ConcreteLifeFitProfile,
  b: ConcreteLifeFitProfile,
  hardFilters: readonly string[],
): number | null {
  if (hardFilters.includes('relationship_style_mismatch')) return null;
  const sa = normalizeRelationshipStyle(a.relationshipStyle);
  const sb = normalizeRelationshipStyle(b.relationshipStyle);
  if (!sa || !sb) return null;
  return sa === sb ? 1 : null;
}

function marriageScore(a: ConcreteLifeFitProfile, b: ConcreteLifeFitProfile): number | null {
  if (!present(a.marriagePartnershipPreference) || !present(b.marriagePartnershipPreference)) return null;
  const order = ['yes', 'married_not_legal', 'committed_no_marriage', 'no_commitment'] as const;
  return ordinalFit(a.marriagePartnershipPreference, b.marriagePartnershipPreference, order);
}

function religionScore(
  a: ConcreteLifeFitProfile,
  b: ConcreteLifeFitProfile,
  hardFilters: readonly string[],
): number | null {
  if (hardFilters.includes('religion_required_mismatch')) return null;
  const parts: number[] = [];
  if (present(a.religion) && present(b.religion)) {
    parts.push(
      norm(a.religion) === norm(b.religion)
        ? 1
        : flexibleMismatchScore(a.partnerSameReligionRequired, b.partnerSameReligionRequired),
    );
  }
  const faith = ordinalFit(a.faithPracticeLevel, b.faithPracticeLevel, FAITH_PRACTICE_ORDER);
  if (faith != null) parts.push(faith);
  const raise = ordinalFit(a.raisingChildrenInFaith, b.raisingChildrenInFaith, RAISING_FAITH_ORDER);
  if (raise != null) parts.push(raise);
  const hours = ordinalFit(a.spiritualPracticeWeeklyHours, b.spiritualPracticeWeeklyHours, SPIRIT_HOURS_ORDER);
  if (hours != null) parts.push(hours);
  return mean(parts);
}

function politicsScore(
  a: ConcreteLifeFitProfile,
  b: ConcreteLifeFitProfile,
  hardFilters: readonly string[],
): number | null {
  if (hardFilters.includes('politics_required_mismatch')) return null;
  if (!present(a.politics) || !present(b.politics)) return null;
  if (norm(a.politics) === norm(b.politics)) return 1;
  return flexibleMismatchScore(
    a.prefPartnerPoliticalAlignmentImportance,
    b.prefPartnerPoliticalAlignmentImportance,
  );
}

function locationScore(
  a: ConcreteLifeFitProfile,
  b: ConcreteLifeFitProfile,
  hardFilters: readonly string[],
): number | null {
  if (hardFilters.includes('distance_no_relocate')) return null;
  if (!a.location || !b.location) return null;
  const km = haversineKm(a.location, b.location);
  if (km <= MAX_DISTANCE_KM) return 1;
  const relocatable = userWillingToRelocate(a) || userWillingToRelocate(b);
  if (!relocatable) return null;
  const extra = Math.min(1, (km - MAX_DISTANCE_KM) / 2000);
  return clamp01(0.82 - extra * 0.32);
}

function livingEnvironmentScore(a: ConcreteLifeFitProfile, b: ConcreteLifeFitProfile): number | null {
  const picker = exactOrSkip(a.livingLocation, b.livingLocation);
  const ja = jaccard(a.futureLivingLocation, b.futureLivingLocation);
  const parts = [picker, ja].filter((v): v is number => v != null);
  return mean(parts);
}

function substancePairScore(
  aVal: string | null | undefined,
  bVal: string | null | undefined,
  skip: boolean,
): number | null {
  if (skip) return null;
  if (!present(aVal) || !present(bVal)) return null;
  return norm(aVal) === norm(bVal) ? 1 : 0.4;
}

function lifestyleSubstancesScore(
  a: ConcreteLifeFitProfile,
  b: ConcreteLifeFitProfile,
  hardFilters: readonly string[],
): number | null {
  const parts: number[] = [];
  const smoking = substancePairScore(
    a.smoking,
    b.smoking,
    hardFilters.includes('alignment_tobacco') || hardFilters.includes('substance_comfort_no_cigarettes'),
  );
  if (smoking != null) parts.push(smoking);
  const drinking = substancePairScore(
    a.drinking,
    b.drinking,
    hardFilters.includes('alignment_alcohol') || hardFilters.includes('substance_comfort_no_alcohol'),
  );
  if (drinking != null) parts.push(drinking);
  const cannabis = substancePairScore(
    a.relationshipWithCannabis,
    b.relationshipWithCannabis,
    hardFilters.includes('alignment_cannabis') || hardFilters.includes('substance_comfort_no_cannabis'),
  );
  if (cannabis != null) parts.push(cannabis);
  const drugs = substancePairScore(
    a.recreationalDrugsSocial,
    b.recreationalDrugsSocial,
    hardFilters.includes('alignment_recreational_drugs') ||
      hardFilters.includes('substance_comfort_no_recreational_drugs'),
  );
  if (drugs != null) parts.push(drugs);
  const psych = substancePairScore(
    a.relationshipWithPsychedelics,
    b.relationshipWithPsychedelics,
    hardFilters.includes('alignment_psychedelics'),
  );
  if (psych != null) parts.push(psych);
  return mean(parts);
}

function petsScore(a: ConcreteLifeFitProfile, b: ConcreteLifeFitProfile): number | null {
  const parts: number[] = [];
  if (present(a.petStatus) && present(b.petStatus)) {
    const aa = norm(a.petStatus);
    const bb = norm(b.petStatus);
    if (aa === bb) parts.push(1);
    else if ((aa.includes('allergic') && bb.includes('i have pets')) || (bb.includes('allergic') && aa.includes('i have pets'))) {
      parts.push(0.15);
    } else if (
      (aa.includes('prefer to keep it that way') && bb.includes('i have pets')) ||
      (bb.includes('prefer to keep it that way') && aa.includes('i have pets'))
    ) {
      parts.push(0.25);
    } else parts.push(0.65);
  }
  const prefScore = (pref: string | null | undefined, partnerHas: boolean): number | null => {
    if (!present(pref)) return null;
    const p = norm(pref);
    if (p === 'love_it') return partnerHas ? 1 : 0.7;
    if (p === 'fine') return 0.85;
    if (p === 'depends') return 0.7;
    if (p === 'prefer_not') return partnerHas ? 0.3 : 0.9;
    if (p === 'dealbreaker') return partnerHas ? 0.15 : 1;
    return 0.6;
  };
  const aHas = present(a.hasPets) && norm(a.hasPets) !== 'none';
  const bHas = present(b.hasPets) && norm(b.hasPets) !== 'none';
  const pa = prefScore(a.partnerHasPetsPreference, bHas);
  const pb = prefScore(b.partnerHasPetsPreference, aHas);
  if (pa != null) parts.push(pa);
  if (pb != null) parts.push(pb);
  return mean(parts);
}

function dietScore(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!present(a) || !present(b)) return null;
  const aa = norm(a);
  const bb = norm(b);
  if (aa === bb) return 1;
  const plant = (s: string) => s.includes('vegan') || s.includes('vegetarian') || s.includes('pescatarian') || s.includes('flexitarian');
  const meat = (s: string) => s.includes('carnivore') || s.includes('no restrictions');
  if (aa.includes('vegan') && bb.includes('carnivore')) return 0.2;
  if (bb.includes('vegan') && aa.includes('carnivore')) return 0.2;
  if (plant(aa) && plant(bb)) return 0.75;
  if (meat(aa) && meat(bb)) return 0.8;
  if ((aa.includes('kosher') || aa.includes('halal')) && aa !== bb) return 0.4;
  return 0.5;
}

function healthLifestyleScore(a: ConcreteLifeFitProfile, b: ConcreteLifeFitProfile): number | null {
  const parts: number[] = [];
  const diet = dietScore(a.diet, b.diet);
  if (diet != null) parts.push(diet);
  const sleep = ordinalFit(a.sleepSchedule, b.sleepSchedule, SLEEP_ORDER);
  if (sleep != null) parts.push(sleep);
  return mean(parts);
}

function workTimeScore(a: ConcreteLifeFitProfile, b: ConcreteLifeFitProfile): number | null {
  const parts: number[] = [];
  const work = ordinalFit(a.workWeekHours, b.workWeekHours, WORK_HOURS_ORDER);
  if (work != null) parts.push(work);
  const qt = ordinalFit(a.hoursPerWeekQualityTime, b.hoursPerWeekQualityTime, QUALITY_TIME_ORDER);
  if (qt != null) parts.push(qt);
  return mean(parts);
}

function cleanlinessScore(a: ConcreteLifeFitProfile, b: ConcreteLifeFitProfile): number | null {
  if (a.cleanlinessPreference == null || b.cleanlinessPreference == null) return null;
  return 1 - Math.abs(a.cleanlinessPreference - b.cleanlinessPreference) / 4;
}

function sexFrequencyFit(a: ConcreteLifeFitProfile, b: ConcreteLifeFitProfile): number | null {
  const form = ordinalFit(a.sexFrequency, b.sexFrequency, SEX_FREQ_FORM_ORDER);
  const life = ordinalFit(a.sexFrequency, b.sexFrequency, SEX_FREQ_LIFE_ORDER);
  let score = form ?? life;
  if (score == null) return null;
  if (a.sexFrequencyFlexible || b.sexFrequencyFlexible) score = clamp01(score + 0.1);
  return score;
}

function intimacyPreferencesScore(
  a: ConcreteLifeFitProfile,
  b: ConcreteLifeFitProfile,
  hardFilters: readonly string[],
): number | null {
  const parts: number[] = [];
  if (!hardFilters.includes('alignment_sex_interests')) {
    const interests = jaccard(a.sexInterestCategories, b.sexInterestCategories);
    if (interests != null) {
      if (norm(a.sexInterestCategories?.join('|')) === norm(b.sexInterestCategories?.join('|'))) {
        parts.push(1);
      } else {
        parts.push(
          0.35 +
            0.65 * interests,
        );
      }
    }
  }
  const drive = ordinalFit(a.sexDrive, b.sexDrive, SEX_DRIVE_ORDER);
  if (drive != null) parts.push(drive);
  const freq = sexFrequencyFit(a, b);
  if (freq != null) parts.push(freq);
  const space = ordinalFit(a.spaceForNewRelationship, b.spaceForNewRelationship, SPACE_ORDER);
  if (space != null) parts.push(space);
  return mean(parts);
}

function dim(
  id: ConcreteLifeFitDimensionId,
  score: number | null,
  hardSkip: boolean,
): ConcreteLifeFitDimensionResult {
  if (hardSkip) return { id, score: null, skippedReason: 'hard_filter' };
  if (score == null) return { id, score: null, skippedReason: 'missing' };
  return { id, score: clamp01(score) };
}

export function computeConcreteLifeFit(
  a: ConcreteLifeFitProfile,
  b: ConcreteLifeFitProfile,
  hardFilters: readonly string[] = [],
): ConcreteLifeFitResult {
  const dimensions: ConcreteLifeFitDimensionResult[] = [
    dim('children', childrenScore(a, b, hardFilters), hardFilters.includes('kids_want_vs_dont')),
    dim(
      'relationship_structure',
      relationshipStructureScore(a, b, hardFilters),
      hardFilters.includes('relationship_style_mismatch'),
    ),
    dim('marriage', marriageScore(a, b), false),
    dim('religion', religionScore(a, b, hardFilters), hardFilters.includes('religion_required_mismatch')),
    dim('politics', politicsScore(a, b, hardFilters), hardFilters.includes('politics_required_mismatch')),
    dim('location', locationScore(a, b, hardFilters), hardFilters.includes('distance_no_relocate')),
    dim('living_environment', livingEnvironmentScore(a, b), false),
    dim('lifestyle_substances', lifestyleSubstancesScore(a, b, hardFilters), false),
    dim('pets', petsScore(a, b), false),
    dim('health_lifestyle', healthLifestyleScore(a, b), false),
    dim('work_time', workTimeScore(a, b), false),
    dim('cleanliness', cleanlinessScore(a, b), false),
    dim('intimacy_preferences', intimacyPreferencesScore(a, b, hardFilters), false),
  ];

  const used = dimensions.filter((d) => d.score != null);
  const skippedHardBlockedIds = dimensions
    .filter((d) => d.skippedReason === 'hard_filter')
    .map((d) => d.id);
  const score = used.length === 0 ? 0.5 : used.reduce((s, d) => s + (d.score ?? 0), 0) / used.length;

  return {
    score: clamp01(score),
    dimensions,
    usedDimensionIds: used.map((d) => d.id),
    skippedHardBlockedIds,
  };
}
