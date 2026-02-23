export interface Compatibility {
  id: string;
  profileId: string;
  compatibilityData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CompatibilityUpdate {
  compatibilityData: Record<string, unknown>;
}

