import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { supabase } from '@data/supabase/client';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { confirmAsync } from '@utilities/alerts/confirmDialog';
import { formatEdgeFunctionInvokeFailure } from '@utilities/runCommunicationStylePipeline';
import { resolveAdminInterviewIntroDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import { adminRetryNarrativeWithClientFallback, fetchAttemptNarrativeState } from '@utilities/adminRetryNarrativeWithClientFallback';
import { remoteLog } from '@utilities/remoteLog';
import {
  describeCertaintyAmbiguityAxis,
  describeEmotionalAnalyticalAxis,
  describeExpressivenessAxis,
  describeNarrativeConceptualAxis,
  describeRelationalIndividualAxis,
  describeWarmthAxis,
  styleProfileFromDbRow,
  translateStyleProfile,
} from '@utilities/styleTranslations';
import { COMMUNICATION_FLOOR_MIN_AVG_WORDS } from '@features/aria/communicationFloorFromTranscript';
import { computeGateResultCore } from '@features/aria/computeGateResultCore';
import { formatGateFailureLines } from '@features/aria/adminGateDisplay';
import {
  computePillarScoreDelta,
  recalculateAttemptScoresFromStoredSlices,
  snapshotAttemptScoresForAudit,
} from '@features/aria/adminRecalculateAttemptScores';
import { buildRecalculationConsistencyPatch } from '@features/aria/recalculationPersistConsistency';
import { evaluateInterviewCompletionGate } from '@features/aria/interviewCompletionGate';
import { describeScoringStagesIncomplete } from '@features/admin/interviewDashboard/adminInterviewDashboardGateDisplay';
import { ScoreReceiptCard } from '@features/admin/ScoreReceiptCard';
import { applyPsychometricModifierToAttempt } from '@features/psychometrics/applyPsychometricModifier';
import { PSYCHOMETRICS_ENABLED } from '@features/psychometrics/interviewCompletionStatus';
import { normalizeGateFailDetailForPersist } from '@features/psychometrics/gateFailDetailForPersist';
import { preparePsychometricFloorGateState } from '@features/psychometrics/preparePsychometricFloorGateState';
import {
  ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES,
  extractPsychometricFloorsFromGateDetail,
  formatPsychometricGateFailDescription,
  getRetroactivePsychometricFloorReviews,
  psychometricFloorScoreForUser,
} from '@features/psychometrics/psychometricFloorBreaches';
import {
  MARKER_IDS,
  PILLAR_ROWS,
} from '@features/admin/interviewDashboard/adminInterviewDashboardConstants';
import {
  adminAttemptEligibleForNarrativeAutoRetry,
  adminAiNarrativeStillPending,
  adminAttemptHasHolisticOnlyTraitScoresNoScenarioSlices,
  adminAttemptHasSubstantiveAiReasoning,
  adminNarrativeAutoRetryFinishedAttempts,
  adminNarrativeAutoRetryInFlight,
  buildAdminGateComputeOptions,
  buildCommunicationStyleTranscriptOptionsForAdmin,
  buildMomentOrScenarioSummary,
  computeMarkerAggregateFromAttempt,
  fetchCommunicationStyleProfileRowForAdmin,
  fetchCommunicationStyleProfileRowForAdminWithInitialPoll,
  formatAttemptElapsedDisplay,
  functionInvokeBodyError,
  getMomentScoreBundle,
  getScoreBundleDetails,
  markerIsAssessedInSection,
  reconcileStaleReasoningPendingOnAdminView,
} from '@features/admin/interviewDashboard/adminInterviewAttemptAdminUtils';
import {
  getAlmostPassColor,
  parseGateFailDetailRow,
  resolveAdminPrimaryOutcomeDisplay,
} from '@features/admin/interviewDashboard/adminInterviewDashboardGateDisplay';
import {
  coerceScoreNumber,
  formatScoreCell,
  getResolvedPillarScores,
  normalizePillarScoresMap,
  parseObject,
  pillarScoresForGate,
  sliceContemptDisplayValue,
} from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';
import type {
  AttemptRow,
  CommunicationStyleProfileRow,
  UserRow,
} from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';
import { summaryTabStyles } from '@features/admin/interviewDashboard/adminInterviewSummaryTabStyles';
import type { AdminUserProfileRecord } from '@app/screens/admin/AdminProfileAssessmentTabs';

function formatAttemptDate(attempt: { completed_at: string | null; created_at: string }): string {
  const raw = attempt.completed_at ?? attempt.created_at;
  if (!raw) return '—';
  return new Date(raw).toLocaleString('en-GB');
}

function asAdminStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}

