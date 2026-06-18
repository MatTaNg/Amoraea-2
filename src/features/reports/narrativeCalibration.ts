/**
 * Shared narrative calibration for ALL Amoraea report pipelines (Personal Full/Partial,
 * Relationship Full/Partial). Any new calibration fix belongs here — then wire every
 * report builder to composeNarrativeCalibration() in the same change. Do not add
 * gate-awareness or mechanics-hiding logic to a single report file in isolation.
 */
import type { GamingCorrectionResult } from '../psychometrics/computeGamingCorrection';
import { isPsychometricGateFailFloorCode } from '../psychometrics/psychometricFloorBreaches';

/** Keep in sync with GATE_PASS_WEIGHTED_MIN in computeGateResultCore (6.5). */
const GATE_PASS_WEIGHTED_MIN = 6.5;
const GATE_PASS_COMFORTABLE_MARGIN = 0.5;

export type ReportGateNarrativeTier = 'passed' | 'interview_fail' | 'psychometric_floor_only';

export type ReportGateCalibrationInput = {
  finalGatePass: boolean | null | undefined;
  gateFailReasons?: string[] | null | undefined;
  gamingCorrection?: GamingCorrectionResult | null | undefined;
  pillarScores?: Record<string, number> | null | undefined;
  /** Required for AAQ2/RSES distinction when psychometric floors apply. */
  aaq2Score?: number | null;
  modifiedWeightedScore?: number | null;
};

export type InterviewEvidencePromptInput = {
  pillarScores: Record<string, number> | null | undefined;
  scenarioKeyEvidence?: {
    scenario1?: string | null;
    scenario2?: string | null;
    scenario3?: string | null;
    moment4?: string | null;
  };
  scenarioMentalizingScores?: {
    scenario1?: number | null;
    scenario2?: number | null;
    scenario3?: number | null;
    moment4?: number | null;
  };
};

const PSYCHOMETRIC_FLOOR_QUALITATIVE: Record<string, string> = {
  rses_low_self_esteem_floor:
    'self-doubt or harsh self-criticism in the broader self-assessment — worth your own reflection, described qualitatively without naming instruments',
  aaq2_high_experiential_avoidance_floor:
    'a strong pattern of avoiding difficult emotions in the broader self-assessment',
  rfq_low_reflective_functioning_floor:
    'limited reflective depth in the broader self-assessment',
  gasp_extreme_externalization_floor:
    'a tendency to locate blame outside yourself in the broader self-assessment',
  dweck_extreme_fixed_mindset_floor:
    'a rigid fixed-mindset pattern in the broader self-assessment',
  scs_sf_low_self_compassion_floor:
    'low self-compassion in the broader self-assessment',
  brs_low_resilience_floor:
    'low resilience in the broader self-assessment',
  anxiety_trait_high_floor:
    'elevated trait anxiety in the broader self-assessment',
  sd3_narcissism_floor_fail:
    'elevated narcissism-related traits in the broader self-assessment',
  npi_entitlement_floor_fail:
    'elevated entitlement-related traits in the broader self-assessment',
};

export function getInterviewPriorityPrinciple(): string {
  return `PRIORITY PRINCIPLE (MANDATORY): The AI interview requires sustained, freeform engagement across many exchanges and is much harder to fake convincingly than a self-report Likert instrument, which can be straight-lined, rushed, or answered carelessly with no real cost to the respondent. When interview-derived signal (pillar bands, keyEvidence, transcript themes) and self-report psychometric signal diverge — especially when gaming_correction or consistency flags have already identified the divergence — weight the interview signal as more reliable in the OVERALL TONE of the report. Do not let a single low-confidence self-report instrument (especially one flagged for straight-lining or inconsistency with interview behavior) override strong, consistent interview performance with unqualified celebration — but also do not pretend the self-report signal does not exist when it surfaced a genuine concern.`;
}

