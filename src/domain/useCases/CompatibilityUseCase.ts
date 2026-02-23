import { CompatibilityRepository } from '@data/repositories/CompatibilityRepository';
import { Compatibility, CompatibilityUpdate } from '@domain/models/Compatibility';

export class CompatibilityUseCase {
  constructor(private compatibilityRepository: CompatibilityRepository) {}

  async getCompatibility(userId: string): Promise<Compatibility | null> {
    return this.compatibilityRepository.getCompatibility(userId);
  }

  async upsertCompatibility(userId: string, update: CompatibilityUpdate): Promise<Compatibility> {
    return this.compatibilityRepository.upsertCompatibility(userId, update);
  }
}

