import type { GamingCorrectionResult } from './computeGamingCorrection';
import { shouldNarrateInstrument, REPORT_NARRATE_INSTRUMENT_OPTIONS } from '../reports/narrativeCalibration';

export type PersonalReportPsychometricScores = {
  brsScore: number | null;
  scsSfScore: number | null;
  scsSfSelfKindnessScore: number | null;
  scsSfCommonHumanityScore: number | null;
  scsSfMindfulnessScore: number | null;
  mspssScore: number | null;
  mspssFamilyScore: number | null;
  mspssFriendsScore: number | null;
  /** Reflective Functioning Questionnaire mean (1–7) — higher = stronger reflective depth. */
  rfqScore: number | null;
  /** GASP mean (1–7) — harm-response tendencies. */
  gaspScore: number | null;
  /** Dweck mindset mean — higher = more growth-oriented. */
  dweckScore: number | null;
  rsesScore: number | null;
};

const SELF_REPORT_FRAMING =
  'SELF-REPORT FRAMING (MANDATORY): Describe these patterns as tendencies the profile suggests — not definitive characterizations. Interview-derived behavioral evidence outweighs self-report when they diverge (see PRIORITY PRINCIPLE).';

export function parsePsychometricStraightLineFlags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

export { shouldNarrateInstrument } from '../reports/narrativeCalibration';

function scsSubscaleBand(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 3.5) return 'higher';
  if (score >= 2.5) return 'mid-range';
  return 'lower';
}

function brsResilienceBand(score: number): 'high' | 'moderate' | 'low' {
  if (score >= 3.5) return 'high';
  if (score >= 2.5) return 'moderate';
  return 'low';
}

function mspssSupportBand(score: number): 'high' | 'moderate' | 'low' {
  if (score >= 5.5) return 'high';
  if (score >= 4.0) return 'moderate';
  return 'low';
}

function rfqReflectiveBand(score: number): 'strong' | 'moderate' | 'limited' {
  if (score >= 5.0) return 'strong';
  if (score >= 3.5) return 'moderate';
  return 'limited';
}

function effectiveScsSfScore(scores: PersonalReportPsychometricScores): number | null {
  if (scores.scsSfScore != null) return scores.scsSfScore;
  const subs = [
    scores.scsSfSelfKindnessScore,
    scores.scsSfCommonHumanityScore,
    scores.scsSfMindfulnessScore,
  ].filter((s): s is number => s != null && Number.isFinite(s));
  if (subs.length === 0) return null;
  return subs.reduce((a, b) => a + b, 0) / subs.length;
}

function hasScsSfSubscales(scores: PersonalReportPsychometricScores): boolean {
  return (
    scores.scsSfSelfKindnessScore != null ||
    scores.scsSfCommonHumanityScore != null ||
    scores.scsSfMindfulnessScore != null
  );
}

function effectiveMspssScore(scores: PersonalReportPsychometricScores): number | null {
  if (scores.mspssScore != null) return scores.mspssScore;
  const subs = [scores.mspssFamilyScore, scores.mspssFriendsScore].filter(
    (s): s is number => s != null && Number.isFinite(s),
  );
  if (subs.length === 0) return null;
  return subs.reduce((a, b) => a + b, 0) / subs.length;
}

export function buildBrsPersonalReportInstruction(
  scores: PersonalReportPsychometricScores,
  gamingCorrection: GamingCorrectionResult | null,
  straightLineFlags: string[],
): string | null {
  const score = scores.brsScore;
  if (!shouldNarrateInstrument(score, 'brs', gamingCorrection, straightLineFlags, REPORT_NARRATE_INSTRUMENT_OPTIONS) || score == null) {
    return null;
  }
  const band = brsResilienceBand(score);
  const bandGuide =
    band === 'high'
      ? 'Describe as someone who tends to recover relatively quickly from setbacks — stress may not linger or accumulate as long. In relationships, likely to bounce back from conflict or difficult periods without extended withdrawal or residual bitterness.'
      : band === 'moderate'
        ? 'Describe as mixed resilience — recovers well from some stressors but may struggle with sustained or compounding difficulty. In relationships, can navigate normal conflict but sustained tension may take a real toll.'
        : 'Describe as someone for whom stress and adversity tend to have lasting effects — recovery is slower and more effortful. In relationships, hard periods may feel more depleting and may require more deliberate recovery (time, space, explicit repair) before returning to baseline.';

  return `${SELF_REPORT_FRAMING}

BRS / RESILIENCE (internal — omit instrument name in report):
${bandGuide}
In "## What Tends to Get in the Way", include one ### subsection (e.g. "### How You Recover From Hard Periods") with 1–2 paragraphs weaving this resilience pattern with interview-derived regulation/repair signals when relevant. Do not quote numbers.`;
}

