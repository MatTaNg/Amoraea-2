import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { computeGateResultCore, GATE_PASS_WEIGHTED_MIN } from '@features/aria/computeGateResultCore';
import { DEFAULT_DEFENSE_PATTERNS } from '@features/aria/defensePatternsDetection';
import {
  EMOTION_INTERVIEW_MODAL_ITEMS,
  EMOTION_ITEM_CORRECT_ANSWERS,
  EXPECTED_EMOTION_RECOGNITION_ITEMS,
  countAnsweredEmotionItems,
  emotionRecognitionCorrectCount,
  hydrateEmotionResponsesFromStorage,
  isEmotionRecognitionBatteryComplete,
  isLegacyEmotionRecognitionFloorOnlyFail,
  LEGACY_EMOTION_RECOGNITION_FLOOR_REVIEW_NOTE,
  emotionRecognitionDisplayPercentFromAttemptsRow,
} from '@features/aria/emotionRecognitionInterview';
import { GamingCorrectionBanner, GamingCorrectionCard } from '@features/admin/GamingCorrectionCard';
import { ScoreReceiptCard } from '@features/admin/ScoreReceiptCard';
import { UncertaintyScoreCard } from '@features/admin/UncertaintyScoreCard';
import type { AdminUserProfileRecord } from '@app/screens/admin/AdminProfileAssessmentTabs';
import {
  adminMentalizingOvercertaintyLabels,
  buildAdminGateComputeOptions,
} from '@features/admin/interviewDashboard/adminInterviewAttemptAdminUtils';
import { detailTabStyles as styles } from '@features/admin/interviewDashboard/adminInterviewDetailTabStyles';
import {
  concretenessAdminColor,
  defenseCrossRefConfidenceColor,
  defenseCrossRefConsistencyLabel,
  egoLevelAdminColor,
  EGO_LEVEL_ADMIN_SHORT_DESC,
} from '@features/admin/interviewDashboard/adminInterviewDashboardDisplayUtils';
import { parseGateFailDetailRow, reviewFlagsFromStoredAttempt } from '@features/admin/interviewDashboard/adminInterviewDashboardGateDisplay';
import { formatScoreCell, pillarScoresForGate } from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';
import type { AttemptRow } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';
import { ADMIN_REVIEW_FLAG_DESCRIPTIONS } from '@features/admin/interviewDashboard/adminInterviewReviewFlagDescriptions';
import { collectAdminNegativeScoreModifiers } from '@features/admin/interviewDashboard/adminInterviewDepthModifierSummary';
import {
  buildSuppressedDepthModifierNotice,
  countAdminScoringDefensePatterns,
  filterDeprecatedAdminReviewFlags,
  formatDisclosureCalibrationForAdmin,
} from '@features/admin/interviewDashboard/adminDeprecatedDepthConstructs';
import { AdminGlossaryHeading, AdminInlineGlossaryIcon } from '@features/admin/interviewDashboard/AdminInlineGlossaryIcon';
import { DEPTH_SIGNAL_GLOSSARY } from '@features/admin/interviewDashboard/adminScoringGlossary';

