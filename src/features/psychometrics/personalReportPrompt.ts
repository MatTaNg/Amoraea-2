import {
  buildMentalizingAsymmetryNote,
  resolveUnderdisclosureNarrativeTier,
} from './personalReportNarrativeGuidance';
import {
  buildPersonalInterviewEvidenceBlock,
  composeNarrativeCalibration,
  getSectionDistinctnessInstructions,
  REPORT_NARRATE_INSTRUMENT_OPTIONS,
  shouldNarrateInstrument,
} from '@features/reports/narrativeCalibration';
import {
  getMarkdownStructuralEnforcementInstructions,
  listPopulatedNarrativeInstrumentLabels,
  listPopulatedNonAaq2NarrativeInstrumentLabels,
} from '@features/reports/reportNarrativeStructuralEnforcement';
import { buildScenarioScoreGroundingContextBlock } from '@features/reports/scenarioScoreGrounding';
import {
  detectEvidenceConflicts,
  getReportTransparencyPromptInstructions,
} from '@features/reports/reportTransparency';
import { buildPersonalPsychometricSectionInstructions, buildPopulatedPsychometricPlainLanguageBlock } from './personalReportPsychometricSections';
import type { ReportData } from './personalReportData';
import type { StructuralValidationContext } from '@features/reports/reportNarrativeStructuralEnforcement';

export function buildPersonalReportStructuralValidationContext(
  data: ReportData,
): StructuralValidationContext {
  const instrumentInput = {
    aaq2Score: data.user.aaq2Score,
    rsesScore: data.user.rsesScore,
    psychometrics: data.user.psychometrics,
    gamingCorrection: data.attempt?.gamingCorrection ?? null,
    psychometricStraightLineFlags: data.user.psychometricStraightLineFlags,
  };
  return {
    scenarioScoreGrounding: data.attempt?.scenarioScoreGrounding ?? null,
    populatedNonAaq2InstrumentLabels: listPopulatedNonAaq2NarrativeInstrumentLabels(
      instrumentInput,
      { ignoreGamingCorrection: true },
    ),
    requirePsychometricIntegration: true,
  };
}

export type { PersonalReportMentalizingProfile, ReportData } from './personalReportData';

export function buildSystemPrompt(): string {
  return `You are generating a detailed, comprehensive personal development report for a user of Amoraea, a relationship-readiness platform.

CRITICAL RULES:
- Do NOT use clinical diagnostic language
- DO write in warm, direct, plain language a non-psychologist would understand
- DO use second person throughout the entire report body ("you", "your", "your partner") — never third person for the reader (no "[Name] brings", "[Name] demonstrates", "[Name]'s partner", "they/them/their" referring to the reader)
- The reader's first name may appear once or twice in the Closing for direct address (e.g. "[Name], you bring...") but descriptive sentences must still use "you/your", not the name as grammatical subject
- DO be honest about growth areas — do not sugarcoat but remain constructive
- DO be specific to the profile data provided — avoid generic advice
- DO make the report feel like it was written by a thoughtful relationship expert who knows this person well
- Format all section headings with ## and subsection headings with ###
- Use **bold** for emphasis on key insights
- Write in flowing prose, not bullet lists`;
}

