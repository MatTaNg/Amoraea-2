import {
  mergeAdminCohortDemographicFields,
} from '@features/admin/interviewDashboard/fetchAdminCohortProfileDemographics';

describe('fetchAdminCohortProfileDemographics', () => {
  it('mergeAdminCohortDemographicFields prefers profile_json then onboarding draft', () => {
    expect(
      mergeAdminCohortDemographicFields(
        { gender: 'woman', age: 30 },
        { gender: 'man', dateOfBirth: '1990-01-01' },
      ),
    ).toEqual({
      gender: 'woman',
      age: 30,
      birthDate: '1990-01-01',
    });

    expect(
      mergeAdminCohortDemographicFields(null, { gender: 'non-binary', dateOfBirth: '1992-05-01' }),
    ).toEqual({
      gender: 'non-binary',
      birthDate: '1992-05-01',
    });
  });
});
