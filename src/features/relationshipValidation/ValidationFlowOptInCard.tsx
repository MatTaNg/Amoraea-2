import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { showSimpleAlert } from '@utilities/alerts/confirmDialog';
import { RELATIONSHIP_VALIDATION_TRACK } from '@features/relationshipValidation/constants';
import {
  enterValidationFlowFromStandardApp,
  fetchValidationShellRouting,
  isValidationStandardAppEnrolled,
  setValidationStandardReturnRoute,
  type ValidationShellRouting,
  type ValidationStandardReturnRoute,
} from '@features/relationshipValidation/validationShellRouting';

const ACCENT = '#3b82f6';
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type Props = {
  userId: string;
  returnRoute: ValidationStandardReturnRoute;
};

/**
 * Post-interview CTA for admin-enrolled users: opt into the RELATIONSHIP validation flow
 * without losing access to the standard application review screen.
 */
export function ValidationFlowOptInCard({ userId, returnRoute }: Props) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: routing, isLoading } = useQuery({
    queryKey: ['validationShellRouting', userId],
    queryFn: () => fetchValidationShellRouting(userId),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  if (!userId || isLoading || !isValidationStandardAppEnrolled(routing)) {
    return null;
  }

  const handleEnter = async () => {
    if (busy) return;
    setBusy(true);
    const routingKey = ['validationShellRouting', userId] as const;
    const previousRouting = queryClient.getQueryData<ValidationShellRouting>(routingKey);
    try {
      setValidationStandardReturnRoute(queryClient, userId, returnRoute);
      queryClient.setQueryData<ValidationShellRouting>(routingKey, (current) => ({
        track: current?.track ?? RELATIONSHIP_VALIDATION_TRACK,
        standardAppEnrolled: true,
        flowActive: true,
      }));
      await enterValidationFlowFromStandardApp(userId);
      await queryClient.refetchQueries({ queryKey: routingKey });
      await queryClient.invalidateQueries({ queryKey: ['validationTrack', userId] });
    } catch (error) {
      if (previousRouting) {
        queryClient.setQueryData(routingKey, previousRouting);
      } else {
        queryClient.removeQueries({ queryKey: routingKey });
      }
      const detail =
        error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      showSimpleAlert('Could not start comparison', detail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="people-outline" size={20} color={ACCENT} style={styles.headerIcon} />
        <Text style={styles.title}>Test compatibility with someone you know</Text>
      </View>
      <Text style={styles.body}>
        Compare your relationship profile with a partner&apos;s — questionnaires, psychometrics, and
        your existing AI interview results. Help us validate the algorithm before launch.
      </Text>
      <Pressable
        onPress={() => void handleEnter()}
        disabled={busy}
        style={[styles.button, busy && styles.buttonDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Start compatibility comparison"
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonLabel}>Start compatibility comparison</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 8,
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  title: {
    flex: 1,
    fontFamily: FONT_BODY,
    fontSize: 17,
    fontWeight: '600',
    color: '#f4f4f5',
    lineHeight: 24,
  },
  body: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 14,
  },
  button: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' as const },
    }),
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
