/**
 * Deno copy — keep aligned with src/features/reports/narrativeEvidenceAudit.ts
 * and narrativeCalibration getEvidenceAwareNarrativeInstructions().
 */

export type NarrativeEvidenceContext = {
  scenarioKeyEvidence?: {
    scenario1?: Record<string, string> | null;
    scenario2?: Record<string, string> | null;
    scenario3?: Record<string, string> | null;
  } | null;
  moment4Profile?: {
    pillarScores?: Record<string, number | null> | null;
    keyEvidence?: Record<string, string> | null;
  } | null;
  moment5Profile?: {
    pillarScores?: Record<string, number | null> | null;
    keyEvidence?: Record<string, string> | null;
  } | null;
  mentalizingBySlice?: {
    scenario1?: number | null;
    scenario2?: number | null;
    scenario3?: number | null;
    moment4?: number | null;
  };
};

function pillarBand(score: number | undefined | null): string {
  if (score == null || !Number.isFinite(score)) return 'not assessed';
  if (score >= 8) return 'strong';
  if (score >= 7) return 'good';
  if (score >= 6) return 'developing';
  if (score >= 4) return 'needs attention';
  return 'significant growth area';
}

function parseKeyEvidence(raw: unknown): Record<string, string> | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const ke = o.keyEvidence;
  if (ke == null || typeof ke !== 'object' || Array.isArray(ke)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ke as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parsePillarScores(raw: unknown): Record<string, number | null> | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const ps = (raw as Record<string, unknown>).pillarScores;
  if (ps == null || typeof ps !== 'object' || Array.isArray(ps)) return null;
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(ps as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (v === null) out[k] = null;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function buildEvidenceContextFromAttemptPatterns(
  patterns: Record<string, unknown> | null | undefined,
  scenarioRows?: {
    scenario_1_scores?: unknown;
    scenario_2_scores?: unknown;
    scenario_3_scores?: unknown;
  },
): NarrativeEvidenceContext {
  const m4Raw = patterns?.moment_4_scores;
  const moment4Profile =
    m4Raw != null
      ? {
          pillarScores: parsePillarScores(m4Raw),
          keyEvidence: parseKeyEvidence(m4Raw),
        }
      : null;

  const m5Raw = patterns?.moment_5_scores;
  const moment5Profile =
    m5Raw != null
      ? {
          pillarScores: parsePillarScores(m5Raw),
          keyEvidence: parseKeyEvidence(m5Raw),
        }
      : null;

  return {
    scenarioKeyEvidence: {
      scenario1: parseKeyEvidence(scenarioRows?.scenario_1_scores),
      scenario2: parseKeyEvidence(scenarioRows?.scenario_2_scores),
      scenario3: parseKeyEvidence(scenarioRows?.scenario_3_scores),
    },
    moment4Profile:
      moment4Profile?.pillarScores || moment4Profile?.keyEvidence ? moment4Profile : null,
    moment5Profile:
      moment5Profile?.pillarScores || moment5Profile?.keyEvidence ? moment5Profile : null,
  };
}

export function buildPersonalMomentEvidencePromptBlock(
  context: NarrativeEvidenceContext | null | undefined,
): string {
  if (!context) return '';
  const lines: string[] = [];
  const formatKe = (label: string, ke: Record<string, string> | null | undefined) => {
    if (!ke) return;
    for (const [marker, value] of Object.entries(ke)) {
      if (!value.trim()) continue;
      lines.push(`- ${label} / ${marker}: "${value.slice(0, 280)}"`);
    }
  };
  formatKe('Scenario 1', context.scenarioKeyEvidence?.scenario1 ?? undefined);
  formatKe('Scenario 2', context.scenarioKeyEvidence?.scenario2 ?? undefined);
  formatKe('Scenario 3', context.scenarioKeyEvidence?.scenario3 ?? undefined);
  const m5 = context.moment5Profile;
  if (m5?.pillarScores) {
    lines.push(
      `- M5 personal conflict bands: ${Object.entries(m5.pillarScores)
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => `${k} ${pillarBand(v)}`)
        .join(' / ') || 'not scored'}`,
    );
  }
  formatKe('M5', m5?.keyEvidence ?? undefined);
  if (lines.length === 0) return '';
  return `SLICE-LEVEL SCORING NOTES (internal — ground narrative claims here; do not quote construct names to reader):
${lines.join('\n')}`;
}

export function getEvidenceAwareNarrativeInstructions(
  options: { includePsychometricLens?: boolean } = {},
): string {
  const SCENARIO_PERSONAL_PATTERN_CROSSREF_INSTRUCTION =
    "If the user's highest-scoring scenario for a given construct involves a theme that mirrors their personal disclosure (e.g., they scored well identifying avoidance/withdrawal in a fictional character's behavior, and their own personal pattern also involves avoidance), this connection must be made explicit in the narrative.";

  const PSYCHOMETRIC_INTEGRATION_INSTRUCTION =
    "Where a populated psychometric instrument score (GASP, RSES, Dweck, RFQ, self-compassion subscales, etc.) provides a meaningful lens on the report's central theme or growth recommendations, incorporate it into the relevant section in plain language.";

  const psychometricBlock = options.includePsychometricLens
    ? `
PSYCHOMETRIC LENS (when populated in profile data):
${PSYCHOMETRIC_INTEGRATION_INSTRUCTION}
- Skip psychometric inputs flagged as unreliable in NARRATIVE CALIBRATION — do not mention their absence to the reader.`
    : '';

  return `EVIDENCE-AWARE NARRATIVE (MANDATORY — overrides single-theme templating):

1) SELF-CORRECTING MOMENTS AS FEATURED CONTENT
When the transcript contains a moment where the user spontaneously demonstrates insight that complicates the report's main theme, pull that moment into a dedicated strength, nuance subsection, or construct_breakdown.nuance_and_context — NOT only the closing paragraph. Prioritize Moment 5 and follow-up probes.

2) CROSS-REFERENCE SCENARIO AND PERSONAL SLICES
${SCENARIO_PERSONAL_PATTERN_CROSSREF_INSTRUCTION}
Before claiming a pattern is uniform, compare scenario-level scorer notes and bands against personal M4/M5 evidence.

3) PRECISE WEAKNESS FRAMING
When slice-level bands vary, reflect where a construct is strongest (often M5) — not flat underdevelopment.

4) GROWTH SECTIONS MUST AUDIT FULL EVIDENCE
Before each growth-area paragraph, check ALL scenario notes, M4/M5 keyEvidence, and holistic bands.

5) AVOID SINGLE-ARC OVERRIDE
Name genuine tensions when counter-examples exist — do not force one dominant theme.${psychometricBlock}`;
}

export function getMandatoryNarrativeConnectionInstructions(
  options: { includePsychometricLens?: boolean } = {},
): string {
  const SCENARIO_PERSONAL_PATTERN_CROSSREF_INSTRUCTION =
    "If the user's highest-scoring scenario for a given construct involves a theme that mirrors their personal disclosure (e.g., they scored well identifying avoidance/withdrawal in a fictional character's behavior, and their own personal pattern also involves avoidance), this connection must be made explicit in the narrative.";

  const PSYCHOMETRIC_INTEGRATION_INSTRUCTION =
    "Where a populated psychometric instrument score (GASP, RSES, Dweck, RFQ, self-compassion subscales, etc.) provides a meaningful lens on the report's central theme or growth recommendations, incorporate it into the relevant section in plain language.";

  const lines = [
    'MANDATORY NARRATIVE CONNECTIONS (verbatim requirements):',
    `- CROSS-REFERENCING: ${SCENARIO_PERSONAL_PATTERN_CROSSREF_INSTRUCTION}`,
  ];
  if (options.includePsychometricLens) {
    lines.push(`- PSYCHOMETRIC INTEGRATION: ${PSYCHOMETRIC_INTEGRATION_INSTRUCTION}`);
  }
  return lines.join('\n');
}

export function logNarrativeEvidenceAudit(
  pipeline: string,
  slices: Array<{ id: string; label: string }>,
  claimMap?: Record<string, string[] | string> | null,
): void {
  console.log('[NarrativeEvidence] generation audit', {
    pipeline,
    availableSlices: slices,
    modelClaimMap: claimMap ?? null,
  });
}

function getConstructTensionReconciliationInstructions(): string {
  return `CONSTRUCT TENSION RECONCILIATION (MANDATORY — before finalizing):
Before completing the narrative, scan every construct (repair, mentalizing, accountability, regulation, avoidance, perspective-taking, etc.) referenced in BOTH a Strengths section and a Growth/Friction section.
- If the same construct is praised as a strength AND critiqued as a limitation, you MUST reconcile explicitly.
- REPAIR SPECIFICALLY: Do not praise repair as an "embedded instinct" in Strengths and later criticize repair as "too quick/shallow" without connecting the two as strength + edge of the same pattern.`;
}

function getGrowthHeaderConsolidationInstructions(): string {
  return `GROWTH HEADER CONSOLIDATION (MANDATORY — before finalizing):
Check whether two or more growth headings restate the SAME underlying finding (e.g. perspective-taking gap under multiple synonym headers). Consolidate into ONE section with multiple distinct evidence pieces.`;
}

export function getAiReasoningStructuralEnforcementInstructions(): string {
  return `STRUCTURAL NARRATIVE ENFORCEMENT (REQUIRED JSON fields — generation error if missing or generic):
- scenario_personal_pattern_crossref: One paragraph with a NAMED scenario (Scenario A/B/C) and personal M4/M5 connection. If no mirror: "No meaningful scenario/personal crossref — scenarios were [characteristic] and personal account was [characteristic], no shared theme."
- psychometric_integration: Exactly: "none applicable — ai_reasoning payload has no populated psychometric instruments; available here: interview pillar scores and transcript only; full personal report carries GASP/RSES/Dweck/RFQ/etc."
Weave crossref substance into overall_summary, overall_strengths, overall_growth_areas, or construct_breakdown — not metadata only.
${getConstructTensionReconciliationInstructions()}
${getGrowthHeaderConsolidationInstructions()}`;
}

export function buildStructuralRetryUserPromptAddon(issues: string[]): string {
  return `\n\nSTRUCTURAL ENFORCEMENT RETRY (prior response failed):\n${issues.map((i) => `- ${i}`).join('\n')}\nFix ALL issues. Weave crossref into narrative prose. Reconcile strength/growth contradictions. Consolidate duplicate growth headers.`;
}

export function validateAiReasoningStructuralEnforcement(reasoning: Record<string, unknown>): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const crossref = String(
    reasoning.scenario_personal_pattern_crossref ?? '',
  ).trim();
  const psych = String(
    reasoning.psychometric_integration ?? reasoning.psychometric_integration_notes ?? '',
  ).trim();
  if (!crossref) issues.push('missing scenario_personal_pattern_crossref JSON field');
  if (!psych) issues.push('missing psychometric_integration JSON field');
  if (crossref.length > 40 && !/no meaningful scenario\/personal crossref/i.test(crossref)) {
    const narrative = JSON.stringify(reasoning).toLowerCase();
    const terms = crossref.toLowerCase().match(/\b[a-z]{5,}\b/g)?.filter((w) => !['scenario', 'personal', 'pattern', 'mirrors'].includes(w)) ?? [];
    const matched = terms.filter((t) => narrative.includes(t)).length;
    if (matched < 2) {
      issues.push('scenario_personal_pattern_crossref not woven into narrative JSON fields');
    }
  }
  return { ok: issues.length === 0, issues };
}

export function logStructuralValidationOutcome(
  pipeline: string,
  result: { ok: boolean; issues: string[] },
  retried: boolean,
): void {
  if (result.ok) {
    console.log('[NarrativeStructural] validation passed', { pipeline, retried });
  } else {
    console.warn('[NarrativeStructural] validation failed', { pipeline, issues: result.issues, retried });
  }
}