export function buildScsSfPersonalReportInstruction(
  scores: PersonalReportPsychometricScores,
  gamingCorrection: GamingCorrectionResult | null,
  straightLineFlags: string[],
): string | null {
  const effectiveScore = effectiveScsSfScore(scores);
  if (
    !shouldNarrateInstrument(effectiveScore, 'scs_sf', gamingCorrection, straightLineFlags, REPORT_NARRATE_INSTRUMENT_OPTIONS) ||
    effectiveScore == null
  ) {
    return null;
  }
  if (!hasScsSfSubscales(scores) && scores.scsSfScore == null) return null;

  const sk = scsSubscaleBand(scores.scsSfSelfKindnessScore);
  const ch = scsSubscaleBand(scores.scsSfCommonHumanityScore);
  const mf = scsSubscaleBand(scores.scsSfMindfulnessScore);
  const subscaleLines = [
    sk ? `- Warmth toward self when things go wrong: ${sk}` : null,
    ch ? `- Seeing struggles as shared human experience vs uniquely personal: ${ch}` : null,
    mf ? `- Holding painful feelings in balanced awareness vs getting absorbed or suppressing: ${mf}` : null,
  ].filter(Boolean);

  return `${SELF_REPORT_FRAMING}

SELF-COMPASSION PROFILE (internal — omit instrument name in report):
When subscales are available, describe the pattern across all three — not only the aggregate. Combinations matter (e.g. high warmth toward self with lower balanced awareness = kind to self but gets consumed by difficult feelings).
${subscaleLines.length > 0 ? subscaleLines.join('\n') : '- Subscale detail not available — use aggregate tendency only.'}

Translation guide (behavioral prose only):
- High warmth + high shared-humanity + high balanced awareness: can sit with own failures without excessive self-punishment — able to own mistakes in a relationship without destabilizing.
- Lower warmth toward self specifically: self-critical inner voice after mistakes — may over-apologize, ruminate, or need external reassurance after perceived failures.
- Lower shared-humanity specifically: failures feel uniquely personal — can amplify shame and make repair harder.
- Lower balanced awareness specifically: difficulty holding difficult feelings at arm's length — emotional flooding or shutdown after conflict.

In "## Where You Have Room to Grow", integrate this with the existing experiential-avoidance / difficult-emotions content (AAQ2 band above) as ONE coherent picture of how you handle difficult internal states — not a separate disconnected paragraph.`;
}

export function buildMspssPersonalReportInstruction(
  scores: PersonalReportPsychometricScores,
  gamingCorrection: GamingCorrectionResult | null,
  straightLineFlags: string[],
): string | null {
  const score = effectiveMspssScore(scores);
  if (!shouldNarrateInstrument(score, 'mspss', gamingCorrection, straightLineFlags, REPORT_NARRATE_INSTRUMENT_OPTIONS) || score == null) {
    return null;
  }
  const band = mspssSupportBand(score);
  const bandGuide =
    band === 'high'
      ? 'Feels well-supported by people outside a romantic relationship — family, friends, or both. Less likely to over-rely on a partner as the sole emotional resource.'
      : band === 'moderate'
        ? 'Reasonable external support but some gaps — may lean on a partner more when external support feels unavailable.'
        : 'Limited perceived support outside romance — partner may become the primary or only turn-to for emotional support, validation, or connection, which can create unsustainable pressure.';

  let divergenceNote = '';
  const family = scores.mspssFamilyScore;
  const friends = scores.mspssFriendsScore;
  if (family != null && friends != null && Math.abs(family - friends) >= 1.5) {
    divergenceNote =
      family > friends
        ? '\nSubscale divergence (internal): stronger support from family than friends — name which source feels stronger/weaker in plain language.'
        : '\nSubscale divergence (internal): stronger support from friends than family — name which source feels stronger/weaker; family-low patterns may relate to attachment wounds worth gentle mention.';
  }

  return `${SELF_REPORT_FRAMING}

PERCEIVED SOCIAL SUPPORT (internal — omit instrument name in report):
${bandGuide}${divergenceNote}

In "## Practical Steps Forward", include at least one suggestion about investing in friendships, family connection, or community so future partnerships are not carrying the full weight of emotional support — frame constructively, not as deficit shaming. Do not quote numbers.`;
}

