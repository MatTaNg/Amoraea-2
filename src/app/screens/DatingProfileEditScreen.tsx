import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Picker } from '@react-native-picker/picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { profilesRepo } from '@data/repos/profilesRepo';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { showSimpleAlert } from '@utilities/alerts/confirmDialog';
import { HeightCmPicker, HEIGHT_CM_MIN, HEIGHT_CM_MAX } from '@/shared/components/HeightCmPicker';
import { parseCmFromValue } from '@/shared/components/HeightSlider';
import { WeightInput } from '@/shared/components/WeightInput';
import {
  LifeDomainDistribution,
  DEFAULT_ONBOARDING_LIFE_DOMAINS,
  type OnboardingLifeDomainValues,
} from '@/shared/components/LifeDomainDistribution';
import {
  DATING_PACE_AFTER_EXCITEMENT_OPTIONS,
  RECENT_DATING_EARLY_WEEKS_OPTIONS,
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
import { EDUCATION_LEVEL_CHOICES, ETHNICITY_CHOICES, RELATIONSHIP_STYLE_CHOICES } from '@/screens/profile/editProfile/aboutYouOptions';
import {
  buildHeightWeightProfileFields,
  mapRelationshipStyleToUi,
  mapRelationshipStyleUiToDb,
  mapRelationshipStyleUiToRelationshipType,
} from '@/screens/profile/editProfile/editProfileService';
import { MatchPreferencesEmbedded } from '@/shared/components/profileFields/MatchPreferencesEmbedded';
import { TypologyPickerFields, type TypologyPickerValue } from '@/shared/components/profileFields/TypologyPickerFields';
import { TYPOLOGY_ONBOARDING_SECTIONS } from '@/shared/constants/typologyOnboardingOptions';
import { MatchPreferences } from '@/shared/hooks/filterPreferences/types';
import { mapGenderToDb, mapGenderToUi } from '@/shared/utils/genderMapper';
import { mapAttractionToDb, normalizeAttractedToUiLabels } from '@/shared/utils/attractionMapper';
import { calculateAgeFromBirthdate } from '@/shared/utils/ageCalculator';
import { requestMyLocationLabel } from '@/screens/profile/utils/locationHelpers';
import { theme } from '@/shared/theme/theme';
import { DatePicker } from '@/shared/components/DatePicker';
import {
  BirthTimeQuarterHourPicker,
  isValidOptionalBirthTime24h,
} from '@/shared/components/BirthTimeQuarterHourPicker';
import { OnboardingHeader } from '@ui/components/OnboardingHeader';

const BG = '#0a0a0f';
const MIN_PROFILE_AGE = 18;
const ACCENT = '#3b82f6';
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;
const KG_PER_LB = 2.2046;

const profilePhotoRepo = new ProfileRepository();

const GENDER_UI_OPTIONS = ['Man', 'Woman', 'Non-binary'] as const;

const ATTRACTION_UI = ['Men', 'Women', 'Non-binary'] as const;

const TYPOLOGY_KEYS = TYPOLOGY_ONBOARDING_SECTIONS.flatMap((s) => s.rows.map((r) => r.key));

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

function omitUndefined<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Record<string, unknown>;
}

function toTitleCaseUi(s: string): string {
  return s.replace(/[A-Za-z]+|[^A-Za-z]+/g, (seg) =>
    /^[A-Za-z]+$/.test(seg) ? seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase() : seg,
  );
}

function kgToLbsDisplay(kg: unknown): string {
  const n = typeof kg === 'number' ? kg : parseFloat(String(kg ?? ''));
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * KG_PER_LB * 10) / 10);
}

function lbsInputToKg(s: string): number | undefined {
  const n = parseFloat(s.trim());
  if (!Number.isFinite(n)) return undefined;
  return n / KG_PER_LB;
}

function parseFiniteNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseFloat(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseKgFromLabel(s: string): number | undefined {
  const m = s.trim().match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function parseLbsFromLabel(s: string): number | undefined {
  const m = s.trim().match(/(\d+(?:\.\d+)?)\s*lb/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

/** Modal onboarding often saves only `weightLabel` via `buildHeightWeightProfileFields` (no `weight_kg`), e.g. `"165"` without "lbs". */
function parseBareWeightLbsFromLabel(s: string): number | undefined {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

/** Merge onboarding + legacy shapes: `height_cm`, numeric `height` (cm), `heightLabel` / `"172 cm"` strings. */
function resolveHeightCmFromProfile(pb: Record<string, unknown>): number | undefined {
  const fromCm = parseFiniteNumber(pb.height_cm);
  if (fromCm != null && fromCm >= HEIGHT_CM_MIN && fromCm <= HEIGHT_CM_MAX) return Math.round(fromCm);

  const hNum = parseFiniteNumber(pb.height);
  if (hNum != null && hNum >= HEIGHT_CM_MIN && hNum <= HEIGHT_CM_MAX) return Math.round(hNum);

  for (const key of ['heightLabel', 'height_label'] as const) {
    const raw = pb[key];
    if (typeof raw === 'string' && raw.trim()) {
      const cm = parseCmFromValue(raw);
      if (cm != null) return cm;
    }
  }

  const hs = pb.height;
  if (typeof hs === 'string' && hs.trim()) {
    const cm = parseCmFromValue(hs);
    if (cm != null) return cm;
  }
  return undefined;
}

/** Merge `weight_kg`, numeric `weight` (kg from save path), `weightLabel`, or raw lbs string. */
function resolveWeightLbsStrFromProfile(pb: Record<string, unknown>): string {
  const kgDirect = parseFiniteNumber(pb.weight_kg ?? pb.weightKg);
  if (kgDirect != null && kgDirect > 12 && kgDirect < 500) return kgToLbsDisplay(kgDirect);

  const wNum = parseFiniteNumber(pb.weight);
  if (wNum != null && wNum > 12 && wNum < 500) return kgToLbsDisplay(wNum);

  for (const key of ['weightLabel', 'weight_label'] as const) {
    const raw = pb[key];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const lbs = parseLbsFromLabel(raw);
    if (lbs != null) return String(Math.round(lbs * 10) / 10);
    const kg = parseKgFromLabel(raw);
    if (kg != null) return kgToLbsDisplay(kg);
    const bareLbs = parseBareWeightLbsFromLabel(raw);
    if (bareLbs != null && bareLbs > 12 && bareLbs < 700) return String(Math.round(bareLbs * 10) / 10);
  }

  const ws = pb.weight;
  if (typeof ws === 'string' && ws.trim()) return ws.trim();

  return '';
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
      (t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'));
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

  const primaryPick = [pb.primary_photo_url, pb.primaryPhotoUrl, pb.avatar_url, pb.avatarUrl].find(
    (x): x is string => typeof x === 'string' && isRenderablePhotoUri(x),
  );
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

function normalizeLifeDomains(raw: unknown): OnboardingLifeDomainValues {
  const out: OnboardingLifeDomainValues = { ...DEFAULT_ONBOARDING_LIFE_DOMAINS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const o = raw as Record<string, unknown>;
  const pick = (key: keyof OnboardingLifeDomainValues, snake: string) => {
    const v = o[key] ?? o[snake];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = Math.round(v);
  };
  pick('intimacy', 'intimacy');
  pick('finance', 'finance');
  pick('spirituality', 'spirituality');
  pick('family', 'family');
  pick('physicalHealth', 'physical_health');
  return out;
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

async function resolvePhotoUrlsForSave(userId: string, urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i]?.trim();
    if (!u) continue;
    if (/^https?:\/\//i.test(u)) {
      out.push(u);
      continue;
    }
    const fn =
      u.split('/').pop()?.split('?')[0]?.replace(/[^a-zA-Z0-9._-]/g, '_') || `photo_${Date.now()}_${i}.jpg`;
    const { publicUrl } = await profilePhotoRepo.uploadPhoto(userId, u, fn);
    out.push(publicUrl);
  }
  return out;
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
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor="rgba(255,255,255,0.28)"
      />
    </View>
  );
}

function ChoiceDropdown({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onValueChange: (v: string) => void;
}) {
  const validSelection = value !== '' && options.some((o) => o.value === value);
  const selectedValue = validSelection ? value : (options[0]?.value ?? '');

  useLayoutEffect(() => {
    if (!options.length) return;
    if (!validSelection && options[0]) {
      onValueChange(options[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- coerce empty/unknown DB values once options exist; avoid churn from unstable callbacks
  }, [value, options, validSelection]);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickerShell}>
        <Picker
          selectedValue={selectedValue}
          onValueChange={(v) => onValueChange(String(v))}
          mode={Platform.OS === 'android' ? 'dropdown' : undefined}
          style={[
            styles.pickerNative,
            Platform.OS === 'web'
              ? [
                  styles.pickerWeb,
                  {
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  } as const,
                ]
              : null,
          ]}
          dropdownIconColor={theme.colors.textSecondary}
          itemStyle={Platform.OS === 'ios' ? { color: theme.colors.text, fontSize: 17 } : undefined}
        >
          {options.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} color={theme.colors.text} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

type InterviewPostInterviewNavigation = NativeStackNavigationProp<
  {
    PostInterviewPassed: { userId: string };
    DatingProfileOnboarding: { userId?: string };
    DatingProfileEdit: { userId: string };
  },
  'DatingProfileEdit'
>;

export const DatingProfileEditScreen: React.FC<{
  navigation: { goBack: () => void };
  route: { params: { userId: string } };
}> = ({ route }) => {
  const userId = route.params?.userId ?? '';
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const { user } = useAuth();

  const exitEditProfileToPostInterview = useCallback(() => {
    const uid = userId.trim();
    /** Mirror {@link ModalOnboardingScreen} exit: nested dating stack → interview stack → `PostInterviewPassed`. */
    const nestedNav = navigation.getParent?.();
    const interviewNav = nestedNav?.getParent?.() as InterviewPostInterviewNavigation | undefined;

    if (interviewNav?.canGoBack?.()) {
      interviewNav.goBack();
      return;
    }
    if (nestedNav?.canGoBack?.()) {
      nestedNav.goBack();
      return;
    }
    if (!uid) return;
    if (nestedNav?.navigate) {
      nestedNav.navigate('PostInterviewPassed', { userId: uid });
      return;
    }
    (navigation as unknown as InterviewPostInterviewNavigation).navigate('PostInterviewPassed', {
      userId: uid,
    });
  }, [navigation, userId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      header: () => (
        <OnboardingHeader variant="dark" onBackPress={exitEditProfileToPostInterview} />
      ),
    });
  }, [navigation, exitEditProfileToPostInterview]);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [attractedUi, setAttractedUi] = useState<string[]>([]);
  const [sexInterestSelected, setSexInterestSelected] = useState<string[]>([]);
  const [lifeDomainsState, setLifeDomainsState] = useState<OnboardingLifeDomainValues>({
    ...DEFAULT_ONBOARDING_LIFE_DOMAINS,
  });
  const [weightLbsStr, setWeightLbsStr] = useState('');
  const [heightCmPick, setHeightCmPick] = useState<number | undefined>(undefined);
  const [locationLoading, setLocationLoading] = useState(false);
  const [typologyValues, setTypologyValues] = useState<TypologyPickerValue>({});
  const [matchPrefs, setMatchPrefs] = useState<MatchPreferences>({});
  const [prefPhysicalCompatImportance, setPrefPhysicalCompatImportance] = useState('');
  const [prefPartnerSharesSexualInterests, setPrefPartnerSharesSexualInterests] = useState('');
  const [prefPartnerHasChildren, setPrefPartnerHasChildren] = useState('');
  const [prefPartnerPoliticalAlignmentImportance, setPrefPartnerPoliticalAlignmentImportance] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: profileBlob } = useQuery({
    queryKey: ['dating-profile', userId],
    queryFn: async () => {
      const r = await profilesRepo.getProfile(userId);
      if (!r.success) throw r.error;
      return r.data ?? {};
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!profileBlob) return;
    const pb = profileBlob as Record<string, unknown>;
    const resolvedPhotos = resolvePhotoUrlsFromProfile(pb);
    setPhotoUrls(resolvedPhotos);
    setDraft({ ...pb, photos: resolvedPhotos });
    setAttractedUi(normalizeAttractedToUiLabels(pb.attractedTo as string[] | undefined ?? pb.lookingFor as string[] | undefined));
    const rawSex = pb.sexInterestCategories;
    setSexInterestSelected(Array.isArray(rawSex) ? rawSex.map((x) => String(x)) : []);
    const ldRaw = pb.lifeDomains ?? pb.life_domains;
    setLifeDomainsState(normalizeLifeDomains(ldRaw));
    setWeightLbsStr(resolveWeightLbsStrFromProfile(pb));
    const hcResolved = resolveHeightCmFromProfile(pb);
    setHeightCmPick(hcResolved);
    setTypologyValues(profileToTypology(pb));
    setMatchPrefs((pb.matchPreferences as MatchPreferences) || {});
    setPrefPhysicalCompatImportance(asStr(pb.prefPhysicalCompatImportance));
    setPrefPartnerSharesSexualInterests(asStr(pb.prefPartnerSharesSexualInterests));
    setPrefPartnerHasChildren(asStr(pb.prefPartnerHasChildren));
    setPrefPartnerPoliticalAlignmentImportance(asStr(pb.prefPartnerPoliticalAlignmentImportance));
  }, [profileBlob]);

  const genderUiValue = mapGenderToUi(asStr(draft.gender)) ?? '';

  const relationshipStyleUi = mapRelationshipStyleToUi(asStr(draft.relationshipStyle));

  const userAge = useMemo(
    () => calculateAgeFromBirthdate(asStr(draft.birthDate)),
    [draft.birthDate],
  );

  const maxBirthYear = useMemo(() => new Date().getFullYear() - MIN_PROFILE_AGE, []);
  const birthDateStr = asStr(draft.birthDate);
  const birthAgeFromDraft = birthDateStr ? calculateAgeFromBirthdate(birthDateStr) : null;
  const birthDateError =
    birthAgeFromDraft != null && birthAgeFromDraft < MIN_PROFILE_AGE
      ? 'You must be 18 or older to use this app.'
      : undefined;

  const refreshLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const lab = await requestMyLocationLabel();
      if (lab?.trim()) {
        setDraft((d) => ({ ...d, location: lab.trim() }));
      }
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshLocation();
      if (userId) void qc.invalidateQueries({ queryKey: ['dating-profile', userId] });
    }, [refreshLocation, qc, userId]),
  );

  const setScalar = (key: string) => (t: string) => setDraft((d) => ({ ...d, [key]: t }));

  const onMatchEmbeddedPatch = useCallback(
    (patch: {
      matchPreferences?: MatchPreferences;
      prefPhysicalCompatImportance?: string;
      prefPartnerSharesSexualInterests?: string;
      prefPartnerHasChildren?: string;
      prefPartnerPoliticalAlignmentImportance?: string;
    }) => {
      if (patch.matchPreferences) setMatchPrefs(patch.matchPreferences);
      if (patch.prefPhysicalCompatImportance !== undefined)
        setPrefPhysicalCompatImportance(patch.prefPhysicalCompatImportance);
      if (patch.prefPartnerSharesSexualInterests !== undefined)
        setPrefPartnerSharesSexualInterests(patch.prefPartnerSharesSexualInterests);
      if (patch.prefPartnerHasChildren !== undefined) setPrefPartnerHasChildren(patch.prefPartnerHasChildren);
      if (patch.prefPartnerPoliticalAlignmentImportance !== undefined)
        setPrefPartnerPoliticalAlignmentImportance(patch.prefPartnerPoliticalAlignmentImportance);
    },
    [],
  );

  useEffect(() => {
    if ((sexInterestSelected?.length ?? 0) > 1) {
      setSexInterestSelected([sexInterestSelected[0]]);
    }
  }, [sexInterestSelected]);

  const pickPhotos = async () => {
    const remaining = Math.max(0, 6 - photoUrls.length);
    if (remaining <= 0 || !userId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showSimpleAlert('Permission Needed', 'Allow access to your photos so you can choose images from this device.');
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
    const picked = result.assets.slice(0, remaining).map((a) => a.uri.trim()).filter(Boolean);
    setPhotoUrls((prev) => {
      const seen = new Set(prev.map((x) => x.trim()));
      const next = [...prev];
      for (const u of picked) {
        if (!seen.has(u)) {
          seen.add(u);
          next.push(u);
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

  const onSave = async () => {
    if (!userId) return;

    const birthForAge = asStr(draft.birthDate);
    const ageSave = birthForAge ? calculateAgeFromBirthdate(birthForAge) : null;
    if (ageSave != null && ageSave < MIN_PROFILE_AGE) {
      showSimpleAlert('Age requirement', 'You must be 18 or older to use this app.');
      return;
    }

    const birthTimeRaw = asStr(draft.birthTime);
    if (!isValidOptionalBirthTime24h(birthTimeRaw)) {
      showSimpleAlert(
        'Birth time',
        'Use 24-hour format HH:MM (e.g. 09:05), choose from the list, or pick Not specified.',
      );
      return;
    }

    const { yearlyIncome: _yi, yearlyIncomeCurrency: _yc, ...draftClean } = draft as Record<string, unknown>;
    void _yi;
    void _yc;

    let resolvedPhotos = photoUrls;
    try {
      resolvedPhotos = await resolvePhotoUrlsForSave(userId, photoUrls);
    } catch (e) {
      if (__DEV__) console.warn('[DatingProfileEdit] photo upload', e);
      showSimpleAlert('Could Not Upload Photos', e instanceof Error ? e.message : 'Unknown error');
      return;
    }

    const wKg = lbsInputToKg(weightLbsStr);
    const hw = buildHeightWeightProfileFields({
      height_cm: heightCmPick,
      weight_kg: wKg,
    });

    const qaBase = { ...((draftClean.questionAnswers as Record<string, unknown>) || {}) };
    for (const key of TYPOLOGY_KEYS) {
      const v = typologyValues[key];
      if (v != null && String(v).trim()) qaBase[key] = String(v).trim();
      else delete qaBase[key];
    }

    const mappedAttraction = mapAttractionToDb(attractedUi) ?? attractedUi.filter((x) => ATTRACTION_UI.includes(x as (typeof ATTRACTION_UI)[number]));

    const next: Record<string, unknown> = { ...draftClean };
    for (const k of STRIP_FROM_SAVE) delete next[k];
    delete next.bio;
    delete next.yearlyIncome;
    delete next.yearlyIncomeCurrency;

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
      relationshipWithPsychedelics: asStr(draftClean.relationshipWithPsychedelics),
      relationshipWithCannabis: asStr(draftClean.relationshipWithCannabis),
      datingPaceAfterExcitement: asStr(draftClean.datingPaceAfterExcitement),
      recentDatingEarlyWeeks: asStr(draftClean.recentDatingEarlyWeeks),
    });

    if (hw.height != null) next.height = hw.height;
    if (hw.heightLabel != null) next.heightLabel = hw.heightLabel;
    if (hw.weight != null) next.weight = hw.weight;
    if (hw.weightLabel != null) next.weightLabel = hw.weightLabel;

    if (heightCmPick != null) next.height_cm = heightCmPick;
    if (wKg !== undefined) next.weight_kg = wKg;

    if (genderUiValue && mapGenderToDb(genderUiValue)) {
      next.gender = mapGenderToDb(genderUiValue);
    }

    if (relationshipStyleUi.trim()) {
      next.relationshipStyle = mapRelationshipStyleUiToDb(relationshipStyleUi);
      next.relationshipType = mapRelationshipStyleUiToRelationshipType(relationshipStyleUi);
    }

    const birth = asStr(next.birthDate);
    const calculatedAge = calculateAgeFromBirthdate(birth);
    if (calculatedAge != null) next.age = calculatedAge;

    if (typologyValues.myersBriggs?.trim()) next.myersBriggs = typologyValues.myersBriggs.trim();

    setSaving(true);
    try {
      const r = await profilesRepo.updateProfile(userId, omitUndefined(next));
      if (!r.success) throw r.error;
      setPhotoUrls(Array.isArray(resolvedPhotos) ? resolvedPhotos : []);
      await qc.invalidateQueries({ queryKey: ['dating-profile', userId] });
      await qc.invalidateQueries({ queryKey: ['profile', userId] });
    } catch (e) {
      if (__DEV__) console.warn('[DatingProfileEdit]', e);
      showSimpleAlert('Could Not Save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaContainer style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>{toTitleCaseUi('Your profile')}</Text>
        <Text style={styles.lead}>
          Same fields and choices as onboarding. Pick from the lists below — free typing is only where onboarding uses text (name, occupation, birth place).
        </Text>

        <Pressable onPress={() => void onSave()} disabled={saving || !userId} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnTxt}>{saving ? 'Saving…' : toTitleCaseUi('Save changes')}</Text>
        </Pressable>

        <SectionTitle>About you</SectionTitle>
        <Field label="Name" value={asStr(draft.displayName)} onChangeText={setScalar('displayName')} />
        <ChoiceDropdown
          label="Gender"
          value={genderUiValue}
          options={GENDER_UI_OPTIONS.map((g) => ({ label: g, value: g }))}
          onValueChange={(ui) =>
            setDraft((d) => ({
              ...d,
              gender: ui ? mapGenderToDb(ui) ?? ui : '',
            }))
          }
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
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{option}</Text>
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
            maxYear={maxBirthYear}
            error={birthDateError}
          />
        </View>
        <BirthTimeQuarterHourPicker
          label="Time of birth (optional)"
          value={asStr(draft.birthTime)}
          onValueChange={setScalar('birthTime')}
        />
        <Field
          label="Location of birth (optional)"
          value={asStr(draft.birthLocation)}
          onChangeText={setScalar('birthLocation')}
        />

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
                <Text style={styles.readOnlyText}>Finding your location…</Text>
              </View>
            ) : (
              <Text style={styles.readOnlyText}>{asStr(draft.location).trim() || '—'}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => void refreshLocation()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnTxt}>Refresh location</Text>
          </TouchableOpacity>
        </View>

        <SectionTitle>Work & education</SectionTitle>
        <Field label="Occupation" value={asStr(draft.occupation)} onChangeText={setScalar('occupation')} />
        <ChoiceDropdown
          label="Education level"
          value={asStr(draft.educationLevel)}
          options={EDUCATION_LEVEL_CHOICES}
          onValueChange={setScalar('educationLevel')}
        />

        <SectionTitle>Body & habits</SectionTitle>
        <View style={styles.fieldBlock}>
          <HeightCmPicker
            label="Height (cm)"
            valueCm={heightCmPick ?? null}
            onChangeCm={(cm) => setHeightCmPick(cm)}
            placeholderLabel="Select height"
          />
        </View>
        <View style={styles.fieldBlock}>
          <WeightInput label="Weight (lbs)" value={weightLbsStr} onChange={setWeightLbsStr} />
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

        <SectionTitle>Values</SectionTitle>
        <ChoiceDropdown label="Do you have kids?" value={asStr(draft.haveKids)} options={haveKidsOptions} onValueChange={setScalar('haveKids')} />
        <ChoiceDropdown label="Do you want children?" value={asStr(draft.wantKids)} options={wantChildrenYesNoOptions} onValueChange={setScalar('wantKids')} />
        <ChoiceDropdown label="Politics" value={asStr(draft.politics)} options={politicsOptions} onValueChange={setScalar('politics')} />
        <ChoiceDropdown label="Religion" value={asStr(draft.religion)} options={religionOptions} onValueChange={setScalar('religion')} />

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
          label="After the initial excitement of meeting someone, what pace feels most natural for you?"
          value={asStr(draft.datingPaceAfterExcitement)}
          options={DATING_PACE_AFTER_EXCITEMENT_OPTIONS}
          onValueChange={setScalar('datingPaceAfterExcitement')}
        />
        <ChoiceDropdown
          label="Think about your most recent dating experience. In the first 2–3 weeks, what actually happened?"
          value={asStr(draft.recentDatingEarlyWeeks)}
          options={RECENT_DATING_EARLY_WEEKS_OPTIONS}
          onValueChange={setScalar('recentDatingEarlyWeeks')}
        />

        <SectionTitle>Life domains</SectionTitle>
        <LifeDomainDistribution values={lifeDomainsState} onValuesChange={setLifeDomainsState} />

        <SectionTitle>Typology</SectionTitle>
        <TypologyPickerFields
          variant="onboarding"
          allowSkipOption={false}
          value={typologyValues}
          onTypologyChange={setTypologyValues}
        />

        <SectionTitle>Add your photos</SectionTitle>
        <View style={styles.photoGrid}>
          {photoUrls.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.photoContainer}>
              <ExpoImage source={{ uri }} style={styles.photo} contentFit="cover" />
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => {
                  setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
                }}
              >
                <Text style={styles.removePhotoText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {photoUrls.length < 6 && (
            <TouchableOpacity style={styles.addPhotoButton} onPress={() => void pickPhotos()} accessibilityRole="button">
              <Text style={styles.addPhotoGlyph}>+</Text>
            </TouchableOpacity>
          )}
        </View>

        <SectionTitle>Dealbreakers</SectionTitle>
        <MatchPreferencesEmbedded
          location={asStr(draft.location)}
          userAge={userAge}
          matchPreferences={matchPrefs}
          prefPhysicalCompatImportance={prefPhysicalCompatImportance}
          prefPartnerSharesSexualInterests={prefPartnerSharesSexualInterests}
          prefPartnerHasChildren={prefPartnerHasChildren}
          prefPartnerPoliticalAlignmentImportance={prefPartnerPoliticalAlignmentImportance}
          onPreferencesPatch={onMatchEmbeddedPatch}
        />

        <Pressable onPress={() => void onSave()} disabled={saving || !userId} style={[styles.primaryBtn, { marginTop: 8 }]}>
          <Text style={styles.primaryBtnTxt}>{saving ? 'Saving…' : toTitleCaseUi('Save changes')}</Text>
        </Pressable>

        <Text style={styles.mutedSmall}>Signed in as {user?.email ?? '—'}</Text>
      </ScrollView>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: 22, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },
  h1: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 26,
    fontWeight: '600',
    color: '#fafafa',
    marginBottom: 10,
  },
  lead: { fontFamily: FONT_BODY, fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.72)', marginBottom: 20 },
  sectionTitle: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 18,
    fontWeight: '600',
    color: '#e4e4e7',
    marginTop: 22,
    marginBottom: 12,
  },
  fieldBlock: { marginBottom: 14 },
  label: { color: '#9CB4D8', fontSize: 13, marginBottom: 8 },
  input: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: '#E8F0F8',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    minHeight: 44,
  },
  inputMultiline: { minHeight: 88, paddingTop: 12 },
  readOnlyBox: { justifyContent: 'center' },
  readOnlyText: { fontFamily: FONT_BODY, fontSize: 15, color: '#E8F0F8' },
  locInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  pickerNative: {
    width: '100%',
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    ...(Platform.OS === 'ios'
      ? { height: 160 }
      : Platform.OS === 'android'
        ? { height: 56 }
        : {}),
  },
  pickerWeb: {
    borderWidth: 0,
    outlineStyle: 'none',
    outlineWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 54,
    cursor: 'pointer' as const,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
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
  chipTxt: { fontFamily: FONT_BODY, fontSize: 14, color: 'rgba(255,255,255,0.82)' },
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
  addPhotoGlyph: { fontSize: 32, color: 'rgba(255,255,255,0.55)', fontWeight: '300' },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 15 },
  mutedSmall: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 16 },
});
