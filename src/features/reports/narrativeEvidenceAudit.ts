/**
 * Evidence inventory + claim audit logging for report narrative generation.
 * Used by ai_reasoning, personal partial/full, and relationship validation reports.
 */
import {
  PSYCHOMETRIC_INTEGRATION_INSTRUCTION,
  SCENARIO_PERSONAL_PATTERN_CROSSREF_INSTRUCTION,
} from '@features/reports/narrativeCalibration';
import {
  parseKeyEvidenceFromStoredSlice,
  parseMoment5ProfileFromStoredPatterns,
  parsePillarScoresFromStoredSlice,
  type PersonalReportMoment5Profile,
  type PersonalReportScenarioKeyEvidence,
} from '@features/psychometrics/personalReportNarrativeGuidance';
import {
  PILLAR_NARRATIVE_BAND_DEVELOPING_MIN,
  PILLAR_NARRATIVE_BAND_GOOD_MIN,
  PILLAR_NARRATIVE_BAND_NEEDS_ATTENTION_MIN,
  PILLAR_NARRATIVE_BAND_STRONG_MIN,
} from '@config/reports/pillarNarrativeBands';

export type NarrativeEvidenceSlice = {
  id: string;
  label: string;
  markerBands?: Record<string, string>;
  keyEvidenceMarkers?: string[];
};

export type NarrativeEvidenceInventory = {
  pipeline: string;
  slices: NarrativeEvidenceSlice[];
  psychometricSignals?: string[];
};

export type NarrativeEvidenceContext = {
  scenarioKeyEvidence?: PersonalReportScenarioKeyEvidence | null;
  moment4Profile?: PersonalReportMoment5Profile | null;
  moment5Profile?: PersonalReportMoment5Profile | null;
  mentalizingBySlice?: {
    scenario1?: number | null;
    scenario2?: number | null;
    scenario3?: number | null;
    moment4?: number | null;
  };
};

function pillarBand(score: number | undefined | null): string {
  if (score == null || !Number.isFinite(score)) return 'not assessed';
  if (score >= PILLAR_NARRATIVE_BAND_STRONG_MIN) return 'strong';
  if (score >= PILLAR_NARRATIVE_BAND_GOOD_MIN) return 'good';
  if (score >= PILLAR_NARRATIVE_BAND_DEVELOPING_MIN) return 'developing';
  if (score >= PILLAR_NARRATIVE_BAND_NEEDS_ATTENTION_MIN) return 'needs attention';
  return 'significant growth area';
}

