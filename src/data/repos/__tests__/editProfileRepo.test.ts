jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@data/repos/profilesRepo', () => ({
  profilesRepo: {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
  },
}));

jest.mock('@data/repos/usersInterviewRepo', () => ({
  updateUserInterviewApplication: jest.fn(() => Promise.resolve()),
}));

import { supabase } from '@data/supabase/client';
import { profilesRepo } from '@data/repos/profilesRepo';
import { updateUserInterviewApplication } from '@data/repos/usersInterviewRepo';
import {
  applyProfileUpdate,
  loadEditProfileSnapshot,
  saveEditProfileLocation,
  saveEditProfilePrimaryPhoto,
  saveEditProfilePrompts,
} from '../editProfileRepo';

describe('loadEditProfileSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockUsersRow(row: Record<string, unknown> | null, error: { message: string } | null = null) {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => Promise.resolve({ data: row, error })),
        })),
      })),
    });
  }

  it('reads demographics from profile_json and prompts from users', async () => {
    (profilesRepo.getProfile as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        name: 'Sam',
        age: 28,
        gender: 'man',
        attractedTo: ['Women'],
        height_cm: 175,
        occupation: 'Engineer',
        avatar_url: 'https://cdn.example.com/a.jpg',
      },
    });
    mockUsersRow({
      profile_prompts: [{ promptId: 'p1', answer: 'Hello' }],
      basic_info: { firstName: 'Sam', age: 28, gender: '', attractedTo: [], locationCity: '', locationCountry: '', photoUrl: '', heightCm: 0 },
    });

    const snap = await loadEditProfileSnapshot('user-1');

    expect(snap).toEqual(
      expect.objectContaining({
        name: 'Sam',
        age: 28,
        gender: 'Man',
        attractedTo: ['Women'],
        heightCentimeters: 175,
        occupation: 'Engineer',
        primaryPhotoUrl: 'https://cdn.example.com/a.jpg',
        prompts: [{ promptId: 'p1', answer: 'Hello' }],
      }),
    );
    expect(supabase.from).toHaveBeenCalledWith('users');
  });

  it('returns null when profile and users row are both missing', async () => {
    (profilesRepo.getProfile as jest.Mock).mockResolvedValue({ success: false, error: new Error('no profile') });
    mockUsersRow(null);

    await expect(loadEditProfileSnapshot('user-1')).resolves.toBeNull();
  });

  it('throws when users select fails', async () => {
    (profilesRepo.getProfile as jest.Mock).mockResolvedValue({ success: true, data: { name: 'X' } });
    mockUsersRow(null, { message: 'permission denied' });

    await expect(loadEditProfileSnapshot('user-1')).rejects.toThrow('permission denied');
  });

  it('uses basic_info age when profile_json has no age', async () => {
    (profilesRepo.getProfile as jest.Mock).mockResolvedValue({ success: true, data: { name: 'Pat' } });
    mockUsersRow({
      profile_prompts: null,
      basic_info: {
        firstName: 'Pat',
        age: 31,
        gender: '',
        attractedTo: [],
        locationCity: '',
        locationCountry: '',
        photoUrl: '',
        heightCm: 0,
      },
    });

    const snap = await loadEditProfileSnapshot('user-1');
    expect(snap?.age).toBe(31);
  });
});

describe('applyProfileUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (profilesRepo.updateProfile as jest.Mock).mockResolvedValue({ success: true, data: {} });
  });

  it('writes dating fields to profiles.profile_json with mapped gender and attraction', async () => {
    await applyProfileUpdate('user-1', {
      name: 'Alex',
      age: 30,
      gender: 'Woman',
      attractedTo: ['Men', 'Women'],
      heightCentimeters: 180,
      occupation: 'Dev',
    });

    expect(profilesRepo.updateProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'Alex',
        displayName: 'Alex',
        age: 30,
        gender: 'woman',
        attractedTo: ['Men', 'Women'],
        lookingFor: ['Men', 'Women'],
        height_cm: 180,
        heightCentimeters: 180,
        occupation: 'Dev',
      }),
    );
    expect(updateUserInterviewApplication).not.toHaveBeenCalled();
  });

  it('routes prompts and gates to users via updateUserInterviewApplication', async () => {
    await applyProfileUpdate('user-1', {
      prompts: [{ promptId: 'p1', answer: 'A' }],
      onboardingStage: 'interview',
      applicationStatus: 'pending',
    });

    expect(profilesRepo.updateProfile).not.toHaveBeenCalled();
    expect(updateUserInterviewApplication).toHaveBeenCalledWith('user-1', {
      prompts: [{ promptId: 'p1', answer: 'A' }],
      onboardingStage: 'interview',
      applicationStatus: 'pending',
    });
  });

  it('updates location and primary photo through profilesRepo', async () => {
    await applyProfileUpdate('user-1', {
      location: { latitude: 40.7, longitude: -74.0, label: 'NYC' },
      primaryPhotoUrl: 'https://cdn.example.com/p.jpg',
    });

    expect(profilesRepo.updateProfile).toHaveBeenCalledTimes(2);
    expect(profilesRepo.updateProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        location_latitude: 40.7,
        location_longitude: -74.0,
        location_label: 'NYC',
        location: 'NYC',
      }),
    );
    expect(profilesRepo.updateProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        primaryPhotoUrl: 'https://cdn.example.com/p.jpg',
        avatar_url: 'https://cdn.example.com/p.jpg',
      }),
    );
  });

  it('throws when profilesRepo.updateProfile fails', async () => {
    (profilesRepo.updateProfile as jest.Mock).mockResolvedValue({
      success: false,
      error: new Error('profile_json missing'),
    });

    await expect(applyProfileUpdate('user-1', { name: 'X' })).rejects.toThrow('profile_json missing');
  });
});

describe('saveEditProfilePrompts', () => {
  it('delegates to updateUserInterviewApplication', async () => {
    const prompts = [{ promptId: 'p2', answer: 'B' }];
    await saveEditProfilePrompts('user-1', prompts);
    expect(updateUserInterviewApplication).toHaveBeenCalledWith('user-1', { prompts });
  });
});

describe('saveEditProfilePrimaryPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when update fails', async () => {
    (profilesRepo.updateProfile as jest.Mock).mockResolvedValue({
      success: false,
      error: new Error('no email'),
    });
    await expect(saveEditProfilePrimaryPhoto('user-1', 'https://x.jpg')).rejects.toThrow('no email');
  });
});

describe('saveEditProfileLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (profilesRepo.updateProfile as jest.Mock).mockResolvedValue({ success: true, data: {} });
  });

  it('persists coordinates and label', async () => {
    await saveEditProfileLocation('user-1', {
      latitude: 1,
      longitude: 2,
      label: 'Somewhere',
    });
    expect(profilesRepo.updateProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        location_latitude: 1,
        location_longitude: 2,
        location_label: 'Somewhere',
      }),
    );
  });
});
