import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';

export function AriaSessionExpiredScreen({
  onContinue,
}: {
  onContinue: () => void | Promise<void>;
}): React.ReactElement {
  return (
    <View style={styles.sessionExpiredOverlay}>
      <Text style={styles.sessionExpiredTitle}>Your session timed out.</Text>
      <Text style={styles.sessionExpiredBody}>
        Your progress has been saved. Sign back in and your interview will continue from where you left off.
      </Text>
      <Pressable onPress={() => void onContinue()} style={styles.sessionExpiredButton}>
        <Text style={styles.sessionExpiredButtonLabel}>Continue →</Text>
      </Pressable>
    </View>
  );
}
