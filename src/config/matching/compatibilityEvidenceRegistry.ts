import { COMPATIBILITY_EVIDENCE_REGISTRY_VERSION, EXPERIMENTAL_INSTRUMENT_META } from '@config/algorithmVersions';

export type CompatibilityEvidenceLevel = 'A' | 'B' | 'C' | 'D' | 'E';

export type CompatibilityEvidenceBasis =
  | 'logical_incompatibility'
  | 'explicit_user_preference'
  | 'published_research'
  | 'theoretical_inference'
  | 'amoraea_observed';

export type CompatibilityCoefficientSource =
  | 'logical'
  | 'research_direction_only'
  | 'amoraea_heuristic'
  | 'amoraea_validated';

export type CompatibilityEvidenceRule = {
  ruleId: string;
  construct: string;
  description: string;
  evidenceLevel: CompatibilityEvidenceLevel;
  evidenceBasis: CompatibilityEvidenceBasis;
  sources?: string[];
  coefficient?: number;
  coefficientSource: CompatibilityCoefficientSource;
  confidence: 'high' | 'moderate' | 'low' | 'experimental';
  hardFilter: boolean;
  amoraeaValidationStatus: 'not_validated' | 'collecting_data' | 'validated' | 'rejected';
  /** Retired rules stay in the registry so the decision remains attributable. */
  lifecycle?: 'active' | 'retired';
  version: string;
};

function rule(partial: CompatibilityEvidenceRule): CompatibilityEvidenceRule {
  return partial;
}

