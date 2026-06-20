import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { LifeDomainAnswersSection } from '@app/screens/admin/LifeDomainAnswersSection';
import {
  collectAdminOnboardingFieldEntries,
} from '@app/screens/admin/adminOnboardingFieldLabels';
import {
  fetchAdminDatingProfileBundle,
  type AdminDatingProfileBundle,
  type AdminDatingTypologyResult,
} from '@app/screens/admin/fetchAdminDatingProfileBundle';

type Props = {
  userId: string;
};

function TypologyCard({ result }: { result: AdminDatingTypologyResult }) {
  const skipped = Object.keys(result.scores).length === 1 && result.scores.skipped === 1;
  const hasScores = skipped || Object.keys(result.scores).length > 0;
  const badgeLabel = skipped ? 'Skipped' : hasScores ? 'Complete' : 'Not completed';
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{result.label}</Text>
        <Text style={[styles.badge, hasScores ? styles.badgeDone : styles.badgePending]}>
          {badgeLabel}
        </Text>
      </View>
      {result.completedAt ? (
        <Text style={styles.metaText}>Completed {new Date(result.completedAt).toLocaleString()}</Text>
      ) : null}
      {!hasScores ? (
        <Text style={styles.emptyInline}>No saved scores for this instrument yet.</Text>
      ) : (
        <>
          {result.headline ? <Text style={styles.headline}>{result.headline}</Text> : null}
          {result.body ? <Text style={styles.bodyText}>{result.body}</Text> : null}
          {result.growthEdge ? (
            <Text style={styles.growthText}>
              <Text style={styles.growthLabel}>Growth edge: </Text>
              {result.growthEdge}
            </Text>
          ) : null}
          {result.details.length > 0 ? (
            <View style={styles.detailBlock}>
              {result.details.map((d) => (
                <View key={`${d.label}-${d.value}`} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    {d.label}: <Text style={styles.detailValue}>{d.value}</Text>
                  </Text>
                  {d.description ? <Text style={styles.detailDesc}>{d.description}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

export function AdminDatingProfileTab({ userId }: Props) {
  const [bundle, setBundle] = useState<AdminDatingProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminDatingProfileBundle(userId);
      setBundle(data);
    } catch (e) {
      setBundle(null);
      setError(e instanceof Error ? e.message : 'Failed to load dating profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onboardingEntries = useMemo(
    () => (bundle ? collectAdminOnboardingFieldEntries(bundle.profileJson) : []),
    [bundle],
  );

  const onboardingBySection = useMemo(() => {
    const map = new Map<string, { label: string; value: string }[]>();
    for (const entry of onboardingEntries) {
      const bucket = map.get(entry.sectionTitle) ?? [];
      bucket.push({ label: entry.label, value: entry.value });
      map.set(entry.sectionTitle, bucket);
    }
    return map;
  }, [onboardingEntries]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#5BA8E8" />
        <Text style={styles.loadingText}>Loading dating profile…</Text>
      </View>
    );
  }

  if (error || !bundle) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Profile not found'}</Text>
        <TouchableOpacity onPress={() => void refresh()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const wantKids =
    typeof bundle.profileJson.wantKids === 'string'
      ? bundle.profileJson.wantKids
      : typeof bundle.profileJson.want_kids === 'string'
        ? bundle.profileJson.want_kids
        : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {bundle.loadWarnings.length > 0 ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Some profile data could not be loaded</Text>
          {bundle.loadWarnings.map((w) => (
            <Text key={w} style={styles.warningText} selectable>
              {w}
            </Text>
          ))}
          <Text style={styles.warningHint}>
            If you see RLS/permission errors, apply migration{' '}
            <Text style={styles.mono}>20260710120000_admin_profile_data_rls.sql</Text>.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionHeader}>Account</Text>
      <View style={styles.card}>
        {bundle.profileRow.displayName ? (
          <Text style={styles.accountName}>{bundle.profileRow.displayName}</Text>
        ) : null}
        {bundle.profileRow.email ? <Text style={styles.metaText}>{bundle.profileRow.email}</Text> : null}
        {bundle.profileRow.updatedAt ? (
          <Text style={styles.metaText}>
            Profile updated {new Date(bundle.profileRow.updatedAt).toLocaleString()}
          </Text>
        ) : null}
        {bundle.onboardingProgress?.currentStep ? (
          <Text style={styles.metaText}>
            Onboarding step: {bundle.onboardingProgress.currentStep}
          </Text>
        ) : null}
      </View>

      <Text style={styles.sectionHeader}>Profile photos</Text>
      {bundle.photos.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No photos uploaded yet.</Text>
        </View>
      ) : (
        <View style={styles.photoGrid}>
          {bundle.photos.map((photo, index) => (
            <TouchableOpacity
              key={`${photo.url}-${index}`}
              style={styles.photoTile}
              onPress={() => void Linking.openURL(photo.url)}
              accessibilityRole="button"
              accessibilityLabel={`Open profile photo ${index + 1}`}
            >
              <Image source={{ uri: photo.url }} style={styles.photoImage} resizeMode="cover" />
              <Text style={styles.photoCaption}>Photo {index + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.sectionHeader}>Relationship typologies (4 assessments)</Text>
      {bundle.typologyResults.map((result) => (
        <TypologyCard key={result.instrument} result={result} />
      ))}

      <Text style={styles.sectionHeader}>Optional typology pickers</Text>
      {bundle.optionalTypologyAnswers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No optional typology answers saved.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {bundle.optionalTypologyAnswers.map((row) => (
            <View key={`${row.section}-${row.label}`} style={styles.factRow}>
              <Text style={styles.factLabel}>
                {row.section} — {row.label}
              </Text>
              <Text style={styles.factValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionHeader}>Onboarding answers</Text>
      {onboardingEntries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No onboarding profile answers stored yet.</Text>
        </View>
      ) : (
        Array.from(onboardingBySection.entries()).map(([sectionTitle, rows]) => (
          <View key={sectionTitle} style={styles.card}>
            <Text style={styles.subsectionTitle}>{sectionTitle}</Text>
            {rows.map((row) => (
              <View key={`${sectionTitle}-${row.label}`} style={styles.factRow}>
                <Text style={styles.factLabel}>{row.label}</Text>
                <Text style={styles.factValue} selectable>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        ))
      )}

      <Text style={styles.sectionHeader}>Life domain answers</Text>
      <LifeDomainAnswersSection userId={userId} wantKids={wantKids} />

      {bundle.personalityDocuments.length > 0 ? (
        <>
          <Text style={styles.sectionHeader}>Personality documents</Text>
          <View style={styles.card}>
            {bundle.personalityDocuments.map((doc) => (
              <TouchableOpacity
                key={`${doc.name}-${doc.url}`}
                onPress={() => void Linking.openURL(doc.url)}
                style={styles.docRow}
              >
                <Text style={styles.docLink}>{doc.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0a0a0a',
    gap: 12,
  },
  loadingText: { color: '#888', fontSize: 13 },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  retryBtnText: { color: '#93c5fd', fontSize: 13, fontWeight: '600' },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 20,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#93c5fd',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#fff', flex: 1 },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  badgeDone: { color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.15)' },
  badgePending: { color: '#888', backgroundColor: 'rgba(255,255,255,0.06)' },
  accountName: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  metaText: { fontSize: 12, color: '#888', marginBottom: 2 },
  headline: { fontSize: 14, fontWeight: '600', color: '#f4f8fc', marginBottom: 6 },
  bodyText: { fontSize: 13, color: '#ccc', lineHeight: 19, marginBottom: 8 },
  growthText: { fontSize: 12, color: '#b8c9dc', lineHeight: 17, marginBottom: 8 },
  growthLabel: { color: '#93c5fd', fontWeight: '600' },
  detailBlock: { marginTop: 4, gap: 8 },
  detailRow: { gap: 2 },
  detailLabel: { fontSize: 12, color: '#aaa' },
  detailValue: { color: '#fff', fontWeight: '600' },
  detailDesc: { fontSize: 11, color: '#777', lineHeight: 16 },
  emptyCard: {
    padding: 16,
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 10,
  },
  emptyText: { fontSize: 13, color: '#666', textAlign: 'center' },
  emptyInline: { fontSize: 12, color: '#666' },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  photoTile: {
    width: 120,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#111',
  },
  photoImage: {
    width: 120,
    height: 150,
    backgroundColor: '#1a1a1a',
  },
  photoCaption: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 4,
  },
  factRow: { marginBottom: 12 },
  factLabel: { fontSize: 11, color: '#666', marginBottom: 2 },
  factValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  docRow: { paddingVertical: 6 },
  docLink: { fontSize: 14, color: '#5BA8E8', textDecorationLine: 'underline' },
  warningBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: '#1a1200',
    marginBottom: 8,
  },
  warningTitle: { fontSize: 13, fontWeight: '600', color: '#f59e0b', marginBottom: 6 },
  warningText: { fontSize: 11, color: '#d4a84b', marginBottom: 2 },
  warningHint: { fontSize: 11, color: '#888', marginTop: 6, lineHeight: 16 },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#bbb',
  },
});
