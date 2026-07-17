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
import { usePrefetchedPersonalReport } from './usePrefetchedPersonalReport';

const ACCENT = '#3b82f6';
const ACCENT_GLOW = 'rgba(59, 130, 246, 0.45)';

type Props = {
  userId: string;
  style?: ViewStyle;
  variant?: 'dark' | 'light';
};

export function DownloadPersonalReportButton({ userId, style, variant = 'dark' }: Props) {
  const { status, retry, ensureHtml } = usePrefetchedPersonalReport(userId);
  const [exporting, setExporting] = useState(false);

  if (!userId) {
    return null;
  }

  const isDark = variant === 'dark';

  async function handleDownloadReport() {
    setExporting(true);
    try {
      const html = await ensureHtml();
      await exportReportPdfFromHtml(html, { reportKind: 'full' });

      if (Platform.OS === 'web') {
        Alert.alert(
          'Report ready',
          'Your report opened in a new tab. Use Print → Save as PDF to download it.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('[Report] export failed:', error);
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
      <Text style={[styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight]}>
        Your personal report
      </Text>

      {status === 'loading' ? (
        <>
          <Text style={[styles.sectionHint, isDark ? styles.sectionHintDark : styles.sectionHintLight]}>
            We&apos;re writing your personalized report from your assessments and interview. This usually takes about a
            minute.
          </Text>
          <View style={[styles.loadingCard, isDark ? styles.loadingCardDark : styles.loadingCardLight]}>
            <ActivityIndicator color={ACCENT} size="small" />
            <Text style={[styles.loadingText, isDark ? styles.loadingTextDark : styles.loadingTextLight]}>
              Generating your report…
            </Text>
          </View>
        </>
      ) : status === 'error' ? (
        <>
          <Text style={[styles.sectionHint, isDark ? styles.sectionHintDark : styles.sectionHintLight]}>
            We couldn&apos;t generate your report. You can try again — this is usually temporary.
          </Text>
          <TouchableOpacity
            style={[styles.reportButton, isDark ? styles.reportButtonDark : styles.reportButtonLight]}
            onPress={retry}
            accessibilityRole="button"
            accessibilityLabel="Retry generating your personal report"
          >
            <Text style={styles.reportButtonText}>Try again</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[styles.sectionHint, isDark ? styles.sectionHintDark : styles.sectionHintLight]}>
            Your detailed PDF is ready — written from your assessments and interview, not a screenshot of this screen.
          </Text>
          <TouchableOpacity
            style={[
              styles.reportButton,
              isDark ? styles.reportButtonDark : styles.reportButtonLight,
              exporting && styles.reportButtonDisabled,
            ]}
            onPress={() => void handleDownloadReport()}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="Download your personal report as PDF"
          >
            {exporting ? (
              <View style={styles.reportButtonLoading}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.reportButtonLoadingText}>Opening report…</Text>
              </View>
            ) : (
              <View style={styles.reportButtonInner}>
                <Ionicons name="document-text-outline" size={22} color="#fff" />
                <Text
                  style={[styles.reportButtonText, isDark ? styles.reportButtonTextDark : styles.reportButtonTextLight]}
                >
                  Download My Report
                </Text>
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
  section: {
    width: '100%',
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionTitleDark: {
    color: '#f4f4f5',
  },
  sectionTitleLight: {
    color: '#111',
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  sectionHintDark: {
    color: 'rgba(255,255,255,0.65)',
  },
  sectionHintLight: {
    color: 'rgba(0,0,0,0.55)',
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
  },
  loadingCardDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(91, 168, 232, 0.35)',
  },
  loadingCardLight: {
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  loadingTextDark: {
    color: '#93c5fd',
  },
  loadingTextLight: {
    color: '#2563eb',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      web: {
        boxShadow: `0 4px 20px ${ACCENT_GLOW}`,
      } as ViewStyle,
    }),
  },
  reportButtonDark: {
    backgroundColor: ACCENT,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.55)',
  },
  reportButtonLight: {
    backgroundColor: ACCENT,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.4)',
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
  reportButtonTextDark: {
    color: '#fff',
  },
  reportButtonTextLight: {
    color: '#fff',
  },
});
