export type Gender = 'Man' | 'Woman' | 'Non-binary';

export type AttractedToOption = 'Men' | 'Women' | 'Non-binary';

export interface Location {
  latitude: number;
  longitude: number;
  label: string | null;
}

export interface Profile {
  id: string;
  createdAt: string;
  updatedAt: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  name: string | null;
  age: number | null;
  gender: Gender | null;
  attractedTo: AttractedToOption[] | null;
  heightCentimeters: number | null;
  occupation: string | null;
  location: Location | null;
  primaryPhotoUrl: string | null;
  inviteCode: string | null;
}

export interface ProfilePhoto {
  id: string;
  profileId: string;
  storagePath: string;
  publicUrl: string;
  displayOrder: number;
  createdAt: string;
}

export interface ProfileUpdate {
  name?: string;
  age?: number;
  gender?: Gender;
  attractedTo?: AttractedToOption[];
  heightCentimeters?: number;
  occupation?: string;
  location?: Location;
  primaryPhotoUrl?: string;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
}

