/**
 * Moment 4 accountability situational exemption — when other-party harm dominates,
 * low M4 self-attribution is appropriate; weight accountability pillar toward M5.
 */

export const MOMENT4_ACCOUNTABILITY_SITUATIONALLY_EXEMPT_KEY =
  'moment_4_accountability_situationally_exempt';
export const MOMENT4_ACCOUNTABILITY_SITUATIONALLY_EXEMPT_REASON_KEY =
  'moment_4_accountability_situationally_exempt_reason';

export type Moment4AccountabilityExemptResult = {
  exempt: boolean;
  reason: string | null;
};

export type AccountabilityReweightMeta = {
  moment4AccountabilitySituationallyExempt: true;
  reason: string;
  scenarioOnlyAccountability: number | undefined;
  reweightedAccountability: number;
  m4Accountability: number | null;
  m5Accountability: number | null;
  weights: Array<{ source: string; score: number; weight: number }>;
};

/** Scenario slices weight 1.0; M4 reduced; M5 elevated (more when M5 accountability ≥ 6). */
export const ACCOUNTABILITY_EXEMPT_SCENARIO_WEIGHT = 1;
export const ACCOUNTABILITY_EXEMPT_M4_WEIGHT = 0.25;
export const ACCOUNTABILITY_EXEMPT_M5_WEIGHT_DEFAULT = 1.5;
export const ACCOUNTABILITY_EXEMPT_M5_WEIGHT_STRONG = 2.5;
export const ACCOUNTABILITY_EXEMPT_M5_STRONG_MIN = 6;

type HarmSignal = {
  id: string;
  reason: string;
  test: (text: string) => boolean;
};

function normalizeExemptText(raw: string): string {
  return raw
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const HARM_SIGNALS: HarmSignal[] = [
  {
    id: 'abuse',
    reason: 'M4 disclosure involves abuse or significant emotional harm by the other party',
    test: (t) =>
      /\b(abus(e|ed|ive|er|ing)|domestic violence|emotionally abusive|physically abusive|violent toward me|hurt me emotionally|harm(ed)? me)\b/.test(
        t,
      ),
  },
  {
    id: 'abandonment',
    reason: 'M4 disclosure involves abandonment, neglect, or severe parental failure',
    test: (t) =>
      /\b(abandon(ed|ment|ing)?|neglect(ed|ful|ing)?|never showed up|didn't show up|did not show up|wasn't there for|was not there for|walked out on|left me with|left us with)\b/.test(
        t,
      ) ||
      (/\b(co-?parent|father of my child|mother of my child|my (child|kid|son|daughter)'s father|my (child|kid|son|daughter)'s mother)\b/.test(
        t,
      ) &&
        /\b(doesn't (show|visit|see)|does not (show|visit|see)|never (sees|visits|shows|showed)|absent|not involved|no contact with (the )?(child|kid|son|daughter))\b/.test(
          t,
        )),
  },
  {
    id: 'child_support',
    reason:
      'M4 disclosure involves co-parenting abandonment — accountability absence is situationally appropriate',
    test: (t) =>
      /\b(child support|owe(s|d)? (\$|[0-9]+)|(\$[0-9]+).{0,40}(support|owe|owed)|hasn't paid|has not paid|doesn't pay|does not pay)\b/.test(
        t,
      ) && /\b(child|kid|co-?parent|father|mother|parent)\b/.test(t),
  },
  {
    id: 'narcissism',
    reason: 'M4 disclosure involves described narcissistic or personality-disordered behavior by the other party',
    test: (t) =>
      /\b(narcissist(ic)?|personality disorder|borderline personality|antisocial|sociopath|psychopath|manipulat(ed|ive|ion)|gaslight(ed|ing))\b/.test(
        t,
      ),
  },
  {
    id: 'betrayal',
    reason: 'M4 disclosure involves severe betrayal where reasonable self-attribution is minimal',
    test: (t) =>
      /\b(cheat(ed|ing)? on me|had an affair|infidelity|unfaithful|betray(ed|al)|lied about money|financial fraud|stole from me|embezzl)\b/.test(
        t,
      ),
  },
  {
    id: 'deliberate_cruelty',
    reason: 'M4 disclosure involves deliberate cruelty or sustained harm by the other party',
    test: (t) =>
      /\b(cruel(ty)?|malicious|toxic (relationship|marriage|partner)|deliberately hurt|set out to hurt|punish(ed)? me)\b/.test(
        t,
      ),
  },
];

const APPROPRIATE_EXIT_SIGNAL: HarmSignal = {
  id: 'appropriate_exit',
  reason: 'M4 frames walking away or no-contact as appropriate given described harm',
  test: (t) =>
    /\b(no contact|went no contact|cut (him|her|them) off|blocked (him|her|them)|walk(ed)? away|had to leave|needed to leave|ended (the )?relationship|couldn't stay|could not stay)\b/.test(
      t,
    ),
};

function truthyMetadataFlag(raw: unknown): boolean {
  if (raw === true) return true;
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    return t === 'true' || t === 'yes' || t === '1';
  }
  return false;
}

