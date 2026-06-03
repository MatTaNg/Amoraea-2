import {
  POST_INTERVIEW_ASSESSMENTS,
  scorePostInterviewAssessment,
} from '@features/psychometrics/assessmentContent';

export type SexualCommunicationInsightRow = {
  label: string;
  value: string;
  description: string;
};

const ASSESSMENT = POST_INTERVIEW_ASSESSMENTS.sexual_communication;
const SCALE_LABELS = ASSESSMENT.scale.labels;

export function normalizeSexualCommunicationResponses(
  responses: Record<string | number, number>,
): Record<number, number> {
  const numeric: Record<number, number> = {};
  for (const [k, v] of Object.entries(responses)) {
    const id = Number(k);
    if (Number.isFinite(id) && Number.isFinite(v)) numeric[id] = v;
  }
  return numeric;
}

/** Scores include `total` and per-question `item_1` … `item_10`. */
export function buildSexualCommunicationScores(
  responses: Record<string | number, number>,
): Record<string, number> {
  const numeric = normalizeSexualCommunicationResponses(responses);
  const scored = scorePostInterviewAssessment('sexual_communication', numeric);
  for (const q of ASSESSMENT.questions) {
    const val = numeric[q.id];
    if (val !== undefined) scored[`item_${q.id}`] = val;
  }
  return scored;
}

export function sexualCommunicationComfortLabel(value: number): string {
  const rounded = Math.round(Math.min(5, Math.max(1, value)));
  return SCALE_LABELS[rounded as keyof typeof SCALE_LABELS] ?? `${value.toFixed(1)} / 5`;
}

function topicRowsFromScores(scores: Record<string, number>) {
  return ASSESSMENT.questions
    .map((q) => ({
      id: q.id,
      text: q.text,
      value: scores[`item_${q.id}`],
    }))
    .filter((r): r is { id: number; text: string; value: number } => r.value !== undefined);
}

function shortenTopic(text: string): string {
  const trimmed = text.replace(/\.$/, '').trim();
  if (trimmed.length <= 52) return trimmed;
  return `${trimmed.slice(0, 49)}…`;
}

export function buildSexualCommunicationDetailRows(
  scores: Record<string, number>,
): SexualCommunicationInsightRow[] {
  const total = scores.total ?? 0;
  const topics = topicRowsFromScores(scores);
  const sorted = [...topics].sort((a, b) => b.value - a.value);
  const rows: SexualCommunicationInsightRow[] = [
    {
      label: 'Overall comfort',
      value: `${total.toFixed(2)} / 5.0`,
      description: sexualCommunicationComfortLabel(total),
    },
  ];

  for (const t of sorted) {
    rows.push({
      label: shortenTopic(t.text),
      value: `${t.value}/5 — ${sexualCommunicationComfortLabel(t.value)}`,
      description: 'How comfortable you would feel discussing this with a partner.',
    });
  }

  return rows;
}

export function buildSexualCommunicationInsightCopy(scores: Record<string, number>): {
  headline: string;
  body: string;
  growthEdge: string;
} {
  const total = scores.total ?? 0;
  const topics = topicRowsFromScores(scores);
  const sorted = [...topics].sort((a, b) => b.value - a.value);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];
  const spread =
    sorted.length >= 2 ? (sorted[0]?.value ?? 0) - (sorted[sorted.length - 1]?.value ?? 0) : 0;

  const bandPhrase =
    total >= 3.5
      ? 'high overall comfort'
      : total >= 2.5
        ? 'moderate overall comfort'
        : 'lower overall comfort';

  const headline =
    topics.length > 0 && highest
      ? `You show ${bandPhrase} — strongest on "${shortenTopic(highest.text)}".`
      : `Your sexual communication comfort is ${bandPhrase}.`;

  let body =
    'How comfortable you are discussing intimacy topics with a partner helps us match you with compatible communication styles. Your answers are never shown to other users.';

  if (topics.length > 0 && highest && lowest && highest.id !== lowest.id) {
    body = `You feel most at ease with "${shortenTopic(highest.text)}" (${highest.value}/5) and find "${shortenTopic(lowest.text)}" the hardest (${lowest.value}/5). That pattern shapes how we pair you with partners whose communication pace fits yours. Your answers are never shown to other users.`;
  } else if (topics.length > 0 && highest) {
    body = `Your responses center on "${shortenTopic(highest.text)}" as a relative strength. We use this profile privately to improve match quality — other users never see your answers.`;
  }

  const growthEdge =
    spread >= 2
      ? 'A wide spread between topics is common. The growth edge is often the lowest-scoring areas — naming needs early tends to reduce guesswork for both partners.'
      : "There is no 'correct' comfort level — your pattern helps us match you with partners whose communication pace fits yours.";

  return { headline, body, growthEdge };
}
