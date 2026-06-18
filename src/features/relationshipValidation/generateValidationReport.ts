import { supabase } from '@data/supabase/client';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import type { GamingCorrectionResult } from '@features/psychometrics/computeGamingCorrection';
import {
  parseMentalizingFromStoredSlice,
} from '@features/psychometrics/personalReportNarrativeGuidance';
import {
  buildInterviewEvidencePromptBlock,
  composeNarrativeCalibration,
} from '@features/reports/narrativeCalibration';
import { resolveReportParticipantDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import { invokeOpenAiChat } from '@utilities/invokeOpenAiChat';
import { convertMarkdownToHtml } from '@features/psychometrics/generateReport';
import { getReportLogoSrc } from '@features/psychometrics/reportBranding';
import type {
  RelationshipValidationCompatibilityBreakdown,
  RelationshipValidationPreAssessment,
} from './constants';
import {
  RELATIONSHIP_DURATION_OPTIONS,
  RELATIONSHIP_ENDING_OPTIONS,
} from './constants';
import {
  fetchRelationshipValidationRecord,
  saveValidationProfileReport,
} from './relationshipValidationRepo';
import { maybeComputeValidationPairScore } from './relationshipValidationService';
import {
  loadValidationSelfProfileSummary,
  type ValidationSelfProfileSummary,
} from './validationProfileSummary';
import {
  deriveValidationInterviewPerformanceTier,
  type ValidationInterviewPerformanceTier,
} from './validationInterviewPerformanceTier';

export type ValidationReportTier = 'partial' | 'full';

export type ValidationInterviewSummary = {
  attemptId: string;
  transcriptText: string;
  /** Qualitative tier derived from gate outcome — never exposed in report output. */
  performanceTier: ValidationInterviewPerformanceTier | null;
  finalGatePass: boolean | null;
  gateFailReasons: string[];
  gamingCorrection: GamingCorrectionResult | null;
  modifiedWeightedScore: number | null;
  pillarScores: Record<string, number> | null;
  scenarioKeyEvidence: {
    scenario1: string | null;
    scenario2: string | null;
    scenario3: string | null;
    moment4: string | null;
  };
  scenarioMentalizingScores: {
    scenario1: number | null;
    scenario2: number | null;
    scenario3: number | null;
    moment4: number | null;
  };
};

export type ValidationGaspProfile = {
  guiltRepairScore: number | null;
  shameWithdrawScore: number | null;
  externalizationScore: number | null;
};

export type ValidationReportData = {
  userName: string | null;
  reportTier: ValidationReportTier;
  aaq2Score: number | null;
  gaspProfile: ValidationGaspProfile | null;
  preAssessment: RelationshipValidationPreAssessment | null;
  selfProfile: ValidationSelfProfileSummary | null;
  assessments: {
    ecr: Record<string, number> | null;
    pvq: Record<string, number> | null;
    conflict: Record<string, number> | null;
  };
  compatibility: {
    partnerComplete: boolean;
    score: number | null;
    breakdown: RelationshipValidationCompatibilityBreakdown | null;
    partnerProfile: ValidationSelfProfileSummary | null;
    partnerGaspProfile: ValidationGaspProfile | null;
  };
  interview: ValidationInterviewSummary | null;
};

const VALIDATION_REPORT_FOOTER =
  'This report is based on validated psychometric instruments and your self-reported relationship survey responses through the Amoraea relationship validation study. It is intended for personal reflection and growth, not clinical diagnosis. Compatibility scores reflect algorithmic alignment on attachment, values, and conflict style — they are one input among many in a real relationship.';

const VALIDATION_FULL_REPORT_FOOTER =
  'This report integrates your psychometric assessments, relationship survey responses, and your Amoraea AI interview conversation. It is intended for personal reflection and growth, not clinical diagnosis. Compatibility scores reflect algorithmic alignment on attachment, values, and conflict style — they are one input among many in a real relationship.';

function formatInterviewTranscriptForPrompt(transcript: unknown): string {
  if (!Array.isArray(transcript)) return '';
  const lines: string[] = [];
  for (const msg of transcript) {
    if (!msg || typeof msg !== 'object') continue;
    const role = (msg as { role?: string }).role;
    const content = String((msg as { content?: string }).content ?? '').trim();
    if (!content) continue;
    const label = role === 'assistant' ? 'Interviewer' : role === 'user' ? 'Participant' : 'Speaker';
    lines.push(`${label}: ${content}`);
  }
  const joined = lines.join('\n\n');
  if (joined.length <= 12000) return joined;
  return `${joined.slice(0, 12000)}\n\n[Transcript truncated for length]`;
}

async function fetchValidationInterviewSummary(
  userId: string,
): Promise<ValidationInterviewSummary | null> {
  const attemptId = await fetchMostRecentCompletedInterviewAttemptId(userId);
  if (!attemptId) return null;

  const { data: attempt, error } = await supabase
    .from('interview_attempts')
    .select(
      `
      final_gate_pass,
      gate_fail_reasons,
      gaming_correction,
      modified_weighted_score,
      modified_weighted_score_with_psychometrics,
      pillar_scores,
      scenario_1_scores,
      scenario_2_scores,
      scenario_3_scores,
      scenario_specific_patterns,
      transcript
    `,
    )
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !attempt) return null;

  const finalGatePass =
    typeof attempt.final_gate_pass === 'boolean' ? attempt.final_gate_pass : null;
  const modifiedWeightedScore =
    typeof attempt.modified_weighted_score_with_psychometrics === 'number'
      ? attempt.modified_weighted_score_with_psychometrics
      : typeof attempt.modified_weighted_score === 'number'
        ? attempt.modified_weighted_score
        : null;
  const gateFailReasons = Array.isArray(attempt.gate_fail_reasons)
    ? (attempt.gate_fail_reasons as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const gamingCorrection =
    attempt.gaming_correction != null &&
    typeof attempt.gaming_correction === 'object' &&
    !Array.isArray(attempt.gaming_correction)
      ? (attempt.gaming_correction as GamingCorrectionResult)
      : null;
  const pillarScores = (attempt.pillar_scores as Record<string, number> | null) ?? null;
  const patterns = (attempt.scenario_specific_patterns as Record<string, unknown> | null) ?? null;
  const s1 = parseMentalizingFromStoredSlice(attempt.scenario_1_scores);
  const s2 = parseMentalizingFromStoredSlice(attempt.scenario_2_scores);
  const s3 = parseMentalizingFromStoredSlice(attempt.scenario_3_scores);
  const m4 = parseMentalizingFromStoredSlice(patterns?.moment_4_scores);

  return {
    attemptId,
    transcriptText: formatInterviewTranscriptForPrompt(attempt.transcript),
    performanceTier: deriveValidationInterviewPerformanceTier(
      finalGatePass,
      modifiedWeightedScore,
    ),
    finalGatePass,
    gateFailReasons,
    gamingCorrection,
    modifiedWeightedScore,
    pillarScores,
    scenarioKeyEvidence: {
      scenario1: s1.keyEvidenceMentalizing,
      scenario2: s2.keyEvidenceMentalizing,
      scenario3: s3.keyEvidenceMentalizing,
      moment4: m4.keyEvidenceMentalizing,
    },
    scenarioMentalizingScores: {
      scenario1: s1.mentalizing,
      scenario2: s2.mentalizing,
      scenario3: s3.mentalizing,
      moment4: m4.mentalizing,
    },
  };
}

/** True when the user has a completed AI interview attempt (validation full report unlocked). */
export async function isValidationInterviewCompleted(userId: string): Promise<boolean> {
  const attemptId = await fetchMostRecentCompletedInterviewAttemptId(userId);
  return attemptId != null;
}

function durationLabel(value: RelationshipValidationPreAssessment['duration']): string {
  return RELATIONSHIP_DURATION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function endingLabel(value: RelationshipValidationPreAssessment['consideredEnding']): string {
  return RELATIONSHIP_ENDING_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function parseValidationGaspProfile(row: {
  psychometrics_gasp_score?: number | null;
  psychometrics_gasp_guilt_repair_score?: number | null;
  psychometrics_gasp_shame_withdraw_score?: number | null;
} | null): ValidationGaspProfile | null {
  if (!row) return null;
  const guiltRepairScore =
    typeof row.psychometrics_gasp_guilt_repair_score === 'number'
      ? row.psychometrics_gasp_guilt_repair_score
      : null;
  const shameWithdrawScore =
    typeof row.psychometrics_gasp_shame_withdraw_score === 'number'
      ? row.psychometrics_gasp_shame_withdraw_score
      : null;
  const externalizationScore =
    typeof row.psychometrics_gasp_score === 'number' ? row.psychometrics_gasp_score : null;
  if (guiltRepairScore == null && shameWithdrawScore == null && externalizationScore == null) {
    return null;
  }
  return { guiltRepairScore, shameWithdrawScore, externalizationScore };
}

type ValidationGaspPattern = 'repair' | 'withdraw' | 'mixed';

function resolveValidationGaspPattern(profile: ValidationGaspProfile): ValidationGaspPattern {
  const guiltRepair = profile.guiltRepairScore ?? 4;
  const shameWithdraw = profile.shameWithdrawScore ?? 4;
  const repairDominant = guiltRepair >= 5 && shameWithdraw <= 4;
  const withdrawDominant = shameWithdraw >= 5 && guiltRepair <= 4;
  if (repairDominant && !withdrawDominant) return 'repair';
  if (withdrawDominant && !repairDominant) return 'withdraw';
  return 'mixed';
}

function buildValidationGaspInternalBlock(profile: ValidationGaspProfile): string {
  const pattern = resolveValidationGaspPattern(profile);
  const repairBand =
    profile.guiltRepairScore != null
      ? profile.guiltRepairScore >= 5
        ? 'high move-toward-repair'
        : profile.guiltRepairScore <= 3
          ? 'low move-toward-repair'
          : 'mid-range move-toward-repair'
      : 'not assessed';
  const withdrawBand =
    profile.shameWithdrawScore != null
      ? profile.shameWithdrawScore >= 5
        ? 'high pull-back-after-harm'
        : profile.shameWithdrawScore <= 3
          ? 'low pull-back-after-harm'
          : 'mid-range pull-back-after-harm'
      : 'not assessed';

  return `HARM-RESPONSE PROFILE (internal — translate to accessible behavioral language only; never name instruments or use clinical terms):
- Move-toward-repair tendency: ${repairBand}
- Pull-back-after-harm tendency: ${withdrawBand}
- Overall pattern: ${pattern === 'repair' ? 'repair-oriented when they realize they hurt someone' : pattern === 'withdraw' ? 'withdrawal-oriented when they realize they hurt someone' : 'mixed — sometimes repair, sometimes pull back depending on severity'}

GASP SECTION INSTRUCTION (MANDATORY when this block is present):
Write 2–3 paragraphs describing what this person tends to do when they realize they have hurt someone — behaviorally, in plain language.
- High move-toward-repair / low pull-back-after-harm: describe someone who tends to move toward repair when they have caused harm — acknowledging impact, making amends, staying in connection rather than retreating.
- High pull-back-after-harm / low move-toward-repair: describe someone whose instinct when they have caused harm is to pull back or go quiet — motivated more by discomfort with having been "bad" than by concern for the other person's experience. Note this can look like withdrawal or avoidance after conflict even when the person cares deeply.
- Balanced or mid-range: describe as a mixed pattern — sometimes moving toward repair, sometimes pulling back depending on the severity of the perceived harm.
Never use the words "guilt," "shame," "GASP," or clinical terminology. Describe behaviorally: what the person tends to do when they realize they have hurt someone.`;
}

function buildValidationGaspCompatibilityNote(
  userProfile: ValidationGaspProfile,
  partnerProfile: ValidationGaspProfile,
): string {
  const userPattern = resolveValidationGaspPattern(userProfile);
  const partnerPattern = resolveValidationGaspPattern(partnerProfile);
  if (userPattern === partnerPattern) return '';
  if (
    (userPattern === 'repair' && partnerPattern === 'withdraw') ||
    (userPattern === 'withdraw' && partnerPattern === 'repair')
  ) {
    return `
HARM-RESPONSE COMPATIBILITY NOTE (internal): One partner tends to move toward repair after causing harm while the other tends to pull back or go quiet. In the Compatibility section, name this dynamic gently — the repair-oriented partner may experience withdrawal as indifference; the withdrawal-oriented partner may experience pursuit of repair as overwhelming. Frame developmentally, not as fault.`;
  }
  return '';
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function hashSourcePayload(payload: unknown): string {
  const str = stableStringify(payload);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function computeValidationReportSourceHash(data: ValidationReportData): string {
  return hashSourcePayload({
    kind: data.reportTier === 'full' ? 'validation-full' : 'validation-partial',
    pre: data.preAssessment,
    self: data.selfProfile,
    ecr: data.assessments.ecr,
    pvq: data.assessments.pvq,
    conflict: data.assessments.conflict,
    gasp: data.gaspProfile,
    partnerGasp: data.compatibility.partnerGaspProfile,
    compat: data.compatibility,
    interviewAttemptId: data.interview?.attemptId ?? null,
    interviewPerformanceTier: data.interview?.performanceTier ?? null,
    interviewFinalGatePass: data.interview?.finalGatePass ?? null,
    interviewGateFailReasons: data.interview?.gateFailReasons ?? [],
  });
}

export async function fetchValidationReportData(userId: string): Promise<ValidationReportData> {
  const [userRow, record, selfProfile, assessmentsRes] = await Promise.all([
    supabase
      .from('users')
      .select(
        'name, basic_info, email, psychometrics_aaq2_score, psychometrics_gasp_score, psychometrics_gasp_guilt_repair_score, psychometrics_gasp_shame_withdraw_score',
      )
      .eq('id', userId)
      .maybeSingle(),
    fetchRelationshipValidationRecord(userId),
    loadValidationSelfProfileSummary(userId),
    supabase
      .from('user_assessments')
      .select('instrument, scores')
      .eq('user_id', userId)
      .in('instrument', ['ECR-36', 'PVQ-21', 'CONFLICT-30']),
  ]);

  if (assessmentsRes.error) throw new Error(assessmentsRes.error.message);

  const byInstrument = new Map(
    (assessmentsRes.data ?? []).map((row) => [
      String(row.instrument),
      row.scores as Record<string, number>,
    ]),
  );

  const partnerUserId = record?.partner_user_id ?? null;
  let partnerProfile: ValidationSelfProfileSummary | null = null;
  let partnerGaspProfile: ValidationGaspProfile | null = null;
  if (partnerUserId && record?.psychometrics_completed_at) {
    const [loadedPartnerProfile, partnerUserRes] = await Promise.all([
      loadValidationSelfProfileSummary(partnerUserId),
      supabase
        .from('users')
        .select(
          'psychometrics_gasp_score, psychometrics_gasp_guilt_repair_score, psychometrics_gasp_shame_withdraw_score',
        )
        .eq('id', partnerUserId)
        .maybeSingle(),
    ]);
    partnerProfile = loadedPartnerProfile;
    partnerGaspProfile = parseValidationGaspProfile(partnerUserRes.data);
  }

  const partnerComplete =
    Boolean(partnerUserId) &&
    record?.compatibility_score != null &&
    record?.compatibility_breakdown != null;

  const interview = await fetchValidationInterviewSummary(userId);
  const reportTier: ValidationReportTier = interview ? 'full' : 'partial';

  const displayName = resolveReportParticipantDisplayName({
    name: userRow.data?.name,
    basic_info: userRow.data?.basic_info,
    email: userRow.data?.email,
  });

  return {
    userName: displayName,
    reportTier,
    aaq2Score:
      typeof userRow.data?.psychometrics_aaq2_score === 'number'
        ? userRow.data.psychometrics_aaq2_score
        : null,
    gaspProfile: parseValidationGaspProfile(userRow.data),
    preAssessment: record?.pre_assessment ?? null,
    selfProfile,
    assessments: {
      ecr: byInstrument.get('ECR-36') ?? null,
      pvq: byInstrument.get('PVQ-21') ?? null,
      conflict: byInstrument.get('CONFLICT-30') ?? null,
    },
    compatibility: {
      partnerComplete,
      score: record?.compatibility_score ?? null,
      breakdown:
        (record?.compatibility_breakdown as RelationshipValidationCompatibilityBreakdown | null) ??
        null,
      partnerProfile,
      partnerGaspProfile,
    },
    interview,
  };
}

function buildValidationReportSystemPrompt(tier: ValidationReportTier): string {
  const interviewRules =
    tier === 'full'
      ? `
- The user also completed an Amoraea AI interview — weave conversational evidence into the narrative
- Reference specific themes from their interview responses (conflict, repair, perspective-taking, emotional attunement) using descriptive pattern language only
- Do NOT paste the transcript verbatim; synthesize patterns you observe
- Calibrate interview tone to the performance tier provided in the user message — never reframe weak interview signals as strengths; use emotionally neutral reflections regardless of answer quality`
      : `
- This is a partial report based on questionnaires and psychometrics only — do not invent interview evidence`;

  return `You are generating a comprehensive relationship validation report for Amoraea, a relationship-readiness platform. The user completed psychometric assessments (attachment, Schwartz values, conflict style) and a relationship pre-survey as part of a research validation study.${tier === 'full' ? ' They also completed the Amoraea AI interview.' : ''}

This report is generated independently from the standard interview narrative pipeline — base interview sections on the transcript and tone tier only.

CRITICAL RULES:
- Do NOT use clinical diagnostic language
- DO write in warm, direct, plain language a non-psychologist would understand
- DO use second person throughout ("you", "your")
- DO be honest about growth areas — constructive, not harsh
- DO be specific to the profile data — avoid generic advice
- DO make the report feel like a thoughtful relationship expert wrote it for this couple
- Format section headings with ## and subsection headings with ###
- Use **bold** for emphasis on key insights
- Write in flowing prose; avoid bullet lists except where explicitly requested
- Target length: approximately ${tier === 'full' ? '1800–2400' : '1400–2000'} words — exhaustive and detailed, not a summary${interviewRules}`;
}

function buildValidationReportUserPrompt(data: ValidationReportData): string {
  const {
    userName,
    preAssessment,
    selfProfile,
    assessments,
    compatibility,
    interview,
    reportTier,
    gaspProfile,
  } = data;
  const pre = preAssessment;

  const preBlock = pre
    ? `
RELATIONSHIP PRE-SURVEY (self-reported):
- Time together: ${durationLabel(pre.duration)}
- Overall felt compatibility (1–10): ${pre.overallCompatibility}
- Conflict handling together (1–10): ${pre.conflictHandling}
- Core values alignment felt (1–10): ${pre.valuesAlignment}
- Partner emotional attunement felt (1–10): ${pre.emotionalAttunement}
- Seriously considered ending: ${endingLabel(pre.consideredEnding)}
- Overall relationship satisfaction (1–10): ${pre.overallSatisfaction}`
    : 'RELATIONSHIP PRE-SURVEY: not available';

  const selfBlock = selfProfile
    ? `
YOUR PSYCHOMETRIC PROFILE (translate into plain language — do not use instrument names):
- Attachment style label: ${selfProfile.attachmentLabel}
- Attachment description: ${selfProfile.attachmentDescription}
- Top values dimensions: ${selfProfile.topValues.join(', ') || 'not available'}
- Primary conflict style: ${selfProfile.conflictStyleLabel}`
    : 'YOUR PSYCHOMETRIC PROFILE: incomplete';

  const scoresHint = `
INTERNAL SCORE DATA (for your analysis only — never quote numbers or instrument names in the report):
- Attachment dimensions: ${JSON.stringify(assessments.ecr ?? {})}
- Values profile: ${JSON.stringify(assessments.pvq ?? {})}
- Conflict style distribution: ${JSON.stringify(assessments.conflict ?? {})}`;

  const gaspBlock = gaspProfile ? `\n${buildValidationGaspInternalBlock(gaspProfile)}` : '';
  const gaspCompatibilityNote =
    gaspProfile && compatibility.partnerGaspProfile
      ? buildValidationGaspCompatibilityNote(gaspProfile, compatibility.partnerGaspProfile)
      : '';
  const gaspSection = gaspProfile
    ? `
## How You Respond When Things Go Wrong
2–3 paragraphs on what you tend to do when you realize you have hurt someone — follow the harm-response profile instructions above. Place behavioral emphasis on repair vs withdrawal patterns without clinical language.`
    : '';

  const compatBlock = compatibility.partnerComplete
    ? `
PAIR COMPATIBILITY (both partners completed):
- Overall compatibility: ${Math.round((compatibility.score ?? 0) * 100)}% alignment
- Attachment alignment band: ${Math.round((compatibility.breakdown?.attachment ?? 0) * 100)}%
- Values alignment band: ${Math.round((compatibility.breakdown?.values ?? 0) * 100)}%
- Conflict style alignment band: ${Math.round((compatibility.breakdown?.conflictStyle ?? 0) * 100)}%
${
  compatibility.partnerProfile
    ? `PARTNER PROFILE SUMMARY (describe in plain language; do not name instruments):
- Partner attachment: ${compatibility.partnerProfile.attachmentLabel}
- Partner top values: ${compatibility.partnerProfile.topValues.join(', ')}
- Partner conflict style: ${compatibility.partnerProfile.conflictStyleLabel}`
    : ''
}`
    : `
PAIR COMPATIBILITY: Partner has not completed their assessment yet. Write about the user's individual profile and note that couple compatibility analysis will be available once their partner finishes. Do not invent a compatibility score.`;

  const narrativeCalibration = composeNarrativeCalibration({
    finalGatePass: interview?.finalGatePass ?? null,
    gateFailReasons: interview?.gateFailReasons ?? [],
    gamingCorrection: interview?.gamingCorrection ?? null,
    pillarScores: interview?.pillarScores ?? null,
    aaq2Score: data.aaq2Score,
    modifiedWeightedScore: interview?.modifiedWeightedScore ?? null,
  });

  const interviewEvidenceBlock =
    reportTier === 'full' && interview
      ? buildInterviewEvidencePromptBlock({
          pillarScores: interview.pillarScores,
          scenarioKeyEvidence: interview.scenarioKeyEvidence,
          scenarioMentalizingScores: interview.scenarioMentalizingScores,
        })
      : '';

  const interviewBlock =
    reportTier === 'full' && interview
      ? `
AI INTERVIEW (completed — synthesize; do not quote verbatim):
${interviewEvidenceBlock}

TRANSCRIPT:
${interview.transcriptText || '[No transcript available]'}`
      : '';

  const interviewSections =
    reportTier === 'full'
      ? `
## What Your AI Interview Revealed
3–4 paragraphs on how the user thinks about relationships under pressure — conflict, repair, perspective-taking, emotional attunement, and respect as shown in their spoken responses. Tie observations to scenario moments using descriptive pattern language only. Follow the interview tone tier strictly.

## Patterns Across Conversation and Questionnaires
2–3 paragraphs integrating psychometric profile with interview behavior — where they align, where conversation adds nuance questionnaires alone could not capture. Follow the interview tone tier for anything drawn from the interview.`
      : '';

  return `Generate a ${reportTier === 'full' ? 'full' : 'partial'} relationship validation report for ${userName ?? 'this participant'}.

${preBlock}
${selfBlock}
${scoresHint}${gaspBlock}${gaspCompatibilityNote}
${compatBlock}
${interviewBlock}

NARRATIVE CALIBRATION (follow exactly):
${narrativeCalibration}

Write the report with exactly these sections:

## Overview
3–4 rich paragraphs synthesizing who this person is relationally — attachment, values, conflict approach, and how they experience their current relationship.${reportTier === 'full' ? ' Include how their interview responses deepen or refine the questionnaire picture.' : ''}${gaspProfile ? ' Include how they tend to respond after causing harm when relevant.' : ''} This should feel like being truly seen. Reference their pre-survey satisfaction and compatibility ratings alongside psychometric patterns.

## Your Attachment Style in Relationships
2–3 paragraphs on their attachment pattern: what it tends to look like in intimacy, stress, and conflict; strengths it brings; common pitfalls. Use the attachment label and description provided but expand with relational nuance.

## Your Values and What You Prioritize
2–3 paragraphs on their Schwartz values profile — what they likely prioritize in life and partnership, where values may create harmony or tension with a partner, and how values show up in daily relationship decisions.

## How You Navigate Conflict
2–3 paragraphs on their conflict style — default moves under pressure, what partners likely experience, and how this interacts with their attachment pattern.
${gaspSection}
## Your Relationship Right Now
2–3 paragraphs weaving together their pre-survey responses (satisfaction, felt compatibility, conflict handling, values alignment, attunement, consideration of ending). Be honest and compassionate. Note any gaps between felt experience and psychometric patterns if evident.
${interviewSections}
${
  compatibility.partnerComplete
    ? `## Compatibility With Your Partner
3–4 paragraphs interpreting the couple compatibility result. Explain attachment, values, and conflict-style alignment in plain language. Describe where they likely mesh well and where friction may appear. Reference the partner's profile summary without comparing harshly.

## Growing Together
2–3 paragraphs with specific, actionable guidance for this couple based on the combined profiles — communication habits, repair strategies, and values conversations to prioritize.`
    : `## When Your Partner Completes Their Assessment
1 short paragraph explaining that a full couple compatibility analysis (attachment, values, and conflict-style alignment) will be available once their partner finishes — encourage patience without being salesy.`
}

## Your Relational Strengths
3–4 strengths. Each uses a ### heading with a meaningful name. Write 3–4 sentences per strength grounded in their specific data.

## Where You Have Room to Grow
2–3 growth areas. Each uses a ### heading. Write 3–4 sentences per area — honest about relational impact, framed developmentally.

## What a Partner Likely Experiences With You
1–2 frank, compassionate paragraphs describing the lived experience of being in a close relationship with this person.

## Practical Steps Forward
4–5 concrete suggestions specific to this profile. Each 2–3 sentences. Not generic self-help.

## Closing
2–3 warm, honest sentences acknowledging the work they did and what they bring to a relationship.`;
}

export async function generateValidationReportMarkdown(
  userId: string,
  prefetchedData?: ValidationReportData,
): Promise<string> {
  const data = prefetchedData ?? (await fetchValidationReportData(userId));

  return invokeOpenAiChat({
    model: 'gpt-4o',
    max_tokens: data.reportTier === 'full' ? 5500 : 4500,
    temperature: 0.65,
    messages: [
      {
        role: 'system',
        content: buildValidationReportSystemPrompt(data.reportTier),
      },
      { role: 'user', content: buildValidationReportUserPrompt(data) },
    ],
  });
}

export async function buildValidationReportHtml(userId: string): Promise<string> {
  const pairResult = await maybeComputeValidationPairScore(userId);
  if (!pairResult.partnerComplete) {
    throw new Error('Partner has not completed their assessment yet');
  }

  const [data, record, logoSrc] = await Promise.all([
    fetchValidationReportData(userId),
    fetchRelationshipValidationRecord(userId),
    getReportLogoSrc(),
  ]);

  const sourceHash = computeValidationReportSourceHash(data);
  const safeName = data.userName;
  const isFull = data.reportTier === 'full';
  const footerDisclaimer = isFull ? VALIDATION_FULL_REPORT_FOOTER : VALIDATION_REPORT_FOOTER;
  const headerSubtitle = isFull
    ? 'Relationship Validation Report — Full'
    : 'Relationship Validation Report — Partial';

  if (
    record?.profile_report_markdown &&
    record.profile_report_source_hash === sourceHash
  ) {
    return convertMarkdownToHtml(record.profile_report_markdown, {
      userName: safeName,
      logoSrc,
      headerTitle: safeName
        ? `${safeName}'s Relationship Report`
        : 'Your Relationship Report',
      headerSubtitle,
      footerDisclaimer,
    });
  }

  const reportMarkdown = await generateValidationReportMarkdown(userId, data);
  await saveValidationProfileReport(userId, reportMarkdown, sourceHash);

  return convertMarkdownToHtml(reportMarkdown, {
    userName: safeName,
    logoSrc,
    headerTitle: safeName ? `${safeName}'s Relationship Report` : 'Your Relationship Report',
    headerSubtitle,
    footerDisclaimer,
  });
}
