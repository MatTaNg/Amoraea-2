import { z } from 'zod';

export const nameSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

export const ageSchema = z.object({
  age: z.number().int().min(18, 'You must be at least 18 years old').max(120, 'Please enter a valid age'),
});

export const genderSchema = z.object({
  gender: z.enum(['Man', 'Woman', 'Non-binary'], {
    required_error: 'Please select a gender',
  }),
});

export const attractedToSchema = z.object({
  attractedTo: z.array(z.enum(['Men', 'Women', 'Non-binary'])).min(1, 'Please select at least one option'),
});

export const heightSchema = z.object({
  heightCentimeters: z.number().int().min(100, 'Height must be at least 100 cm').max(250, 'Height must be at most 250 cm'),
});

export const occupationSchema = z.object({
  occupation: z.string().min(1, 'Occupation is required').max(200, 'Occupation is too long'),
});

export const locationSchema = z.object({
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    label: z.string().nullable(),
  }),
});

export const photosSchema = z.object({
  photoUris: z.array(z.string()).min(3, 'Please select at least 3 photos').max(6, 'Please select at most 6 photos'),
});

