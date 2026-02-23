import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { Profile, ProfileUpdate } from '@domain/models/Profile';

export class ProfileUseCase {
  constructor(private profileRepository: ProfileRepository) {}

  async getProfile(userId: string): Promise<Profile | null> {
    return this.profileRepository.getProfile(userId);
  }

  async updateProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
    return this.profileRepository.upsertProfile(userId, update);
  }
}

