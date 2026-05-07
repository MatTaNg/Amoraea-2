import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Button } from '@/shared/ui/Button';
import {
  ModeratedPhotoUpload,
  type PhotoUploadedMeta,
  normalizePhotoFileNameKey,
} from '@/shared/components/ModeratedPhotoUpload';
import { useProfile } from '@/shared/hooks/useProfile';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './PhotosVideoModal.styled';

interface PhotosVideoModalProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const PhotosVideoModal: React.FC<PhotosVideoModalProps> = ({
  photos,
  onPhotosChange,
  onNext,
  onBack,
}) => {
  const { updateProfile } = useProfile();
  const [uploadingPhotosCount, setUploadingPhotosCount] = useState(0);
  
  // Use ref to track latest photos array for concurrent uploads
  const photosRef = useRef(photos);
  /** Library asset IDs already added this session (see expo-image-picker `assetId`). */
  const existingAssetIdsRef = useRef<Set<string>>(new Set());
  const assetIdByUrlRef = useRef<Map<string, string>>(new Map());
  const existingFileNameKeysRef = useRef<Set<string>>(new Set());
  const fileNameKeyByUrlRef = useRef<Map<string, string>>(new Map());

  // Update ref whenever photos prop changes, filtering out empty values
  useEffect(() => {
    const validPhotos = photos.filter(p => p && p.trim() !== '');
    if (validPhotos.length !== photos.length) {
      console.log('Filtered out invalid photos. Original:', photos, 'Filtered:', validPhotos);
      onPhotosChange(validPhotos);
    }
    photosRef.current = validPhotos;
    const allowed = new Set(validPhotos.map((p) => p.trim()));
    for (const u of [...fileNameKeyByUrlRef.current.keys()]) {
      if (!allowed.has(u)) {
        const fk = fileNameKeyByUrlRef.current.get(u);
        if (fk) existingFileNameKeysRef.current.delete(fk);
        fileNameKeyByUrlRef.current.delete(u);
      }
    }
    for (const u of [...assetIdByUrlRef.current.keys()]) {
      if (!allowed.has(u)) {
        const aid = assetIdByUrlRef.current.get(u);
        if (aid) existingAssetIdsRef.current.delete(aid);
        assetIdByUrlRef.current.delete(u);
      }
    }
    for (const p of validPhotos) {
      const norm = p.trim();
      if (!norm || fileNameKeyByUrlRef.current.has(norm)) continue;
      const k = normalizePhotoFileNameKey(p);
      if (k) {
        fileNameKeyByUrlRef.current.set(norm, k);
        existingFileNameKeysRef.current.add(k);
      }
    }
  }, [photos, onPhotosChange]);

  const handlePhotoUploaded = (url: string, meta?: PhotoUploadedMeta) => {
    // Validate URL before adding
    if (!url || url.trim() === '') {
      console.error('Invalid photo URL received:', url);
      return;
    }
    const normalized = url.trim();
    const currentPhotos = photosRef.current.filter(p => p && p.trim() !== '');
    if (currentPhotos.some(p => p.trim() === normalized)) {
      Alert.alert('Already added', 'This photo is already in your profile.');
      return;
    }
    const assetId = meta?.assetId?.trim() || null;
    if (assetId && existingAssetIdsRef.current.has(assetId)) {
      Alert.alert('Already added', 'This photo is already in your profile.');
      return;
    }
    const fileKey =
      meta?.fileName?.trim() != null && meta.fileName.trim() !== ''
        ? normalizePhotoFileNameKey(meta.fileName)
        : normalizePhotoFileNameKey(url);
    if (fileKey && existingFileNameKeysRef.current.has(fileKey)) {
      Alert.alert('Already added', 'A photo with this file name is already in your profile.');
      return;
    }

    const newPhotos = [...currentPhotos, url];
    photosRef.current = newPhotos;
    if (assetId) {
      existingAssetIdsRef.current.add(assetId);
      assetIdByUrlRef.current.set(normalized, assetId);
    }
    if (fileKey) {
      const prevKey = fileNameKeyByUrlRef.current.get(normalized);
      if (prevKey && prevKey !== fileKey) existingFileNameKeysRef.current.delete(prevKey);
      existingFileNameKeysRef.current.add(fileKey);
      fileNameKeyByUrlRef.current.set(normalized, fileKey);
    }
    onPhotosChange(newPhotos);
    updateProfile({ photos: newPhotos }).catch((error) => {
      console.error('Failed to update profile with photos:', error);
    });
  };

  const handleRemovePhoto = (uri: string) => {
    const norm = uri.trim();
    const assetId = assetIdByUrlRef.current.get(norm);
    if (assetId) {
      existingAssetIdsRef.current.delete(assetId);
      assetIdByUrlRef.current.delete(norm);
    }
    const fileKey = fileNameKeyByUrlRef.current.get(norm);
    if (fileKey) {
      existingFileNameKeysRef.current.delete(fileKey);
      fileNameKeyByUrlRef.current.delete(norm);
    }
    const newPhotos = photos.filter((p) => p !== uri);
    photosRef.current = newPhotos.filter((p) => p && p.trim() !== '');
    onPhotosChange(newPhotos);
    updateProfile({ photos: photosRef.current }).catch((error) => {
      console.error('Failed to update profile after removing photo:', error);
    });
  };

  // Disable Next button if uploads are in progress or if no photos are uploaded
  const canContinue = photos.filter((p) => p && p.trim() !== "").length > 0 && uploadingPhotosCount === 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Add your photos" onBack={onBack} />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>
            Add up to 6 photos.
          </Text>

          {/* Photos Section */}
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.photoGrid}>
            {photos.filter(photo => photo && photo.trim() !== '').map((photo, index) => (
              <View key={`photo-${index}`} style={styles.photoContainer}>
                <Image
                  source={{ uri: photo }}
                  style={styles.photo}
                  contentFit="cover"
                  transition={200}
                  onError={(error) => {
                    console.error('Photo load error:', error, 'URL:', photo);
                  }}
                />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => handleRemovePhoto(photo)}
                >
                  <Text style={styles.removePhotoText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {Array.from({ length: uploadingPhotosCount }).map((_, index) => (
              <View key={`uploading-${index}`} style={styles.uploadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.uploadingText}>
                  Uploading...
                </Text>
              </View>
            ))}
            {photos.filter((p) => p && p.trim() !== '').length + uploadingPhotosCount < 6 && (
              <ModeratedPhotoUpload
                onPhotoUploaded={handlePhotoUploaded}
                existingAssetIdsRef={existingAssetIdsRef}
                existingFileNameKeysRef={existingFileNameKeysRef}
                onUploadStart={() => setUploadingPhotosCount((prev) => prev + 1)}
                onUploadEnd={() => setUploadingPhotosCount((prev) => Math.max(0, prev - 1))}
                maxPhotos={6}
                currentPhotoCount={
                  photos.filter((p) => p && p.trim() !== '').length + uploadingPhotosCount
                }
              >
                <View style={styles.addPhotoButton}>
                  <Text style={styles.addPhotoText}>+</Text>
                  <Text style={styles.addPhotoLabel}>Add Photo</Text>
                </View>
              </ModeratedPhotoUpload>
            )}
          </View>

        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button
            title="Back"
            variant="outline"
            onPress={onBack}
            style={styles.backButton}
          />
          <Button
            title="Next"
            onPress={onNext}
            disabled={!canContinue}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};

