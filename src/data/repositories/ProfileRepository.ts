import { applyProfileUpdate, loadEditProfileSnapshot } from '@data/repos/editProfileRepo';
import { profilesRepo } from '@data/repos/profilesRepo';
import { updateUserOnboardingFlags } from '@data/repos/usersRoutingRepo';
import { supabase } from '../supabase/client';
import { PROFILE_PHOTO_SELECT } from '../supabase/tableSelects';
import { USERS_PROFILE_SELECT } from '../supabase/userInterviewRoutingSelect';
import {
  Profile,
  ProfileUpdate,
  ProfilePhoto,
  ProfilePromptAnswer,
  BasicInfo,
} from '@domain/models/Profile';
import type { OnboardingStage, ApplicationStatus } from '@domain/models/OnboardingGates';

function parseProfilePrompts(v: unknown): ProfilePromptAnswer[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => ({
      promptId: typeof item.promptId === 'string' ? item.promptId : '',
      answer: typeof item.answer === 'string' ? item.answer : '',
    }))
    .filter((p) => p.promptId.length > 0);
}

const ONBOARDING_STAGES: OnboardingStage[] = ['basic_info', 'interview', 'psychometrics', 'compatibility', 'complete'];
function parseOnboardingStage(v: unknown): OnboardingStage {
  if (typeof v === 'string' && ONBOARDING_STAGES.includes(v as OnboardingStage)) return v as OnboardingStage;
  return 'interview';
}

const APPLICATION_STATUSES: ApplicationStatus[] = ['pending', 'under_review', 'approved'];
function parseApplicationStatus(v: unknown): ApplicationStatus {
  if (typeof v === 'string' && APPLICATION_STATUSES.includes(v as ApplicationStatus)) return v as ApplicationStatus;
  return 'pending';
}

