import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { authStyles } from '@app/screens/authStyles';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { showConfirmDialog } from '@utilities/alerts/confirmDialog';
import {
  fetchRelationshipValidationRecord,
  savePostAssessment,
  listValidationComparisons,
  setActiveValidationComparison,
  fetchValidationComparison,
  type RelationshipValidationComparison,
} from '@features/relationshipValidation/relationshipValidationRepo';
import { loadValidationSelfProfileSummary } from '@features/relationshipValidation/validationProfileSummary';
import type {
  RelationshipValidationPostAssessment,
  RelationshipValidationCompatibilityBreakdown,
} from '@features/relationshipValidation/constants';
import { markValidationInterviewOptIn } from '@features/relationshipValidation/relationshipValidationRepo';
import { maybeComputeValidationPairScore } from '@features/relationshipValidation/relationshipValidationService';
import { DownloadValidationReportButton } from '@features/relationshipValidation/DownloadValidationReportButton';
import { isValidationInterviewCompleted } from '@features/relationshipValidation/generateValidationReport';
import {
  exitValidationFlowToStandardApp,
  fetchValidationShellRouting,
  isValidationStandardAppEnrolled,
} from '@features/relationshipValidation/validationShellRouting';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AMORAEA_LOGO = require('../../../../assets/branding/amoraea-logo.png');

function AmoraeaLogoHeader() {
  return (
    <View style={styles.logoWrap}>
      <Image
        source={Platform.OS === 'web' ? { uri: '/amoraea-logo.png' } : AMORAEA_LOGO}
        style={styles.logoImage}
        resizeMode="contain"
        accessibilityLabel="Amoraea"
      />
    </View>
  );
}

type Props = {
  userId: string;
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    replace: (screen: string) => void;
  };
};

/** Defaults for legacy post-assessment fields no longer collected in the UI. */
function buildPostAssessmentPayload(
  reportValue: number,
  reportImprovement: string,
): RelationshipValidationPostAssessment {
  return {
    scoreAccuracy: 0,
    mostAccurateDimension: 'overall',
    leastAccurateDimension: 'none_surprising',
    selfSurpriseText: null,
    partnerSurpriseText: null,
    hypotheticalInterest: 0,
    reportValue,
    reportImprovementText: reportImprovement.trim() || null,
  };
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.round(score * 100);
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.barPct}>{pct}%</Text>
    </View>
  );
}

