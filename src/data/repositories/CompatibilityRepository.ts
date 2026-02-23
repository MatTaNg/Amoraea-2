import { supabase } from '../supabase/client';
import { Compatibility, CompatibilityUpdate } from '@domain/models/Compatibility';

export class CompatibilityRepository {
  async getCompatibility(userId: string): Promise<Compatibility | null> {
    const { data, error } = await supabase
      .from('compatibility')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch compatibility: ${error.message}`);
    if (!data) return null;

    return this.mapToCompatibility(data);
  }

  async upsertCompatibility(userId: string, update: CompatibilityUpdate): Promise<Compatibility> {
    const { data: existing } = await supabase
      .from('compatibility')
      .select('id')
      .eq('profile_id', userId)
      .maybeSingle();

    const updateData = {
      profile_id: userId,
      compatibility_data: update.compatibilityData,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('compatibility')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update compatibility: ${error.message}`);
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from('compatibility')
        .insert(updateData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create compatibility: ${error.message}`);
      }
      result = data;
    }

    return this.mapToCompatibility(result);
  }

  private mapToCompatibility(data: {
    id: string;
    profile_id: string;
    compatibility_data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }): Compatibility {
    return {
      id: data.id,
      profileId: data.profile_id,
      compatibilityData: data.compatibility_data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

