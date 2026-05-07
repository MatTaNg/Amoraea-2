import React, { useState, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MatchPreferences, defaultPreferences } from '@/shared/hooks/filterPreferences/types';
import { RangeSlider } from '@/shared/ui/RangeSlider';
import { BodyTypeAttractionSelect } from '@/shared/components/BodyTypeAttractionSelect';
import { parseBodyTypeAttraction, type BodyTypeAttractionId } from '@/shared/constants/bodyTypeAttraction';
import {
  PREF_DEALBREAKER_CHILDREN_OPTIONS,
  PREF_DEALBREAKER_POLITICS_OPTIONS,
  PREF_DEALBREAKER_RELIGION_OPTIONS,
  PREF_PARTNER_HAS_CHILDREN_OPTIONS,
  PREF_PARTNER_POLITICAL_SHARING_OPTIONS,
  normalizePartnerPoliticalAlignmentToYesNo,
} from '@/screens/profile/editProfile/constants';
import { PARTNER_SUBSTANCE_ALIGNMENT_OPTIONS } from '@/shared/constants/filterOptions';
import {
  PREF_PHYSICAL_COMPAT_CENTRALITY_OPTIONS,
  PREF_PARTNER_SHARES_SEXUAL_INTERESTS_OPTIONS,
} from '@/shared/constants/sexualCompatibilityOptions';
import { BottomSheet, OptionPickerTrigger, type OptionAnchor } from '@/screens/profile/editProfile/BottomSheet';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
type DealbreakerPreferences = MatchPreferences & {
  childrenPreference?: string;
  partnerAlignmentTobacco?: string;
  partnerAlignmentRecreationalDrugs?: string;
  partnerAlignmentPsychedelics?: string;
  partnerAlignmentCannabis?: string;
  partnerAlignmentAlcohol?: string;
};

const normalizeNoPreference = (value: unknown): string => {
  const v = String(value ?? '').trim();
  return v.toLowerCase() === 'any' ? 'No preference' : v;
};

const normalizeDealbreakerPreferences = (prefs: DealbreakerPreferences): DealbreakerPreferences => ({
  ...prefs,
  smokingPreference: normalizeNoPreference(prefs.smokingPreference),
  drinkingPreference: normalizeNoPreference(prefs.drinkingPreference),
  cannabisPreference: normalizeNoPreference(prefs.cannabisPreference),
  partnerAlignmentTobacco: normalizeNoPreference(prefs.partnerAlignmentTobacco),
  partnerAlignmentRecreationalDrugs: normalizeNoPreference(prefs.partnerAlignmentRecreationalDrugs),
  partnerAlignmentPsychedelics: normalizeNoPreference(prefs.partnerAlignmentPsychedelics),
  partnerAlignmentCannabis: normalizeNoPreference(prefs.partnerAlignmentCannabis),
  partnerAlignmentAlcohol: normalizeNoPreference(prefs.partnerAlignmentAlcohol),
});

function withoutRelationshipType(prefs: MatchPreferences | DealbreakerPreferences): DealbreakerPreferences {
  const { relationshipType: _, ...rest } = prefs as DealbreakerPreferences & { relationshipType?: string };
  return rest as DealbreakerPreferences;
}

