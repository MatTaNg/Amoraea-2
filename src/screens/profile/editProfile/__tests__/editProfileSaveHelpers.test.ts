import {
  photoUrlsNeedUpload,
  resolvePhotoUrlsForSave,
} from '@/screens/profile/editProfile/editProfileSaveHelpers';

jest.mock('@data/repositories/ProfileRepository', () => ({
  ProfileRepository: jest.fn().mockImplementation(() => ({
    uploadPhoto: jest.fn(async (_userId: string, uri: string) => ({
      publicUrl: `https://cdn.example/${encodeURIComponent(uri)}`,
      storagePath: 'path',
    })),
  })),
}));

describe('editProfileSaveHelpers', () => {
  it('detects local photo URIs that still need upload', () => {
    expect(photoUrlsNeedUpload(['https://cdn.example/a.jpg'])).toBe(false);
    expect(photoUrlsNeedUpload(['file:///local/photo.jpg'])).toBe(true);
  });

  it('uploads only local photos in parallel', async () => {
    const { ProfileRepository } = require('@data/repositories/ProfileRepository') as {
      ProfileRepository: jest.Mock;
    };
    const uploadPhoto = ProfileRepository.mock.results[0].value.uploadPhoto as jest.Mock;

    const urls = await resolvePhotoUrlsForSave('user-1', [
      'https://cdn.example/existing.jpg',
      'file:///local/a.jpg',
      'file:///local/b.jpg',
    ]);

    expect(urls).toEqual([
      'https://cdn.example/existing.jpg',
      'https://cdn.example/file%3A%2F%2F%2Flocal%2Fa.jpg',
      'https://cdn.example/file%3A%2F%2F%2Flocal%2Fb.jpg',
    ]);
    expect(uploadPhoto).toHaveBeenCalledTimes(2);
  });
});
