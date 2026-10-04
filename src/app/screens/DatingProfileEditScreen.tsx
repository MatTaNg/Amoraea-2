import { AMORAEA_PAGE_LOADING_SIZE, AmoraeaLoadingSpinner } from '@app/screens/AmoraeaLoadingSpinner';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { PAGE_CONTENT_MAX_WIDTH } from '@utilities/pageContentWidth';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
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
  DEFAULT_ONBOARDING_LIFE_DOMAINS,
  ONBOARDING_LIFE_DOMAIN_KEYS,
  type OnboardingLifeDomainValues,
} from '@/shared/components/LifeDomainDistribution';
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
import type { TypologyPickerValue } from '@/shared/components/profileFields/TypologyPickerFields';
import {
  resolveEditProfileTypologyValues,
  readTypologyValuesFromProfile,
  TYPOLOGY_ONBOARDING_ROW_KEYS,
} from '@/shared/utils/typologyPickerValue';
import { MatchPreferences } from '@/shared/hooks/filterPreferences/types';
import { mapGenderToDb, mapGenderToUi } from '@/shared/utils/genderMapper';
import {
  mapAttractionToDb,
  normalizeAttractedToUiLabels,
} from '@/shared/utils/attractionMapper';
import { calculateAgeFromBirthdate, MIN_USER_AGE } from '@/shared/utils/ageCalculator';
import { useLocationAutocomplete } from '@/shared/hooks/useLocationAutocomplete';
import { requestMyLocationLabel } from '@/screens/profile/utils/locationHelpers';
import { DatePicker } from '@/shared/components/DatePicker';
import {
  BirthTimeQuarterHourPicker,
  isValidOptionalBirthTime24h,
} from '@/shared/components/BirthTimeQuarterHourPicker';
import { OnboardingHeader } from '@ui/components/OnboardingHeader';
import {
  FormField,
  FormTextInput,
} from '@/shared/ui/FormField';
import { AppSelect } from '@/shared/ui/AppSelect';
import { ArchetypeSelector } from '@/shared/components/profileFields/ArchetypeSelector';
import { HobbiesFields } from '@/shared/components/profileFields/HobbiesFields';
import { HobbyDealbreakerField } from '@/shared/components/profileFields/HobbyDealbreakerField';
import { hobbiesStringToIds } from '@/shared/utils/hobbiesHelpers';
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
  type ArchetypeId,
} from '@/shared/constants/archetypes';
import {
  saveLifeDomainAnswersFromOnboarding,
  syncLifeDomainImportanceFromOnboarding,
  type LifeDomainAnswersMap,
} from '@/screens/profile/editProfile/lifeDomainProfileService';
import {
  invalidateEditProfileQueries,
  patchEditProfileQueryCache,
  useEditProfileBlobQuery,
  useEditProfileLifeDomainAnswersQuery,
  useEditProfileLifeDomainSlidersQuery,
  useEditProfileMatchPrefsQuery,
} from '@/screens/profile/editProfile/editProfileQueries';
import {
  EditProfileOverline,
  EditProfileSectionLabel,
  EditProfileStrengthBar,
  EditProfileSubsectionTitle,
  EditProfileTabBar,
  EditProfileTabHeader,
  type EditProfileTabId,
} from '@/screens/profile/editProfile/EditProfileUi';
import { computeEditProfileStrength, parseLifeDomainStrengthItemId } from '@/screens/profile/editProfile/editProfileStrength';
import type { ProfileStrengthItem } from '@/screens/profile/editProfile/editProfileStrength';
import {
  EditProfileCompatibilityDeepDiveView,
} from '@/screens/profile/editProfile/EditProfileCompatibilityDeepDiveView';
import type { LifeDomainId } from '@/shared/constants/lifeDomainOnboardingQuestions';
import { EssentialsLifeDomainFields } from '@/screens/profile/editProfile/EssentialsLifeDomainFields';
import {
  EditProfileTypologyView,
} from '@/screens/profile/editProfile/EditProfileTypologyView';
import { EditProfileMyResultsView } from '@/screens/profile/editProfile/EditProfileMyResultsView';
import { ep } from '@/screens/profile/editProfile/editProfileTheme';
import {
  ONBOARDING_DEALBREAKERS_LEAD,
  ONBOARDING_SEXUAL_COMPATIBILITY_LEAD,
  EDIT_PROFILE_DEEP_DIVE_LEAD,
  EDIT_PROFILE_PAGE_LEAD,
  EDIT_PROFILE_STRENGTH_COMPLETE_HINT,
  EDIT_PROFILE_STRENGTH_TAP_HINT,
  ONBOARDING_ETHNICITY_DESCRIPTION,
  ONBOARDING_HEIGHT_WEIGHT_NOTE,
  ONBOARDING_HOBBIES_DESCRIPTION,
  ONBOARDING_LOCATION_DESCRIPTION,
  ONBOARDING_PHOTOS_DESCRIPTION,
  ONBOARDING_PROFILE_PROMPTS_SETUP_LEAD,
} from '@/datingProfile/screens/onboarding/modals/onboardingStepCopy';
import {
  jsonSnapshotEqual,
  photoUrlsNeedUpload,
  resolvePhotoUrlsForSave,
} from '@/screens/profile/editProfile/editProfileSaveHelpers';
import {
  buildEditProfileFormSnapshot,
  editProfileFormSnapshotsEqual,
  patchEditProfileFormSnapshotLocation,
  type EditProfileFormSnapshot,
  type EditProfileFormSnapshotInput,
} from '@/screens/profile/editProfile/editProfileDraftSnapshot';