export function getMechanicsHidingConstraints(): string {
  return `MECHANICS-HIDING (MANDATORY — all report text):
- Do NOT mention specific numerical scores, thresholds, percentiles, or raw numbers from any assessment
- Do NOT reveal pillar names, construct names, algorithm details, probe names, scenario labels, or scoring methodology
- Do NOT use instrument names (AAQ-II, RSES, SCS, GASP, BRS, RFQ, ECR, PVQ, TKI, etc.)
- Do NOT use the words "gate", "floor", "threshold", "pass", "fail", or "score" in an assessment sense
- Describe patterns in plain relational language only`;
}

export function partitionGateFailReasons(gateFailReasons: string[] | null | undefined): {
  interviewFailReasons: string[];
  psychometricFloorReasons: string[];
} {
  const reasons = (gateFailReasons ?? []).filter(
    (r): r is string => typeof r === 'string' && r.length > 0,
  );
  const psychometricFloorReasons = reasons.filter((r) => isPsychometricGateFailFloorCode(r));
  const interviewFailReasons = reasons.filter((r) => !isPsychometricGateFailFloorCode(r));
  return { interviewFailReasons, psychometricFloorReasons };
}

export function resolveReportGateNarrativeTier(
  input: Pick<ReportGateCalibrationInput, 'finalGatePass' | 'gateFailReasons'>,
): ReportGateNarrativeTier {
  if (input.finalGatePass !== false) return 'passed';
  const { interviewFailReasons, psychometricFloorReasons } = partitionGateFailReasons(
    input.gateFailReasons,
  );
  if (interviewFailReasons.length > 0) return 'interview_fail';
  if (psychometricFloorReasons.length > 0) return 'psychometric_floor_only';
  return 'interview_fail';
}

export function hasStrongInterviewDerivedPillars(
  pillarScores: Record<string, number> | null | undefined,
): boolean {
  if (!pillarScores) return false;
  const keys = [
    'repair',
    'mentalizing',
    'accountability',
    'contempt',
    'appreciation',
    'regulation',
    'attunement',
    'commitment_threshold',
  ];
  const vals = keys
    .map((k) => pillarScores[k])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (vals.length < 4) return false;
  return vals.reduce((a, b) => a + b, 0) / vals.length >= 7;
}

function floorCodeToInstrumentKey(floorCode: string): string | null {
  if (floorCode.includes('rses')) return 'rses';
  if (floorCode.includes('aaq2')) return 'aaq2';
  if (floorCode.includes('rfq')) return 'rfq';
  if (floorCode.includes('gasp')) return 'gasp';
  if (floorCode.includes('brs')) return 'brs';
  if (floorCode.includes('dweck')) return 'dweck';
  if (floorCode.includes('scs_sf')) return 'scs_sf';
  if (floorCode.includes('sd3')) return 'sd3_narcissism';
  if (floorCode.includes('npi')) return 'npi_entitlement';
  return null;
}

export function isInstrumentFlaggedInGamingCorrection(
  gamingCorrection: GamingCorrectionResult | null | undefined,
  instrumentKey: string,
): boolean {
  if (!gamingCorrection) return false;
  if (gamingCorrection.strippedInstruments.includes(instrumentKey)) return true;
  return gamingCorrection.activeTriggers.some(
    (t) =>
      t.instrument === instrumentKey &&
      (t.type === 'straight_line' || t.type === 'consistency_divergence'),
  );
}

/** True when a self-report instrument may be narrated in a personal full report. */
export function shouldNarrateInstrument(
  score: number | null,
  instrumentKey: string,
  gamingCorrection: GamingCorrectionResult | null | undefined,
  psychometricStraightLineFlags?: string[] | null | undefined,
): boolean {
  if (score == null || !Number.isFinite(score)) return false;
  if (gamingCorrection?.strippedInstruments.includes(instrumentKey)) return false;
  if (isInstrumentFlaggedInGamingCorrection(gamingCorrection, instrumentKey)) return false;
  const straightLineFlag = `${instrumentKey}_straight_line`;
  if ((psychometricStraightLineFlags ?? []).includes(straightLineFlag)) return false;
  return true;
}

function qualitativePsychometricFloorDescription(floorCode: string): string {
  return (
    PSYCHOMETRIC_FLOOR_QUALITATIVE[floorCode] ??
    'an area in the broader self-assessment worth honest reflection'
  );
}

