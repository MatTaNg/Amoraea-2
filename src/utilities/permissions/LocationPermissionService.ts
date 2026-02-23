import * as Location from 'expo-location';
import { Location as LocationModel } from '@domain/models/Profile';

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
      // If reverse geocoding fails, we'll just use coordinates
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      label,
    };
  }
}

