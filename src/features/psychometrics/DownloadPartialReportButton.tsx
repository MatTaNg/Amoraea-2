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
import { exportReportPdfFromHtml } from './exportReportPdf';
import { usePrefetchedPartialReport } from './usePrefetchedPartialReport';
import {
  PSYCHOMETRICS_ACCENT,
  PSYCHOMETRICS_FONT_BODY,
  PSYCHOMETRICS_TIP_CARD_BORDER,
} from './psychometricsTheme';

type Props = {
  userId: string;
  scoringReady: boolean;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
  /** Refresh attempt / rollup before regenerating (e.g. InterviewComplete). */
  onBeforeRetry?: () => void | Promise<void>;
};

export function DownloadPartialReportButton({
  userId,
  scoringReady,
  variant = 'primary',
  style,
  onBeforeRetry,
}: Props) {
  const { status, errorMessage, retry, ensureHtml } = usePrefetchedPartialReport(userId, scoringReady);
  const [exporting, setExporting] = useState(false);

  if (!userId) {
    return null;
  }

  async function handleDownloadReport() {
    setExporting(true);
    try {
      const html = await ensureHtml();
      await exportReportPdfFromHtml(html, { reportKind: 'partial' });

      if (Platform.OS === 'web') {
        Alert.alert(
          'Report ready',
          'Your partial report opened in a new tab. Use Print → Save as PDF to download it.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('[PartialReport] export failed:', error);
      Alert.alert(
        'Report unavailable',
        'We were unable to open your partial report right now. Please try again in a moment.',
        [{ text: 'OK' }],
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleRetry() {
    try {
      if (onBeforeRetry) {
        await onBeforeRetry();
      }
    } catch (err) {
      console.warn('[PartialReport] onBeforeRetry failed:', err);
    }
    retry();
  }

  const isSecondary = variant === 'secondary';

  return (
    <View style={[styles.section, style]}>
      {!isSecondary ? <Text style={styles.sectionTitle}>Your partial personal report</Text> : null}

      {!scoringReady || status === 'idle' ? (
        <>
          <Text style={styles.sectionHint}>
            We&apos;re saving your interview results. Your downloadable preview will be ready in a moment.
          </Text>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={PSYCHOMETRICS_ACCENT} size="small" />
            <Text style={styles.loadingText}>Preparing your preview…</Text>
          </View>
        </>
      ) : status === 'loading' ? (
        <>
          <Text style={styles.sectionHint}>
            We&apos;re writing your partial report from your AI interview. This usually takes about a minute.
          </Text>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={PSYCHOMETRICS_ACCENT} size="small" />
            <Text style={styles.loadingText}>Generating your report…</Text>
          </View>
        </>
      ) : status === 'error' ? (
        <>
          <Text style={styles.sectionHint}>
            We couldn&apos;t generate your partial report. You can try again — this is usually temporary.
          </Text>
          {errorMessage ? (
            <Text style={styles.errorDetail} numberOfLines={3}>
              {errorMessage}
            </Text>
          ) : null}
          <TouchableOpacity
            style={isSecondary ? styles.reportButtonSecondary : styles.reportButton}
            onPress={() => void handleRetry()}
            accessibilityRole="button"
            accessibilityLabel="Retry generating your partial report"
          >
            <Text style={[styles.reportButtonText, isSecondary && styles.reportButtonTextSecondary]}>
              Try again
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.sectionHint}>
            Your PDF preview is ready, written from your interview conversation. It highlights strengths
            and growth areas you can improve on. Complete the self assessments to
            unlock your full report.
          </Text>
          <TouchableOpacity
            style={[
              isSecondary ? styles.reportButtonSecondary : styles.reportButton,
              exporting && styles.reportButtonDisabled,
            ]}
            onPress={() => void handleDownloadReport()}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="Download your partial personal report as PDF"
          >
            {exporting ? (
              <View style={styles.reportButtonLoading}>
                <ActivityIndicator color={isSecondary ? PSYCHOMETRICS_ACCENT : '#fff'} size="small" />
                <Text
                  style={[
                    styles.reportButtonLoadingText,
                    isSecondary && styles.reportButtonLoadingTextSecondary,
                  ]}
                >
                  Opening report…
                </Text>
              </View>
            ) : (
              <View style={styles.reportButtonInner}>
                <Ionicons
                  name="document-text-outline"
                  size={isSecondary ? 18 : 22}
                  color={isSecondary ? PSYCHOMETRICS_ACCENT : '#fff'}
                />
                <Text
                  style={[styles.reportButtonText, isSecondary && styles.reportButtonTextSecondary]}
                >
                  Download Partial Report
                </Text>
                {!isSecondary ? (
                  <Ionicons name="download-outline" size={20} color="rgba(255,255,255,0.9)" />
                ) : null}
              </View>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
  sectionTitle: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 18,
    fontWeight: '600',
    color: '#F4F8FC',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionHint: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: '#B8C9DC',
    textAlign: 'center',
    marginBottom: 14,
  },
  errorDetail: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 12,
    lineHeight: 18,
    color: '#fca5a5',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
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
    borderColor: PSYCHOMETRICS_TIP_CARD_BORDER,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  loadingText: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 15,
    fontWeight: '600',
    color: '#93c5fd',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    width: '100%',
    backgroundColor: PSYCHOMETRICS_ACCENT,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.55)',
    ...Platform.select({
      ios: {
        shadowColor: PSYCHOMETRICS_ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      web: {
        boxShadow: '0 4px 20px rgba(59, 130, 246, 0.45)',
      } as ViewStyle,
    }),
  },
  reportButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 18,
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
  },
  reportButtonDisabled: {
    opacity: 0.85,
  },
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
  reportButtonLoadingText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#fff',
  },
  reportButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#93c5fd',
  },
  reportButtonLoadingTextSecondary: {
    color: '#93c5fd',
  },
});
