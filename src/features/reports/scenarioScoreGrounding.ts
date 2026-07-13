import type { ReportData } from '@features/psychometrics/personalReportData';
import {
  parseKeyEvidenceFromStoredSlice,
  parsePillarScoresFromStoredSlice,
} from '@features/psychometrics/personalReportNarrativeGuidance';
import {
  PILLAR_NARRATIVE_BAND_DEVELOPING_MIN,
  PILLAR_NARRATIVE_BAND_GOOD_MIN,
  PILLAR_NARRATIVE_BAND_NEEDS_ATTENTION_MIN,
  PILLAR_NARRATIVE_BAND_STRONG_MIN,
} from '@config/reports/pillarNarrativeBands';

export type ScenarioScoreGroundingSlice = {
  scenarioLabel: string;
  mentalizing: number | null;
  attunement: number | null;
  mentalizingKeyEvidence: string | null;
  attunementKeyEvidence: string | null;
};

export type ScenarioScoreGrounding = {
  slices: ScenarioScoreGroundingSlice[];
  moment4Mentalizing: number | null;
  moment4KeyEvidence: string | null;
  moment5Mentalizing: number | null;
  moment5KeyEvidence: string | null;
  maxScenarioMentalizing: { scenarioLabel: string; score: number } | null;
};

const SCENARIO_LABELS = ['Scenario 1 (Emma/Ryan)', 'Scenario 2 (Sarah/James)', 'Scenario 3 (Sophie/Daniel)'] as const;

export function narrativeBandForScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return 'not assessed';
  if (score >= PILLAR_NARRATIVE_BAND_STRONG_MIN) return 'strong (8+)';
  if (score >= PILLAR_NARRATIVE_BAND_GOOD_MIN) return 'good (7–7.9)';
  if (score >= PILLAR_NARRATIVE_BAND_DEVELOPING_MIN) return 'developing/competent (6–6.9)';
  if (score >= PILLAR_NARRATIVE_BAND_DEVELOPING_MIN - 1) return 'moderate/Level-1-tagged (5–5.9)';
  if (score >= PILLAR_NARRATIVE_BAND_NEEDS_ATTENTION_MIN) return 'needs attention (4–4.9)';
  return 'significant growth area (<4)';
}

export function allowedScenarioLanguageForScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return 'describe cautiously — score not available';
  if (score >= PILLAR_NARRATIVE_BAND_GOOD_MIN) return 'may use "strong," "accurate," "solid" when grounded in keyEvidence';
  if (score >= PILLAR_NARRATIVE_BAND_DEVELOPING_MIN) return 'use "competent," "developing," "some capacity" — NOT "strong" or "consistently accurate"';
  return 'use "moderate," "surface-level," "competent at reading behavior" — NOT "strong," "excellent," "accurate empathy," or "in every scenario you demonstrated strong empathy"';
}

function parseSlice(raw: unknown, scenarioLabel: string): ScenarioScoreGroundingSlice | null {
  const ps = parsePillarScoresFromStoredSlice(raw);
  const ke = parseKeyEvidenceFromStoredSlice(raw);
  const mentalizing =
    typeof ps?.mentalizing === 'number' && Number.isFinite(ps.mentalizing) ? ps.mentalizing : null;
  const attunement =
    typeof ps?.attunement === 'number' && Number.isFinite(ps.attunement) ? ps.attunement : null;
  const mentalizingKeyEvidence =
    typeof ke?.mentalizing === 'string' && ke.mentalizing.trim() ? ke.mentalizing.trim() : null;
  const attunementKeyEvidence =
    typeof ke?.attunement === 'string' && ke.attunement.trim() ? ke.attunement.trim() : null;
  if (
    mentalizing == null &&
    attunement == null &&
    !mentalizingKeyEvidence &&
    !attunementKeyEvidence
  ) {
    return null;
  }
  return {
    scenarioLabel,
    mentalizing,
    attunement,
    mentalizingKeyEvidence,
    attunementKeyEvidence,
  };
}