export function AdminInterviewDepthSignalsTab({
  attempt,
  user,
}: {
  attempt: AttemptRow;
  user?: AdminUserProfileRecord | null;
}) {
  const pillars = pillarScoresForGate(attempt);
  const gateEcho = computeGateResultCore(pillars, null, buildAdminGateComputeOptions(attempt));
  const dp = attempt.defense_patterns ?? DEFAULT_DEFENSE_PATTERNS;
  const defenseActiveCount = countAdminScoringDefensePatterns(dp);
  const flags = filterDeprecatedAdminReviewFlags(reviewFlagsFromStoredAttempt(attempt));
  const hasFlags = flags.length > 0;
  const legacyErFloorReview = isLegacyEmotionRecognitionFloorOnlyFail(attempt);
  const responses = hydrateEmotionResponsesFromStorage(attempt.emotion_recognition_responses);
  const emotionBatteryComplete = isEmotionRecognitionBatteryComplete(responses);
  const correctN = emotionRecognitionCorrectCount(responses);
  const pct = emotionRecognitionDisplayPercentFromAttemptsRow({
    emotion_recognition_raw_score: attempt.emotion_recognition_raw_score,
    emotion_recognition_responses: attempt.emotion_recognition_responses,
  });
  const egoLevel =
    typeof attempt.ego_development_level === 'number' && Number.isFinite(attempt.ego_development_level)
      ? Math.round(attempt.ego_development_level)
      : null;
  const depthModifier =
    attempt.depth_signal_modifier ?? attempt.score_modifier ?? gateEcho.depthSignalModifier ?? gateEcho.scoreModifier;
  const psychometricModifier = attempt.psychometric_modifier_applied;
  const correctedPsychometricModifier =
    attempt.corrected_psychometric_modifier ?? psychometricModifier;
  const finalModified =
    attempt.modified_weighted_score_with_psychometrics ??
    attempt.modified_weighted_score ??
    attempt.weighted_score;
  const sm = depthModifier;
  const scoreModNonZero = typeof sm === 'number' && Number.isFinite(sm) && sm !== 0;
  const defenseCrossRef = attempt.defense_cross_reference ?? null;
  const gateEchoDepthModifier =
    gateEcho.depthSignalModifier ?? gateEcho.scoreModifier ?? 0;
  const crossRefModifierAdjustment = defenseCrossRef?.modifierAdjustment ?? 0;
  const wReq = parseGateFailDetailRow(attempt)?.weighted_score?.requiredMin;
  const detailThreshold =
    typeof wReq === 'number' && Number.isFinite(wReq) ? wReq : GATE_PASS_WEIGHTED_MIN;
  const overcertaintyLabels = adminMentalizingOvercertaintyLabels(attempt);
  const negativeModifiers = collectAdminNegativeScoreModifiers(attempt, gateEcho);
  const suppressedModifierNotice = buildSuppressedDepthModifierNotice(attempt);
  const disclosureLabel = formatDisclosureCalibrationForAdmin(attempt.disclosure_calibration);

  return (
    <ScrollView style={styles.innerTabContent}>
      <ScoreReceiptCard attempt={attempt} user={user} variant="dark" />
      {negativeModifiers.length > 0 ? (
        <View style={[styles.block, { marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#E87A7A' }]}>
          <Text style={[styles.blockTitle, { marginBottom: 8 }]}>Score-reducing modifiers (ranked)</Text>
          {negativeModifiers.map((item, index) => (
            <Text key={item.id} style={[styles.blockText, index > 0 ? { marginTop: 6 } : null]}>
              {index + 1}. {item.label}: {item.value.toFixed(2)}
            </Text>
          ))}
        </View>
      ) : null}
      <GamingCorrectionBanner gamingCorrection={attempt.gaming_correction ?? null} />
      <UncertaintyScoreCard
        uncertaintyScore={attempt.uncertainty_score ?? null}
        breakdown={
          (attempt.uncertainty_breakdown as import('@features/psychometrics/computeUncertaintyScore').UncertaintyBreakdown | null) ??
          null
        }
      />
      <Text style={styles.sectionTitle}>Section A — Score modifiers</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Raw weighted score</Text>
        <Text style={styles.metaValue}>{formatScoreCell(attempt.weighted_score)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Depth signal modifier</Text>
        <Text
          style={[
            styles.metaValue,
            { color: typeof depthModifier === 'number' && depthModifier < 0 ? '#E87A7A' : typeof depthModifier === 'number' && depthModifier === 0 ? '#2A8C6A' : '#f4f4f5' },
          ]}
        >
          {typeof depthModifier === 'number' && Number.isFinite(depthModifier) ? depthModifier.toFixed(2) : '—'}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Psychometric modifier (raw)</Text>
        <Text style={styles.metaValue}>
          {psychometricModifier != null && Number.isFinite(psychometricModifier)
            ? psychometricModifier.toFixed(2)
            : 'pending'}
        </Text>
      </View>
      {correctedPsychometricModifier != null &&
      psychometricModifier != null &&
      correctedPsychometricModifier !== psychometricModifier ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Psychometric modifier (corrected)</Text>
          <Text style={styles.metaValue}>{correctedPsychometricModifier.toFixed(2)}</Text>
        </View>
      ) : null}
      <GamingCorrectionCard
        gamingCorrection={attempt.gaming_correction ?? null}
        variant="dark"
      />
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Final score (with psychometrics)</Text>
        <Text style={styles.metaValue}>{formatScoreCell(finalModified)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Modified weighted score (interview only)</Text>
        <Text style={styles.metaValue}>{formatScoreCell(attempt.modified_weighted_score)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Threshold (this attempt)</Text>
        <Text style={styles.metaValue}>{detailThreshold.toFixed(1)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Pass minimum</Text>
        <Text style={[styles.metaValue, { fontSize: 12, color: 'rgba(255,255,255,0.55)' }]}>
          {GATE_PASS_WEIGHTED_MIN.toFixed(1)}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Final gate</Text>
        <Text style={[styles.metaValue, { color: attempt.final_gate_pass === true ? '#2A8C6A' : attempt.final_gate_pass === false ? '#E87A7A' : '#7A9ABE' }]}>
          {attempt.final_gate_pass != null
            ? attempt.final_gate_pass
              ? 'PASS'
              : 'FAIL'
            : psychometricModifier != null
              ? 'pending psychometrics'
              : '—'}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Interview gate (pre-psychometric)</Text>
        <Text style={[styles.metaValue, { color: attempt.passed === true ? '#2A8C6A' : attempt.passed === false ? '#E87A7A' : '#7A9ABE' }]}>
          {attempt.passed === true ? 'PASS' : attempt.passed === false ? 'FAIL' : '—'}
        </Text>
      </View>
      {scoreModNonZero ? (
        <View style={[styles.block, { marginTop: 8 }]}>
          <Text style={styles.blockTitle}>Modifier breakdown (recomputed)</Text>
          <Text style={styles.blockText}>
            Ego development modifier:{' '}
            {gateEcho.egoDevelopmentModifier != null ? gateEcho.egoDevelopmentModifier.toFixed(2) : '—'}
          </Text>
          <Text style={styles.blockText}>
            Defense pattern modifier:{' '}
            {gateEcho.defensePatternScoreAdjustment != null ? gateEcho.defensePatternScoreAdjustment.toFixed(2) : '0.00'}
          </Text>
          <Text style={styles.blockText}>
            Personal moment concreteness modifier:{' '}
            {gateEcho.personalMomentConcretenessModifier != null
              ? gateEcho.personalMomentConcretenessModifier.toFixed(2)
              : '—'}
          </Text>
          {suppressedModifierNotice ? (
            <Text style={[styles.blockText, { marginTop: 8, color: '#D4A84B' }]}>
              {suppressedModifierNotice}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text style={[styles.depthSignalFootnote, { marginTop: scoreModNonZero ? 6 : 10 }]}>
        Score modifiers are applied to the raw weighted score before the pass threshold comparison. They reflect
        structural features of the interview profile — defensive patterns, psychological maturity, and personal moment
        engagement quality — that the pillar scores don't fully capture individually.{'\n\n'}
        A passing weighted score can still result in a fail or review flag when modifiers are active. A borderline score
        can drop below threshold when multiple modifiers accumulate.
      </Text>

      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Section B — Review flags</Text>
      <View
        style={[
          styles.block,
          hasFlags && {
            borderWidth: 1,
            borderColor: 'rgba(212, 168, 75, 0.55)',
            backgroundColor: 'rgba(212, 168, 75, 0.08)',
          },
        ]}
      >
        {!hasFlags ? (
          <Text style={styles.blockText}>No review flags.</Text>
        ) : (
          flags.map((f) => (
            <View key={f} style={{ marginBottom: 10 }}>
              <Text style={[styles.blockTitle, { fontSize: 13, marginBottom: 4 }]}>{f}</Text>
              <Text style={styles.blockText}>{ADMIN_REVIEW_FLAG_DESCRIPTIONS[f] ?? '—'}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Section C — New pillar dimensions</Text>
      <View style={styles.block}>
        <AdminGlossaryHeading
          title="Ego development level"
          glossaryText={DEPTH_SIGNAL_GLOSSARY.ego_development_level}
          titleStyle={styles.blockTitle}
        />
        {egoLevel != null && egoLevel >= 1 && egoLevel <= 5 ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <View
                  key={n}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: n === egoLevel ? egoLevelAdminColor(egoLevel) : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: n === egoLevel ? egoLevelAdminColor(egoLevel) : 'rgba(255,255,255,0.12)',
                  }}
                >
                  <Text style={{ color: n === egoLevel ? '#0a0a0f' : 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 12 }}>
                    {n}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={[styles.blockText, { fontSize: 12, color: 'rgba(255,255,255,0.65)' }]}>
              {EGO_LEVEL_ADMIN_SHORT_DESC[egoLevel] ?? ''}
            </Text>
          </>
        ) : (
          <Text style={styles.blockText}>—</Text>
        )}
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <AdminGlossaryHeading
          title="Emotion recognition battery"
          glossaryText={DEPTH_SIGNAL_GLOSSARY.emotion_recognition_battery}
          titleStyle={styles.blockTitle}
        />
        {legacyErFloorReview ? (
          <Text style={[styles.blockText, { color: '#D4A84B', marginBottom: 8 }]}>
            {LEGACY_EMOTION_RECOGNITION_FLOOR_REVIEW_NOTE}
          </Text>
        ) : null}
        <Text style={styles.blockText}>
          {!emotionBatteryComplete && countAnsweredEmotionItems(responses) > 0
            ? `Incomplete battery (${countAnsweredEmotionItems(responses)}/${EXPECTED_EMOTION_RECOGNITION_ITEMS} recorded)`
            : correctN != null
              ? `${correctN} of 3 correct`
              : countAnsweredEmotionItems(responses) === 0
                ? 'No responses recorded'
                : 'Incomplete battery'}
          {pct != null ? ` · ${pct}%` : emotionBatteryComplete ? '' : ''}
        </Text>
        {EMOTION_INTERVIEW_MODAL_ITEMS.map((_item, i) => {
          const userAns = responses[i]?.trim() ? responses[i]!.trim().toUpperCase() : '—';
          const correctLetter = EMOTION_ITEM_CORRECT_ANSWERS[i];
          const ok = userAns === correctLetter;
          const label = i === 0 ? 'Item 1 (Emma/Ryan)' : i === 1 ? 'Item 2 (Sarah/James)' : 'Item 3 (Sophie/Daniel)';
          return (
            <Text key={i} style={[styles.blockText, { marginTop: 6 }]}>
              {label}: User answered {userAns} — Correct: {correctLetter}{' '}
              {userAns === '—' ? '(missing)' : ok ? '✓' : '✗'}
            </Text>
          );
        })}
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <AdminGlossaryHeading
          title="Personal moment concreteness (M4/M5)"
          glossaryText={DEPTH_SIGNAL_GLOSSARY.personal_moment_concreteness}
          titleStyle={styles.blockTitle}
        />
        <Text style={[styles.blockText, { color: concretenessAdminColor(attempt.moment_4_concreteness ?? undefined) }]}>
          Moment 4: {attempt.moment_4_concreteness ?? '—'}
        </Text>
        <Text style={[styles.blockText, { color: concretenessAdminColor(attempt.moment_5_concreteness ?? undefined) }]}>
          Moment 5: {attempt.moment_5_concreteness ?? '—'}
        </Text>
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <AdminGlossaryHeading
          title="Mentalizing overcertainty"
          glossaryText={DEPTH_SIGNAL_GLOSSARY.mentalizing_overcertainty}
          titleStyle={styles.blockTitle}
        />
        <Text style={styles.blockText}>
          {typeof attempt.mentalizing_overcertainty_count === 'number'
            ? `${attempt.mentalizing_overcertainty_count} moments flagged for overcertainty`
            : '—'}
        </Text>
        {overcertaintyLabels.length > 0 ? (
          <Text style={[styles.blockText, { marginTop: 6 }]}>{overcertaintyLabels.join(' · ')}</Text>
        ) : null}
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <AdminGlossaryHeading
          title="Disclosure calibration"
          glossaryText={DEPTH_SIGNAL_GLOSSARY.disclosure_calibration}
          titleStyle={styles.blockTitle}
        />
        <Text
          style={[
            styles.blockText,
            {
              color: disclosureLabel === 'Underdisclosure' ? '#D4A84B' : disclosureLabel === 'Calibrated' ? '#2A8C6A' : '#7A9ABE',
            },
          ]}
        >
          {disclosureLabel}
        </Text>
        {suppressedModifierNotice ? (
          <Text style={[styles.blockText, { marginTop: 8, color: '#D4A84B' }]}>{suppressedModifierNotice}</Text>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Section D — Defense patterns</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4, marginBottom: 6 }}>
        <Text style={[styles.depthSignalFootnote, { marginTop: 0, marginBottom: 0, flex: 1 }]}>
          Rationalization, splitting, and denial stack: 1 flag −0.1, 2 flags −0.2, 3 flags −0.35. Two flags adds
          defense_pattern_review.
        </Text>
        <AdminInlineGlossaryIcon
          text={DEPTH_SIGNAL_GLOSSARY.defense_patterns}
          accessibilityLabel="Explain defense patterns"
        />
      </View>
      <View style={styles.defenseGrid}>
        {(
          [
            [
              'Rationalization',
              'rationalization_detected' as const,
              `User provides elaborate logical justifications for why repair isn't needed or why the accountable character bears no responsibility. Detected when repair refusal appears alongside extended explanatory content placing full blame elsewhere.`,
            ],
            [
              'Splitting',
              'splitting_detected' as const,
              `User consistently assigns all fault to one character across scenarios with no bilateral acknowledgment. One party is always entirely at fault, the other always blameless. Detected when accountability scores are consistently one-sided across all three scenarios.`,
            ],
            [
              'Denial',
              'denial_detected' as const,
              `User claims no conflicts, grudges, or negative experiences in personal moments while scenario responses show contemptuous or externalizing patterns. The gap between claimed equanimity and demonstrated contempt is the signal.`,
            ],
          ] as const
        ).map(([label, key, footnote]) => {
          const active = dp[key] === true;
          return (
            <View
              key={key}
              style={[
                styles.defenseGridCell,
                { borderColor: active ? 'rgba(232, 122, 122, 0.55)' : 'rgba(255,255,255,0.12)' },
              ]}
            >
              <Text style={styles.defenseGridTitle}>{label}</Text>
              <Text style={[styles.defenseGridState, { color: active ? '#E87A7A' : 'rgba(255,255,255,0.45)' }]}>
                {active ? 'DETECTED' : 'clear'}
              </Text>
              <Text style={styles.defenseCardFootnote}>{footnote}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.blockText, { marginTop: 10 }]}>
        {defenseActiveCount} of 3 immature defense patterns detected.
      </Text>

      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Defense cross-reference</Text>
      <Text style={[styles.depthSignalFootnote, { marginTop: 4, marginBottom: 6 }]}>
        Cross-validates NLP defense pattern detections against self-report psychometric scores. When
        behavioral detection and self-report diverge, modifier penalties may be partially reversed and
        admin review is recommended.
      </Text>
      {defenseCrossRef ? (
        <View style={styles.block}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Text style={styles.blockTitle}>Overall confidence</Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: `${defenseCrossRefConfidenceColor(defenseCrossRef.overallConfidence)}22`,
                borderWidth: 1,
                borderColor: defenseCrossRefConfidenceColor(defenseCrossRef.overallConfidence),
              }}
            >
              <Text
                style={{
                  color: defenseCrossRefConfidenceColor(defenseCrossRef.overallConfidence),
                  fontWeight: '700',
                  fontSize: 12,
                  textTransform: 'uppercase',
                }}
              >
                {defenseCrossRef.overallConfidence}
              </Text>
            </View>
          </View>

          {defenseCrossRef.recommendAdminReview ? (
            <View
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                backgroundColor: 'rgba(212, 168, 75, 0.12)',
                borderWidth: 1,
                borderColor: 'rgba(212, 168, 75, 0.55)',
              }}
            >
              <Text style={{ color: '#D4A84B', fontWeight: '700', fontSize: 13 }}>
                Admin review recommended
              </Text>
            </View>
          ) : null}

          {crossRefModifierAdjustment !== 0 ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.blockTitle}>Modifier adjustment</Text>
              <Text style={styles.blockText}>
                Pre-cross-reference depth modifier: {gateEchoDepthModifier.toFixed(2)}
              </Text>
              <Text style={styles.blockText}>
                Cross-reference adjustment: +{crossRefModifierAdjustment.toFixed(2)}
              </Text>
              <Text style={styles.blockText}>
                Adjusted depth modifier: {typeof depthModifier === 'number' ? depthModifier.toFixed(2) : '—'}
              </Text>
            </View>
          ) : null}

          {defenseCrossRef.flags
            .filter((flag) => !String(flag.defense).includes('projection'))
            .map((flag) => (
              <View
                key={flag.flagName}
                style={{
                  marginBottom: 12,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Text style={[styles.blockTitle, { fontSize: 13 }]}>
                  {flag.defense.replace(/_/g, ' ')} · {flag.flagName}
                </Text>
                <Text style={styles.blockText}>
                  Detected: {flag.detected ? 'yes' : 'no'} · Self-report:{' '}
                  {defenseCrossRefConsistencyLabel(flag.selfReportConsistent)} · Confidence:{' '}
                  <Text style={{ color: defenseCrossRefConfidenceColor(flag.confidenceLevel) }}>
                    {flag.confidenceLevel}
                  </Text>
                </Text>
                <Text style={[styles.blockText, { marginTop: 4 }]}>{flag.description}</Text>
                {flag.flagName === 'defense_possible_false_negative' ? (
                  <Text style={[styles.blockText, { marginTop: 6, color: '#D4A84B' }]}>
                    Psychometric profile suggests possible missed defense detection in interview. No
                    behavioral detection occurred but self-report pattern warrants review.
                  </Text>
                ) : null}
              </View>
            ))}
          {defenseCrossRef.flags.filter((flag) => !String(flag.defense).includes('projection')).length === 0 ? (
            <Text style={styles.blockText}>No cross-reference flags.</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.blockText}>Defense cross-reference not computed for this attempt.</Text>
        </View>
      )}
    </ScrollView>
  );
}
