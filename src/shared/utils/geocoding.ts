const NOMINATIM_USER_AGENT = 'AmoraeaApp/1.0 (contact@amoraea.com)';

export type GeocodeCoordinates = { latitude: number; longitude: number };

type AddressParts = Record<string, string | null | undefined>;

/** True when a stored location string is raw GPS coordinates, not a place name. */
export function looksLikeRawCoordinates(value: string): boolean {
  return /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(value.trim());
}

/** Human-readable place label (City, State) from geocoder address parts. */
export function formatPlaceLabelFromAddress(address: AddressParts): string | null {
  const city =
    pickAddressPart(address, [
      'city',
      'town',
      'village',
      'municipality',
      'suburb',
      'city_district',
      'hamlet',
      'locality',
    ]) ?? pickAddressPart(address, ['county', 'district']);
  const state = pickAddressPart(address, [
    'state',
    'region',
    'province',
    'state_district',
    'subregion',
  ]);
  const country = pickAddressPart(address, ['country']);

  if (city && state) return `${city}, ${state}`;
  if (city && country && city !== country) return `${city}, ${country}`;
  if (city) return city;
  if (state && country && state !== country) return `${state}, ${country}`;
  if (state) return state;
  return country;
}

function pickAddressPart(address: AddressParts, keys: string[]): string | null {
  for (const key of keys) {
    const value = address[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

/** Reverse geocode coordinates to an English place label via Nominatim. */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`;
  const res = await fetch(url, {
    headers: { 'User-Agent': NOMINATIM_USER_AGENT },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    address?: Record<string, string>;
    display_name?: string;
  };
  if (data?.address && typeof data.address === 'object') {
    const label = formatPlaceLabelFromAddress(data.address);
    if (label) return label;
  }
  if (typeof data?.display_name === 'string' && data.display_name.trim()) {
    return shortenDisplayName(data.display_name);
  }
  return null;
}

function shortenDisplayName(displayName: string): string | null {
  const parts = displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
  return parts[0] ?? null;
}

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
