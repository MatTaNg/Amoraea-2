# Supabase Storage Setup

## Create Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the sidebar
3. Click **New bucket**
4. Name: `profile-photos`
5. Make it **Public** (or use signed URLs if you prefer)
6. Click **Create bucket**

## Storage Policies

After creating the bucket, you need to set up RLS policies for the storage bucket:

### Policy 1: Allow users to upload their own photos
```sql
CREATE POLICY "Users can upload their own photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### Policy 2: Allow users to view their own photos
```sql
CREATE POLICY "Users can view their own photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### Policy 3: Allow users to delete their own photos
```sql
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### Policy 4: Allow public read access (if bucket is public)
If you made the bucket public, you can use this simpler policy for SELECT:
```sql
CREATE POLICY "Public can view profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');
```

## Notes

- The storage path structure is: `${userId}/${filename}`
- The first folder in the path is the user ID, which allows RLS policies to work correctly
- If you prefer signed URLs instead of public URLs, you'll need to modify the `ProfileRepository.uploadPhoto` method to generate signed URLs

