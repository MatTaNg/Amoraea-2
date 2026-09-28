import { CompatibilityRepository } from '@data/repositories/CompatibilityRepository';
import { Compatibility, CompatibilityUpdate } from '@domain/models/Compatibility';
import {
  computeStyleCompatibility,
  type StyleCompatibilityResult,
} from '@features/compatibility/styleCompatibility';
import { computeFinalCompatibilityScore } from '@features/compatibility/styleCompatibilityScore';

export type CombinedCompatibilityParams = {
  attachmentScore: number;
  valuesScore: number;
  semanticScore: number;
  styleScore: number;
  styleConfidence: number;
  dealbreakerMultiplier: number;
};

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

  computeCombinedCompatibilityScore(params: CombinedCompatibilityParams): number {
    return computeFinalCompatibilityScore(params);
  }

  /** Combined score for a pair. Sexual-communication means are not a ranking input. */
  async computeCombinedCompatibilityScoreForPair(
    _userIdA: string,
    _userIdB: string,
    params: CombinedCompatibilityParams,
  ): Promise<number> {
    return computeFinalCompatibilityScore(params);
  }
}
