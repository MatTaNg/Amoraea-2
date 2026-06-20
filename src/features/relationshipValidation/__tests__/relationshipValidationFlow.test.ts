import {
  needsRelationshipTestModeStep,
  type ValidationFlowStep,
} from '../relationshipValidationService';
import type { RelationshipValidationRecord } from '../relationshipValidationRepo';

function baseRecord(
  overrides: Partial<RelationshipValidationRecord> = {},
): RelationshipValidationRecord {
  return {
    user_id: 'u1',
    active_comparison_id: 'c1',
    partner_email_entered: 'partner@example.com',
    partner_user_id: null,
    pair_confirmed_at: null,
    welcome_completed_at: '2026-01-01T00:00:00Z',
    pre_assessment: {
      duration: '1_2_years',
      overallCompatibility: 8,
      conflictHandling: 7,
      valuesAlignment: 8,
      emotionalAttunement: 7,
      consideredEnding: 'never',
      overallSatisfaction: 8,
    },
    post_assessment: null,
    psychometrics_completed_at: null,
    compatibility_score: null,
    compatibility_breakdown: null,
    profile_report_markdown: null,
    profile_report_source_hash: null,
    profile_report_generated_at: null,
    relationship_test_mode: null,
    romantic_test_relationship_duration: null,
    platonic_test_past_relationship_ended: null,
    platonic_test_past_relationship_duration: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('needsRelationshipTestModeStep', () => {
  it('requires branching when test mode unset', () => {
    expect(needsRelationshipTestModeStep(baseRecord())).toBe(true);
  });

  it('does not require branching when test mode set', () => {
    expect(needsRelationshipTestModeStep(baseRecord({ relationship_test_mode: 'romantic' }))).toBe(
      false,
    );
  });
});

describe('resolveValidationFlowStep ordering', () => {
  it('relationship_test_mode comes after partner_email and before pre_assessment', () => {
    const order: ValidationFlowStep[] = [
      'welcome',
      'partner_email',
      'relationship_test_mode',
      'pre_assessment',
      'psychometrics',
      'report',
    ];
    expect(order.indexOf('relationship_test_mode')).toBeGreaterThan(
      order.indexOf('partner_email'),
    );
    expect(order.indexOf('pre_assessment')).toBeGreaterThan(
      order.indexOf('relationship_test_mode'),
    );
    expect(order.indexOf('psychometrics')).toBeGreaterThan(order.indexOf('pre_assessment'));
  });
});
