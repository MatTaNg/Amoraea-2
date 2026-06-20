/**
 * Structural enforcement for report narratives — required metadata fields + post-generation validation.
 */

import {
  crossrefCitesScoreGrounding,
  detectScenarioScoreInflation,
  type ScenarioScoreGrounding,
} from './scenarioScoreGrounding';

export const STRUCTURAL_NARRATIVE_BLOCK_START = '---STRUCTURAL_NARRATIVE_FIELDS---';
export const STRUCTURAL_NARRATIVE_BLOCK_END = '---END_STRUCTURAL_NARRATIVE_FIELDS---';

export type StructuralNarrativeFields = {
  scenario_personal_pattern_crossref: string;
  psychometric_integration: string;
};

export type StructuralValidationContext = {
  scenarioScoreGrounding?: ScenarioScoreGrounding | null;
  /** Non-AAQ2 instruments with usable scores — psychometric_integration must not be N/A when non-empty. */
  populatedNonAaq2InstrumentLabels?: string[];
  requirePsychometricIntegration?: boolean;
};

export type StructuralValidationResult = {
  ok: boolean;
  issues: string[];
  fields: Partial<StructuralNarrativeFields> | null;
  crossrefWovenIntoNarrative: boolean;
  crossrefHasRealContent: boolean;
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'with',
  'your',
  'you',
  'this',
  'from',
  'their',
  'they',
  'when',
  'into',
  'about',
  'were',
  'was',
  'are',
  'has',
  'have',
  'not',
  'but',
  'than',
  'more',
  'most',
  'also',
  'only',
  'user',
  'scenario',
  'personal',
  'pattern',
  'narrative',
  'explicit',
  'connection',
  'meaningful',
  'crossref',
  'applicable',
  'none',
  'instruments',
  'populated',
  'beyond',
]);

const GENERIC_CROSSREF_PATTERNS = [
  /^not applicable/i,
  /^no meaningful scenario\/personal crossref/i,
  /^no genuine connection/i,
  /no shared theme/i,
];

const GENERIC_PSYCHOMETRIC_PATTERNS = [
  /^none applicable/i,
  /^not applicable/i,
  /no populated instruments/i,
];

export function getConstructTensionReconciliationInstructions(): string {
  return `CONSTRUCT TENSION RECONCILIATION (MANDATORY — before finalizing):
Before completing the narrative, scan every construct (repair, mentalizing, accountability, regulation, avoidance, perspective-taking, etc.) referenced in BOTH a Strengths section and a Growth/Friction section.
- If the same construct is praised as a strength AND critiqued as a limitation, you MUST reconcile explicitly — never leave contradictory claims for the reader to infer.
- Option (a): Merge into one nuanced paragraph that names both the strength and its specific limitation as two sides of the same pattern (e.g. repair instinct is real, but it can run too fast/clean and skip emotional processing).
- Option (b): State clearly in BOTH sections that different contexts apply (e.g. scenario-based repair reads vs. personal M5 follow-through) and name that distinction directly in the prose.
- REPAIR SPECIFICALLY: Do not praise repair as an "embedded instinct" in Strengths and later criticize repair as "too quick/shallow" without one sentence connecting the two (strength + edge of the same pattern).`;
}

export function getGrowthHeaderConsolidationInstructions(): string {
  return `GROWTH HEADER CONSOLIDATION (MANDATORY — before finalizing):
Before completing growth sections, check whether two or more ### growth-area headings substantively restate the SAME underlying finding (e.g. perspective-taking gap, mentalizing uncertainty, "turning the lens toward others," "holding uncertainty about what others are thinking" — these are often ONE construct, not three).
- If multiple headers describe the same underlying gap, consolidate into ONE ### section with multiple distinct pieces of evidence (scenario note + M4/M5 note + self-report lens), not three synonym headers.
- Each remaining growth ### heading must name a genuinely distinct developmental edge with non-overlapping evidence.`;
}

