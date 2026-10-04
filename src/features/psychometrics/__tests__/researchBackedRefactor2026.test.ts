import { describe, expect, it } from '@jest/globals';

import {
  AMORAEA_ENTITLEMENT_ASSESSMENT_VERSION,
  COMPATIBILITY_ALGORITHM_VERSION,
  COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  CONFLICT_CATASTROPHIZING_ASSESSMENT_VERSION,
  INTERVIEW_GATE_WEIGHTS_VERSION,
  PILLAR_ROLLUP_ALGORITHM_VERSION_CURRENT,
  PSYCHOMETRIC_BATTERY_VERSION,
  RELATIONSHIP_GROWTH_BELIEFS_ASSESSMENT_VERSION,
  REPAIR_SOURCE_SIGNALS_VERSION,
} from '@config/algorithmVersions';
import {
  COMPATIBILITY_EVIDENCE_RULES,
  experimentalInstrumentRegistryEntries,
} from '@config/matching/compatibilityEvidenceRegistry';
import { GATE_MARKER_BASE_WEIGHTS } from '@config/scoring/interviewGateThresholds';
import { MENTALIZING_EARLY_REVIEW_TODO } from '@config/scoring/experimentalInterviewSlices';
import { REPAIR_SOURCE_VALIDATION_NO_AUTOCHANGE_TODO } from '@config/scoring/repairSourceSignals';
import { INTERVIEW_CANONICAL_PROBES } from '@features/aria/interviewCanonicalProbeRegistry';
import {
  aggregateMarkerScoresFromSlices,
  aggregatePillarScoresWithCommitmentMergeDetailed,
} from '@features/aria/aggregateMarkerScoresFromSlices';
import {
  MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
  MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT,
  MOMENT_SUPPORT_QUESTION_TEXT,
} from '@features/aria/moment4ProbeLogic';
import { resolvePendingPersonalMomentProbe } from '@features/aria/resolvePendingPersonalMomentProbe';
import { evaluateExperimentalSlicePairCorrelations } from '@features/admin/experimentalSliceCorrelationAnalytics';
import { evaluateRepairSourceValidation } from '@features/admin/repairSourceValidationAnalytics';
import {
  computeAnxiousAvoidantSoftPenalty,
  computeDealbreakerMultiplier,
  hobbyDealbreakerHardBlock,
} from '@features/compatibility/computeCompatibilityScore';
import { computePairCompatibilityScore } from '@features/compatibility/computePairCompatibilityScore';
import { COMPATIBILITY_OVERALL_PERCENT_TEMPORARY_FLAG } from '@features/compatibility/compatibilityDomainPresentation';
import { MATCH_OUTCOME_NO_AUTOTRAIN_TODO, MATCH_OUTCOME_STAGES } from '@features/compatibility/matchOutcomeInstrumentation';
import { ASSESSMENT_ORDER, ASSESSMENTS, scoreAssessment } from '@features/psychometrics/assessmentContent';
import {
  wouldTriggerAaq2HighExperientialAvoidanceFloor,
  wouldTriggerDweckExtremeFixedMindsetFloor,
  wouldTriggerRfqLowReflectiveFunctioningFloor,
  collectPsychometricFloorGateFailReasons,
} from '@features/psychometrics/psychometricFloorBreaches';
import { wouldTriggerNpiEntitlementFloor } from '@features/psychometrics/npiEntitlementFloor';

