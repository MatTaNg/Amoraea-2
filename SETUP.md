# Quick Setup Guide

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these values from your Supabase project settings → API.

### 3. Set Up Supabase Database

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste and run it in the SQL Editor
5. Verify all tables were created in the **Table Editor**

### 4. Enable Email Confirmation (recommended)

To send a confirmation email when users sign up and require confirmation before they can sign in:

1. In Supabase Dashboard go to **Authentication** → **Providers** → **Email**.
2. Turn **ON** “Confirm email”.
3. (Optional) Under **Authentication** → **URL Configuration**, set **Site URL** to your app’s URL (e.g. `https://yourapp.com` or your Expo deep link). Add any redirect URLs under **Redirect URLs** (e.g. `https://yourapp.com/**` for web).
4. (Optional) To use your own SMTP instead of Supabase’s default, set **Custom SMTP** under **Authentication** → **Email Templates** / project settings so confirmation emails are delivered reliably.

Until “Confirm email” is enabled, Supabase may not send confirmation emails and users can sign in without confirming. The app will still enforce confirmation when possible (it signs out users whose email is not confirmed).

### 5. Set Up Supabase Storage

1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**
3. Name: `profile-photos`
4. Make it **Public** (or configure signed URLs)
5. Click **Create bucket**

Then set up storage policies (see `supabase/storage-setup.md` for SQL policies).

### 6. Run the App

```bash
npm start
```

Then press:
- `i` for iOS simulator
- `a` for Android emulator
- Scan QR code with Expo Go app on your phone

## First Run

1. Create an account with email/password
2. Complete the 8-step onboarding flow
3. Explore the home screen and typology screens

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env` file exists in the root directory
- Verify variable names start with `EXPO_PUBLIC_`
- Restart the Expo dev server after creating `.env`

### "Failed to fetch profile"
- Check that RLS policies are set up correctly
- Verify the user is authenticated
- Check Supabase project is active

### Location permission not working
- iOS: Check `app.json` has `NSLocationWhenInUseUsageDescription`
- Android: Check `app.json` has location permissions
- Restart the app after granting permissions

### Photo upload fails
- Verify storage bucket `profile-photos` exists
- Check storage policies are configured
- Ensure bucket is public or signed URLs are set up

## Next Steps

- Replace placeholder external test URLs with real assessment forms
- Implement full Edit Profile screen with all fields
- Add photo deletion/editing functionality
- Enhance offline support
- Implement AI Relationship Agent feature

