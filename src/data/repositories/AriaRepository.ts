import { supabase } from '../supabase/client';
import type { AriaSession, AriaAnswerRecord } from '@domain/models/AriaSession';

export class AriaRepository {
  async createSession(profileId: string, answers: AriaAnswerRecord[]): Promise<AriaSession> {
    const { data, error } = await supabase
      .from('aria_sessions')
      .insert({
        profile_id: profileId,
        answers,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create Aria session: ${error.message}`);
    return this.mapToSession(data);
  }

  async getLatestSession(profileId: string): Promise<AriaSession | null> {
    const { data, error } = await supabase
      .from('aria_sessions')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch Aria session: ${error.message}`);
    if (!data) return null;
    return this.mapToSession(data);
  }

  private mapToSession(data: {
    id: string;
    profile_id: string;
    answers: AriaAnswerRecord[];
    created_at: string;
    updated_at: string;
  }): AriaSession {
    return {
      id: data.id,
      profileId: data.profile_id,
      answers: data.answers ?? [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
