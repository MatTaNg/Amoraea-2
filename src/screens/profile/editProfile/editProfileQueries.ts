import { useQuery, type QueryClient } from '@tanstack/react-query';
import { profilesRepo } from '@/data/repos/profilesRepo';
import type { OnboardingLifeDomainValues } from '@/shared/components/LifeDomainDistribution';
import type { MatchPreferences } from '@/shared/hooks/filterPreferences/types';
import {
  fetchLifeDomainAnswersMap,
  resolveLifeDomainSlidersForEdit,
  type LifeDomainAnswersMap,
} from '@/screens/profile/editProfile/lifeDomainProfileService';
import { resolveMatchPreferencesForEdit } from '@/screens/profile/editProfile/matchPreferencesProfileService';

/** Keep edit-profile reads warm for the session; avoid refetch on every navigation. */
export const EDIT_PROFILE_QUERY_STALE_MS = 30 * 60 * 1000;

export const editProfileQueryOptions = {
  staleTime: EDIT_PROFILE_QUERY_STALE_MS,
  gcTime: 60 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const editProfileQueryKeys = {
  all: ['edit-profile'] as const,
  profileBlob: (userId: string) => ['dating-profile', userId] as const,
  lifeDomainSliders: (userId: string) =>
    [...editProfileQueryKeys.all, 'life-domain-sliders', userId] as const,
  matchPrefs: (userId: string) =>
    [...editProfileQueryKeys.all, 'match-prefs', userId] as const,
  lifeDomainAnswers: (userId: string) =>
    [...editProfileQueryKeys.all, 'life-domain-answers', userId] as const,
};

async function fetchEditProfileBlob(userId: string): Promise<Record<string, unknown>> {
  const r = await profilesRepo.getProfile(userId);
  if (!r.success) throw r.error;
  return r.data ?? {};
}

export function useEditProfileBlobQuery(userId: string) {
  return useQuery({
    queryKey: editProfileQueryKeys.profileBlob(userId),
    queryFn: () => fetchEditProfileBlob(userId),
    enabled: Boolean(userId),
    ...editProfileQueryOptions,
  });
}

export function useEditProfileLifeDomainSlidersQuery(
  userId: string,
  profileBlob: Record<string, unknown> | undefined,
) {
  return useQuery({
    queryKey: editProfileQueryKeys.lifeDomainSliders(userId),
    queryFn: () => resolveLifeDomainSlidersForEdit(userId, profileBlob ?? {}),
    enabled: Boolean(userId) && profileBlob != null,
    ...editProfileQueryOptions,
  });
}

export function useEditProfileMatchPrefsQuery(
  userId: string,
  profileBlob: Record<string, unknown> | undefined,
) {
  return useQuery({
    queryKey: editProfileQueryKeys.matchPrefs(userId),
    queryFn: () => resolveMatchPreferencesForEdit(userId, profileBlob ?? {}),
    enabled: Boolean(userId) && profileBlob != null,
    ...editProfileQueryOptions,
  });
}

export function useEditProfileLifeDomainAnswersQuery(userId: string) {
  return useQuery({
    queryKey: editProfileQueryKeys.lifeDomainAnswers(userId),
    queryFn: () => fetchLifeDomainAnswersMap(userId),
    enabled: Boolean(userId),
    ...editProfileQueryOptions,
  });
}

export type EditProfileQueryCachePatch = {
  profileBlob: Record<string, unknown>;
  lifeDomainsState?: OnboardingLifeDomainValues;
  matchPrefs?: MatchPreferences;
  lifeDomainAnswers?: LifeDomainAnswersMap;
};

/** Refresh cached edit-profile reads after a successful save (no network refetch). */
export function patchEditProfileQueryCache(
  qc: QueryClient,
  userId: string,
  patch: EditProfileQueryCachePatch,
): void {
  qc.setQueryData(editProfileQueryKeys.profileBlob(userId), patch.profileBlob);
  if (patch.lifeDomainsState) {
    qc.setQueryData(
      editProfileQueryKeys.lifeDomainSliders(userId),
      patch.lifeDomainsState,
    );
  }
  if (patch.matchPrefs) {
    qc.setQueryData(editProfileQueryKeys.matchPrefs(userId), patch.matchPrefs);
  }
  if (patch.lifeDomainAnswers) {
    qc.setQueryData(
      editProfileQueryKeys.lifeDomainAnswers(userId),
      patch.lifeDomainAnswers,
    );
  }
}

export function invalidateEditProfileQueries(qc: QueryClient, userId: string): void {
  void qc.invalidateQueries({ queryKey: editProfileQueryKeys.profileBlob(userId) });
  void qc.invalidateQueries({ queryKey: editProfileQueryKeys.lifeDomainSliders(userId) });
  void qc.invalidateQueries({ queryKey: editProfileQueryKeys.matchPrefs(userId) });
  void qc.invalidateQueries({ queryKey: editProfileQueryKeys.lifeDomainAnswers(userId) });
}

export function isEditProfileQueryCacheWarm(qc: QueryClient, userId: string): boolean {
  if (!userId) return false;
  const profileBlob = qc.getQueryData<Record<string, unknown>>(
    editProfileQueryKeys.profileBlob(userId),
  );
  if (profileBlob == null) return false;
  return (
    qc.getQueryData(editProfileQueryKeys.lifeDomainSliders(userId)) != null &&
    qc.getQueryData(editProfileQueryKeys.matchPrefs(userId)) != null &&
    qc.getQueryData(editProfileQueryKeys.lifeDomainAnswers(userId)) != null
  );
}

/** Warm edit-profile reads before navigation so the screen can hydrate from cache immediately. */
export async function prefetchEditProfileQueries(
  qc: QueryClient,
  userId: string,
): Promise<void> {
  if (!userId) return;

  await qc.prefetchQuery({
    queryKey: editProfileQueryKeys.profileBlob(userId),
    queryFn: () => fetchEditProfileBlob(userId),
    ...editProfileQueryOptions,
  });

  const profileBlob = qc.getQueryData<Record<string, unknown>>(
    editProfileQueryKeys.profileBlob(userId),
  );

  await Promise.all([
    qc.prefetchQuery({
      queryKey: editProfileQueryKeys.lifeDomainAnswers(userId),
      queryFn: () => fetchLifeDomainAnswersMap(userId),
      ...editProfileQueryOptions,
    }),
    profileBlob != null
      ? qc.prefetchQuery({
          queryKey: editProfileQueryKeys.lifeDomainSliders(userId),
          queryFn: () => resolveLifeDomainSlidersForEdit(userId, profileBlob),
          ...editProfileQueryOptions,
        })
      : Promise.resolve(),
    profileBlob != null
      ? qc.prefetchQuery({
          queryKey: editProfileQueryKeys.matchPrefs(userId),
          queryFn: () => resolveMatchPreferencesForEdit(userId, profileBlob),
          ...editProfileQueryOptions,
        })
      : Promise.resolve(),
  ]);
}