describe('research-backed refactor — psychometrics', () => {
  it('drops AAQ-II, RFQ-8, NPI, and combined Dweck from the active battery', () => {
    expect(ASSESSMENT_ORDER).not.toContain('aaq2');
    expect(ASSESSMENT_ORDER).not.toContain('rfq');
    expect(ASSESSMENT_ORDER).not.toContain('npi_entitlement');
    expect(ASSESSMENT_ORDER).not.toContain('dweck');
    expect(ASSESSMENTS.aaq2).toBeDefined();
    expect(ASSESSMENTS.rfq).toBeDefined();
    expect(ASSESSMENTS.npi_entitlement).toBeDefined();
    expect(ASSESSMENTS.dweck).toBeDefined();
  });

  it('scores amoraea_entitlement_v1 with reverse items 5 and 7 and no auto-fail', () => {
    const allFours = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, 4]));
    expect(scoreAssessment('amoraea_entitlement_v1', allFours).total).toBe(4);
    const reverseCheck: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 7, 6: 1, 7: 7, 8: 1 };
    expect(scoreAssessment('amoraea_entitlement_v1', reverseCheck).total).toBe(1);
    expect(ASSESSMENTS.amoraea_entitlement_v1.confidence).toBe('experimental');
    expect(ASSESSMENTS.amoraea_entitlement_v1.amoraeaValidationStatus).toBe('not_validated');
    expect(ASSESSMENTS.amoraea_entitlement_v1.assessmentVersion).toBe(AMORAEA_ENTITLEMENT_ASSESSMENT_VERSION);
    expect(collectPsychometricFloorGateFailReasons({
      rfqScore: null,
      gaspScore: null,
      gaspGuiltRepairScore: null,
      gaspShameWithdrawScore: null,
      dweckScore: null,
      scsSfScore: null,
      sd3NarcissismScore: null,
      npiEntitlementScore: 7,
      brsScore: null,
      anxietyTraitScore: null,
      aaq2Score: null,
      rsesScore: null,
      scsPublicScore: null,
      scsPrivateScore: null,
    }, [])).not.toContain('npi_entitlement_floor');
  });

  it('reverse-scores destiny items 1–3 on relationship_growth_beliefs separately from conflict_catastrophizing', () => {
    const growth: Record<number, number> = { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6 };
    expect(scoreAssessment('relationship_growth_beliefs', growth).total).toBe(3.5);
    const growthLeaning: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 6, 5: 6, 6: 6 };
    expect(scoreAssessment('relationship_growth_beliefs', growthLeaning).total).toBe(6);
    const cc: Record<number, number> = { 7: 6, 8: 6, 9: 6, 10: 6 };
    expect(scoreAssessment('conflict_catastrophizing', cc).total).toBe(6);
    const historicalDweck = scoreAssessment('dweck', {
      1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 2, 8: 2, 9: 2, 10: 2,
    });
    expect(historicalDweck.rbi_disagreement).toBe(5);
    expect(scoreAssessment('conflict_catastrophizing', { 7: 2, 8: 2, 9: 2, 10: 2 }).total).not.toBe(
      historicalDweck.rbi_disagreement,
    );
    expect(ASSESSMENTS.relationship_growth_beliefs.assessmentVersion).toBe(RELATIONSHIP_GROWTH_BELIEFS_ASSESSMENT_VERSION);
    expect(ASSESSMENTS.conflict_catastrophizing.assessmentVersion).toBe(CONFLICT_CATASTROPHIZING_ASSESSMENT_VERSION);
    expect(wouldTriggerDweckExtremeFixedMindsetFloor(1.0)).toBe(true);
    expect(collectPsychometricFloorGateFailReasons({
      rfqScore: null, gaspScore: null, gaspGuiltRepairScore: null, gaspShameWithdrawScore: null,
      dweckScore: 1, scsSfScore: null, sd3NarcissismScore: null, npiEntitlementScore: null,
      brsScore: null, anxietyTraitScore: null, aaq2Score: null, rsesScore: null,
      scsPublicScore: null, scsPrivateScore: null,
    }, [])).toEqual([]);
  });

  it('keeps historical AAQ/RFQ/NPI floor detectors readable without applying them to new-user collection', () => {
    expect(wouldTriggerAaq2HighExperientialAvoidanceFloor(40)).toBe(true);
    expect(wouldTriggerRfqLowReflectiveFunctioningFloor(1.5)).toBe(true);
    expect(wouldTriggerNpiEntitlementFloor(6)).toBe(false);
    expect(collectPsychometricFloorGateFailReasons({
      rfqScore: 1.5, gaspScore: null, gaspGuiltRepairScore: null, gaspShameWithdrawScore: null,
      dweckScore: 1, scsSfScore: null, sd3NarcissismScore: null, npiEntitlementScore: 6,
      brsScore: null, anxietyTraitScore: null, aaq2Score: 40, rsesScore: null,
      scsPublicScore: null, scsPrivateScore: null,
    }, [])).toEqual([]);
  });
});

