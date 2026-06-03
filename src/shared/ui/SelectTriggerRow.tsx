import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

/** Strip accidental chevrons copied into stored labels. */
export function stripTrailingSelectChevron(label: string): string {
  return label.replace(/\s*[▾▼]\s*$/u, '').trim();
}

type SelectTriggerRowProps = {
  label: string;
  isPlaceholder?: boolean;
  showChevron?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  placeholderStyle?: StyleProp<TextStyle>;
  chevronStyle?: StyleProp<TextStyle>;
};

/** Web/custom dropdown trigger: value on the left, chevron aligned to the right edge. */
export const SelectTriggerRow: React.FC<SelectTriggerRowProps> = ({
  label,
  isPlaceholder,
  showChevron = true,
  labelStyle,
  placeholderStyle,
  chevronStyle,
}) => {
  const display = stripTrailingSelectChevron(label);
  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.label,
          isPlaceholder ? [styles.placeholder, placeholderStyle] : labelStyle,
        ]}
        numberOfLines={1}
      >
        {display}
      </Text>
      {showChevron ? (
        <Text style={[styles.chevron, chevronStyle]} accessibilityElementsHidden>
          ▾
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  label: {
    flex: 1,
    flexShrink: 1,
    color: '#E8F0F8',
    fontSize: 15,
    fontWeight: '500',
  },
  placeholder: {
    color: 'rgba(200,217,238,0.55)',
    fontWeight: '500',
  },
  chevron: {
    color: 'rgba(156,180,216,0.9)',
    fontSize: 14,
    paddingLeft: 10,
    flexShrink: 0,
  },
});