export function AdminInterviewSummaryTab({
  attempt,
  onAttemptMutated,
  candidateUser,
  profileUser,
}: {
  attempt: AttemptRow;
  onAttemptMutated?: () => void;
  /** User row for confirmation dialog (optional when viewing attempt outside cohort drill-down). */
  candidateUser?: UserRow | null;
  profileUser?: AdminUserProfileRecord | null;
}) {
  const [styleProfile, setStyleProfile] = useState<CommunicationStyleProfileRow | null>(null);
  const [styleStatus, setStyleStatus] = useState<'idle' | 'loading' | 'reprocessing'>('idle');
  const [stylePipelineErrorDisplay, setStylePipelineErrorDisplay] = useState<string | null>(
    attempt.communication_style_error ?? null
  );
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [narrativeAutoRetrying, setNarrativeAutoRetrying] = useState(
    () =>
      adminAttemptEligibleForNarrativeAutoRetry(attempt) &&
      !adminNarrativeAutoRetryFinishedAttempts.has(attempt.id),
  );
  const [narrativeAutoRetryError, setNarrativeAutoRetryError] = useState<string | null>(null);
  /** Fresh DB check on open — avoids flashing "not ready" when narrative already exists. */
  const [narrativeHydration, setNarrativeHydration] = useState<'loading' | 'ready' | 'pending'>('loading');
  const [styleAutoReprocessing, setStyleAutoReprocessing] = useState(false);
  const [adminSessionUserId, setAdminSessionUserId] = useState<string | null>(null);
  const [adminSessionEmail, setAdminSessionEmail] = useState<string | null>(null);
  const onAttemptMutatedRef = useRef(onAttemptMutated);
  onAttemptMutatedRef.current = onAttemptMutated;

  useEffect(() => {
    setStylePipelineErrorDisplay(attempt.communication_style_error ?? null);
  }, [attempt.id, attempt.communication_style_error]);

  useEffect(() => {
    const uid = typeof attempt.user_id === 'string' ? attempt.user_id.trim() : '';
    if (!uid) {
      setStyleProfile(null);
      setStyleStatus('idle');
      return;
    }
    let cancelled = false;
    setStyleStatus('loading');
    void fetchCommunicationStyleProfileRowForAdminWithInitialPoll(
      uid,
      attempt.id,
      () => !cancelled
    )
      .then((row) => {
        if (cancelled) return;
        setStyleProfile(row);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[Admin] fetchCommunicationStyleProfileRowForAdmin failed', e);
        setStyleProfile(null);
      })
      .finally(() => {
        if (!cancelled) setStyleStatus('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt.id, attempt.user_id]);

  useEffect(() => {
    const ar = parseObject(attempt.ai_reasoning);
    const primaryLabels = styleProfile?.style_labels_primary;
    const secondaryLabels = styleProfile?.style_labels_secondary;
    const labelCount =
      (Array.isArray(primaryLabels) ? primaryLabels.length : 0) +
      (Array.isArray(secondaryLabels) ? secondaryLabels.length : 0);
  }, [
    attempt,
    attempt.id,
    attempt.ai_reasoning,
    attempt.reasoning_pending,
    attempt.communication_style_error,
    styleProfile,
    attempt.weighted_score,
    attempt.modified_weighted_score,
    attempt.score_modifier,
  ]);

  const transcriptReady =
    Array.isArray(attempt.transcript) && attempt.transcript.length > 0;

  useEffect(() => {
    let cancelled = false;
    setNarrativeHydration('loading');
    void (async () => {
      const fresh = await fetchAttemptNarrativeState(attempt.id);
      if (cancelled) return;
      if (fresh.substantive) {
        setNarrativeHydration('ready');
        const updated = await reconcileStaleReasoningPendingOnAdminView(attempt);
        if (!cancelled) onAttemptMutatedRef.current?.();
        return;
      }
      setNarrativeHydration(adminAiNarrativeStillPending(attempt) ? 'pending' : 'ready');
      const updated = await reconcileStaleReasoningPendingOnAdminView(attempt);
      if (!cancelled && updated) onAttemptMutatedRef.current?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt.id]);

  useEffect(() => {
    const id = attempt.id;
    const ownerUserId = attempt.user_id;

    if (narrativeHydration === 'loading') {
      return;
    }

    if (adminNarrativeAutoRetryFinishedAttempts.has(id)) {
      setNarrativeAutoRetrying(false);
      return;
    }

    if (!transcriptReady) {
      return;
    }

    if (!adminAttemptEligibleForNarrativeAutoRetry(attempt)) {
      adminNarrativeAutoRetryFinishedAttempts.add(id);
      setNarrativeAutoRetrying(false);
      if (narrativeHydration === 'loading') {
        setNarrativeHydration(adminAiNarrativeStillPending(attempt) ? 'pending' : 'ready');
      }
      return;
    }

    if (adminNarrativeAutoRetryInFlight.has(id)) {
      return;
    }

    adminNarrativeAutoRetryInFlight.add(id);
    let cancelled = false;
    setNarrativeAutoRetrying(true);
    setNarrativeAutoRetryError(null);
    setNarrativeHydration('pending');
    void (async () => {
      try {
        const r = await adminRetryNarrativeWithClientFallback(id, ownerUserId);
        if (cancelled) return;
        if ('error' in r) {
          setNarrativeAutoRetryError(r.error);
          if (!cancelled) setNarrativeHydration('pending');
        } else {
          const fresh = await fetchAttemptNarrativeState(id);
          if (!cancelled) {
            setNarrativeHydration(fresh.substantive ? 'ready' : 'pending');
          }
        }
        onAttemptMutatedRef.current?.();
      } finally {
        adminNarrativeAutoRetryFinishedAttempts.add(id);
        if (!cancelled) setNarrativeAutoRetrying(false);
        adminNarrativeAutoRetryInFlight.delete(id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt.id, transcriptReady, narrativeHydration]);

  useEffect(() => {
    if (!narrativeAutoRetrying) return;
    const id = attempt.id;
    let cancelled = false;
    const tick = async () => {
      const fresh = await fetchAttemptNarrativeState(id);
      if (cancelled) return;
      if (fresh.substantive) {
        setNarrativeHydration('ready');
        setNarrativeAutoRetrying(false);
        onAttemptMutatedRef.current?.();
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [narrativeAutoRetrying, attempt.id]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setAdminSessionUserId(session?.user?.id ?? null);
      setAdminSessionEmail(session?.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!adminAttemptHasHolisticOnlyTraitScoresNoScenarioSlices(attempt)) return;
  }, [
    attempt.id,
    attempt.user_id,
    attempt.scenario_1_scores,
    attempt.scenario_2_scores,
    attempt.scenario_3_scores,
    attempt.pillar_scores,
    attempt.ai_reasoning,
  ]);

  const reprocessStyle = async () => {
    setStyleStatus('reprocessing');
    const errs: string[] = [];
    try {
      const textRes = await supabase.functions.invoke('analyze-interview-text', {
        body: { user_id: attempt.user_id, attempt_id: attempt.id },
      });
      if (textRes.error) {
        console.error('[Admin] analyze-interview-text invoke failed', textRes.error);
        errs.push(formatEdgeFunctionInvokeFailure('analyze-interview-text', textRes));
      } else {
        const be = functionInvokeBodyError(textRes.data);
        if (be) errs.push(`analyze-interview-text: ${be}`);
      }
      const audioRes = await supabase.functions.invoke('analyze-interview-audio', {
        body: {
          action: 'finalize_session',
          user_id: attempt.user_id,
          attempt_id: attempt.id,
        },
      });
      if (audioRes.error) {
        console.error('[Admin] analyze-interview-audio invoke failed', audioRes.error);
        errs.push(formatEdgeFunctionInvokeFailure('analyze-interview-audio', audioRes));
      } else {
        const be = functionInvokeBodyError(audioRes.data);
        if (be) errs.push(`analyze-interview-audio: ${be}`);
      }

      const errorText = errs.length > 0 ? errs.join(' | ') : null;
      const { error: updateErr } = await supabase
        .from('interview_attempts')
        .update({ communication_style_error: errorText })
        .eq('id', attempt.id)
        .eq('user_id', attempt.user_id);
      if (updateErr) {
        console.error('[Admin] communication_style_error update failed', updateErr);
      } else {
        setStylePipelineErrorDisplay(errorText);
      }

      const row = await fetchCommunicationStyleProfileRowForAdmin(attempt.user_id);
      setStyleProfile(row);
    } catch (e) {
      console.error('[Admin] reprocessStyle failed', e);
    } finally {
      setStyleStatus('idle');
    }
  };

  const totalScoresStored = getResolvedPillarScores(attempt);
  const aggregate = computeMarkerAggregateFromAttempt(attempt);
  const totalScores: Record<string, number> = {};
  MARKER_IDS.forEach((id) => {
    totalScores[id] = aggregate.scores[id] ?? totalScoresStored[id];
  });
  const scenario1Details = getScoreBundleDetails(attempt.scenario_1_scores);
  const scenario2Details = getScoreBundleDetails(attempt.scenario_2_scores);
  const scenario3Details = getScoreBundleDetails(attempt.scenario_3_scores);
  const moment4Bundle = getMomentScoreBundle(attempt, 4);
  const moment5Bundle = getMomentScoreBundle(attempt, 5);
  const moment4Details = getScoreBundleDetails(parseObject(parseObject(attempt.scenario_specific_patterns)?.moment_4_scores));
  const moment5Details = getScoreBundleDetails(parseObject(parseObject(attempt.scenario_specific_patterns)?.moment_5_scores));
  const perScenario = [
    { key: 'scenario_1', label: 'Scenario 1', scores: scenario1Details.scores, summary: buildMomentOrScenarioSummary('Scenario 1', scenario1Details) },
    { key: 'scenario_2', label: 'Scenario 2', scores: scenario2Details.scores, summary: buildMomentOrScenarioSummary('Scenario 2', scenario2Details) },
    { key: 'scenario_3', label: 'Scenario 3', scores: scenario3Details.scores, summary: buildMomentOrScenarioSummary('Scenario 3', scenario3Details) },
    { key: 'moment_4', label: 'Moment 4', scores: moment4Bundle.scores, summary: buildMomentOrScenarioSummary('Moment 4', moment4Details, moment4Bundle.summary) },
    { key: 'moment_5', label: 'Moment 5', scores: moment5Bundle.scores, summary: buildMomentOrScenarioSummary('Moment 5', moment5Details, moment5Bundle.summary) },
  ];
  const outcome = resolveAdminPrimaryOutcomeDisplay(candidateUser ?? null, attempt);
  const gateScores = pillarScoresForGate(attempt);
  const gate = computeGateResultCore(gateScores);
  const gateWithOpts = computeGateResultCore(gateScores, null, buildAdminGateComputeOptions(attempt));
  const gateFailureLines =
    !gate.pass && outcome.outcomeLabel !== 'none' ? formatGateFailureLines(gate, gateScores) : [];
  const gateFailReasons = asAdminStringArray(attempt.gate_fail_reasons);
  const storedPsychometricFloors = extractPsychometricFloorsFromGateDetail(
    parseGateFailDetailRow(attempt) as Record<string, unknown> | null,
  );
  const profileStraightLineFlags = asAdminStringArray(profileUser?.psychometric_straight_line_flags);
  const profilePsychometricScores = {
    rfqScore: profileUser?.psychometrics_rfq_score ?? null,
    gaspScore: profileUser?.psychometrics_gasp_score ?? null,
    dweckScore: profileUser?.psychometrics_dweck_score ?? null,
    scsSfScore: profileUser?.psychometrics_scs_sf_score ?? null,
    sd3NarcissismScore: profileUser?.psychometrics_sd3_narcissism_score ?? null,
    brsScore: profileUser?.psychometrics_brs_score ?? null,
    anxietyTraitScore: profileUser?.psychometrics_anxiety_trait_score ?? null,
    aaq2Score: profileUser?.psychometrics_aaq2_score ?? null,
    rsesScore: profileUser?.psychometrics_rses_score ?? null,
    scsPublicScore: profileUser?.psychometrics_scs_public_score ?? null,
    scsPrivateScore: profileUser?.psychometrics_scs_private_score ?? null,
  };
  const activePsychometricGateFails = gateFailReasons.filter((id) =>
    (ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES as readonly string[]).includes(id),
  );
  const retroactivePsychometricFloorReviews = getRetroactivePsychometricFloorReviews(
    attempt,
    profilePsychometricScores,
    profileStraightLineFlags,
  );
  const reasoningPendingSummary =
    narrativeHydration === 'pending' ||
    (narrativeHydration === 'loading' && adminAttemptEligibleForNarrativeAutoRetry(attempt));
  const holisticOnlyScenarioDataGap = adminAttemptHasHolisticOnlyTraitScoresNoScenarioSlices(attempt);

  const [commFloorDismissOpen, setCommFloorDismissOpen] = useState(false);
  const [commFloorDismissNote, setCommFloorDismissNote] = useState('');
  const [commFloorDismissBusy, setCommFloorDismissBusy] = useState(false);

  const communicationFloorNeedsReview =
    attempt.communication_floor_flag === true && !attempt.communication_floor_dismissed_at;
  const communicationFloorDismissed =
    attempt.communication_floor_flag === true && !!attempt.communication_floor_dismissed_at;

  const isAdminViewer = isAmoraeaAdminConsoleEmail(adminSessionEmail);
  const recalculateScoresDisabled =
    !isAdminViewer ||
    recalcBusy ||
    attempt.reasoning_pending === true ||
    !attempt.completed_at;

  const completionGatePreview = evaluateInterviewCompletionGate({
    scenario1: attempt.scenario_1_scores,
    scenario2: attempt.scenario_2_scores,
    scenario3: attempt.scenario_3_scores,
    moment4:
      attempt.scenario_specific_patterns != null &&
      typeof attempt.scenario_specific_patterns === 'object' &&
      !Array.isArray(attempt.scenario_specific_patterns)
        ? (attempt.scenario_specific_patterns as Record<string, unknown>).moment_4_scores ?? null
        : null,
    moment5:
      attempt.scenario_specific_patterns != null &&
      typeof attempt.scenario_specific_patterns === 'object' &&
      !Array.isArray(attempt.scenario_specific_patterns)
        ? (attempt.scenario_specific_patterns as Record<string, unknown>).moment_5_scores ?? null
        : null,
    transcript: attempt.transcript,
  });
  const scoringStagesIncomplete = describeScoringStagesIncomplete(attempt);
  const missingPersonalMomentScoring =
    !completionGatePreview.ok &&
    (completionGatePreview.missingMoment4 || completionGatePreview.missingMoment5);
  const missingMoment5Only =
    !completionGatePreview.ok &&
    completionGatePreview.missingMoment5 &&
    !completionGatePreview.missingMoment4;

  const runRecalculateScores = async () => {
    const displayName = candidateUser
      ? resolveAdminInterviewIntroDisplayName(candidateUser)
      : '—';
    const emailLine = candidateUser?.email ?? '—';
    const weightDisplay =
      attempt.weighted_score != null && Number.isFinite(attempt.weighted_score)
        ? attempt.weighted_score.toFixed(2)
        : '—';
    const passDisplay =
      attempt.passed === true ? 'Pass' : attempt.passed === false ? 'Fail' : 'none / withheld';
    const confirmMsg = [
      `Attempt ID: ${attempt.id}`,
      `User: ${displayName} (${emailLine})`,
      `User ID: ${attempt.user_id}`,
      '',
      `Original weighted score: ${weightDisplay}`,
      `Original verdict: ${passDisplay}`,
      '',
      'This will overwrite pillar_scores, weighted_score, pass/fail, depth modifiers, gate fields, and scenario_composites on this row with values recomputed from stored scenario slices using the current rubric (transcript reconciliation + aggregation + gate only).',
      '',
      'A snapshot of the previous scoring fields will be stored in original_scores.',
    ].join('\n');
    const ok = await confirmAsync({
      title: 'Recalculate scores?',
      message: confirmMsg,
      confirmText: 'Recalculate',
    });
    if (!ok) return;
    setRecalcBusy(true);
    try {
      const snap = snapshotAttemptScoresForAudit(attempt);
      const oldPillars = normalizePillarScoresMap(attempt.pillar_scores) ?? {};
      let egoLevel = attempt.ego_development_level;
      if (egoLevel == null) {
        const { data: egoOut, error: egoFnErr } = await supabase.functions.invoke('repair-interview-ego', {
          body: { attemptId: attempt.id },
        });
        const repaired =
          egoOut != null && typeof egoOut === 'object' && typeof (egoOut as { ego?: unknown }).ego === 'number'
            ? (egoOut as { ego: number }).ego
            : null;
        if (!egoFnErr && repaired != null && repaired >= 1 && repaired <= 5) {
          egoLevel = repaired;
        }
      }
      const result = recalculateAttemptScoresFromStoredSlices({
        transcript: attempt.transcript,
        scenario_1_scores: attempt.scenario_1_scores,
        scenario_2_scores: attempt.scenario_2_scores,
        scenario_3_scores: attempt.scenario_3_scores,
        scenario_specific_patterns: attempt.scenario_specific_patterns,
        ego_development_level: egoLevel,
        language_markers: attempt.language_markers,
      });
      const nowIso = new Date().toISOString();

      if (result.kind === 'success') {
        const delta = computePillarScoreDelta(oldPillars, result.pillar_scores);
        const interviewGateFailReasons = result.gate.failReasonCodes ?? [];
        const interviewGateFailDetail = normalizeGateFailDetailForPersist(result.gate.failReasonDetail);
        let gateFailReasons = interviewGateFailReasons;
        let gateFailDetail = interviewGateFailDetail;
        if (PSYCHOMETRICS_ENABLED) {
          const floorPrep = await preparePsychometricFloorGateState(
            attempt.user_id,
            interviewGateFailReasons,
            interviewGateFailDetail,
            { forceApply: true, attemptId: attempt.id, userId: attempt.user_id },
          );
          if ('gateFailReasons' in floorPrep) {
            gateFailReasons = floorPrep.gateFailReasons;
            gateFailDetail = floorPrep.gateFailDetail;
          }
        }
        const passedAfterFloors =
          gateFailReasons.length === 0 ? result.gate.pass : false;
        const consistencyPatch = buildRecalculationConsistencyPatch({
          attempt,
          newPassed: passedAfterFloors,
          newWeightedScore: result.gate.weightedScore,
          newPillarScores: result.pillar_scores,
          recalculatedAt: nowIso,
        });
        const reviewFlags = Array.isArray(attempt.review_flags) ? [...attempt.review_flags] : [];
        if (consistencyPatch.review_flags) {
          for (const flag of consistencyPatch.review_flags) {
            if (!reviewFlags.includes(flag)) reviewFlags.push(flag);
          }
        }
        const { error } = await supabase
          .from('interview_attempts')
          .update({
            original_scores: snap,
            pillar_scores: result.pillar_scores,
            weighted_score: result.gate.weightedScore,
            passed: passedAfterFloors,
            gate_fail_reasons: gateFailReasons,
            gate_fail_detail: gateFailDetail,
            scenario_composites: result.scenarioCompositesJson,
            incomplete_reason: null,
            recalculated_at: nowIso,
            recalculation_delta: delta,
            recalculation_notes: result.notes,
            review_flags: [...new Set([...(result.gate.reviewFlags ?? []), ...reviewFlags])],
            ...(consistencyPatch.ai_reasoning != null ? { ai_reasoning: consistencyPatch.ai_reasoning } : {}),
            ...(consistencyPatch.reasoning_pending != null
              ? { reasoning_pending: consistencyPatch.reasoning_pending }
              : {}),
            ...(consistencyPatch.final_gate_pass !== undefined
              ? { final_gate_pass: consistencyPatch.final_gate_pass }
              : {}),
            mentalizing_overcertainty_count: result.mentalizingOvercertaintyCount,
            defense_patterns: result.defense_patterns,
            moment_4_concreteness:
              result.moment_4_concreteness ?? result.gate.moment4Concreteness ?? null,
            moment_5_concreteness:
              result.moment_5_concreteness ?? result.gate.moment5Concreteness ?? null,
            personal_moment_emotional_vocab_density: result.personal_moment_emotional_vocab_density,
            personal_moment_emotional_vocab_low: result.personal_moment_emotional_vocab_low,
            depth_signal_modifier:
              result.gate.depthSignalModifier ?? result.gate.scoreModifier ?? null,
            score_modifier: result.gate.scoreModifier ?? result.gate.depthSignalModifier ?? null,
            modified_weighted_score: result.gate.modifiedWeightedScore ?? null,
            disclosure_calibration: result.disclosure_calibration,
            ego_development_level: result.ego_development_level ?? egoLevel ?? null,
          })
          .eq('id', attempt.id)
          .eq('user_id', attempt.user_id);
        if (error) {
          Alert.alert('Recalculation failed', error.message);
          return;
        }
        const psychApply = await applyPsychometricModifierToAttempt(attempt.user_id, attempt.id, {
          forceApply: true,
        });
        const rollupNote = result.notes.find((n) => n.startsWith('rollup_algorithm:'));
        const rollupVersion = rollupNote?.slice('rollup_algorithm:'.length) ?? 'unknown';
        const pillarPreview = Object.entries(result.pillar_scores)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        const psychWarning = psychApply.applied
          ? null
          : `Psychometric floors/modifier were not applied (${psychApply.skipReason ?? 'unknown'}).`;
        Alert.alert(
          'Scores recalculated',
          [
            `Rollup: ${rollupVersion}`,
            `Weighted: ${result.gate.weightedScore?.toFixed(2) ?? '—'}`,
            `Pillars: ${pillarPreview}`,
            rollupVersion !== 'scenario_only_integers_v2'
              ? 'Warning: admin bundle is not on the fixed rollup — restart dev server or deploy latest code.'
              : Object.values(result.pillar_scores).some((v) => !Number.isInteger(v))
                ? 'Warning: pillar scores are not integers — stale admin bundle.'
                : 'Integer scenario-only rollup applied.',
            psychWarning,
          ]
            .filter(Boolean)
            .join('\n'),
        );
        void remoteLog('[RECALCULATE_SCORES]', {
          triggeredByUserId: adminSessionUserId,
          triggeredByEmail: adminSessionEmail,
          attemptId: attempt.id,
          affectedUserId: attempt.user_id,
          weightedScoreBefore: attempt.weighted_score,
          weightedScoreAfter: result.gate.weightedScore,
          delta,
        });
        onAttemptMutated?.();
      } else {
        const { error } = await supabase
          .from('interview_attempts')
          .update({
            original_scores: snap,
            incomplete_reason: result.completionFailure.incomplete_reason,
            weighted_score: null,
            passed: null,
            gate_fail_reasons: [],
            gate_fail_detail: normalizeGateFailDetailForPersist(null),
            scenario_composites: null,
            recalculated_at: nowIso,
            recalculation_delta: {},
            recalculation_notes: result.notes,
          })
          .eq('id', attempt.id)
          .eq('user_id', attempt.user_id);
        if (error) {
          Alert.alert('Recalculation failed', error.message);
          return;
        }
        void remoteLog('[RECALCULATE_SCORES]', {
          triggeredByUserId: adminSessionUserId,
          triggeredByEmail: adminSessionEmail,
          attemptId: attempt.id,
          affectedUserId: attempt.user_id,
          outcome: 'incomplete',
          notes: result.notes,
        });
        Alert.alert(
          'Incomplete data',
          [
            `Completion gate failed: ${result.completionFailure?.detail ?? 'unknown'}`,
            ...result.notes,
            '',
            'Recalculate only re-aggregates stored scenario/moment JSON (no Claude calls).',
            missingPersonalMomentScoring
              ? missingMoment5Only
                ? 'This attempt reached Moment 5 in the transcript but moment_5_scores are missing — run a full LLM rescore from the repo:'
                : 'This attempt is missing Moment 4/5 personal-moment scores — run a full LLM rescore from the repo:'
              : 'Fix stored scenario/moment JSON, then recalculate again.',
            missingPersonalMomentScoring
              ? `npx tsx scripts/rescoreUsers.ts --mode llm --commit ${attempt.user_id}`
              : '',
            '',
            'AI narrative (Tab 2) is separate — retry after weighted_score is populated.',
          ]
            .filter((line) => line !== '')
            .join('\n'),
        );
        onAttemptMutated?.();
      }
    } finally {
      setRecalcBusy(false);
    }
  };

  return (
    <ScrollView style={summaryTabStyles.innerTabContent}>
      {reasoningPendingSummary ? (
        <View style={[summaryTabStyles.block, { borderLeftWidth: 3, borderLeftColor: '#D4A84B', marginBottom: 12 }]}>
          <Text style={[summaryTabStyles.blockTitle, { color: '#E8D49A' }]}>
            {narrativeHydration === 'loading'
              ? 'Checking AI narrative…'
              : narrativeAutoRetrying
                ? 'Generating AI narrative…'
                : 'AI narrative not ready'}
          </Text>
          <Text style={summaryTabStyles.blockText}>
            {narrativeHydration === 'loading'
              ? 'Loading the latest narrative status from the database…'
              : narrativeAutoRetrying
                ? 'Scores are saved; generating long-form AI reasoning automatically (this can take a few minutes). The page will refresh when ready.'
                : 'Scores are saved; long-form AI reasoning is still pending or failed. Open Tab 2 (AI Reasoning) to retry manually, or wait if generation is already running.'}
          </Text>
          {narrativeAutoRetryError ? (
            <Text style={[summaryTabStyles.blockText, { color: '#E87A7A', marginTop: 8 }]}>{narrativeAutoRetryError}</Text>
          ) : null}
        </View>
      ) : null}
      {scoringStagesIncomplete.incomplete ? (
        <View style={[summaryTabStyles.block, { borderLeftWidth: 3, borderLeftColor: '#E87A7A', marginBottom: 12 }]}>
          <Text style={[summaryTabStyles.blockTitle, { color: '#F0B4B4' }]}>Scoring stages incomplete</Text>
          <Text style={summaryTabStyles.blockText}>
            {scoringStagesIncomplete.summary}
            {attempt.incomplete_reason ? ` Stored incomplete_reason: ${attempt.incomplete_reason}.` : ''}
            {attempt.weighted_score != null
              ? ' Weighted score was written before rollup finished — treat gate outcome as provisional until M5 is rescored.'
              : ' Weighted score withheld until missing stages are scored.'}
          </Text>
        </View>
      ) : null}
      <Text style={summaryTabStyles.sectionTitle}>Overall</Text>
      <ScoreReceiptCard attempt={attempt} user={profileUser} variant="dark" />
      {isAdminViewer ? (
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity
            style={[summaryTabStyles.overrideChip, recalculateScoresDisabled && { opacity: 0.45 }]}
            onPress={() => void runRecalculateScores()}
            disabled={recalculateScoresDisabled}
            accessibilityRole="button"
            accessibilityLabel="Recalculate scores from stored scenario slices"
          >
            <Text style={summaryTabStyles.overrideChipText}>{recalcBusy ? 'Recalculating…' : 'Recalculate Scores'}</Text>
          </TouchableOpacity>
          {missingPersonalMomentScoring ? (
            <Text style={[summaryTabStyles.blockText, { marginTop: 6, color: '#E8D49A' }]}>
              {missingMoment5Only
                ? 'Moment 5 personal-moment scores are missing despite a full M5 transcript — Recalculate cannot produce a weighted score until M5 is rescored. Use'
                : 'Moment 4/5 personal-moment scores are missing — Recalculate cannot produce a weighted score until those slices exist. Use'}{' '}
              {`npx tsx scripts/rescoreUsers.ts --mode llm --commit ${attempt.user_id}`} from the
              repo (requires Anthropic + service role env).
            </Text>
          ) : null}
          {attempt.reasoning_pending === true ? (
            <Text style={[summaryTabStyles.blockText, { marginTop: 6 }]}>
              Recalculate is disabled while automatic narrative generation is still marked in progress
              (`reasoning_pending` on the attempt row).
            </Text>
          ) : !attempt.completed_at ? (
            <Text style={[summaryTabStyles.blockText, { marginTop: 6 }]}>
              Recalculate is only available for completed attempts.
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={summaryTabStyles.metaRow}>
        <Text style={summaryTabStyles.metaLabel}>Date</Text>
        <Text style={summaryTabStyles.metaValue}>{formatAttemptDate(attempt)}</Text>
      </View>
      <View style={summaryTabStyles.metaRow}>
        <Text style={summaryTabStyles.metaLabel}>Time elapsed</Text>
        <Text style={summaryTabStyles.metaValue}>{formatAttemptElapsedDisplay(attempt)}</Text>
      </View>
      <View style={summaryTabStyles.metaRow}>
        <Text style={summaryTabStyles.metaLabel}>Result</Text>
        <Text style={[summaryTabStyles.metaValue, { color: outcome.color, textTransform: 'lowercase' }]}>{outcome.word}</Text>
      </View>
      {outcome.outcomeLabel === 'almost' ? (
        <View style={summaryTabStyles.metaRow}>
          <Text style={summaryTabStyles.metaLabel}>Review</Text>
          <Text style={[summaryTabStyles.metaValue, { color: getAlmostPassColor(), fontSize: 12 }]}>
            Close to passing — human review suggested
          </Text>
        </View>
      ) : null}
      {gateFailureLines.length > 0 ? (
        <View style={[summaryTabStyles.block, { marginTop: 4, marginBottom: 8, paddingVertical: 8 }]}>
          <Text style={[summaryTabStyles.blockTitle, { marginBottom: 6 }]}>Why the gate failed</Text>
          {gateFailureLines.map((line, i) => (
            <Text key={`gate-${i}`} style={summaryTabStyles.blockText}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}
      {activePsychometricGateFails.map((floorId) => {
        const storedFloor = storedPsychometricFloors[floorId];
        const score =
          storedFloor?.score ??
          psychometricFloorScoreForUser(floorId, profilePsychometricScores);
        if (score == null || !Number.isFinite(score)) return null;
        const description =
          storedFloor?.description ?? formatPsychometricGateFailDescription(floorId, score);
        return (
          <View
            key={floorId}
            style={[
              summaryTabStyles.block,
              {
                marginTop: 4,
                marginBottom: 10,
                paddingVertical: 10,
                borderLeftWidth: 4,
                borderLeftColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={[summaryTabStyles.commFloorReviewBadge, { backgroundColor: '#ef4444', color: '#fff' }]}>Gate fail</Text>
              <Text style={[summaryTabStyles.blockTitle, { marginBottom: 0, color: '#F5A5A5' }]}>{floorId}</Text>
            </View>
            <Text style={summaryTabStyles.blockText}>{description}</Text>
          </View>
        );
      })}
      {retroactivePsychometricFloorReviews.map((review) => (
        <View
          key={review.id}
          style={[
            summaryTabStyles.block,
            {
              marginTop: 4,
              marginBottom: 10,
              paddingVertical: 10,
              borderLeftWidth: 4,
              borderLeftColor: '#D4A84B',
              backgroundColor: 'rgba(212, 168, 75, 0.08)',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={[summaryTabStyles.commFloorReviewBadge, { backgroundColor: '#E8C96B', color: '#3D3319' }]}>Review</Text>
            <Text style={[summaryTabStyles.blockTitle, { marginBottom: 0, color: '#E8D49A' }]}>{review.id} (retroactive)</Text>
          </View>
          <Text style={summaryTabStyles.blockText}>{review.retroactiveNote}</Text>
          <Text style={[summaryTabStyles.blockText, { marginTop: 6 }]}>{review.description}</Text>
        </View>
      ))}
      {communicationFloorNeedsReview ? (
        <View
          style={[
            summaryTabStyles.block,
            {
              marginTop: 4,
              marginBottom: 10,
              paddingVertical: 10,
              borderLeftWidth: 4,
              borderLeftColor: '#D4A84B',
              backgroundColor: 'rgba(212, 168, 75, 0.08)',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={[summaryTabStyles.commFloorReviewBadge, { backgroundColor: '#E8C96B', color: '#3D3319' }]}>Review</Text>
            <Text style={[summaryTabStyles.blockTitle, { marginBottom: 0, color: '#E8D49A' }]}>communication_floor</Text>
          </View>
          <Text style={summaryTabStyles.blockText}>
            Average unprompted word count (scenarios A–C + moments 4–5) is{' '}
            <Text style={{ fontWeight: '600', color: '#F2E6BF' }}>
              {attempt.communication_floor_avg_unprompted_words != null
                ? attempt.communication_floor_avg_unprompted_words.toFixed(2)
                : '—'}
            </Text>{' '}
            — below the {COMMUNICATION_FLOOR_MIN_AVG_WORDS}-word admin review threshold. This is not a gate failure and
            does not change pass/fail.
          </Text>
          <TouchableOpacity
            style={summaryTabStyles.commFloorDismissButton}
            onPress={() => {
              setCommFloorDismissNote('');
              setCommFloorDismissOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss communication floor review flag"
          >
            <Text style={summaryTabStyles.commFloorDismissButtonText}>Dismiss flag…</Text>
          </TouchableOpacity>
        </View>
      ) : communicationFloorDismissed ? (
        <View
          style={[
            summaryTabStyles.block,
            {
              marginTop: 4,
              marginBottom: 10,
              paddingVertical: 10,
              borderLeftWidth: 3,
              borderLeftColor: 'rgba(122, 154, 190, 0.45)',
              backgroundColor: 'rgba(122, 154, 190, 0.06)',
            },
          ]}
        >
          <Text style={[summaryTabStyles.blockTitle, { color: '#A8C4F0', marginBottom: 6 }]}>communication_floor (dismissed)</Text>
          <Text style={summaryTabStyles.blockText}>
            Avg unprompted words when flagged:{' '}
            {attempt.communication_floor_avg_unprompted_words != null
              ? attempt.communication_floor_avg_unprompted_words.toFixed(2)
              : '—'}{' '}
            Â· Threshold: {COMMUNICATION_FLOOR_MIN_AVG_WORDS}
          </Text>
          <Text style={summaryTabStyles.blockText} selectable>
            Dismissed:{' '}
            {attempt.communication_floor_dismissed_at
              ? new Date(attempt.communication_floor_dismissed_at).toLocaleString()
              : '—'}{' '}
            Â· Reviewer id: {attempt.communication_floor_dismissed_by ?? '—'}
          </Text>
          {attempt.communication_floor_dismiss_note ? (
            <Text style={summaryTabStyles.blockText} selectable>
              Note: {attempt.communication_floor_dismiss_note}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Modal visible={commFloorDismissOpen} transparent animationType="fade">
        <View style={summaryTabStyles.commFloorModalBackdrop}>
          <View style={summaryTabStyles.commFloorModalCard}>
            <Text style={summaryTabStyles.commFloorModalTitle}>Dismiss communication_floor flag</Text>
            <Text style={summaryTabStyles.blockText}>
              Optional note for the audit log (why transcript style looked acceptable).
            </Text>
            <TextInput
              value={commFloorDismissNote}
              onChangeText={setCommFloorDismissNote}
              placeholder="Note"
              placeholderTextColor="rgba(122, 154, 190, 0.45)"
              multiline
              style={summaryTabStyles.commFloorModalInput}
            />
            <View style={summaryTabStyles.commFloorModalActions}>
              <TouchableOpacity
                style={summaryTabStyles.commFloorModalCancel}
                onPress={() => !commFloorDismissBusy && setCommFloorDismissOpen(false)}
                disabled={commFloorDismissBusy}
              >
                <Text style={summaryTabStyles.commFloorModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={summaryTabStyles.commFloorModalConfirm}
                disabled={commFloorDismissBusy}
                onPress={() => {
                  void (async () => {
                    setCommFloorDismissBusy(true);
                    try {
                      const { data: authData, error: authErr } = await supabase.auth.getUser();
                      if (authErr || !authData?.user?.id) {
                        Alert.alert('Not signed in', authErr?.message ?? 'Could not read admin session.');
                        return;
                      }
                      const { error } = await supabase
                        .from('interview_attempts')
                        .update({
                          communication_floor_dismissed_at: new Date().toISOString(),
                          communication_floor_dismissed_by: authData.user.id,
                          communication_floor_dismiss_note: commFloorDismissNote.trim() || null,
                        })
                        .eq('id', attempt.id)
                        .eq('user_id', attempt.user_id);
                      if (error) {
                        Alert.alert('Could not save', error.message);
                        return;
                      }
                      setCommFloorDismissOpen(false);
                      onAttemptMutated?.();
                    } finally {
                      setCommFloorDismissBusy(false);
                    }
                  })();
                }}
              >
                <Text style={summaryTabStyles.commFloorModalConfirmText}>{commFloorDismissBusy ? 'Saving…' : 'Dismiss flag'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={summaryTabStyles.metaRow}>
        <Text style={summaryTabStyles.metaLabel}>Weighted score</Text>
        <Text style={summaryTabStyles.metaValue}>{formatScoreCell(attempt.weighted_score)}</Text>
      </View>
      {(() => {
        const sm = attempt.score_modifier;
        if (typeof sm !== 'number' || !Number.isFinite(sm) || sm >= 0) return null;
        const parts: string[] = [];
        if (gateWithOpts.egoDevelopmentModifier != null && gateWithOpts.egoDevelopmentModifier !== 0) {
          parts.push('ego development');
        }
        if (gateWithOpts.defensePatternScoreAdjustment != null && gateWithOpts.defensePatternScoreAdjustment !== 0) {
          parts.push('defense patterns');
        }
        if (
          gateWithOpts.personalMomentConcretenessModifier != null &&
          gateWithOpts.personalMomentConcretenessModifier !== 0
        ) {
          parts.push('personal moment concreteness');
        }
        const tail = parts.length ? ` (${parts.join(', ')})` : '';
        return (
          <View style={{ marginBottom: 6 }}>
            <Text style={summaryTabStyles.summaryModifierHint}>
              Score modifier: <Text style={summaryTabStyles.summaryModifierRed}>{sm.toFixed(2)}</Text>
              {tail}
            </Text>
            <Text style={summaryTabStyles.summaryModifierHint}>
              Adjusted score:{' '}
              <Text style={{ fontWeight: '600', color: 'rgba(230,238,248,0.95)' }}>
                {formatScoreCell(attempt.modified_weighted_score)}
              </Text>{' '}
              ← threshold comparison used this
            </Text>
          </View>
        );
      })()}
      {PILLAR_ROWS.map((p) => (
        <View key={p.id} style={summaryTabStyles.scoreRow}>
          <Text style={summaryTabStyles.scoreLabel}>{p.label}</Text>
          <Text style={summaryTabStyles.scoreValue}>
            {formatScoreCell(totalScores[p.id])}
            {(aggregate.counts[p.id] ?? 0) > 0 &&
            (aggregate.counts[p.id] ?? 0) < 2
              ? ' *'
              : ''}
          </Text>
        </View>
      ))}
      <Text style={summaryTabStyles.blockText}>* score based on limited evidence (single contributing moment)</Text>

      {holisticOnlyScenarioDataGap ? (
        <View style={[summaryTabStyles.block, { borderLeftWidth: 3, borderLeftColor: '#6B8CDB', marginBottom: 12 }]}>
          <Text style={[summaryTabStyles.blockTitle, { color: '#A8C4F0' }]}>Per-scenario scores not on file</Text>
          <Text style={summaryTabStyles.blockText}>
            This row has combined trait scores (holistic merge), but the per-scenario JSON columns
            (scenario_1/2/3_scores) are empty—common after deferred completion that only persisted merged scores. The
            breakdown below cannot show real slice-level numbers until those columns are backfilled from the stored
            transcript (engineering) or the interview is re-run with slice persistence.
          </Text>
        </View>
      ) : null}

      <Text style={summaryTabStyles.sectionTitle}>Scenario Breakdown</Text>
      {perScenario.map((item) => (
        <View key={item.label} style={summaryTabStyles.block}>
          <Text style={summaryTabStyles.blockTitle}>{item.label}</Text>
          <Text style={summaryTabStyles.blockText}>{item.summary}</Text>
          {PILLAR_ROWS.map((p) => (
            <View key={`${item.label}-${p.id}`} style={summaryTabStyles.scoreRow}>
              <Text style={summaryTabStyles.scoreLabel}>{p.short}</Text>
              <Text style={summaryTabStyles.scoreValue}>
                {markerIsAssessedInSection(item.key, p.id)
                  ? formatScoreCell(
                      p.id === 'contempt'
                        ? sliceContemptDisplayValue(item.scores)
                        : item.scores?.[p.id],
                    )
                  : '—'}
              </Text>
            </View>
          ))}
        </View>
      ))}
      <Text style={summaryTabStyles.sectionTitle}>Communication Style</Text>
      {stylePipelineErrorDisplay ? (
        <View style={[summaryTabStyles.block, { borderLeftWidth: 3, borderLeftColor: '#E87A7A', paddingLeft: 10 }]}>
          <Text style={[summaryTabStyles.blockTitle, { color: '#B33A3A' }]}>Style pipeline error (stored on attempt)</Text>
          <Text style={summaryTabStyles.blockText}>{stylePipelineErrorDisplay}</Text>
        </View>
      ) : null}
      <View style={summaryTabStyles.block}>
        <Text style={[summaryTabStyles.blockText, summaryTabStyles.styleTranslationNote]}>
          Translation thresholds are defined in src/utilities/styleTranslations.ts and can be adjusted as calibration
          data accumulates.
        </Text>
        <Text style={summaryTabStyles.blockText}>
          Processing status:{' '}
          {styleAutoReprocessing || styleStatus === 'reprocessing'
            ? 'reprocessing automatically…'
            : styleProfile
              ? styleProfile.text_confidence != null && styleProfile.audio_confidence != null
                ? 'available'
                : 'partial'
              : styleStatus === 'loading'
                ? 'loading'
                : 'not processed'}
        </Text>
        <Text style={summaryTabStyles.blockText}>Text confidence: {formatScoreCell((styleProfile?.text_confidence ?? null) !== null ? Number(styleProfile?.text_confidence) * 10 : null)}</Text>
        <Text style={summaryTabStyles.blockText}>Audio confidence: {formatScoreCell((styleProfile?.audio_confidence ?? null) !== null ? Number(styleProfile?.audio_confidence) * 10 : null)}</Text>
        <Text style={summaryTabStyles.blockText}>Overall confidence: {formatScoreCell((styleProfile?.overall_confidence ?? null) !== null ? Number(styleProfile?.overall_confidence) * 10 : null)}</Text>

        {(() => {
          const transcriptOpts = buildCommunicationStyleTranscriptOptionsForAdmin(attempt.transcript);
          const live =
            styleProfile != null
              ? translateStyleProfile(
                  styleProfileFromDbRow(styleProfile as unknown as Record<string, unknown>),
                  transcriptOpts,
                )
              : null;
          const primaryStored = styleProfile?.style_labels_primary;
          const secondaryStored = styleProfile?.style_labels_secondary;
          const summaryStored = styleProfile?.matchmaker_summary;
          const lowNoteStored = styleProfile?.low_confidence_note;
          const summaryDisplayText =
            live?.matchmaker_summary?.trim() || summaryStored?.trim() || '';
          const primaryForDisplay = Array.isArray(primaryStored) && primaryStored.filter(Boolean).length > 0
            ? primaryStored
            : Array.isArray(live?.primary)
              ? live.primary
              : [];
          const secondaryForDisplay = Array.isArray(secondaryStored) && secondaryStored.filter(Boolean).length > 0
            ? secondaryStored
            : Array.isArray(live?.secondary)
              ? live.secondary
              : [];
          return (
            <>
              {primaryForDisplay.length > 0 ? (
                <Text style={summaryTabStyles.blockText}>Primary labels: {primaryForDisplay.join(', ')}</Text>
              ) : null}
              {secondaryForDisplay.length > 0 ? (
                <Text style={summaryTabStyles.blockText}>Secondary labels: {secondaryForDisplay.join(', ')}</Text>
              ) : null}
              {summaryDisplayText ? (
                <Text style={summaryTabStyles.blockText}>Matchmaker summary: {summaryDisplayText}</Text>
              ) : null}
              {(lowNoteStored || live?.low_confidence_note) ? (
                <Text style={summaryTabStyles.blockText}>Low confidence: {lowNoteStored ?? live?.low_confidence_note}</Text>
              ) : null}
            </>
          );
        })()}

        {(
          [
            ['Emotional vs Analytical', styleProfile?.emotional_analytical_score, describeEmotionalAnalyticalAxis],
            ['Narrative vs Conceptual', styleProfile?.narrative_conceptual_score, describeNarrativeConceptualAxis],
            ['Certainty vs Ambiguity', styleProfile?.certainty_ambiguity_score, describeCertaintyAmbiguityAxis],
            ['Relational vs Individual', styleProfile?.relational_individual_score, describeRelationalIndividualAxis],
          ] as const
        ).map(([label, value, describe]) => {
          const n = coerceScoreNumber(value) ?? null;
          const exp =
            n == null
              ? ''
              : label === 'Emotional vs Analytical'
                ? describeEmotionalAnalyticalAxis(n, styleProfile as unknown as Record<string, unknown> | null)
                : describe(n);
          return (
            <View key={label} style={summaryTabStyles.styleBarRow}>
              <Text style={summaryTabStyles.scoreLabel}>{label}</Text>
              <View style={summaryTabStyles.styleBarTrack}>
                <View style={[summaryTabStyles.styleBarFill, { width: `${Math.max(0, Math.min(100, (n ?? 0) * 100))}%` }]} />
              </View>
              <View style={summaryTabStyles.styleBarValueCol}>
                <Text style={summaryTabStyles.scoreValue}>{n == null ? '—' : n.toFixed(2)}</Text>
                {n != null ? <Text style={summaryTabStyles.styleExperienceLabel}>→ {exp}</Text> : null}
              </View>
            </View>
          );
        })}
        {[
          ['Warmth', styleProfile?.warmth_score],
          ['Expressiveness', styleProfile?.emotional_expressiveness],
        ].map(([label, value]) => {
          const n = coerceScoreNumber(value) ?? null;
          const ac = coerceScoreNumber(styleProfile?.audio_confidence) ?? null;
          const exp =
            label === 'Warmth'
              ? describeWarmthAxis(n, ac ?? null)
              : describeExpressivenessAxis(n, ac ?? null);
          return (
            <View key={String(label)} style={summaryTabStyles.styleBarRow}>
              <Text style={summaryTabStyles.scoreLabel}>{label}</Text>
              <View style={summaryTabStyles.styleBarTrack}>
                <View style={[summaryTabStyles.styleBarFill, { width: `${Math.max(0, Math.min(100, (n ?? 0) * 100))}%` }]} />
              </View>
              <View style={summaryTabStyles.styleBarValueCol}>
                <Text style={summaryTabStyles.scoreValue}>{n == null ? '—' : n.toFixed(2)}</Text>
                {n != null ? <Text style={summaryTabStyles.styleExperienceLabel}>→ {exp}</Text> : null}
              </View>
            </View>
          );
        })}

        <Pressable
          onPress={() => void reprocessStyle()}
          style={({ pressed }) => [summaryTabStyles.reprocessButton, pressed && summaryTabStyles.reprocessButtonPressed]}
          disabled={styleStatus === 'reprocessing'}
        >
          <Text style={summaryTabStyles.reprocessButtonText}>
            {styleStatus === 'reprocessing' ? 'Reprocessing...' : 'Reprocess style pipelines'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}