import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  MatchPreferences,
  defaultPreferences,
} from '@/shared/hooks/filterPreferences/types';
import { RangeSlider } from '@/shared/ui/RangeSlider';
import { formControlStyles } from '@/shared/ui/FormField';
import { BodyTypeAttractionSelect } from '@/shared/components/BodyTypeAttractionSelect';
import {
  parseBodyTypeAttraction,
  type BodyTypeAttractionId,
} from '@/shared/constants/bodyTypeAttraction';
import {
  PREF_PARTNER_HAS_CHILDREN_OPTIONS,
  PREF_PARTNER_POLITICAL_SHARING_OPTIONS,
  PREF_PARTNER_SAME_RELIGION_OPTIONS,
  PREF_HEIGHT_DYNAMIC_OPTIONS,
  normalizePartnerPoliticalAlignmentToYesNo,
} from '@/screens/profile/editProfile/constants';
import { PARTNER_SUBSTANCE_ALIGNMENT_OPTIONS } from '@/shared/constants/filterOptions';
import {
  ETHNICITY_ATTRACTION_OPTIONS,
  ETHNICITY_ATTRACTION_OPEN_TO_ALL,
  normalizeEthnicityAttractionStored,
} from '@/shared/constants/ethnicityAttractionOptions';
import {
  PREF_PARTNER_SHARES_SEXUAL_INTERESTS_YES_NO,
  PREF_PARTNER_SHARES_SPECIFIC_SEX_INTERESTS_QUESTION,
  PREF_PARTNER_SPECIFIC_SEX_INTERESTS_SHEET_TITLE,
  prefPartnerSharesSexualInterestsFromYesNo,
  prefPartnerSharesSexualInterestsYesNoSelected,
  labelForPrefPartnerSharesSexualInterestsYesNoPicker,
} from '@/shared/constants/sexualCompatibilityOptions';
import {
  BottomSheet,
  OptionPickerTrigger,
  type OptionAnchor,
} from '@/screens/profile/editProfile/BottomSheet';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
type DealbreakerPreferences = MatchPreferences & {
  childrenPreference?: string;
  partnerAlignmentTobacco?: string;
  partnerAlignmentRecreationalDrugs?: string;
  partnerAlignmentPsychedelics?: string;
  partnerAlignmentCannabis?: string;
  partnerAlignmentAlcohol?: string;
  longTermLivingPreference?: string;
  lifestylePreference?: string;
  partnerSameReligionRequired?: string;
  relocationPreference?: string;
  heightDynamicPreference?: string;
};

const normalizeNoPreference = (value: unknown): string => {
  const v = String(value ?? '').trim();
  return v.toLowerCase() === 'any' ? 'No preference' : v;
};

const normalizeDealbreakerPreferences = (
  prefs: DealbreakerPreferences,
): DealbreakerPreferences => ({
  ...prefs,
  smokingPreference: normalizeNoPreference(prefs.smokingPreference),
  drinkingPreference: normalizeNoPreference(prefs.drinkingPreference),
  cannabisPreference: normalizeNoPreference(prefs.cannabisPreference),
  partnerAlignmentTobacco: normalizeNoPreference(prefs.partnerAlignmentTobacco),
  partnerAlignmentRecreationalDrugs: normalizeNoPreference(
    prefs.partnerAlignmentRecreationalDrugs,
  ),
  partnerAlignmentPsychedelics: normalizeNoPreference(
    prefs.partnerAlignmentPsychedelics,
  ),
  partnerAlignmentCannabis: normalizeNoPreference(
    prefs.partnerAlignmentCannabis,
  ),
  partnerAlignmentAlcohol: normalizeNoPreference(prefs.partnerAlignmentAlcohol),
});

function withoutRelationshipType(
  prefs: MatchPreferences | DealbreakerPreferences,
): DealbreakerPreferences {
  const { relationshipType: _, ...rest } = prefs as DealbreakerPreferences & {
    relationshipType?: string;
  };
  return rest as DealbreakerPreferences;
}

