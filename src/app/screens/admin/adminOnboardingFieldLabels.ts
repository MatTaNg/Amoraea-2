/** Human-readable labels for `profiles.profile_json` onboarding fields (admin Dating Profile tab). */

export type AdminOnboardingFieldSection = {
  title: string;
  keys: readonly string[];
};

export const ADMIN_ONBOARDING_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  displayName: 'Display name',
  dateOfBirth: 'Date of birth',
  birthDate: 'Date of birth',
  birthTime: 'Birth time',
  birthLocation: 'Birth location',
  gender: 'Gender',
  ethnicity: 'Ethnicity',
  attractedTo: 'Attracted to',
  lookingFor: 'Looking for',
  relationshipStyle: 'Relationship style',
  longestRomanticRelationship: 'Longest romantic relationship',
  location: 'Location',
  occupation: 'Occupation',
  educationLevel: 'Education level',
  height_cm: 'Height (cm)',
  heightCm: 'Height (cm)',
  weight_kg: 'Weight (kg)',
  weightKg: 'Weight (kg)',
  workout: 'Workout frequency',
  smoking: 'Smoking',
  partnerAlignmentTobacco: 'Partner alignment — tobacco',
  drinking: 'Drinking',
  partnerAlignmentAlcohol: 'Partner alignment — alcohol',
  recreationalDrugsSocial: 'Recreational drugs (social)',
  partnerAlignmentRecreationalDrugs: 'Partner alignment — recreational drugs',
  relationshipWithPsychedelics: 'Relationship with psychedelics',
  partnerAlignmentPsychedelics: 'Partner alignment — psychedelics',
  relationshipWithCannabis: 'Relationship with cannabis',
  partnerAlignmentCannabis: 'Partner alignment — cannabis',
  haveKids: 'Has children',
  wantKids: 'Wants children',
  prefPartnerHasChildren: 'Partner has children preference',
  politics: 'Politics',
  prefPartnerPoliticalAlignment: 'Partner political alignment importance',
  religion: 'Religion',
  partnerSameReligionRequired: 'Partner same religion required',
  sexDrive: 'Sex drive',
  sexInterests: 'Sexual interests',
  prefPartnerSharesSexualInterests: 'Partner shares sexual interests',
  partnerMoodMismatch: 'Partner mood mismatch response',
  sexualFocus: 'Sexual focus',
  datingPaceAfterExcitement: 'Dating pace after excitement',
  recentDatingEarlyWeeks: 'Recent dating (early weeks)',
  spaceForNewRelationship: 'Space for new relationship',
  bio: 'Bio',
  hobbies: 'Hobbies',
  archetypes: 'Archetypes',
  matchPreferences: 'Match preferences',
  attractionPreferences: 'Attraction preferences',
  prefPhysicalCompatImportance: 'Physical compatibility importance',
  availability: 'Availability',
  contactPreference: 'Contact preference',
  phoneNumber: 'Phone number',
  onboardingCompletedAt: 'Onboarding completed at',
  assessmentsStarted: 'Assessments started',
  assessmentsCompleted: 'Assessments completed',
  assessmentsCompletedAt: 'Assessments completed at',
  currentAssessment: 'Current assessment',
};

