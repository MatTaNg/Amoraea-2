import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  ActivityIndicator,
} from 'react-native';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  loading?: boolean;
};

export const Button: React.FC<Props> = ({
  title,
  onPress,
  disabled,
  variant = 'solid',
  style,
  textStyle,
  loading,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || loading}
    style={({ pressed }) => [
      styles.base,
      variant === 'outline' ? styles.outline : styles.solid,
      (disabled || loading) && styles.disabled,
      pressed && styles.pressed,
      style,
    ]}
  >
    {loading ? (
      <ActivityIndicator color={variant === 'outline' ? '#5BA8E8' : '#fff'} />
    ) : (
      <Text style={[styles.label, variant === 'outline' && styles.labelOutline, textStyle]}>{title}</Text>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  solid: { backgroundColor: '#5BA8E8' },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.45)',
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.88 },
  label: { color: '#fff', fontSize: 16, fontWeight: '600' },
  labelOutline: { color: '#5BA8E8' },
});
