import { TypologyRepository } from '@data/repositories/TypologyRepository';
import { Typology, TypologyType, TypologyUpdate } from '@domain/models/Typology';

export class TypologyUseCase {
  constructor(private typologyRepository: TypologyRepository) {}

  async getTypology(userId: string, typologyType: TypologyType): Promise<Typology | null> {
    return this.typologyRepository.getTypology(userId, typologyType);
  }

  async upsertTypology(userId: string, typologyType: TypologyType, update: TypologyUpdate): Promise<Typology> {
    return this.typologyRepository.upsertTypology(userId, typologyType, update);
  }
}

