import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { Location as LocationModel } from '@domain/models/Profile';

const NOMINATIM_USER_AGENT = 'AmoraeaApp/1.0 (contact@amoraea.com)';

/** Fallback reverse geocode for web when Expo returns no label (e.g. no Google API key). */
async function reverseGeocodeNominatim(lat: number, lon: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': NOMINATIM_USER_AGENT },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.display_name) return String(data.display_name);
  if (data?.address && typeof data.address === 'object') return buildLabelFromAddress(data.address);
  return null;
}

function buildLabelFromAddress(address: Record<string, string>): string {
  const parts: string[] = [];
  if (address.city) parts.push(address.city);
  else if (address.town) parts.push(address.town);
  else if (address.village) parts.push(address.village);
  if (address.state) parts.push(address.state);
  if (address.country) parts.push(address.country);
  return parts.length > 0 ? parts.join(', ') : '';
}

export class LocationPermissionService {
  async requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  async checkPermission(): Promise<boolean> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  }

  async getCurrentLocation(): Promise<LocationModel> {
    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      throw new Error('Location permission not granted');
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    let label: string | null = null;
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        const parts: string[] = [];
        if (address.city) parts.push(address.city);
        if (address.region) parts.push(address.region);
        if (address.country) parts.push(address.country);
        label = parts.length > 0 ? parts.join(', ') : null;
      }
    } catch (error) {
      // If reverse geocoding fails, we'll try fallback on web
    }

    // Web: Expo reverse geocode often returns empty without Google API key; use Nominatim fallback
    if (!label && typeof Platform !== 'undefined' && Platform.OS === 'web') {
      try {
        label = await reverseGeocodeNominatim(
          location.coords.latitude,
          location.coords.longitude,
        );
      } catch {
        // ignore
      }
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      label,
    };
  }
}

