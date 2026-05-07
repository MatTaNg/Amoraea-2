import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const BasicFiltersSection: React.FC<{ title?: string }> = ({ title }) => (
  <View style={styles.box}>
    <Text style={styles.t}>{title ?? 'Basic preferences'}</Text>
    <Text style={styles.h}>Refine in a future iteration — fields wired to profile JSON.</Text>
  </View>
);

const styles = StyleSheet.create({
  box: { paddingVertical: 8 },
  t: { color: '#EEF6FF', fontWeight: '600', marginBottom: 6 },
  h: { color: '#7A9ABE', fontSize: 13 },
});
