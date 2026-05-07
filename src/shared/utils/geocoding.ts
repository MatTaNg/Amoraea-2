const NOMINATIM_USER_AGENT = 'AmoraeaApp/1.0 (contact@amoraea.com)';

export type GeocodeCoordinates = { latitude: number; longitude: number };

/** Forward geocode a free-text place string via Nominatim (first hit). */
export async function geocodeLocation(query: string): Promise<GeocodeCoordinates | null> {
  const q = query.trim();
  if (!q) return null;

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    q,
  )}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: { 'User-Agent': NOMINATIM_USER_AGENT },
  });
  if (!res.ok) return null;

  const data: unknown = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const first = data[0];
  if (!first || typeof first !== 'object') return null;
  const lat = Number((first as { lat?: unknown }).lat);
  const lon = Number((first as { lon?: unknown }).lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}
