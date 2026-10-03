import React, { useCallback, useRef, type MutableRefObject } from 'react';
import { Pressable, View, StyleSheet, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { MAX_PROFILE_PHOTOS } from '@/shared/profilePhotoLimit';

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

function assetLooksLikeGif(asset: ImagePicker.ImagePickerAsset): boolean {
  const mimeType = typeof asset.mimeType === 'string' ? asset.mimeType.toLowerCase() : '';
  const fileName = asset.fileName?.toLowerCase() ?? '';
  const uriPath = asset.uri.split('?')[0]?.toLowerCase() ?? '';
  return mimeType === 'image/gif' || fileName.endsWith('.gif') || uriPath.endsWith('.gif');
}

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
  /**
   * Saved gallery length, updated synchronously by the parent.
   * When set, in-flight picks reserve slots before React re-renders.
   */
  savedPhotoCountRef?: MutableRefObject<number>;
  /** Prefer passing from parent so the button is not blocked while auth hydrates. */
  userId?: string | null;
}> = ({
  children,
  onPhotoUploaded,
  existingAssetIdsRef,
  existingFileNameKeysRef,
  onUploadStart,
  onUploadEnd,
  maxPhotos = MAX_PROFILE_PHOTOS,
  currentPhotoCount = 0,
  savedPhotoCountRef,
  userId: userIdProp,
}) => {
  const { user } = useAuth();
  const userId = userIdProp ?? user?.id ?? null;
  /** Blocks only while the system photo picker is open (not during background upload). */
  const pickInFlightRef = useRef(false);
  const inFlightRef = useRef(0);
  const pendingAssetIdsRef = useRef(new Set<string>());
  const pendingFileKeysRef = useRef(new Set<string>());

  const slotsRemaining = () => {
    const saved = savedPhotoCountRef?.current ?? currentPhotoCount;
    const reserved = savedPhotoCountRef ? inFlightRef.current : 0;
    return Math.max(0, maxPhotos - saved - reserved);
  };

  const remainingSlots = slotsRemaining();
  const disabled = remainingSlots <= 0 || !userId;

  const uploadAssetsInBackground = useCallback(
    (assets: ImagePicker.ImagePickerAsset[], uid: string) => {
      const seenLocalUris = new Set<string>();
      const accepted: Array<{
        uri: string;
        assetId: string | null;
        fileName: string;
        fileKey: string;
      }> = [];

      for (let i = 0; i < assets.length; i++) {
        if (accepted.length >= slotsRemaining()) break;
        const asset = assets[i];
        const uri = asset.uri;
        if (assetLooksLikeGif(asset)) {
          Alert.alert(
            'Unsupported file type',
            'GIFs cannot be uploaded as profile photos. Please choose a JPG, PNG, or HEIC image.',
          );
          continue;
        }
        if (seenLocalUris.has(uri)) {
          Alert.alert('Already added', 'You selected the same photo more than once.');
          continue;
        }
        seenLocalUris.add(uri);
        const assetId = asset.assetId ?? null;
        if (
          assetId &&
          (existingAssetIdsRef?.current.has(assetId) || pendingAssetIdsRef.current.has(assetId))
        ) {
          Alert.alert('Already added', 'This photo is already in your profile.');
          continue;
        }
        const fileName =
          asset.fileName?.replace(/[^a-zA-Z0-9._-]/g, '_') ||
          uri.split('/').pop()?.split('?')[0] ||
          `photo_${Date.now()}_${i}.jpg`;
        const fileKey = normalizePhotoFileNameKey(fileName);
        if (
          fileKey &&
          (existingFileNameKeysRef?.current.has(fileKey) || pendingFileKeysRef.current.has(fileKey))
        ) {
          Alert.alert('Already added', 'This photo has already been added.');
          continue;
        }
        accepted.push({ uri, assetId, fileName, fileKey });
      }

      if (accepted.length === 0) return;

      inFlightRef.current += accepted.length;
      for (const item of accepted) {
        if (item.assetId) pendingAssetIdsRef.current.add(item.assetId);
        if (item.fileKey) pendingFileKeysRef.current.add(item.fileKey);
        onUploadStart?.();
      }

      void (async () => {
        for (const item of accepted) {
          try {
            const { publicUrl } = await profileRepository.uploadPhoto(uid, item.uri, item.fileName);
            onPhotoUploaded(publicUrl, {
              assetId: item.assetId ?? undefined,
              fileName: item.fileName,
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Could not upload photo';
            Alert.alert('Upload failed', message);
          } finally {
            if (item.assetId) pendingAssetIdsRef.current.delete(item.assetId);
            if (item.fileKey) pendingFileKeysRef.current.delete(item.fileKey);
            inFlightRef.current = Math.max(0, inFlightRef.current - 1);
            onUploadEnd?.();
          }
        }
      })();
    },
    [
      onPhotoUploaded,
      onUploadStart,
      onUploadEnd,
      existingAssetIdsRef,
      existingFileNameKeysRef,
      maxPhotos,
      currentPhotoCount,
      savedPhotoCountRef,
    ],
  );

  const pickAndUpload = useCallback(async () => {
    const openSlots = slotsRemaining();
    if (openSlots <= 0 || !userId || pickInFlightRef.current) return;

    pickInFlightRef.current = true;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Allow access to your photos so you can choose images from this device.',
        );
        return;
      }

      const allowsMultiple = Platform.OS !== 'web' && openSlots > 1;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: allowsMultiple,
        selectionLimit: allowsMultiple ? openSlots : 1,
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const assets = result.assets.slice(0, openSlots);
      uploadAssetsInBackground(assets, userId);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not upload photo';
      Alert.alert('Upload failed', message);
    } finally {
      pickInFlightRef.current = false;
    }
  }, [uploadAssetsInBackground, userId, maxPhotos, currentPhotoCount, savedPhotoCountRef]);

  return (
    <Pressable
      disabled={disabled}
      onPress={pickAndUpload}
      style={({ pressed }) => [
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <View pointerEvents="none">{children}</View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
