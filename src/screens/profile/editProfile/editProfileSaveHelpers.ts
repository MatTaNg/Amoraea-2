import { ProfileRepository } from '@data/repositories/ProfileRepository';

const profilePhotoRepo = new ProfileRepository();

export function photoUrlsNeedUpload(photoUrls: string[]): boolean {
  return photoUrls.some((raw) => {
    const u = raw.trim();
    return u.length > 0 && !/^https?:\/\//i.test(u);
  });
}

export async function resolvePhotoUrlsForSave(
  userId: string,
  urls: string[],
): Promise<string[]> {
  const uploads = await Promise.all(
    urls.map(async (raw, i) => {
      const u = raw?.trim();
      if (!u) return null;
      if (/^https?:\/\//i.test(u)) return u;
      const fn =
        u
          .split('/')
          .pop()
          ?.split('?')[0]
          ?.replace(/[^a-zA-Z0-9._-]/g, '_') || `photo_${Date.now()}_${i}.jpg`;
      const { publicUrl } = await profilePhotoRepo.uploadPhoto(userId, u, fn);
      return publicUrl;
    }),
  );
  return uploads.filter((url): url is string => Boolean(url));
}

export function jsonSnapshotEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
