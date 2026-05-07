import React, { useCallback, useState, type MutableRefObject } from 'react';
import { Pressable, View, StyleSheet, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { useAuth } from '@features/authentication/hooks/useAuth';

const profileRepository = new ProfileRepository();

/** Lowercased basename for duplicate checks (device file name or URL segment). */
export function normalizePhotoFileNameKey(source: string): string {
  const s = source.trim();
  if (!s) return '';
  const base = s.split(/[/\\]/).pop()?.split('?')[0] ?? s;
  return base.toLowerCase();
}

/** Passed to `onPhotoUploaded` so parents can dedupe re-picks of the same library asset. */
export type PhotoUploadedMeta = {
  assetId?: string | null;
  /** Original picker name (or URI basename) used for duplicate detection. */
  fileName?: string | null;
};

export const ModeratedPhotoUpload: React.FC<{
  children: React.ReactNode;
  onPhotoUploaded: (url: string, meta?: PhotoUploadedMeta) => void;
  /** When set, library assets with these IDs are skipped (already on profile). */
  existingAssetIdsRef?: MutableRefObject<Set<string>>;
  /** Normalized file-name keys already on the profile (see `normalizePhotoFileNameKey`). */
  existingFileNameKeysRef?: MutableRefObject<Set<string>>;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
  maxPhotos?: number;
  currentPhotoCount?: number;
}> = ({
  children,
  onPhotoUploaded,
  existingAssetIdsRef,
  existingFileNameKeysRef,
  onUploadStart,
  onUploadEnd,
  maxPhotos = 6,
  currentPhotoCount = 0,
}) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const remainingSlots = Math.max(0, maxPhotos - currentPhotoCount);
  const disabled = remainingSlots <= 0 || busy || !user?.id;

  const pickAndUpload = useCallback(async () => {
    if (remainingSlots <= 0 || !user?.id) return;

    setBusy(true);
    onUploadStart?.();
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Allow access to your photos so you can choose images from this device.',
        );
        return;
      }

      const allowsMultiple = Platform.OS !== 'web' && remainingSlots > 1;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: allowsMultiple,
        selectionLimit: allowsMultiple ? remainingSlots : 1,
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const assets = result.assets.slice(0, remainingSlots);
      const seenLocalUris = new Set<string>();
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const uri = asset.uri;
        if (seenLocalUris.has(uri)) {
          Alert.alert('Already added', 'You selected the same photo more than once.');
          continue;
        }
        seenLocalUris.add(uri);
        const assetId = asset.assetId ?? null;
        if (assetId && existingAssetIdsRef?.current.has(assetId)) {
          Alert.alert('Already added', 'This photo is already in your profile.');
          continue;
        }
        const fileName =
          asset.fileName?.replace(/[^a-zA-Z0-9._-]/g, '_') ||
          uri.split('/').pop()?.split('?')[0] ||
          `photo_${Date.now()}_${i}.jpg`;

        const { publicUrl } = await profileRepository.uploadPhoto(user.id, uri, fileName);
        onPhotoUploaded(publicUrl, { assetId: assetId ?? undefined });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not upload photo';
      Alert.alert('Upload failed', message);
    } finally {
      setBusy(false);
      onUploadEnd?.();
    }
  }, [
    onPhotoUploaded,
    onUploadStart,
    onUploadEnd,
    remainingSlots,
    user?.id,
    existingAssetIdsRef,
    existingFileNameKeysRef,
  ]);

  return (
    <Pressable disabled={disabled} onPress={pickAndUpload} style={disabled ? styles.disabled : undefined}>
      <View>{children}</View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
});
