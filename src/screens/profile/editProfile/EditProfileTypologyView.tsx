import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { TYPOLOGY_ONBOARDING_SECTIONS } from '@/shared/constants/typologyOnboardingOptions';
import type { TypologyPickerValue } from '@/shared/components/profileFields/TypologyPickerFields';
import {
  BottomSheet,
  OptionPickerTrigger,
  type OptionAnchor,
} from '@/screens/profile/editProfile/BottomSheet';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { EditProfileSubsectionTitle, EditProfileSection } from '@/screens/profile/editProfile/EditProfileUi';
import { ep } from '@/screens/profile/editProfile/editProfileTheme';
import { ONBOARDING_TYPOLOGY_DESCRIPTION } from '@/datingProfile/screens/onboarding/modals/onboardingStepCopy';

const PLACEHOLDER = '— Skip —';

export function countTypologyFieldsFilled(value: TypologyPickerValue): {
  filled: number;
  total: number;
} {
  const keys = TYPOLOGY_ONBOARDING_SECTIONS.flatMap((s) => s.rows.map((r) => r.key));
  let filled = 0;
  for (const key of keys) {
    const v = value[key];
    if (typeof v === 'string' && v.trim() !== '') filled += 1;
  }
  return { filled, total: keys.length };
}

function TypologyRowContent({
  label,
  value,
  filled,
}: {
  label: string;
  value: string | undefined;
  filled: boolean;
}) {
  return (
    <View style={styles.rowInner}>
      <View style={styles.rowText}>
        <Text style={[styles.fieldName, !filled && styles.fieldNameDim]}>{label}</Text>
        {filled ? (
          <Text style={styles.fieldValue} numberOfLines={2}>
            {value}
          </Text>
        ) : (
          <Text style={styles.addAffordance}>Add</Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </View>
  );
}

function TypologyFieldRow({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string | undefined;
  options: { label: string; value: string }[];
  onPick: (next: string) => void;
}) {
  const filled = typeof value === 'string' && value.trim() !== '';
  const [sheetAnchor, setSheetAnchor] = useState<OptionAnchor | null>(null);
  const [nativeSheetOpen, setNativeSheetOpen] = useState(false);
  const optionRows = [{ label: PLACEHOLDER, value: '' }, ...options];
  const selectedValue = filled ? value! : '';

  const openPicker = useCallback((anchor?: OptionAnchor) => {
    if (Platform.OS === 'web' && anchor) {
      setSheetAnchor(anchor);
      return;
    }
    setNativeSheetOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setSheetAnchor(null);
    setNativeSheetOpen(false);
  }, []);

  const sheetVisible = Platform.OS === 'web' ? !!sheetAnchor : nativeSheetOpen;
  const rowStyle = [styles.row, filled ? styles.rowFilled : styles.rowUnfilled];

  return (
    <>
      {Platform.OS === 'web' ? (
        <OptionPickerTrigger style={styles.webTriggerFill} onOpen={openPicker}>
          <View style={rowStyle}>
            <TypologyRowContent label={label} value={value} filled={filled} />
          </View>
        </OptionPickerTrigger>
      ) : (
        <Pressable
          onPress={() => openPicker()}
          style={({ pressed }) => [rowStyle, pressed && styles.rowPressed]}
          accessibilityRole="button"
        >
          <TypologyRowContent label={label} value={value} filled={filled} />
        </Pressable>
      )}
      <BottomSheet
        visible={sheetVisible}
        title={label}
        anchor={Platform.OS === 'web' ? sheetAnchor : null}
        onClose={closePicker}
      >
        <SingleChoiceOptionList
          options={optionRows}
          value={selectedValue}
          onSelect={(v) => {
            onPick(String(v));
            closePicker();
          }}
        />
      </BottomSheet>
    </>
  );
}

export function EditProfileTypologyView({
  value,
  onChange,
  first = true,
}: {
  value: TypologyPickerValue;
  onChange: (next: TypologyPickerValue) => void;
  first?: boolean;
}) {
  const setField = useCallback(
    (key: string, raw: string) => {
      if (raw === '') {
        onChange({ ...value, [key]: undefined });
        return;
      }
      onChange({ ...value, [key]: raw });
    },
    [onChange, value],
  );

  return (
    <View>
      <EditProfileSection first={first} title="Typology" description={ONBOARDING_TYPOLOGY_DESCRIPTION}>
      {TYPOLOGY_ONBOARDING_SECTIONS.map((section, idx) => (
        <View key={section.title} style={idx > 0 ? styles.sectionSpaced : undefined}>
          <EditProfileSubsectionTitle first={idx === 0}>{section.title}</EditProfileSubsectionTitle>
          {section.rows.map((row) => (
            <TypologyFieldRow
              key={row.key}
              label={row.label}
              value={value[row.key]}
              options={row.options}
              onPick={(next) => setField(row.key, next)}
            />
          ))}
        </View>
      ))}
      </EditProfileSection>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionSpaced: { marginTop: 8 },
  row: {
    borderRadius: ep.spacing.inputRadius,
    marginBottom: 10,
    overflow: 'hidden',
  },
  rowFilled: {
    backgroundColor: ep.colors.surfaceCard,
    borderWidth: 1,
    borderColor: ep.colors.borderSubtle,
  },
  rowUnfilled: {
    backgroundColor: ep.colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: ep.colors.borderStrong,
  },
  rowPressed: {
    opacity: 0.92,
  },
  webTriggerFill: { width: '100%' },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  rowText: { flex: 1, minWidth: 0 },
  fieldName: {
    fontFamily: ep.fonts.body,
    fontSize: 12,
    color: ep.colors.textSecondary,
    marginBottom: 4,
  },
  fieldNameDim: { color: ep.colors.textDim },
  fieldValue: {
    fontFamily: ep.fonts.body,
    fontSize: 15,
    color: ep.colors.textPrimary,
    lineHeight: 20,
  },
  addAffordance: {
    fontFamily: ep.fonts.ui,
    fontSize: 13,
    fontWeight: '600',
    color: ep.colors.flameMid,
  },
  chevron: {
    fontSize: 20,
    color: ep.colors.textSecondary,
  },
});