/** Every active matching coefficient must have an entry here. */
export const COMPATIBILITY_EVIDENCE_RULES: CompatibilityEvidenceRule[] = [
  rule({
    ruleId: 'level_a_children_want_vs_dont',
    construct: 'kids',
    description: 'Want kids × definitely do not want kids is mutually exclusive when both answers are explicit.',
    evidenceLevel: 'A',
    evidenceBasis: 'logical_incompatibility',
    coefficient: 0,
    coefficientSource: 'logical',
    confidence: 'high',
    hardFilter: true,
    amoraeaValidationStatus: 'collecting_data',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_a_monogamy_vs_enm',
    construct: 'relationship_style',
    description: 'Required monogamy × required ENM/open/poly is mutually exclusive when both styles are explicit.',
    evidenceLevel: 'A',
    evidenceBasis: 'logical_incompatibility',
    coefficient: 0,
    coefficientSource: 'logical',
    confidence: 'high',
    hardFilter: true,
    amoraeaValidationStatus: 'collecting_data',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_a_required_religion',
    construct: 'religion',
    description:
      'Same-religion requirement uses partnerSameReligionRequired. Non-negotiable mismatch hard-blocks; very important / preference only affect ranking.',
    evidenceLevel: 'A',
    evidenceBasis: 'explicit_user_preference',
    coefficient: 0,
    coefficientSource: 'logical',
    confidence: 'high',
    hardFilter: true,
    amoraeaValidationStatus: 'collecting_data',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_a_required_politics',
    construct: 'politics',
    description:
      'Political-alignment requirement uses prefPartnerPoliticalAlignmentImportance. Non-negotiable mismatch hard-blocks; very important / preference only affect ranking.',
    evidenceLevel: 'A',
    evidenceBasis: 'explicit_user_preference',
    coefficient: 0,
    coefficientSource: 'logical',
    confidence: 'high',
    hardFilter: true,
    amoraeaValidationStatus: 'collecting_data',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_a_distance_no_relocate',
    construct: 'location',
    description: 'Neither will relocate and distance exceeds MAX_DISTANCE_KM.',
    evidenceLevel: 'A',
    evidenceBasis: 'explicit_user_preference',
    coefficient: 0,
    coefficientSource: 'logical',
    confidence: 'high',
    hardFilter: true,
    amoraeaValidationStatus: 'collecting_data',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_a_substance_comfort_no',
    construct: 'substances',
    description: 'Partner-substance comfort = No × partner uses that substance.',
    evidenceLevel: 'A',
    evidenceBasis: 'explicit_user_preference',
    coefficient: 0,
    coefficientSource: 'logical',
    confidence: 'high',
    hardFilter: true,
    amoraeaValidationStatus: 'collecting_data',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_a_hobby_dealbreaker',
    construct: 'hobbies',
    description:
      'Reuses onboarding hobbyDealbreakerId. If a selected hobby is a dealbreaker and the other person does not share it, hard-block. "__none__"/null does not block.',
    evidenceLevel: 'A',
    evidenceBasis: 'explicit_user_preference',
    coefficient: 0,
    coefficientSource: 'logical',
    confidence: 'high',
    hardFilter: true,
    amoraeaValidationStatus: 'collecting_data',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_b_concrete_life_fit',
    construct: 'concrete_life_fit',
    description:
      'Pairwise desired-life fit from existing onboarding/profile fields (children, relationship structure, location, religion/politics when not hard-blocked, lifestyle, conservative intimacy preferences). Hard-blocked dimensions are omitted so they are not scored twice. Finance raw fields are excluded.',
    evidenceLevel: 'B',
    evidenceBasis: 'explicit_user_preference',
    coefficient: 0.5,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'moderate',
    hardFilter: false,
    amoraeaValidationStatus: 'collecting_data',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_b_life_domain_alignment',
    construct: 'life_domains',
    description:
      'Abstract alignment of four 0–100 importance sliders (intimacy, spirituality, family, physical health). Not concrete desired-life compatibility. Finance has its own core weight.',
    evidenceLevel: 'B',
    evidenceBasis: 'explicit_user_preference',
    coefficient: 0.21,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'moderate',
    hardFilter: false,
    amoraeaValidationStatus: 'collecting_data',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_b_finance_outlook',
    construct: 'finance',
    description: 'Pooling / risk / income alignment from existing finance fields — scaled ranking, not a hard block unless a dealbreaker already applies.',
    evidenceLevel: 'B',
    evidenceBasis: 'explicit_user_preference',
    coefficient: 0.22,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'moderate',
    hardFilter: false,
    amoraeaValidationStatus: 'collecting_data',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_b_intimacy_sexual_communication',
    construct: 'intimacy',
    description:
      'Retired from compatibility scoring. Sexual communication comfort is an individual readiness signal, not a pairwise matching input, and there is no evidence base for compatibility-matching on this construct. Historical post-interview typology scores stay on psychometrics_sexual_communication_* and are not reinterpreted as the pre-interview instrument.',
    evidenceLevel: 'B',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'low',
    hardFilter: false,
    amoraeaValidationStatus: 'rejected',
    lifecycle: 'retired',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_c_anxious_avoidant_soft_penalty',
    construct: 'attachment_interaction',
    description:
      'High anxiety A × high avoidance B (and reverse) using continuous ECR scores. Soft ranking penalty only, cap −0.05. Direction is research-informed; magnitude is an Amoraea heuristic, not a research-derived coefficient. Never a hard block.',
    evidenceLevel: 'C',
    evidenceBasis: 'published_research',
    sources: ['ECR / attachment pairing literature (direction only)'],
    coefficient: -0.05,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'low',
    hardFilter: false,
    amoraeaValidationStatus: 'not_validated',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_d_values_conflict',
    construct: 'schwartz_values',
    description: 'Major PVQ/Schwartz conflicts or alignment — low initial influence, not a ranking driver.',
    evidenceLevel: 'D',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0.05,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'experimental',
    hardFilter: false,
    amoraeaValidationStatus: 'not_validated',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_d_conflict_style',
    construct: 'conflict_style',
    description: 'CONFLICT-30 style interactions. Low influence; conflict-style similarity alone cannot dominate ranking.',
    evidenceLevel: 'D',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0.05,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'experimental',
    hardFilter: false,
    amoraeaValidationStatus: 'not_validated',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_e_generic_ecr_similarity',
    construct: 'attachment_similarity',
    description: 'Global ECR similarity. Experimental / low influence — must not dominate ranking.',
    evidenceLevel: 'E',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0.02,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'experimental',
    hardFilter: false,
    amoraeaValidationStatus: 'not_validated',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_e_generic_pvq_similarity',
    construct: 'values_similarity',
    description: 'Global PVQ similarity. Experimental / low influence — must not dominate ranking.',
    evidenceLevel: 'E',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0.05,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'experimental',
    hardFilter: false,
    amoraeaValidationStatus: 'not_validated',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'level_b_narrative_fit',
    construct: 'narrative_fit',
    description:
      'Unavailable in production ranking. The LLM narrative-fit job is not wired. A constant 0.5 stub is not used as a ranking input. Schema/API may still expose not_assessed.',
    evidenceLevel: 'B',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'low',
    hardFilter: false,
    amoraeaValidationStatus: 'rejected',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'interview_process_pillars',
    construct: 'interview_process',
    description: 'Removed from ranking. Interview process is not a generic similarity cue among already-admitted users.',
    evidenceLevel: 'D',
    evidenceBasis: 'amoraea_observed',
    coefficient: 0,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'low',
    hardFilter: false,
    amoraeaValidationStatus: 'rejected',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'relational_capacity_discount',
    construct: 'relational_capacity',
    description: 'Removed. Generic capacity similarity/level is not used in ranking after admission.',
    evidenceLevel: 'E',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'experimental',
    hardFilter: false,
    amoraeaValidationStatus: 'rejected',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'interview_values_confidence_discount',
    construct: 'values_confidence',
    description: 'Removed. Interview score no longer multiplies PVQ/values similarity.',
    evidenceLevel: 'E',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'experimental',
    hardFilter: false,
    amoraeaValidationStatus: 'rejected',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'duplicate_contempt_penalty',
    construct: 'contempt',
    description: 'Removed extra generic contempt penalty from ranking. Contempt remains an interview-gate construct only.',
    evidenceLevel: 'E',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'experimental',
    hardFilter: false,
    amoraeaValidationStatus: 'rejected',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'amoraea_entitlement_v1',
    construct: 'amoraea_entitlement_v1',
    description:
      'Experimental Amoraea entitlement measure (not PES). Collected and versioned only — never a hard filter, auto-fail, gate modifier, or matching coefficient.',
    evidenceLevel: 'E',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0,
    coefficientSource: 'amoraea_heuristic',
    confidence: EXPERIMENTAL_INSTRUMENT_META.confidence,
    hardFilter: false,
    amoraeaValidationStatus: EXPERIMENTAL_INSTRUMENT_META.amoraeaValidationStatus,
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'relationship_growth_beliefs',
    construct: 'relationship_growth_beliefs',
    description:
      'Experimental Amoraea growth/destiny items (not Knee ITR). Collected and versioned only — never a hard filter, auto-fail, gate modifier, or matching coefficient.',
    evidenceLevel: 'E',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0,
    coefficientSource: 'amoraea_heuristic',
    confidence: EXPERIMENTAL_INSTRUMENT_META.confidence,
    hardFilter: false,
    amoraeaValidationStatus: EXPERIMENTAL_INSTRUMENT_META.amoraeaValidationStatus,
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'conflict_catastrophizing',
    construct: 'conflict_catastrophizing',
    description:
      'Experimental conflict-catastrophizing subscale split from historical Dweck items 7–10. Collected and versioned only — never a hard filter, auto-fail, gate modifier, or matching coefficient.',
    evidenceLevel: 'E',
    evidenceBasis: 'theoretical_inference',
    coefficient: 0,
    coefficientSource: 'amoraea_heuristic',
    confidence: EXPERIMENTAL_INSTRUMENT_META.confidence,
    hardFilter: false,
    amoraeaValidationStatus: EXPERIMENTAL_INSTRUMENT_META.amoraeaValidationStatus,
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
  rule({
    ruleId: 'psychometric_modifier_cap',
    construct: 'psychometric_modifier',
    description:
      'Overall lower bound (−0.35) on the summed live psychometric gate modifier (BRS, trait anxiety, SCS-SF, GASP, RSES). Amoraea heuristic to keep correlated self-report weaknesses from stacking into a second dominant gate. Not a research-derived coefficient. Hard floors still fail independently of this cap.',
    evidenceLevel: 'E',
    evidenceBasis: 'theoretical_inference',
    coefficient: -0.35,
    coefficientSource: 'amoraea_heuristic',
    confidence: 'low',
    hardFilter: false,
    amoraeaValidationStatus: 'not_validated',
    version: COMPATIBILITY_EVIDENCE_REGISTRY_VERSION,
  }),
];

export function getCompatibilityEvidenceRule(ruleId: string): CompatibilityEvidenceRule | undefined {
  return COMPATIBILITY_EVIDENCE_RULES.find((r) => r.ruleId === ruleId);
}

export function experimentalInstrumentRegistryEntries(): CompatibilityEvidenceRule[] {
  return COMPATIBILITY_EVIDENCE_RULES.filter((r) =>
    ['amoraea_entitlement_v1', 'relationship_growth_beliefs', 'conflict_catastrophizing'].includes(r.ruleId),
  );
}

export function assertEveryActiveRuleHasMetadata(): void {
  const missing = COMPATIBILITY_EVIDENCE_RULES.filter(
    (r) => !r.ruleId || !r.construct || !r.coefficientSource || !r.amoraeaValidationStatus,
  );
  if (missing.length > 0) {
    throw new Error(`Compatibility evidence registry incomplete: ${missing.map((r) => r.ruleId).join(', ')}`);
  }
}
