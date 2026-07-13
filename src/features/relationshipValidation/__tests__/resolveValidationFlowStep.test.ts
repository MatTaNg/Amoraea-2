import {
  resolveValidationFlowStep,
  resolveValidationFlowStepAfterPartnerSwitch,
} from '../relationshipValidationService';
import type { RelationshipValidationRecord } from '../relationshipValidationRepo';

jest.mock('../validationPsychometricsProgress', () => ({
  validationInstrumentsCompleted: jest.fn(),
}));

jest.mock('../relationshipValidationRepo', () => ({
  fetchRelationshipValidationRecord: jest.fn(),
  fetchValidationComparison: jest.fn(),
}));

import { validationInstrumentsCompleted } from '../validationPsychometricsProgress';
import {
  fetchRelationshipValidationRecord,
  fetchValidationComparison,
} from '../relationshipValidationRepo';

const mockValidationInstrumentsCompleted =
  validationInstrumentsCompleted as jest.MockedFunction<typeof validationInstrumentsCompleted>;
const mockFetchRelationshipValidationRecord =
  fetchRelationshipValidationRecord as jest.MockedFunction<typeof fetchRelationshipValidationRecord>;
const mockFetchValidationComparison = fetchValidationComparison as jest.MockedFunction<
  typeof fetchValidationComparison
>;

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
    relationship_test_mode: 'romantic',
    romantic_test_relationship_duration: null,
    platonic_test_past_relationship_ended: null,
    platonic_test_past_relationship_duration: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('resolveValidationFlowStep', () => {
  beforeEach(() => {
    mockValidationInstrumentsCompleted.mockResolvedValue({ complete: false, nextStep: 'ecr' });
  });

  it('returns welcome when welcome not completed', async () => {
    expect(
      await resolveValidationFlowStep('u1', baseRecord({ welcome_completed_at: null })),
    ).toBe('welcome');
  });

  it('returns partner_email when partner email missing', async () => {
    expect(
      await resolveValidationFlowStep('u1', baseRecord({ partner_email_entered: null })),
    ).toBe('partner_email');
  });

  it('returns relationship_test_mode when mode unset', async () => {
    expect(
      await resolveValidationFlowStep('u1', baseRecord({ relationship_test_mode: null })),
    ).toBe('relationship_test_mode');
  });

  it('returns pre_assessment when mode set but pre-assessment missing', async () => {
    expect(
      await resolveValidationFlowStep('u1', baseRecord({ pre_assessment: null })),
    ).toBe('pre_assessment');
  });

  it('returns psychometrics when instruments incomplete', async () => {
    expect(await resolveValidationFlowStep('u1', baseRecord())).toBe('psychometrics');
  });

  it('returns report when psychometrics complete', async () => {
    mockValidationInstrumentsCompleted.mockResolvedValue({ complete: true, nextStep: null });
    expect(await resolveValidationFlowStep('u1', baseRecord())).toBe('report');
  });
});

describe('resolveValidationFlowStepAfterPartnerSwitch', () => {
  beforeEach(() => {
    mockValidationInstrumentsCompleted.mockResolvedValue({ complete: true, nextStep: null });
    mockFetchValidationComparison.mockResolvedValue({
      id: 'c2',
      pre_assessment: baseRecord().pre_assessment,
    } as never);
    mockFetchRelationshipValidationRecord.mockResolvedValue(baseRecord());
  });

  it('returns partner_email when comparison missing', async () => {
    mockFetchValidationComparison.mockResolvedValue(null);
    expect(await resolveValidationFlowStepAfterPartnerSwitch('u1', 'c2')).toBe('partner_email');
  });

  it('returns relationship_test_mode when record mode unset', async () => {
    mockFetchRelationshipValidationRecord.mockResolvedValue(
      baseRecord({ relationship_test_mode: null }),
    );
    expect(await resolveValidationFlowStepAfterPartnerSwitch('u1', 'c2')).toBe(
      'relationship_test_mode',
    );
  });

  it('returns report when comparison pre-assessment and psychometrics are complete', async () => {
    expect(await resolveValidationFlowStepAfterPartnerSwitch('u1', 'c2')).toBe('report');
  });
});
