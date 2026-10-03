import { validateProfilePromptsForSave } from '@/features/profile/profilePromptValidation';
import { isCompleteArchetypeSelection } from '@/shared/constants/archetypes';
import { MIN_HOBBY_SELECTIONS } from '@/shared/constants/hobbies';
import {
  getEssentialsProfileQuestions,
  isLifeDomainAnswerFilled,
  LIFE_DOMAIN_ONBOARDING_DOMAIN_ORDER,
  LIFE_DOMAIN_ONBOARDING_QUESTIONS,
  type LifeDomainId,
} from '@/shared/constants/lifeDomainOnboardingQuestions';
import { TYPOLOGY_ONBOARDING_SECTIONS } from '@/shared/constants/typologyOnboardingOptions';
import { hobbiesStringToIds } from '@/shared/utils/hobbiesHelpers';
import {
  isTypologyOnboardingFieldFilled,
  resolveEditProfileTypologyValues,
} from '@/shared/utils/typologyPickerValue';
import type { EditProfileFormSnapshotInput } from '@/screens/profile/editProfile/editProfileDraftSnapshot';
export type ProfileStrengthTab =
  | 'essentials'
  | 'lifestyle'
  | 'compatibility'
  | 'deepDive';

export type ProfileStrengthItem = {
  id: string;
  label: string;
  tab: ProfileStrengthTab;
};

export type ProfileStrengthSummary = {
  percent: number;
  completedCount: number;
  totalCount: number;
  incomplete: ProfileStrengthItem[];
};

type StrengthCheck = {
  item: ProfileStrengthItem;
  complete: boolean;
};

function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function lifeDomainStrengthItemId(domainId: LifeDomainId, questionId: string): string {
  return `lifeDomain.${domainId}.${questionId}`;
}

export function parseLifeDomainStrengthItemId(
  id: string,
): { domainId: LifeDomainId; questionId: string } | null {
  if (!id.startsWith('lifeDomain.')) return null;
  for (const domainId of LIFE_DOMAIN_ONBOARDING_DOMAIN_ORDER) {
    const prefix = `lifeDomain.${domainId}.`;
    if (id.startsWith(prefix)) {
      return { domainId, questionId: id.slice(prefix.length) };
    }
  }
  return null;
}

function buildEssentialsLifeDomainStrengthChecks(
  input: EditProfileFormSnapshotInput,
): StrengthCheck[] {
  const answers = input.lifeDomainAnswers ?? {};
  return getEssentialsProfileQuestions().map(({ domainId, question }) => ({
    item: {
      id: `essentialsLife.${domainId}.${question.id}`,
      label: question.text,
      tab: 'essentials' as const,
    },
    complete: isLifeDomainAnswerFilled(answers[domainId]?.[question.id]),
  }));
}

function buildLifeDomainQuestionStrengthChecks(
  input: EditProfileFormSnapshotInput,
): StrengthCheck[] {
  const answers = input.lifeDomainAnswers ?? {};

  return LIFE_DOMAIN_ONBOARDING_DOMAIN_ORDER.flatMap((domainId) => {
    const domainAnswers = answers[domainId] ?? {};
    return (LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId] ?? []).map((q) => ({
      item: {
        id: lifeDomainStrengthItemId(domainId, q.id),
        label: q.text,
        tab: 'deepDive' as const,
      },
      complete: isLifeDomainAnswerFilled(domainAnswers[q.id]),
    }));
  });
}

