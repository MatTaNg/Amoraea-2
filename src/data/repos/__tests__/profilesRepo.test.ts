jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

jest.mock('@/shared/utils/accountGender', () => ({
  fetchAccountGenderDb: jest.fn().mockResolvedValue(undefined),
}));

import { supabase } from '@data/supabase/client';
import { profilesRepo } from '../profilesRepo';

function mockProfilesSelect(row: Record<string, unknown> | null, error: { message: string } | null = null) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: jest.fn(() => Promise.resolve({ data: row, error })),
      })),
    })),
  };
}

function mockProfilePhotosSelect(urls: string[]) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() =>
          Promise.resolve({
            data: urls.map((public_url) => ({ public_url })),
            error: null,
          }),
        ),
      })),
    })),
  };
}

describe('profilesRepo.getProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });
  });

  it('merges profile_json with top-level row fields', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return mockProfilesSelect({
          id: 'user-1',
          email: 'a@b.com',
          display_name: 'Alex',
          profile_json: { age: 29, gender: 'woman', occupation: 'Dev' },
        });
      }
      if (table === 'profile_photos') return mockProfilePhotosSelect([]);
      return mockProfilesSelect(null);
    });

    const result = await profilesRepo.getProfile('user-1');
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      age: 29,
      gender: 'woman',
      occupation: 'Dev',
      display_name: 'Alex',
    });
  });

  it('merges profile_photos URLs into photos array', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return mockProfilesSelect({
          id: 'user-1',
          profile_json: { photos: [] },
        });
      }
      if (table === 'profile_photos') {
        return mockProfilePhotosSelect(['https://cdn.example.com/1.jpg']);
      }
      return mockProfilesSelect(null);
    });

    const result = await profilesRepo.getProfile('user-1');
    expect(result.success).toBe(true);
    expect(result.data?.photos).toEqual(['https://cdn.example.com/1.jpg']);
  });
});

describe('profilesRepo.updateProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('upserts merged profile_json and requires email', async () => {
    const upsert = jest.fn(() => Promise.resolve({ error: null }));
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          ...mockProfilesSelect({
            id: 'user-1',
            email: 'user@test.com',
            profile_json: { name: 'Old' },
            avatar_url: 'https://old.jpg',
          }),
          upsert,
        };
      }
      return mockProfilePhotosSelect([]);
    });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@test.com', user_metadata: {} } },
    });

    const result = await profilesRepo.updateProfile('user-1', {
      age: 30,
      primaryPhotoUrl: 'https://new.jpg',
    });

    expect(result.success).toBe(true);
    const upsertPayload = upsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(upsertPayload.id).toBe('user-1');
    expect(upsertPayload.email).toBe('user@test.com');
    expect(upsertPayload.profile_json).toMatchObject({
      name: 'Old',
      age: 30,
      primaryPhotoUrl: 'https://new.jpg',
    });
    expect(upsertPayload.avatar_url).toBe('https://old.jpg');
  });

  it('returns error when no email is available', async () => {
    (supabase.from as jest.Mock).mockReturnValue(
      mockProfilesSelect({ id: 'user-1', profile_json: {} }),
    );
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });

    const result = await profilesRepo.updateProfile('user-1', { age: 25 });
    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/no email/i);
  });

  it('falls back to auth user_metadata overlay when profile_json column missing', async () => {
    const updateUser = jest.fn(() => Promise.resolve({ error: null }));
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'u@test.com',
          user_metadata: { dating_profile_overlay: { city: 'NYC' } },
        },
      },
    });
    (supabase.auth.updateUser as jest.Mock).mockImplementation(updateUser);

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          ...mockProfilesSelect({ id: 'user-1', email: 'u@test.com', profile_json: { city: 'NYC' } }),
          upsert: jest.fn(() =>
            Promise.resolve({
              error: {
                code: 'PGRST204',
                message: "Could not find the 'profile_json' column of 'profiles' in the schema cache",
              },
            }),
          ),
        };
      }
      return mockProfilePhotosSelect([]);
    });

    const result = await profilesRepo.updateProfile('user-1', { occupation: 'Teacher' });
    expect(result.success).toBe(true);
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dating_profile_overlay: expect.objectContaining({
            city: 'NYC',
            occupation: 'Teacher',
          }),
        }),
      }),
    );
  });
});

describe('profilesRepo.ensureProfile', () => {
  it('inserts a row when missing and re-fetches', async () => {
    const upsert = jest.fn(() => Promise.resolve({ error: null }));
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          ...mockProfilesSelect({
            id: 'user-1',
            email: 'new@test.com',
            profile_json: {},
          }),
          upsert,
        };
      }
      if (table === 'profile_photos') return mockProfilePhotosSelect([]);
      return mockProfilesSelect(null);
    });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });

    const result = await profilesRepo.ensureProfile('user-1', 'new@test.com');
    expect(result.success).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        email: 'new@test.com',
        display_name: 'new',
      }),
      { onConflict: 'id' },
    );
  });
});
