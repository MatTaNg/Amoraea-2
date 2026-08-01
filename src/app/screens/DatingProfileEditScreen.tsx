import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NavigationAction } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { profilesRepo } from '@data/repos/profilesRepo';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { exitDatingProfileOnboardingToPostInterview } from '@/datingProfile/onboarding/exitDatingProfileOnboardingToPostInterview';
import { showSimpleAlert } from '@utilities/alerts/confirmDialog';
import {
  HeightWeightInputFields,
} from '@/shared/components/HeightWeightInputFields';
import {
  parseStoredHeightCm,
  parseStoredWeightKg,
} from '@/shared/utils/unitConversions';
import {
  LifeDomainDistribution,
  DEFAULT_ONBOARDING_LIFE_DOMAINS,
  ONBOARDING_LIFE_DOMAIN_KEYS,
  type LifeDomainAnswerCount,
  type OnboardingLifeDomainKey,
  type OnboardingLifeDomainValues,
} from '@/shared/components/LifeDomainDistribution';
import { countAnsweredInDomain } from '@/shared/constants/lifeDomainOnboardingQuestions';
import {
  RECENT_DATING_EARLY_WEEKS_OPTIONS,
  RECENT_DATING_EARLY_WEEKS_QUESTION,
  PARTNER_MOOD_MISMATCH_RESPONSE_OPTIONS,
  SPACE_FOR_NEW_RELATIONSHIP_OPTIONS,
  SEXUAL_FOCUS_OPTIONS,
  SEX_DRIVE_OPTIONS,
  SEX_INTEREST_CATEGORY_OPTIONS,
} from '@/shared/constants/sexualCompatibilityOptions';
import {
  workoutOptions,
  smokingOptions,
  drinkingOptions,
  recreationalDrugsSocialOptions,
  psychedelicsRelationshipOptions,
  cannabisRelationshipOptions,
  politicsOptions,
  religionOptions,
  haveKidsOptions,
  wantChildrenYesNoOptions,
} from '@/shared/constants/filterOptions';
import { LONGEST_ROMANTIC_RELATIONSHIP_OPTIONS } from '@/shared/constants/longestRomanticRelationshipOptions';
import {
  EDUCATION_LEVEL_CHOICES,
  ETHNICITY_CHOICES,
  RELATIONSHIP_STYLE_CHOICES,
} from '@/screens/profile/editProfile/aboutYouOptions';
import {
  buildHeightWeightProfileFields,
  mapRelationshipStyleToUi,
  mapRelationshipStyleUiToDb,
  mapRelationshipStyleUiToRelationshipType,
} from '@/screens/profile/editProfile/editProfileService';
import {
  PREF_LONG_TERM_LOCATION_OPTIONS,
  PREF_LIFESTYLE_OPTIONS,
  PREF_RELOCATION_OPTIONS,
} from '@/screens/profile/editProfile/constants';
import { MatchPreferencesEmbedded } from '@/shared/components/profileFields/MatchPreferencesEmbedded';
import type { AssessmentId } from '@/data/services/assessmentService';
import { AssessmentInsightResultsPanel } from '@/shared/components/assessments/AssessmentInsightResultsPanel';
import { ConflictStyleResultsPanel } from '@/shared/components/assessments/ConflictStyleResultsPanel';
import {
  TypologyPickerFields,
  type TypologyPickerValue,
} from '@/shared/components/profileFields/TypologyPickerFields';
import { TYPOLOGY_ONBOARDING_SECTIONS } from '@/shared/constants/typologyOnboardingOptions';
import { MatchPreferences } from '@/shared/hooks/filterPreferences/types';
import { mapGenderToDb, mapGenderToUi } from '@/shared/utils/genderMapper';
import {
  mapAttractionToDb,
  normalizeAttractedToUiLabels,
} from '@/shared/utils/attractionMapper';
import { calculateAgeFromBirthdate, MIN_USER_AGE } from '@/shared/utils/ageCalculator';
import { useLocationAutocomplete } from '@/shared/hooks/useLocationAutocomplete';
import { requestMyLocationLabel } from '@/screens/profile/utils/locationHelpers';
import { theme } from '@/shared/theme/theme';
import { DatePicker } from '@/shared/components/DatePicker';
import {
  BirthTimeQuarterHourPicker,
  isValidOptionalBirthTime24h,
} from '@/shared/components/BirthTimeQuarterHourPicker';
import { OnboardingHeader } from '@ui/components/OnboardingHeader';
import {
  FormField,
  FormTextInput,
  formControlStyles,
} from '@/shared/ui/FormField';
import {
  BottomSheet,
  OptionPickerTrigger,
  type OptionAnchor,
} from '@/screens/profile/editProfile/BottomSheet';
import { SelectTriggerRow } from '@/shared/ui/SelectTriggerRow';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { ArchetypeSelector } from '@/shared/components/profileFields/ArchetypeSelector';
import { HobbiesFields } from '@/shared/components/profileFields/HobbiesFields';
import { ProfilePromptsFields } from '@/shared/components/profileFields/ProfilePromptsFields';
import {
  loadEditProfileSnapshot,
  saveEditProfilePrompts,
} from '@/data/repos/editProfileRepo';
import { validateProfilePromptsForSave } from '@/features/profile/profilePromptValidation';
import type { ProfilePromptAnswer } from '@domain/models/Profile';
import { normalizePhotoFileNameKey } from '@/shared/components/ModeratedPhotoUpload';
import {
  normalizeArchetypesFromProfile,
  isCompleteArchetypeSelection,
  MAX_PROFILE_ARCHETYPES,
  MIN_PROFILE_ARCHETYPES,
  type ArchetypeId,
} from '@/shared/constants/archetypes';
import type { LifeDomainId } from '@/shared/constants/lifeDomainOnboardingQuestions';
import {
  onboardingLifeDomainKeyToId,
  saveLifeDomainAnswersFromOnboarding,
  syncLifeDomainImportanceFromOnboarding,
  type LifeDomainAnswersMap,
} from '@/screens/profile/editProfile/lifeDomainProfileService';
import {
  patchEditProfileQueryCache,
  useEditProfileBlobQuery,
  useEditProfileLifeDomainAnswersQuery,
  useEditProfileLifeDomainSlidersQuery,
  useEditProfileMatchPrefsQuery,
} from '@/screens/profile/editProfile/editProfileQueries';
import { LifeDomainQuestionsEditModal } from '@/screens/profile/editProfile/LifeDomainQuestionsEditModal';
import { LifeDomainRequiredQuestionsSection } from '@/screens/profile/editProfile/LifeDomainRequiredQuestionsSection';
import {
  jsonSnapshotEqual,
  photoUrlsNeedUpload,
  resolvePhotoUrlsForSave,
} from '@/screens/profile/editProfile/editProfileSaveHelpers';
import { EditProfileUnsavedChangesModal } from '@/screens/profile/editProfile/EditProfileUnsavedChangesModal';
import {
  buildEditProfileFormSnapshot,
  editProfileFormSnapshotsEqual,
  patchEditProfileFormSnapshotLocation,
  type EditProfileFormSnapshot,
  type EditProfileFormSnapshotInput,
} from '@/screens/profile/editProfile/editProfileDraftSnapshot';

const BG = '#0a0a0f';
const MIN_PROFILE_AGE = MIN_USER_AGE;
const ACCENT = '#3b82f6';
const FONT_BODY =
  Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

const GENDER_UI_OPTIONS = ['Man', 'Woman', 'Non-binary'] as const;

const ATTRACTION_UI = ['Men', 'Women', 'Non-binary'] as const;

const EDIT_PROFILE_TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'compatibility', label: 'Compatibility' },
  { id: 'dealbreakers', label: 'Dealbreakers' },
] as const;

const TYPOLOGY_RESULT_TABS: { id: AssessmentId; label: string }[] = [
  { id: 'ECR-36', label: 'Attachment' },
  { id: 'CONFLICT-30', label: 'Conflict' },
  { id: 'PVQ-21', label: 'Schwartz values' },
  { id: 'SEXUAL_COMMUNICATION', label: 'Sexual communication' },
];

type EditProfileTabId = (typeof EDIT_PROFILE_TABS)[number]['id'];

const TYPOLOGY_KEYS = TYPOLOGY_ONBOARDING_SECTIONS.flatMap((s) =>
  s.rows.map((r) => r.key),
);

