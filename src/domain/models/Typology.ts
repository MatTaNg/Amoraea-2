export type TypologyType = 'big_five' | 'attachment_style' | 'schwartz_values';

export interface Typology {
  id: string;
  profileId: string;
  typologyType: TypologyType;
  typologyData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TypologyUpdate {
  typologyData: Record<string, unknown>;
}

