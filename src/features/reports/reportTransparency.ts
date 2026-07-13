import type { ReportData } from '@features/psychometrics/personalReportData';
import {
  CONFLICT_AAQ2_HIGH_MIN,
  CONFLICT_AAQ2_LOW_MAX,
  CONFLICT_ACCOUNTABILITY_STRONG_MIN,
  CONFLICT_ACCOUNTABILITY_WEAK_MAX,
  CONFLICT_ATTUNEMENT_STRONG_MIN,
  CONFLICT_BRS_HIGH_MIN,
  CONFLICT_BRS_LOW_MAX,
  CONFLICT_COMMITMENT_STRONG_MIN,
  CONFLICT_DWECK_LOW_MAX,
  CONFLICT_GASP_HIGH_MIN,
  CONFLICT_GASP_LOW_MAX,
  CONFLICT_MENTALIZING_STRONG_MIN,
  CONFLICT_MENTALIZING_WEAK_MAX,
  CONFLICT_REGULATION_STRONG_MIN,
  CONFLICT_REGULATION_WEAK_MAX,
  CONFLICT_RFQ_HIGH_MIN,
  CONFLICT_RFQ_LOW_MAX,
  CONFLICT_RSES_HIGH_MIN,
  CONFLICT_RSES_LOW_MAX,
  CONFLICT_SCS_LOW_MAX,
} from '@config/reports/evidenceConflictThresholds';

export const REPORT_FOOTER_DISCLAIMER =
  'This report combines questionnaire responses and interview responses using automated scoring and AI-generated writing. Some source instruments may have published validation evidence, but this report should not be interpreted as a clinical diagnosis or as a complete measure of your personality.';

export const REPORT_CONFIDENCE_LIMITATIONS_HEADING = 'About the Confidence of These Findings';

export const REPORT_CONFIDENCE_LIMITATIONS_BODY =
  'Confidence in the patterns described here is mostly moderate. This report reflects a limited sample of your questionnaire responses and interview conversation, and may not capture the full complexity of how you show up in every relationship or context.';

export const REPORT_EVIDENCE_MIXED_HEADING = 'Where the Evidence Was Mixed';

export type EvidenceConflict = {
  id: string;
  paragraph: string;
};

function conflictParagraph(questionnaireMore: string, interviewMore: string): string {
  return (
    `Your questionnaire/self-report results suggested more ${questionnaireMore} than your interview responses did on ${interviewMore}. ` +
    `Because these two sources didn't fully agree, this is worth treating as something to explore rather than a settled conclusion.`
  );
}

function normalizePsychometricTo10(
  score: number | null | undefined,
  min: number,
  max: number,
  inverted = false,
): number | null {
  if (score == null || !Number.isFinite(score)) return null;
  const normalized = ((score - min) / (max - min)) * 9 + 1;
  const clamped = Math.max(1, Math.min(10, normalized));
  return inverted ? 11 - clamped : clamped;
}

type ConflictDetector = (input: {
  pillars: Record<string, number>;
  user: ReportData['user'];
}) => EvidenceConflict | null;

