import { supabase } from '../supabase/client';
import { Profile, ProfileUpdate, ProfilePhoto, Location } from '@domain/models/Profile';

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

    const { data, error } = await supabase
      .from('users')
      .upsert(updateData, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert profile: ${error.message}`);
    }

    return this.mapToProfile(data);
  }

  async uploadPhoto(userId: string, fileUri: string, fileName: string): Promise<string> {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const fileExt = fileName.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(filePath, blob, {
        contentType: blob.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload photo: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
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
    };
  }
}