export function ValidationReportScreen({ userId, navigation }: Props) {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Awaited<
    ReturnType<typeof loadValidationSelfProfileSummary>
  > | null>(null);
  const [breakdown, setBreakdown] = useState<RelationshipValidationCompatibilityBreakdown | null>(
    null,
  );
  const [partnerComplete, setPartnerComplete] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);

  const [reportValue, setReportValue] = useState(0);
  const [reportImprovement, setReportImprovement] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisons, setComparisons] = useState<RelationshipValidationComparison[]>([]);
  const [activeComparisonId, setActiveComparisonId] = useState<string | null>(null);
  const [switchingPartner, setSwitchingPartner] = useState(false);
  const [exitingToStandardApp, setExitingToStandardApp] = useState(false);
  const [pairSyncReason, setPairSyncReason] = useState<string | null>(null);

  const { data: validationShellRouting } = useQuery({
    queryKey: ['validationShellRouting', userId],
    queryFn: () => fetchValidationShellRouting(userId),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
  const showBackToStandardPostInterview = isValidationStandardAppEnrolled(validationShellRouting);

  const applyComparisonFormState = useCallback((comparison: RelationshipValidationComparison) => {
    setActiveComparisonId(comparison.id);
    const hasPost = Boolean(comparison.post_assessment);
    setFeedbackSaved(hasPost);
    if (hasPost && comparison.post_assessment) {
      const p = comparison.post_assessment;
      setReportValue(p.reportValue ?? 0);
      setReportImprovement(p.reportImprovementText ?? '');
    } else {
      setReportValue(0);
      setReportImprovement('');
    }
    setBreakdown(
      (comparison.compatibility_breakdown as RelationshipValidationCompatibilityBreakdown | null) ??
        null,
    );
  }, []);

  const loadReport = useCallback(
    async (opts?: { silent?: boolean; comparisonId?: string }) => {
    if (!opts?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const prof = await loadValidationSelfProfileSummary(userId);
      setProfile(prof);

      let comparisonsList: RelationshipValidationComparison[] = [];
      try {
        comparisonsList = await listValidationComparisons(userId);
      } catch (listErr) {
        console.error('[ValidationReport] list comparisons failed:', listErr);
      }

      const [record, pairResult, interviewDone] = await Promise.all([
        fetchRelationshipValidationRecord(userId),
        maybeComputeValidationPairScore(userId),
        isValidationInterviewCompleted(userId),
      ]);
      setInterviewCompleted(interviewDone);

      if (comparisonsList.length === 0 && record?.partner_email_entered) {
        try {
          comparisonsList = await listValidationComparisons(userId);
        } catch {
          // comparisons table may be unavailable until migration is applied
        }
      }

      setComparisons(comparisonsList);

      const resolvedComparisonId =
        opts?.comparisonId ??
        record?.active_comparison_id ??
        pairResult.activeComparisonId ??
        comparisonsList[0]?.id ??
        null;

      const activeComparison =
        comparisonsList.find((c) => c.id === resolvedComparisonId) ??
        (resolvedComparisonId
          ? await fetchValidationComparison(resolvedComparisonId)
          : null);

      if (activeComparison) {
        applyComparisonFormState(activeComparison);
      } else {
        setActiveComparisonId(resolvedComparisonId);
      }

      setPartnerComplete(
        pairResult.partnerComplete ||
          Boolean(
            activeComparison?.compatibility_breakdown &&
              activeComparison.compatibility_score != null,
          ),
      );
      if (pairResult.breakdown) {
        setBreakdown(pairResult.breakdown);
      } else if (activeComparison?.compatibility_breakdown) {
        setBreakdown(
          activeComparison.compatibility_breakdown as RelationshipValidationCompatibilityBreakdown,
        );
      }
      setPairSyncReason(pairResult.pairSyncReason);
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  },
    [userId, applyComparisonFormState],
  );

  useFocusEffect(
    useCallback(() => {
      void loadReport();
    }, [loadReport]),
  );

  const compatibilityPct = useMemo(() => {
    if (breakdown?.finalScore == null) return null;
    return Math.round(breakdown.finalScore * 100);
  }, [breakdown]);

  const reportRefreshKey = activeComparisonId
    ? `${activeComparisonId}-${partnerComplete ? `pair-${compatibilityPct ?? 0}` : 'solo'}-${interviewCompleted ? 'full' : 'partial'}`
    : 'none';

  const reportTier = interviewCompleted ? 'full' : 'partial';

  const handleSelectPartner = async (comparisonId: string) => {
    if (comparisonId === activeComparisonId || switchingPartner) return;
    setSwitchingPartner(true);
    setError(null);
    try {
      const selected =
        comparisons.find((c) => c.id === comparisonId) ??
        (await fetchValidationComparison(comparisonId));
      if (!selected) {
        throw new Error('Comparison not found');
      }

      applyComparisonFormState(selected);
      await setActiveValidationComparison(userId, comparisonId);
      await loadReport({ silent: true, comparisonId });
    } catch {
      setError('Could not switch partner. Please try again.');
      await loadReport({ silent: true });
    } finally {
      setSwitchingPartner(false);
    }
  };

  const activeComparison = useMemo(
    () => comparisons.find((c) => c.id === activeComparisonId) ?? null,
    [comparisons, activeComparisonId],
  );

  const needsPreAssessment = Boolean(activeComparison && !activeComparison.pre_assessment);

  const activePartnerIndex = comparisons.findIndex((c) => c.id === activeComparisonId);

  const handlePreviousPartner = () => {
    if (activePartnerIndex <= 0) return;
    void handleSelectPartner(comparisons[activePartnerIndex - 1].id);
  };

  const handleNextPartner = () => {
    if (activePartnerIndex < 0 || activePartnerIndex >= comparisons.length - 1) return;
    void handleSelectPartner(comparisons[activePartnerIndex + 1].id);
  };

  const handleSubmitPost = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const payload = buildPostAssessmentPayload(reportValue, reportImprovement);
      await savePostAssessment(userId, payload);
      setFeedbackSaved(true);
    } catch {
      setError('Could not save feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInterview = async () => {
    await markValidationInterviewOptIn(userId);
    navigation.navigate('ValidationAmoraea');
  };

  const handleCompareAnotherPartner = () => {
    navigation.navigate('ValidationPartnerEmail', { newComparison: true });
  };

  const handleBackToStandardPostInterview = useCallback(async () => {
    if (exitingToStandardApp) return;
    setExitingToStandardApp(true);
    try {
      await exitValidationFlowToStandardApp(userId);
      await queryClient.invalidateQueries({ queryKey: ['validationShellRouting', userId] });
      await queryClient.invalidateQueries({ queryKey: ['validationTrack', userId] });
    } finally {
      setExitingToStandardApp(false);
    }
  }, [exitingToStandardApp, queryClient, userId]);

  const waitingForPartnerMessage = (() => {
    if (partnerComplete) return null;
    if (pairSyncReason === 'partner_has_not_entered_your_email') {
      return 'Your partner has not entered your email yet. They need to add your address when they sign up or on their results screen.';
    }
    if (pairSyncReason === 'partner_not_registered') {
      return 'Your partner has not created an account with that email yet.';
    }
    if (pairSyncReason === 'no_partner_email' || pairSyncReason === 'no_active_comparison') {
      return 'Enter your partner\'s email to link your results together.';
    }
    return 'Your partner has not finished their psychometrics yet. Once they complete the assessment, your couple report will unlock.';
  })();

  const showPartnerSwitcher = comparisons.length > 1;

  const renderBackToApplicationReviewLink = () => {
    if (!showBackToStandardPostInterview) return null;
    return (
      <Pressable
        onPress={() => void handleBackToStandardPostInterview()}
        disabled={exitingToStandardApp}
        style={({ pressed }) => [
          styles.backToPostInterviewLink,
          (pressed || exitingToStandardApp) && styles.backToPostInterviewLinkPressed,
        ]}
        accessibilityRole="link"
        accessibilityLabel="Back to application review"
      >
        {exitingToStandardApp ? (
          <ActivityIndicator color="#5BA8E8" size="small" />
        ) : (
          <Text style={styles.backToPostInterviewLinkText}>← Back to application review</Text>
        )}
      </Pressable>
    );
  };

  const renderReportFeedback = () => {
    if (feedbackSaved) return null;

    return (
    <View style={styles.feedbackSection}>
      <Text style={styles.feedbackTitle}>Feedback on your report</Text>
      <Text style={styles.feedbackIntro}>
        Optional — share what you thought of the report after you&apos;ve read it.
      </Text>

      <Text style={styles.questionLabel}>
        How valuable did you find the report? (optional, 1–10)
      </Text>
      <SliderRow
        value={reportValue}
        onChange={setReportValue}
      />

      <Text style={styles.questionLabel}>
        What would you change or improve about the report? (optional)
      </Text>
      <TextInput
        value={reportImprovement}
        onChangeText={setReportImprovement}
        placeholder="Share any suggestions about the report itself…"
        placeholderTextColor="#5B6B80"
        multiline
        style={styles.textArea}
      />

      {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

      <Pressable
        onPress={() => void handleSubmitPost()}
        disabled={submitting}
        style={[authStyles.primaryButton, submitting && { opacity: 0.6 }]}
      >
        <Text style={authStyles.primaryButtonText}>
          {submitting ? 'Saving…' : 'Save feedback'}
        </Text>
      </Pressable>
    </View>
    );
  };

  const renderPartnerSwitcher = () => {
    if (!showPartnerSwitcher) return null;
    return (
      <>
        <View style={styles.partnerSwitcher}>
          <Text style={styles.partnerSwitcherLabel}>Comparing with</Text>
          <View style={styles.partnerSwitcherRow}>
            <Pressable
              onPress={handlePreviousPartner}
              disabled={activePartnerIndex <= 0 || switchingPartner}
              style={[
                styles.partnerNavBtn,
                (activePartnerIndex <= 0 || switchingPartner) && styles.partnerNavBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Previous partner"
            >
              <Text style={styles.partnerNavBtnText}>‹</Text>
            </Pressable>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.partnerChipRow}
            >
              {comparisons.map((comparison) => (
                <Pressable
                  key={comparison.id}
                  onPress={() => void handleSelectPartner(comparison.id)}
                  disabled={switchingPartner}
                  style={[
                    styles.partnerChip,
                    comparison.id === activeComparisonId && styles.partnerChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.partnerChipText,
                      comparison.id === activeComparisonId && styles.partnerChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {comparison.partner_email_entered}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={handleNextPartner}
              disabled={
                activePartnerIndex < 0 ||
                activePartnerIndex >= comparisons.length - 1 ||
                switchingPartner
              }
              style={[
                styles.partnerNavBtn,
                (activePartnerIndex < 0 ||
                  activePartnerIndex >= comparisons.length - 1 ||
                  switchingPartner) &&
                  styles.partnerNavBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next partner"
            >
              <Text style={styles.partnerNavBtnText}>›</Text>
            </Pressable>
          </View>
        </View>
        {switchingPartner ? (
          <View style={styles.switchingRow}>
            <ActivityIndicator size="small" color="#5BA8E8" />
            <Text style={styles.switchingText}>Loading this partner&apos;s results…</Text>
          </View>
        ) : null}
      </>
    );
  };

  const handleLogOut = useCallback(() => {
    showConfirmDialog(
      {
        title: 'Log out',
        message: 'Are you sure you want to log out?',
        confirmText: 'Log out',
      },
      () => void signOut(),
    );
  }, [signOut]);

  const logOutButton = (
    <TouchableOpacity
      style={styles.logoutButton}
      onPress={handleLogOut}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Log out"
    >
      <Ionicons name="log-out-outline" size={16} color="#5BA8E8" />
      <Text style={styles.logoutButtonText}>Log out</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaContainer style={[styles.safeBg, styles.safeRelative]}>
        {logOutButton}
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#5BA8E8" />
        </View>
      </SafeAreaContainer>
    );
  }

  return (
    <SafeAreaContainer style={[styles.safeBg, styles.safeRelative]}>
      {logOutButton}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AmoraeaLogoHeader />
        <Text style={styles.title}>Your results</Text>
        <View style={[styles.partialBadge, interviewCompleted && styles.fullBadge]}>
          <Text style={[styles.partialBadgeText, interviewCompleted && styles.fullBadgeText]}>
            {interviewCompleted ? 'Full report' : 'Partial report'}
          </Text>
        </View>

        {showPartnerSwitcher ? renderPartnerSwitcher() : null}

        {needsPreAssessment ? (
          <View style={styles.preAssessmentCallout}>
            <Text style={styles.preAssessmentCalloutText}>
              Complete the relationship survey for this partner before you can download your
              report.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('ValidationPreAssessment')}
              style={styles.preAssessmentCalloutBtn}
            >
              <Text style={styles.preAssessmentCalloutBtnText}>Complete relationship survey</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>
                {interviewCompleted ? 'Your full report' : 'Your partial report'}
              </Text>
              <Text style={styles.stepBody}>
                {interviewCompleted
                  ? 'This report combines your questionnaires, psychometrics, and AI interview.'
                  : 'This report is based on your questionnaires and psychometrics — not the full interview-based report yet.'}
              </Text>
            </View>

            <DownloadValidationReportButton
              userId={userId}
              reportReady={Boolean(profile) && partnerComplete}
              waitingForPartner={Boolean(profile) && !partnerComplete}
              waitingMessage={waitingForPartnerMessage}
              refreshKey={reportRefreshKey}
              reportTier={reportTier}
              hideTitle
              style={styles.reportDownloadTop}
            />

            {profile ? (
              <View style={styles.card}>
                <Text style={styles.cardHeading}>Your psychological profile</Text>
                <Text style={styles.cardSubheading}>Attachment: {profile.attachmentLabel}</Text>
                <Text style={styles.cardBody}>{profile.attachmentDescription}</Text>
                <Text style={styles.cardSubheading}>
                  Top values: {profile.topValues.join(', ') || '—'}
                </Text>
                <Text style={styles.cardSubheading}>
                  Conflict style: {profile.conflictStyleLabel}
                </Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardHeading}>Compatibility with your partner</Text>
              {compatibilityPct != null && breakdown ? (
                <>
                  <Text style={styles.scoreBig}>{compatibilityPct}%</Text>
                  <ScoreBar label="Attachment alignment" score={breakdown.attachment} />
                  <ScoreBar label="Values alignment" score={breakdown.values} />
                  <ScoreBar label="Conflict style alignment" score={breakdown.conflictStyle} />
                </>
              ) : (
                <Text style={styles.pending}>
                  Your partner hasn&apos;t completed their assessment yet. Your compatibility score
                  will appear here once they finish.
                </Text>
              )}
            </View>

            {renderReportFeedback()}

            <View style={styles.actionsSection}>

              {!interviewCompleted ? (
                <View style={styles.actionCard}>
                  <Text style={styles.actionCardTitle}>Unlock your full report</Text>
                  <Text style={styles.actionCardBody}>
                    Take the optional AI interview (~20–30 minutes) for deeper insight into how you
                    think about relationships, conflict, and repair.
                  </Text>
                  <Pressable onPress={() => void handleInterview()} style={authStyles.primaryButton}>
                    <Text style={authStyles.primaryButtonText}>Take the interview</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.actionCard}>
                <Text style={styles.actionCardTitle}>Compare with another partner</Text>
                <Text style={styles.actionCardBody}>
                  Enter a new partner&apos;s email and answer the relationship survey again. Your
                  psychometric results will be reused.
                </Text>
                <Pressable
                  onPress={handleCompareAnotherPartner}
                  style={styles.secondaryActionBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryActionBtnText}>Compare with another partner</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {renderBackToApplicationReviewLink()}
      </ScrollView>
    </SafeAreaContainer>
  );
}

function SliderRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.sliderRow}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          style={[styles.chip, value === n && styles.chipActive]}
        >
          <Text style={[styles.chipText, value === n && styles.chipTextActive]}>{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeBg: { flex: 1, backgroundColor: '#05060D' },
  safeRelative: { position: 'relative' },
  logoutButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30,111,217,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 6,
    zIndex: 100,
  },
  logoutButtonText: {
    fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.5,
    color: '#5BA8E8',
  },
  loading: {
    flex: 1,
    backgroundColor: '#05060D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: 24, paddingBottom: 48, maxWidth: 600, alignSelf: 'center', width: '100%' },
  logoWrap: { alignItems: 'center', marginBottom: 20 },
  logoImage: { width: 240, height: 72 },
  title: { fontSize: 26, color: '#E8F0F8', textAlign: 'center', marginBottom: 10 },
  backToPostInterviewLink: {
    alignSelf: 'center',
    marginTop: 28,
    paddingVertical: 8,
    paddingHorizontal: 4,
    ...Platform.select({
      web: { cursor: 'pointer' as const },
    }),
  },
  backToPostInterviewLinkPressed: {
    opacity: 0.7,
  },
  backToPostInterviewLinkText: {
    color: '#5BA8E8',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  partialBadge: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(91, 168, 232, 0.45)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(91, 168, 232, 0.12)',
  },
  partialBadgeText: {
    color: '#5BA8E8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  fullBadge: {
    borderColor: 'rgba(120, 220, 160, 0.45)',
    backgroundColor: 'rgba(120, 220, 160, 0.12)',
  },
  fullBadgeText: {
    color: '#78DCA0',
  },
  partnerSwitcher: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#0B0F18',
  },
  partnerSwitcherLabel: {
    color: '#7A9ABE',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  partnerSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91,168,232,0.08)',
  },
  partnerNavBtnDisabled: { opacity: 0.35 },
  partnerNavBtnText: { color: '#5BA8E8', fontSize: 20, lineHeight: 22, fontWeight: '600' },
  partnerChipRow: { flexGrow: 1, gap: 8, paddingHorizontal: 2 },
  partnerChip: {
    maxWidth: 200,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    backgroundColor: 'rgba(91,168,232,0.06)',
  },
  partnerChipActive: {
    borderColor: '#5BA8E8',
    backgroundColor: 'rgba(91,168,232,0.18)',
  },
  partnerChipText: { color: '#95A8BD', fontSize: 13 },
  partnerChipTextActive: { color: '#E8F0F8', fontWeight: '600' },
  switchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  switchingText: { color: '#5BA8E8', fontSize: 14 },
  preAssessmentCallout: {
    borderWidth: 1,
    borderColor: 'rgba(91, 168, 232, 0.35)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(91, 168, 232, 0.08)',
  },
  preAssessmentCalloutText: {
    color: '#C8E4FF',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 12,
  },
  preAssessmentCalloutBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
  },
  preAssessmentCalloutBtnText: { color: '#5BA8E8', fontSize: 14, fontWeight: '500' },
  stepHeader: { marginBottom: 16 },
  stepLabel: {
    color: '#5BA8E8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  stepTitle: {
    color: '#E8F0F8',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  stepBody: {
    color: '#95A8BD',
    fontSize: 14,
    lineHeight: 21,
  },
  actionsSection: { marginTop: 8 },
  actionsSectionTitle: {
    color: '#E8F0F8',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  actionCard: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#0B0F18',
  },
  actionCardTitle: {
    color: '#E8F0F8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  actionCardBody: {
    color: '#95A8BD',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 16,
  },
  secondaryActionBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
    borderRadius: 10,
  },
  secondaryActionBtnText: { color: '#5BA8E8', fontSize: 15, fontWeight: '500' },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#0B0F18',
  },
  cardHeading: { color: '#E8F0F8', fontSize: 17, fontWeight: '600', marginBottom: 6 },
  cardMeta: { color: '#7A9ABE', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  cardSubheading: { color: '#5BA8E8', fontSize: 14, marginBottom: 6 },
  cardBody: { color: '#95A8BD', fontSize: 14, lineHeight: 21, marginBottom: 10 },
  scoreBig: {
    color: '#E8F0F8',
    fontSize: 42,
    fontWeight: '300',
    textAlign: 'center',
    marginVertical: 12,
  },
  pending: { color: '#95A8BD', fontSize: 15, lineHeight: 22 },
  barRow: { marginBottom: 10 },
  barLabel: { color: '#C8E4FF', fontSize: 13, marginBottom: 4 },
  barTrack: {
    height: 8,
    backgroundColor: 'rgba(82,142,220,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: 8, backgroundColor: '#5BA8E8' },
  barPct: { color: '#95A8BD', fontSize: 12, marginTop: 4, textAlign: 'right' },
  reportCallout: {
    borderWidth: 1,
    borderColor: 'rgba(91, 168, 232, 0.35)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(91, 168, 232, 0.08)',
  },
  reportCalloutTitle: {
    color: '#E8F0F8',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  reportCalloutBody: {
    color: '#C8E4FF',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  reportCalloutBodySpaced: { marginTop: 10 },
  reportDownloadTop: { marginBottom: 20 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(82,142,220,0.2)',
    marginVertical: 20,
  },
  feedbackTitle: { color: '#E8F0F8', fontSize: 18, marginBottom: 10, textAlign: 'center' },
  feedbackSection: {
    marginTop: 8,
    marginBottom: 24,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.2)',
  },
  feedbackSavedText: {
    color: '#78DCA0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  feedbackIntro: {
    color: '#95A8BD',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 16,
  },
  questionLabel: { color: '#C8E4FF', fontSize: 15, lineHeight: 22, marginBottom: 10, marginTop: 8 },
  sliderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    minWidth: 34,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    alignItems: 'center',
  },
  chipActive: { borderColor: '#5BA8E8', backgroundColor: 'rgba(91,168,232,0.2)' },
  chipText: { color: '#95A8BD', fontSize: 13 },
  chipTextActive: { color: '#E8F0F8' },
  optionGroup: { marginBottom: 8 },
  choice: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  choiceActive: { borderColor: '#5BA8E8', backgroundColor: 'rgba(91,168,232,0.12)' },
  choiceText: { color: '#95A8BD' },
  choiceTextActive: { color: '#E8F0F8' },
  textArea: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    padding: 12,
    color: '#E8F0F8',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  upsell: { marginTop: 24 },
  upsellTitle: { color: '#E8F0F8', fontSize: 20, marginBottom: 10, textAlign: 'center' },
  upsellBody: { color: '#95A8BD', fontSize: 15, lineHeight: 22, marginBottom: 20 },
  comparePartnerTitle: {
    color: '#E8F0F8',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  comparePartnerBody: {
    color: '#95A8BD',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 14,
  },
  comparePartnerBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
    borderRadius: 10,
  },
  comparePartnerBtnText: { color: '#5BA8E8', fontSize: 15, fontWeight: '500' },
});