export function getMarkdownStructuralEnforcementInstructions(
  populatedInstruments: string[],
  options: { includePsychometrics: boolean } = { includePsychometrics: true },
): string {
  const instrumentList =
    populatedInstruments.length > 0
      ? populatedInstruments.join(', ')
      : options.includePsychometrics
        ? '(none populated or all flagged unreliable)'
        : '(interview-only path — no psychometric profile in this prompt)';

  return `STRUCTURAL NARRATIVE ENFORCEMENT (MANDATORY — output is INVALID without this block):
Before "## Overview", output EXACTLY this block (machine-parseable, stripped before reader sees PDF):

${STRUCTURAL_NARRATIVE_BLOCK_START}
scenario_personal_pattern_crossref: [REQUIRED — one paragraph naming a SPECIFIC connection between a scenario-level finding and personal disclosure. MUST cite highest scenario score band + keyEvidence quote AND M4/M5 quote/paraphrase. Match language to score band (5–6 = moderate/competent, NOT "strong/accurate empathy"). Template: "Your highest scenario score for [construct] was in Scenario [X] at [band], where you [keyEvidence pattern]. Your personal account showed [M4/M5 pattern]." If no genuine mirror exists, write exactly: "No meaningful scenario/personal crossref — scenarios were [characteristic] and personal account was [characteristic], no shared theme."]
psychometric_integration: [REQUIRED — when populated non-AAQ2 instruments exist in POPULATED PSYCHOMETRIC LENSES below, name at least one in plain language and how it lenses the narrative — N/A is INVALID on this path. Otherwise either weave AAQ-II/experiential-avoidance band OR write exactly: "none applicable — no populated instruments beyond [list actual absent/unavailable names from: GASP, RSES, Dweck, RFQ, self-compassion subscales, BRS, MSPSS, AAQ-II] with one-line reason."]
${STRUCTURAL_NARRATIVE_BLOCK_END}

After the block, weave scenario_personal_pattern_crossref content into the VISIBLE narrative in "## Your Relational Strengths" OR "## Where You Have Room to Grow" (whichever fits) — not only in the structural block.
After the block, weave psychometric_integration content into the relevant visible section when an instrument applies.

${getConstructTensionReconciliationInstructions()}

${getGrowthHeaderConsolidationInstructions()}`;
}

export function getAiReasoningStructuralEnforcementInstructions(): string {
  return `STRUCTURAL NARRATIVE ENFORCEMENT (REQUIRED JSON fields — generation error if missing or generic):
- scenario_personal_pattern_crossref: One paragraph with a NAMED scenario (Scenario A/B/C) and personal M4/M5 connection, including specific theme + quote/paraphrase. If no mirror, exactly: "No meaningful scenario/personal crossref — scenarios were [characteristic] and personal account was [characteristic], no shared theme."
- psychometric_integration: This path has interview scores + transcript only (no GASP/RSES/Dweck/RFQ profile). Write exactly: "none applicable — ai_reasoning payload has no populated psychometric instruments; available here: interview pillar scores and transcript only; full personal report carries GASP/RSES/Dweck/RFQ/etc."

You MUST weave scenario_personal_pattern_crossref substance into overall_summary, overall_strengths, overall_growth_areas, or construct_breakdown prose — not only the JSON metadata field.

${getConstructTensionReconciliationInstructions()}

${getGrowthHeaderConsolidationInstructions()}`;
}

export function parseStructuralNarrativeFields(markdown: string): Partial<StructuralNarrativeFields> | null {
  const start = markdown.indexOf(STRUCTURAL_NARRATIVE_BLOCK_START);
  const end = markdown.indexOf(STRUCTURAL_NARRATIVE_BLOCK_END);
  if (start < 0 || end < 0 || end <= start) return null;

  const block = markdown.slice(start + STRUCTURAL_NARRATIVE_BLOCK_START.length, end).trim();
  const crossrefMatch = block.match(
    /^scenario_personal_pattern_crossref:\s*([\s\S]*?)(?=^psychometric_integration:|\s*$)/im,
  );
  const psychMatch = block.match(/^psychometric_integration:\s*([\s\S]*)$/im);

  const scenario_personal_pattern_crossref = crossrefMatch?.[1]?.trim() ?? '';
  const psychometric_integration = psychMatch?.[1]?.trim() ?? '';

  if (!scenario_personal_pattern_crossref && !psychometric_integration) return null;
  return { scenario_personal_pattern_crossref, psychometric_integration };
}

