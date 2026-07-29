import { getHobbyById, normalizeHobbyId } from '@/shared/constants/hobbies';

/** Comma-separated hobby ids stored on profile (`hobbies` field). */
export function hobbiesStringToIds(raw: string | null | undefined): string[] {
  if (raw == null) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const part of String(raw).split(',')) {
    const normalized = normalizeHobbyId(part.trim());
    if (!normalized || seen.has(normalized) || !getHobbyById(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }
  return ordered;
}

export function hobbiesIdsToString(ids: string[]): string {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    const normalized = normalizeHobbyId(String(id ?? '').trim());
    if (!normalized || seen.has(normalized) || !getHobbyById(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }
  return ordered.join(',');
}
