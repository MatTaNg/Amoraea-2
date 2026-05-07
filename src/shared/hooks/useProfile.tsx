import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { profilesRepo } from '@data/repos/profilesRepo';
import type { UserProfile } from '../../datingProfile/types';

export function useProfile(): {
  profile: UserProfile | null | undefined;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Record<string, unknown>) => Promise<boolean>;
} {
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['dating-profile', uid],
    queryFn: async () => {
      const r = await profilesRepo.getProfile(uid);
      if (!r.success) throw r.error;
      return r.data ?? null;
    },
    enabled: !!uid,
  });
  return {
    profile: q.data,
    loading: q.isPending,
    refreshProfile: async () => {
      await qc.invalidateQueries({ queryKey: ['dating-profile', uid] });
    },
    updateProfile: async (patch: Record<string, unknown>) => {
      const r = await profilesRepo.updateProfile(uid, patch);
      await qc.invalidateQueries({ queryKey: ['dating-profile', uid] });
      return r.success;
    },
  };
}
