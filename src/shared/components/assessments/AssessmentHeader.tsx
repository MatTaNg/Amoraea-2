import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const AssessmentHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <View style={styles.wrap}>
    <Text style={styles.t}>{title}</Text>
    {subtitle ? <Text style={styles.s}>{subtitle}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  t: { fontSize: 20, fontWeight: '600', color: '#EEF6FF' },
  s: { marginTop: 6, fontSize: 14, color: '#7A9ABE' },
});
