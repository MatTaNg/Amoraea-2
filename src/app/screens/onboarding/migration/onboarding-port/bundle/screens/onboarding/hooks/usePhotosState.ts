import { useState } from "react";

export interface PhotosState {
  photos: string[];
  uploadingPhotosCount: number;
}

export const usePhotosState = () => {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhotosCount, setUploadingPhotosCount] = useState(0);

  const state: PhotosState = {
    photos,
    uploadingPhotosCount,
  };

  return {
    state,
    setters: {
      setPhotos,
      setUploadingPhotosCount,
    },
  };
};