export const ADMIN_ONBOARDING_FIELD_SECTIONS: readonly AdminOnboardingFieldSection[] = [
  {
    title: 'Basics',
    keys: [
      'name',
      'displayName',
      'dateOfBirth',
      'birthDate',
      'birthTime',
      'birthLocation',
      'gender',
      'ethnicity',
      'location',
      'occupation',
      'educationLevel',
    ],
  },
  {
    title: 'Attraction & relationship style',
    keys: [
      'attractedTo',
      'lookingFor',
      'relationshipStyle',
      'longestRomanticRelationship',
      'height_cm',
      'heightCm',
      'weight_kg',
      'weightKg',
    ],
  },
  {
    title: 'Lifestyle & substances',
    keys: [
      'workout',
      'smoking',
      'partnerAlignmentTobacco',
      'drinking',
      'partnerAlignmentAlcohol',
      'recreationalDrugsSocial',
      'partnerAlignmentRecreationalDrugs',
      'relationshipWithPsychedelics',
      'partnerAlignmentPsychedelics',
      'relationshipWithCannabis',
      'partnerAlignmentCannabis',
    ],
  },
  {
    title: 'Family & kids',
    keys: ['haveKids', 'wantKids', 'prefPartnerHasChildren'],
  },
  {
    title: 'Politics & religion',
    keys: ['politics', 'prefPartnerPoliticalAlignment', 'religion', 'partnerSameReligionRequired'],
  },
  {
    title: 'Sexual compatibility',
    keys: [
      'sexDrive',
      'sexInterests',
      'prefPartnerSharesSexualInterests',
      'partnerMoodMismatch',
      'sexualFocus',
      'datingPaceAfterExcitement',
      'recentDatingEarlyWeeks',
      'spaceForNewRelationship',
      'prefPhysicalCompatImportance',
    ],
  },
  {
    title: 'Preferences & contact',
    keys: [
      'matchPreferences',
      'attractionPreferences',
      'availability',
      'contactPreference',
      'phoneNumber',
    ],
  },
  {
    title: 'About you',
    keys: ['bio', 'hobbies', 'archetypes'],
  },
  {
    title: 'Progress',
    keys: [
      'onboardingCompletedAt',
      'assessmentsStarted',
      'assessmentsCompleted',
      'assessmentsCompletedAt',
      'currentAssessment',
    ],
  },
] as const;

const OVERLAY_METADATA_KEY = 'dating_profile_overlay';

const SKIP_PROFILE_JSON_KEYS = new Set([
  'photos',
  'photo_urls',
  'photoUrls',
  'profilePhotos',
  'primary_photo_url',
  'primaryPhotoUrl',
  'avatar_url',
  'avatarUrl',
  'questionAnswers',
  'typology',
  'userLocation',
  'dealbreakers',
  'matchPreferences',
  'lifeDomains',
  'life_domains',
  'personalityDocuments',
  'personality_documents',
  'id',
  'email',
  'dating_profile_overlay',
  OVERLAY_METADATA_KEY,
]);

export function adminOnboardingFieldLabel(key: string): string {
  return (
    ADMIN_ONBOARDING_FIELD_LABELS[key] ??
    key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (m) => m.toUpperCase())
  );
}

export function formatAdminProfileFieldValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const o = item as Record<string, unknown>;
          const label = o.label ?? o.name ?? o.value ?? o.text;
          if (typeof label === 'string' && label.trim()) return label.trim();
        }
        return typeof item === 'number' || typeof item === 'boolean' ? String(item) : '';
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (typeof value === 'object') {
    try {
      const s = JSON.stringify(value, null, 2);
      return s === '{}' ? null : s;
    } catch {
      return null;
    }
  }
  return null;
}

export function collectAdminOnboardingFieldEntries(
  profileJson: Record<string, unknown>,
): { sectionTitle: string; label: string; value: string }[] {
  const used = new Set<string>();
  const out: { sectionTitle: string; label: string; value: string }[] = [];

  for (const section of ADMIN_ONBOARDING_FIELD_SECTIONS) {
    for (const key of section.keys) {
      const formatted = formatAdminProfileFieldValue(profileJson[key]);
      if (!formatted) continue;
      used.add(key);
      out.push({
        sectionTitle: section.title,
        label: adminOnboardingFieldLabel(key),
        value: formatted,
      });
    }
  }

  for (const [key, raw] of Object.entries(profileJson)) {
    if (used.has(key) || SKIP_PROFILE_JSON_KEYS.has(key)) continue;
    const formatted = formatAdminProfileFieldValue(raw);
    if (!formatted) continue;
    out.push({
      sectionTitle: 'Other profile fields',
      label: adminOnboardingFieldLabel(key),
      value: formatted,
    });
  }

  return out;
}
