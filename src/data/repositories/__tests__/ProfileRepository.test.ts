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

import { supabase } from '@data/supabase/client';
import { ProfileRepository } from '../ProfileRepository';

const baseUserRow = {
  id: 'user-1',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-02T00:00:00.000Z',
  onboarding_completed: false,
  onboarding_step: 1,
  name: 'Test',
  display_name: 'Test',
  age: 30,
  gender: 'man',
  attracted_to: ['woman'],
  height_centimeters: 180,
  occupation: 'Dev',
  location_latitude: 1,
  location_longitude: 2,
  location_label: 'NYC',
  primary_photo_url: null,
  profile_prompts: null,
  onboarding_stage: 'interview',
  application_status: 'pending',
  profile_visible: false,
  basic_info: null,
  gate1_score: null,
  gate2_psychometrics: null,
  gate3_compatibility: null,
  psychometrics_progress: null,
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
    it('maps DB gender and location into the Profile model', async () => {
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
      expect(p!.location).toEqual({
        latitude: 1,
        longitude: 2,
        label: 'NYC',
      });
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
    it('persists mapped fields and returns mapToProfile result', async () => {
      const upsert = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: { ...baseUserRow, name: 'Updated', gender: 'woman' },
              error: null,
            })
          ),
        })),
      }));

      (supabase.from as jest.Mock).mockReturnValue({
        upsert,
      });

      const p = await repo.upsertProfile('user-1', {
        name: 'Updated',
        onboardingStep: 2,
        gender: 'Woman',
      });

      expect(upsert).toHaveBeenCalled();
      const payload = upsert.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.display_name).toBe('Updated');
      expect(payload.onboarding_step).toBe(2);
      expect(payload.gender).toBe('woman');
      expect(p.name).toBe('Updated');
      expect(p.gender).toBe('Woman');
    });

    it('throws with Supabase details when upsert fails', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: {
                  message: 'violates constraint',
                  details: 'detail',
                  hint: 'hint',
                },
              })
            ),
          })),
        })),
      });

      await expect(
        repo.upsertProfile('user-1', { name: 'X' })
      ).rejects.toThrow(/Failed to upsert profile/);
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
