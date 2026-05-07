const NOMINATIM_USER_AGENT = 'AmoraeaApp/1.0 (contact@amoraea.com)';

export type NominatimPlaceSuggestion = { label: string };

/**
 * Forward place search via OpenStreetMap Nominatim (debounced by caller).
 * @see https://nominatim.org/release-docs/develop/api/Search/
 */
export async function nominatimSearchPlaces(
  query: string,
  limit = 8
): Promise<NominatimPlaceSuggestion[]> {
  const q = query.trim();
  if (!q) return [];

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    q
  )}&format=json&limit=${encodeURIComponent(String(limit))}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': NOMINATIM_USER_AGENT },
  });
  if (!res.ok) return [];

  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];

  const out: NominatimPlaceSuggestion[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const display = (item as { display_name?: unknown }).display_name;
    if (typeof display !== 'string' || !display.trim()) continue;
    out.push({ label: display.trim() });
  }
  return out;
}