function parseBasicInfo(v: unknown): BasicInfo | null {
  if (v === null || v === undefined || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  // Allow partial saved state (e.g. only firstName after step 0)
  return {
    firstName: typeof o.firstName === 'string' ? o.firstName : '',
    age: typeof o.age === 'number' ? o.age : 0,
    gender: typeof o.gender === 'string' ? o.gender : '',
    attractedTo: Array.isArray(o.attractedTo) ? o.attractedTo.filter((x): x is string => typeof x === 'string') : [],
    locationCity: typeof o.locationCity === 'string' ? o.locationCity : '',
    locationCountry: typeof o.locationCountry === 'string' ? o.locationCountry : '',
    photoUrl: typeof o.photoUrl === 'string' ? o.photoUrl : '',
    heightCm: typeof o.heightCm === 'number' ? o.heightCm : 0,
    weightKg: typeof o.weightKg === 'number' ? o.weightKg : 0,
    bmi: typeof o.bmi === 'number' ? o.bmi : 0,
    occupation: typeof o.occupation === 'string' ? o.occupation : '',
  };
}

export class ProfileRepository {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('users')
      .select(USERS_PROFILE_SELECT)
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch profile: ${error.message}`);
    if (!data) return null;

    const base = this.mapToProfile(data);
    try {
      const snap = await loadEditProfileSnapshot(userId);
      if (!snap) return base;
      return {
        ...base,
        name: snap.name || base.name,
        age: snap.age ?? base.age,
        gender: snap.gender ?? base.gender,
        attractedTo: snap.attractedTo.length > 0 ? snap.attractedTo : base.attractedTo,
        heightCentimeters: snap.heightCentimeters ?? base.heightCentimeters,
        occupation: snap.occupation || base.occupation,
        primaryPhotoUrl: snap.primaryPhotoUrl ?? base.primaryPhotoUrl,
        prompts: snap.prompts.length > 0 ? snap.prompts : base.prompts,
        basicInfo: snap.basicInfo ?? base.basicInfo,
      };
    } catch {
      return base;
    }
  }

  /**
   * Persists profile changes via canonical repos (Phase 5):
   * dating fields → `profiles.profile_json`; interview/gates → narrow `users` updates.
   */
  async upsertProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const touchesDatingJson =
      update.name !== undefined ||
      update.age !== undefined ||
      update.gender !== undefined ||
      update.attractedTo !== undefined ||
      update.heightCentimeters !== undefined ||
      update.occupation !== undefined ||
      update.location !== undefined ||
      update.primaryPhotoUrl !== undefined;

    if (touchesDatingJson) {
      const ensured = await profilesRepo.ensureProfile(userId, session?.user?.email);
      if (!ensured.success) throw ensured.error;
    }

    try {
      await applyProfileUpdate(userId, update);
    } catch (error) {
      throw new Error(
        `Failed to upsert profile: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const flags: Parameters<typeof updateUserOnboardingFlags>[1] = {};
    if (update.onboardingStep !== undefined) flags.onboardingStep = update.onboardingStep;
    if (update.onboardingCompleted !== undefined) flags.onboardingCompleted = update.onboardingCompleted;
    if (update.referralNoticePending !== undefined) {
      flags.referralNoticePending = update.referralNoticePending;
    }
    if (Object.keys(flags).length > 0) {
      await updateUserOnboardingFlags(userId, flags);
    }

    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error('Failed to upsert profile: user row not found');
    }
    return profile;
  }

  async uploadPhoto(userId: string, fileUri: string, fileName: string): Promise<{ publicUrl: string; storagePath: string }> {
    if (fileName.toLowerCase().endsWith('.gif') || fileUri.split('?')[0]?.toLowerCase().endsWith('.gif')) {
      throw new Error('GIFs cannot be uploaded as profile photos.');
    }
    const response = await fetch(fileUri);
    const blob = await response.blob();
    if (blob.type.toLowerCase() === 'image/gif') {
      throw new Error('GIFs cannot be uploaded as profile photos.');
    }
    const fileExt = fileName.split('.').pop() || 'jpg';
    const storagePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(storagePath, blob, {
        contentType: blob.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload photo: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(storagePath);

    return { publicUrl: urlData.publicUrl, storagePath };
  }

  async savePhotoRecord(photo: Omit<ProfilePhoto, 'id' | 'createdAt'>): Promise<ProfilePhoto> {
    const { data, error } = await supabase
      .from('profile_photos')
      .insert({
        profile_id: photo.profileId,
        storage_path: photo.storagePath,
        public_url: photo.publicUrl,
        display_order: photo.displayOrder,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save photo record: ${error.message}`);
    }

    return {
      id: data.id,
      profileId: data.profile_id,
      storagePath: data.storage_path,
      publicUrl: data.public_url,
      displayOrder: data.display_order,
      createdAt: data.created_at,
    };
  }

  async incrementPhotoDisplayOrders(userId: string, amount: number): Promise<void> {
    const photos = await this.getProfilePhotos(userId);
    for (const photo of photos) {
      const { error } = await supabase
        .from('profile_photos')
        .update({ display_order: photo.displayOrder + amount })
        .eq('id', photo.id);
      if (error) throw new Error(`Failed to update photo order: ${error.message}`);
    }
  }

  async deletePhotoRecord(photoId: string): Promise<void> {
    const { error } = await supabase.from('profile_photos').delete().eq('id', photoId);
    if (error) throw new Error(`Failed to delete photo: ${error.message}`);
  }

  async getProfilePhotos(userId: string): Promise<ProfilePhoto[]> {
    const { data, error } = await supabase
      .from('profile_photos')
      .select(PROFILE_PHOTO_SELECT)
      .eq('profile_id', userId)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch photos: ${error.message}`);
    }

    return data.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      storagePath: row.storage_path,
      publicUrl: row.public_url,
      displayOrder: row.display_order,
      createdAt: row.created_at,
    }));
  }

  private mapToProfile(data: {
    id: string;
    created_at: string;
    updated_at: string;
    onboarding_completed: boolean;
    onboarding_step: number;
    name?: string | null;
    display_name?: string | null;
    invite_code?: string | null;
    is_alpha_tester?: boolean | null;
    profile_prompts?: unknown;
    onboarding_stage?: string | null;
    application_status?: string | null;
    basic_info?: unknown;
    interview_completed?: boolean | null;
    interview_passed?: boolean | null;
    referral_boost_active?: boolean | null;
    referral_notice_pending?: string | null;
  }): Profile {
    return {
      id: data.id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      onboardingCompleted: data.onboarding_completed,
      onboardingStep: data.onboarding_step,
      name: data.name ?? data.display_name ?? null,
      age: null,
      gender: null,
      attractedTo: null,
      heightCentimeters: null,
      occupation: null,
      location: null,
      primaryPhotoUrl: null,
      inviteCode: data.invite_code ?? null,
      isAlphaTester: data.is_alpha_tester === true,
      referralBoostActive: data.referral_boost_active === true,
      referralNoticePending: data.referral_notice_pending ?? null,
      interviewCompleted: data.interview_completed === true,
      interviewPassed: data.interview_passed === true,
      interviewFailed: data.interview_passed === false,
      prompts: parseProfilePrompts(data.profile_prompts),
      onboardingStage: parseOnboardingStage(data.onboarding_stage),
      applicationStatus: parseApplicationStatus(data.application_status),
      basicInfo: parseBasicInfo(data.basic_info),
    };
  }
}