const CONFLICT_DETECTORS: ConflictDetector[] = [
  ({ pillars, user }) => {
    const aaq2 = user.aaq2Score;
    const regulation = pillars.regulation;
    if (aaq2 == null || regulation == null) return null;
    if (aaq2 >= CONFLICT_AAQ2_HIGH_MIN && regulation >= CONFLICT_REGULATION_STRONG_MIN) {
      return {
        id: 'aaq2_regulation_divergence',
        paragraph: conflictParagraph(
          'experiential avoidance or difficulty staying with painful emotions',
          'emotional regulation when working through conflict scenarios',
        ),
      };
    }
    if (aaq2 <= CONFLICT_AAQ2_LOW_MAX && regulation <= CONFLICT_REGULATION_WEAK_MAX) {
      return {
        id: 'aaq2_regulation_low_both',
        paragraph: conflictParagraph(
          'openness to difficult emotions on questionnaires',
          'difficulty regulating emotional intensity in the interview',
        ),
      };
    }
    return null;
  },
  ({ pillars, user }) => {
    const aaq2 = user.aaq2Score;
    const attunement = pillars.attunement;
    if (aaq2 == null || attunement == null) return null;
    if (aaq2 >= CONFLICT_AAQ2_HIGH_MIN && attunement >= CONFLICT_ATTUNEMENT_STRONG_MIN) {
      return {
        id: 'aaq2_attunement_divergence',
        paragraph: conflictParagraph(
          'experiential avoidance or emotional distance on questionnaires',
          'attunement and emotional presence in the interview',
        ),
      };
    }
    return null;
  },
  ({ pillars, user }) => {
    const gasp = user.psychometrics.gaspScore;
    const accountability = pillars.accountability;
    if (gasp == null || accountability == null) return null;
    if (gasp >= CONFLICT_GASP_HIGH_MIN && accountability >= CONFLICT_ACCOUNTABILITY_STRONG_MIN) {
      return {
        id: 'gasp_accountability_divergence',
        paragraph: conflictParagraph(
          'tendency to externalize blame or minimize your own role after harm',
          'accountability and ownership in the interview',
        ),
      };
    }
    if (gasp <= CONFLICT_GASP_LOW_MAX && accountability <= CONFLICT_ACCOUNTABILITY_WEAK_MAX) {
      return {
        id: 'gasp_accountability_low_both',
        paragraph: conflictParagraph(
          'personal accountability on questionnaires',
          'ownership of your contribution in conflict scenarios',
        ),
      };
    }
    return null;
  },
  ({ pillars, user }) => {
    const brs = user.psychometrics.brsScore;
    const regulation = pillars.regulation;
    if (brs == null || regulation == null) return null;
    if (brs < CONFLICT_BRS_LOW_MAX && regulation >= CONFLICT_REGULATION_STRONG_MIN) {
      return {
        id: 'brs_regulation_divergence',
        paragraph: conflictParagraph(
          'stress sensitivity or slower recovery on questionnaires',
          'emotional regulation in the interview',
        ),
      };
    }
    if (brs >= CONFLICT_BRS_HIGH_MIN && regulation <= CONFLICT_REGULATION_WEAK_MAX) {
      return {
        id: 'brs_regulation_high_questionnaire',
        paragraph: conflictParagraph(
          'resilience and bounce-back on questionnaires',
          'difficulty managing emotional intensity in the interview',
        ),
      };
    }
    return null;
  },
  ({ pillars, user }) => {
    const rses = user.rsesScore;
    const accountability = pillars.accountability;
    if (rses == null || accountability == null) return null;
    if (rses <= CONFLICT_RSES_LOW_MAX && accountability >= CONFLICT_ACCOUNTABILITY_STRONG_MIN) {
      return {
        id: 'rses_accountability_divergence',
        paragraph: conflictParagraph(
          'self-doubt or lower self-worth on questionnaires',
          'accountability and ownership in the interview',
        ),
      };
    }
    if (rses >= CONFLICT_RSES_HIGH_MIN && accountability <= CONFLICT_ACCOUNTABILITY_WEAK_MAX) {
      return {
        id: 'rses_accountability_high_questionnaire',
        paragraph: conflictParagraph(
          'confidence in your self-worth on questionnaires',
          'difficulty owning your contribution in the interview',
        ),
      };
    }
    return null;
  },
  ({ pillars, user }) => {
    const scs =
      user.psychometrics.scsSfScore ??
      averageNonNull([
        user.psychometrics.scsSfSelfKindnessScore,
        user.psychometrics.scsSfCommonHumanityScore,
        user.psychometrics.scsSfMindfulnessScore,
      ]);
    const accountability = pillars.accountability;
    if (scs == null || accountability == null) return null;
    if (scs < 2 && accountability >= 7) {
      return {
        id: 'scs_sf_accountability_divergence',
        paragraph: conflictParagraph(
          'self-criticism or limited self-compassion on questionnaires',
          'accountability and repair in the interview',
        ),
      };
    }
    return null;
  },
  ({ pillars, user }) => {
    const dweck = user.psychometrics.dweckScore;
    const commitment = pillars.commitment_threshold;
    if (dweck == null || commitment == null) return null;
    if (dweck < 2.5 && commitment >= 7) {
      return {
        id: 'dweck_commitment_divergence',
        paragraph: conflictParagraph(
          'fixed-leaning responses to change on questionnaires',
          'persistence through difficulty in the interview',
        ),
      };
    }
    return null;
  },
  ({ pillars, user }) => {
    const rfq = user.psychometrics.rfqScore;
    const mentalizing = pillars.mentalizing;
    if (rfq == null || mentalizing == null) return null;
    if (rfq < 3.5 && mentalizing >= 7) {
      return {
        id: 'rfq_mentalizing_divergence_low_self_report',
        paragraph: conflictParagraph(
          'difficulty making sense of inner motivations on questionnaires',
          'perspective-taking in the interview',
        ),
      };
    }
    if (rfq >= 5.5 && mentalizing <= 4) {
      return {
        id: 'rfq_mentalizing_divergence_high_self_report',
        paragraph: conflictParagraph(
          'reflective depth and psychological curiosity on questionnaires',
          'perspective-taking in conflict scenarios',
        ),
      };
    }
    return null;
  },
];

