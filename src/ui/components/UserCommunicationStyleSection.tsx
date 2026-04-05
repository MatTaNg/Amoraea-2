/**
 * User-facing communication style labels (interview results). Polls until primary labels exist.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@data/supabase/client';
import { STYLE_LABEL_TOOLTIPS } from '@utilities/styleTranslations';
import { runCommunicationStylePipelineAfterSave } from '@utilities/runCommunicationStylePipeline';

const POLL_MS = 3000;

type ProfileRow = {
  style_labels_primary: string[] | null;
  style_labels_secondary: string[] | null;
  audio_confidence: number | null;
};

function formatStyleLabelHeading(raw: string): string {
  if (!raw?.trim()) return raw;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function tooltipForLabel(labelKey: string): string | undefined {
  const direct = STYLE_LABEL_TOOLTIPS[labelKey as keyof typeof STYLE_LABEL_TOOLTIPS];
  if (direct) return direct;
  const lower = labelKey.toLowerCase();
  const keys = Object.keys(STYLE_LABEL_TOOLTIPS) as string[];
  const match = keys.find((k) => k.toLowerCase() === lower);
  return match ? STYLE_LABEL_TOOLTIPS[match as keyof typeof STYLE_LABEL_TOOLTIPS] : undefined;
}

function parseAudioConfidence(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function UserCommunicationStyleSection({ userId }: { userId: string | null | undefined }) {
  const [profile, setProfile] = useState<ProfileRow | null | undefined>(undefined);
  const styleBackfillStartedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setProfile(undefined);
      return;
    }

    setProfile(undefined);
    styleBackfillStartedRef.current = false;
    let cancelled = false;
    const intervalRef: { current: ReturnType<typeof setInterval> | null } = { current: null };

    const load = async () => {
      const { data } = await supabase
        .from('communication_style_profiles')
        .select('style_labels_primary, style_labels_secondary, audio_confidence')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (!data) {
        if (!styleBackfillStartedRef.current) {
          styleBackfillStartedRef.current = true;
          void (async () => {
            const { data: urow } = await supabase
              .from('users')
              .select('latest_attempt_id, interview_completed')
              .eq('id', userId)
              .maybeSingle();
            const aid = typeof urow?.latest_attempt_id === 'string' ? urow.latest_attempt_id.trim() : '';
            if (!urow?.interview_completed || !aid) return;
            await runCommunicationStylePipelineAfterSave(userId, aid, '');
          })();
        }
        setProfile(null);
        return;
      }

      const mapped: ProfileRow = {
        style_labels_primary: (data.style_labels_primary as string[] | null) ?? null,
        style_labels_secondary: (data.style_labels_secondary as string[] | null) ?? null,
        audio_confidence: parseAudioConfidence(data.audio_confidence),
      };
      setProfile(mapped);

      const prim = mapped.style_labels_primary?.filter(Boolean) ?? [];
      if (prim.length > 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    void load();
    intervalRef.current = setInterval(() => void load(), POLL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);

  if (!userId) return null;

  const primary = profile?.style_labels_primary?.filter(Boolean) ?? [];
  const secondary = profile?.style_labels_secondary?.filter(Boolean) ?? [];
  const ac = profile?.audio_confidence ?? null;
  const hasPrimary = primary.length > 0;

  const showLoading =
    profile === undefined || profile === null || (profile !== undefined && profile !== null && !hasPrimary);

  let audioCaveat: string | null = null;
  if (hasPrimary) {
    if (ac == null || ac < 0.4) {
      audioCaveat =
        'Some style dimensions reflect your written responses only — audio analysis was unavailable for this session.';
    } else if (ac >= 0.4 && ac <= 0.7) {
      audioCaveat = 'Audio analysis is based on a partial session.';
    }
  }

  const showProcessingCopy = profile !== undefined && profile !== null && !hasPrimary;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionTitle}>How you communicate</Text>

      {showLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#5BA8E8" />
          <Text style={styles.loadingText}>
            {showProcessingCopy ? 'Still processing your communication style.' : 'Loading your communication style…'}
          </Text>
        </View>
      ) : (
        <>
          {primary.map((labelKey) => {
            const tip = tooltipForLabel(labelKey);
            return (
              <View key={labelKey} style={styles.constructCard}>
                <View style={styles.constructCardHeader}>
                  <View style={styles.constructCardHeaderLeft}>
                    <Text style={styles.constructCardTitle}>{formatStyleLabelHeading(labelKey)}</Text>
                    {tip ? <Text style={styles.styleLabelDescription}>{tip}</Text> : null}
                  </View>
                </View>
              </View>
            );
          })}

          {secondary.length > 0 ? (
            <View style={styles.secondaryBlock}>
              {secondary.map((labelKey) => (
                <Text key={labelKey} style={styles.secondaryLine}>
                  <Text style={styles.secondaryBullet}>· </Text>
                  {formatStyleLabelHeading(labelKey)}
                </Text>
              ))}
            </View>
          ) : null}

          {audioCaveat ? <Text style={styles.audioCaveat}>{audioCaveat}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 28,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.1)',
  },
  sectionTitle: {
    fontFamily: 'Jost_300Light',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    fontFamily: 'Jost_300Light',
    fontSize: 13,
    color: '#7A9ABE',
    flex: 1,
  },
  constructCard: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(13,17,32,0.5)',
  },
  constructCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingRight: 20,
  },
  constructCardHeaderLeft: {
    flex: 1,
    paddingRight: 12,
    minWidth: 0,
  },
  constructCardTitle: {
    fontFamily: 'Cormorant_400Regular',
    fontSize: 18,
    color: '#E8F0F8',
  },
  styleLabelDescription: {
    fontFamily: 'Jost_300Light',
    fontSize: 11,
    color: '#7A9ABE',
    marginTop: 2,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  secondaryBlock: {
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  secondaryLine: {
    fontFamily: 'Jost_300Light',
    fontSize: 12,
    color: '#7A9ABE',
    lineHeight: 20,
    marginBottom: 6,
  },
  secondaryBullet: {
    color: '#5A6B82',
  },
  audioCaveat: {
    fontFamily: 'Jost_300Light',
    fontSize: 12,
    color: '#5A6B82',
    lineHeight: 18,
    marginTop: 12,
  },
});
