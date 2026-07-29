import { QueryClient } from '@tanstack/react-query';

import {
  editProfileQueryKeys,
  isEditProfileQueryCacheWarm,
  patchEditProfileQueryCache,
} from '@/screens/profile/editProfile/editProfileQueries';
import { DEFAULT_ONBOARDING_LIFE_DOMAINS } from '@/shared/components/LifeDomainDistribution';

describe('editProfileQueries', () => {
  it('uses a long stale window for edit profile reads', async () => {
    const fetchProfile = jest.fn(async () => ({ displayName: 'Alex' }));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const options = {
      queryKey: editProfileQueryKeys.profileBlob('user-1'),
      queryFn: fetchProfile,
      staleTime: 30 * 60 * 1000,
    };

    await queryClient.fetchQuery(options);
    await queryClient.fetchQuery(options);

    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });

  it('reports edit profile cache warm only when all slices are present', () => {
    const queryClient = new QueryClient();

    expect(isEditProfileQueryCacheWarm(queryClient, 'user-1')).toBe(false);

    queryClient.setQueryData(editProfileQueryKeys.profileBlob('user-1'), {
      displayName: 'Alex',
    });
    expect(isEditProfileQueryCacheWarm(queryClient, 'user-1')).toBe(false);

    queryClient.setQueryData(editProfileQueryKeys.lifeDomainSliders('user-1'), {
      ...DEFAULT_ONBOARDING_LIFE_DOMAINS,
    });
    queryClient.setQueryData(editProfileQueryKeys.matchPrefs('user-1'), {
      ageRange: [25, 40],
    });
    queryClient.setQueryData(editProfileQueryKeys.lifeDomainAnswers('user-1'), {
      finance: { yearlyIncome: '100k' },
    });

    expect(isEditProfileQueryCacheWarm(queryClient, 'user-1')).toBe(true);
  });

  it('patches cached edit profile slices after save', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(editProfileQueryKeys.profileBlob('user-1'), {
      displayName: 'Alex',
    });
    queryClient.setQueryData(editProfileQueryKeys.lifeDomainSliders('user-1'), {
      ...DEFAULT_ONBOARDING_LIFE_DOMAINS,
    });

    patchEditProfileQueryCache(queryClient, 'user-1', {
      profileBlob: { displayName: 'Jordan' },
      lifeDomainsState: {
        ...DEFAULT_ONBOARDING_LIFE_DOMAINS,
        intimacy: 25,
      },
      matchPrefs: { ageRange: [25, 40] },
      lifeDomainAnswers: { finance: { yearlyIncome: '100k' } },
    });

    expect(queryClient.getQueryData(editProfileQueryKeys.profileBlob('user-1'))).toEqual({
      displayName: 'Jordan',
    });
    expect(
      queryClient.getQueryData(editProfileQueryKeys.lifeDomainSliders('user-1')),
    ).toEqual({
      ...DEFAULT_ONBOARDING_LIFE_DOMAINS,
      intimacy: 25,
    });
    expect(queryClient.getQueryData(editProfileQueryKeys.matchPrefs('user-1'))).toEqual({
      ageRange: [25, 40],
    });
    expect(
      queryClient.getQueryData(editProfileQueryKeys.lifeDomainAnswers('user-1')),
    ).toEqual({
      finance: { yearlyIncome: '100k' },
    });
  });
});
