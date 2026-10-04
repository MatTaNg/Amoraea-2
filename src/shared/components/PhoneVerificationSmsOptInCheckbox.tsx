import React from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PHONE_VERIFICATION_SMS_OPT_IN_LABEL } from '@features/authentication/phoneVerificationSmsConsent';

export type PhoneVerificationSmsOptInCheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

/** Required one-time verification SMS consent. Must default to unchecked. */
export function PhoneVerificationSmsOptInCheckbox({
  checked,
  onChange,
  disabled = false,
}: PhoneVerificationSmsOptInCheckboxProps) {
  return (
    <Pressable
      onPress={() => {
        if (!disabled) onChange(!checked);
      }}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={PHONE_VERIFICATION_SMS_OPT_IN_LABEL}
      testID="register-sms-verification-opt-in"
      style={[styles.row, disabled && styles.rowDisabled]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={16} color="#EEF6FF" /> : null}
      </View>
      <Text style={styles.label}>{PHONE_VERIFICATION_SMS_OPT_IN_LABEL}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 0,
    marginBottom: 12,
    paddingVertical: 4,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
    backgroundColor: 'rgba(13,17,32,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  } satisfies ViewStyle,
  boxChecked: {
    backgroundColor: '#5BA8E8',
    borderColor: '#5BA8E8',
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: '300',
    color: '#7A9ABE',
    lineHeight: 18,
    letterSpacing: 0.2,
  } satisfies TextStyle,
});
