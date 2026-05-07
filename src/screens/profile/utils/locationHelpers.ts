import { useState, useCallback } from 'react';
import type { Location } from '@domain/models/Profile';
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
 * For use in event handlers and effects — not a React hook.
 */
export async function requestMyLocationLabel(): Promise<string | null> {
  const loc = await fetchMyLocation();
  if (!loc) return null;
  if (loc.label?.trim()) return loc.label.trim();
  return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
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