describe('research-backed refactor — interview', () => {
  it('keeps S1 repair active, retires S2 and S3 repair probes', () => {
    expect(INTERVIEW_CANONICAL_PROBES.s1_repair.retired).toBeUndefined();
    expect(INTERVIEW_CANONICAL_PROBES.s1_repair.verbatimText).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(INTERVIEW_CANONICAL_PROBES.s2_james_repair.retired).toBe(true);
    expect(INTERVIEW_CANONICAL_PROBES.s3_repair.retired).toBe(true);
  });

  it('persists distinguishable repair sources without changing the Repair pillar average', () => {
    const agg = aggregatePillarScoresWithCommitmentMergeDetailed([
      { pillarScores: { repair: 8 }, keyEvidence: { repair: 'S1 spontaneous' } },
      { pillarScores: { repair: 4 }, keyEvidence: { repair: 'S2 spontaneous' } },
      { pillarScores: { repair: 9 }, keyEvidence: { repair: 'S3 hypothetical' } },
      { pillarScores: {}, keyEvidence: {} },
      { pillarScores: { repair: 3 }, keyEvidence: { repair: 'M5 autobiographical' } },
      { pillarScores: {}, keyEvidence: {} },
    ]);
    expect(agg.scores.repair).toBe(6);
    expect(agg.repairSourceSignals.version).toBe('repair_sources_v3_s1_hypothetical_2026_09');
    expect(agg.repairSourceSignals.hypothetical_repair).toBe(8);
    expect(agg.repairSourceSignals.autobiographical_repair).toBe(3);
    expect(agg.repairSourceSignals.spontaneous_repair).toBe(7);
    expect(agg.repairSourceSignals.hypothetical_minus_autobiographical).toBe(5);
    const report = evaluateRepairSourceValidation({
      attempts: [
        {
          userId: 'u1',
          hypothetical: 8,
          autobiographical: 3,
          spontaneous: 7,
          pillarRepair: 6,
          gapHypoMinusAuto: 5,
        },
      ],
    });
    expect(report.agreement.reviewFlag).toBe(false);
    expect(REPAIR_SOURCE_VALIDATION_NO_AUTOCHANGE_TODO).toMatch(/Do not automatically change the Repair pillar/);
  });

  it('registers support and commitment-orientation probes', () => {
    expect(INTERVIEW_CANONICAL_PROBES.m4_commitment_orientation.verbatimText).toBe(
      MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
    );
    expect(INTERVIEW_CANONICAL_PROBES.m_support.verbatimText).toBe(MOMENT_SUPPORT_QUESTION_TEXT);
    expect(INTERVIEW_CANONICAL_PROBES.m_support_need_recognition.verbatimText).toBe(
      MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT,
    );
    expect(INTERVIEW_CANONICAL_PROBES.m4_commitment_threshold.construct).toBe('persistence_exit_judgment');
  });

  it('advances to support after the walk-away threshold probe', () => {
    const pending = resolvePendingPersonalMomentProbe({
      snapshot: {
        currentInterviewMoment: 4,
        currentScenario: 3,
        lastAssistantContent: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
        lastQuestionText: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
        userText: 'When trust is broken repeatedly I walk away — there is a point where I stop trying to fix it.',
        transcriptTurnCount: 6,
      },
      messages: [
        { role: 'assistant', content: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT, interviewMoment: 4 },
        {
          role: 'user',
          content: 'When trust is broken repeatedly I walk away — there is a point where I stop trying to fix it.',
          interviewMoment: 4,
        },
      ],
      lastAssistantContent: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
    });
    expect(pending).toBe('m_support');
  });

  it('uses regulation evidence from S1, S3, M4, M5, and the support moment', () => {
    const scores = aggregateMarkerScoresFromSlices([
      { pillarScores: { regulation: 4 }, keyEvidence: { regulation: 'S1 stayed composed' } },
      { pillarScores: {}, keyEvidence: {} },
      { pillarScores: { regulation: 8 }, keyEvidence: { regulation: 'S3 recovered' } },
      { pillarScores: { regulation: 6 }, keyEvidence: { regulation: 'M4 described cooling down' } },
      { pillarScores: { regulation: 6 }, keyEvidence: { regulation: 'M5 paused before answering' } },
      { pillarScores: { regulation: 8 }, keyEvidence: { regulation: 'Support moment stayed present' } },
    ]);
    expect(scores.regulation).toBe(6);
  });

  it('merges commitment slices into one pillar while persisting both', () => {
    const scores = aggregatePillarScoresWithCommitmentMergeDetailed([
      { pillarScores: {}, keyEvidence: {} },
      { pillarScores: {}, keyEvidence: {} },
      { pillarScores: {}, keyEvidence: {} },
      {
        pillarScores: { persistence_exit_judgment: 8, commitment_orientation: 6, commitment_threshold: 8 },
        keyEvidence: {
          persistence_exit_judgment: 'walk-away criteria',
          commitment_orientation: 'kept investing because we still respected each other',
        },
      },
      { pillarScores: {}, keyEvidence: {} },
      { pillarScores: {}, keyEvidence: {} },
    ]);
    expect(scores.scores.commitment_persistence).toBe(7);
    expect(scores.scores.commitment_threshold).toBe(7);
  });

  it('gate weights sum to 1.00', () => {
    const sum = Object.values(GATE_MARKER_BASE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });
});

describe('research-backed refactor — compatibility', () => {
  it('reuses hobby dealbreaker answers: none does not block, required missing hobby does', () => {
    const flexible = {
      hobbyDealbreakerId: '__none__',
      hobbies: 'hiking',
    };
    const required = {
      hobbyDealbreakerId: 'hiking',
      hobbies: 'hiking',
    };
    const noHiking = { hobbies: 'reading', hobbyDealbreakerId: null };
    expect(hobbyDealbreakerHardBlock(flexible, noHiking)).toBe(false);
    expect(hobbyDealbreakerHardBlock(required, noHiking)).toBe(true);
    expect(computeDealbreakerMultiplier(required, noHiking)).toBe(0);
    expect(computeDealbreakerMultiplier(flexible, noHiking)).toBe(1);
  });

  it('anxious×avoidant is a small soft penalty and never a hard block', () => {
    const penalty = computeAnxiousAvoidantSoftPenalty(
      { anxiety: 6.5, avoidance: 1.5 },
      { anxiety: 1.5, avoidance: 6.5 },
    );
    expect(penalty).toBeLessThan(0);
    expect(penalty).toBeGreaterThanOrEqual(-0.05);
    expect(
      computeDealbreakerMultiplier(
        { wantKids: 'Want kids' },
        { wantKids: 'Want kids' },
      ),
    ).toBe(1);
  });

  it('generic ECR/PVQ similarity cannot dominate ranking versus life-domain scores', () => {
    const pair = computePairCompatibilityScore(
      {
        userId: 'a',
        dealbreaker: {},
        relationalCapacity: {
          repair: 8, regulation: 8, contempt: 2, accountability: 8, mentalizing: 8,
          gaspExternalizationScore: null, scsSfScore: null, brsScore: null,
          anxietyTraitScore: null,
        },
        attachment: { anxiety: 1.2, avoidance: 1.2 },
        values: {
          self_direction: 7, stimulation: 7, hedonism: 7, achievement: 7, power: 7,
          security: 7, conformity: 7, tradition: 7, benevolence: 7, universalism: 7,
        },
        finance: { financesPooled: null, financialRiskComfort: null, yearlyIncome: null },
        lifeDomainSettings: { intimacy: 10, finance: 10, spirituality: 10, family: 60, physicalHealth: 10 },
        interviewProcess: { repair: 8, accountability: 8, contempt: 2 },
        interviewWeightedScore: 8,
        conflictStyle: {
          competing: 100, collaborating: 0, compromising: 0, avoiding: 0, accommodating: 0,
        },
        politics: { politics: null },
        psychometricSoft: { npiEntitlementScore: null, dweckScore: null, scsSfScore: null },
        sexualCommunicationMean: null,
      },
      {
        userId: 'b',
        dealbreaker: {},
        relationalCapacity: {
          repair: 8, regulation: 8, contempt: 2, accountability: 8, mentalizing: 8,
          gaspExternalizationScore: null, scsSfScore: null, brsScore: null,
          anxietyTraitScore: null,
        },
        attachment: { anxiety: 1.3, avoidance: 1.1 },
        values: {
          self_direction: 7, stimulation: 7, hedonism: 7, achievement: 7, power: 7,
          security: 7, conformity: 7, tradition: 7, benevolence: 7, universalism: 7,
        },
        finance: { financesPooled: null, financialRiskComfort: null, yearlyIncome: null },
        lifeDomainSettings: { intimacy: 60, finance: 10, spirituality: 10, family: 10, physicalHealth: 10 },
        interviewProcess: { repair: 8, accountability: 8, contempt: 2 },
        interviewWeightedScore: 8,
        conflictStyle: {
          competing: 100, collaborating: 0, compromising: 0, avoiding: 0, accommodating: 0,
        },
        politics: { politics: null },
        psychometricSoft: { npiEntitlementScore: null, dweckScore: null, scsSfScore: null },
        sexualCommunicationMean: null,
      },
    );
    expect(pair.breakdown.attachment + pair.breakdown.values).toBeLessThan(pair.breakdown.lifeDomain);
    expect(pair.domainViews.some((d) => d.id === 'life_vision')).toBe(true);
    expect(COMPATIBILITY_OVERALL_PERCENT_TEMPORARY_FLAG).toMatch(/temporarily/);
  });
});

describe('research-backed refactor — registry, analytics, versioning', () => {
  it('registers every active rule and marks experimental instruments experimental/not_validated', () => {
    expect(COMPATIBILITY_EVIDENCE_RULES.length).toBeGreaterThan(10);
    for (const rule of COMPATIBILITY_EVIDENCE_RULES) {
      expect(rule.ruleId).toBeTruthy();
      expect(rule.coefficientSource).not.toBe('amoraea_validated');
    }
    for (const experimental of experimentalInstrumentRegistryEntries()) {
      expect(experimental.confidence).toBe('experimental');
      expect(experimental.amoraeaValidationStatus).toBe('not_validated');
      expect(experimental.hardFilter).toBe(false);
    }
  });

  it('flags highly correlated experimental slices for review only', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      commitment_orientation: i,
      persistence_exit_judgment: i,
      need_recognition: 1,
      support_response: 8 - i,
      attunement: i,
      adaptability: 0,
    }));
    const observations = evaluateExperimentalSlicePairCorrelations(rows);
    const commitment = observations.find((o) => o.pairId === 'commitment_orientation_vs_persistence_exit_judgment');
    expect(commitment?.reviewFlag).toBe(true);
    expect(MENTALIZING_EARLY_REVIEW_TODO).toMatch(/Do not change the 7% weight automatically/);
    expect(MATCH_OUTCOME_STAGES).toContain('followup_12_month');
    expect(MATCH_OUTCOME_NO_AUTOTRAIN_TODO).toMatch(/Do not automatically train/);
  });

  it('stamps version identifiers for battery, rollup, gate, compatibility, and registry', () => {
    expect(PSYCHOMETRIC_BATTERY_VERSION).toBe(
      'pre_interview_v3_sexual_communication_comfort_2026_09',
    );
    expect(PILLAR_ROLLUP_ALGORITHM_VERSION_CURRENT).toMatch(/pillars_v6_s1_hypothetical_repair/);
    expect(REPAIR_SOURCE_SIGNALS_VERSION).toBe('repair_sources_v3_s1_hypothetical_2026_09');
    expect(INTERVIEW_GATE_WEIGHTS_VERSION).toMatch(/gate_weights_v4/);
    expect(COMPATIBILITY_ALGORITHM_VERSION).toMatch(/compat_v6/);
    expect(COMPATIBILITY_EVIDENCE_REGISTRY_VERSION).toMatch(/compat_evidence_v4/);
  });
});
