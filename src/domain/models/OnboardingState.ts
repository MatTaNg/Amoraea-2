import { Gender, AttractedToOption, Location } from './Profile';

export interface OnboardingState {
  step: number;
  name: string | null;
  age: number | null;
  gender: Gender | null;
  attractedTo: AttractedToOption[] | null;
  heightCentimeters: number | null;
  occupation: string | null;
  location: Location | null;
  photoUris: string[];
}

export const ONBOARDING_STEPS = {
  NAME: 1,
  AGE: 2,
  GENDER: 3,
  ATTRACTED_TO: 4,
  HEIGHT: 5,
  OCCUPATION: 6,
  LOCATION: 7,
  PHOTOS: 8,
} as const;

export const TOTAL_ONBOARDING_STEPS = 8;