function buildTypologyStrengthChecks(
  input: EditProfileFormSnapshotInput,
): StrengthCheck[] {
  const typologyValues = resolveEditProfileTypologyValues(
    input.draft,
    input.typologyValues ?? {},
  );

  return TYPOLOGY_ONBOARDING_SECTIONS.flatMap((section) =>
    section.rows.map((row) => ({
      item: {
        id: `typology.${row.key}`,
        label: row.label,
        tab: 'deepDive' as const,
      },
      complete: isTypologyOnboardingFieldFilled(typologyValues, row.key),
    })),
  );
}
function buildCoreProfileStrengthChecks(input: EditProfileFormSnapshotInput): StrengthCheck[] {
  const d = input.draft;
  const ageRange = input.matchPrefs.ageRange as unknown;
  const ageRangeArr = Array.isArray(ageRange) ? ageRange : [];

  return [
    {
      item: { id: 'photos', label: 'At least one photo', tab: 'essentials' },
      complete: input.photoUrls.length > 0,
    },
    {
      item: { id: 'name', label: 'Name', tab: 'essentials' },
      complete: isFilled(d.displayName ?? d.name),
    },
    {
      item: { id: 'gender', label: 'Gender', tab: 'essentials' },
      complete: isFilled(d.gender),
    },
    {
      item: { id: 'ethnicity', label: 'Ethnicity', tab: 'essentials' },
      complete: isFilled(d.ethnicity),
    },
    {
      item: { id: 'attractedTo', label: 'Attracted to', tab: 'essentials' },
      complete: input.attractedUi.length > 0,
    },
    {
      item: { id: 'birthDate', label: 'Date of birth', tab: 'essentials' },
      complete: isFilled(d.birthDate),
    },
    {
      item: { id: 'relationshipStyle', label: 'Relationship style', tab: 'essentials' },
      complete: isFilled(d.relationshipStyle),
    },
    {
      item: { id: 'location', label: 'Location', tab: 'essentials' },
      complete: isFilled(d.location),
    },
    {
      item: { id: 'occupation', label: 'Occupation', tab: 'essentials' },
      complete: isFilled(d.occupation),
    },
    {
      item: { id: 'education', label: 'Education level', tab: 'essentials' },
      complete: isFilled(d.educationLevel),
    },
    {
      item: { id: 'profilePrompts', label: 'Profile prompts', tab: 'essentials' },
      complete: validateProfilePromptsForSave(input.profilePrompts, { requireSetupFloor: true }).ok,
    },
    {
      item: { id: 'archetypes', label: 'Archetypes (pick 2–3)', tab: 'essentials' },
      complete: isCompleteArchetypeSelection(input.archetypeSelection.length),
    },
    {
      item: { id: 'hobbies', label: 'Hobbies', tab: 'essentials' },
      complete: hobbiesStringToIds(String(d.hobbies ?? '')).length >= MIN_HOBBY_SELECTIONS,
    },
    {
      item: { id: 'heightWeight', label: 'Height & weight', tab: 'lifestyle' },
      complete: input.heightCmPick != null && input.weightKgPick != null,
    },
    {
      item: { id: 'workout', label: 'Workout frequency', tab: 'lifestyle' },
      complete: isFilled(d.workout),
    },
    {
      item: { id: 'smoking', label: 'Smoking & vaping', tab: 'lifestyle' },
      complete: isFilled(d.smoking),
    },
    {
      item: { id: 'drinking', label: 'Alcohol', tab: 'lifestyle' },
      complete: isFilled(d.drinking),
    },
    {
      item: { id: 'haveKids', label: 'Do you have kids?', tab: 'lifestyle' },
      complete: isFilled(d.haveKids),
    },
    {
      item: { id: 'wantKids', label: 'Do you want children?', tab: 'lifestyle' },
      complete: isFilled(d.wantKids),
    },
    {
      item: { id: 'politics', label: 'Politics', tab: 'lifestyle' },
      complete: isFilled(d.politics),
    },
    {
      item: { id: 'religion', label: 'Religion', tab: 'lifestyle' },
      complete: isFilled(d.religion),
    },
    {
      item: { id: 'longTermLiving', label: 'Long-term living preference', tab: 'lifestyle' },
      complete: isFilled(input.matchPrefs.longTermLivingPreference),
    },
    {
      item: { id: 'lifestylePreference', label: 'Lifestyle preference', tab: 'lifestyle' },
      complete: isFilled(input.matchPrefs.lifestylePreference),
    },
    {
      item: { id: 'relocation', label: 'Relocation preference', tab: 'lifestyle' },
      complete: isFilled(input.matchPrefs.relocationPreference),
    },
    {
      item: { id: 'sexDrive', label: 'Sexual compatibility', tab: 'compatibility' },
      complete: isFilled(d.sexDrive),
    },
    {
      item: {
        id: 'physicalCompat',
        label: 'Physical compatibility importance',
        tab: 'compatibility',
      },
      complete: isFilled(input.prefPhysicalCompatImportance),
    },
    {
      item: { id: 'lifeDomains', label: 'Life domain priorities (100 points)', tab: 'deepDive' },
      complete: Object.values(input.lifeDomainsState).reduce((sum, n) => sum + (n ?? 0), 0) === 100,
    },
    {
      item: { id: 'matchAgeRange', label: 'Match age range', tab: 'compatibility' },
      complete: isFilled(ageRangeArr[0]) && isFilled(ageRangeArr[1]),
    },
  ];
}

function buildProfileStrengthChecks(input: EditProfileFormSnapshotInput): StrengthCheck[] {
  return [
    ...buildCoreProfileStrengthChecks(input),
    ...buildEssentialsLifeDomainStrengthChecks(input),
    ...buildLifeDomainQuestionStrengthChecks(input),
    ...buildTypologyStrengthChecks(input),
  ];
}
/** Profile completeness for the edit-profile strength meter (0–100), derived from tracked fields. */
export function computeEditProfileStrength(
  input: EditProfileFormSnapshotInput,
): ProfileStrengthSummary {
  const checks = buildProfileStrengthChecks(input);
  const completedCount = checks.filter((c) => c.complete).length;
  const totalCount = checks.length;
  const percent =
    totalCount === 0 ? 0 : Math.min(100, Math.round((completedCount / totalCount) * 100));

  return {
    percent,
    completedCount,
    totalCount,
    incomplete: checks.filter((c) => !c.complete).map((c) => c.item),
  };
}

export function computeEditProfileStrengthPercent(
  input: EditProfileFormSnapshotInput,
): number {
  return computeEditProfileStrength(input).percent;
}
