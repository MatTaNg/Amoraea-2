jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'communication_style_profiles') {
        return {
          select: jest.fn(() => ({
            in: jest.fn(() =>
              Promise.resolve({
                data: [],
                error: null,
              })
            ),
          })),
        };
      }
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
        upsert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      };
    }),
  },
}));

import { CompatibilityUseCase } from '../CompatibilityUseCase';
import { CompatibilityRepository } from '@data/repositories/CompatibilityRepository';
import type { Compatibility } from '@domain/models/Compatibility';

jest.mock('@data/repositories/CompatibilityRepository');

describe('CompatibilityUseCase', () => {
  let useCase: CompatibilityUseCase;
  let mockRepo: jest.Mocked<CompatibilityRepository>;

  beforeEach(() => {
    mockRepo = new CompatibilityRepository() as jest.Mocked<CompatibilityRepository>;
    useCase = new CompatibilityUseCase(mockRepo);
  });

  it('getCompatibility delegates to repository', async () => {
    mockRepo.getCompatibility.mockResolvedValue(null);
    await expect(useCase.getCompatibility('user-1')).resolves.toBeNull();
    expect(mockRepo.getCompatibility).toHaveBeenCalledWith('user-1');
  });

  it('upsertCompatibility delegates to repository', async () => {
    const row: Compatibility = {
      id: 'c1',
      profileId: 'user-1',
      compatibilityData: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockRepo.upsertCompatibility.mockResolvedValue(row);
    const out = await useCase.upsertCompatibility('user-1', { compatibilityData: {} });
    expect(out).toEqual(row);
  });

  it('computeCombinedCompatibilityScore uses the same formula as computeFinalCompatibilityScore', () => {
    const score = useCase.computeCombinedCompatibilityScore({
      attachmentScore: 1,
      valuesScore: 1,
      semanticScore: 1,
      styleScore: 1,
      styleConfidence: 1,
      dealbreakerMultiplier: 1,
    });
    expect(score).toBeCloseTo(1, 12);
  });

  it('computeStyleCompatibility returns neutral style when profiles are missing (Supabase empty)', async () => {
    const result = await useCase.computeStyleCompatibility('a', 'b');
    expect(result.score).toBe(0.5);
    expect(result.explanation).toMatch(/limited/i);
  });
});
