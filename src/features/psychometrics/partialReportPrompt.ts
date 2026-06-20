import type { GamingCorrectionResult } from './computeGamingCorrection';
import {
  buildMentalizingAsymmetryNote,
  parseKeyEvidenceFromStoredSlice,
  parsePillarScoresFromStoredSlice,
  type PersonalReportMentalizingProfile,
  type PersonalReportMoment5Profile,
  type PersonalReportScenarioKeyEvidence,
} from './personalReportNarrativeGuidance';
import {
  buildPersonalInterviewEvidenceBlock,
  composeNarrativeCalibration,
  getSectionDistinctnessInstructions,
} from '@features/reports/narrativeCalibration';
import { getMarkdownStructuralEnforcementInstructions } from '@features/reports/reportNarrativeStructuralEnforcement';
import { buildScenarioScoreGroundingContextBlock, type ScenarioScoreGrounding } from '@features/reports/scenarioScoreGrounding';

export type PartialReportData = {
  user: { name: string | null };
  attempt: {
    pillarScores: Record<string, number> | null;
    egoDevLevel: number | null;
    emotionRecognitionScore: number | null;
    disclosureCalibration: string | null;
    moment4Concreteness: string | null;
    moment5Concreteness: string | null;
    vocabDensity: number | null;
    vocabLow: boolean | null;
    projection: boolean;
    splitting: boolean;
    rationalization: boolean;
    denial: boolean;
    mentalizing_overcertainty_count: number | null;
    aiSummary: string | null;
    aiStrengths: string[];
    finalGatePass: boolean | null;
    gateFailReasons: string[];
    gamingCorrection: GamingCorrectionResult | null;
    finalScore: number | null;
    mentalizingProfile: PersonalReportMentalizingProfile | null;
    moment4Profile: PersonalReportMoment5Profile | null;
    moment5Profile: PersonalReportMoment5Profile | null;
    scenarioKeyEvidence: PersonalReportScenarioKeyEvidence | null;
    scenarioScoreGrounding: ScenarioScoreGrounding | null;
  } | null;
};

const PARTIAL_EVIDENCE_TYPE_CONSTRAINT = `EVIDENCE-TYPE CONSTRAINT: The interview consists of reflective, untimed responses to hypothetical scenarios, plus two personal recollection questions (M4/M5) — it does not capture real-time behavior under live conflict pressure. Do not characterize patterns as specifically appearing "in the heat of the moment," "under real-time pressure," or "when things get heated live" — the assessment cannot observe this. Do not phrase observations in a way that implies a confident prediction about live behavior (e.g. "this will show up in your real relationship as…", "when it shows up in a real relationship…", "under live conflict you tend to…"). Instead, frame findings in terms of what the reflective response itself demonstrates (e.g. "when you reason through conflict, you tend to…" or "your analysis showed…"), leaving open — rather than asserting — whether the same pattern holds under real, live pressure. Frame growth areas and strengths alike in terms of what the answers themselves showed (e.g. "your repair answers stayed at the level of general commitment rather than naming what the other person specifically needed") rather than speculating about how the person behaves live, which the data doesn't show.`;

export function parseMoment4ProfileFromStoredPatterns(
  patterns: Record<string, unknown> | null | undefined,
): PersonalReportMoment5Profile | null {
  const m4Raw = patterns?.moment_4_scores;
  if (m4Raw == null) return null;
  const pillarScores = parsePillarScoresFromStoredSlice(m4Raw);
  const keyEvidence = parseKeyEvidenceFromStoredSlice(m4Raw);
  if (!pillarScores && !keyEvidence) return null;
  return { pillarScores, keyEvidence };
}

function formatMomentProfilePromptBlock(
  label: string,
  profile: PersonalReportMoment5Profile | null,
  band: (score: number | undefined | null) => string,
): string {
  if (!profile) return '';
  const pillars = profile.pillarScores ?? {};
  const pillarLine = [
    'repair',
    'regulation',
    'mentalizing',
    'accountability',
    'contempt_expression',
    'contempt',
    'attunement',
    'appreciation',
    'commitment_threshold',
  ]
    .filter((marker, index, arr) => arr.indexOf(marker) === index)
    .map((marker) => {
      const score = pillars[marker];
      return score != null ? `${marker} ${band(score)}` : null;
    })
    .filter(Boolean)
    .join(' / ');
  const evidenceLines = profile.keyEvidence
    ? Object.entries(profile.keyEvidence)
        .filter(([, value]) => value.trim().length > 0)
        .map(([marker, value]) => `  - ${marker}: "${value.slice(0, 220)}"`)
        .join('\n')
    : '';
  return `- ${label}${pillarLine ? `: ${pillarLine}` : ''}${
    evidenceLines ? `\n${evidenceLines}` : ''
  }`;
}

