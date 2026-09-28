import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSmsMarketingOptIn,
  updateSmsMarketingOptIn,
} from '@data/repos/smsMarketingOptInRepo';
import { SmsMarketingOptInCheckbox } from '@/shared/components/SmsMarketingOptInCheckbox';

export const smsMarketingOptInQueryKey = (userId: string) =>
  ['sms-marketing-opt-in', userId] as const;

export function SmsMarketingOptInSettingsField({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: smsMarketingOptInQueryKey(userId),
    queryFn: () => fetchSmsMarketingOptIn(userId),
    enabled: Boolean(userId),
  });
  const mutation = useMutation({
    mutationFn: (next: boolean) => updateSmsMarketingOptIn(userId, next),
    onMutate: async (next) => {
      setSaveError(null);
      await qc.cancelQueries({ queryKey: smsMarketingOptInQueryKey(userId) });
      const previous = qc.getQueryData<boolean>(smsMarketingOptInQueryKey(userId));
      qc.setQueryData(smsMarketingOptInQueryKey(userId), next);
      return { previous };
    },
    onError: (err, _next, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(smsMarketingOptInQueryKey(userId), ctx.previous);
      }
      setSaveError(err instanceof Error ? err.message : 'Could not update SMS preference.');
    },
    onSuccess: ( _data, next) => {
      qc.setQueryData(smsMarketingOptInQueryKey(userId), next);
    },
  });

  const onChange = useCallback(
    (next: boolean) => {
      mutation.mutate(next);
    },
    [mutation],
  );

  if (query.isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color="#5BA8E8" />
      </View>
    );
  }

  return (
    <View>
      <SmsMarketingOptInCheckbox
        checked={query.data === true}
        onChange={onChange}
        variant="settings"
        disabled={mutation.isPending}
      />
      {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  error: {
    color: '#E87A7A',
    fontSize: 12,
    marginTop: 4,
  },
});
