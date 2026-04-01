import { CompatibilityRepository } from '@data/repositories/CompatibilityRepository';
import { Compatibility, CompatibilityUpdate } from '@domain/models/Compatibility';
import {
  computeFinalCompatibilityScore,
  computeStyleCompatibility,
  type StyleCompatibilityResult,
} from '@features/compatibility/styleCompatibility';

export class CompatibilityUseCase {
  constructor(private compatibilityRepository: CompatibilityRepository) {}

  async getCompatibility(userId: string): Promise<Compatibility | null> {
    return this.compatibilityRepository.getCompatibility(userId);
  }

  async upsertCompatibility(userId: string, update: CompatibilityUpdate): Promise<Compatibility> {
    return this.compatibilityRepository.upsertCompatibility(userId, update);
  }

  async computeStyleCompatibility(userIdA: string, userIdB: string): Promise<StyleCompatibilityResult> {
    return computeStyleCompatibility(userIdA, userIdB);
  }

  computeCombinedCompatibilityScore(params: {
    attachmentScore: number;
    valuesScore: number;
    semanticScore: number;
    styleScore: number;
    styleConfidence: number;
    dealbreakerMultiplier: number;
  }): number {
    return computeFinalCompatibilityScore(params);
  }
}