const STRIP_FROM_SAVE = [
  'diet',
  'sleepSchedule',
  'sleep_schedule',
  'phoneNumber',
  'phone_number',
  'contactPreference',
  'contact_preference',
  'bio',
  'cannabis',
  'yearlyIncome',
  'yearly_income',
  'yearlyIncomeCurrency',
  'income_currency',
] as const;

function asStr(v: unknown): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function omitUndefined<T extends Record<string, unknown>>(
  o: T,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;
}

function toTitleCaseUi(s: string): string {
  return s.replace(/[A-Za-z]+|[^A-Za-z]+/g, (seg) =>
    /^[A-Za-z]+$/.test(seg)
      ? seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()
      : seg,
  );
}

function normalizePhotoUriForDisplay(s: string): string {
  const t = s.trim();
  if (!t) return '';
  if (t.startsWith('//')) return `https:${t}`;
  return t;
}

function isRenderablePhotoUri(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return (
    /^https?:\/\//i.test(t) ||
    t.startsWith('//') ||
    t.startsWith('file:') ||
    t.startsWith('blob:') ||
    t.startsWith('content:') ||
    t.startsWith('ph://') ||
    t.startsWith('assets-library:')
  );
}

function extractPhotoUrlsFromUnknown(raw: unknown, depth = 0): string[] {
  if (raw == null || depth > 5) return [];
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    const looksJson =
      (t.startsWith('[') && t.endsWith(']')) ||
      (t.startsWith('{') && t.endsWith('}'));
    if (looksJson) {
      try {
        return extractPhotoUrlsFromUnknown(JSON.parse(t), depth + 1);
      } catch {
        return isRenderablePhotoUri(t) ? [t] : [];
      }
    }
    return isRenderablePhotoUri(t) ? [t] : [];
  }
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const s = item.trim();
      if (s && isRenderablePhotoUri(s)) out.push(s);
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const cand = [o.url, o.uri, o.publicUrl, o.public_url, o.src].find(
        (x): x is string => typeof x === 'string' && x.trim() !== '',
      );
      if (cand && isRenderablePhotoUri(cand.trim())) out.push(cand.trim());
    }
  }
  return out;
}

/** Read `photos` from merged profile (`photos`, snake_case aliases, `{ url }` rows, JSON strings) + optional primary/avatar. */
function resolvePhotoUrlsFromProfile(pb: Record<string, unknown>): string[] {
  const keys = ['photos', 'photo_urls', 'photoUrls', 'profilePhotos'] as const;
  let urls: string[] = [];
  for (const k of keys) {
    urls = extractPhotoUrlsFromUnknown(pb[k]);
    if (urls.length) break;
  }

  const primaryPick = [
    pb.primary_photo_url,
    pb.primaryPhotoUrl,
    pb.avatar_url,
    pb.avatarUrl,
  ].find((x): x is string => typeof x === 'string' && isRenderablePhotoUri(x));
  if (primaryPick) {
    const p = primaryPick.trim();
    if (!urls.some((u) => u.trim() === p)) urls = [p, ...urls];
  }

  const seen = new Set<string>();
  return urls
    .map((u) => normalizePhotoUriForDisplay(u.trim()))
    .filter((u) => {
      if (!u || seen.has(u)) return false;
      seen.add(u);
      return true;
    })
    .slice(0, 12);
}

