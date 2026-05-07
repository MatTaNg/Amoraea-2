import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { handleApiError } from "@/shared/utils/errorHandling";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@/shared/ui/Button";
import { styles } from "../ProfileBuilderScreen.styled";
import { useProfile } from "@/shared/hooks/useProfile";
import { selectPhotos as selectPhotosUtil, removePhoto as removePhotoUtil } from "@/screens/profile/utils/photoUpload";
import {
  ModeratedPhotoUpload,
  type PhotoUploadedMeta,
  normalizePhotoFileNameKey,
} from "@/shared/components/ModeratedPhotoUpload";

interface PhotosStepProps {
  guidance: string;
  photos: string[];
  uploadingPhotosCount: number;
  showErrors: boolean;
  userId: string;
  onPhotosChange: (photos: string[]) => void;
  onUploadingPhotosCountChange: (count: number) => void;
  onShowErrorsChange: (show: boolean) => void;
  onStepChange: (step: "lifedomains") => void;
}

export const PhotosStep: React.FC<PhotosStepProps> = ({
  guidance,
  photos,
  uploadingPhotosCount,
  showErrors,
  userId,
  onPhotosChange,
  onUploadingPhotosCountChange,
  onShowErrorsChange,
  onStepChange,
}) => {
  const navigation = useNavigation();
  const { updateProfile } = useProfile();
  
  const photosRef = useRef(photos);
  const existingAssetIdsRef = useRef<Set<string>>(new Set());
  const assetIdByUrlRef = useRef<Map<string, string>>(new Map());
  
  // Update ref whenever photos prop changes
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const handleContinue = async () => {
    if (photos.length === 0) {
      onShowErrorsChange(true);
      return;
    }
    // Ensure profile is saved with photos before navigating
    const success = await updateProfile({ photos });
    
    if (success) {
      // Small delay to ensure profile state is updated
      setTimeout(() => {
        navigation.getParent()?.navigate("DatingProfileEdit" as never, { userId } as never);
      }, 100);
    }
  };

  return (
    <View>
      <Text style={styles.title}>Add Photos</Text>
      <Text style={styles.help}>
        {guidance}
      </Text>

      {/* Photo grid */}
      <View style={styles.photoGrid}>
        {photos.map((photo, index) => (
          <View key={`photo-${index}`} style={styles.photoContainer}>
            <Image
              source={{ uri: photo }}
              style={styles.photo}
              contentFit="cover"
            />
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={async () => {
                const uri = photos[index]?.trim();
                if (uri) {
                  const aid = assetIdByUrlRef.current.get(uri);
                  if (aid) {
                    existingAssetIdsRef.current.delete(aid);
                    assetIdByUrlRef.current.delete(uri);
                  }
                  const fk = fileNameKeyByUrlRef.current.get(uri);
                  if (fk) {
                    existingFileNameKeysRef.current.delete(fk);
                    fileNameKeyByUrlRef.current.delete(uri);
                  }
                }
                await removePhotoUtil(photos, index, onPhotosChange, userId);
              }}
            >
              <Text style={styles.removePhotoText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        {Array.from({ length: uploadingPhotosCount }).map((_, index) => (
          <View key={`uploading-${index}`} style={styles.uploadingPhotoContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.uploadingText}>
              Uploading...
            </Text>
          </View>
        ))}
        {photos.length + uploadingPhotosCount < 5 && (
          <ModeratedPhotoUpload
            existingAssetIdsRef={existingAssetIdsRef}
            existingFileNameKeysRef={existingFileNameKeysRef}
            onPhotoUploaded={(url, meta?: PhotoUploadedMeta) => {
              const normalized = url.trim();
              const currentPhotos = photosRef.current;
              if (currentPhotos.some((p) => p.trim() === normalized)) {
                Alert.alert("Already added", "This photo is already in your profile.");
                return;
              }
              const assetId = meta?.assetId?.trim() || null;
              if (assetId && existingAssetIdsRef.current.has(assetId)) {
                Alert.alert("Already added", "This photo is already in your profile.");
                return;
              }
              const fileKey =
                meta?.fileName?.trim() != null && meta.fileName.trim() !== ""
                  ? normalizePhotoFileNameKey(meta.fileName)
                  : normalizePhotoFileNameKey(url);
              if (fileKey && existingFileNameKeysRef.current.has(fileKey)) {
                Alert.alert(
                  "Already added",
                  "A photo with this file name is already in your profile.",
                );
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
              updateProfile({ photos: newPhotos }).catch(() => {
                handleApiError(new Error("Failed to save photos"));
              });
            }}
            onUploadStart={() => onUploadingPhotosCountChange((prev) => prev + 1)}
            onUploadEnd={() => onUploadingPhotosCountChange((prev) => Math.max(0, prev - 1))}
            maxPhotos={5}
            currentPhotoCount={photos.length + uploadingPhotosCount}
          >
            <View style={styles.addPhotoButton}>
              <Text style={styles.addPhotoText}>+</Text>
              <Text style={styles.addPhotoLabel}>Add Photo</Text>
            </View>
          </ModeratedPhotoUpload>
        )}
      </View>

      {showErrors && photos.length === 0 && (
        <Text style={styles.error}>
          At least one photo is required to continue
        </Text>
      )}

      <View style={styles.row}>
        <Button
          title="Back"
          variant="outline"
          onPress={() => onStepChange("lifedomains")}
        />
        <Button
          title="Continue"
          onPress={handleContinue}
        />
      </View>
    </View>
  );
};