type PsychometricInputCalibration = {
  selfWorthConcernRequiresQualifier: boolean;
  selfWorthFlaggedUnreliable: boolean;
  experientialAvoidanceIndependent: boolean;
};

function resolvePsychometricInputCalibration(input: {
  psychometricFloorReasons: string[];
  gamingCorrection: GamingCorrectionResult | null | undefined;
  aaq2Score: number | null | undefined;
}): PsychometricInputCalibration {
  const hasRsesFloor = input.psychometricFloorReasons.includes('rses_low_self_esteem_floor');
  const hasAaq2Floor = input.psychometricFloorReasons.includes(
    'aaq2_high_experiential_avoidance_floor',
  );
  const rsesUnreliable = isInstrumentFlaggedInGamingCorrection(input.gamingCorrection, 'rses');
  const aaq2Unreliable = isInstrumentFlaggedInGamingCorrection(input.gamingCorrection, 'aaq2');

  return {
    selfWorthConcernRequiresQualifier: hasRsesFloor,
    selfWorthFlaggedUnreliable: hasRsesFloor && rsesUnreliable,
    experientialAvoidanceIndependent:
      !hasAaq2Floor &&
      !aaq2Unreliable &&
      input.aaq2Score != null &&
      input.aaq2Score > 24,
  };
}

function passedInterviewWarmthSupplement(
  finalGatePass: boolean | null | undefined,
  modifiedWeightedScore: number | null | undefined,
): string {
  if (finalGatePass !== true) return '';
  const score =
    typeof modifiedWeightedScore === 'number' && Number.isFinite(modifiedWeightedScore)
      ? modifiedWeightedScore
      : GATE_PASS_WEIGHTED_MIN;
  if (score >= GATE_PASS_WEIGHTED_MIN + GATE_PASS_COMFORTABLE_MARGIN) {
    return 'PASSED INTERVIEW WARMTH: Assessment cleared with strong interview demonstration — you may describe well-evidenced interview strengths warmly in interview-focused sections.';
  }
  return 'PASSED INTERVIEW WARMTH: Assessment cleared — name genuine interview strengths but balance with growth areas; avoid overstating depth.';
}

/**
 * Gate-result tone calibration shared across all report types.
 * Returns empty string when gate is not yet applicable (e.g. relationship partial, no interview).
 */
