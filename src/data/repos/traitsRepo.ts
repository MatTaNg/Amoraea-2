import { supabase } from '../supabase/client';
import type { Result } from '../../datingProfile/types';
import type { TraitScores } from '../../datingProfile/types';

export const traitsRepo = {
  async getTraitScores(userId: string): Promise<Result<TraitScores | null>> {
    try {
      const { data, error } = await supabase
        .from('user_traits')
        .select('scores')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) return { success: false, error: new Error(error.message) };
      const raw = data?.scores;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return { success: true, data: raw as TraitScores };
      }
      return { success: true, data: null };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  },

  async updateTraitScores(
    userId: string,
    partial: Partial<Omit<TraitScores, 'userId' | 'updatedAt'>>,
  ): Promise<Result<TraitScores>> {
    try {
      const prev = await this.getTraitScores(userId);
      const base =
        prev.success && prev.data && typeof prev.data === 'object'
          ? { ...prev.data }
          : ({} as TraitScores);
      const next: TraitScores = {
        ...base,
        ...partial,
        userId,
        updatedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from('user_traits').upsert(
        {
          user_id: userId,
          scores: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, data: next };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  },
};
