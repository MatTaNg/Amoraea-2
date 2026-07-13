import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { adminRetryNarrativeWithClientFallback } from '@utilities/adminRetryNarrativeWithClientFallback';
import { PILLAR_ROWS } from '@features/admin/interviewDashboard/adminInterviewDashboardConstants';
import {
  adminAiNarrativeStillPending,
  adminAttemptHasHolisticOnlyTraitScoresNoScenarioSlices,
  getScoreBundleDetails,
  markerIsAssessedInSection,
} from '@features/admin/interviewDashboard/adminInterviewAttemptAdminUtils';
import { detailTabStyles as styles } from '@features/admin/interviewDashboard/adminInterviewDetailTabStyles';
import {
  coerceScoreNumber,
  formatScoreCell,
  getString,
  parseObject,
} from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';
import type { AttemptRow } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export function AdminInterviewReasoningTab({
  attempt,
  onRefreshAfterReasoning,
}: {
  attempt: AttemptRow;
  onRefreshAfterReasoning?: () => void;
}) {
  const [reasoningRetrying, setReasoningRetrying] = useState(false);
  const [reasoningRetryError, setReasoningRetryError] = useState<string | null>(null);
  const reasoningPending = adminAiNarrativeStillPending(attempt);

  const reasoning = parseObject(attempt.ai_reasoning);
  if (!reasoning && !reasoningPending) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>AI reasoning is not available for this test.</Text>
      </View>
    );
  }
  const scenarioObservations = parseObject(reasoning?.scenario_observations);
  const breakdown = parseObject(reasoning?.construct_breakdown);
  const holisticOnlyScenarioDataGap = adminAttemptHasHolisticOnlyTraitScoresNoScenarioSlices(attempt);

  const scenarioBundles = [
    {
      key: 'scenario_1',
      label: 'Scenario 1',
      details: getScoreBundleDetails(attempt.scenario_1_scores),
    },
    {
      key: 'scenario_2',
      label: 'Scenario 2',
      details: getScoreBundleDetails(attempt.scenario_2_scores),
    },
    {
      key: 'scenario_3',
      label: 'Scenario 3',
      details: getScoreBundleDetails(attempt.scenario_3_scores),
    },
    {
      key: 'moment_4',
      label: 'Moment 4',
      details: getScoreBundleDetails(parseObject(parseObject(attempt.scenario_specific_patterns)?.moment_4_scores)),
    },
    {
      key: 'moment_5',
      label: 'Moment 5',
      details: getScoreBundleDetails(parseObject(parseObject(attempt.scenario_specific_patterns)?.moment_5_scores)),
    },
  ];

  return (
    <ScrollView style={styles.innerTabContent}>
      {reasoningPending ? (
        <View style={[styles.block, { borderLeftWidth: 3, borderLeftColor: '#D4A84B', marginBottom: 12 }]}>
          <Text style={[styles.blockTitle, { color: '#E8D49A' }]}>Narrative reasoning pending or failed</Text>
          <Text style={styles.blockText}>
            Scores and transcript were saved, but the full AI narrative was not generated in-session
            {reasoning?.last_error != null ? ` (${String(reasoning.last_error)})` : ''}. Retry to call the model again
            from this dashboard.
          </Text>
          <TouchableOpacity
            disabled={reasoningRetrying}
            onPress={() => {
              setReasoningRetryError(null);
              setReasoningRetrying(true);
              void (async () => {
                try {
                  const r = await adminRetryNarrativeWithClientFallback(attempt.id, attempt.user_id);
                  if ('error' in r) {
                    setReasoningRetryError(r.error);
                    onRefreshAfterReasoning?.();
                  } else {
                    onRefreshAfterReasoning?.();
                  }
                } catch (e) {
                  setReasoningRetryError(e instanceof Error ? e.message : String(e));
                } finally {
                  setReasoningRetrying(false);
                }
              })();
            }}
            style={styles.reprocessButton}
          >
            <Text style={styles.reprocessButtonText}>{reasoningRetrying ? 'Generating…' : 'Retry AI reasoning'}</Text>
          </TouchableOpacity>
          {reasoningRetryError ? (
            <Text style={[styles.blockText, { color: '#E87A7A', marginTop: 8 }]}>{reasoningRetryError}</Text>
          ) : null}
        </View>
      ) : null}

      {holisticOnlyScenarioDataGap ? (
        <View style={[styles.block, { borderLeftWidth: 3, borderLeftColor: '#6B8CDB', marginBottom: 12 }]}>
          <Text style={[styles.blockTitle, { color: '#A8C4F0' }]}>Per-scenario score data missing</Text>
          <Text style={styles.blockText}>
            Scenario pillar explanations below need slice scores on the attempt row. This run only has merged scores—see
            the Summary tab for the same notice.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Scenario Reasoning</Text>
      {['scenario_1', 'scenario_2', 'scenario_3'].map((key, idx) => {
        const obs = parseObject(scenarioObservations?.[key]);
        return (
          <View key={key} style={styles.block}>
            <Text style={styles.blockTitle}>{getString(obs?.name) ?? `Scenario ${idx + 1}`}</Text>
            <Text style={styles.blockText}>{getString(obs?.what_happened) ?? 'No scenario reasoning recorded.'}</Text>
            <Text style={styles.blockText}>{getString(obs?.what_it_revealed) ?? ''}</Text>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Scenario Pillar Explanations</Text>
      {scenarioBundles.map((bundle) => {
        const obs = parseObject(scenarioObservations?.[bundle.key]);
        const title = getString(obs?.name) ?? bundle.label;
        const scoredPillars = PILLAR_ROWS.filter(
          (p) =>
            markerIsAssessedInSection(bundle.key, p.id) &&
            coerceScoreNumber(bundle.details.scores?.[p.id]) != null
        );
        return (
          <View key={bundle.key} style={styles.block}>
            <Text style={styles.blockTitle}>{title}</Text>
            {scoredPillars.length === 0 ? (
              <Text style={styles.blockText}>No per-pillar scenario evidence was recorded for this section.</Text>
            ) : (
              scoredPillars.map((p) => {
                const score = formatScoreCell(bundle.details.scores?.[p.id]);
                const confidence = bundle.details.confidence[p.id] ?? 'unspecified confidence';
                const evidence = bundle.details.evidence[p.id] ?? 'No specific evidence was captured in this run.';
                return (
                  <Text key={`${bundle.key}-${p.id}`} style={styles.blockText}>
                    {p.label} was rated {score}/10 ({confidence}) because {evidence}.
                  </Text>
                );
              })
            )}
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Pillar-by-Pillar Reasoning</Text>
      {PILLAR_ROWS.map((p) => {
        const pillar = parseObject(breakdown?.[p.id]);
        return (
          <View key={p.id} style={styles.block}>
            <Text style={styles.blockTitle}>{p.label}</Text>
            <Text style={styles.blockText}>Score: {formatScoreCell(pillar?.score)}</Text>
            <Text style={styles.blockText}>{getString(pillar?.summary) ?? 'No summary recorded.'}</Text>
            <Text style={styles.blockText}>{getString(pillar?.where_you_struggled) ?? ''}</Text>
            <Text style={styles.blockText}>{getString(pillar?.what_you_did_well) ?? ''}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
