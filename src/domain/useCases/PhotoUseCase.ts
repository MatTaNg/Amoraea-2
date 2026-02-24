import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { ProfilePhoto } from '@domain/models/Profile';
import * as ImagePicker from 'expo-image-picker';

export class PhotoUseCase {
  constructor(private profileRepository: ProfileRepository) {}

  async removePhoto(userId: string, photoId: string, currentPrimaryUrl: string | null): Promise<void> {
    const photos = await this.profileRepository.getProfilePhotos(userId);
    const toRemove = photos.find((p) => p.id === photoId);
    if (!toRemove) return;

    await this.profileRepository.deletePhotoRecord(photoId);

    if (currentPrimaryUrl === toRemove.publicUrl) {
      const remaining = photos.filter((p) => p.id !== photoId);
      const newPrimary = remaining[0]?.publicUrl ?? null;
      if (newPrimary) {
        await this.profileRepository.upsertProfile(userId, { primaryPhotoUrl: newPrimary });
      }
    }
  }

  async pickPhotos(): Promise<string[]> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Photo library permission not granted');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6,
    });

    if (result.canceled) {
      return [];
    }

    return result.assets.map((asset) => asset.uri);
  }

  async uploadPhotos(userId: string, photoUris: string[]): Promise<ProfilePhoto[]> {
    return this.addPhotos(userId, photoUris, true);
  }

  /** Add new photos to an existing profile. New photos appear at the top (displayOrder 0, 1, ...). */
  async addPhotos(
    userId: string,
    photoUris: string[],
    atTop: boolean = true
  ): Promise<ProfilePhoto[]> {
    const uploadedPhotos: ProfilePhoto[] = [];
    const existingPhotos = await this.profileRepository.getProfilePhotos(userId);

    if (atTop && existingPhotos.length > 0 && photoUris.length > 0) {
      await this.profileRepository.incrementPhotoDisplayOrders(userId, photoUris.length);
    }

    const startOrder = atTop ? 0 : existingPhotos.length;
    for (let i = 0; i < photoUris.length; i++) {
      const uri = photoUris[i];
      const fileName = uri.split('/').pop() || `photo_${Date.now()}_${i}.jpg`;
      const { publicUrl, storagePath } = await this.profileRepository.uploadPhoto(userId, uri, fileName);

      const photo = await this.profileRepository.savePhotoRecord({
        profileId: userId,
        storagePath,
        publicUrl,
        displayOrder: startOrder + i,
      });

      uploadedPhotos.push(photo);
    }

    if (uploadedPhotos.length > 0 && existingPhotos.length === 0) {
      await this.profileRepository.upsertProfile(userId, {
        primaryPhotoUrl: uploadedPhotos[0].publicUrl,
      });
    }

    return uploadedPhotos;
  }
}

