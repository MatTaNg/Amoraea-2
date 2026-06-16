import { supabase } from '@data/supabase/client';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
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

export type ValidationReportTier = 'partial' | 'full';

export type ValidationInterviewSummary = {
  attemptId: string;
  pillarScores: Record<string, number> | null;
  egoDevLevel: number | null;
  weightedScore: number | null;
  transcriptText: string;
};

export type ValidationReportData = {
  userName: string | null;
  reportTier: ValidationReportTier;
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
    .select('pillar_scores, ego_development_level, weighted_score, transcript')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !attempt) return null;

  return {
    attemptId,
    pillarScores: (attempt.pillar_scores as Record<string, number> | null) ?? null,
    egoDevLevel:
      typeof attempt.ego_development_level === 'number' ? attempt.ego_development_level : null,
    weightedScore: typeof attempt.weighted_score === 'number' ? attempt.weighted_score : null,
    transcriptText: formatInterviewTranscriptForPrompt(attempt.transcript),
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
    compat: data.compatibility,
    interviewAttemptId: data.interview?.attemptId ?? null,
  });
}

export async function fetchValidationReportData(userId: string): Promise<ValidationReportData> {
  const [userRow, record, selfProfile, assessmentsRes] = await Promise.all([
    supabase.from('users').select('name, basic_info, email').eq('id', userId).maybeSingle(),
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
  if (partnerUserId && record?.psychometrics_completed_at) {
    partnerProfile = await loadValidationSelfProfileSummary(partnerUserId);
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
    },
    interview,
  };
}

function buildValidationReportSystemPrompt(tier: ValidationReportTier): string {
  const interviewRules =
    tier === 'full'
      ? `
- The user also completed an Amoraea AI interview — weave conversational evidence into the narrative
- Reference specific themes from their interview responses (conflict, repair, mentalizing) without quoting scores
- Do NOT paste the transcript verbatim; synthesize patterns you observe`
      : `
- This is a partial report based on questionnaires and psychometrics only — do not invent interview evidence`;

  return `You are generating a comprehensive relationship validation report for Amoraea, a relationship-readiness platform. The user completed psychometric assessments (attachment, Schwartz values, conflict style) and a relationship pre-survey as part of a research validation study.${tier === 'full' ? ' They also completed the Amoraea AI interview.' : ''}

CRITICAL RULES:
- Do NOT reveal raw numerical psychometric scores, percentiles, or instrument names (ECR, PVQ, TKI, etc.)
- Do NOT describe the scoring algorithm or compatibility formula in technical terms
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
  const { userName, preAssessment, selfProfile, assessments, compatibility, interview, reportTier } =
    data;
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

  const interviewBlock =
    reportTier === 'full' && interview
      ? `
AI INTERVIEW (completed — synthesize; do not quote verbatim):
- Interview composite score (internal): ${interview.weightedScore ?? 'n/a'}
- Ego development level (internal): ${interview.egoDevLevel ?? 'n/a'}
- Construct scores (internal): ${JSON.stringify(interview.pillarScores ?? {})}

TRANSCRIPT:
${interview.transcriptText || '[No transcript available]'}`
      : '';

  const interviewSections =
    reportTier === 'full'
      ? `
## What Your AI Interview Revealed
3–4 paragraphs on how the user thinks about relationships under pressure — mentalizing, accountability, repair, attunement, and contempt dynamics as shown in their spoken responses. Tie observations to scenario moments without naming scores.

## Patterns Across Conversation and Questionnaires
2–3 paragraphs integrating psychometric profile with interview behavior — where they align, where conversation adds nuance questionnaires alone could not capture.`
      : '';

  return `Generate a ${reportTier === 'full' ? 'full' : 'partial'} relationship validation report for ${userName ?? 'this participant'}.

${preBlock}
${selfBlock}
${scoresHint}
${compatBlock}
${interviewBlock}

Write the report with exactly these sections:

## Overview
3–4 rich paragraphs synthesizing who this person is relationally — attachment, values, conflict approach, and how they experience their current relationship.${reportTier === 'full' ? ' Include how their interview responses deepen or refine the questionnaire picture.' : ''} This should feel like being truly seen. Reference their pre-survey satisfaction and compatibility ratings alongside psychometric patterns.

## Your Attachment Style in Relationships
2–3 paragraphs on their attachment pattern: what it tends to look like in intimacy, stress, and conflict; strengths it brings; common pitfalls. Use the attachment label and description provided but expand with relational nuance.

## Your Values and What You Prioritize
2–3 paragraphs on their Schwartz values profile — what they likely prioritize in life and partnership, where values may create harmony or tension with a partner, and how values show up in daily relationship decisions.

## How You Navigate Conflict
2–3 paragraphs on their conflict style — default moves under pressure, what partners likely experience, and how this interacts with their attachment pattern.

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
      { role: 'system', content: buildValidationReportSystemPrompt(data.reportTier) },
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
