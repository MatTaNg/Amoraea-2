jest.mock('@data/repos/editProfileRepo', () => ({
  saveEditProfilePrimaryPhoto: jest.fn(() => Promise.resolve()),
}));

import { saveEditProfilePrimaryPhoto } from '@data/repos/editProfileRepo';
import { PhotoUseCase } from '../PhotoUseCase';

describe('PhotoUseCase', () => {
  const profileRepository = {
    getProfilePhotos: jest.fn(),
    deletePhotoRecord: jest.fn(),
    uploadPhoto: jest.fn(),
    savePhotoRecord: jest.fn(),
    incrementPhotoDisplayOrders: jest.fn(),
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets primary photo via profiles repo when first photos are added', async () => {
    profileRepository.getProfilePhotos = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    profileRepository.uploadPhoto = jest.fn().mockResolvedValue({
      publicUrl: 'https://cdn.example.com/new.jpg',
      storagePath: 'user-1/x.jpg',
    });
    profileRepository.savePhotoRecord = jest.fn().mockResolvedValue({
      id: 'ph-1',
      profileId: 'user-1',
      publicUrl: 'https://cdn.example.com/new.jpg',
      storageOrder: 0,
    });

    const useCase = new PhotoUseCase(profileRepository);
    await useCase.addPhotos('user-1', ['file:///local.jpg']);

    expect(saveEditProfilePrimaryPhoto).toHaveBeenCalledWith(
      'user-1',
      'https://cdn.example.com/new.jpg',
    );
  });

  it('updates primary via profiles repo when removing current primary', async () => {
    profileRepository.getProfilePhotos = jest.fn().mockResolvedValue([
      { id: 'ph-1', publicUrl: 'https://cdn.example.com/a.jpg' },
      { id: 'ph-2', publicUrl: 'https://cdn.example.com/b.jpg' },
    ]);
    profileRepository.deletePhotoRecord = jest.fn().mockResolvedValue(undefined);

    const useCase = new PhotoUseCase(profileRepository);
    await useCase.removePhoto('user-1', 'ph-1', 'https://cdn.example.com/a.jpg');

    expect(saveEditProfilePrimaryPhoto).toHaveBeenCalledWith(
      'user-1',
      'https://cdn.example.com/b.jpg',
    );
  });
});
