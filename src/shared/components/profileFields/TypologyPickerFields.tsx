import React, { useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TYPOLOGY_ONBOARDING_SECTIONS } from '@/shared/constants/typologyOnboardingOptions';
import { theme } from '@/shared/theme/theme';
import { AppSelect } from '@/shared/ui/AppSelect';

export type TypologyPickerValue = Record<string, string | undefined>;

type Props = {
  value: TypologyPickerValue;
  onChange?: (v: TypologyPickerValue) => void;
  /** Alias used by onboarding modals */
  onTypologyChange?: (v: TypologyPickerValue) => void;
  /** Reserved for non-onboarding layouts */
  variant?: 'onboarding';
  /**
   * When false, omit the blank/skip row and coerce unset values to each row’s first option.
   * Prefer true for edit profile too — otherwise users who never completed typology see false “defaults”.
   */
  allowSkipOption?: boolean;
};

const PLACEHOLDER = '— Skip —';

export const TypologyPickerFields: React.FC<Props> = ({
  value,
  onChange,
  onTypologyChange,
  allowSkipOption = true,
}) => {
  const emit = onTypologyChange ?? onChange ?? (() => {});

  const setField = useCallback(
    (key: string, raw: string) => {
      if (raw === '' && allowSkipOption) {
        emit({ ...value, [key]: undefined });
        return;
      }
      if (raw === '') return;
      emit({ ...value, [key]: raw });
    },
    [allowSkipOption, emit, value],
  );

  useLayoutEffect(() => {
    if (allowSkipOption) return;
    const patch: Record<string, string> = {};
    for (const section of TYPOLOGY_ONBOARDING_SECTIONS) {
      for (const row of section.rows) {
        const s = typeof value[row.key] === 'string' ? value[row.key]! : '';
        const ok = row.options.some((o) => o.value === s);
        if (!ok && row.options[0]) patch[row.key] = row.options[0].value;
      }
    }
    if (Object.keys(patch).length === 0) return;
    emit({ ...value, ...patch });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emit identity changes each render; only depend on value and mode
  }, [allowSkipOption, value]);

  return (
    <View style={styles.col}>
      {TYPOLOGY_ONBOARDING_SECTIONS.map((section, sectionIndex) => (
        <View
          key={section.title}
          style={[styles.section, sectionIndex > 0 && styles.sectionAfterFirst]}
        >
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.rows.map((row) => {
            const raw = value[row.key] ?? '';
            const match = row.options.some((o) => o.value === raw);
            const selectedValue = allowSkipOption
              ? match
                ? raw
                : ''
              : match
                ? raw
                : (row.options[0]?.value ?? '');

            return (
              <AppSelect
                key={row.key}
                label={row.label}
                value={selectedValue}
                options={row.options}
                onValueChange={(next) => setField(row.key, next)}
                allowUnset={allowSkipOption}
                unsetLabel={PLACEHOLDER}
                placeholder={PLACEHOLDER}
                sheetTitle={row.label}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  col: { width: '100%' },
  section: {
    marginBottom: 8,
  },
  sectionAfterFirst: {
    marginTop: 22,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
});
