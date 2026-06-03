import { supabase } from '@data/supabase/client';
import type { ApplicationStatus, OnboardingStage } from '@domain/models/OnboardingGates';
import type { ProfilePromptAnswer } from '@domain/models/Profile';

/** Interview / application fields on `users` — not dating `profiles.profile_json`. */
export type UserInterviewApplicationPatch = {
  applicationStatus?: ApplicationStatus;
  onboardingStage?: OnboardingStage;
  name?: string | null;
  prompts?: ProfilePromptAnswer[];
  basicInfo?: Record<string, unknown> | null;
};

function mapApplicationPatch(patch: UserInterviewApplicationPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.applicationStatus !== undefined) row.application_status = patch.applicationStatus;
  if (patch.onboardingStage !== undefined) row.onboarding_stage = patch.onboardingStage;
  if (patch.name !== undefined) {
    row.name = patch.name;
    if (patch.name != null && String(patch.name).trim()) {
      row.display_name = String(patch.name).trim();
    }
  }
  if (patch.prompts !== undefined) row.profile_prompts = patch.prompts;
  if (patch.basicInfo !== undefined) row.basic_info = patch.basicInfo;
  return row;
}

/** Narrow `users` update for interview flow — avoids touching legacy demographic columns. */
export async function updateUserInterviewApplication(
  userId: string,
  patch: UserInterviewApplicationPatch,
): Promise<void> {
  const payload = mapApplicationPatch(patch);
  if (Object.keys(payload).length <= 1) return;
  const { error } = await supabase.from('users').update(payload).eq('id', userId);
  if (error) throw new Error(`Failed to update user application fields: ${error.message}`);
}