function truncDealbreaker(s: string, max = 80): string {
  const t = String(s ?? '').trim();
  if (!t) return 'Select';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function renderMustHaveHighlight(text: string) {
  const phrase = 'must have';
  const index = text.indexOf(phrase);
  if (index < 0) return text;

  return (
    <>
      {text.slice(0, index)}
      <Text style={styles.mustHaveEmphasis}>{phrase}</Text>
      {text.slice(index + phrase.length)}
    </>
  );
}

const SUBSTANCE_PARTNER_DEALBREAKERS: {
  key: keyof DealbreakerPreferences;
  question: string;
}[] = [
  {
    key: 'partnerAlignmentTobacco',
    question:
      'Is it a must have that your partner shares your relationship with cigarettes or vaping?',
  },
  {
    key: 'partnerAlignmentRecreationalDrugs',
    question:
      'Is it a must have that your partner shares your relationship with recreational drugs?',
  },
  {
    key: 'partnerAlignmentPsychedelics',
    question:
      'Is it a must have that your partner shares your relationship with psychedelics or plant medicines?',
  },
  {
    key: 'partnerAlignmentCannabis',
    question:
      'Is it a must have that your partner shares your relationship with cannabis or tobacco?',
  },
  {
    key: 'partnerAlignmentAlcohol',
    question:
      'Is it a must have that your partner shares your relationship with alcohol?',
  },
];

const LIFESTYLE_DEALBREAKERS: {
  key: keyof Pick<DealbreakerPreferences, 'partnerSameReligionRequired'>;
  question: string;
  options: readonly string[];
}[] = [
  {
    key: 'partnerSameReligionRequired',
    question:
      'Is it a must have for your partner to have the same religion as you?',
    options: PREF_PARTNER_SAME_RELIGION_OPTIONS,
  },
];

export type MatchPreferencesEmbeddedProps = {
  location?: string;
  userAge?: number | null;
  matchPreferences?: MatchPreferences | null;
  prefPartnerSharesSexualInterests: string;
  prefPartnerHasChildren: string;
  prefPartnerPoliticalAlignmentImportance: string;
  onPreferencesPatch: (patch: {
    matchPreferences?: DealbreakerPreferences;
    prefPartnerSharesSexualInterests?: string;
    prefPartnerHasChildren?: string;
    prefPartnerPoliticalAlignmentImportance?: string;
  }) => void;
};

export const MatchPreferencesEmbedded: React.FC<
  MatchPreferencesEmbeddedProps
> = ({
  location: _location,
  userAge,
  matchPreferences,
  prefPartnerSharesSexualInterests,
  prefPartnerHasChildren,
  prefPartnerPoliticalAlignmentImportance,
  onPreferencesPatch,
}) => {
  const defaultAgeMin = userAge != null ? Math.max(18, userAge - 5) : 18;
  const defaultAgeMax = userAge != null ? Math.min(100, userAge + 5) : 65;

  const [preferences, setPreferences] = useState<DealbreakerPreferences>(() => {
    const base = normalizeDealbreakerPreferences(
      withoutRelationshipType(
        (matchPreferences || defaultPreferences) as DealbreakerPreferences,
      ),
    );
    const baseAgeRange = Array.isArray(base.ageRange) ? base.ageRange : null;
    if (
      baseAgeRange &&
      baseAgeRange[0] === 18 &&
      baseAgeRange[1] === 65 &&
      userAge != null
    ) {
      return {
        ...base,
        ageRange: [defaultAgeMin, defaultAgeMax] as [number, number],
      };
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
      setPreferences(
        normalizeDealbreakerPreferences(
          withoutRelationshipType(matchPreferences),
        ),
      );
    }
  }, [matchPreferences]);

  const setPref = useCallback(
    (patch: Partial<DealbreakerPreferences>) => {
      setPreferences((prevPrefs) => {
        const newPrefs = { ...prevPrefs, ...patch };
        onPreferencesPatch({
          matchPreferences: withoutRelationshipType(newPrefs),
        });
        return newPrefs;
      });
    },
    [onPreferencesPatch],
  );

  const preferencesAgeRange = Array.isArray(preferences.ageRange)
    ? preferences.ageRange
    : null;
  const ageMin = preferencesAgeRange?.[0] ?? defaultAgeMin;
  const ageMax = preferencesAgeRange?.[1] ?? defaultAgeMax;

  const ethnicityAttraction = useMemo(
    () =>
      normalizeEthnicityAttractionStored(
        (preferences as Record<string, unknown>).ethnicityAttraction,
      ),
    [preferences],
  );

  const toggleEthnicityAttraction = useCallback(
    (option: string) => {
      if (option === ETHNICITY_ATTRACTION_OPEN_TO_ALL) {
        setPref({
          ethnicityAttraction: [ETHNICITY_ATTRACTION_OPEN_TO_ALL],
        } as Partial<DealbreakerPreferences>);
        return;
      }
      const withoutOpen = ethnicityAttraction.filter(
        (item) => item !== ETHNICITY_ATTRACTION_OPEN_TO_ALL,
      );
      const next = withoutOpen.includes(option)
        ? withoutOpen.filter((item) => item !== option)
        : [...withoutOpen, option];
      setPref({ ethnicityAttraction: next } as Partial<DealbreakerPreferences>);
    },
    [ethnicityAttraction, setPref],
  );

  const onBodyTypeAttractionChange = useCallback(
    (next: BodyTypeAttractionId[]) => {
      setPreferences((prevPrefs) => {
        const {
          bmiRange: _legacyBmi,
          bodyTypeAttraction: _bodyTypeAttraction,
          ...rest
        } = prevPrefs;
        const newPrefs: DealbreakerPreferences =
          next.length > 0 ? { ...rest, bodyTypeAttraction: next } : { ...rest };
        onPreferencesPatch({
          matchPreferences: withoutRelationshipType(newPrefs),
        });
        return newPrefs;
      });
    },
    [onPreferencesPatch],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLead}>
        Set dealbreakers the same way you did during onboarding.
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Age range</Text>
          <Text style={styles.rowValue}>
            {ageMin} - {ageMax}
          </Text>
          <RangeSlider
            minValue={18}
            maxValue={100}
            initialMinValue={ageMin}
            initialMaxValue={ageMax}
            step={1}
            onValueChange={(min, max) =>
              setPref({ ageRange: [min, max] as [number, number] })
            }
            minimumTrackTintColor="#7C3AED"
            maximumTrackTintColor="#32384A"
            showValueLabels={false}
          />
        </View>

        <Text style={styles.question}>
          {renderMustHaveHighlight(PREF_PARTNER_SHARES_SPECIFIC_SEX_INTERESTS_QUESTION)}
        </Text>
        <OptionPickerTrigger
          style={[styles.pickRow, formControlStyles.control]}
          onOpen={(anchor) =>
            setOptionSheet({
              title: PREF_PARTNER_SPECIFIC_SEX_INTERESTS_SHEET_TITLE,
              options: [...PREF_PARTNER_SHARES_SEXUAL_INTERESTS_YES_NO],
              selectedValue: prefPartnerSharesSexualInterestsYesNoSelected(prefPartnerSharesSexualInterests),
              anchor,
              onPick: (value) => {
                onPreferencesPatch({
                  prefPartnerSharesSexualInterests: prefPartnerSharesSexualInterestsFromYesNo(value),
                });
                setOptionSheet(null);
              },
            })
          }
        >
          <Text style={styles.pickText}>
            {labelForPrefPartnerSharesSexualInterestsYesNoPicker(prefPartnerSharesSexualInterests)}
          </Text>
        </OptionPickerTrigger>

        <Text style={styles.question}>
          Is it OK if your match already has children?
        </Text>
        <OptionPickerTrigger
          style={[styles.pickRow, formControlStyles.control]}
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
            {prefPartnerHasChildren.trim()
              ? truncDealbreaker(prefPartnerHasChildren)
              : 'No preference'}
          </Text>
        </OptionPickerTrigger>

        <Text style={styles.question}>
          {renderMustHaveHighlight(
            'Is it a must have that your partner shares the same political views as you?',
          )}
        </Text>
        <OptionPickerTrigger
          style={[styles.pickRow, formControlStyles.control]}
          onOpen={(anchor) =>
            setOptionSheet({
              title: 'Partner shares your political views',
              options: PREF_PARTNER_POLITICAL_SHARING_OPTIONS,
              selectedValue: prefPartnerPoliticalAlignmentImportance,
              anchor,
              onPick: (value) => {
                onPreferencesPatch({
                  prefPartnerPoliticalAlignmentImportance: value,
                });
                setOptionSheet(null);
              },
            })
          }
        >
          <Text style={styles.pickText}>
            {prefPartnerPoliticalAlignmentImportance.trim()
              ? truncDealbreaker(
                  normalizePartnerPoliticalAlignmentToYesNo(
                    prefPartnerPoliticalAlignmentImportance,
                  ),
                )
              : 'Select'}
          </Text>
        </OptionPickerTrigger>

        {LIFESTYLE_DEALBREAKERS.map(({ key, question, options }) => (
          <View key={key}>
            <Text style={styles.question}>
              {renderMustHaveHighlight(question)}
            </Text>
            <OptionPickerTrigger
              style={[styles.pickRow, formControlStyles.control]}
              onOpen={(anchor) =>
                setOptionSheet({
                  title: question,
                  options,
                  selectedValue: String(
                    (preferences as Record<string, unknown>)[key] ?? '',
                  ),
                  anchor,
                  onPick: (value) => {
                    setPref({
                      [key]: value,
                    } as Partial<DealbreakerPreferences>);
                    setOptionSheet(null);
                  },
                })
              }
            >
              <Text style={styles.pickText}>
                {String(
                  (preferences as Record<string, unknown>)[key] ?? '',
                ).trim()
                  ? truncDealbreaker(
                      String((preferences as Record<string, unknown>)[key]),
                    )
                  : 'Select'}
              </Text>
            </OptionPickerTrigger>
          </View>
        ))}

        {SUBSTANCE_PARTNER_DEALBREAKERS.map(({ key, question }) => (
          <View key={key}>
            <Text style={styles.question}>
              {renderMustHaveHighlight(question)}
            </Text>
            <OptionPickerTrigger
              style={[styles.pickRow, formControlStyles.control]}
              onOpen={(anchor) =>
                setOptionSheet({
                  title: question,
                  options: PARTNER_SUBSTANCE_ALIGNMENT_OPTIONS,
                  selectedValue: String(
                    (preferences as Record<string, unknown>)[key] ?? '',
                  ),
                  anchor,
                  onPick: (value) => {
                    setPref({
                      [key]: value,
                    } as Partial<DealbreakerPreferences>);
                    setOptionSheet(null);
                  },
                })
              }
            >
              <Text style={styles.pickText}>
                {String(
                  (preferences as Record<string, unknown>)[key] ?? '',
                ).trim()
                  ? truncDealbreaker(
                      String((preferences as Record<string, unknown>)[key]),
                    )
                  : 'Select'}
              </Text>
            </OptionPickerTrigger>
          </View>
        ))}

        <BodyTypeAttractionSelect
          value={parseBodyTypeAttraction(preferences.bodyTypeAttraction)}
          onChange={onBodyTypeAttractionChange}
        />

        <Text style={styles.question}>
          What height dynamic do you typically prefer?
        </Text>
        <OptionPickerTrigger
          style={[styles.pickRow, formControlStyles.control]}
          onOpen={(anchor) =>
            setOptionSheet({
              title: 'Height dynamic preference',
              options: PREF_HEIGHT_DYNAMIC_OPTIONS,
              selectedValue: String(preferences.heightDynamicPreference ?? ''),
              anchor,
              onPick: (value) => {
                setPref({ heightDynamicPreference: value });
                setOptionSheet(null);
              },
            })
          }
        >
          <Text style={styles.pickText}>
            {String(preferences.heightDynamicPreference ?? '').trim()
              ? truncDealbreaker(String(preferences.heightDynamicPreference))
              : 'Select'}
          </Text>
        </OptionPickerTrigger>

        <Text style={styles.question}>
          Which ethnicities are you generally attracted to?
        </Text>
        <Text style={styles.ethnicityHelper}>Select all that apply.</Text>
        <View style={styles.ethnicityOptionList}>
          {ETHNICITY_ATTRACTION_OPTIONS.map((option) => {
            const selected = ethnicityAttraction.includes(option);
            return (
              <Pressable
                key={option}
                style={[
                  styles.ethnicityOptionRow,
                  selected && styles.ethnicityOptionRowSelected,
                ]}
                onPress={() => toggleEthnicityAttraction(option)}
              >
                <Text
                  style={[
                    styles.ethnicityOptionText,
                    selected && styles.ethnicityOptionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <BottomSheet
        visible={!!optionSheet}
        title={optionSheet?.title}
        anchor={optionSheet?.anchor}
        onClose={() => setOptionSheet(null)}
      >
        {optionSheet ? (
          <SingleChoiceOptionList
            options={(optionSheet.options ?? []).map((o) => ({
              label: o,
              value: o,
            }))}
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
  mustHaveEmphasis: {
    fontWeight: '800',
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pickText: {
    color: '#E8F0F8',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    flex: 1,
  },
  ethnicityHelper: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
    marginBottom: 10,
  },
  ethnicityOptionList: {
    gap: 10,
    marginBottom: 8,
  },
  ethnicityOptionRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  ethnicityOptionRowSelected: {
    borderColor: 'rgba(82,142,220,0.25)',
    backgroundColor: 'rgba(91,168,232,0.2)',
  },
  ethnicityOptionText: {
    color: '#C8D9EE',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  ethnicityOptionTextSelected: {
    color: '#EEF6FF',
    fontWeight: '600',
  },
});