export function buildRfqPersonalReportInstruction(
  scores: PersonalReportPsychometricScores,
  gamingCorrection: GamingCorrectionResult | null,
  straightLineFlags: string[],
): string | null {
  const score = scores.rfqScore;
  if (!shouldNarrateInstrument(score, 'rfq', gamingCorrection, straightLineFlags, REPORT_NARRATE_INSTRUMENT_OPTIONS) || score == null) {
    return null;
  }
  const band = rfqReflectiveBand(score);
  const bandGuide =
    band === 'strong'
      ? 'Tends to understand own and others motivations with depth — can link past experience to present feelings and make sense of why people (including themselves) act as they do. In relationships, more likely to learn from conflict, notice patterns, and stay curious about inner experience.'
      : band === 'moderate'
        ? 'Average reflective depth with some gaps — generally can make sense of feelings and motivations but may miss nuance under stress or default to simpler explanations.'
        : 'More difficulty understanding motivations and linking experience to feelings — may act or react without fully processing why they or their partner behave as they do. Under stress, inner experience may feel opaque or hard to articulate.';

  return `${SELF_REPORT_FRAMING}

REFLECTIVE DEPTH (internal — psychometrics_rfq_score is Reflective Functioning, 1–7, higher = stronger; NOT Regulatory Focus):
${bandGuide}

In "## Your Relationship Style", add one ### subsection (e.g. "### How You Make Sense of Feelings and Motivations") with 1–2 paragraphs on this tendency — accessible behavioral language only; never say "RFQ," "reflective functioning," or clinical terms.

FUTURE NOTE (internal only — do not write to reader): When partner RFQ scores are available, relationship reports should eventually surface reflective-depth mismatch dynamics; out of scope for this personal report.`;
}

export function buildRsesPersonalReportInstruction(
  scores: PersonalReportPsychometricScores,
  gamingCorrection: GamingCorrectionResult | null,
  straightLineFlags: string[],
): string | null {
  const score = scores.rsesScore;
  if (!shouldNarrateInstrument(score, 'rses', gamingCorrection, straightLineFlags, REPORT_NARRATE_INSTRUMENT_OPTIONS) || score == null) {
    return null;
  }
  const band =
    score >= 30
      ? 'generally stable positive self-regard'
      : score >= 23
        ? 'moderate self-regard with some variability'
        : score >= 17
          ? 'below-average self-regard that may amplify shame after conflict'
          : 'significantly impaired self-regard';
  return `${SELF_REPORT_FRAMING}

SELF-WORTH PATTERN (internal — omit instrument name):
Profile suggests ${band}. Where relevant to growth recommendations (owning mistakes, receiving feedback, repair after conflict), weave this in plain language — e.g. how harsh self-criticism vs stable self-regard may affect willingness to stay in difficult repair conversations. Do not quote numbers or name the measure.`;
}

export function buildGaspPersonalReportInstruction(
  scores: PersonalReportPsychometricScores,
  gamingCorrection: GamingCorrectionResult | null,
  straightLineFlags: string[],
): string | null {
  const score = scores.gaspScore;
  if (!shouldNarrateInstrument(score, 'gasp', gamingCorrection, straightLineFlags, REPORT_NARRATE_INSTRUMENT_OPTIONS) || score == null) {
    return null;
  }
  const band =
    score <= 3
      ? 'tends toward repair-oriented responses after causing harm — guilt motivates making things right'
      : score <= 5
        ? 'mixed harm-response pattern — sometimes repair-oriented, sometimes withdrawal or externalization under stress'
        : 'more withdrawal- or externalization-leaning after causing harm — may struggle to stay present for repair';
  return `${SELF_REPORT_FRAMING}

HARM-RESPONSE TENDENCY (internal — omit instrument name):
${band}. In "## What Tends to Get in the Way" or conflict/repair growth sections, connect this to interview accountability/repair patterns when both signals align — in plain language only.`;
}

export function buildDweckPersonalReportInstruction(
  scores: PersonalReportPsychometricScores,
  gamingCorrection: GamingCorrectionResult | null,
  straightLineFlags: string[],
): string | null {
  const score = scores.dweckScore;
  if (!shouldNarrateInstrument(score, 'dweck', gamingCorrection, straightLineFlags, REPORT_NARRATE_INSTRUMENT_OPTIONS) || score == null) {
    return null;
  }
  const band =
    score >= 5
      ? 'growth-oriented — more likely to treat relationship skills as learnable and stay curious after setbacks'
      : score >= 3.5
        ? 'mixed learning orientation — open to growth in some areas, defensive about change in others'
        : 'fixed-leaning — may experience behavior-change suggestions as criticism of character rather than invitation to grow';
  return `${SELF_REPORT_FRAMING}

LEARNING ORIENTATION (internal — omit instrument name):
${band}. In "## Practical Steps Forward" or growth sections, calibrate how directly to frame behavior-change suggestions — without naming mindset theory or scores.`;
}

