import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const AvailabilityModal: React.FC<{
  slots: unknown[];
  onChange: (slots: unknown[]) => void;
}> = () => (
  <View style={styles.box}>
    <Text style={styles.h}>Availability calendar — stub (wire slots later).</Text>
  </View>
);

const styles = StyleSheet.create({
  box: { paddingVertical: 8 },
  h: { color: '#7A9ABE' },
});