export function getGateAwarenessCalibration(input: ReportGateCalibrationInput): string {
  const gateApplicable =
    input.finalGatePass != null ||
    (input.gateFailReasons != null && input.gateFailReasons.length > 0);
  if (!gateApplicable) return '';

  const tier = resolveReportGateNarrativeTier(input);
  const { interviewFailReasons, psychometricFloorReasons } = partitionGateFailReasons(
    input.gateFailReasons,
  );
  const strongInterview = hasStrongInterviewDerivedPillars(input.pillarScores);
  const psychometricCalibration = resolvePsychometricInputCalibration({
    psychometricFloorReasons,
    gamingCorrection: input.gamingCorrection,
    aaq2Score: input.aaq2Score,
  });

  if (tier === 'passed') {
    return `OVERALL OUTCOME (internal): Assessment cleared — apply existing report-specific calibration tiers unchanged.
${passedInterviewWarmthSupplement(input.finalGatePass, input.modifiedWeightedScore)}`;
  }

  const outcomeLine = `OVERALL OUTCOME (internal): The full assessment did not clear the bar. Interview-based fail signals: ${interviewFailReasons.length > 0 ? interviewFailReasons.join(', ') : 'none'}. Psychometric-only concerns: ${psychometricFloorReasons.length > 0 ? psychometricFloorReasons.map(qualitativePsychometricFloorDescription).join('; ') : 'none'}. Interview pillar profile ${strongInterview ? 'is generally strong' : 'is mixed or below strong'}.`;

  const gamingNotes = (() => {
    const flagged = psychometricFloorReasons
      .map((code) => {
        const instrument = floorCodeToInstrumentKey(code);
        if (
          !instrument ||
          !isInstrumentFlaggedInGamingCorrection(input.gamingCorrection, instrument)
        ) {
          return null;
        }
        return `Self-report input tied to "${qualitativePsychometricFloorDescription(code)}" was flagged internally as straight-lined or inconsistent with interview behavior — treat as lower confidence than interview-derived findings.`;
      })
      .filter(Boolean);
    if (flagged.length === 0) return '';
    return `\nGAMING / CONSISTENCY FLAGS (internal):\n${flagged.join('\n')}`;
  })();

  if (tier === 'interview_fail') {
    return `${outcomeLine}${gamingNotes}

INTERVIEW FAIL TONE (MANDATORY): Because interview-based performance did not clear the bar, do NOT use unqualified strength language ("genuinely impressive", "rare skill", "well ahead of where many people begin", "commendable", "remarkable ability", "surface-level engagement" as a dominant theme when scenario evidence shows depth) for overall interview performance or as the dominant tone of Overview/Closing/interview sections. Be warm and respectful; cite specific observable patterns from transcript and evidence below. Psychometric strengths may still be named in proportion to evidence. Growth-oriented framing is fine; false reassurance is not.`;
  }

  const floorDescriptions = psychometricFloorReasons
    .map(qualitativePsychometricFloorDescription)
    .join('; ');
  let block = `${outcomeLine}${gamingNotes}

PSYCHOMETRIC-ONLY CONCERN TONE (MANDATORY): The assessment did not clear solely because of self-report concern(s): ${floorDescriptions || 'see profile'}. This is NOT an interview-based fail.`;

  if (strongInterview) {
    block += `
Because interview-derived performance is strong and well-evidenced, you MAY continue to describe interview-derived strengths (repair, mentalizing, contempt-avoidance, appreciation, accountability, etc.) accurately and warmly — they are supported by reliable behavioral evidence.
You MUST NOT read as if the assessment posed no concerns at all — add a brief, honest, low-key acknowledgment (Overview and/or Closing) that one part of the broader self-assessment surfaced something worth your reflection.`;
  } else {
    block += `
Interview performance is mixed — describe interview findings proportionally without unqualified celebration.`;
  }

  if (psychometricCalibration.selfWorthConcernRequiresQualifier) {
    block += `
SELF-WORTH / SELF-ESTIMATION QUALIFIER (MANDATORY): Include a brief acknowledgment that one part of your self-assessment suggested some self-doubt or self-criticism worth paying attention to — never naming instruments or scores.`;
    if (psychometricCalibration.selfWorthFlaggedUnreliable) {
      block += ` That self-report pattern was internally flagged as less reliable than your interview behavior — weight interview accountability and repair signals more heavily; do not let low-confidence self-report override warm, accurate description of well-evidenced interview strengths.`;
    }
  }

  if (psychometricCalibration.experientialAvoidanceIndependent) {
    block += `
EXPERIENTIAL AVOIDANCE (SEPARATE INPUT): The profile also shows elevated experiential avoidance from a self-report band that was NOT flagged as straight-lined or unreliable. You may keep the avoidance-related narrative largely as-is in growth or friction sections — do NOT soften or merge it into the self-worth qualifier. Treat experiential avoidance and self-worth/self-criticism as distinct psychometric inputs.`;
  }

  block += `
Do NOT manufacture false reassurance that everything is fine; do NOT catastrophize a single low-confidence self-report data point into the dominant theme.`;
  return block;
}

export type PersonalInterviewEvidencePromptInput = {
  pillarScores: Record<string, number> | null | undefined;
  scenarioKeyEvidence?: {
    scenario1?: Record<string, string> | null;
    scenario2?: Record<string, string> | null;
    scenario3?: Record<string, string> | null;
  } | null;
  moment5Profile?: {
    pillarScores?: Record<string, number | null> | null;
    keyEvidence?: Record<string, string> | null;
  } | null;
  mentalizingProfile?: {
    scenario1?: number | null;
    scenario2?: number | null;
    scenario3?: number | null;
    moment4?: number | null;
    keyEvidence?: {
      scenario1?: string | null;
      scenario2?: string | null;
      scenario3?: string | null;
      moment4?: string | null;
    };
  } | null;
};

