import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { ProfilePromptAnswer } from '@domain/models/Profile';
import { getPromptById } from '@/features/profile/profilePromptsLibrary';
import { theme } from '@/shared/theme/theme';

const FONT_BODY =
  Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

export type ProfilePromptsDisplayProps = {
  prompts: ProfilePromptAnswer[];
};

/** Read-only profile prompts — question large, answer smaller (no photo overlay). */
export const ProfilePromptsDisplay: React.FC<ProfilePromptsDisplayProps> = ({ prompts }) => {
  if (!prompts.length) return null;

  return (
    <View style={styles.root}>
      {prompts.map((row, index) => {
        const prompt = getPromptById(row.promptId);
        return (
          <View key={`${row.promptId}-${index}`} style={styles.block}>
            <Text style={styles.question}>{prompt?.text ?? row.promptId}</Text>
            <Text style={styles.answer}>{row.answer}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 20 },
  block: { gap: 6 },
  question: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    color: theme.colors.text,
    fontFamily: FONT_BODY,
  },
  answer: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    fontFamily: FONT_BODY,
  },
});
