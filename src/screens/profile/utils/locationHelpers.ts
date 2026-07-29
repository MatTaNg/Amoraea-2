import { useState, useCallback } from 'react';
import type { Location } from '@domain/models/Profile';
import { looksLikeRawCoordinates, reverseGeocodeCoordinates } from '@/shared/utils/geocoding';
import { LocationPermissionService } from '@utilities/permissions/LocationPermissionService';

const locationPermissionService = new LocationPermissionService();

async function fetchMyLocation(): Promise<Location | null> {
  try {
    const granted = await locationPermissionService.requestPermission();
    if (!granted) return null;
    return await locationPermissionService.getCurrentLocation();
  } catch {
    return null;
  }
}

/**
 * Request foreground location permission, read position, reverse-geocode when available.
 * Returns a city/state place label in English — never raw coordinates.
 */
export async function requestMyLocationLabel(): Promise<string | null> {
  const loc = await fetchMyLocation();
  if (!loc) return null;

  const label = loc.label?.trim();
  if (label && !looksLikeRawCoordinates(label)) return label;

  const fallbackLabel = await reverseGeocodeCoordinates(loc.latitude, loc.longitude);
  if (fallbackLabel?.trim() && !looksLikeRawCoordinates(fallbackLabel)) {
    return fallbackLabel.trim();
  }

  return null;
}

export function useMyLocation(): {
  loading: boolean;
  coords: { latitude: number; longitude: number } | null;
  request: () => Promise<void>;
} {
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const request = useCallback(async () => {
    setLoading(true);
    try {
      const loc = await fetchMyLocation();
      if (loc) setCoords({ latitude: loc.latitude, longitude: loc.longitude });
      else setCoords(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, coords, request };
}