function formatStoredKeyEvidenceLines(
  label: string,
  keyEvidence: Record<string, string> | null | undefined,
): string | null {
  if (!keyEvidence) return null;
  const lines = Object.entries(keyEvidence)
    .filter(([, value]) => value.trim().length > 0)
    .map(([marker, value]) => `- ${marker}: "${value.slice(0, 280)}"`);
  if (lines.length === 0) return null;
  return `${label}:\n${lines.join('\n')}`;
}

function formatMoment5PillarBands(pillarScores: Record<string, number | null> | null | undefined): string {
  if (!pillarScores) return 'not assessed';
  const markers = ['repair', 'regulation', 'mentalizing', 'accountability', 'contempt_expression'] as const;
  return markers
    .map((marker) => `${marker}: ${pillarBand(pillarScores[marker] ?? null)}`)
    .join(' / ');
}

function pillarBand(score: number | undefined | null): string {
  if (score == null) return 'not assessed';
  if (score >= 8) return 'strong';
  if (score >= 7) return 'good';
  if (score >= 6) return 'developing';
  if (score >= 4) return 'needs attention';
  return 'significant growth area';
}

/**
 * Interview scoring detail for personal full reports — grounds strength/growth narrative
 * in per-scenario and M5 keyEvidence, mirroring buildInterviewEvidencePromptBlock.
 */
export function buildPersonalInterviewEvidenceBlock(
  input: PersonalInterviewEvidencePromptInput,
): string {
  const pillars = input.pillarScores ?? {};
  const sk = input.scenarioKeyEvidence ?? {};
  const m5 = input.moment5Profile;
  const mp = input.mentalizingProfile;

  const scenarioEvidenceLines = [
    formatStoredKeyEvidenceLines('Scenario 1 scorer notes', sk.scenario1),
    formatStoredKeyEvidenceLines('Scenario 2 scorer notes', sk.scenario2),
    formatStoredKeyEvidenceLines('Scenario 3 scorer notes', sk.scenario3),
  ].filter(Boolean);

  const m5EvidenceLines = formatStoredKeyEvidenceLines(
    'Personal conflict moment (M5) scorer notes',
    m5?.keyEvidence,
  );

  const mentalizingEvidenceLines = [
    mp?.keyEvidence?.scenario1
      ? `Scenario mentalizing note (avg context): "${mp.keyEvidence.scenario1.slice(0, 220)}"`
      : null,
    mp?.keyEvidence?.moment4
      ? `Personal grudge/reflection (M4) mentalizing note: "${mp.keyEvidence.moment4.slice(0, 220)}"`
      : null,
  ].filter(Boolean);

  const hasAnyEvidence =
    scenarioEvidenceLines.length > 0 || m5EvidenceLines != null || mentalizingEvidenceLines.length > 0;

  return `INTERVIEW SCORING EVIDENCE (internal — do not quote numbers or construct names to the reader):
- Holistic pillar bands: repair / attunement / regulation / mentalizing / appreciation / accountability / commitment / constructive communication: ${pillarBand(pillars.repair)} / ${pillarBand(pillars.attunement)} / ${pillarBand(pillars.regulation)} / ${pillarBand(pillars.mentalizing)} / ${pillarBand(pillars.appreciation)} / ${pillarBand(pillars.accountability)} / ${pillarBand(pillars.commitment_threshold)} / ${pillarBand(pillars.contempt)}
${
  m5
    ? `- Personal conflict moment (M5 — first-person account of your own behavior, highest-reliability accountability signal): ${formatMoment5PillarBands(m5.pillarScores)}`
    : '- Personal conflict moment (M5): not available'
}
${scenarioEvidenceLines.length > 0 ? scenarioEvidenceLines.join('\n') : '- No per-scenario keyEvidence excerpts available.'}
${m5EvidenceLines ?? '- No M5 keyEvidence excerpts available.'}
${mentalizingEvidenceLines.length > 0 ? mentalizingEvidenceLines.join('\n') : ''}

EVIDENCE GROUNDING RULE: Every specific behavioral claim about this user (e.g. "you tend to redirect emotions rather than receive them," "you named Sophie's perspective without prompting") must be traceable to a keyEvidence string or transcript moment in the data provided. Do not generate behavioral observations that are not supported by the evidence block. If the evidence for a claim is absent, omit the claim rather than inventing it.

${
  hasAnyEvidence
    ? "PERSONAL REPORT EVIDENCE CALIBRATION (MANDATORY): Ground Relational Strengths, Where You Have Room to Grow, and accountability/self-reflection observations in the scorer notes above. Weight M5 accountability and mentalizing evidence more heavily than scenario-derived equivalents when they diverge — M5 reflects the user's own stated behavior in a real conflict, not analysis of fictional characters."
    : 'PERSONAL REPORT EVIDENCE CALIBRATION: No keyEvidence excerpts available — rely on pillar bands and transcript themes only; do not invent specific behavioral observations.'
}`;
}