function averageNonNull(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function gamingCorrectionTriggersConflict(data: ReportData): boolean {
  const gaming = data.attempt?.gamingCorrection;
  if (!gaming) return false;
  if (gaming.correctionLevel > 0) return true;
  return gaming.activeTriggers.some((t) => t.type === 'consistency_divergence');
}

export function detectEvidenceConflicts(data: ReportData): EvidenceConflict[] {
  const pillars = data.attempt?.pillarScores;
  if (!pillars) return [];

  const detected = CONFLICT_DETECTORS.map((fn) => fn({ pillars, user: data.user })).filter(
    (c): c is EvidenceConflict => c != null,
  );

  // Add conflicts from gaming correction triggers
  const gamingTriggers = data.attempt?.gamingCorrection?.activeTriggers ?? [];
  for (const trigger of gamingTriggers) {
    if (trigger.type === 'consistency_divergence' && trigger.instrument) {
      if (trigger.instrument === 'aaq2' && !detected.some((c) => c.id === 'aaq2_regulation_divergence')) {
        detected.push({
          id: 'aaq2_regulation_divergence',
          paragraph: conflictParagraph(
            'experiential avoidance or difficulty staying with painful emotions',
            'emotional regulation when working through conflict scenarios',
          ),
        });
      }
      if (trigger.instrument === 'rfq' && !detected.some((c) => c.id.startsWith('rfq_mentalizing_divergence'))) {
        detected.push({
          id: 'rfq_mentalizing_divergence_gaming',
          paragraph: conflictParagraph(
            'reflective depth on questionnaires',
            'perspective-taking in the interview',
          ),
        });
      }
      if (trigger.instrument === 'brs' && !detected.some((c) => c.id.startsWith('brs_regulation'))) {
        detected.push({
          id: 'brs_regulation_divergence_gaming',
          paragraph: conflictParagraph(
            'resilience on questionnaires',
            'emotional regulation in the interview',
          ),
        });
      }
    }
  }

  // Add conflicts for >2 points difference in direction
  const p = data.user.psychometrics;
  const aaq2Flexibility = normalizePsychometricTo10(data.user.aaq2Score, 7, 49, true);
  const gaspAccountability = normalizePsychometricTo10(p.gaspScore, 1, 7, true);
  const brsRegulation = normalizePsychometricTo10(p.brsScore, 1, 5);
  const rsesAccountability = normalizePsychometricTo10(data.user.rsesScore, 0, 30);
  const scsAccountability = normalizePsychometricTo10(
    p.scsSfScore ??
      averageNonNull([p.scsSfSelfKindnessScore, p.scsSfCommonHumanityScore, p.scsSfMindfulnessScore]),
    1,
    5,
  );
  const dweckCommitment = normalizePsychometricTo10(p.dweckScore, 1, 6);
  const rfqMentalizing = normalizePsychometricTo10(p.rfqScore, 1, 7);

  const checkTension = (id: string, psych: number | null, interview: number | null, psychLabel: string, interviewLabel: string) => {
    if (psych === null || interview === null || detected.some((c) => c.id === id)) return;
    // Tension defined as opposite sides of neutral (5.5) with gap > 2
    const inTension = (psych > 5.5 && interview < 5.5 && psych - interview > 2) ||
                     (psych < 5.5 && interview > 5.5 && interview - psych > 2);
    if (inTension) {
      detected.push({ id, paragraph: conflictParagraph(psychLabel, interviewLabel) });
    }
  };

  checkTension('aaq2_regulation_tension', aaq2Flexibility, pillars.regulation, 'experiential avoidance or difficulty staying with painful emotions', 'emotional regulation in the interview');
  checkTension('gasp_accountability_tension', gaspAccountability, pillars.accountability, 'harm-response patterns on questionnaires', 'accountability and ownership in the interview');
  checkTension('brs_regulation_tension', brsRegulation, pillars.regulation, 'stress sensitivity or slower recovery on questionnaires', 'emotional regulation in the interview');
  checkTension('rses_accountability_tension', rsesAccountability, pillars.accountability, 'self-doubt or lower self-worth on questionnaires', 'accountability and ownership in the interview');
  checkTension('scs_accountability_tension', scsAccountability, pillars.accountability, 'self-criticism or limited self-compassion on questionnaires', 'accountability and repair in the interview');
  checkTension('dweck_commitment_tension', dweckCommitment, pillars.commitment_threshold, 'fixed-leaning responses to change on questionnaires', 'persistence through difficulty in the interview');
  checkTension('rfq_mentalizing_tension', rfqMentalizing, pillars.mentalizing, 'reflective depth on questionnaires', 'perspective-taking in the interview');

  // Add conflict for gaming correction applied
  const gamingCorrection = data.attempt?.gamingCorrection;
  if (gamingCorrection && gamingCorrection.correctionLevel > 0) {
    detected.push({
      id: 'gaming_correction_applied',
      paragraph: conflictParagraph(
        'inconsistent response patterns on questionnaires',
        'more consistent patterns in the interview',
      ),
    });
  }

  // Add conflict for psychometric floor breaches (auto-fail thresholds)
  const gateFailReasons = data.attempt?.gateFailReasons ?? [];
  const floorCodes = [
    'rfq_low_reflective_functioning_floor',
    'gasp_extreme_externalization_floor',
    'dweck_extreme_fixed_mindset_floor',
    'scs_sf_low_self_compassion_floor',
    'brs_low_resilience_floor',
    'anxiety_trait_high_floor',
    'aaq2_high_experiential_avoidance_floor',
    'rses_low_self_esteem_floor',
    'sd3_narcissism_floor',
    'npi_entitlement_floor',
  ];
  const triggeredFloor = gateFailReasons.find((r) => floorCodes.includes(r));
  if (triggeredFloor) {
    detected.push({
      id: 'psychometric_floor_breach',
      paragraph: conflictParagraph(
        'extreme scores on self-report questionnaires that triggered automatic review thresholds',
        'more moderate patterns in the interview',
      ),
    });
  }

  if (detected.length === 0) return [];

  const seen = new Set<string>();
  return detected.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

export function buildWhereEvidenceWasMixedSection(conflicts: EvidenceConflict[]): string {
  if (conflicts.length === 0) return '';
  const body = conflicts.map((c) => c.paragraph).join('\n\n');
  return `## ${REPORT_EVIDENCE_MIXED_HEADING}\n\n${body}`;
}

export function buildConfidenceLimitationsSection(): string {
  return `## ${REPORT_CONFIDENCE_LIMITATIONS_HEADING}\n\n${REPORT_CONFIDENCE_LIMITATIONS_BODY}`;
}

function sectionPresent(markdown: string, heading: string): boolean {
  return new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'im').test(markdown);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function insertBeforeHeading(markdown: string, targetHeading: string, block: string): string | null {
  const re = new RegExp(`^##\\s+${escapeRegExp(targetHeading)}\\s*$`, 'im');
  const match = re.exec(markdown);
  if (match == null || match.index < 0) return null;
  return `${markdown.slice(0, match.index).trim()}\n\n${block}\n\n${markdown.slice(match.index).trim()}`;
}

export function insertTemplatedReportSections(
  markdown: string,
  conflicts: EvidenceConflict[],
): string {
  let result = markdown.trim();
  const mixed = buildWhereEvidenceWasMixedSection(conflicts);
  const confidence = buildConfidenceLimitationsSection();

  if (mixed && !sectionPresent(result, REPORT_EVIDENCE_MIXED_HEADING)) {
    const withPracticalAnchor = insertBeforeHeading(result, 'Practical Steps Forward', mixed);
    if (withPracticalAnchor) {
      result = withPracticalAnchor;
    } else {
      const withClosingAnchor = insertBeforeHeading(result, 'Closing', mixed);
      result = withClosingAnchor ?? `${result}\n\n${mixed}`;
    }
  }

  if (!sectionPresent(result, REPORT_CONFIDENCE_LIMITATIONS_HEADING)) {
    const withClosingAnchor = insertBeforeHeading(result, 'Closing', confidence);
    result = withClosingAnchor ?? `${result}\n\n${confidence}`;
  }

  return result.trim();
}

/**
 * Pass/fail is disclosed in PostInterviewPassed/Failed screens — not repeated in the PDF narrative.
 * Gate-aware tone calibration in the prompt handles developmental framing when the bar was not cleared.
 */
export function finalizeUserFacingReportMarkdown(
  markdown: string,
  data: ReportData,
): string {
  const conflicts = detectEvidenceConflicts(data);
  return insertTemplatedReportSections(markdown, conflicts);
}

export function finalizeUserFacingPartialReportMarkdown(markdown: string): string {
  return insertTemplatedReportSections(markdown, []);
}

export function getReportTransparencyPromptInstructions(conflicts: EvidenceConflict[]): string {
  if (conflicts.length === 0) {
    return `PASS/FAIL DISCLOSURE: Do NOT state pass/fail status in the report — users see outcome separately in the app. Frame results as developmental feedback when interview performance was mixed or below the bar; avoid uniformly encouraging tone that contradicts that context.

THIRD-PARTY PRIVACY (MANDATORY): Do not use real names of other people from the user's personal stories in the report. Refer to them generically (e.g., "a friend," "someone close to you," "a former partner") — never transcript names.`;
  }
  return `EVIDENCE MIXED (MANDATORY): Interview and questionnaire sources disagreed on: ${conflicts.map((c) => c.id).join(', ')}. A templated "## ${REPORT_EVIDENCE_MIXED_HEADING}" section will be appended automatically — do NOT duplicate it, but ensure the rest of the narrative does not state contradictory conclusions as settled facts.
PASS/FAIL DISCLOSURE: Do NOT state pass/fail status in the report — users see outcome separately in the app.

THIRD-PARTY PRIVACY (MANDATORY): Do not use real names of other people from the user's personal stories in the report. Refer to them generically (e.g., "a friend," "someone close to you," "a former partner") — never transcript names.`;
}
