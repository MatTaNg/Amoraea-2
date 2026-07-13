import { INTERVIEW_MARKER_LABELS, SLICE_ONLY_MARKER_LABELS } from '@features/aria/interviewMarkers';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import { colors } from '@ui/theme/colors';

/** Fixed column order for scenario scorecards so unassessed markers (e.g. commitment_threshold) still show as — */
export const SCENARIO_SCORE_DISPLAY_ORDER: Record<number, readonly string[]> = {
  1: ['mentalizing', 'accountability', 'contempt_recognition', 'contempt_expression', 'repair', 'attunement', 'appreciation'],
  2: ['appreciation', 'attunement', 'mentalizing', 'repair', 'accountability', 'contempt_expression'],
  3: ['regulation', 'repair', 'mentalizing', 'attunement', 'accountability', 'contempt_expression'],
};

export function formatScoreMessage(scenarioResult: ScenarioScoreResult): string {
  const label = (id: string) =>
    SLICE_ONLY_MARKER_LABELS[id] ??
    INTERVIEW_MARKER_LABELS[id as keyof typeof INTERVIEW_MARKER_LABELS] ??
    id;
  const order =
    SCENARIO_SCORE_DISPLAY_ORDER[scenarioResult.scenarioNumber] ??
    Object.keys(scenarioResult.pillarScores ?? {});
  const scores = order
    .map((id) => {
      const raw = scenarioResult.pillarScores?.[id];
      const scoreText = typeof raw === 'number' && Number.isFinite(raw) ? `${raw}/10` : '—';
      const confRaw = scenarioResult.pillarConfidence[id] ?? 'moderate';
      const confidence = confRaw === 'not_assessed' ? 'not assessed' : confRaw;
      const evidence = scenarioResult.keyEvidence[id] ?? '—';
      return `${label(id)}: ${scoreText} (${confidence} confidence)\n   "${evidence}"`;
    })
    .join('\n\n');
  const flags: string[] = [];
  if (scenarioResult.specificity === 'low') {
    flags.push('⚠ Generic responses — no specificity after clarification');
  }
  if (scenarioResult.repairCoherenceIssue) {
    flags.push(`⚠ Repair coherence: ${scenarioResult.repairCoherenceIssue}`);
  }
  return [
    `── Scenario ${scenarioResult.scenarioNumber}: ${scenarioResult.scenarioName} ──`,
    scores,
    flags.length > 0 ? flags.join('\n') : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export const CONSTRUCTS = [
  { id: 1, label: 'Mentalizing', color: colors.error },
  { id: 2, label: 'Accountability', color: colors.success },
  { id: 3, label: 'Contempt / Criticism', color: '#B85C5C' },
  { id: 4, label: 'Repair', color: colors.primary },
  { id: 5, label: 'Emotional Regulation', color: '#8B3A5C' },
  { id: 6, label: 'Attunement', color: '#0D6B6B' },
  { id: 7, label: 'Appreciation', color: '#2A5C5C' },
  { id: 8, label: 'Commitment Threshold', color: '#6B5CB8' },
  { id: 'CQ', label: 'Communication Quality', color: '#5A4A8A' },
];

/** Maps transcript cues to CONSTRUCTS id 1–7 for flame orb hints. */
export function detectConstructs(text: string): number[] {
  const t = text.toLowerCase();
  const hits = new Set<number>();
  const hit = (id: number, re: RegExp) => {
    if (re.test(t)) hits.add(id);
  };
  hit(1, /wonder if|maybe (he|she|they) felt|their perspective|epistem|don't know what|intent|mentaliz/i);
  hit(2, /my part|i should have|i was wrong|deflect|excuse|not my fault|accountab|ownership|justify/i);
  hit(3, /contempt|disgust|pathetic|i would never|always does|never does|mock|inferior|beneath me/i);
  hit(4, /repair|reconnect|rupture|make it right|sorry|apolog|own my|follow through.*repair/i);
  hit(5, /flood|overwhelm|stonewall|shut down|walked out|needed space|cool down|regulat|flooded/i);
  hit(6, /noticed|picked up|attun|bid|they seemed|sensed|without (being )?told/i);
  hit(7, /appreciat|celebrat|proud of|grateful|what (he|she|they) did well|valued/i);
  hit(8, /not working|irrecover|fundamental incompatib|deal[- ]?breaker|leave|walk away|keep trying|persist|commitment threshold|when to end/i);
  return [...hits];
}
