import * as Location from 'expo-location';
import {
  formatPlaceLabelFromAddress,
  reverseGeocodeCoordinates,
} from '@/shared/utils/geocoding';
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

    const { latitude, longitude } = location.coords;
    let label: string | null = null;

    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (address) {
        label = formatPlaceLabelFromAddress({
          city: address.city,
          town: address.district,
          subregion: address.subregion,
          region: address.region,
          state: address.region,
          country: address.country,
        });
      }
    } catch {
      // Fall through to network reverse geocode below.
    }

    if (!label) {
      try {
        label = await reverseGeocodeCoordinates(latitude, longitude);
      } catch {
        // ignore
      }
    }

    return {
      latitude,
      longitude,
      label,
    };
  }
}
