import React from 'react';
import { Text, StyleSheet } from 'react-native';

export const IncomeDropdown: React.FC<{ value: string; onChange: (v: string) => void }> = () => (
  <Text style={styles.h}>Income (stub)</Text>
);

const styles = StyleSheet.create({ h: { color: '#7A9ABE', marginVertical: 8 } });
