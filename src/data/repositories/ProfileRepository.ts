import { supabase } from '../supabase/client';
import {
  Profile,
  ProfileUpdate,
  ProfilePhoto,
  Location,
  ProfilePromptAnswer,
  BasicInfo,
  Gate1Score,
  Gate2Psychometrics,
  Gate3Compatibility,
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
  return 'basic_info';
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

function parseGate1Score(v: unknown): Gate1Score | null {
  if (v === null || v === undefined || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const pillarScores = o.pillarScores && typeof o.pillarScores === 'object' ? (o.pillarScores as Record<string, number>) : {};
  const avg = typeof o.averageScore === 'number' ? o.averageScore : 0;
  return {
    pillarScores,
    pillarConfidence: (o.pillarConfidence as Record<string, string>) ?? undefined,
    averageScore: avg,
    narrativeCoherence: typeof o.narrativeCoherence === 'string' ? o.narrativeCoherence : '',
    behavioralSpecificity: typeof o.behavioralSpecificity === 'string' ? o.behavioralSpecificity : '',
    noExampleConstructs: Array.isArray(o.noExampleConstructs) ? o.noExampleConstructs.filter((x): x is string => typeof x === 'string') : undefined,
    avoidanceSignals: Array.isArray(o.avoidanceSignals) ? o.avoidanceSignals.filter((x): x is string => typeof x === 'string') : undefined,
    passed: o.passed === true,
    failReasons: Array.isArray(o.failReasons) ? o.failReasons.filter((x): x is string => typeof x === 'string') : [],
    scoredAt: typeof o.scoredAt === 'string' ? o.scoredAt : new Date().toISOString(),
  };
}

function parseGate2Psychometrics(v: unknown): Gate2Psychometrics | null {
  if (v === null || v === undefined || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.ecr12 !== 'object' || typeof o.tipi !== 'object' || typeof o.dsisf !== 'object' || typeof o.brs !== 'object' || typeof o.pvq21 !== 'object') return null;
  return {
    ecr12: o.ecr12 as Gate2Psychometrics['ecr12'],
    tipi: o.tipi as Gate2Psychometrics['tipi'],
    dsisf: o.dsisf as Gate2Psychometrics['dsisf'],
    brs: o.brs as Gate2Psychometrics['brs'],
    pvq21: o.pvq21 as Gate2Psychometrics['pvq21'],
    completedAt: typeof (o as { completedAt?: string }).completedAt === 'string' ? (o as { completedAt: string }).completedAt : new Date().toISOString(),
  };
}

function parseGate3Compatibility(v: unknown): Gate3Compatibility | null {
  if (v === null || v === undefined || typeof v !== 'object') return null;
  return v as Gate3Compatibility;
}

// Many Supabase profiles use a PostgreSQL enum with lowercase values; our app uses capitalized
const GENDER_TO_DB: Record<string, string> = { Man: 'man', Woman: 'woman', 'Non-binary': 'non-binary' };
const GENDER_FROM_DB: Record<string, Profile['gender']> = {
  man: 'Man',
  woman: 'Woman',
  non_binary: 'Non-binary',
  'non-binary': 'Non-binary',
};

export class ProfileRepository {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch profile: ${error.message}`);
    if (!data) return null;

    return this.mapToProfile(data);
  }

  async upsertProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
    const { data: { session } } = await supabase.auth.getSession();
    const updateData: Record<string, unknown> = {
      id: userId,
      updated_at: new Date().toISOString(),
    };
    if (session?.user?.email) {
      updateData.email = session.user.email;
    }
    // Supabase profiles often have NOT NULL display_name; set from name or fallback for initial insert
    if (update.name !== undefined) {
      updateData.display_name = update.name;
    } else {
      updateData.display_name =
        session?.user?.user_metadata?.full_name ??
        session?.user?.email?.split('@')[0] ??
        'User';
    }

    if (update.name !== undefined) updateData.name = update.name;
    if (update.age !== undefined) updateData.age = update.age;
    if (update.gender !== undefined) updateData.gender = GENDER_TO_DB[update.gender] ?? update.gender;
    if (update.attractedTo !== undefined) updateData.attracted_to = update.attractedTo;
    if (update.heightCentimeters !== undefined) updateData.height_centimeters = update.heightCentimeters;
    if (update.occupation !== undefined) updateData.occupation = update.occupation;
    if (update.location !== undefined) {
      updateData.location_latitude = update.location.latitude;
      updateData.location_longitude = update.location.longitude;
      updateData.location_label = update.location.label;
    }
    if (update.primaryPhotoUrl !== undefined) updateData.primary_photo_url = update.primaryPhotoUrl;
    if (update.onboardingStep !== undefined) updateData.onboarding_step = update.onboardingStep;
    if (update.onboardingCompleted !== undefined) updateData.onboarding_completed = update.onboardingCompleted;
    if (update.prompts !== undefined) updateData.profile_prompts = update.prompts;
    if (update.onboardingStage !== undefined) updateData.onboarding_stage = update.onboardingStage;
    if (update.applicationStatus !== undefined) updateData.application_status = update.applicationStatus;
    if (update.profileVisible !== undefined) updateData.profile_visible = update.profileVisible;
    if (update.basicInfo !== undefined) updateData.basic_info = update.basicInfo;
    if (update.gate1Score !== undefined) updateData.gate1_score = update.gate1Score;
    if (update.gate2Psychometrics !== undefined) updateData.gate2_psychometrics = update.gate2Psychometrics;
    if (update.gate3Compatibility !== undefined) updateData.gate3_compatibility = update.gate3Compatibility;

    // Remove undefined values so we don't send them to PostgREST (can cause 400)
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updateData)) {
      if (v !== undefined) payload[k] = v;
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      const err = error as { message?: string; details?: string; hint?: string };
      const extra = [err.details, err.hint].filter(Boolean).join('; ');
      const fullMessage = extra ? `${error.message} — ${extra}` : error.message;
      throw new Error(`Failed to upsert profile: ${fullMessage}`);
    }

    return this.mapToProfile(data);
  }

  async uploadPhoto(userId: string, fileUri: string, fileName: string): Promise<{ publicUrl: string; storagePath: string }> {
    const response = await fetch(fileUri);
    const blob = await response.blob();
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
      .select('*')
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
    name: string | null;
    age: number | null;
    gender: string | null;
    attracted_to: string[] | null;
    height_centimeters: number | null;
    occupation: string | null;
    location_latitude: number | null;
    location_longitude: number | null;
    location_label: string | null;
    primary_photo_url: string | null;
    invite_code?: string | null;
    profile_prompts?: unknown;
    onboarding_stage?: string | null;
    application_status?: string | null;
    profile_visible?: boolean | null;
    basic_info?: unknown;
    gate1_score?: unknown;
    gate2_psychometrics?: unknown;
    gate3_compatibility?: unknown;
  }): Profile {
    const location: Location | null =
      data.location_latitude !== null && data.location_longitude !== null
        ? {
            latitude: data.location_latitude,
            longitude: data.location_longitude,
            label: data.location_label,
          }
        : null;

    return {
      id: data.id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      onboardingCompleted: data.onboarding_completed,
      onboardingStep: data.onboarding_step,
      name: data.name,
      age: data.age,
      gender: (data.gender ? GENDER_FROM_DB[data.gender.toLowerCase().replace('-', '_')] : null) ?? (data.gender as Profile['gender']),
      attractedTo: data.attracted_to as Profile['attractedTo'],
      heightCentimeters: data.height_centimeters,
      occupation: data.occupation,
      location,
      primaryPhotoUrl: data.primary_photo_url,
      inviteCode: data.invite_code ?? null,
      prompts: parseProfilePrompts(data.profile_prompts),
      onboardingStage: parseOnboardingStage(data.onboarding_stage),
      applicationStatus: parseApplicationStatus(data.application_status),
      profileVisible: data.profile_visible === true,
      basicInfo: parseBasicInfo(data.basic_info),
      gate1Score: parseGate1Score(data.gate1_score),
      gate2Psychometrics: parseGate2Psychometrics(data.gate2_psychometrics),
      gate3Compatibility: parseGate3Compatibility(data.gate3_compatibility),
    };
  }
}