/**
 * Rich interview scoring detail for relationship (and other) reports — prevents generic
 * "surface-level engagement" filler when scenario evidence shows depth.
 */
export function buildInterviewEvidencePromptBlock(input: InterviewEvidencePromptInput): string {
  const pillars = input.pillarScores ?? {};
  const sm = input.scenarioMentalizingScores;
  const ke = input.scenarioKeyEvidence ?? {};
  const scenarioScores = [sm?.scenario1, sm?.scenario2, sm?.scenario3].filter(
    (v): v is number => typeof v === 'number',
  );
  const scenarioAvg =
    scenarioScores.length > 0
      ? scenarioScores.reduce((a, b) => a + b, 0) / scenarioScores.length
      : null;
  const strongScenarioEngagement = scenarioAvg != null && scenarioAvg >= 7;

  const evidenceLines = [
    ke.scenario1 ? `Scenario 1 scorer note: "${ke.scenario1.slice(0, 280)}"` : null,
    ke.scenario2 ? `Scenario 2 scorer note: "${ke.scenario2.slice(0, 280)}"` : null,
    ke.scenario3 ? `Scenario 3 scorer note: "${ke.scenario3.slice(0, 280)}"` : null,
    ke.moment4 ? `Personal reflection scorer note: "${ke.moment4.slice(0, 280)}"` : null,
  ].filter(Boolean);

  return `INTERVIEW SCORING EVIDENCE (internal — do not quote numbers or construct names to the reader):
- Repair / attunement / regulation / mentalizing / appreciation / accountability / commitment / constructive communication bands: ${pillarBand(pillars.repair)} / ${pillarBand(pillars.attunement)} / ${pillarBand(pillars.regulation)} / ${pillarBand(pillars.mentalizing)} / ${pillarBand(pillars.appreciation)} / ${pillarBand(pillars.accountability)} / ${pillarBand(pillars.commitment_threshold)} / ${pillarBand(pillars.contempt)}
${scenarioAvg != null ? `- Scenario engagement depth (internal average): ~${scenarioAvg.toFixed(1).replace(/\.0$/, '')} — ${strongScenarioEngagement ? 'generally strong/good' : 'mixed or developing'}` : ''}
${evidenceLines.length > 0 ? evidenceLines.join('\n') : '- No keyEvidence excerpts available — rely on transcript themes only.'}

INTERVIEW EVIDENCE CALIBRATION (MANDATORY): Ground interview-section claims in the scorer notes and transcript above. ${
    strongScenarioEngagement
      ? 'When scenario engagement is strong/good, do NOT characterize the interview as broadly "surface-level" or lacking depth in emotional themes — that contradicts the evidence. Describe specific strengths you can support; name growth edges only where evidence supports them.'
      : 'Describe interview patterns proportionally — do not invent depth or thinness not supported by the evidence.'
  }`;
}

/** Compose all shared calibration blocks for injection into a report prompt. */
export function composeNarrativeCalibration(input: ReportGateCalibrationInput): string {
  const gateBlock = getGateAwarenessCalibration(input);
  const parts = [getInterviewPriorityPrinciple(), getMechanicsHidingConstraints()];
  if (gateBlock) parts.push(gateBlock);
  return parts.join('\n\n');
}
