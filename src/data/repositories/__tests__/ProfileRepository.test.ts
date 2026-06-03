jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
    storage: {
      from: jest.fn(),
    },
  },
}));

jest.mock('@data/repos/editProfileRepo', () => ({
  applyProfileUpdate: jest.fn(() => Promise.resolve()),
  loadEditProfileSnapshot: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@data/repos/profilesRepo', () => ({
  profilesRepo: {
    ensureProfile: jest.fn(() => Promise.resolve({ success: true, data: {} })),
  },
}));

jest.mock('@data/repos/usersRoutingRepo', () => ({
  updateUserOnboardingFlags: jest.fn(() => Promise.resolve()),
}));

import { supabase } from '@data/supabase/client';
import { applyProfileUpdate } from '@data/repos/editProfileRepo';
import { updateUserOnboardingFlags } from '@data/repos/usersRoutingRepo';
import { ProfileRepository } from '../ProfileRepository';

const baseUserRow = {
  id: 'user-1',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-02T00:00:00.000Z',
  onboarding_completed: false,
  onboarding_step: 1,
  name: 'Test',
  display_name: 'Test',
  profile_prompts: null,
  onboarding_stage: 'interview',
  application_status: 'pending',
  basic_info: null,
};

describe('ProfileRepository', () => {
  let repo: ProfileRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ProfileRepository();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          user: { email: 'test@example.com', user_metadata: {} },
        },
      },
    });
  });

  describe('getProfile', () => {
    it('maps users interview fields; demographics come from profile_json merge', async () => {
      const { loadEditProfileSnapshot } = require('@data/repos/editProfileRepo');
      (loadEditProfileSnapshot as jest.Mock).mockResolvedValueOnce({
        name: 'Test',
        age: 30,
        gender: 'Man',
        attractedTo: ['Women'],
        heightCentimeters: 180,
        occupation: 'Dev',
        primaryPhotoUrl: null,
        prompts: [],
        basicInfo: null,
      });
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: { ...baseUserRow }, error: null })
            ),
          })),
        })),
      });

      const p = await repo.getProfile('user-1');
      expect(p).not.toBeNull();
      expect(p!.gender).toBe('Man');
      expect(p!.heightCentimeters).toBe(180);
      expect(p!.onboardingStage).toBe('interview');
    });

    it('returns null when the user row is missing', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      });

      await expect(repo.getProfile('none')).resolves.toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: null, error: { message: 'RLS' } })
            ),
          })),
        })),
      });

      await expect(repo.getProfile('user-1')).rejects.toThrow(/Failed to fetch profile/);
    });
  });

  describe('upsertProfile', () => {
    it('routes dating fields and onboarding flags through canonical repos', async () => {
      (applyProfileUpdate as jest.Mock).mockResolvedValue(undefined);
      (updateUserOnboardingFlags as jest.Mock).mockResolvedValue(undefined);
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({
                data: { ...baseUserRow, name: 'Updated' },
                error: null,
              }),
            ),
          })),
        })),
      });

      const p = await repo.upsertProfile('user-1', {
        name: 'Updated',
        onboardingStep: 2,
        gender: 'Woman',
      });

      expect(applyProfileUpdate).toHaveBeenCalledWith('user-1', {
        name: 'Updated',
        onboardingStep: 2,
        gender: 'Woman',
      });
      expect(updateUserOnboardingFlags).toHaveBeenCalledWith('user-1', { onboardingStep: 2 });
      expect(p.name).toBe('Updated');
    });

    it('throws when applyProfileUpdate fails', async () => {
      (applyProfileUpdate as jest.Mock).mockRejectedValue(new Error('violates constraint'));

      await expect(repo.upsertProfile('user-1', { name: 'X' })).rejects.toThrow(
        /Failed to upsert profile: violates constraint/,
      );
    });

    it('calls ensureProfile before dating field updates', async () => {
      const { profilesRepo } = require('@data/repos/profilesRepo');
      (applyProfileUpdate as jest.Mock).mockResolvedValue(undefined);
      (updateUserOnboardingFlags as jest.Mock).mockResolvedValue(undefined);
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: { ...baseUserRow }, error: null }),
            ),
          })),
        })),
      });

      await repo.upsertProfile('user-1', { age: 25 });

      expect(profilesRepo.ensureProfile).toHaveBeenCalledWith('user-1', 'test@example.com');
      expect(applyProfileUpdate).toHaveBeenCalledWith('user-1', { age: 25 });
    });

    it('does not call ensureProfile for interview-only updates', async () => {
      const { profilesRepo } = require('@data/repos/profilesRepo');
      (applyProfileUpdate as jest.Mock).mockResolvedValue(undefined);
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: { ...baseUserRow }, error: null }),
            ),
          })),
        })),
      });

      await repo.upsertProfile('user-1', {
        prompts: [{ promptId: 'p1', answer: 'x' }],
      });

      expect(profilesRepo.ensureProfile).not.toHaveBeenCalled();
    });
  });

  describe('profile photos & storage', () => {
    const photoRow = {
      id: 'ph-1',
      profile_id: 'user-1',
      storage_path: 'user-1/1.jpg',
      public_url: 'https://cdn.example.com/1.jpg',
      display_order: 0,
      created_at: '2024-01-01T00:00:00.000Z',
    };

    beforeEach(() => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          blob: () => Promise.resolve({ type: 'image/jpeg' }),
        })
      ) as unknown as typeof fetch;
    });

    it('getProfilePhotos maps rows and sorts query', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() =>
              Promise.resolve({
                data: [photoRow],
                error: null,
              })
            ),
          })),
        })),
      });

      const photos = await repo.getProfilePhotos('user-1');
      expect(photos).toHaveLength(1);
      expect(photos[0].id).toBe('ph-1');
      expect(photos[0].publicUrl).toBe(photoRow.public_url);
    });

    it('getProfilePhotos throws on Supabase error', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() =>
              Promise.resolve({ data: null, error: { message: 'nope' } })
            ),
          })),
        })),
      });

      await expect(repo.getProfilePhotos('user-1')).rejects.toThrow(/Failed to fetch photos/);
    });

    it('savePhotoRecord maps insert result', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({ data: photoRow, error: null })
            ),
          })),
        })),
      });

      const p = await repo.savePhotoRecord({
        profileId: 'user-1',
        storagePath: 'user-1/1.jpg',
        publicUrl: 'https://cdn.example.com/1.jpg',
        displayOrder: 0,
      });
      expect(p.id).toBe('ph-1');
      expect(p.displayOrder).toBe(0);
    });

    it('deletePhotoRecord propagates delete errors', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        delete: jest.fn(() => ({
          eq: jest.fn(() =>
            Promise.resolve({ error: { message: 'forbidden' } })
          ),
        })),
      });

      await expect(repo.deletePhotoRecord('ph-1')).rejects.toThrow(/Failed to delete photo/);
    });

    it('incrementPhotoDisplayOrders updates each photo', async () => {
      const updateEq = jest.fn(() => Promise.resolve({ error: null }));
      let listCalls = 0;
      (supabase.from as jest.Mock).mockImplementation(() => {
        listCalls += 1;
        if (listCalls === 1) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() =>
                  Promise.resolve({
                    data: [
                      { ...photoRow, id: 'a', display_order: 0 },
                      { ...photoRow, id: 'b', display_order: 1, profile_id: 'user-1' },
                    ],
                    error: null,
                  })
                ),
              })),
            })),
          };
        }
        return {
          update: jest.fn(() => ({
            eq: updateEq,
          })),
        };
      });

      await repo.incrementPhotoDisplayOrders('user-1', 2);
      expect(updateEq).toHaveBeenCalledTimes(2);
    });

    it('uploadPhoto uploads blob and returns public URL', async () => {
      const upload = jest.fn(() => Promise.resolve({ error: null }));
      const getPublicUrl = jest.fn(() => ({
        data: { publicUrl: 'https://cdn.example.com/u/x.jpg' },
      }));
      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload,
        getPublicUrl,
      });

      const out = await repo.uploadPhoto('user-1', 'file:///local/photo.jpg', 'pic.jpg');

      expect(upload).toHaveBeenCalled();
      expect(out.publicUrl).toBe('https://cdn.example.com/u/x.jpg');
      expect(out.storagePath).toMatch(/^user-1\/\d+\.jpg$/);
    });

    it('uploadPhoto throws when storage upload fails', async () => {
      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: jest.fn(() => Promise.resolve({ error: { message: 'quota' } })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })),
      });

      await expect(
        repo.uploadPhoto('user-1', 'file:///local/photo.jpg', 'pic.jpg')
      ).rejects.toThrow(/Failed to upload photo/);
    });
  });
});
