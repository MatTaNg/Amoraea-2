import { CompatibilityRepository } from '@data/repositories/CompatibilityRepository';
import { Compatibility, CompatibilityUpdate } from '@domain/models/Compatibility';
import {
  computeSexualCommunicationCompatibilityAdjustment,
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
  sexualCommunicationAdjustment?: number;
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

  /** Fetches sexual communication scores and applies the soft pair adjustment. */
  async computeCombinedCompatibilityScoreForPair(
    userIdA: string,
    userIdB: string,
    params: Omit<CombinedCompatibilityParams, 'sexualCommunicationAdjustment'>,
  ): Promise<number> {
    const { adjustment } = await computeSexualCommunicationCompatibilityAdjustment(userIdA, userIdB);
    return computeFinalCompatibilityScore({ ...params, sexualCommunicationAdjustment: adjustment });
  }
}
