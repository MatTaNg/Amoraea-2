import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { exportReportPdfFromHtml } from '@features/psychometrics/exportReportPdf';
import { usePrefetchedValidationReport } from './usePrefetchedValidationReport';
import type { ValidationReportTier } from './generateValidationReport';

type Props = {
  userId: string;
  reportReady: boolean;
  waitingForPartner?: boolean;
  waitingMessage?: string | null;
  refreshKey?: string;
  variant?: 'primary' | 'completion' | 'actions';
  reportTier?: ValidationReportTier;
  hideTitle?: boolean;
  style?: ViewStyle;
};

export function DownloadValidationReportButton({
  userId,
  reportReady,
  waitingForPartner = false,
  waitingMessage = null,
  refreshKey,
  variant = 'primary',
  reportTier = 'partial',
  hideTitle = false,
  style,
}: Props) {
  const { status, retry, ensureHtml } = usePrefetchedValidationReport(
    userId,
    reportReady,
    refreshKey,
  );
  const [exporting, setExporting] = useState(false);

  if (!userId) {
    return null;
  }

  const isActions = variant === 'actions';
  const isCompletion = variant === 'completion';
  const isFull = reportTier === 'full';
  const reportLabel = isFull ? 'full report' : 'partial report';
  const reportLabelTitle = isFull ? 'Full report' : 'Partial report';

  async function handleDownloadReport() {
    setExporting(true);
    try {
      const html = await ensureHtml();
      await exportReportPdfFromHtml(html);

      if (Platform.OS === 'web') {
        Alert.alert(
          'Report ready',
          'Your relationship report opened in a new tab. Use Print → Save as PDF to download it.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('[ValidationReport] export failed:', error);
      Alert.alert(
        'Report unavailable',
        'We were unable to open your report right now. Please try again in a moment.',
        [{ text: 'OK' }],
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={[styles.section, style]}>
      {!hideTitle ? (
        <Text style={styles.sectionTitle}>
          {isActions
            ? `Download ${reportLabel}`
            : isCompletion
              ? `Your ${reportLabel}`
              : isFull
                ? 'Download your full report'
                : 'Step 1 — Download your partial report'}
        </Text>
      ) : null}

      {!reportReady || status === 'idle' ? (
        waitingForPartner ? (
          <>
            <Text style={styles.sectionHint}>
              {waitingMessage ??
                'Your downloadable report includes couple compatibility analysis and will be ready once your partner completes their assessment and enters your email on their account.'}
            </Text>
            <View style={styles.pendingCard}>
              <Ionicons name="hourglass-outline" size={22} color="#5BA8E8" />
              <Text style={styles.pendingText}>Waiting for your partner</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionHint}>
              We&apos;re finalizing your questionnaire results. Your {reportLabel} will be ready in
              a moment — please read it before answering the feedback questions.
            </Text>
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#5BA8E8" size="small" />
              <Text style={styles.loadingText}>Preparing your report…</Text>
            </View>
          </>
        )
      ) : status === 'loading' ? (
        <>
          <Text style={styles.sectionHint}>
            Your {reportLabel} PDF is being written from your assessments
            {isFull ? ', survey responses, and AI interview' : ' and survey responses'}. Read it
            before you continue to the feedback questions below.
          </Text>
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#5BA8E8" size="small" />
            <Text style={styles.loadingText}>Generating your report…</Text>
          </View>
        </>
      ) : status === 'error' ? (
        <>
          <Text style={styles.sectionHint}>
            We couldn&apos;t generate your report. You can try again — this is usually temporary.
          </Text>
          <TouchableOpacity style={styles.reportButtonSecondary} onPress={retry}>
            <Text style={styles.reportButtonTextSecondary}>Try again</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.sectionHint}>
            {isFull
              ? 'Open and read your full relationship report (PDF), including insights from your AI interview.'
              : 'Open and read your partial relationship report (PDF), then scroll down to answer the feedback questions. Take the optional interview afterward to unlock your full report.'}
          </Text>
          <TouchableOpacity
            style={[styles.reportButton, exporting && styles.reportButtonDisabled]}
            onPress={() => void handleDownloadReport()}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel={`Download your ${reportLabel} relationship validation report as PDF`}
          >
            {exporting ? (
              <View style={styles.reportButtonLoading}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.reportButtonLoadingText}>Opening report…</Text>
              </View>
            ) : (
              <View style={styles.reportButtonInner}>
                <Ionicons name="document-text-outline" size={22} color="#fff" />
                <Text style={styles.reportButtonText}>Download {reportLabelTitle.toLowerCase()}</Text>
                <Ionicons name="download-outline" size={20} color="rgba(255,255,255,0.9)" />
              </View>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', marginTop: 8, marginBottom: 12 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8F0F8',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 14,
    lineHeight: 21,
    color: '#95A8BD',
    textAlign: 'center',
    marginBottom: 14,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(82, 142, 220, 0.35)',
    backgroundColor: 'rgba(91, 168, 232, 0.08)',
  },
  loadingText: { fontSize: 15, fontWeight: '600', color: '#5BA8E8' },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(82, 142, 220, 0.35)',
    backgroundColor: 'rgba(91, 168, 232, 0.08)',
  },
  pendingText: { fontSize: 15, fontWeight: '600', color: '#5BA8E8' },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    width: '100%',
    backgroundColor: '#5BA8E8',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.55)',
    ...Platform.select({
      web: { boxShadow: '0 4px 20px rgba(91, 168, 232, 0.45)' } as ViewStyle,
    }),
  },
  reportButtonSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(82, 142, 220, 0.45)',
  },
  reportButtonDisabled: { opacity: 0.85 },
  reportButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  reportButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  reportButtonLoadingText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  reportButtonText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2, color: '#fff' },
  reportButtonTextSecondary: { fontSize: 15, fontWeight: '600', color: '#5BA8E8' },
});