export function buildScenarioScoreGroundingFromAttemptRows(attempt: {
  scenario_1_scores?: unknown;
  scenario_2_scores?: unknown;
  scenario_3_scores?: unknown;
  scenario_specific_patterns?: unknown;
} | null | undefined): ScenarioScoreGrounding | null {
  if (!attempt) return null;
  const patterns = (attempt.scenario_specific_patterns as Record<string, unknown> | null) ?? null;
  const m4Raw = patterns?.moment_4_scores ?? null;
  const m5Raw = patterns?.moment_5_scores ?? null;

  const slices = [
    parseSlice(attempt.scenario_1_scores, SCENARIO_LABELS[0]),
    parseSlice(attempt.scenario_2_scores, SCENARIO_LABELS[1]),
    parseSlice(attempt.scenario_3_scores, SCENARIO_LABELS[2]),
  ].filter((s): s is ScenarioScoreGroundingSlice => s != null);

  const m4ps = parsePillarScoresFromStoredSlice(m4Raw);
  const m4ke = parseKeyEvidenceFromStoredSlice(m4Raw);
  const m5ps = parsePillarScoresFromStoredSlice(m5Raw);
  const m5ke = parseKeyEvidenceFromStoredSlice(m5Raw);

  if (slices.length === 0 && !m4ps && !m5ps) return null;

  let maxScenarioMentalizing: { scenarioLabel: string; score: number } | null = null;
  for (const s of slices) {
    if (s.mentalizing == null) continue;
    if (!maxScenarioMentalizing || s.mentalizing > maxScenarioMentalizing.score) {
      maxScenarioMentalizing = { scenarioLabel: s.scenarioLabel, score: s.mentalizing };
    }
  }

  return {
    slices,
    moment4Mentalizing:
      typeof m4ps?.mentalizing === 'number' && Number.isFinite(m4ps.mentalizing)
        ? m4ps.mentalizing
        : null,
    moment4KeyEvidence:
      typeof m4ke?.mentalizing === 'string' && m4ke.mentalizing.trim()
        ? m4ke.mentalizing.trim()
        : null,
    moment5Mentalizing:
      typeof m5ps?.mentalizing === 'number' && Number.isFinite(m5ps.mentalizing)
        ? m5ps.mentalizing
        : null,
    moment5KeyEvidence:
      typeof m5ke?.mentalizing === 'string' && m5ke.mentalizing.trim()
        ? m5ke.mentalizing.trim()
        : null,
    maxScenarioMentalizing,
  };
}

export function buildScenarioScoreGroundingContextBlock(grounding: ScenarioScoreGrounding): string {
  const lines: string[] = [
    'SCENARIO SCORE GROUNDING (internal — for crossref + narrative; do NOT quote raw numbers to reader; match language to score band):',
    'LANGUAGE RULE: Scores 5–6 with Level 1 keyEvidence = "competent at reading behavior" / "moderate" — NOT "strong," "accurate empathy," "excellent," or "in every scenario you demonstrated strong empathy." Reserve "strong"/"accurate" for scores 7+ with Level 2 evidence.',
  ];

  for (const s of grounding.slices) {
    lines.push(
      `- ${s.scenarioLabel}: mentalizing ${s.mentalizing ?? 'n/a'} (${narrativeBandForScore(s.mentalizing)}) — allowed language: ${allowedScenarioLanguageForScore(s.mentalizing)}; attunement ${s.attunement ?? 'n/a'} (${narrativeBandForScore(s.attunement)})`,
    );
    if (s.mentalizingKeyEvidence) {
      lines.push(`  mentalizing keyEvidence: "${s.mentalizingKeyEvidence.slice(0, 280)}"`);
    }
    if (s.attunementKeyEvidence) {
      lines.push(`  attunement keyEvidence: "${s.attunementKeyEvidence.slice(0, 280)}"`);
    }
  }

  if (grounding.moment4Mentalizing != null || grounding.moment4KeyEvidence) {
    lines.push(
      `- M4 personal reflection: mentalizing ${grounding.moment4Mentalizing ?? 'n/a'} (${narrativeBandForScore(grounding.moment4Mentalizing)})${grounding.moment4KeyEvidence ? `; keyEvidence: "${grounding.moment4KeyEvidence.slice(0, 220)}"` : ''}`,
    );
  }
  if (grounding.moment5Mentalizing != null || grounding.moment5KeyEvidence) {
    lines.push(
      `- M5 personal conflict: mentalizing ${grounding.moment5Mentalizing ?? 'n/a'} (${narrativeBandForScore(grounding.moment5Mentalizing)})${grounding.moment5KeyEvidence ? `; keyEvidence: "${grounding.moment5KeyEvidence.slice(0, 220)}"` : ''}`,
    );
  }

  if (grounding.maxScenarioMentalizing) {
    lines.push(
      `- Highest scenario mentalizing: ${grounding.maxScenarioMentalizing.scenarioLabel} at ${grounding.maxScenarioMentalizing.score} — crossref MUST cite this scenario + score + specific keyEvidence, not a generic "strong across scenarios" contrast.`,
    );
  }

  lines.push(
    `CROSSREF TEMPLATE: "Your highest scenario score for [construct] was in [Scenario X] at [score band description], where you [specific pattern from keyEvidence]. Your personal account (M4/M5) showed [specific quote/paraphrase]."`,
  );

  return lines.join('\n');
}