export function stripStructuralNarrativeBlock(markdown: string): string {
  const start = markdown.indexOf(STRUCTURAL_NARRATIVE_BLOCK_START);
  if (start < 0) return markdown.trim();
  const end = markdown.indexOf(STRUCTURAL_NARRATIVE_BLOCK_END);
  if (end < 0) return markdown.trim();
  const after = markdown.slice(end + STRUCTURAL_NARRATIVE_BLOCK_END.length).trim();
  return after.replace(/^\n+/, '');
}

export function getVisibleNarrativeMarkdown(markdown: string): string {
  return stripStructuralNarrativeBlock(markdown);
}

function fieldIsExplicitNa(crossref: string): boolean {
  return GENERIC_CROSSREF_PATTERNS.some((re) => re.test(crossref.trim()));
}

function psychometricIsExplicitNa(psych: string): boolean {
  return GENERIC_PSYCHOMETRIC_PATTERNS.some((re) => re.test(psych.trim()));
}

function fieldIsTooShort(value: string, minLen: number): boolean {
  return value.trim().length < minLen;
}

export function extractCrossrefKeyTerms(crossref: string): string[] {
  const quoted =
    crossref.match(/"([^"]{6,80})"/g)?.map((q) => q.slice(1, -1).toLowerCase()) ?? [];
  const words = crossref
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOP_WORDS.has(w));
  const unique = [...new Set([...quoted.flatMap((q) => q.split(/\s+/).filter((w) => w.length >= 5)), ...words])];
  return unique.slice(0, 12);
}

export function crossrefWovenIntoNarrative(crossref: string, visibleNarrative: string): boolean {
  const trimmed = crossref.trim();
  if (!trimmed) return false;
  if (fieldIsExplicitNa(trimmed)) return true;

  const narrativeLower = visibleNarrative.toLowerCase();
  const quoted = trimmed.match(/"([^"]{6,})"/g)?.map((q) => q.slice(1, -1).toLowerCase()) ?? [];
  if (quoted.some((q) => narrativeLower.includes(q.slice(0, Math.min(q.length, 50))))) {
    return true;
  }

  const scenarioNamed =
    /scenario\s*[abc123]/i.test(trimmed) || /scenario\s*[123]/i.test(trimmed) || /\bM[45]\b/i.test(trimmed);
  const terms = extractCrossrefKeyTerms(trimmed);
  if (terms.length === 0) return false;
  const matched = terms.filter((t) => narrativeLower.includes(t)).length;
  if (scenarioNamed && matched >= 2) return true;
  return matched >= 3;
}

export function crossrefHasRealContent(crossref: string): boolean {
  const trimmed = crossref.trim();
  if (fieldIsTooShort(trimmed, 30)) return false;
  if (fieldIsExplicitNa(trimmed)) return false;
  return (
    /scenario\s*[abc123]/i.test(trimmed) ||
    /\bM[45]\b/i.test(trimmed) ||
    /mirrors|mirror|parallels|same theme|shared theme/i.test(trimmed)
  );
}

export function psychometricWovenIntoNarrative(psych: string, visibleNarrative: string): boolean {
  const trimmed = psych.trim();
  if (!trimmed) return false;
  if (psychometricIsExplicitNa(trimmed)) return true;

  const narrativeLower = visibleNarrative.toLowerCase();
  const psychLower = trimmed.toLowerCase();
  const quoted =
    trimmed.match(/"([^"]{6,})"/g)?.map((q) => q.slice(1, -1).toLowerCase()) ?? [];
  if (quoted.some((q) => narrativeLower.includes(q.slice(0, Math.min(q.length, 50))))) {
    return true;
  }

  const lensTerms = [
    'self-worth',
    'self-esteem',
    'harm-response',
    'repair',
    'withdrawal',
    'mindset',
    'growth orientation',
    'resilience',
    'self-compassion',
    'kindness toward yourself',
    'support',
    'reflective',
    'experiential avoidance',
    'psychological flexibility',
    'learning orientation',
  ];
  const matched = lensTerms.filter(
    (t) => psychLower.includes(t) && narrativeLower.includes(t),
  ).length;
  if (matched >= 1) return true;

  const terms = extractCrossrefKeyTerms(trimmed).filter((t) => t.length >= 6);
  const termMatches = terms.filter((t) => narrativeLower.includes(t)).length;
  return termMatches >= 2;
}