const BG = ep.colors.void;
const MIN_PROFILE_AGE = MIN_USER_AGE;
const FONT_BODY = ep.fonts.body;
const FONT_UI = ep.fonts.ui;
const FONT_DISPLAY = ep.fonts.display;

const GENDER_UI_OPTIONS = ['Man', 'Woman', 'Non-binary'] as const;

const ATTRACTION_UI = ['Men', 'Women', 'Non-binary'] as const;

const TYPOLOGY_KEYS = TYPOLOGY_ONBOARDING_ROW_KEYS;

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
  if (primaryPick && urls.length < 6) {
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
    .slice(0, 6);
}

function profileToTypology(p: Record<string, unknown>): TypologyPickerValue {
  return readTypologyValuesFromProfile(p);
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

  const serverBaselineRef = useRef<EditProfileFormSnapshotInput | null>(null);
  const handleBackPressRef = useRef<() => void>(() => {});
  const onSaveRef = useRef<(options?: { silent?: boolean }) => Promise<boolean>>(
    async () => false,
  );

  const exitEditProfileToPostInterview = useCallback(() => {
    exitDatingProfileOnboardingToPostInterview(navigation, userId.trim() || undefined);
  }, [navigation, userId]);

  const [savedSnapshot, setSavedSnapshot] = useState<EditProfileFormSnapshot | null>(
    null,
  );
  const [baselineReady, setBaselineReady] = useState(false);
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
  const [activeTab, setActiveTab] = useState<EditProfileTabId>('essentials');
  const [openLifeDomainQuestionsId, setOpenLifeDomainQuestionsId] =
    useState<LifeDomainId | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [saving, setSaving] = useState(false);
  const [birthLocationSuggestions, setBirthLocationSuggestions] = useState<
    Array<{ label: string }>
  >([]);
  const [validatedBirthLocation, setValidatedBirthLocation] = useState<
    string | undefined
  >(undefined);
  const [archetypeSelection, setArchetypeSelection] = useState<ArchetypeId[]>([]);
  const [profilePrompts, setProfilePrompts] = useState<ProfilePromptAnswer[]>([]);
  const [lifeDomainAnswers, setLifeDomainAnswers] = useState<LifeDomainAnswersMap>({});
  const { data: profileBlob, isError: profileBlobError } = useEditProfileBlobQuery(userId);
  const { data: hydratedLifeDomainSliders, isError: lifeDomainSlidersError } =
    useEditProfileLifeDomainSlidersQuery(userId, profileBlob);
  const { data: hydratedMatchPrefs, isError: matchPrefsError } = useEditProfileMatchPrefsQuery(
    userId,
    profileBlob,
  );
  const { data: hydratedLifeDomainAnswers, isError: lifeDomainAnswersError } =
    useEditProfileLifeDomainAnswersQuery(userId);
  const { data: interviewEditSnapshot, isError: interviewFieldsError } = useQuery({
    queryKey: ['editProfileInterviewFields', userId],
    queryFn: () => loadEditProfileSnapshot(userId),
    enabled: Boolean(userId),
  });

  useLayoutEffect(() => {
    if (!userId) {
      draftHydratedForUserIdRef.current = null;
      serverBaselineRef.current = null;
      setSavedSnapshot(null);
      setBaselineReady(false);
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
    setSavedSnapshot(null);
    setBaselineReady(false);

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

    setSavedSnapshot(
      buildEditProfileFormSnapshot(serverBaselineRef.current),
    );
    setBaselineReady(true);
  }, [
    hydratedLifeDomainAnswers,
    hydratedLifeDomainSliders,
    hydratedMatchPrefs,
    profileBlob,
    interviewEditSnapshot,
    userId,
  ]);

  useEffect(() => {
    if (!userId) {
      draftHydratedForUserIdRef.current = null;
      setBaselineReady(false);
      return;
    }
    if (draftHydratedForUserIdRef.current !== userId) {
      setBaselineReady(false);
    }
  }, [userId]);

  const profileLoadFailed =
    Boolean(userId) &&
    (profileBlobError ||
      lifeDomainSlidersError ||
      matchPrefsError ||
      lifeDomainAnswersError ||
      interviewFieldsError);
  const profileFieldsLoading = Boolean(userId) && !baselineReady && !profileLoadFailed;

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

  const resolvedTypologyValues = useMemo(
    () => resolveEditProfileTypologyValues(draft, typologyValues),
    [draft, typologyValues],
  );

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

  const profileStrength = useMemo(
    () => computeEditProfileStrength(formSnapshotInput),
    [formSnapshotInput],
  );

  const profileStrengthHint =
    profileStrength.incomplete.length > 0
      ? EDIT_PROFILE_STRENGTH_TAP_HINT
      : EDIT_PROFILE_STRENGTH_COMPLETE_HINT;

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'deepDive') {
      setOpenLifeDomainQuestionsId(null);
    }
  }, [activeTab]);

  const autoSaveBlocked = useMemo(() => {
    const birthForAge = asStr(draft.birthDate);
    const ageSave = birthForAge ? calculateAgeFromBirthdate(birthForAge) : null;
    if (ageSave != null && ageSave < MIN_PROFILE_AGE) return true;

    const birthTimeRaw = asStr(draft.birthTime);
    if (!isValidOptionalBirthTime24h(birthTimeRaw)) return true;

    if (lifeDomainsTotal !== 100) return true;

    if (archetypeSelection.length === 1) return true;

    const promptValidation = validateProfilePromptsForSave(profilePrompts, {
      requireSetupFloor: true,
    });
    if (!promptValidation.ok) return true;

    return false;
  }, [
    archetypeSelection.length,
    draft.birthDate,
    draft.birthTime,
    lifeDomainsTotal,
    profilePrompts,
  ]);

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
    setDraft((d) => ({ ...d, [key]: t }));
  };

  const onMatchEmbeddedPatch = useCallback(
    (patch: {
      matchPreferences?: MatchPreferences;
      prefPartnerSharesSexualInterests?: string;
      prefPartnerHasChildren?: string;
      prefPartnerPoliticalAlignmentImportance?: string;
    }) => {
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
    [],
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
    setAttractedUi((prev) => {
      const isSelected = prev.includes(option);
      if (isSelected) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== option);
      }
      return [...prev, option];
    });
  };

  const onSave = async (options?: { silent?: boolean }): Promise<boolean> => {
    const silent = options?.silent ?? false;
    if (!userId || saving) return false;

    if (
      baselineReady &&
      savedSnapshot &&
      editProfileFormSnapshotsEqual(savedSnapshot, currentFormSnapshot)
    ) {
      return true;
    }

    const birthForAge = asStr(draft.birthDate);
    const ageSave = birthForAge ? calculateAgeFromBirthdate(birthForAge) : null;
    if (ageSave != null && ageSave < MIN_PROFILE_AGE) {
      if (!silent) {
        showSimpleAlert(
          'Age requirement',
          'You must be 18 or older to use this app.',
        );
      }
      return false;
    }

    const birthTimeRaw = asStr(draft.birthTime);
    if (!isValidOptionalBirthTime24h(birthTimeRaw)) {
      if (!silent) {
        showSimpleAlert(
          'Birth time',
          'Use 24-hour format HH:MM (e.g. 09:05), choose from the list, or pick Not specified.',
        );
      }
      return false;
    }

    if (lifeDomainsTotal !== 100) {
      if (!silent) {
        showSimpleAlert(
          'Life domains',
          `Your life domain sliders must add up to exactly 100 (they are ${lifeDomainsTotal} right now). Open the Lifestyle tab and adjust them until the total shows 100 / 100, then save again.`,
        );
      }
      return false;
    }

    if (archetypeSelection.length === 1) {
      if (!silent) {
        showSimpleAlert(
          'Archetypes',
          'Select two or three archetypes, or clear your selection and save the rest of your profile.',
        );
      }
      return false;
    }

    const promptValidation = validateProfilePromptsForSave(profilePrompts, {
      requireSetupFloor: true,
    });
    if (!promptValidation.ok) {
      if (!silent) {
        showSimpleAlert('Profile prompts', promptValidation.message);
      }
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

  onSaveRef.current = onSave;

  useEffect(() => {
    if (!baselineReady || !savedSnapshot || saving || autoSaveBlocked) return;
    if (editProfileFormSnapshotsEqual(savedSnapshot, currentFormSnapshot)) return;

    const timeout = setTimeout(() => {
      void onSaveRef.current({ silent: true });
    }, 600);

    return () => clearTimeout(timeout);
  }, [
    autoSaveBlocked,
    baselineReady,
    currentFormSnapshot,
    savedSnapshot,
    saving,
  ]);

  const handleBackPress = useCallback(() => {
    exitEditProfileToPostInterview();
  }, [exitEditProfileToPostInterview]);

  handleBackPressRef.current = handleBackPress;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPressRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

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

  return (
    <SafeAreaContainer
      style={{ flex: 1, backgroundColor: BG }}
      edges={['left', 'right', 'bottom']}
    >
      {profileFieldsLoading ? (
        <View style={styles.loadingContainer}>
          <AmoraeaLoadingSpinner size={AMORAEA_PAGE_LOADING_SIZE} />
          <Text style={styles.loadingText}>Loading your profile…</Text>
        </View>
      ) : profileLoadFailed ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingError}>
            We couldn&apos;t load your profile. Check your connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              void invalidateEditProfileQueries(qc, userId);
              void qc.invalidateQueries({ queryKey: ['editProfileInterviewFields', userId] });
            }}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <View style={styles.page}>
      <ScrollView
        ref={scrollRef}
        style={styles.pageScroll}
        contentContainerStyle={[styles.scroll, styles.scrollWithTabBar]}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.scrollColumn}>
        {activeTab === 'essentials' ? (
              <>
                <EditProfileTabHeader
                  title="Essentials"
                  lead={EDIT_PROFILE_PAGE_LEAD}
                  saving={saving}
                />
                <EditProfileOverline label="Photos" />
                <Text style={styles.sectionIntro}>{ONBOARDING_PHOTOS_DESCRIPTION}</Text>
            <View style={styles.photoGrid}>
              {photoUrls.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.photoContainer}>
                  <ExpoImage
                    source={{ uri }}
                    style={styles.photo}
                    contentFit="cover"
                  />
                  {photoUrls.length > 1 ? (
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => {
                        setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                    >
                      <Text style={styles.removePhotoText}>×</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {photoUrls.length < 6 ? (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={() => void pickPhotos()}
                  accessibilityRole="button"
                  accessibilityLabel="Add photo"
                >
                  <Ionicons name="add" size={36} color={ep.colors.textDim} />
                </TouchableOpacity>
              ) : null}
            </View>

            <EditProfileStrengthBar
              percent={profileStrength.percent}
              completedCount={profileStrength.completedCount}
              totalCount={profileStrength.totalCount}
              hint={profileStrengthHint}
              incomplete={profileStrength.incomplete}
              onNavigateToField={(item: ProfileStrengthItem) => {
                setActiveTab(item.tab);
                const lifeDomainItem = parseLifeDomainStrengthItemId(item.id);
                if (lifeDomainItem) {
                  setOpenLifeDomainQuestionsId(lifeDomainItem.domainId);
                }
              }}
            />
            <EditProfileSectionLabel>About you</EditProfileSectionLabel>
            <Text style={styles.sectionIntro}>{ONBOARDING_ETHNICITY_DESCRIPTION}</Text>
            <Field
              label="Name"
              value={asStr(draft.displayName ?? draft.name)}
              onChangeText={(t) => {
                setDraft((d) => ({ ...d, displayName: t, name: t }));
              }}
            />
            <AppSelect
              label="Gender"
              value={genderUiValue}
              options={GENDER_UI_OPTIONS.map((g) => ({ label: g, value: g }))}
              onValueChange={(ui) => {
                setDraft((d) => ({
                  ...d,
                  gender: ui ? (mapGenderToDb(ui) ?? ui) : '',
                }));
              }}
            />
            <AppSelect
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
                  <ActivityIndicator size="small" color="#5BA8E8" />
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

            <EditProfileSubsectionTitle description={ONBOARDING_LOCATION_DESCRIPTION}>
              Relationship & place
            </EditProfileSubsectionTitle>
            <AppSelect
              label="My relationship style is"
              value={relationshipStyleUi}
              options={RELATIONSHIP_STYLE_CHOICES}
              onValueChange={setScalar('relationshipStyle')}
            />
            <AppSelect
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
                    <ActivityIndicator size="small" color="#5BA8E8" />
                    <Text style={styles.readOnlyText}>Finding your location…</Text>
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

            <EditProfileSubsectionTitle>Work & education</EditProfileSubsectionTitle>
            <Field
              label="Occupation"
              value={asStr(draft.occupation)}
              onChangeText={setScalar('occupation')}
            />
            <AppSelect
              label="Education level"
              value={asStr(draft.educationLevel)}
              options={EDUCATION_LEVEL_CHOICES}
              onValueChange={setScalar('educationLevel')}
            />

            <EssentialsLifeDomainFields
              answers={lifeDomainAnswers}
              onChange={(domainId, questionId, value) => {
                setLifeDomainAnswers((prev) => ({
                  ...prev,
                  [domainId]: { ...(prev[domainId] ?? {}), [questionId]: value },
                }));
              }}
            />

            <EditProfileSubsectionTitle description={ONBOARDING_PROFILE_PROMPTS_SETUP_LEAD}>
              Profile prompts
            </EditProfileSubsectionTitle>
            <ProfilePromptsFields
              variant="editProfile"
              prompts={profilePrompts}
              onChange={(next) => {
                setProfilePrompts(next);
              }}
            />

            <EditProfileSubsectionTitle>Your archetypes</EditProfileSubsectionTitle>
            <ArchetypeSelector
              value={archetypeSelection}
              onChange={(next) => {
                setArchetypeSelection(next);
              }}
            />

            <EditProfileSubsectionTitle description={ONBOARDING_HOBBIES_DESCRIPTION}>
              Hobbies
            </EditProfileSubsectionTitle>
            <HobbiesFields
              variant="editProfile"
              hobbies={asStr(draft.hobbies)}
              onHobbiesChange={(hobbies) => {
                setDraft((d) => {
                  const ids = hobbiesStringToIds(hobbies);
                  const proId =
                    d.professionalHobbyId == null
                      ? null
                      : String(d.professionalHobbyId);
                  return {
                    ...d,
                    hobbies,
                    ...(proId && !ids.includes(proId) ? { professionalHobbyId: null } : null),
                  };
                });
              }}
            />
              </>
            ) : null}

            {activeTab === 'lifestyle' ? (
              <>
                <EditProfileTabHeader title="Lifestyle" saving={saving} />
            <EditProfileSubsectionTitle first description={ONBOARDING_HEIGHT_WEIGHT_NOTE}>
              Body & habits
            </EditProfileSubsectionTitle>
            <View style={styles.fieldBlock}>
              <HeightWeightInputFields
                heightCm={heightCmPick}
                weightKg={weightKgPick}
                onHeightCmChange={(cm) => {
                  setHeightCmPick(cm);
                }}
                onWeightKgChange={(kg) => {
                  setWeightKgPick(kg);
                }}
              />
            </View>
            <AppSelect
              label="Workout frequency"
              value={asStr(draft.workout)}
              options={workoutOptions}
              onValueChange={setScalar('workout')}
            />
            <AppSelect
              label="Smoking & vaping"
              value={asStr(draft.smoking)}
              options={smokingOptions}
              onValueChange={setScalar('smoking')}
            />
            <AppSelect
              label="What is your relationship with alcohol"
              value={asStr(draft.drinking)}
              options={drinkingOptions}
              onValueChange={setScalar('drinking')}
            />
            <AppSelect
              label="Do you use recreational drugs socially (MDMA, cocaine, etc)"
              value={asStr(draft.recreationalDrugsSocial)}
              options={recreationalDrugsSocialOptions}
              onValueChange={setScalar('recreationalDrugsSocial')}
            />
            <AppSelect
              label="What's your relationship with psychedelics or plant medicines?"
              value={asStr(draft.relationshipWithPsychedelics)}
              options={psychedelicsRelationshipOptions}
              onValueChange={setScalar('relationshipWithPsychedelics')}
            />
            <AppSelect
              label="What is your relationship with cannabis or tobacco?"
              value={asStr(draft.relationshipWithCannabis)}
              options={cannabisRelationshipOptions}
              onValueChange={setScalar('relationshipWithCannabis')}
            />

            <EditProfileSubsectionTitle>Values</EditProfileSubsectionTitle>
            <AppSelect
              label="Do you have kids?"
              value={asStr(draft.haveKids)}
              options={haveKidsOptions}
              onValueChange={setScalar('haveKids')}
            />
            <AppSelect
              label="Do you want children?"
              value={asStr(draft.wantKids)}
              options={wantChildrenYesNoOptions}
              onValueChange={setScalar('wantKids')}
            />
            <AppSelect
              label="Politics"
              value={asStr(draft.politics)}
              options={politicsOptions}
              onValueChange={setScalar('politics')}
            />
            <AppSelect
              label="Religion"
              value={asStr(draft.religion)}
              options={religionOptions}
              onValueChange={setScalar('religion')}
            />

            <EditProfileSubsectionTitle>Lifestyle preferences</EditProfileSubsectionTitle>
            <AppSelect
              label="Where do you see yourself living long term?"
              value={asStr(matchPrefs.longTermLivingPreference)}
              allowUnset
              options={PREF_LONG_TERM_LOCATION_OPTIONS.map((o) => ({
                label: o,
                value: o,
              }))}
              onValueChange={(v) => {
                setMatchPrefs((p) => ({ ...p, longTermLivingPreference: v }));
              }}
            />
            <AppSelect
              label="Which lifestyle feels most like you?"
              value={asStr(matchPrefs.lifestylePreference)}
              allowUnset
              options={PREF_LIFESTYLE_OPTIONS.map((o) => ({
                label: o,
                value: o,
              }))}
              onValueChange={(v) => {
                setMatchPrefs((p) => ({ ...p, lifestylePreference: v }));
              }}
            />
            <AppSelect
              label="Would you relocate for the right relationship?"
              value={asStr(matchPrefs.relocationPreference)}
              allowUnset
              options={PREF_RELOCATION_OPTIONS.map((o) => ({
                label: o,
                value: o,
              }))}
              onValueChange={(v) => {
                setMatchPrefs((p) => ({ ...p, relocationPreference: v }));
              }}
            />
              </>
            ) : null}

            {activeTab === 'compatibility' ? (
              <>
                <EditProfileTabHeader title="Compatibility" saving={saving} />
                <EditProfileSubsectionTitle
                  first
                  description={ONBOARDING_SEXUAL_COMPATIBILITY_LEAD}
                >
                  Sexual compatibility
                </EditProfileSubsectionTitle>
                <AppSelect
                  label="In a relationship, what feels like your natural rhythm for sex?"
                  value={asStr(draft.sexDrive)}
                  options={SEX_DRIVE_OPTIONS}
                  onValueChange={setScalar('sexDrive')}
                />
                <AppSelect
                  label="Sexual interests (select one)"
                  value={sexInterestSelected[0] ?? ''}
                  options={SEX_INTEREST_CATEGORY_OPTIONS}
                  onValueChange={(v) => {
                    setSexInterestSelected(v ? [v] : []);
                  }}
                />
                <AppSelect
                  label={RECENT_DATING_EARLY_WEEKS_QUESTION}
                  value={asStr(draft.recentDatingEarlyWeeks)}
                  options={RECENT_DATING_EARLY_WEEKS_OPTIONS}
                  onValueChange={setScalar('recentDatingEarlyWeeks')}
                />
                <AppSelect
                  label="How much space do you realistically have for a new relationship right now?"
                  value={asStr(draft.spaceForNewRelationship)}
                  options={SPACE_FOR_NEW_RELATIONSHIP_OPTIONS}
                  onValueChange={setScalar('spaceForNewRelationship')}
                />
                <AppSelect
                  label="When my partner is in the mood and I'm not, I generally..."
                  value={asStr(draft.partnerMoodMismatchResponse)}
                  options={PARTNER_MOOD_MISMATCH_RESPONSE_OPTIONS}
                  onValueChange={setScalar('partnerMoodMismatchResponse')}
                />
                <AppSelect
                  label="During sex, I'm more focused on..."
                  value={asStr(draft.sexualFocusPreference)}
                  options={SEXUAL_FOCUS_OPTIONS}
                  onValueChange={setScalar('sexualFocusPreference')}
                />
                <EditProfileSubsectionTitle description={ONBOARDING_DEALBREAKERS_LEAD}>
                  Dealbreakers
                </EditProfileSubsectionTitle>
                <MatchPreferencesEmbedded
                  location={asStr(draft.location)}
                  userAge={userAge}
                  matchPreferences={matchPrefs}
                  prefPartnerSharesSexualInterests={prefPartnerSharesSexualInterests}
                  prefPartnerHasChildren={prefPartnerHasChildren}
                  prefPartnerPoliticalAlignmentImportance={
                    prefPartnerPoliticalAlignmentImportance
                  }
                  afterAlcoholDealbreaker={
                    <HobbyDealbreakerField
                      hobbies={asStr(draft.hobbies)}
                      professionalHobbyId={
                        draft.professionalHobbyId == null
                          ? null
                          : String(draft.professionalHobbyId)
                      }
                      onProfessionalHobbyIdChange={(professionalHobbyId) => {
                        setDraft((d) => ({ ...d, professionalHobbyId }));
                      }}
                    />
                  }
                  onPreferencesPatch={onMatchEmbeddedPatch}
                />
              </>
            ) : null}

            {activeTab === 'deepDive' ? (
              <>
                <EditProfileTabHeader
                  title="Deep Dive"
                  lead={EDIT_PROFILE_DEEP_DIVE_LEAD}
                  saving={saving}
                />
                <EditProfileCompatibilityDeepDiveView
                  wantKids={asStr(draft.wantKids) || null}
                  lifeDomainsState={lifeDomainsState}
                  onLifeDomainsChange={(next) => {
                    setLifeDomainsState(next);
                  }}
                  lifeDomainAnswers={lifeDomainAnswers}
                  onLifeDomainAnswerChange={(domainId, questionId, value) => {
                    setLifeDomainAnswers((prev) => ({
                      ...prev,
                      [domainId]: { ...(prev[domainId] ?? {}), [questionId]: value },
                    }));
                  }}
                  lifeDomainsTotal={lifeDomainsTotal}
                  lifeDomainsSumOk={lifeDomainsSumOk}
                  openQuestionsDomainId={openLifeDomainQuestionsId}
                  onOpenQuestionsDomainIdChange={setOpenLifeDomainQuestionsId}
                  userId={effectiveUserId}
                />
                <EditProfileTypologyView
                  first={false}
                  value={resolvedTypologyValues}
                  onChange={(next) => {
                    setTypologyValues(next);
                  }}
                />
                {userId ? <EditProfileMyResultsView userId={userId} /> : null}
              </>
            ) : null}

        <Text style={styles.mutedSmall}>Signed in as {user?.email ?? '—'}</Text>
      </View>
      </ScrollView>
      <EditProfileTabBar active={activeTab} onChange={setActiveTab} />
      </View>
      )}
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  loadingText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: ep.colors.textSecondary,
    textAlign: 'center',
  },
  loadingError: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: ep.colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: ep.colors.buttonTintBg,
    borderWidth: 1,
    borderColor: ep.colors.buttonTintBorder,
  },
  retryButtonText: {
    fontFamily: FONT_UI,
    fontSize: 13,
    color: ep.colors.flameMid,
    letterSpacing: 0.3,
  },
  page: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  pageScroll: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    paddingTop: 12,
    paddingBottom: 48,
    ...Platform.select({
      web: { minHeight: 'auto' },
    }),
  },
  scrollColumn: {
    width: '100%',
    maxWidth: PAGE_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 22,
    ...Platform.select({
      web: { minHeight: 'auto' },
    }),
  },
  scrollWithTabBar: {
    paddingBottom: 24,
  },
  sectionIntro: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: ep.colors.textSecondary,
    marginBottom: 14,
  },
  h1: {
    fontFamily: FONT_DISPLAY,
    fontSize: 30,
    fontWeight: '600',
    color: ep.colors.textBright,
    marginBottom: 10,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  savingHint: {
    fontFamily: FONT_UI,
    fontSize: 13,
    color: ep.colors.textMuted,
  },
  lead: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: ep.colors.textSecondary,
    marginBottom: 20,
  },
  fieldBlock: { marginBottom: 14 },
  birthLocationSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  birthLocationSearchText: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: ep.colors.textDim,
  },
  birthLocationSuggestions: {
    marginTop: 4,
    marginBottom: 4,
    maxHeight: 220,
  },
  birthLocationSuggestionRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: ep.colors.glassBg,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: ep.colors.glassBorder,
  },
  birthLocationSuggestionText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: ep.colors.textPrimary,
    lineHeight: 20,
  },
  label: {
    fontFamily: FONT_BODY,
    color: ep.colors.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    fontFamily: FONT_BODY,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    color: ep.colors.textPrimary,
    backgroundColor: ep.colors.surfaceCard,
    borderWidth: 1,
    borderColor: ep.colors.borderSubtle,
    borderRadius: ep.spacing.inputRadius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  inputMultiline: { minHeight: 88, paddingTop: 12 },
  readOnlyBox: { justifyContent: 'center' },
  readOnlyText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: ep.colors.textPrimary,
  },
  locInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  choicePickerWrap: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  choicePicker: {
    width: '100%',
    color: ep.colors.textPrimary,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'ios'
      ? { height: 152 }
      : Platform.OS === 'android'
        ? { height: 56 }
        : {}),
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: ep.spacing.inputRadius,
    borderWidth: 1,
    borderColor: ep.colors.borderDefault,
    backgroundColor: ep.colors.surface,
  },
  chipOn: {
    borderColor: ep.colors.flameMid,
    backgroundColor: ep.colors.tipCardBg,
  },
  chipTxt: {
    fontFamily: FONT_UI,
    fontSize: 14,
    color: ep.colors.textSecondary,
  },
  chipTxtOn: {
    fontFamily: FONT_UI,
    color: ep.colors.flameBright,
    fontWeight: '600',
  },
  secondaryBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ep.colors.buttonTintBorder,
    backgroundColor: ep.colors.buttonTintBg,
  },
  secondaryBtnTxt: {
    fontFamily: FONT_UI,
    color: ep.colors.flameMid,
    fontSize: 13,
    fontWeight: '600',
  },
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
    backgroundColor: ep.colors.surfaceCard,
    borderWidth: 1,
    borderColor: ep.colors.borderSubtle,
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
    backgroundColor: ep.colors.surface,
    borderWidth: 2,
    borderColor: ep.colors.borderStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mutedSmall: {
    fontFamily: FONT_BODY,
    color: ep.colors.textDim,
    fontSize: 12,
    marginTop: 16,
  },
});
