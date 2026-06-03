import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditProfileModal } from '../EditProfileModal';
import * as editProfileRepo from '@data/repos/editProfileRepo';

jest.mock('@data/repos/editProfileRepo');
jest.mock('@data/repositories/ProfileRepository', () => ({
  ProfileRepository: jest.fn().mockImplementation(() => ({
    getProfilePhotos: jest.fn(() => Promise.resolve([])),
  })),
}));
jest.mock('@domain/useCases/PhotoUseCase', () => ({
  PhotoUseCase: jest.fn().mockImplementation(() => ({
    pickPhotos: jest.fn(),
    addPhotos: jest.fn(),
    removePhoto: jest.fn(),
  })),
}));
jest.mock('@data/repositories/CompatibilityRepository');
jest.mock('@domain/useCases/CompatibilityUseCase', () => ({
  CompatibilityUseCase: jest.fn().mockImplementation(() => ({
    getCompatibility: jest.fn(() => Promise.resolve({ compatibilityData: { weight: '141_160' } })),
    upsertCompatibility: jest.fn(() => Promise.resolve()),
  })),
}));
jest.mock('@utilities/permissions/LocationPermissionService', () => ({
  LocationPermissionService: jest.fn().mockImplementation(() => ({
    requestPermission: jest.fn(),
    getCurrentLocation: jest.fn(),
  })),
}));
jest.mock('@/shared/components/HeightCmInput', () => ({
  HeightCmInput: () => null,
}));
jest.mock('@ui/components/SelectButton', () => ({ SelectButton: () => null }));
jest.mock('@ui/components/MultiSelectButton', () => ({ MultiSelectButton: () => null }));

const snapshot: editProfileRepo.EditProfileSnapshot = {
  name: 'Jordan',
  age: 28,
  gender: 'Woman',
  attractedTo: ['Men'],
  heightCentimeters: 170,
  occupation: 'Designer',
  primaryPhotoUrl: null,
  prompts: [],
  basicInfo: null,
};

function renderModal(onSaved = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EditProfileModal
        visible
        onClose={jest.fn()}
        userId="user-1"
        profile={null}
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  );
}

describe('EditProfileModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (editProfileRepo.loadEditProfileSnapshot as jest.Mock).mockResolvedValue(snapshot);
    (editProfileRepo.saveEditProfileDemographics as jest.Mock).mockResolvedValue(undefined);
  });

  it('loads edit profile snapshot when opened', async () => {
    renderModal();
    await waitFor(() => {
      expect(editProfileRepo.loadEditProfileSnapshot).toHaveBeenCalledWith('user-1');
    });
  });

  it('shows loaded name in the form', async () => {
    const { getByDisplayValue } = renderModal();
    await waitFor(() => {
      expect(getByDisplayValue('Jordan')).toBeTruthy();
    });
  });

  it('saves demographics via editProfileRepo on submit', async () => {
    const onSaved = jest.fn();
    const { getAllByText, getByDisplayValue } = renderModal(onSaved);

    await waitFor(() => expect(getByDisplayValue('Jordan')).toBeTruthy());

    const saveButtons = getAllByText('Save');
    fireEvent.press(saveButtons[saveButtons.length - 1]!);

    await waitFor(() => {
      expect(editProfileRepo.saveEditProfileDemographics).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          name: 'Jordan',
          age: 28,
          gender: 'Woman',
          occupation: 'Designer',
        }),
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });
});