export function buildScenarioScoreGroundingFromReportData(data: ReportData): ScenarioScoreGrounding | null {
  const mp = data.attempt?.mentalizingProfile;
  const sk = data.attempt?.scenarioKeyEvidence;
  if (!mp && !sk) return null;

  const slices: ScenarioScoreGroundingSlice[] = [];
  const add = (
    scenarioLabel: string,
    mentalizing: number | null,
    ke: string | null,
    skSlice: Record<string, string> | null | undefined,
  ) => {
    slices.push({
      scenarioLabel,
      mentalizing,
      attunement: null,
      mentalizingKeyEvidence: ke,
      attunementKeyEvidence:
        typeof skSlice?.attunement === 'string' && skSlice.attunement.trim()
          ? skSlice.attunement.trim()
          : null,
    });
  };

  add('Scenario 1 (Emma/Ryan)', mp?.scenario1 ?? null, mp?.keyEvidence.scenario1 ?? null, sk?.scenario1 ?? undefined);
  add('Scenario 2 (Sarah/James)', mp?.scenario2 ?? null, mp?.keyEvidence.scenario2 ?? null, sk?.scenario2 ?? undefined);
  add('Scenario 3 (Sophie/Daniel)', mp?.scenario3 ?? null, mp?.keyEvidence.scenario3 ?? null, sk?.scenario3 ?? undefined);

  let maxScenarioMentalizing: { scenarioLabel: string; score: number } | null = null;
  for (const s of slices) {
    if (s.mentalizing == null) continue;
    if (!maxScenarioMentalizing || s.mentalizing > maxScenarioMentalizing.score) {
      maxScenarioMentalizing = { scenarioLabel: s.scenarioLabel, score: s.mentalizing };
    }
  }

  return {
    slices,
    moment4Mentalizing: mp?.moment4 ?? null,
    moment4KeyEvidence: mp?.keyEvidence.moment4 ?? null,
    moment5Mentalizing: data.attempt?.moment5Profile?.pillarScores?.mentalizing ?? null,
    moment5KeyEvidence: data.attempt?.moment5Profile?.keyEvidence?.mentalizing ?? null,
    maxScenarioMentalizing,
  };
}

const SUPERLATIVE_PATTERNS = [
  /\bstrong,?\s+accurate\s+empathy\b/i,
  /\bconsistently\s+accurate\b/i,
  /\bin\s+every\s+scenario\b/i,
  /\bdemonstrated\s+strong\b/i,
  /\bexcellent\s+empathy\b/i,
  /\bremarkable\s+(perspective|empathy|accuracy)\b/i,
  /\breal\s+precision\b/i,
  /\bwith\s+real\s+precision\b/i,
];

export function detectScenarioScoreInflation(
  visibleNarrative: string,
  grounding: ScenarioScoreGrounding | null | undefined,
): string[] {
  if (!grounding) return [];
  const issues: string[] = [];
  const text = visibleNarrative.toLowerCase();
  const maxMentalizing = Math.max(
    ...grounding.slices.map((s) => s.mentalizing ?? 0),
    grounding.maxScenarioMentalizing?.score ?? 0,
  );
  const anyBelow7 =
    grounding.slices.some((s) => s.mentalizing != null && s.mentalizing < 7) ||
    (grounding.maxScenarioMentalizing?.score ?? 10) < 7;

  if (!anyBelow7) return [];

  const lowScenarios = grounding.slices
    .filter((s) => s.mentalizing != null && s.mentalizing < 7)
    .map((s) => `${s.scenarioLabel} at ${s.mentalizing}`);

  for (const pattern of SUPERLATIVE_PATTERNS) {
    if (pattern.test(visibleNarrative)) {
      issues.push(
        `scenario performance inflation: narrative uses superlative language (${pattern.source}) but scenario mentalizing includes below-7 scores (${lowScenarios.join(', ') || `max ${maxMentalizing}`}) — regenerate with score-band-appropriate language`,
      );
      break;
    }
  }

  if (
    /\bevery\s+scenario\b/i.test(visibleNarrative) &&
    grounding.slices.some((s) => s.mentalizing != null && s.mentalizing < 6)
  ) {
    issues.push(
      'scenario performance inflation: "every scenario" claim incompatible with Scenario scores below 6',
    );
  }

  if (text.includes('read others') && text.includes('precision') && maxMentalizing < 7) {
    issues.push(
      'scenario performance inflation: "precision" language for other-directed reading when scenario mentalizing max is below 7',
    );
  }

  return issues;
}

export function crossrefCitesScoreGrounding(
  crossref: string,
  grounding: ScenarioScoreGrounding | null | undefined,
): boolean {
  if (fieldIsExplicitNaCrossref(crossref)) return true;
  if (!grounding?.maxScenarioMentalizing) return /scenario\s*[123abc]/i.test(crossref);
  const hasScenario = /scenario\s*[123abc]/i.test(crossref);
  const hasScoreRef =
    /\bat\s+[4567]\b/i.test(crossref) ||
    crossref.includes(String(grounding.maxScenarioMentalizing.score)) ||
    /moderate|developing|competent|level.?1|5–6|5-6/i.test(crossref);
  const hasEvidence =
    crossref.includes('"') ||
    /keyEvidence|scorer note|identified|described|recognized/i.test(crossref);
  return hasScenario && (hasScoreRef || hasEvidence);
}

function fieldIsExplicitNaCrossref(crossref: string): boolean {
  return (
    /^not applicable/i.test(crossref.trim()) ||
    /^no meaningful scenario\/personal crossref/i.test(crossref.trim())
  );
}
