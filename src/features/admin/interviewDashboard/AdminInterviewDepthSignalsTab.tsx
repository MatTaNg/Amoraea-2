import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { computeGateResultCore, GATE_PASS_WEIGHTED_MIN, REFERRAL_WEIGHTED_PASS_MIN } from '@features/aria/computeGateResultCore';
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
  disclosureAdminColor,
  egoLevelAdminColor,
  EGO_LEVEL_ADMIN_SHORT_DESC,
} from '@features/admin/interviewDashboard/adminInterviewDashboardDisplayUtils';
import { parseGateFailDetailRow, reviewFlagsFromStoredAttempt } from '@features/admin/interviewDashboard/adminInterviewDashboardGateDisplay';
import { formatScoreCell, pillarScoresForGate } from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';
import type { AttemptRow } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';
import { ADMIN_REVIEW_FLAG_DESCRIPTIONS } from '@features/admin/interviewDashboard/adminInterviewReviewFlagDescriptions';

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
  const defenseActiveCount = [
    dp.projection_detected,
    dp.rationalization_detected,
    dp.splitting_detected,
    dp.denial_detected,
  ].filter(Boolean).length;
  const flags = reviewFlagsFromStoredAttempt(attempt);
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

  return (
    <ScrollView style={styles.innerTabContent}>
      <ScoreReceiptCard attempt={attempt} user={user} variant="dark" />
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
        <Text style={styles.metaValue}>
          {detailThreshold.toFixed(1)}
          {detailThreshold <= REFERRAL_WEIGHTED_PASS_MIN + 0.01 ? ' (referral band)' : ' (standard)'}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Also</Text>
        <Text style={[styles.metaValue, { fontSize: 12, color: 'rgba(255,255,255,0.55)' }]}>
          Referral minimum {REFERRAL_WEIGHTED_PASS_MIN.toFixed(1)} · Standard {GATE_PASS_WEIGHTED_MIN.toFixed(1)}
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
        <Text style={styles.blockTitle}>Ego development level</Text>
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
            <Text style={styles.depthSignalFootnote}>
              {`Holistic assessment of response sophistication across the full interview. Based on Loevinger's ego development framework — measures the complexity and maturity of how someone makes meaning of relational situations.\n\nLevel 1 — Concrete and rule-based. Black and white framing. Characters are simply right or wrong. No complexity held.\nLevel 2 — Aware of multiple perspectives but resolves them simplistically. "Both people need to communicate better." Gate modifier: -0.2.\nLevel 3 — Holds complexity without resolving it prematurely. Recognizes patterns. Uses psychological concepts naturally.\nLevel 4 — Integrates contradictions. Connects behavior to broader relational patterns. Tolerates ambiguity.\nLevel 5 — Systemic relational understanding. Recognizes how internal states drive patterns across relationships.\n\nLevel 1 with weighted score below 7.0 = gate fail. Level 1 with passing score = review flag. Level 2 = -0.2 score modifier applied.`}
            </Text>
          </>
        ) : (
          <Text style={styles.blockText}>—</Text>
        )}
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <Text style={styles.blockTitle}>Emotion recognition</Text>
        {legacyErFloorReview ? (
          <Text style={[styles.blockText, { color: '#D4A84B', marginBottom: 8 }]}>
            {LEGACY_EMOTION_RECOGNITION_FLOOR_REVIEW_NOTE}
          </Text>
        ) : null}
        <Text style={styles.depthSignalFootnote}>
          Ability-based test of emotion perception. Three multiple choice items — one per scenario — ask what a character
          is most likely feeling at a key moment. Scored against consensus correct answers. Tests whether the user can
          accurately read emotional states from situational context, independent of verbal fluency.{'\n\n'}
          Emotion recognition affects the depth signal modifier only (not a hard gate fail).{'\n\n'}
          Score guide:{'\n'}
          3/3 — Strong emotion perception{'\n'}
          2/3 — Adequate, review flag{'\n'}
          1/3 — Review flag: limited emotion reading accuracy{'\n'}
          0/3 — −0.20 depth modifier (no gate fail){'\n'}
          Incomplete battery (&lt; 3 responses) — scores nulled, no modifier
        </Text>
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
        <Text style={styles.blockTitle}>Personal moment concreteness</Text>
        <Text style={styles.depthSignalFootnote}>
          {`Measures whether the user engaged with their own personal experience when asked about grudges and conflicts, or retreated to general philosophy.\n\nabsent — No personal example provided. Deflected or claimed no relevant experience.\nlow — Vague reference to a type of situation with no named person or specific event.\nmoderate — Specific person or situation named but thin on narrative detail or emotional content.\nhigh — Specific person named, concrete event described, emotional content present, personal reflection shown.\n\nBoth absent or low applies a score penalty. Users who give rich scenario responses but consistently avoid personal engagement are showing low private self-awareness.`}
        </Text>
        <Text style={[styles.blockText, { color: concretenessAdminColor(attempt.moment_4_concreteness ?? undefined) }]}>
          Moment 4: {attempt.moment_4_concreteness ?? '—'}
        </Text>
        <Text style={[styles.blockText, { color: concretenessAdminColor(attempt.moment_5_concreteness ?? undefined) }]}>
          Moment 5: {attempt.moment_5_concreteness ?? '—'}
        </Text>
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <Text style={styles.blockTitle}>Mentalizing overcertainty</Text>
        <Text style={styles.depthSignalFootnote}>
          {`Flags responses where the user states characters' internal states as facts rather than inferences. Genuine high-level mentalizing requires holding uncertainty about others' inner lives — "Ryan might be avoiding tension" is healthy inference; "Ryan clearly doesn't care" is overcertainty.\n\nTrigger examples: "clearly doesn't care," "he's never going to change," "definitely emotionally unavailable," "the type of person who can't," attachment diagnoses stated as fact.\n\nWhen flagged: mentalizing score capped at 7 for that scenario. Count of 2+ adds a review flag.`}
        </Text>
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
        <Text style={styles.blockTitle}>Personal moment emotional vocabulary</Text>
        <Text style={styles.depthSignalFootnote}>
          {`Measures whether the user uses emotional vocabulary words when describing their own personal experiences — words that name or characterize internal emotional states (angry, hurt, ashamed, proud, anxious, relieved, etc.).\n\nCompares emotional vocabulary density in personal moment responses against scenario responses. A significant gap — analytically rich in scenarios but emotionally flat in personal moments — signals possible alexithymia: difficulty accessing or describing one's own feelings.\n\nNormal — density is adequate or consistent with scenario responses.\nLow — personal moment emotional vocabulary significantly below scenario average. Review flag when combined with low concreteness.`}
        </Text>
        <Text style={styles.blockText}>
          {attempt.personal_moment_emotional_vocab_low === true ? 'Low ⚑' : 'Normal ✓'}
        </Text>
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <Text style={styles.blockTitle}>Disclosure calibration</Text>
        <Text style={styles.depthSignalFootnote}>
          {`Assesses whether the user's personal moment disclosures were appropriate for the interview context — neither too guarded nor overwhelming.\n\nCalibrated — personal disclosures were specific and emotionally honest without being either avoidant or excessive. No flag.\n\nUnderdisclosure — personal responses significantly shorter and less specific than scenario responses, with both moments at absent or low concreteness. The user engages analytically with fictional others but closes down when asked about their own experience. Signals low private self-awareness or experiential avoidance.\n\nOverdisclosure — personal responses exceeded appropriate scope: very high word count, unsolicited clinical trauma vocabulary, or extensive detail about third parties not relevant to the question. Signals poor social calibration or boundary awareness. Adds overdisclosure_review flag.`}
        </Text>
        <Text
          style={[
            styles.blockText,
            { color: disclosureAdminColor(attempt.disclosure_calibration ?? undefined), textTransform: 'capitalize' },
          ]}
        >
          {attempt.disclosure_calibration
            ? String(attempt.disclosure_calibration).replace(/_/g, ' ')
            : '—'}
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Section D — Defense patterns</Text>
      <Text style={[styles.depthSignalFootnote, { marginTop: 4, marginBottom: 6 }]}>
        {`Cross-scenario detection of immature psychological defenses. Each flag fires when a consistent pattern is detected across the full interview. Individual flags apply a -0.1 score modifier. Three or more flags active simultaneously applies an additional penalty and triggers gate fail consideration.`}
      </Text>
      <View style={styles.defenseGrid}>
        {(
          [
            [
              'Projection',
              'projection_detected' as const,
              `User attributes qualities to fictional characters that their own personal moment responses demonstrate about themselves. e.g. calling Daniel conflict-avoidant while describing their own pattern of going quiet when overwhelmed.`,
            ],
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
        {defenseActiveCount} of 4 immature defense patterns detected.
      </Text>
      {defenseActiveCount >= 3 ? (
        <View style={[styles.block, { marginTop: 10, borderLeftWidth: 4, borderLeftColor: '#E87A7A' }]}>
          <Text style={[styles.blockText, { color: '#F5A8A8', fontWeight: '600' }]}>
            High defense pattern load — automatic gate fail triggered.
          </Text>
        </View>
      ) : null}

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

          {defenseCrossRef.flags.length === 0 ? (
            <Text style={styles.blockText}>No cross-reference flags.</Text>
          ) : (
            defenseCrossRef.flags.map((flag) => (
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
            ))
          )}
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.blockText}>Defense cross-reference not computed for this attempt.</Text>
        </View>
      )}
    </ScrollView>
  );
}
