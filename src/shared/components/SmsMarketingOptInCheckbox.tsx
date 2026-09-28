import React from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SMS_MARKETING_OPT_IN_LABEL } from '@features/notifications/smsMarketingOptIn';

type SmsMarketingOptInCheckboxVariant = 'auth' | 'settings';

export type SmsMarketingOptInCheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  variant?: SmsMarketingOptInCheckboxVariant;
  disabled?: boolean;
};

/**
 * Optional SMS marketing / alerts consent. Always starts unchecked at signup.
 * Must never gate account creation.
 */
export function SmsMarketingOptInCheckbox({
  checked,
  onChange,
  variant = 'auth',
  disabled = false,
}: SmsMarketingOptInCheckboxProps) {
  const isSettings = variant === 'settings';
  return (
    <Pressable
      onPress={() => {
        if (!disabled) onChange(!checked);
      }}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={SMS_MARKETING_OPT_IN_LABEL}
      style={[styles.row, isSettings && styles.rowSettings, disabled && styles.rowDisabled]}
    >
      <View
        style={[
          styles.box,
          isSettings && styles.boxSettings,
          checked && (isSettings ? styles.boxCheckedSettings : styles.boxChecked),
        ]}
      >
        {checked ? (
          <Ionicons name="checkmark" size={16} color="#EEF6FF" />
        ) : null}
      </View>
      <Text style={[styles.label, isSettings && styles.labelSettings]}>{SMS_MARKETING_OPT_IN_LABEL}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  rowSettings: {
    marginTop: 0,
    marginBottom: 4,
    paddingVertical: 4,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(82,142,220,0.35)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  } satisfies ViewStyle,
  boxSettings: {
    borderColor: 'rgba(91,168,232,0.5)',
  },
  boxChecked: {
    backgroundColor: '#5BA8E8',
    borderColor: '#5BA8E8',
  },
  boxCheckedSettings: {
    backgroundColor: '#1E6FD9',
    borderColor: '#1E6FD9',
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: '300',
    color: '#7A9ABE',
    lineHeight: 17,
    letterSpacing: 0.2,
  } satisfies TextStyle,
  labelSettings: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 19,
  },
});
