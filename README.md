# Amoraea - Production-Ready React Native Dating App

## How to update the website www.amoraea.com
1) Run npm run build:web in this project
2) Copy the dist folder in "upload a file" at https://app.netlify.com/projects/superlative-pasca-129bb2/overview 

A production-ready mobile dating application built with React Native, Expo, and Supabase, following CLEAN architecture principles.

## Payment Tier Limits:
OpenAI: https://platform.openai.com/settings/organization/limits
For speech recognition for AI Interviewer

## Features

- **Authentication**: Email/password authentication with Supabase Auth
- **Onboarding Wizard**: 8-step onboarding flow with local and remote persistence
- **Profile Management**: Complete profile editing capabilities
- **Typology Assessments**: Big Five, Attachment Styles, and Schwartz Values
- **Compatibility Matching**: Compatibility assessment system
- **Photo Upload**: Multi-photo upload with Supabase Storage
- **Location Services**: Automatic location detection with permission handling

## Tech Stack

- **Framework**: React Native with Expo (managed workflow)
- **Language**: TypeScript
- **Navigation**: React Navigation
- **State Management**: 
  - TanStack Query (React Query) for server state
  - Zustand for local UI state
- **Forms**: React Hook Form + Zod validation
- **Backend**: Supabase (Auth, Database, Storage)
- **Architecture**: CLEAN Architecture with clear separation of concerns

## Project Structure

```
amoraea/
├── src/
│   ├── app/
│   │   ├── navigation/        # Navigation configuration
│   │   └── screens/           # Screen components
│   ├── features/
│   │   ├── authentication/   # Auth feature
│   │   ├── onboarding/        # Onboarding feature
│   │   ├── profile/          # Profile feature
│   │   ├── typologies/        # Typology feature
│   │   └── compatibility/    # Compatibility feature
│   ├── domain/
│   │   ├── models/           # Domain models
│   │   ├── repositories/     # Repository interfaces
│   │   └── useCases/         # Business logic
│   ├── data/
│   │   ├── supabase/        # Supabase client
│   │   └── repositories/     # Repository implementations
│   ├── ui/
│   │   ├── components/      # Reusable UI components
│   │   └── theme/           # Theme configuration
│   └── utilities/
│       ├── validation/      # Validation schemas
│       ├── storage/         # Local storage utilities
│       └── permissions/     # Permission utilities
├── supabase/
│   ├── schema.sql           # Database schema
│   └── storage-setup.md     # Storage setup instructions
└── App.tsx                  # Main app entry point
```

## Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account and project
- iOS Simulator (for Mac) or Android Emulator

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd amoraea
npm install
```

### 2. Configure Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key from the project settings
3. Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# Optional — email confirmation redirect (defaults: dev http://localhost:8081/, prod https://www.amoraea.com/)
# EXPO_PUBLIC_AUTH_REDIRECT_URL_DEV=http://localhost:8081/
# EXPO_PUBLIC_AUTH_REDIRECT_URL=https://www.amoraea.com/
```

In **Supabase → Authentication → URL Configuration**, set **Site URL** to your deployed web app origin and add every origin users hit under **Redirect URLs** (e.g. `https://www.amoraea.com/`, `https://your-app.netlify.app/`). Production web builds use `window.location.origin` when `EXPO_PUBLIC_AUTH_REDIRECT_URL` is unset so the confirmation link matches Netlify or your custom domain.

**Netlify:** `netlify.toml` and `public/_redirects` configure SPA fallback so `/` and deep paths return `index.html` (fixes “Page not found” after email confirmation). Redeploy after pulling these files.

### 3. Set Up Database

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/schema.sql`
4. Run the SQL script to create all tables, indexes, and RLS policies

### 4. Set Up Storage

1. Follow the instructions in `supabase/storage-setup.md` to:
   - Create the `profile-photos` storage bucket
   - Set up storage RLS policies

### 5. Run the App

```bash
# Start the Expo development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Database Schema

### Tables

- **profiles**: User profile information and onboarding progress
- **typologies**: Typology assessment results (Big Five, Attachment Styles, Schwartz Values)
- **compatibility**: Compatibility assessment data
- **profile_photos**: Profile photo metadata

All tables have Row Level Security (RLS) enabled, ensuring users can only access their own data.

## Key Implementation Details

### Onboarding Flow

1. Each onboarding step validates input using Zod schemas
2. Data is saved locally (AsyncStorage) first for offline support
3. Then upserted to Supabase for cross-device sync
4. If remote save fails, the update is queued for retry
5. Onboarding progress persists across app restarts

### Location Handling

- Automatically requests location permission
- If denied, shows blocking screen with "Open Settings" button
- Continuously checks permission status when app returns to foreground
- Reverse geocodes coordinates to get human-readable location label

### Photo Upload

- Supports selecting 3-6 photos at once
- Uploads to Supabase Storage bucket `profile-photos`
- Stores metadata in `profile_photos` table
- Sets first photo as primary profile photo

### State Management

- **Server State**: Managed by React Query
  - Automatic caching and refetching
  - Optimistic updates
  - Query invalidation on mutations
- **Local UI State**: Managed by Zustand (when needed)
  - Only for UI-specific state (modals, temporary selections, etc.)

## Testing

Run tests with:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

## Environment Variables

Required environment variables:

- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Limitations and Future Work

1. **AI Relationship Agent**: Currently disabled (placeholder button)
2. **External Test Links**: Typology and compatibility forms link to placeholder URLs
3. **Edit Profile Screen**: Currently a placeholder - needs full form implementation
4. **Offline Support**: Basic offline support with retry queue, but could be enhanced
5. **Photo Management**: No delete/edit functionality for uploaded photos yet

## Architecture Principles

- **CLEAN Architecture**: Clear separation between domain, data, and presentation layers
- **No Abbreviations**: Full, descriptive names throughout the codebase
- **Small Files**: Each file has a single, clear purpose
- **Business Logic Separation**: All business logic in use cases, not in UI components
- **Type Safety**: Strict TypeScript throughout
- **Testability**: Domain logic is easily testable without React Native dependencies

## Troubleshooting

### Supabase Connection Issues

- Verify your `.env` file has the correct values
- Check that your Supabase project is active
- Ensure RLS policies are correctly set up

### Location Permission Issues

- On iOS: Check `Info.plist` has location permission descriptions
- On Android: Check `AndroidManifest.xml` has location permissions
- Verify app.json has correct permission configurations

### Photo Upload Issues

- Ensure storage bucket is created and policies are set
- Check that bucket is public or signed URLs are configured
- Verify file size limits in Supabase Storage settings

## License

Private project - All rights reserved

#   A m o r a e a - 2 
 
 