function markerBandsFromPillarScores(
  scores: Record<string, number | null> | null | undefined,
): Record<string, string> | undefined {
  if (!scores) return undefined;
  const markers = [
    'repair',
    'regulation',
    'mentalizing',
    'accountability',
    'contempt',
    'contempt_expression',
    'attunement',
    'appreciation',
    'commitment_threshold',
  ];
  const out: Record<string, string> = {};
  for (const m of markers) {
    const v = scores[m];
    if (typeof v === 'number' && Number.isFinite(v)) out[m] = pillarBand(v);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function keyEvidenceMarkers(ke: Record<string, string> | null | undefined): string[] | undefined {
  if (!ke) return undefined;
  const keys = Object.keys(ke).filter((k) => ke[k]?.trim());
  return keys.length > 0 ? keys : undefined;
}

function parseScenarioKeyEvidenceFromSlice(raw: unknown): Record<string, string> | null {
  return parseKeyEvidenceFromStoredSlice(raw);
}

export function buildEvidenceContextFromAttemptPatterns(
  patterns: Record<string, unknown> | null | undefined,
  scenarioRows?: {
    scenario_1_scores?: unknown;
    scenario_2_scores?: unknown;
    scenario_3_scores?: unknown;
  },
): NarrativeEvidenceContext {
  const moment4Profile = (() => {
    const m4Raw = patterns?.moment_4_scores;
    if (m4Raw == null) return null;
    return {
      pillarScores: parsePillarScoresFromStoredSlice(m4Raw),
      keyEvidence: parseKeyEvidenceFromStoredSlice(m4Raw),
    } satisfies PersonalReportMoment5Profile;
  })();

  const moment5Profile = parseMoment5ProfileFromStoredPatterns(patterns);

  const scenarioKeyEvidence: PersonalReportScenarioKeyEvidence = {
    scenario1: parseScenarioKeyEvidenceFromSlice(scenarioRows?.scenario_1_scores),
    scenario2: parseScenarioKeyEvidenceFromSlice(scenarioRows?.scenario_2_scores),
    scenario3: parseScenarioKeyEvidenceFromSlice(scenarioRows?.scenario_3_scores),
  };

  const mentalizingBySlice: NarrativeEvidenceContext['mentalizingBySlice'] = {};
  for (const [n, raw] of [
    [1, scenarioRows?.scenario_1_scores],
    [2, scenarioRows?.scenario_2_scores],
    [3, scenarioRows?.scenario_3_scores],
  ] as const) {
    const ps = parsePillarScoresFromStoredSlice(raw);
    if (ps?.mentalizing != null) {
      mentalizingBySlice[`scenario${n}` as 'scenario1' | 'scenario2' | 'scenario3'] = ps.mentalizing;
    }
  }
  const m4Ps = moment4Profile?.pillarScores;
  if (m4Ps?.mentalizing != null) mentalizingBySlice.moment4 = m4Ps.mentalizing;

  return {
    scenarioKeyEvidence,
    moment4Profile: moment4Profile?.pillarScores || moment4Profile?.keyEvidence ? moment4Profile : null,
    moment5Profile,
    mentalizingBySlice: Object.keys(mentalizingBySlice).length > 0 ? mentalizingBySlice : undefined,
  };
}

export function buildPersonalReportEvidenceInventory(
  pipeline: string,
  attempt: {
    pillarScores?: Record<string, number> | null;
    scenarioKeyEvidence?: PersonalReportScenarioKeyEvidence | null;
    moment4Profile?: PersonalReportMoment5Profile | null;
    moment5Profile?: PersonalReportMoment5Profile | null;
    mentalizingProfile?: {
      scenario1?: number | null;
      scenario2?: number | null;
      scenario3?: number | null;
      moment4?: number | null;
    } | null;
  } | null,
  psychometricSignals?: string[],
): NarrativeEvidenceInventory {
  const slices: NarrativeEvidenceSlice[] = [];
  if (attempt?.scenarioKeyEvidence) {
    for (const [id, ke] of [
      ['scenario_1', attempt.scenarioKeyEvidence.scenario1],
      ['scenario_2', attempt.scenarioKeyEvidence.scenario2],
      ['scenario_3', attempt.scenarioKeyEvidence.scenario3],
    ] as const) {
      if (!ke) continue;
      slices.push({
        id,
        label: id.replace('_', ' '),
        keyEvidenceMarkers: keyEvidenceMarkers(ke),
      });
    }
  }
  if (attempt?.moment4Profile) {
    slices.push({
      id: 'moment_4',
      label: 'Personal grudge/reflection (M4)',
      markerBands: markerBandsFromPillarScores(attempt.moment4Profile.pillarScores),
      keyEvidenceMarkers: keyEvidenceMarkers(attempt.moment4Profile.keyEvidence),
    });
  }
  if (attempt?.moment5Profile) {
    slices.push({
      id: 'moment_5',
      label: 'Personal conflict account (M5)',
      markerBands: markerBandsFromPillarScores(attempt.moment5Profile.pillarScores),
      keyEvidenceMarkers: keyEvidenceMarkers(attempt.moment5Profile.keyEvidence),
    });
  }
  if (attempt?.mentalizingProfile) {
    const mp = attempt.mentalizingProfile;
    slices.push({
      id: 'mentalizing_slices',
      label: 'Mentalizing by slice',
      markerBands: {
        scenario1: mp.scenario1 != null ? pillarBand(mp.scenario1) : 'not assessed',
        scenario2: mp.scenario2 != null ? pillarBand(mp.scenario2) : 'not assessed',
        scenario3: mp.scenario3 != null ? pillarBand(mp.scenario3) : 'not assessed',
        moment4: mp.moment4 != null ? pillarBand(mp.moment4) : 'not assessed',
      },
      keyEvidenceMarkers: Object.entries(mp.keyEvidence ?? {})
        .filter(([, v]) => v?.trim())
        .map(([k]) => k),
    });
  }
  if (attempt?.pillarScores) {
    slices.push({
      id: 'holistic_pillars',
      label: 'Holistic interview pillars',
      markerBands: markerBandsFromPillarScores(attempt.pillarScores as Record<string, number | null>),
    });
  }
  return { pipeline, slices, psychometricSignals };
}

export function buildAiReasoningEvidenceInventory(
  scenarioScores: Record<
    number,
    { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined
  >,
  pillarScores: Record<string, number>,
  evidenceContext?: NarrativeEvidenceContext | null,
): NarrativeEvidenceInventory {
  const slices: NarrativeEvidenceSlice[] = [];
  for (const n of [1, 2, 3] as const) {
    const s = scenarioScores[n];
    if (!s) continue;
    const ke = evidenceContext?.scenarioKeyEvidence?.[`scenario${n}` as 'scenario1'];
    slices.push({
      id: `scenario_${n}`,
      label: s.scenarioName ?? `Scenario ${n}`,
      markerBands: markerBandsFromPillarScores(s.pillarScores),
      keyEvidenceMarkers: keyEvidenceMarkers(ke ?? undefined),
    });
  }
  if (evidenceContext?.moment4Profile) {
    slices.push({
      id: 'moment_4',
      label: 'Personal grudge/reflection (M4)',
      markerBands: markerBandsFromPillarScores(evidenceContext.moment4Profile.pillarScores),
      keyEvidenceMarkers: keyEvidenceMarkers(evidenceContext.moment4Profile.keyEvidence),
    });
  }
  if (evidenceContext?.moment5Profile) {
    slices.push({
      id: 'moment_5',
      label: 'Personal conflict account (M5)',
      markerBands: markerBandsFromPillarScores(evidenceContext.moment5Profile.pillarScores),
      keyEvidenceMarkers: keyEvidenceMarkers(evidenceContext.moment5Profile.keyEvidence),
    });
  }
  slices.push({
    id: 'holistic_pillars',
    label: 'Holistic interview pillars',
    markerBands: markerBandsFromPillarScores(pillarScores as Record<string, number | null>),
  });
  return { pipeline: 'ai_reasoning', slices };
}

export function logNarrativeEvidenceAudit(
  inventory: NarrativeEvidenceInventory,
  claimMap?: Record<string, string[] | string> | null,
): void {
  console.log('[NarrativeEvidence] generation audit', {
    pipeline: inventory.pipeline,
    availableSlices: inventory.slices.map((s) => ({
      id: s.id,
      label: s.label,
      markers: s.keyEvidenceMarkers,
      bands: s.markerBands,
    })),
    psychometricSignals: inventory.psychometricSignals ?? [],
    modelClaimMap: claimMap ?? null,
  });
}

const LIVE_PROMPT_LOG_MAX_CHARS = 120_000;

export type LiveNarrativePromptVerification = {
  pipeline: string;
  charCount: number;
  hasScenarioPersonalCrossrefInstruction: boolean;
  hasPsychometricIntegrationInstruction: boolean;
  hasSectionDistinctnessInstruction: boolean;
};

export function verifyLiveNarrativePromptStrings(
  system: string | undefined,
  userPrompt: string,
): Omit<LiveNarrativePromptVerification, 'pipeline' | 'charCount'> {
  const combined = `${system ?? ''}\n${userPrompt}`;
  return {
    hasScenarioPersonalCrossrefInstruction: combined.includes(
      SCENARIO_PERSONAL_PATTERN_CROSSREF_INSTRUCTION,
    ),
    hasPsychometricIntegrationInstruction: combined.includes(PSYCHOMETRIC_INTEGRATION_INSTRUCTION),
    hasSectionDistinctnessInstruction: /SECTION DISTINCTNESS \(MANDATORY/i.test(combined),
  };
}

/** Log the fully interpolated prompt immediately before the model API call. */
export function logLiveNarrativePrompt(
  pipeline: string,
  system: string | undefined,
  userPrompt: string,
): LiveNarrativePromptVerification {
  const verification = verifyLiveNarrativePromptStrings(system, userPrompt);
  const payload: LiveNarrativePromptVerification = {
    pipeline,
    charCount: userPrompt.length + (system?.length ?? 0),
    ...verification,
  };
  console.log('[NarrativePrompt] live interpolated prompt verification', payload);
  if (!verification.hasScenarioPersonalCrossrefInstruction) {
    console.warn(
      '[NarrativePrompt] MISSING verbatim scenario-personal crossref instruction in live prompt',
      { pipeline },
    );
  }
  const systemText = system ?? '(none)';
  const userText =
    userPrompt.length > LIVE_PROMPT_LOG_MAX_CHARS
      ? `${userPrompt.slice(0, LIVE_PROMPT_LOG_MAX_CHARS)}\n...[truncated for log]`
      : userPrompt;
  console.log('[NarrativePrompt] FULL_SYSTEM_PROMPT', systemText);
  console.log('[NarrativePrompt] FULL_USER_PROMPT', userText);
  return payload;
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

  const m4 = context.moment4Profile;
  if (m4?.pillarScores) {
    lines.push(
      `- M4 personal reflection bands: ${Object.entries(m4.pillarScores)
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => `${k} ${pillarBand(v)}`)
        .join(' / ') || 'not scored'}`,
    );
  }
  formatKe('M4', m4?.keyEvidence ?? undefined);

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

  if (context.mentalizingBySlice) {
    const m = context.mentalizingBySlice;
    lines.push(
      `- Mentalizing by slice (internal): scenario1=${m.scenario1 ?? '—'}, scenario2=${m.scenario2 ?? '—'}, scenario3=${m.scenario3 ?? '—'}, M4=${m.moment4 ?? '—'}`,
    );
  }

  if (lines.length === 0) return '';
  return `SLICE-LEVEL SCORING NOTES (internal — ground narrative claims here; do not quote construct names to reader):
${lines.join('\n')}`;
}