export function buildPersonalPsychometricSectionInstructions(input: {
  psychometrics: PersonalReportPsychometricScores;
  gamingCorrection: GamingCorrectionResult | null;
  psychometricStraightLineFlags: string[];
}): string {
  const { psychometrics, gamingCorrection, psychometricStraightLineFlags: flags } = input;
  const blocks = [
    buildRsesPersonalReportInstruction(psychometrics, gamingCorrection, flags),
    buildGaspPersonalReportInstruction(psychometrics, gamingCorrection, flags),
    buildDweckPersonalReportInstruction(psychometrics, gamingCorrection, flags),
    buildBrsPersonalReportInstruction(psychometrics, gamingCorrection, flags),
    buildScsSfPersonalReportInstruction(psychometrics, gamingCorrection, flags),
    buildMspssPersonalReportInstruction(psychometrics, gamingCorrection, flags),
    buildRfqPersonalReportInstruction(psychometrics, gamingCorrection, flags),
  ].filter(Boolean);
  if (blocks.length === 0) return '';
  return `\nADDITIONAL PSYCHOMETRIC NARRATIVE INSTRUCTIONS (personal full report only):\n${blocks.join('\n\n')}`;
}

/** Plain-language summaries for structural psychometric_integration field (not instrument names in output). */
export function buildPopulatedPsychometricPlainLanguageBlock(input: {
  aaq2Score: number | null;
  psychometrics: PersonalReportPsychometricScores;
  gamingCorrection: GamingCorrectionResult | null;
  psychometricStraightLineFlags: string[];
}): string {
  const { psychometrics, gamingCorrection, flags } = {
    psychometrics: input.psychometrics,
    gamingCorrection: input.gamingCorrection,
    flags: input.psychometricStraightLineFlags,
  };
  const lines: string[] = [];

  const aaq2 = input.aaq2Score;
  if (aaq2 != null && Number.isFinite(aaq2)) {
    const band =
      aaq2 <= 14
        ? 'high psychological flexibility'
        : aaq2 <= 24
          ? 'moderate psychological flexibility'
          : aaq2 <= 34
            ? 'mild experiential avoidance'
            : aaq2 <= 44
              ? 'significant experiential avoidance'
              : 'severe experiential avoidance';
    lines.push(`- Experiential avoidance / emotion relationship (AAQ-II band): ${band}`);
  }

  const extractBand = (block: string | null): string | null => {
    if (!block) return null;
    const m = block.match(/Profile suggests ([^.]+)\./i) ?? block.match(/:\n([^\n]+)/);
    return m?.[1]?.trim() ?? block.split('\n').find((l) => l.trim().length > 20)?.trim() ?? null;
  };

  const entries: Array<[string, string | null]> = [
    ['Self-worth pattern (RSES)', extractBand(buildRsesPersonalReportInstruction(psychometrics, gamingCorrection, flags))],
    ['Harm-response tendency (GASP)', extractBand(buildGaspPersonalReportInstruction(psychometrics, gamingCorrection, flags))],
    ['Learning orientation (Dweck)', extractBand(buildDweckPersonalReportInstruction(psychometrics, gamingCorrection, flags))],
    ['Resilience (BRS)', extractBand(buildBrsPersonalReportInstruction(psychometrics, gamingCorrection, flags))],
    ['Self-compassion (SCS-SF)', extractBand(buildScsSfPersonalReportInstruction(psychometrics, gamingCorrection, flags))],
    ['Perceived support (MSPSS)', extractBand(buildMspssPersonalReportInstruction(psychometrics, gamingCorrection, flags))],
    ['Reflective depth (RFQ)', extractBand(buildRfqPersonalReportInstruction(psychometrics, gamingCorrection, flags))],
  ];

  for (const [label, summary] of entries) {
    if (summary) lines.push(`- ${label}: ${summary}`);
  }

  if (lines.length === 0) {
    return 'POPULATED PSYCHOMETRIC LENSES: none available (all instruments null or flagged unreliable).';
  }

  return `POPULATED PSYCHOMETRIC LENSES (REQUIRED for psychometric_integration when any non-AAQ2 instrument below is present — weave ONE OR MORE into narrative in plain language; never name instruments or scores to reader):\n${lines.join('\n')}`;
}