export function validateMarkdownStructuralEnforcement(
  markdown: string,
  context: StructuralValidationContext = {},
): StructuralValidationResult {
  const issues: string[] = [];
  const fields = parseStructuralNarrativeFields(markdown);
  const visible = getVisibleNarrativeMarkdown(markdown);

  if (!fields?.scenario_personal_pattern_crossref?.trim()) {
    issues.push('missing scenario_personal_pattern_crossref structural field');
  }
  if (!fields?.psychometric_integration?.trim()) {
    issues.push('missing psychometric_integration structural field');
  }

  const crossref = fields?.scenario_personal_pattern_crossref?.trim() ?? '';
  const psych = fields?.psychometric_integration?.trim() ?? '';

  if (crossref && fieldIsTooShort(crossref, 25) && !fieldIsExplicitNa(crossref)) {
    issues.push('scenario_personal_pattern_crossref too short or generic');
  }
  if (psych && fieldIsTooShort(psych, 20) && !psychometricIsExplicitNa(psych)) {
    issues.push('psychometric_integration too short or generic');
  }

  const woven = crossref ? crossrefWovenIntoNarrative(crossref, visible) : false;
  const realCrossref = crossref ? crossrefHasRealContent(crossref) : false;

  if (realCrossref && !woven) {
    issues.push(
      'scenario_personal_pattern_crossref has real content but key terms do not appear in visible narrative',
    );
  }

  if (realCrossref && !crossrefCitesScoreGrounding(crossref, context.scenarioScoreGrounding)) {
    issues.push(
      'scenario_personal_pattern_crossref lacks score-grounded evidence (scenario reference + score band or keyEvidence citation)',
    );
  }

  const inflationIssues = detectScenarioScoreInflation(visible, context.scenarioScoreGrounding);
  issues.push(...inflationIssues);

  const nonAaq2 = context.populatedNonAaq2InstrumentLabels ?? [];
  const requirePsych =
    context.requirePsychometricIntegration === true && nonAaq2.length > 0;
  if (requirePsych && psychometricIsExplicitNa(psych)) {
    issues.push(
      `psychometric_integration marked N/A but populated non-AAQ2 instruments exist (${nonAaq2.join(', ')}) — must weave at least one in plain language`,
    );
  }
  if (requirePsych && psych && !psychometricIsExplicitNa(psych) && !psychometricWovenIntoNarrative(psych, visible)) {
    issues.push(
      'psychometric_integration has content but lens terms do not appear in visible narrative',
    );
  }

  return {
    ok: issues.length === 0,
    issues,
    fields: fields ?? null,
    crossrefWovenIntoNarrative: woven,
    crossrefHasRealContent: realCrossref,
  };
}

export function collectAiReasoningNarrativeText(reasoning: Record<string, unknown>): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) parts.push(v);
    if (Array.isArray(v)) v.forEach(push);
  };
  push(reasoning.overall_summary);
  push(reasoning.overall_strengths);
  push(reasoning.overall_growth_areas);
  push(reasoning.cross_scenario_patterns);
  push(reasoning.what_a_partner_would_experience);
  push(reasoning.readiness_assessment);
  push(reasoning.closing_reflection);
  const breakdown = reasoning.construct_breakdown;
  if (breakdown && typeof breakdown === 'object') {
    for (const entry of Object.values(breakdown as Record<string, unknown>)) {
      if (entry && typeof entry === 'object') {
        for (const v of Object.values(entry as Record<string, unknown>)) push(v);
      }
    }
  }
  return parts.join('\n');
}

