import React from 'react';
import { Text, StyleSheet } from 'react-native';

export const DietDropdown: React.FC<{ value: string; onChange: (v: string) => void }> = () => (
  <Text style={styles.h}>Diet (stub)</Text>
);

const styles = StyleSheet.create({ h: { color: '#7A9ABE', marginVertical: 8 } });