function scoringMetadataFromUnknown(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/** Read model-persisted flag when present. */
export function readMoment4AccountabilityExemptFromScoringMetadata(
  scoringMetadata: unknown,
): Moment4AccountabilityExemptResult | null {
  const sm = scoringMetadataFromUnknown(scoringMetadata);
  if (!sm || !truthyMetadataFlag(sm[MOMENT4_ACCOUNTABILITY_SITUATIONALLY_EXEMPT_KEY])) return null;
  const reasonRaw = sm[MOMENT4_ACCOUNTABILITY_SITUATIONALLY_EXEMPT_REASON_KEY];
  const reason =
    typeof reasonRaw === 'string' && reasonRaw.trim()
      ? reasonRaw.trim()
      : 'M4 accountability absence is situationally appropriate given disclosed harm';
  return { exempt: true, reason };
}

/**
 * Heuristic detection from disclosure text (transcript and/or keyEvidence).
 * Uses multi-pattern semantic categories — not a single keyword gate.
 */
export function detectMoment4AccountabilitySituationalExempt(
  disclosureText: string,
): Moment4AccountabilityExemptResult {
  const text = normalizeExemptText(disclosureText);
  if (!text) return { exempt: false, reason: null };

  const matched = HARM_SIGNALS.filter((s) => s.test(text));
  if (matched.length >= 1) {
    return { exempt: true, reason: matched[0]!.reason };
  }

  if (APPROPRIATE_EXIT_SIGNAL.test(text)) {
    const harmAdjacent =
      /\b(harm|hurt|abuse|abandon|betray|toxic|narciss|support|child|co-?parent|unsafe|threat)\b/.test(
        text,
      );
    if (harmAdjacent) {
      return { exempt: true, reason: APPROPRIATE_EXIT_SIGNAL.reason };
    }
  }

  return { exempt: false, reason: null };
}

export function resolveMoment4AccountabilitySituationalExempt(params: {
  scoringMetadata?: unknown;
  disclosureText?: string | null;
  keyEvidence?: Record<string, string> | null;
}): Moment4AccountabilityExemptResult {
  const fromMeta = readMoment4AccountabilityExemptFromScoringMetadata(params.scoringMetadata);
  if (fromMeta) return fromMeta;

  const parts: string[] = [];
  if (params.disclosureText?.trim()) parts.push(params.disclosureText.trim());
  if (params.keyEvidence) {
    for (const v of Object.values(params.keyEvidence)) {
      if (typeof v === 'string' && v.trim()) parts.push(v.trim());
    }
  }
  return detectMoment4AccountabilitySituationalExempt(parts.join('\n'));
}

export function userTextFromTranscriptTurns(
  turns: Array<{ role?: string; content?: string }> | null | undefined,
): string {
  if (!turns?.length) return '';
  return turns
    .filter((m) => m.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .filter(Boolean)
    .join('\n');
}

export function momentUserTextFromInterviewTranscript(
  transcript: Array<{ role?: string; content?: string; interviewMoment?: number }> | null | undefined,
  moment: 4 | 5,
): string {
  if (!transcript?.length) return '';
  return transcript
    .filter((m) => m.role === 'user' && m.interviewMoment === moment)
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .filter(Boolean)
    .join('\n');
}

/** Persist exemption on Moment 4 score bundle (scoringMetadata + optional accountability keyEvidence note). */
export function applyMoment4AccountabilitySituationalExemptToScoreResult(
  result: {
    pillarScores?: Record<string, number | null | undefined> | null;
    keyEvidence?: Record<string, string> | null;
    scoringMetadata?: Record<string, unknown> | null;
  },
  disclosureText: string,
): Moment4AccountabilityExemptResult {
  const resolved = resolveMoment4AccountabilitySituationalExempt({
    scoringMetadata: result.scoringMetadata,
    disclosureText,
    keyEvidence: result.keyEvidence ?? null,
  });

  const sm: Record<string, unknown> = {
    ...(result.scoringMetadata ?? {}),
    [MOMENT4_ACCOUNTABILITY_SITUATIONALLY_EXEMPT_KEY]: resolved.exempt,
    [MOMENT4_ACCOUNTABILITY_SITUATIONALLY_EXEMPT_REASON_KEY]: resolved.reason ?? '',
  };
  result.scoringMetadata = sm;

  if (resolved.exempt && resolved.reason) {
    const existing = result.keyEvidence?.accountability?.trim() ?? '';
    const tag = `[M4 accountability situational exempt: ${resolved.reason}]`;
    result.keyEvidence = {
      ...(result.keyEvidence ?? {}),
      accountability: existing ? `${existing} ${tag}` : tag,
    };
  }

  return resolved;
}

export function scoredAccountabilityFromSlice(
  pillarScores: Record<string, number | null | undefined> | null | undefined,
  keyEvidence: Record<string, string> | null | undefined,
): number | null {
  if (!pillarScores) return null;
  const raw = pillarScores.accountability;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const ev = keyEvidence?.accountability?.trim() ?? '';
  if (/not assessed|insufficient evidence|no substantive engagement/i.test(ev)) return null;
  return raw;
}

/**
 * When M4 situational exempt: blend scenario accountability with reduced M4 + elevated M5.
 * Standard rollup (scenarios only) is unchanged when exempt does not fire.
 */
export function mergeAccountabilityPillarWhenM4SituationallyExempt(params: {
  baseScores: Record<string, number>;
  scenarioAccountabilityScores: Array<number | null | undefined>;
  m4Accountability: number | null;
  m5Accountability: number | null;
  exempt: Moment4AccountabilityExemptResult;
}): { scores: Record<string, number>; reweightMeta: AccountabilityReweightMeta | null } {
  const { baseScores, scenarioAccountabilityScores, m4Accountability, m5Accountability, exempt } =
    params;
  if (!exempt.exempt || !exempt.reason) {
    return { scores: baseScores, reweightMeta: null };
  }

  const weights: AccountabilityReweightMeta['weights'] = [];
  for (let i = 0; i < scenarioAccountabilityScores.length; i++) {
    const v = scenarioAccountabilityScores[i];
    if (typeof v === 'number' && Number.isFinite(v)) {
      weights.push({
        source: `scenario_${i + 1}`,
        score: v,
        weight: ACCOUNTABILITY_EXEMPT_SCENARIO_WEIGHT,
      });
    }
  }
  if (m4Accountability != null) {
    weights.push({
      source: 'moment_4',
      score: m4Accountability,
      weight: ACCOUNTABILITY_EXEMPT_M4_WEIGHT,
    });
  }
  if (m5Accountability != null) {
    const m5Weight =
      m5Accountability >= ACCOUNTABILITY_EXEMPT_M5_STRONG_MIN
        ? ACCOUNTABILITY_EXEMPT_M5_WEIGHT_STRONG
        : ACCOUNTABILITY_EXEMPT_M5_WEIGHT_DEFAULT;
    weights.push({ source: 'moment_5', score: m5Accountability, weight: m5Weight });
  }

  if (weights.length === 0) {
    return { scores: baseScores, reweightMeta: null };
  }

  const weightedSum = weights.reduce((a, w) => a + w.score * w.weight, 0);
  const weightTotal = weights.reduce((a, w) => a + w.weight, 0);
  const reweighted = Math.round(weightedSum / weightTotal);

  const reweightMeta: AccountabilityReweightMeta = {
    moment4AccountabilitySituationallyExempt: true,
    reason: exempt.reason,
    scenarioOnlyAccountability: baseScores.accountability,
    reweightedAccountability: reweighted,
    m4Accountability,
    m5Accountability,
    weights,
  };

  return {
    scores: { ...baseScores, accountability: reweighted },
    reweightMeta,
  };
}

export function accountabilityReweightMetaForStorage(
  meta: AccountabilityReweightMeta,
): Record<string, unknown> {
  return { ...meta };
}