export function validateAiReasoningStructuralEnforcement(
  reasoning: Record<string, unknown>,
): StructuralValidationResult {
  const issues: string[] = [];
  const crossref = String(
    reasoning.scenario_personal_pattern_crossref ??
      reasoning.scenario_personal_pattern_crossref_notes ??
      '',
  ).trim();
  const psych = String(
    reasoning.psychometric_integration ?? reasoning.psychometric_integration_notes ?? '',
  ).trim();

  if (!crossref) issues.push('missing scenario_personal_pattern_crossref JSON field');
  if (!psych) issues.push('missing psychometric_integration JSON field');

  if (crossref && fieldIsTooShort(crossref, 25) && !fieldIsExplicitNa(crossref)) {
    issues.push('scenario_personal_pattern_crossref too short or generic');
  }
  if (psych && fieldIsTooShort(psych, 20) && !psychometricIsExplicitNa(psych)) {
    issues.push('psychometric_integration too short or generic');
  }

  const narrativeText = collectAiReasoningNarrativeText(reasoning);
  const woven = crossref ? crossrefWovenIntoNarrative(crossref, narrativeText) : false;
  const realCrossref = crossref ? crossrefHasRealContent(crossref) : false;

  if (realCrossref && !woven) {
    issues.push(
      'scenario_personal_pattern_crossref has real content but key terms do not appear in narrative JSON fields',
    );
  }

  return {
    ok: issues.length === 0,
    issues,
    fields: crossref || psych ? { scenario_personal_pattern_crossref: crossref, psychometric_integration: psych } : null,
    crossrefWovenIntoNarrative: woven,
    crossrefHasRealContent: realCrossref,
  };
}

export function buildStructuralRetryUserPromptAddon(issues: string[]): string {
  return `

STRUCTURAL ENFORCEMENT RETRY (your prior response failed validation):
${issues.map((i) => `- ${i}`).join('\n')}

Fix ALL issues. Include the structural block (markdown) or JSON fields exactly as specified. Weave crossref substance into visible Strengths or Growth prose. Reconcile any strength/growth contradictions on the same construct. Consolidate duplicate growth headers.`;
}

export function logStructuralValidationOutcome(
  pipeline: string,
  result: StructuralValidationResult,
  retried: boolean,
): void {
  const payload = {
    pipeline,
    ok: result.ok,
    issues: result.issues,
    crossref_woven: result.crossrefWovenIntoNarrative,
    crossref_has_real_content: result.crossrefHasRealContent,
    retried,
  };
  if (result.ok) {
    console.log('[NarrativeStructural] validation passed', payload);
  } else {
    console.warn('[NarrativeStructural] validation failed', payload);
  }
}

export function listPopulatedNarrativeInstrumentLabels(
  input: {
    aaq2Score?: number | null;
    rsesScore?: number | null;
    psychometrics?: {
      gaspScore?: number | null;
      dweckScore?: number | null;
      rfqScore?: number | null;
      brsScore?: number | null;
      scsSfScore?: number | null;
      mspssScore?: number | null;
    };
    gamingCorrection?: { strippedInstruments?: string[] } | null;
    psychometricStraightLineFlags?: string[] | null;
  },
  options: { ignoreGamingCorrection?: boolean } = {},
): string[] {
  const labels: string[] = [];
  const stripped = new Set(input.gamingCorrection?.strippedInstruments ?? []);
  const flags = input.psychometricStraightLineFlags ?? [];
  const ok = (key: string, score: number | null | undefined, label: string) => {
    if (score == null || !Number.isFinite(score)) return;
    if (!options.ignoreGamingCorrection && stripped.has(key)) return;
    if (flags.includes(`${key}_straight_line`)) return;
    labels.push(label);
  };
  ok('aaq2', input.aaq2Score ?? null, 'AAQ-II/experiential avoidance');
  ok('rses', input.rsesScore ?? null, 'RSES/self-esteem');
  ok('gasp', input.psychometrics?.gaspScore ?? null, 'GASP/harm-response');
  ok('dweck', input.psychometrics?.dweckScore ?? null, 'Dweck/mindset');
  ok('rfq', input.psychometrics?.rfqScore ?? null, 'RFQ/reflective functioning');
  ok('brs', input.psychometrics?.brsScore ?? null, 'BRS/resilience');
  ok('scs_sf', input.psychometrics?.scsSfScore ?? null, 'self-compassion subscales');
  ok('mspss', input.psychometrics?.mspssScore ?? null, 'MSPSS/perceived support');
  return labels;
}

export function listPopulatedNonAaq2NarrativeInstrumentLabels(
  input: Parameters<typeof listPopulatedNarrativeInstrumentLabels>[0],
  options?: Parameters<typeof listPopulatedNarrativeInstrumentLabels>[1],
): string[] {
  return listPopulatedNarrativeInstrumentLabels(input, options).filter(
    (l) => !l.startsWith('AAQ-II'),
  );
}