export function buildPartialSystemPrompt(): string {
  return `You are generating a partial personal development preview for a user of Amoraea, a relationship-readiness platform. They have completed an AI-guided conversation but have NOT yet completed the self-assessment battery.

CRITICAL RULES — PARTIAL PREVIEW:
- Do NOT describe what the AI interview is designed to test or measure
- Do NOT use clinical diagnostic language
- Do NOT reference psychometric instruments or self-assessments they have not yet taken
- DO write in warm, direct, plain language a non-psychologist would understand
- DO use second person throughout ("you", "your")
- DO be honest about growth areas — constructive, not harsh
- DO be specific to the profile data — avoid generic advice
- DO frame insights as patterns observed in how they spoke about relationships and conflict
- DO tease that completing self assessments will unlock a fuller, richer report — without being salesy
- Format section headings with ## and subsection headings with ###
- Use **bold** for emphasis on key insights
- Write in flowing prose, not bullet lists
- Keep the report shorter than a full report — approximately 700-1000 words

${PARTIAL_EVIDENCE_TYPE_CONSTRAINT}`;
}

export function buildPartialReportPrompt(data: PartialReportData): string {
  const { user, attempt } = data;
  const pillars = attempt?.pillarScores ?? {};

  const band = (score: number | undefined | null): string => {
    if (score == null) return 'not assessed';
    if (score >= 8) return 'strong';
    if (score >= 7) return 'good';
    if (score >= 6) return 'developing';
    if (score >= 4) return 'needs attention';
    return 'significant growth area';
  };

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
    attempt?.projection && 'attributing own patterns to others',
    attempt?.splitting && 'black-and-white assignment of fault',
    attempt?.rationalization && 'logical justification to avoid accountability',
    attempt?.denial && 'claiming no conflict despite evidence',
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

  const narrativeHint =
    attempt?.aiSummary || attempt?.aiStrengths.length
      ? `
NARRATIVE HINTS FROM PRIOR ANALYSIS (use as inspiration only — rephrase in plain language, do not quote verbatim):
- Summary hint: ${attempt.aiSummary ?? 'none'}
- Strength hints: ${attempt.aiStrengths.length > 0 ? attempt.aiStrengths.join('; ') : 'none'}`
      : '';

  const narrativeCalibration = composeNarrativeCalibration(
    {
      finalGatePass: attempt?.finalGatePass,
      gateFailReasons: attempt?.gateFailReasons ?? [],
      gamingCorrection: attempt?.gamingCorrection ?? null,
      pillarScores: attempt?.pillarScores ?? null,
      modifiedWeightedScore: attempt?.finalScore,
    },
    { includePsychometricLens: false },
  );

  const mp = attempt?.mentalizingProfile;
  const mentalizingAsymmetryNote = mp ? buildMentalizingAsymmetryNote(mp) : null;
  const mentalizingNarrativeInstructions = mentalizingAsymmetryNote
    ? `MENTALIZING ASYMMETRY (MANDATORY): ${mentalizingAsymmetryNote} In What's Working Well For You or Where You Can Grow, explicitly distinguish other-directed perspective-taking on fictional scenarios from comparatively thinner self-directed reflection on your personal M4/M5 answers — name this contrast as a genuine insight grounded in the specific scorer notes and quoted contrast (e.g. a sharp scenario read vs. a thin personal account), not a generic "you read others better than yourself" claim without textual support. Match scenario language to actual score bands — do NOT collapse into uniform praise like "you mentalize strongly across the board" or "strong, accurate empathy in every scenario."`
    : 'MENTALIZING: If scenario-level and personal-moment mentalizing are similar, you may describe mentalizing as a general strength. Do not invent an asymmetry that is not supported by the profile. Match superlative language to score bands (7+ only for "strong/accurate").';

  const mentalizingProfileBlock = mp
    ? `- Mentalizing profile (for narrative calibration — do not quote numbers to the reader): scenario readings averaged ${mp.scenarioAverage != null ? `~${mp.scenarioAverage.toFixed(1).replace(/\.0$/, '')}` : 'n/a'}; personal grudge/reflection moment (M4) ${mp.moment4 ?? 'not scored'}; holistic rollup band ${band(pillars?.mentalizing)}${mp.keyEvidence.moment4 ? `; M4 mentalizing scorer note: "${mp.keyEvidence.moment4.slice(0, 220)}"` : ''}`
    : '';

  const m4 = attempt?.moment4Profile;
  const m5 = attempt?.moment5Profile;
  const moment4ProfileBlock = formatMomentProfilePromptBlock(
    'Personal grudge/reflection moment (M4 — first-person recollection, not fictional-character analysis)',
    m4,
    band,
  );
  const moment5ProfileBlock = formatMomentProfilePromptBlock(
    'Personal conflict moment (M5 — your own first-person account of a real conflict; highest-reliability accountability and self-reflection signal)',
    m5,
    band,
  );

  const interviewEvidenceBlock =
    attempt != null
      ? buildPersonalInterviewEvidenceBlock({
          pillarScores: attempt.pillarScores,
          scenarioKeyEvidence: attempt.scenarioKeyEvidence,
          moment5Profile: attempt.moment5Profile,
          mentalizingProfile: attempt.mentalizingProfile,
        })
      : '';

  const scenarioScoreGroundingBlock =
    attempt?.scenarioScoreGrounding != null
      ? buildScenarioScoreGroundingContextBlock(attempt.scenarioScoreGrounding)
      : '';

  return `Generate a partial personal development preview for ${user.name ?? 'this user'}. This is based ONLY on their AI interview conversation — self-assessments are not yet complete. The report should feel genuinely insightful but must NOT reveal how Amoraea scores or structures the interview.

${PARTIAL_EVIDENCE_TYPE_CONSTRAINT}

INTERVIEW-DERIVED SIGNALS (internal bands — translate into plain relational language in the report, never use these labels):
- Conflict recovery and repair: ${band(pillars?.repair)}
- Emotional presence and reading others: ${band(pillars?.attunement)}
- Managing emotional intensity in conflict: ${band(pillars?.regulation)}
- Perspective-taking and uncertainty about others: ${band(pillars?.mentalizing)}
- Recognizing partner's emotional needs: ${band(pillars?.appreciation)}
- Owning contribution to difficulty: ${band(pillars?.accountability)}
- Healthy persistence through difficulty: ${band(pillars?.commitment_threshold)}
- Constructive communication under stress: ${band(pillars?.contempt)}

DEEPER BEHAVIORAL SIGNALS:
- Psychological maturity level: ${egoDevInterp}
- Emotion recognition ability: ${emotionInterp}
- Personal disclosure style: ${attempt?.disclosureCalibration ?? 'not assessed'}
- Engagement with personal narrative: ${attempt?.moment4Concreteness ?? 'not assessed'} / ${attempt?.moment5Concreteness ?? 'not assessed'}
- Emotional vocabulary when discussing personal experience: ${vocabInterp}
- Defense patterns observed: ${activeDefenses || 'none detected'}
- Overcertainty about others' inner states: ${overcertaintyInterp}
${mentalizingProfileBlock ? `${mentalizingProfileBlock}\n` : ''}${moment4ProfileBlock ? `${moment4ProfileBlock}\n` : ''}${moment5ProfileBlock ? `${moment5ProfileBlock}\n` : ''}${interviewEvidenceBlock ? `\n${interviewEvidenceBlock}\n` : ''}${scenarioScoreGroundingBlock ? `\n${scenarioScoreGroundingBlock}\n` : ''}${narrativeHint}

NARRATIVE CALIBRATION (follow exactly):
${narrativeCalibration}
${mentalizingNarrativeInstructions}

THIRD-PARTY PRIVACY (MANDATORY): Do not use real names of other people from the user's personal stories. Refer to them generically (e.g., "a friend," "someone close to you") — never transcript names.

${getSectionDistinctnessInstructions('personal_partial')}

${getMarkdownStructuralEnforcementInstructions([], { includePsychometrics: false })}

Write the report with exactly these sections:

## Overview
2-3 sentences capturing how this person tends to show up in close relationships based on the conversation. Warm, direct, specific. Do not mention scores or assessment structure. Do not describe live, real-time conflict behavior — only what their reflective answers showed.

## What's Working Well For You
Write 2-3 strengths. For each use a ### heading with a meaningful name. Write 2-3 sentences per strength in plain language about relational patterns that came through positively. Ground each strength in at least one keyEvidence observation from the evidence block when available. If mentalizing asymmetry applies, one strength should reflect other-directed perspective-taking on scenarios; do not pretend self-directed mentalizing is equally strong unless the profile supports it. Frame strengths in terms of what reflective answers demonstrated (e.g. "when you worked through the scenarios, your analysis…") — do not imply confident predictions about live, real-time behavior in a real relationship.

## Where You Can Grow
Write 2 growth areas. For each use a ### heading. Write 2-3 sentences per area — honest about the pattern and what it tends to create in relationships, framed as developmental rather than deficit. Before finalizing each growth paragraph, audit ALL scenario scorer notes, M4/M5 keyEvidence, and holistic bands — do not let a single dominant theme override contradictory evidence (e.g. if M5 shows accountability or self-correction, name that nuance rather than flat uniform weakness). Ground accountability, repair, and self-reflection observations in M4/M5 keyEvidence and scenario scorer notes when present — cite the actual contrast between sharp other-directed reads and thinner personal accounts when asymmetry applies. Feature self-correcting moments from M5 in a strength or nuance if present — not only Closing. Do not reveal what the interview measured. Do not claim patterns appear under live, real-time conflict pressure and do not imply confident predictions about live behavior — frame repair and accountability growth in terms of what the answers themselves showed (e.g. structural/procedural repair language vs. naming what someone specifically needed). Do not invent behavioral observations unsupported by the evidence block.

## Practical Next Steps
3-4 concrete, actionable suggestions specific to this person's profile. Each 2 sentences. Follow directly from patterns identified above.

## What's Still to Come
1 short paragraph explaining that completing the self assessments (~10 minutes) will unlock a fuller personal report with deeper psychological insights, compatibility analysis, and a more complete picture. Encourage them without being salesy.

## Closing
2 sentences — warm, honest, encouraging. Acknowledge the courage of reflective conversation work.`;
}
