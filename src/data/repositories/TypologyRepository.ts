import { supabase } from '../supabase/client';
import { Typology, TypologyType, TypologyUpdate } from '@domain/models/Typology';

export class TypologyRepository {
  async getTypology(userId: string, typologyType: TypologyType): Promise<Typology | null> {
    const { data, error } = await supabase
      .from('typologies')
      .select('*')
      .eq('profile_id', userId)
      .eq('typology_type', typologyType)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch typology: ${error.message}`);
    if (!data) return null;

    return this.mapToTypology(data);
  }

  async upsertTypology(userId: string, typologyType: TypologyType, update: TypologyUpdate): Promise<Typology> {
    const { data: existing } = await supabase
      .from('typologies')
      .select('id')
      .eq('profile_id', userId)
      .eq('typology_type', typologyType)
      .maybeSingle();

    const updateData = {
      profile_id: userId,
      typology_type: typologyType,
      typology_data: update.typologyData,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('typologies')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update typology: ${error.message}`);
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from('typologies')
        .insert(updateData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create typology: ${error.message}`);
      }
      result = data;
    }

    return this.mapToTypology(result);
  }

  private mapToTypology(data: {
    id: string;
    profile_id: string;
    typology_type: string;
    typology_data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }): Typology {
    return {
      id: data.id,
      profileId: data.profile_id,
      typologyType: data.typology_type as TypologyType,
      typologyData: data.typology_data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