function profileToTypology(p: Record<string, unknown>): TypologyPickerValue {
  const qa = (p.questionAnswers as Record<string, unknown>) || {};
  const out: TypologyPickerValue = {};
  for (const key of TYPOLOGY_KEYS) {
    const v = qa[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  return out;
}

function buildEditProfileBaselineInputFromProfile(
  pb: Record<string, unknown>,
  resolvedPhotos: string[],
): EditProfileFormSnapshotInput {
  const rawSex = pb.sexInterestCategories;
  const savedBirthLoc = asStr(pb.birthLocation);
  const profileArchetypes = normalizeArchetypesFromProfile(pb.archetypes);
  return {
    draft: { ...pb, photos: resolvedPhotos },
    photoUrls: resolvedPhotos,
    attractedUi: normalizeAttractedToUiLabels(
      (pb.attractedTo as string[] | undefined) ??
        (pb.lookingFor as string[] | undefined),
    ),
    sexInterestSelected: Array.isArray(rawSex)
      ? rawSex.map((x) => String(x))
      : [],
    lifeDomainsState: { ...DEFAULT_ONBOARDING_LIFE_DOMAINS },
    weightKgPick: parseStoredWeightKg(pb),
    heightCmPick: parseStoredHeightCm(pb),
    typologyValues: profileToTypology(pb),
    matchPrefs: {},
    prefPhysicalCompatImportance: asStr(pb.prefPhysicalCompatImportance),
    prefPartnerSharesSexualInterests: asStr(pb.prefPartnerSharesSexualInterests),
    prefPartnerHasChildren: asStr(pb.prefPartnerHasChildren),
    prefPartnerPoliticalAlignmentImportance: asStr(
      pb.prefPartnerPoliticalAlignmentImportance,
    ),
    archetypeSelection: profileArchetypes,
    lifeDomainAnswers: {},
    validatedBirthLocation: savedBirthLoc ? savedBirthLoc : undefined,
    profilePrompts: [],
  };
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad' | 'numeric';
}) {
  return (
    <FormTextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      keyboardType={keyboardType ?? 'default'}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

function ChoiceDropdown({
  label,
  value,
  options,
  onValueChange,
  allowUnset,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onValueChange: (v: string) => void;
  /** When true, empty value is valid; no auto-coercion to first option; web sheet lists only `options`. */
  allowUnset?: boolean;
}) {
  const [sheetAnchor, setSheetAnchor] = useState<OptionAnchor | null>(null);
  const unsetOk = Boolean(allowUnset) && value === '';
  const validSelection =
    unsetOk || options.some((o) => o.value === value);
  const selectedValue = validSelection ? value : (options[0]?.value ?? '');
  const selectedLabel =
    unsetOk
      ? 'Choose…'
      : options.find((o) => o.value === selectedValue)?.label ?? 'Choose…';

  useLayoutEffect(() => {
    if (!options.length) return;
    if (allowUnset) return;
    if (!validSelection && options[0]) {
      onValueChange(options[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- coerce empty/unknown DB values once options exist; avoid churn from unstable callbacks
  }, [value, options, validSelection, allowUnset]);

  if (!options.length) return null;

  return (
    <FormField label={label}>
      <OptionPickerTrigger
        style={[formControlStyles.control, formControlStyles.controlSelectLike]}
        onOpen={(anchor) => setSheetAnchor(anchor)}
      >
        <SelectTriggerRow
          label={selectedLabel}
          isPlaceholder={unsetOk}
          labelStyle={formControlStyles.valueText}
          placeholderStyle={formControlStyles.placeholderText}
          chevronStyle={styles.dropdownChevron}
        />
      </OptionPickerTrigger>
      <BottomSheet
        visible={!!sheetAnchor}
        title={label}
        anchor={sheetAnchor}
        onClose={() => setSheetAnchor(null)}
      >
        <SingleChoiceOptionList
          options={options}
          value={selectedValue}
          onSelect={(v) => {
            onValueChange(String(v));
            setSheetAnchor(null);
          }}
        />
      </BottomSheet>
    </FormField>
  );
}

export const DatingProfileEditScreen: React.FC<{
  navigation: { goBack: () => void };
  route: { params: { userId: string } };
}> = ({ route }) => {
  const userId = route.params?.userId ?? '';
  const navigation =
    useNavigation<
      NativeStackNavigationProp<Record<string, object | undefined>>
    >();
  const { user } = useAuth();
  const effectiveUserId = user?.id ?? userId;

  const allowExitWithoutPromptRef = useRef(false);
  const pendingNavigationActionRef = useRef<NavigationAction | null>(null);
  const serverBaselineRef = useRef<EditProfileFormSnapshotInput | null>(null);
  const baselineCommittedRef = useRef(false);
  const pendingEditBeforeBaselineRef = useRef(false);
  const handleBackPressRef = useRef<() => void>(() => {});
  const hasUnsavedChangesRef = useRef(false);
  const completePendingExitRef = useRef<() => void>(() => {});
  const handleUnsavedPromptSaveRef = useRef<() => void>(() => {});

  const exitEditProfileToPostInterview = useCallback(() => {
    allowExitWithoutPromptRef.current = true;
    exitDatingProfileOnboardingToPostInterview(navigation, userId.trim() || undefined);
  }, [navigation, userId]);

  const [savedSnapshot, setSavedSnapshot] = useState<EditProfileFormSnapshot | null>(
    null,
  );
  const [baselineReady, setBaselineReady] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [unsavedPromptVisible, setUnsavedPromptVisible] = useState(false);
  const [unsavedPromptSaving, setUnsavedPromptSaving] = useState(false);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  /** Avoid replacing the whole form from `profileBlob` on every refetch — that wipes unsaved edits (e.g. typing birth location). */
  const draftHydratedForUserIdRef = useRef<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const existingPhotoAssetIdsRef = useRef<Set<string>>(new Set());
  const photoAssetIdByUrlRef = useRef<Map<string, string>>(new Map());
  const existingPhotoFileNameKeysRef = useRef<Set<string>>(new Set());
  const photoFileNameKeyByUrlRef = useRef<Map<string, string>>(new Map());
  const [attractedUi, setAttractedUi] = useState<string[]>([]);
  const [sexInterestSelected, setSexInterestSelected] = useState<string[]>([]);
  const [lifeDomainsState, setLifeDomainsState] =
    useState<OnboardingLifeDomainValues>({
      ...DEFAULT_ONBOARDING_LIFE_DOMAINS,
    });
  const [weightKgPick, setWeightKgPick] = useState<number | undefined>(
    undefined,
  );
  const [heightCmPick, setHeightCmPick] = useState<number | undefined>(
    undefined,
  );
  const [locationLoading, setLocationLoading] = useState(false);
  const [typologyValues, setTypologyValues] = useState<TypologyPickerValue>({});
  const [matchPrefs, setMatchPrefs] = useState<MatchPreferences>({});
  const [prefPhysicalCompatImportance, setPrefPhysicalCompatImportance] =
    useState('');
  const [
    prefPartnerSharesSexualInterests,
    setPrefPartnerSharesSexualInterests,
  ] = useState('');
  const [prefPartnerHasChildren, setPrefPartnerHasChildren] = useState('');
  const [
    prefPartnerPoliticalAlignmentImportance,
    setPrefPartnerPoliticalAlignmentImportance,
  ] = useState('');
  const [activeTab, setActiveTab] = useState<EditProfileTabId>('basics');
  const [typologyResultId, setTypologyResultId] = useState<AssessmentId | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [birthLocationSuggestions, setBirthLocationSuggestions] = useState<
    Array<{ label: string }>
  >([]);
  const [validatedBirthLocation, setValidatedBirthLocation] = useState<
    string | undefined
  >(undefined);
  const [archetypeSelection, setArchetypeSelection] = useState<ArchetypeId[]>([]);
  const [profilePrompts, setProfilePrompts] = useState<ProfilePromptAnswer[]>([]);
  const [lifeDomainAnswers, setLifeDomainAnswers] = useState<LifeDomainAnswersMap>({});
  const [lifeDomainQuestionsDomainId, setLifeDomainQuestionsDomainId] =
    useState<LifeDomainId | null>(null);

  const { data: profileBlob } = useEditProfileBlobQuery(userId);
  const { data: hydratedLifeDomainSliders } = useEditProfileLifeDomainSlidersQuery(
    userId,
    profileBlob,
  );
  const { data: hydratedMatchPrefs } = useEditProfileMatchPrefsQuery(userId, profileBlob);
  const { data: hydratedLifeDomainAnswers } = useEditProfileLifeDomainAnswersQuery(userId);
  const { data: interviewEditSnapshot } = useQuery({
    queryKey: ['editProfileInterviewFields', userId],
    queryFn: () => loadEditProfileSnapshot(userId),
    enabled: Boolean(userId),
  });

  const clearFormDirty = useCallback(() => {
    pendingEditBeforeBaselineRef.current = false;
    setFormDirty(false);
  }, []);

  const markFormDirty = useCallback(() => {
    if (baselineCommittedRef.current) {
      setFormDirty(true);
      return;
    }
    pendingEditBeforeBaselineRef.current = true;
  }, []);

  useLayoutEffect(() => {
    if (!userId) {
      draftHydratedForUserIdRef.current = null;
      serverBaselineRef.current = null;
      baselineCommittedRef.current = false;
      setSavedSnapshot(null);
      setBaselineReady(false);
      clearFormDirty();
      return;
    }
    if (!profileBlob || hydratedLifeDomainSliders == null || hydratedMatchPrefs == null) {
      return;
    }
    if (hydratedLifeDomainAnswers == null) {
      return;
    }
    if (!interviewEditSnapshot) {
      return;
    }
    if (draftHydratedForUserIdRef.current === userId) {
      return;
    }
    draftHydratedForUserIdRef.current = userId;
    serverBaselineRef.current = null;
    baselineCommittedRef.current = false;
    setSavedSnapshot(null);
    setBaselineReady(false);
    clearFormDirty();

    const pb = profileBlob as Record<string, unknown>;
    const resolvedPhotos = resolvePhotoUrlsFromProfile(pb);
    serverBaselineRef.current = {
      ...buildEditProfileBaselineInputFromProfile(pb, resolvedPhotos),
      lifeDomainsState: hydratedLifeDomainSliders,
      matchPrefs: hydratedMatchPrefs,
      lifeDomainAnswers: hydratedLifeDomainAnswers,
      profilePrompts: interviewEditSnapshot.prompts,
    };
    setPhotoUrls(resolvedPhotos);
    setDraft({ ...pb, photos: resolvedPhotos });
    setAttractedUi(
      normalizeAttractedToUiLabels(
        (pb.attractedTo as string[] | undefined) ??
          (pb.lookingFor as string[] | undefined),
      ),
    );
    const rawSex = pb.sexInterestCategories;
    setSexInterestSelected(
      Array.isArray(rawSex) ? rawSex.map((x) => String(x)) : [],
    );
    setWeightKgPick(parseStoredWeightKg(pb));
    const hcResolved = parseStoredHeightCm(pb);
    setHeightCmPick(hcResolved);
    setTypologyValues(profileToTypology(pb));
    setPrefPhysicalCompatImportance(asStr(pb.prefPhysicalCompatImportance));
    setPrefPartnerSharesSexualInterests(
      asStr(pb.prefPartnerSharesSexualInterests),
    );
    setPrefPartnerHasChildren(asStr(pb.prefPartnerHasChildren));
    setPrefPartnerPoliticalAlignmentImportance(
      asStr(pb.prefPartnerPoliticalAlignmentImportance),
    );
    const savedBirthLoc = asStr(pb.birthLocation);
    setValidatedBirthLocation(savedBirthLoc ? savedBirthLoc : undefined);
    const profileArchetypes = normalizeArchetypesFromProfile(pb.archetypes);
    setArchetypeSelection(profileArchetypes);
    setBirthLocationSuggestions([]);
    setLifeDomainsState(hydratedLifeDomainSliders);
    setMatchPrefs(hydratedMatchPrefs);
    setLifeDomainAnswers(hydratedLifeDomainAnswers);
    setProfilePrompts(interviewEditSnapshot.prompts);

    baselineCommittedRef.current = true;
    setSavedSnapshot(
      buildEditProfileFormSnapshot(serverBaselineRef.current),
    );
    setBaselineReady(true);
    if (pendingEditBeforeBaselineRef.current) {
      pendingEditBeforeBaselineRef.current = false;
      setFormDirty(true);
    }
  }, [
    clearFormDirty,
    hydratedLifeDomainAnswers,
    hydratedLifeDomainSliders,
    hydratedMatchPrefs,
    profileBlob,
    interviewEditSnapshot,
    userId,
  ]);

  const selectProfileTab = useCallback((id: EditProfileTabId) => {
    setTypologyResultId(null);
    setActiveTab(id);
  }, []);

  const toggleTypologyResult = useCallback((id: AssessmentId) => {
    setTypologyResultId((prev) => (prev === id ? null : id));
  }, []);

  const onBirthLocationSuggestionsChange = useCallback(
    (suggestions: Array<{ label: string }>) => {
      setBirthLocationSuggestions(suggestions);
    },
    [],
  );

  const { isSearchingPlaces: birthLocationPlacesLoading } = useLocationAutocomplete({
    value: asStr(draft.birthLocation),
    validatedValue: validatedBirthLocation,
    onSuggestionsChange: onBirthLocationSuggestionsChange,
    minLength: 3,
  });

  const genderUiValue = mapGenderToUi(asStr(draft.gender)) ?? '';

  const relationshipStyleUi = mapRelationshipStyleToUi(
    asStr(draft.relationshipStyle),
  );

  const userAge = useMemo(
    () => calculateAgeFromBirthdate(asStr(draft.birthDate)),
    [draft.birthDate],
  );

  const birthDateStr = asStr(draft.birthDate);
  const birthAgeFromDraft = birthDateStr
    ? calculateAgeFromBirthdate(birthDateStr)
    : null;
  const birthDateError =
    birthAgeFromDraft != null && birthAgeFromDraft < MIN_PROFILE_AGE
      ? 'You must be 18 or older to use this app.'
      : undefined;

  const lifeDomainsTotal = useMemo(
    () =>
      ONBOARDING_LIFE_DOMAIN_KEYS.reduce(
        (sum, key) => sum + (lifeDomainsState[key] ?? 0),
        0,
      ),
    [lifeDomainsState],
  );
  const lifeDomainsSumOk = lifeDomainsTotal === 100;

  const lifeDomainAnswerCounts = useMemo(() => {
    const counts: Partial<Record<OnboardingLifeDomainKey, LifeDomainAnswerCount>> = {};
    const wantKids = asStr(draft.wantKids) || null;
    for (const key of ONBOARDING_LIFE_DOMAIN_KEYS) {
      const domainId = onboardingLifeDomainKeyToId(key);
      counts[key] = countAnsweredInDomain(domainId, lifeDomainAnswers[domainId] ?? {}, {
        wantKids,
        countOptionalOnly: true,
      });
    }
    return counts;
  }, [lifeDomainAnswers, draft.wantKids]);

  const formSnapshotInput = useMemo(
    (): EditProfileFormSnapshotInput => ({
      draft,
      photoUrls,
      attractedUi,
      sexInterestSelected,
      lifeDomainsState,
      weightKgPick,
      heightCmPick,
      typologyValues,
      matchPrefs,
      prefPhysicalCompatImportance,
      prefPartnerSharesSexualInterests,
      prefPartnerHasChildren,
      prefPartnerPoliticalAlignmentImportance,
      archetypeSelection,
      lifeDomainAnswers,
      validatedBirthLocation,
      profilePrompts,
    }),
    [
      draft,
      photoUrls,
      attractedUi,
      sexInterestSelected,
      lifeDomainsState,
      weightKgPick,
      heightCmPick,
      typologyValues,
      matchPrefs,
      prefPhysicalCompatImportance,
      prefPartnerSharesSexualInterests,
      prefPartnerHasChildren,
      prefPartnerPoliticalAlignmentImportance,
      archetypeSelection,
      lifeDomainAnswers,
      validatedBirthLocation,
      profilePrompts,
    ],
  );

  const currentFormSnapshot = useMemo(
    () => buildEditProfileFormSnapshot(formSnapshotInput),
    [formSnapshotInput],
  );

  const hasUnsavedChanges =
    formDirty ||
    (baselineReady &&
      savedSnapshot !== null &&
      !editProfileFormSnapshotsEqual(savedSnapshot, currentFormSnapshot));

  hasUnsavedChangesRef.current = hasUnsavedChanges;

  const refreshLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const lab = await requestMyLocationLabel();
      if (lab?.trim()) {
        const trimmed = lab.trim();
        setDraft((d) => ({ ...d, location: trimmed }));
        setSavedSnapshot((prev) =>
          prev ? patchEditProfileFormSnapshotLocation(prev, trimmed) : prev,
        );
        if (serverBaselineRef.current) {
          serverBaselineRef.current = {
            ...serverBaselineRef.current,
            draft: { ...serverBaselineRef.current.draft, location: trimmed },
          };
        }
      }
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const setScalar = (key: string) => (t: string) => {
    markFormDirty();
    setDraft((d) => ({ ...d, [key]: t }));
  };

  const onMatchEmbeddedPatch = useCallback(
    (patch: {
      matchPreferences?: MatchPreferences;
      prefPartnerSharesSexualInterests?: string;
      prefPartnerHasChildren?: string;
      prefPartnerPoliticalAlignmentImportance?: string;
    }) => {
      markFormDirty();
      if (patch.matchPreferences) setMatchPrefs(patch.matchPreferences);
      if (patch.prefPartnerSharesSexualInterests !== undefined)
        setPrefPartnerSharesSexualInterests(
          patch.prefPartnerSharesSexualInterests,
        );
      if (patch.prefPartnerHasChildren !== undefined)
        setPrefPartnerHasChildren(patch.prefPartnerHasChildren);
      if (patch.prefPartnerPoliticalAlignmentImportance !== undefined)
        setPrefPartnerPoliticalAlignmentImportance(
          patch.prefPartnerPoliticalAlignmentImportance,
        );
    },
    [markFormDirty],
  );

  useEffect(() => {
    if ((sexInterestSelected?.length ?? 0) > 1) {
      setSexInterestSelected([sexInterestSelected[0]]);
    }
  }, [sexInterestSelected]);

  useEffect(() => {
    const allowed = new Set(photoUrls.map((p) => p.trim()).filter(Boolean));
    for (const url of [...photoFileNameKeyByUrlRef.current.keys()]) {
      if (!allowed.has(url)) {
        const fileKey = photoFileNameKeyByUrlRef.current.get(url);
        if (fileKey) existingPhotoFileNameKeysRef.current.delete(fileKey);
        photoFileNameKeyByUrlRef.current.delete(url);
      }
    }
    for (const url of [...photoAssetIdByUrlRef.current.keys()]) {
      if (!allowed.has(url)) {
        const assetId = photoAssetIdByUrlRef.current.get(url);
        if (assetId) existingPhotoAssetIdsRef.current.delete(assetId);
        photoAssetIdByUrlRef.current.delete(url);
      }
    }
    for (const url of allowed) {
      if (photoFileNameKeyByUrlRef.current.has(url)) continue;
      const fileKey = normalizePhotoFileNameKey(url);
      if (fileKey) {
        photoFileNameKeyByUrlRef.current.set(url, fileKey);
        existingPhotoFileNameKeysRef.current.add(fileKey);
      }
    }
  }, [photoUrls]);

  useEffect(() => {
    if (!saveSucceeded) return;
    const timeout = setTimeout(() => setSaveSucceeded(false), 3500);
    return () => clearTimeout(timeout);
  }, [saveSucceeded]);

  const pickPhotos = async () => {
    const remaining = Math.max(0, 6 - photoUrls.length);
    if (remaining <= 0 || !userId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showSimpleAlert(
        'Permission Needed',
        'Allow access to your photos so you can choose images from this device.',
      );
      return;
    }
    const allowsMultiple = Platform.OS !== 'web' && remaining > 1;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: allowsMultiple,
      selectionLimit: allowsMultiple ? remaining : 1,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;

    const newlyPicked = result.assets.slice(0, remaining);
    const seenLocalUris = new Set<string>();
    const seenFileKeysInBatch = new Set<string>();
    const toAdd: Array<{ uri: string; fileKey: string; assetId: string | null }> = [];

    for (let i = 0; i < newlyPicked.length; i++) {
      const asset = newlyPicked[i];
      const uri = asset.uri.trim();
      if (!uri) continue;

      if (seenLocalUris.has(uri)) {
        showSimpleAlert('Already added', 'You selected the same photo more than once.');
        continue;
      }
      seenLocalUris.add(uri);

      const assetId = asset.assetId?.trim() || null;
      if (assetId && existingPhotoAssetIdsRef.current.has(assetId)) {
        showSimpleAlert('Already added', 'This photo has already been added.');
        continue;
      }

      const pickerName =
        asset.fileName?.replace(/[^a-zA-Z0-9._-]/g, '_') ||
        uri.split('/').pop()?.split('?')[0] ||
        `photo_${Date.now()}_${i}.jpg`;
      const fileKey = normalizePhotoFileNameKey(pickerName);
      if (fileKey && existingPhotoFileNameKeysRef.current.has(fileKey)) {
        showSimpleAlert('Already added', 'This photo has already been added.');
        continue;
      }
      if (fileKey && seenFileKeysInBatch.has(fileKey)) {
        showSimpleAlert('Already added', 'This photo has already been added.');
        continue;
      }
      if (fileKey) seenFileKeysInBatch.add(fileKey);

      toAdd.push({ uri, fileKey, assetId });
    }

    if (toAdd.length === 0) return;

    markFormDirty();
    setPhotoUrls((prev) => {
      const seen = new Set(prev.map((x) => x.trim()));
      const next = [...prev];
      for (const item of toAdd) {
        if (seen.has(item.uri)) continue;
        seen.add(item.uri);
        next.push(item.uri);
        if (item.fileKey) {
          const prevKey = photoFileNameKeyByUrlRef.current.get(item.uri);
          if (prevKey && prevKey !== item.fileKey) {
            existingPhotoFileNameKeysRef.current.delete(prevKey);
          }
          existingPhotoFileNameKeysRef.current.add(item.fileKey);
          photoFileNameKeyByUrlRef.current.set(item.uri, item.fileKey);
        }
        if (item.assetId) {
          existingPhotoAssetIdsRef.current.add(item.assetId);
          photoAssetIdByUrlRef.current.set(item.uri, item.assetId);
        }
      }
      return next.slice(0, 6);
    });
  };

  const toggleAttraction = (option: string) => {
    markFormDirty();
    setAttractedUi((prev) => {
      const isSelected = prev.includes(option);
      if (isSelected) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== option);
      }
      return [...prev, option];
    });
  };

  const onSave = async (): Promise<boolean> => {
    if (!userId || saving) return false;

    const birthForAge = asStr(draft.birthDate);
    const ageSave = birthForAge ? calculateAgeFromBirthdate(birthForAge) : null;
    if (ageSave != null && ageSave < MIN_PROFILE_AGE) {
      showSimpleAlert(
        'Age requirement',
        'You must be 18 or older to use this app.',
      );
      return false;
    }

    const birthTimeRaw = asStr(draft.birthTime);
    if (!isValidOptionalBirthTime24h(birthTimeRaw)) {
      showSimpleAlert(
        'Birth time',
        'Use 24-hour format HH:MM (e.g. 09:05), choose from the list, or pick Not specified.',
      );
      return false;
    }

    if (lifeDomainsTotal !== 100) {
      showSimpleAlert(
        'Life domains',
        `Your life domain sliders must add up to exactly 100 (they are ${lifeDomainsTotal} right now). Open the Lifestyle tab and adjust them until the total shows 100 / 100, then save again.`,
      );
      return false;
    }

    if (archetypeSelection.length === 1) {
      showSimpleAlert(
        'Archetypes',
        'Select two or three archetypes, or clear your selection and save the rest of your profile.',
      );
      return false;
    }

    const promptValidation = validateProfilePromptsForSave(profilePrompts, {
      requireSetupFloor: true,
    });
    if (!promptValidation.ok) {
      showSimpleAlert('Profile prompts', promptValidation.message);
      return false;
    }

    const {
      yearlyIncome: _yi,
      yearlyIncomeCurrency: _yc,
      ...draftClean
    } = draft as Record<string, unknown>;
    void _yi;
    void _yc;

    setSaving(true);
    setSaveSucceeded(false);

    const lifeDomainsChanged =
      !savedSnapshot ||
      !jsonSnapshotEqual(savedSnapshot.lifeDomainsState, lifeDomainsState);
    const lifeAnswersChanged =
      !savedSnapshot ||
      !jsonSnapshotEqual(savedSnapshot.lifeDomainAnswers, lifeDomainAnswers);
    const promptsChanged =
      !savedSnapshot ||
      !jsonSnapshotEqual(savedSnapshot.profilePrompts, profilePrompts);

    let resolvedPhotos = photoUrls;
    if (photoUrlsNeedUpload(photoUrls)) {
      try {
        resolvedPhotos = await resolvePhotoUrlsForSave(userId, photoUrls);
      } catch (e) {
        if (__DEV__) console.warn('[DatingProfileEdit] photo upload', e);
        showSimpleAlert(
          'Could Not Upload Photos',
          e instanceof Error ? e.message : 'Unknown error',
        );
        setSaving(false);
        return false;
      }
    }

    const hw = buildHeightWeightProfileFields({
      height_cm: heightCmPick,
      weight_kg: weightKgPick,
    });

    const qaBase = {
      ...((draftClean.questionAnswers as Record<string, unknown>) || {}),
    };
    for (const key of TYPOLOGY_KEYS) {
      const v = typologyValues[key];
      if (v != null && String(v).trim()) qaBase[key] = String(v).trim();
      else delete qaBase[key];
    }

    const mappedAttraction =
      mapAttractionToDb(attractedUi) ??
      attractedUi.filter((x) =>
        ATTRACTION_UI.includes(x as (typeof ATTRACTION_UI)[number]),
      );

    const next: Record<string, unknown> = { ...draftClean };
    for (const k of STRIP_FROM_SAVE) delete next[k];
    delete next.bio;
    delete next.yearlyIncome;
    delete next.yearlyIncomeCurrency;

    if (isCompleteArchetypeSelection(archetypeSelection.length)) {
      next.archetypes = archetypeSelection;
    }

    Object.assign(next, {
      photos: resolvedPhotos,
      attractedTo: mappedAttraction,
      lookingFor: mappedAttraction,
      sexInterestCategories: sexInterestSelected,
      lifeDomains: lifeDomainsState,
      matchPreferences: matchPrefs,
      prefPhysicalCompatImportance,
      prefPartnerSharesSexualInterests,
      prefPartnerHasChildren,
      prefPartnerPoliticalAlignmentImportance,
      questionAnswers: qaBase,
      recreationalDrugsSocial: asStr(draftClean.recreationalDrugsSocial),
      relationshipWithPsychedelics: asStr(
        draftClean.relationshipWithPsychedelics,
      ),
      relationshipWithCannabis: asStr(draftClean.relationshipWithCannabis),
      recentDatingEarlyWeeks: asStr(draftClean.recentDatingEarlyWeeks),
      spaceForNewRelationship: asStr(draftClean.spaceForNewRelationship),
      partnerMoodMismatchResponse: asStr(draftClean.partnerMoodMismatchResponse),
      sexualFocusPreference: asStr(draftClean.sexualFocusPreference),
    });

    if (hw.height != null) next.height = hw.height;
    if (hw.heightLabel != null) next.heightLabel = hw.heightLabel;
    if (hw.weight != null) next.weight = hw.weight;
    if (hw.weightLabel != null) next.weightLabel = hw.weightLabel;

    if (heightCmPick != null) next.height_cm = heightCmPick;
    if (weightKgPick != null) next.weight_kg = weightKgPick;

    if (genderUiValue && mapGenderToDb(genderUiValue)) {
      next.gender = mapGenderToDb(genderUiValue);
    }

    if (relationshipStyleUi.trim()) {
      next.relationshipStyle = mapRelationshipStyleUiToDb(relationshipStyleUi);
      next.relationshipType =
        mapRelationshipStyleUiToRelationshipType(relationshipStyleUi);
    }

    const birth = asStr(next.birthDate);
    const calculatedAge = calculateAgeFromBirthdate(birth);
    if (calculatedAge != null) next.age = calculatedAge;

    if (typologyValues.myersBriggs?.trim())
      next.myersBriggs = typologyValues.myersBriggs.trim();

    try {
      const sideSyncTasks: Promise<unknown>[] = [];
      if (lifeDomainsChanged) {
        sideSyncTasks.push(
          syncLifeDomainImportanceFromOnboarding(userId, lifeDomainsState, {
            syncProfileJson: false,
          }),
        );
      }
      if (lifeAnswersChanged) {
        sideSyncTasks.push(saveLifeDomainAnswersFromOnboarding(userId, lifeDomainAnswers));
      }

      const saveResults = await Promise.allSettled([
        profilesRepo.updateProfile(userId, omitUndefined(next)),
        ...sideSyncTasks,
      ]);
      const profileResult = saveResults[0];
      if (profileResult.status === 'rejected') {
        throw profileResult.reason;
      }
      if (!profileResult.value.success) {
        throw profileResult.value.error;
      }

      for (const sideResult of saveResults.slice(1)) {
        if (sideResult.status === 'rejected') {
          if (__DEV__) {
            console.warn('[DatingProfileEdit] life domain settings sync', sideResult.reason);
          }
        }
      }

      if (promptsChanged) {
        await saveEditProfilePrompts(userId, profilePrompts);
        void qc.invalidateQueries({ queryKey: ['editProfileInterviewFields', userId] });
      }

      setPhotoUrls(Array.isArray(resolvedPhotos) ? resolvedPhotos : []);
      patchEditProfileQueryCache(qc, userId, {
        profileBlob: next,
        lifeDomainsState,
        matchPrefs,
        lifeDomainAnswers,
      });
      void qc.invalidateQueries({ queryKey: ['profile', userId] });
      setSaveSucceeded(true);
      setSavedSnapshot(
        buildEditProfileFormSnapshot({
          ...formSnapshotInput,
          photoUrls: Array.isArray(resolvedPhotos) ? resolvedPhotos : [],
        }),
      );
      serverBaselineRef.current = {
        ...formSnapshotInput,
        photoUrls: Array.isArray(resolvedPhotos) ? resolvedPhotos : [],
      };
      clearFormDirty();
      return true;
    } catch (e) {
      if (__DEV__) console.warn('[DatingProfileEdit]', e);
      showSimpleAlert(
        'Could Not Save',
        e instanceof Error ? e.message : 'Unknown error',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const completePendingExit = useCallback(() => {
    const pendingAction = pendingNavigationActionRef.current;
    pendingNavigationActionRef.current = null;
    setUnsavedPromptVisible(false);
    allowExitWithoutPromptRef.current = true;
    if (pendingAction) {
      navigation.dispatch(pendingAction);
      return;
    }
    exitEditProfileToPostInterview();
  }, [exitEditProfileToPostInterview, navigation]);

  const showUnsavedChangesPrompt = useCallback(() => {
    if (Platform.OS === 'web') {
      setUnsavedPromptVisible(true);
      return;
    }
    Alert.alert(
      'Unsaved changes',
      'You have unsaved changes. Would you like to save them before leaving?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "Don't save",
          style: 'destructive',
          onPress: () => completePendingExitRef.current(),
        },
        {
          text: 'Save',
          onPress: () => {
            void handleUnsavedPromptSaveRef.current();
          },
        },
      ],
    );
  }, []);

  const promptUnsavedChanges = useCallback(() => {
    pendingNavigationActionRef.current = null;
    showUnsavedChangesPrompt();
  }, [showUnsavedChangesPrompt]);

  const handleBackPress = useCallback(() => {
    if (!hasUnsavedChangesRef.current) {
      exitEditProfileToPostInterview();
      return;
    }
    promptUnsavedChanges();
  }, [exitEditProfileToPostInterview, promptUnsavedChanges]);

  handleBackPressRef.current = handleBackPress;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      header: () => (
        <OnboardingHeader
          variant="dark"
          onBackPress={() => handleBackPressRef.current()}
        />
      ),
    });
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (allowExitWithoutPromptRef.current) return;
      if (!hasUnsavedChangesRef.current) return;
      e.preventDefault();
      pendingNavigationActionRef.current = e.data.action;
      showUnsavedChangesPrompt();
    });
    return unsubscribe;
  }, [navigation, showUnsavedChangesPrompt]);

  const handleUnsavedPromptCancel = useCallback(() => {
    pendingNavigationActionRef.current = null;
    setUnsavedPromptVisible(false);
  }, []);

  const handleUnsavedPromptDiscard = useCallback(() => {
    completePendingExit();
  }, [completePendingExit]);

  const handleUnsavedPromptSave = useCallback(async () => {
    if (unsavedPromptSaving || saving) return;
    setUnsavedPromptSaving(true);
    try {
      const saved = await onSave();
      if (saved) completePendingExit();
    } finally {
      setUnsavedPromptSaving(false);
    }
  }, [completePendingExit, onSave, saving, unsavedPromptSaving]);

  completePendingExitRef.current = completePendingExit;
  handleUnsavedPromptSaveRef.current = () => {
    void handleUnsavedPromptSave();
  };

  const saveFeedbackText = saveSucceeded ? 'Changes saved successfully.' : '';
  const saveButtonDisabled = saving || !userId || !hasUnsavedChanges;

  return (
    <>
    <SafeAreaContainer style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.h1}>{toTitleCaseUi('Your profile')}</Text>
        <Text style={styles.lead}>
          Modify these fields so we can better learn about you so that we can better match you with your perfect partner.
        </Text>

        <Pressable
          onPress={() => void onSave()}
          disabled={saveButtonDisabled}
          style={[styles.primaryBtn, saveButtonDisabled && styles.primaryBtnDisabled]}
        >
          <View style={styles.saveButtonContent}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text style={styles.primaryBtnTxt}>
              {saving ? 'Saving...' : toTitleCaseUi('Save changes')}
            </Text>
          </View>
        </Pressable>
        {saveFeedbackText ? (
          <View
            style={[
              styles.saveStatus,
              saving ? styles.saveStatusSaving : styles.saveStatusSuccess,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#93c5fd" />
            ) : (
              <Text style={styles.saveStatusIcon}>✓</Text>
            )}
            <Text style={styles.saveStatusText}>{saveFeedbackText}</Text>
          </View>
        ) : null}

        <View style={styles.tabBar}>
          {EDIT_PROFILE_TABS.map((tab) => {
            const selected = activeTab === tab.id && typologyResultId == null;
            return (
              <Pressable
                key={tab.id}
                onPress={() => selectProfileTab(tab.id)}
                style={[styles.tabButton, selected && styles.tabButtonActive]}
              >
                <Text
                  style={[styles.tabText, selected && styles.tabTextActive]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.typologyTabBar}>
          {TYPOLOGY_RESULT_TABS.map((tab) => {
            const selected = typologyResultId === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => toggleTypologyResult(tab.id)}
                style={[styles.tabButton, selected && styles.tabButtonActive]}
              >
                <Text
                  style={[styles.tabText, selected && styles.tabTextActive]}
                  numberOfLines={2}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!typologyResultId ? (
          <>
        {activeTab === 'basics' ? (
          <>
            <SectionTitle>About you</SectionTitle>
            <Field
              label="Name"
              value={asStr(draft.displayName ?? draft.name)}
              onChangeText={(t) => {
                markFormDirty();
                setDraft((d) => ({ ...d, displayName: t, name: t }));
              }}
            />
            <ChoiceDropdown
              label="Gender"
              value={genderUiValue}
              options={GENDER_UI_OPTIONS.map((g) => ({ label: g, value: g }))}
              onValueChange={(ui) => {
                markFormDirty();
                setDraft((d) => ({
                  ...d,
                  gender: ui ? (mapGenderToDb(ui) ?? ui) : '',
                }));
              }}
            />
            <ChoiceDropdown
              label="Ethnicity"
              value={asStr(draft.ethnicity)}
              options={ETHNICITY_CHOICES}
              onValueChange={setScalar('ethnicity')}
            />
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Attracted to</Text>
              <View style={styles.chipWrap}>
                {ATTRACTION_UI.map((option) => {
                  const on = attractedUi.includes(option);
                  return (
                    <Pressable
                      key={option}
                      onPress={() => toggleAttraction(option)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <DatePicker
                label="Date of birth"
                value={birthDateStr}
                onValueChange={setScalar('birthDate')}
                minYear={1900}
                minimumAge={MIN_PROFILE_AGE}
                error={birthDateError}
              />
            </View>
            <BirthTimeQuarterHourPicker
              label="Time of birth (optional)"
              value={asStr(draft.birthTime)}
              onValueChange={setScalar('birthTime')}
            />
            <View style={styles.fieldBlock}>
              <FormTextInput
                label="Location of birth (optional)"
                value={asStr(draft.birthLocation)}
                onChangeText={(v) => {
                  setDraft((d) => ({ ...d, birthLocation: v }));
                  if (v.trim() === '') {
                    setValidatedBirthLocation(undefined);
                  } else if (
                    validatedBirthLocation !== undefined &&
                    v.trim() !== validatedBirthLocation
                  ) {
                    setValidatedBirthLocation(undefined);
                  }
                }}
                placeholder="e.g. city, region, or hospital"
                autoCapitalize="words"
              />
              {birthLocationPlacesLoading ? (
                <View style={styles.birthLocationSearchRow}>
                  <ActivityIndicator size="small" color="#93c5fd" />
                  <Text style={styles.birthLocationSearchText}>Looking up places…</Text>
                </View>
              ) : null}
              {birthLocationSuggestions.length > 0 ? (
                <View style={styles.birthLocationSuggestions}>
                  {birthLocationSuggestions.map((s, idx) => (
                    <TouchableOpacity
                      key={`${idx}-${s.label.slice(0, 48)}`}
                      style={styles.birthLocationSuggestionRow}
                      onPress={() => {
                        setDraft((d) => ({ ...d, birthLocation: s.label }));
                        setValidatedBirthLocation(s.label);
                        setBirthLocationSuggestions([]);
                      }}
                    >
                      <Text style={styles.birthLocationSuggestionText}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <SectionTitle>Relationship & place</SectionTitle>
            <ChoiceDropdown
              label="My relationship style is"
              value={relationshipStyleUi}
              options={RELATIONSHIP_STYLE_CHOICES}
              onValueChange={setScalar('relationshipStyle')}
            />
            <ChoiceDropdown
              label="Relationship history"
              value={asStr(draft.longestRomanticRelationship)}
              options={LONGEST_ROMANTIC_RELATIONSHIP_OPTIONS}
              onValueChange={setScalar('longestRomanticRelationship')}
            />
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>I am located at</Text>
              <View style={[styles.input, styles.readOnlyBox]}>
                {locationLoading ? (
                  <View style={styles.locInner}>
                    <ActivityIndicator size="small" color="#93c5fd" />
                    <Text style={styles.readOnlyText}>
                      Finding your location…
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.readOnlyText}>
                    {asStr(draft.location).trim() || '—'}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => void refreshLocation()}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnTxt}>Refresh location</Text>
              </TouchableOpacity>
            </View>

            <SectionTitle>Work & education</SectionTitle>
            <Field
              label="Occupation"
              value={asStr(draft.occupation)}
              onChangeText={setScalar('occupation')}
            />
            <ChoiceDropdown
              label="Education level"
              value={asStr(draft.educationLevel)}
              options={EDUCATION_LEVEL_CHOICES}
              onValueChange={setScalar('educationLevel')}
            />

            <SectionTitle>Hobbies</SectionTitle>
            <HobbiesFields
              hobbies={asStr(draft.hobbies)}
              professionalHobbyId={
                draft.professionalHobbyId == null
                  ? null
                  : String(draft.professionalHobbyId)
              }
              onHobbiesChange={(hobbies) =>
                setDraft((d) => ({ ...d, hobbies }))
              }
              onProfessionalHobbyIdChange={(professionalHobbyId) =>
                setDraft((d) => ({ ...d, professionalHobbyId }))
              }
            />

            <SectionTitle>Profile prompts</SectionTitle>
            <ProfilePromptsFields
              prompts={profilePrompts}
              onChange={(next) => {
                setProfilePrompts(next);
                markFormDirty();
              }}
            />
          </>
        ) : null}

        {activeTab === 'lifestyle' ? (
          <>
            <SectionTitle>Body & habits</SectionTitle>
            <View style={styles.fieldBlock}>
              <HeightWeightInputFields
                heightCm={heightCmPick}
                weightKg={weightKgPick}
                onHeightCmChange={(cm) => {
                  setHeightCmPick(cm);
                  markFormDirty();
                }}
                onWeightKgChange={(kg) => {
                  setWeightKgPick(kg);
                  markFormDirty();
                }}
              />
            </View>
            <ChoiceDropdown
              label="Workout frequency"
              value={asStr(draft.workout)}
              options={workoutOptions}
              onValueChange={setScalar('workout')}
            />
            <ChoiceDropdown
              label="Smoking & vaping"
              value={asStr(draft.smoking)}
              options={smokingOptions}
              onValueChange={setScalar('smoking')}
            />
            <ChoiceDropdown
              label="What is your relationship with alcohol"
              value={asStr(draft.drinking)}
              options={drinkingOptions}
              onValueChange={setScalar('drinking')}
            />
            <ChoiceDropdown
              label="Do you use recreational drugs socially (MDMA, cocaine, etc)"
              value={asStr(draft.recreationalDrugsSocial)}
              options={recreationalDrugsSocialOptions}
              onValueChange={setScalar('recreationalDrugsSocial')}
            />
            <ChoiceDropdown
              label="What's your relationship with psychedelics or plant medicines?"
              value={asStr(draft.relationshipWithPsychedelics)}
              options={psychedelicsRelationshipOptions}
              onValueChange={setScalar('relationshipWithPsychedelics')}
            />
            <ChoiceDropdown
              label="What is your relationship with cannabis or tobacco?"
              value={asStr(draft.relationshipWithCannabis)}
              options={cannabisRelationshipOptions}
              onValueChange={setScalar('relationshipWithCannabis')}
            />

            <SectionTitle>Lifestyle & location</SectionTitle>
            <ChoiceDropdown
              label="Where do you see yourself living long term?"
              value={asStr(matchPrefs.longTermLivingPreference)}
              allowUnset
              options={PREF_LONG_TERM_LOCATION_OPTIONS.map((o) => ({
                label: o,
                value: o,
              }))}
              onValueChange={(v) =>
                setMatchPrefs((p) => ({ ...p, longTermLivingPreference: v }))
              }
            />
            <ChoiceDropdown
              label="Which lifestyle feels most like you?"
              value={asStr(matchPrefs.lifestylePreference)}
              allowUnset
              options={PREF_LIFESTYLE_OPTIONS.map((o) => ({
                label: o,
                value: o,
              }))}
              onValueChange={(v) =>
                setMatchPrefs((p) => ({ ...p, lifestylePreference: v }))
              }
            />
            <ChoiceDropdown
              label="Would you relocate for the right relationship?"
              value={asStr(matchPrefs.relocationPreference)}
              allowUnset
              options={PREF_RELOCATION_OPTIONS.map((o) => ({
                label: o,
                value: o,
              }))}
              onValueChange={(v) =>
                setMatchPrefs((p) => ({ ...p, relocationPreference: v }))
              }
            />

            <SectionTitle>Values</SectionTitle>
            <ChoiceDropdown
              label="Do you have kids?"
              value={asStr(draft.haveKids)}
              options={haveKidsOptions}
              onValueChange={setScalar('haveKids')}
            />
            <ChoiceDropdown
              label="Do you want children?"
              value={asStr(draft.wantKids)}
              options={wantChildrenYesNoOptions}
              onValueChange={setScalar('wantKids')}
            />
            <ChoiceDropdown
              label="Politics"
              value={asStr(draft.politics)}
              options={politicsOptions}
              onValueChange={setScalar('politics')}
            />
            <ChoiceDropdown
              label="Religion"
              value={asStr(draft.religion)}
              options={religionOptions}
              onValueChange={setScalar('religion')}
            />

            <SectionTitle>Life domains</SectionTitle>
            <LifeDomainDistribution
              values={lifeDomainsState}
              onValuesChange={setLifeDomainsState}
              domainAnswerCounts={lifeDomainAnswerCounts}
              onOpenDomainQuestions={(key) =>
                setLifeDomainQuestionsDomainId(onboardingLifeDomainKeyToId(key))
              }
            />
            {!lifeDomainsSumOk ? (
              <Text style={styles.lifeDomainsError}>
                Life domains must total 100 before you can save (currently{' '}
                {lifeDomainsTotal}).
              </Text>
            ) : null}
          </>
        ) : null}

        {activeTab === 'compatibility' ? (
          <>
            <SectionTitle>Sexual compatibility</SectionTitle>
            <ChoiceDropdown
              label="In a relationship, what feels like your natural rhythm for sex?"
              value={asStr(draft.sexDrive)}
              options={SEX_DRIVE_OPTIONS}
              onValueChange={setScalar('sexDrive')}
            />
            <ChoiceDropdown
              label="Sexual interests (select one)"
              value={sexInterestSelected[0] ?? ''}
              options={SEX_INTEREST_CATEGORY_OPTIONS}
              onValueChange={(v) => setSexInterestSelected(v ? [v] : [])}
            />
            <ChoiceDropdown
              label={RECENT_DATING_EARLY_WEEKS_QUESTION}
              value={asStr(draft.recentDatingEarlyWeeks)}
              options={RECENT_DATING_EARLY_WEEKS_OPTIONS}
              onValueChange={setScalar('recentDatingEarlyWeeks')}
            />
            <ChoiceDropdown
              label="How much space do you realistically have for a new relationship right now?"
              value={asStr(draft.spaceForNewRelationship)}
              options={SPACE_FOR_NEW_RELATIONSHIP_OPTIONS}
              onValueChange={setScalar('spaceForNewRelationship')}
            />
            <ChoiceDropdown
              label="When my partner is in the mood and I'm not, I generally..."
              value={asStr(draft.partnerMoodMismatchResponse)}
              options={PARTNER_MOOD_MISMATCH_RESPONSE_OPTIONS}
              onValueChange={setScalar('partnerMoodMismatchResponse')}
            />
            <ChoiceDropdown
              label="During sex, I'm more focused on..."
              value={asStr(draft.sexualFocusPreference)}
              options={SEXUAL_FOCUS_OPTIONS}
              onValueChange={setScalar('sexualFocusPreference')}
            />

            <SectionTitle>Life domain questions</SectionTitle>
            <LifeDomainRequiredQuestionsSection
              wantKids={asStr(draft.wantKids) || null}
              answers={lifeDomainAnswers}
              onAnswerChange={(domainId, questionId, value) => {
                setLifeDomainAnswers((prev) => ({
                  ...prev,
                  [domainId]: { ...(prev[domainId] ?? {}), [questionId]: value },
                }));
              }}
            />

            <SectionTitle>Typology</SectionTitle>
            <TypologyPickerFields
              variant="onboarding"
              allowSkipOption
              value={typologyValues}
              onTypologyChange={setTypologyValues}
            />
          </>
        ) : null}

        {activeTab === 'basics' ? (
          <>
            <SectionTitle>Add your photos</SectionTitle>
            <View style={styles.photoGrid}>
              {photoUrls.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.photoContainer}>
                  <ExpoImage
                    source={{ uri }}
                    style={styles.photo}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => {
                      setPhotoUrls((prev) =>
                        prev.filter((_, i) => i !== index),
                      );
                    }}
                  >
                    <Text style={styles.removePhotoText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {photoUrls.length < 6 && (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={() => void pickPhotos()}
                  accessibilityRole="button"
                >
                  <Text style={styles.addPhotoGlyph}>+</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />

            <SectionTitle>Your archetypes</SectionTitle>
            <ArchetypeSelector
              value={archetypeSelection}
              onChange={setArchetypeSelection}
            />
            <Text style={styles.mutedSmall}>
              Select {MIN_PROFILE_ARCHETYPES}–{MAX_PROFILE_ARCHETYPES} archetypes, then use Save changes at the top.
            </Text>
          </>
        ) : null}

        {activeTab === 'dealbreakers' ? (
          <>
            <SectionTitle>Dealbreakers</SectionTitle>
            <MatchPreferencesEmbedded
              location={asStr(draft.location)}
              userAge={userAge}
              matchPreferences={matchPrefs}
              prefPartnerSharesSexualInterests={
                prefPartnerSharesSexualInterests
              }
              prefPartnerHasChildren={prefPartnerHasChildren}
              prefPartnerPoliticalAlignmentImportance={
                prefPartnerPoliticalAlignmentImportance
              }
              onPreferencesPatch={onMatchEmbeddedPatch}
            />
          </>
        ) : null}
          </>
        ) : typologyResultId === 'CONFLICT-30' && userId ? (
          <ConflictStyleResultsPanel
            userId={userId}
            footer={{ kind: 'none' }}
          />
        ) : typologyResultId && userId ? (
          <AssessmentInsightResultsPanel
            userId={userId}
            instrumentId={typologyResultId}
          />
        ) : null}

        <Pressable
          onPress={() => void onSave()}
          disabled={saveButtonDisabled}
          style={[
            styles.primaryBtn,
            saveButtonDisabled && styles.primaryBtnDisabled,
            { marginTop: 8 },
          ]}
        >
          <View style={styles.saveButtonContent}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text style={styles.primaryBtnTxt}>
              {saving ? 'Saving...' : toTitleCaseUi('Save changes')}
            </Text>
          </View>
        </Pressable>
        {saveFeedbackText ? (
          <View
            style={[
              styles.saveStatus,
              saving ? styles.saveStatusSaving : styles.saveStatusSuccess,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#93c5fd" />
            ) : (
              <Text style={styles.saveStatusIcon}>✓</Text>
            )}
            <Text style={styles.saveStatusText}>{saveFeedbackText}</Text>
          </View>
        ) : null}

        <Text style={styles.mutedSmall}>Signed in as {user?.email ?? '—'}</Text>
      </ScrollView>
    </SafeAreaContainer>

    {userId && lifeDomainQuestionsDomainId ? (
      <LifeDomainQuestionsEditModal
        visible
        userId={userId}
        domainId={lifeDomainQuestionsDomainId}
        initialAnswers={lifeDomainAnswers}
        onAnswersChange={setLifeDomainAnswers}
        wantKids={asStr(draft.wantKids) || null}
        enforceRequired={false}
        questionScope="optional"
        onClose={() => setLifeDomainQuestionsDomainId(null)}
      />
    ) : null}
    <EditProfileUnsavedChangesModal
      visible={unsavedPromptVisible}
      saving={unsavedPromptSaving || saving}
      onCancel={handleUnsavedPromptCancel}
      onDiscard={handleUnsavedPromptDiscard}
      onSave={() => void handleUnsavedPromptSave()}
    />
    </>
  );
};

const styles = StyleSheet.create({
  scroll: {
    padding: 22,
    paddingBottom: 48,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  h1: {
    fontFamily:
      Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 26,
    fontWeight: '600',
    color: '#fafafa',
    marginBottom: 10,
  },
  lead: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily:
      Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 18,
    fontWeight: '600',
    color: '#e4e4e7',
    marginTop: 22,
    marginBottom: 12,
  },
  fieldBlock: { marginBottom: 14 },
  birthLocationSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  birthLocationSearchText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  birthLocationSuggestions: {
    marginTop: 4,
    marginBottom: 4,
    maxHeight: 220,
  },
  birthLocationSuggestionRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  birthLocationSuggestionText: {
    fontSize: 14,
    color: '#E8F0F8',
    lineHeight: 20,
  },
  label: { color: '#9CB4D8', fontSize: 13, marginBottom: 8 },
  input: {
    fontFamily: FONT_BODY,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    color: '#E8F0F8',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  inputMultiline: { minHeight: 88, paddingTop: 12 },
  readOnlyBox: { justifyContent: 'center' },
  readOnlyText: { fontFamily: FONT_BODY, fontSize: 15, color: '#E8F0F8' },
  locInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  choicePickerWrap: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  choicePicker: {
    width: '100%',
    color: '#E8F0F8',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'ios'
      ? { height: 152 }
      : Platform.OS === 'android'
        ? { height: 56 }
        : {}),
  },
  dropdownChevron: {
    color: 'rgba(156,180,216,0.9)',
    fontSize: 14,
    paddingLeft: 10,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipOn: {
    borderColor: '#5BA8E8',
    backgroundColor: 'rgba(91,168,232,0.15)',
  },
  chipTxt: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
  },
  chipTxtOn: { color: '#EEF6FF', fontWeight: '600' },
  secondaryBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  secondaryBtnTxt: { color: '#93c5fd', fontSize: 13, fontWeight: '600' },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  photoContainer: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  photo: { width: '100%', height: '100%' },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  addPhotoButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.14)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoGlyph: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '300',
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.78,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 15 },
  saveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  saveStatusSaving: {
    borderColor: 'rgba(147,197,253,0.28)',
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  saveStatusSuccess: {
    borderColor: 'rgba(74,222,128,0.28)',
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  saveStatusIcon: {
    color: '#86efac',
    fontSize: 15,
    fontWeight: '800',
  },
  saveStatusText: {
    color: '#E8F0F8',
    fontSize: 13,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: 6,
    marginTop: 6,
    marginBottom: 8,
  },
  typologyTabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.22)',
    backgroundColor: 'rgba(91,168,232,0.06)',
    padding: 6,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  tabButtonActive: {
    borderColor: 'rgba(91,168,232,0.42)',
    backgroundColor: 'rgba(91,168,232,0.16)',
  },
  tabText: {
    color: 'rgba(200,217,238,0.78)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#EEF6FF',
  },
  mutedSmall: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 16 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 20,
  },
  lifeDomainsError: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.error,
    fontWeight: '600',
  },
});