export function buildReportPrompt(data: ReportData): string {
  const { user, attempt } = data;
  const pillars = attempt?.pillarScores ?? {};

  const pillarBand = (score: number | undefined | null): string => {
    if (score == null) return 'not assessed';
    if (score >= 8) return 'strong';
    if (score >= 7) return 'good';
    if (score >= 6) return 'developing';
    if (score >= 4) return 'needs attention';
    return 'significant growth area';
  };

  const aaq2Interp = (() => {
    const s = user.aaq2Score;
    if (s === null) return 'not assessed';
    if (s <= 14)
      return 'high psychological flexibility — strong willingness to experience difficult emotions without avoidance';
    if (s <= 24) return 'moderate psychological flexibility — generally open to difficult emotions with some avoidance';
    if (s <= 34) return 'mild experiential avoidance — some tendency to push away difficult internal experiences';
    if (s <= 44)
      return 'significant experiential avoidance — notable pattern of avoiding difficult emotions and memories';
    return 'severe experiential avoidance — strong pervasive tendency to avoid internal experience';
  })();

  const rsesInterp = (() => {
    const s = user.rsesScore;
    if (s === null) return 'not assessed';
    if (s >= 30) return 'high self-esteem — stable and positive sense of self-worth';
    if (s >= 23) return 'moderate-high self-esteem — generally positive self-regard with some variability';
    if (s >= 17) return 'moderate-low self-esteem — below-average self-regard, some instability in self-worth';
    if (s >= 11) return 'low self-esteem — significantly impaired self-regard';
    return 'very low self-esteem — severe deficit in self-worth requiring attention';
  })();

  const scsInterp = (() => {
    const pub = user.scsPublicScore;
    const priv = user.scsPrivateScore;
    if (pub === null || priv === null) return 'not assessed';
    const diff = priv - pub;
    if (diff >= 4)
      return 'strongly internally oriented — much more attuned to inner experience than external perception';
    if (diff >= 1)
      return 'mildly internally oriented — slightly more focused on inner experience than impression management';
    if (diff >= -1) return 'balanced — roughly equal attention to inner states and external perception';
    if (diff >= -4)
      return 'mildly externally oriented — slightly more focused on how others see you than how you feel inside';
    return 'strongly externally oriented — much more focused on external impression than internal attunement';
  })();

  const egoDevInterp = (() => {
    const l = attempt?.egoDevLevel;
    if (l === null || l === undefined) return 'not assessed';
    if (l === 1) return 'concrete and rule-based — tends toward black-and-white thinking in relational situations';
    if (l === 2) return 'developing complexity — aware of multiple perspectives but resolves them simply';
    if (l === 3)
      return 'holds complexity — psychologically aware, uses nuanced understanding of relational dynamics';
    if (l === 4) return 'integrates contradictions — systemic relational thinker who tolerates ambiguity well';
    return 'highly sophisticated — full systemic understanding of relational dynamics';
  })();

  const activeDefenses = [
    attempt?.projection && 'projection (attributing own patterns to others)',
    attempt?.splitting && 'splitting (black-and-white assignment of fault)',
    attempt?.rationalization && 'rationalization (logical justification to avoid accountability)',
    attempt?.denial && 'denial (claiming no conflict or negative experience despite evidence)',
  ]
    .filter(Boolean)
    .join(', ');

  const emotionInterp = (() => {
    const raw = attempt?.emotionRecognitionScore;
    if (raw == null) return 'not assessed';
    const pct = raw <= 10 ? raw * 10 : raw;
    if (pct >= 80) return 'strong — reads emotional cues accurately';
    if (pct >= 60) return 'good — generally accurate with occasional misses';
    if (pct >= 40) return 'developing — some difficulty reading subtle emotional cues';
    return 'limited — notable difficulty identifying emotions in others';
  })();

  const vocabInterp = (() => {
    if (attempt?.vocabLow) return 'limited — significantly below typical range';
    const d = attempt?.vocabDensity;
    if (d == null) return 'not assessed';
    if (d < 0.8) return 'below average';
    if (d < 1.5) return 'adequate';
    return 'rich';
  })();

  const overcertaintyInterp = (() => {
    const c = attempt?.mentalizing_overcertainty_count;
    if (c == null) return 'not assessed';
    if (c === 0) return 'none detected';
    if (c <= 2) return 'mild — occasional overcertainty';
    return "significant — frequent overcertainty about others' inner states";
  })();

  const underdisclosureTier = resolveUnderdisclosureNarrativeTier({
    disclosureCalibration: attempt?.disclosureCalibration,
    moment4Concreteness: attempt?.moment4Concreteness,
    moment5Concreteness: attempt?.moment5Concreteness,
  });

  const mp = attempt?.mentalizingProfile;
  const mentalizingAsymmetryNote = mp ? buildMentalizingAsymmetryNote(mp) : null;

  const underdisclosureNarrativeInstructions = (() => {
    if (underdisclosureTier === 'none') {
      return 'Disclosure calibration is not underdisclosure — do not write themes about being hard to know, opaque, or emotionally distant due to under-sharing.';
    }
    if (underdisclosureTier === 'mild') {
      return (
        'UNDERDISCLOSURE NARRATIVE (MANDATORY CALIBRATION — mild tier): disclosure_calibration is underdisclosure, BUT personal moment concreteness shows substantive, non-evasive content (high and/or valid_non_applicable). ' +
        'Do NOT write a multi-paragraph theme about loneliness, being "unknown" to a partner, or relational opacity. At most one brief, low-stakes observation in a single section (e.g. "you tend to be relatively concise when reflecting on your own experience, even when what you share is substantive"). ' +
        'Do not make underdisclosure the "most notable pattern" in the Overview or the headline growth area.'
      );
    }
    return (
      'UNDERDISCLOSURE NARRATIVE (strong tier): disclosure_calibration is underdisclosure AND both personal moments show low/absent concreteness — thinness and brevity corroborate each other. ' +
      'You may use stronger relational framing (partner feeling shut out, difficulty knowing you, quiet loneliness) because both signals align. Still avoid clinical language and do not cite scores.'
    );
  })();

  const mentalizingNarrativeInstructions = mentalizingAsymmetryNote
    ? `MENTALIZING ASYMMETRY (MANDATORY): ${mentalizingAsymmetryNote} In Relational Strengths or Where You Have Room to Grow, explicitly distinguish other-directed perspective-taking (fictional scenarios) from comparatively thinner self-directed mentalizing on your personal reflection — name this gap as the genuine insight. Match scenario language to actual score bands — do NOT collapse into uniform praise like "you mentalize strongly across the board," "strong, accurate empathy in every scenario," or "with notable consistency" when scenario scores are moderate (5–6).`
    : 'MENTALIZING: If scenario-level and personal-moment mentalizing are similar, you may describe mentalizing as a general strength. Do not invent an asymmetry that is not supported by the profile. Match superlative language to score bands (7+ only for "strong/accurate").';

  const narrativeCalibration = composeNarrativeCalibration(
    {
      finalGatePass: attempt?.finalGatePass,
      gateFailReasons: attempt?.gateFailReasons ?? [],
      gamingCorrection: attempt?.gamingCorrection ?? null,
      pillarScores: attempt?.pillarScores ?? null,
      aaq2Score: user.aaq2Score,
      modifiedWeightedScore: attempt?.finalScore,
    },
    { includePsychometricLens: true },
  );

  const mentalizingProfileBlock = mp
    ? `- Mentalizing profile (for narrative calibration — do not quote numbers to the reader): scenario readings averaged ${mp.scenarioAverage != null ? `~${mp.scenarioAverage.toFixed(1).replace(/\.0$/, '')}` : 'n/a'}; personal self-reflection moment ${mp.moment4 ?? 'not scored'}; holistic rollup band ${pillarBand(pillars?.mentalizing)}${mp.keyEvidence.moment4 ? `; personal-moment scorer note: "${mp.keyEvidence.moment4.slice(0, 220)}"` : ''}`
    : '';

  const m5 = attempt?.moment5Profile;
  // M5 is the single highest-reliability accountability signal in the interview —
  // first-person conflict account, not fictional-character analysis. Weight M5
  // accountability/mentalizing evidence more heavily than scenario-derived equivalents
  // when they diverge, since it reflects the user's own stated behavior, not
  // their analysis of someone else's behavior.
  const moment5ProfileBlock = m5
    ? `- Personal conflict moment (M5 — your own first-person account of a real conflict, not fictional-character analysis; highest-reliability accountability and self-reflection signal): repair ${pillarBand(m5.pillarScores?.repair ?? null)} / regulation ${pillarBand(m5.pillarScores?.regulation ?? null)} / mentalizing ${pillarBand(m5.pillarScores?.mentalizing ?? null)} / accountability ${pillarBand(m5.pillarScores?.accountability ?? null)} / constructive communication ${pillarBand(m5.pillarScores?.contempt_expression ?? null)}${
        m5.keyEvidence?.accountability
          ? `; accountability scorer note: "${m5.keyEvidence.accountability.slice(0, 220)}"`
          : ''
      }${
        m5.keyEvidence?.mentalizing
          ? `; mentalizing scorer note: "${m5.keyEvidence.mentalizing.slice(0, 220)}"`
          : ''
      }`
    : '';

  const interviewEvidenceBlock =
    attempt != null
      ? buildPersonalInterviewEvidenceBlock({
          pillarScores: attempt.pillarScores,
          scenarioKeyEvidence: attempt.scenarioKeyEvidence,
          moment5Profile: attempt.moment5Profile,
          mentalizingProfile: attempt.mentalizingProfile,
        })
      : '';

  const psychometricSectionInstructions = buildPersonalPsychometricSectionInstructions({
    psychometrics: user.psychometrics,
    gamingCorrection: attempt?.gamingCorrection ?? null,
    psychometricStraightLineFlags: user.psychometricStraightLineFlags,
  });

  const psychometricPlainLanguageBlock = buildPopulatedPsychometricPlainLanguageBlock({
    aaq2Score: user.aaq2Score,
    psychometrics: user.psychometrics,
    gamingCorrection: attempt?.gamingCorrection ?? null,
    psychometricStraightLineFlags: user.psychometricStraightLineFlags,
  });

  const scenarioScoreGroundingBlock =
    attempt?.scenarioScoreGrounding != null
      ? buildScenarioScoreGroundingContextBlock(attempt.scenarioScoreGrounding)
      : '';

  const gamingCorrection = attempt?.gamingCorrection ?? null;
  const straightLineFlags = user.psychometricStraightLineFlags;
  // RSES is excluded from the base profile block (not just the second-pass
  // enrichment sections) when straight-line flagged or gaming-correction-stripped.
  // Confirmed gap: this field was previously always included unconditionally,
  // meaning a flagged-unreliable score could still surface in or contradict
  // other report narrative even though the suppression helper existed and was
  // correctly applied elsewhere. Exclusion happens at data-assembly time so the
  // model never sees the unreliable number, rather than relying on the model to
  // voluntarily disregard a contradictory value it was shown.
  const rsesLine = shouldNarrateInstrument(
    user.rsesScore,
    'rses',
    gamingCorrection,
    straightLineFlags,
    REPORT_NARRATE_INSTRUMENT_OPTIONS,
  )
    ? `- Self-esteem and self-worth: ${rsesInterp}`
    : null;

  const selfAssessmentLines = [
    `- Psychological flexibility / relationship with emotions: ${aaq2Interp}`,
    rsesLine,
    `- Self-awareness orientation: ${scsInterp}`,
  ]
    .filter(Boolean)
    .join('\n');

  const evidenceConflicts = detectEvidenceConflicts(data);
  const transparencyInstructions = getReportTransparencyPromptInstructions(evidenceConflicts);

  return `Generate a comprehensive personal development report addressed directly to the reader in second person ("you/your") based on the following assessment profile. The report should be detailed, specific, and feel genuinely insightful — not generic. It should be approximately 1200-1800 words.

ASSESSMENT PROFILE:

SELF-ASSESSMENTS:
${selfAssessmentLines}

RELATIONAL INTELLIGENCE FROM AI INTERVIEW:
- Repair capacity (ability to acknowledge ruptures and initiate healing): ${pillarBand(pillars?.repair)}
- Attunement (emotional presence and reading of others): ${pillarBand(pillars?.attunement)}
- Emotional regulation (managing own emotional intensity in conflict): ${pillarBand(pillars?.regulation)}
- Mentalizing (perspective-taking and holding uncertainty about others): ${pillarBand(pillars?.mentalizing)}
- Appreciation (recognizing and celebrating partner's emotional needs): ${pillarBand(pillars?.appreciation)}
- Accountability (owning contribution to relational difficulty): ${pillarBand(pillars?.accountability)}
- Commitment threshold (healthy persistence through difficulty with appropriate limits): ${pillarBand(pillars?.commitment_threshold)}
- Constructive communication (absence of contempt, criticism, and character attacks): ${pillarBand(pillars?.contempt)}

DEEPER BEHAVIORAL SIGNALS:
- Psychological maturity level: ${egoDevInterp}
- Emotion recognition ability: ${emotionInterp}
- Personal disclosure style when asked about own experience: ${attempt?.disclosureCalibration ?? 'not assessed'}
- Engagement with own personal narrative (grudges, conflicts): moment one — ${attempt?.moment4Concreteness ?? 'not assessed'}, moment two — ${attempt?.moment5Concreteness ?? 'not assessed'}
- Emotional vocabulary when discussing personal experience: ${vocabInterp}
- Psychological defense patterns observed: ${activeDefenses || 'none detected'}
- Overcertainty in understanding others: ${overcertaintyInterp}
${mentalizingProfileBlock ? `${mentalizingProfileBlock}\n` : ''}${moment5ProfileBlock ? `${moment5ProfileBlock}\n` : ''}${interviewEvidenceBlock ? `\n${interviewEvidenceBlock}\n` : ''}${scenarioScoreGroundingBlock ? `\n${scenarioScoreGroundingBlock}\n` : ''}${psychometricPlainLanguageBlock ? `\n${psychometricPlainLanguageBlock}\n` : ''}
NARRATIVE CALIBRATION (follow exactly):
${narrativeCalibration}
${underdisclosureNarrativeInstructions}
${mentalizingNarrativeInstructions}${psychometricSectionInstructions}

${transparencyInstructions}

${getSectionDistinctnessInstructions('personal_full')}

${getMarkdownStructuralEnforcementInstructions(
  listPopulatedNarrativeInstrumentLabels(
    {
      aaq2Score: user.aaq2Score,
      rsesScore: user.rsesScore,
      psychometrics: user.psychometrics,
      gamingCorrection: attempt?.gamingCorrection ?? null,
      psychometricStraightLineFlags: user.psychometricStraightLineFlags,
    },
    { ignoreGamingCorrection: true },
  ),
  { includePsychometrics: true },
)}

Write the report with exactly these sections. Every section's body prose must use second person ("you/your") — never third person for the reader.

## Overview
3-4 sentences that capture the essence of your relational profile. Warm, direct, and specific to your data. Mention your most notable strength and your most significant growth area. Do not let a mild-tier underdisclosure note dominate this summary.

## Your Relational Strengths
Write 3-4 strengths. For each strength use a ### heading with a meaningful name (not generic like "Strength 1"). Write 3-4 sentences per strength explaining what this capacity looks like in you, why it matters in relationships, and how it showed up in your assessment. Be concrete — ground each strength in at least one keyEvidence observation from the evidence block when available. If mentalizing asymmetry applies, one strength should reflect other-directed perspective-taking; do not pretend self-directed mentalizing is equally strong unless the profile supports it.

## Where You Have Room to Grow
Write 2-3 growth areas. For each use a ### heading. Write 3-4 sentences per area being honest about the pattern, what it tends to create in your relationships, and what growth looks like without being prescriptive or harsh. Before finalizing each growth paragraph, audit ALL scenario scorer notes, M5 keyEvidence, holistic bands, and relevant self-report lens data — reframe if slice-level evidence contradicts a uniform-weakness template. Ground accountability and self-reflection observations in M5 keyEvidence when present — M5 is your own first-person conflict account and should anchor those sections. Surface self-correcting or accountability moments from M5 in a strength or nuance subsection when present. Apply the underdisclosure tier rules above. If mentalizing asymmetry applies, include turning self-directed curiosity toward your own experience as a growth edge grounded in the actual gap.

## Your Relationship Style
2-3 paragraphs describing how you tend to show up in relationships — how you communicate, how you handle conflict, what you need from a partner, and what patterns you are likely to bring. Rich character portrait drawing from the full profile. Second person only.

## What Tends to Get in the Way
1-2 paragraphs describing the specific patterns — from both the self-assessments and the interview — that are most likely to create friction in your close relationships. Be direct and specific. Apply underdisclosure tier rules; strong-tier loneliness/opacity themes belong here only when tier is strong.

## Practical Steps Forward
4-5 concrete, actionable suggestions genuinely specific to your profile — not generic self-help. Each suggestion 2-3 sentences, addressed to "you."

## Closing
2-3 sentences warm, honest, and encouraging. You may use the reader's first name once here (${user.name ?? 'reader'}) alongside "you." Acknowledge the courage of this assessment work and what you have to offer in a relationship.`;
}
