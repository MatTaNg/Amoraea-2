import {
  adminCohortAgeBucketForAge,
  computeAdminCohortDemographics,
  normalizeAdminCohortGender,
  resolveAdminCohortAgeFromUser,
  resolveAdminCohortGenderFromUser,
} from '@features/admin/interviewDashboard/adminCohortDemographics';

describe('adminCohortDemographics', () => {
  it('normalizes gender labels', () => {
    expect(normalizeAdminCohortGender('woman')).toBe('Woman');
    expect(normalizeAdminCohortGender('man')).toBe('Man');
    expect(normalizeAdminCohortGender('non-binary')).toBe('Non-binary');
    expect(normalizeAdminCohortGender('')).toBeNull();
  });

  it('prefers profile_json gender over basic_info', () => {
    expect(
      resolveAdminCohortGenderFromUser(
        { gender: 'man' },
        { gender: 'woman' },
      ),
    ).toBe('Woman');
  });

  it('resolves age from profile age, basic_info age, then birthDate', () => {
    expect(resolveAdminCohortAgeFromUser({ age: 29 }, { age: 31 })).toBe(31);
    expect(resolveAdminCohortAgeFromUser({ age: 29 }, null)).toBe(29);
    expect(
      resolveAdminCohortAgeFromUser(null, { birthDate: '1990-06-15' }),
    ).toBeGreaterThanOrEqual(35);
  });

  it('maps ages into buckets', () => {
    expect(adminCohortAgeBucketForAge(22)).toBe('18-24');
    expect(adminCohortAgeBucketForAge(27)).toBe('25-29');
    expect(adminCohortAgeBucketForAge(52)).toBe('50+');
  });

  it('computes gender and age distributions for a cohort', () => {
    const stats = computeAdminCohortDemographics(
      [
        { id: '1', basic_info: { gender: 'woman', age: 28 } },
        { id: '2', basic_info: { gender: 'man', age: 34 } },
        { id: '3', basic_info: { gender: 'non-binary', age: 41 } },
        { id: '4', basic_info: {} },
      ],
    );

    expect(stats.cohortSize).toBe(4);
    expect(stats.withGender).toBe(3);
    expect(stats.withAge).toBe(3);
    expect(stats.gender.find((g) => g.label === 'Woman')?.count).toBe(1);
    expect(stats.gender.find((g) => g.label === 'Unknown')?.count).toBe(1);
    expect(stats.ageBuckets.find((b) => b.label === '25-29')?.count).toBe(1);
    expect(stats.ageMean).toBe(34.3);
    expect(stats.ageMedian).toBe(34);
  });
});
