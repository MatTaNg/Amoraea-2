import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface SafeAreaContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
}

export const SafeAreaContainer: React.FC<SafeAreaContainerProps> = ({
  children,
  style,
  edges = ['top', 'left', 'right', 'bottom'],
}) => {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