function truncDealbreaker(s: string, max = 80): string {
  const t = String(s ?? '').trim();
  if (!t) return 'Select';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

type EmbeddedDealbreakerOpt = { label: string; value: string };

/** Native picker styled like `DatingProfileEditScreen` `ChoiceDropdown` (no BottomSheet). */
function EmbeddedDealbreakerPicker({
  label,
  optionStrings,
  rawValue,
  onCommit,
  prependUnsetRow,
}: {
  label: string;
  optionStrings: readonly string[];
  rawValue: string;
  onCommit: (next: string) => void;
  prependUnsetRow?: boolean;
}) {
  const options: EmbeddedDealbreakerOpt[] = useMemo(() => {
    const rows = optionStrings.map((s) => ({ label: s, value: s }));
    if (prependUnsetRow) {
      return [{ label: 'No preference', value: '' }, ...rows];
    }
    return rows;
  }, [optionStrings, prependUnsetRow]);

  const storedTrimmed = String(rawValue ?? '').trim();
  const normalizedSelected =
    prependUnsetRow
      ? storedTrimmed
      : storedTrimmed === '' && optionStrings.includes('No preference')
        ? 'No preference'
        : storedTrimmed;

  const validSelection = options.some((o) => o.value === normalizedSelected);
  const selectedValue = validSelection ? normalizedSelected : (options[0]?.value ?? '');

  useLayoutEffect(() => {
    if (!options.length) return;
    if (!validSelection && options[0]) {
      onCommit(options[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- coerce legacy / unknown stored values once
  }, [rawValue, options, validSelection]);

  return (
    <View style={pickerStyles.fieldBlock}>
      <Text style={pickerStyles.label}>{label}</Text>
      <View style={pickerStyles.pickerShell}>
        <Picker
          selectedValue={selectedValue}
          onValueChange={(v) => onCommit(String(v))}
          mode={Platform.OS === 'android' ? 'dropdown' : undefined}
          style={[
            pickerStyles.pickerNative,
            Platform.OS === 'web'
              ? [
                  pickerStyles.pickerWeb,
                  {
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  } as const,
                ]
              : null,
          ]}
          dropdownIconColor="rgba(156,180,216,0.85)"
          itemStyle={Platform.OS === 'ios' ? { color: '#E8F0F8', fontSize: 17 } : undefined}
        >
          {options.map((o) => (
            <Picker.Item key={o.value === '' ? '__unset__' : o.value} label={o.label} value={o.value} color="#E8F0F8" />
          ))}
        </Picker>
      </View>
    </View>
  );
}

/** Match `styles.pickRow` / `OptionPickerTrigger` (lighter surface vs `theme.colors.card`). */
const pickerStyles = StyleSheet.create({
  fieldBlock: { marginBottom: 14, marginTop: 6 },
  label: { color: '#9CB4D8', fontSize: 13, marginBottom: 8 },
  pickerShell: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  pickerNative: {
    width: '100%',
    color: '#E8F0F8',
    backgroundColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'ios' ? { height: 160 } : Platform.OS === 'android' ? { height: 56 } : {}),
  },
  pickerWeb: {
    borderWidth: 0,
    outlineStyle: 'none',
    outlineWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 54,
    cursor: 'pointer' as const,
    color: '#E8F0F8',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});

const SUBSTANCE_PARTNER_DEALBREAKERS: { key: keyof DealbreakerPreferences; question: string }[] = [
  {
    key: 'partnerAlignmentTobacco',
    question:
      'How important is it that your partner shares your relationship with cigarettes or tobacco?',
  },
  {
    key: 'partnerAlignmentRecreationalDrugs',
    question:
      'How important is it that your partner shares your relationship with recreational drugs?',
  },
  {
    key: 'partnerAlignmentPsychedelics',
    question:
      'How important is it that your partner shares your relationship with psychedelics or plant medicines?',
  },
  {
    key: 'partnerAlignmentCannabis',
    question: 'How important is it that your partner shares your relationship with cannabis?',
  },
  {
    key: 'partnerAlignmentAlcohol',
    question: 'How important is it that your partner shares your relationship with alcohol?',
  },
];

export type MatchPreferencesEmbeddedProps = {
  location?: string;
  userAge?: number | null;
  matchPreferences?: MatchPreferences | null;
  prefPhysicalCompatImportance: string;
  prefPartnerSharesSexualInterests: string;
  prefPartnerHasChildren: string;
  prefPartnerPoliticalAlignmentImportance: string;
  onPreferencesPatch: (patch: {
    matchPreferences?: DealbreakerPreferences;
    prefPhysicalCompatImportance?: string;
    prefPartnerSharesSexualInterests?: string;
    prefPartnerHasChildren?: string;
    prefPartnerPoliticalAlignmentImportance?: string;
  }) => void;
};

export const MatchPreferencesEmbedded: React.FC<MatchPreferencesEmbeddedProps> = ({
  location: _location,
  userAge,
  matchPreferences,
  prefPhysicalCompatImportance,
  prefPartnerSharesSexualInterests,
  prefPartnerHasChildren,
  prefPartnerPoliticalAlignmentImportance,
  onPreferencesPatch,
}) => {
  const defaultAgeMin = userAge != null ? Math.max(18, userAge - 5) : 18;
  const defaultAgeMax = userAge != null ? Math.min(100, userAge + 5) : 65;

  const [preferences, setPreferences] = useState<DealbreakerPreferences>(() => {
    const base = normalizeDealbreakerPreferences(
      withoutRelationshipType((matchPreferences || defaultPreferences) as DealbreakerPreferences),
    );
    if (base.ageRange && base.ageRange[0] === 18 && base.ageRange[1] === 65 && userAge != null) {
      return { ...base, ageRange: [defaultAgeMin, defaultAgeMax] as [number, number] };
    }
    return base;
  });

  const [optionSheet, setOptionSheet] = useState<{
    title: string;
    options: readonly string[] | string[];
    selectedValue: string;
    onPick: (value: string) => void;
    anchor?: OptionAnchor;
  } | null>(null);

  useEffect(() => {
    if (matchPreferences) {
      setPreferences(normalizeDealbreakerPreferences(withoutRelationshipType(matchPreferences)));
    }
  }, [matchPreferences]);

  const setPref = useCallback(
    (patch: Partial<DealbreakerPreferences>) => {
      setPreferences((prevPrefs) => {
        const newPrefs = { ...prevPrefs, ...patch };
        onPreferencesPatch({ matchPreferences: withoutRelationshipType(newPrefs) });
        return newPrefs;
      });
    },
    [onPreferencesPatch],
  );

  const ageMin = preferences.ageRange?.[0] != null ? String(preferences.ageRange[0]) : '';
  const ageMax = preferences.ageRange?.[1] != null ? String(preferences.ageRange[1]) : '';

  const onBodyTypeAttractionChange = useCallback(
    (next: BodyTypeAttractionId[]) => {
      setPreferences((prevPrefs) => {
        const { bmiRange: _legacyBmi, ...rest } = prevPrefs;
        const newPrefs: DealbreakerPreferences =
          next.length > 0 ? { ...rest, bodyTypeAttraction: next } : { ...rest };
        onPreferencesPatch({ matchPreferences: withoutRelationshipType(newPrefs) });
        return newPrefs;
      });
    },
    [onPreferencesPatch],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLead}>Set dealbreakers the same way you did during onboarding.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Age range</Text>
          <Text style={styles.rowValue}>
            {ageMin} - {ageMax}
          </Text>
          <RangeSlider
            minValue={18}
            maxValue={100}
            initialMinValue={preferences.ageRange?.[0] ?? defaultAgeMin}
            initialMaxValue={preferences.ageRange?.[1] ?? defaultAgeMax}
            step={1}
            onValueChange={(min, max) => setPref({ ageRange: [min, max] as [number, number] })}
            minimumTrackTintColor="#7C3AED"
            maximumTrackTintColor="#32384A"
          />
        </View>

        <Text style={styles.question}>How central is physical and sexual compatibility for you in a relationship?</Text>
        <OptionPickerTrigger
          style={styles.pickRow}
          onOpen={(anchor) =>
            setOptionSheet({
              title: 'Physical & sexual compatibility',
              options: PREF_PHYSICAL_COMPAT_CENTRALITY_OPTIONS as unknown as string[],
              selectedValue: prefPhysicalCompatImportance,
              anchor,
              onPick: (value) => {
                onPreferencesPatch({ prefPhysicalCompatImportance: value });
                setOptionSheet(null);
              },
            })
          }
        >
          <Text style={styles.pickText}>{truncDealbreaker(prefPhysicalCompatImportance)}</Text>
        </OptionPickerTrigger>

        <Text style={styles.question}>Do you want someone who shares your specific sexual interests?</Text>
        <OptionPickerTrigger
          style={styles.pickRow}
          onOpen={(anchor) =>
            setOptionSheet({
              title: 'Partner shares your interests',
              options: PREF_PARTNER_SHARES_SEXUAL_INTERESTS_OPTIONS as unknown as string[],
              selectedValue: prefPartnerSharesSexualInterests,
              anchor,
              onPick: (value) => {
                onPreferencesPatch({ prefPartnerSharesSexualInterests: value });
                setOptionSheet(null);
              },
            })
          }
        >
          <Text style={styles.pickText}>{truncDealbreaker(prefPartnerSharesSexualInterests)}</Text>
        </OptionPickerTrigger>

        <Text style={styles.question}>Is it OK if your match already has children?</Text>
        <OptionPickerTrigger
          style={styles.pickRow}
          onOpen={(anchor) =>
            setOptionSheet({
              title: 'Partner already has children',
              options: PREF_PARTNER_HAS_CHILDREN_OPTIONS,
              selectedValue: prefPartnerHasChildren,
              anchor,
              onPick: (value) => {
                onPreferencesPatch({ prefPartnerHasChildren: value });
                setOptionSheet(null);
              },
            })
          }
        >
          <Text style={styles.pickText}>
            {prefPartnerHasChildren.trim() ? truncDealbreaker(prefPartnerHasChildren) : 'No preference'}
          </Text>
        </OptionPickerTrigger>

        <Text style={styles.question}>Is it important for your partner to share the same political views as you?</Text>
        <OptionPickerTrigger
          style={styles.pickRow}
          onOpen={(anchor) =>
            setOptionSheet({
              title: 'Partner shares your political views',
              options: PREF_PARTNER_POLITICAL_SHARING_OPTIONS,
              selectedValue: prefPartnerPoliticalAlignmentImportance,
              anchor,
              onPick: (value) => {
                onPreferencesPatch({ prefPartnerPoliticalAlignmentImportance: value });
                setOptionSheet(null);
              },
            })
          }
        >
          <Text style={styles.pickText}>
            {prefPartnerPoliticalAlignmentImportance.trim()
              ? truncDealbreaker(
                  normalizePartnerPoliticalAlignmentToYesNo(prefPartnerPoliticalAlignmentImportance),
                )
              : 'Select'}
          </Text>
        </OptionPickerTrigger>

        {SUBSTANCE_PARTNER_DEALBREAKERS.map(({ key, question }) => (
          <View key={key}>
            <Text style={styles.question}>{question}</Text>
            <OptionPickerTrigger
              style={styles.pickRow}
              onOpen={(anchor) =>
                setOptionSheet({
                  title: question,
                  options: PARTNER_SUBSTANCE_ALIGNMENT_OPTIONS,
                  selectedValue: String((preferences as Record<string, unknown>)[key] ?? ''),
                  anchor,
                  onPick: (value) => {
                    setPref({ [key]: value } as Partial<DealbreakerPreferences>);
                    setOptionSheet(null);
                  },
                })
              }
            >
              <Text style={styles.pickText}>
                {String((preferences as Record<string, unknown>)[key] ?? '').trim()
                  ? truncDealbreaker(String((preferences as Record<string, unknown>)[key]))
                  : 'Select'}
              </Text>
            </OptionPickerTrigger>
          </View>
        ))}

        <BodyTypeAttractionSelect
          value={parseBodyTypeAttraction(preferences.bodyTypeAttraction)}
          onChange={onBodyTypeAttractionChange}
        />

        <EmbeddedDealbreakerPicker
          label="Partner wants children"
          optionStrings={PREF_DEALBREAKER_CHILDREN_OPTIONS}
          rawValue={String((preferences as Record<string, unknown>).childrenPreference ?? '')}
          prependUnsetRow
          onCommit={(next) => setPref({ childrenPreference: next } as Partial<DealbreakerPreferences>)}
        />
        <EmbeddedDealbreakerPicker
          label="Politics"
          optionStrings={PREF_DEALBREAKER_POLITICS_OPTIONS}
          rawValue={String((preferences as Record<string, unknown>).politicsPreference ?? '')}
          onCommit={(next) => setPref({ politicsPreference: next } as Partial<DealbreakerPreferences>)}
        />
        <EmbeddedDealbreakerPicker
          label="Religion"
          optionStrings={PREF_DEALBREAKER_RELIGION_OPTIONS}
          rawValue={String((preferences as Record<string, unknown>).religionPreference ?? '')}
          onCommit={(next) => setPref({ religionPreference: next } as Partial<DealbreakerPreferences>)}
        />
      </View>

      <BottomSheet visible={!!optionSheet} title={optionSheet?.title} anchor={optionSheet?.anchor} onClose={() => setOptionSheet(null)}>
        {optionSheet ? (
          <SingleChoiceOptionList
            options={(optionSheet.options ?? []).map((o) => ({ label: o, value: o }))}
            value={optionSheet.selectedValue}
            onSelect={(v) => {
              optionSheet.onPick(v);
              setOptionSheet(null);
            }}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  sectionLead: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.62)',
    marginBottom: 12,
    lineHeight: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    gap: 6,
  },
  row: { marginBottom: 12 },
  rowLabel: { color: '#C8D9EE', fontSize: 14, fontWeight: '600', flex: 1 },
  rowValue: { color: '#E8F0F8', fontSize: 13, marginBottom: 6 },
  question: {
    color: '#9CB4D8',
    fontSize: 13,
    marginTop: 10,
    marginBottom: 8,
    lineHeight: 18,
  },
  pickRow: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 4,
  },
  pickText: { color: '#E8F0F8', fontSize: 15 },
});
