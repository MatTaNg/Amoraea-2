import { NativeModules, Platform } from 'react-native';

/** Regions that commonly use imperial units for body measurements. */
export const IMPERIAL_UNIT_REGIONS = new Set(['US', 'LR', 'MM']);

export function getDeviceLocaleTag(): string | undefined {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    return navigator.language;
  }

  const settings = NativeModules.SettingsManager?.settings;
  if (settings?.AppleLocale) return String(settings.AppleLocale);
  if (Array.isArray(settings?.AppleLanguages) && settings.AppleLanguages[0]) {
    return String(settings.AppleLanguages[0]);
  }

  const androidLocale = NativeModules.I18nManager?.localeIdentifier;
  if (androidLocale) return String(androidLocale);

  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

export function getLocaleRegion(localeTag?: string): string | undefined {
  const tag = (localeTag ?? getDeviceLocaleTag())?.trim();
  if (!tag) return undefined;

  try {
    const locale = new Intl.Locale(tag.replace(/_/g, '-'));
    if (locale.region) return locale.region.toUpperCase();
  } catch {
    // fall through to manual parse
  }

  const parts = tag.replace(/_/g, '-').split('-');
  if (parts.length >= 2) {
    const region = parts[parts.length - 1];
    if (/^[a-zA-Z]{2}$/.test(region)) return region.toUpperCase();
  }
  return undefined;
}

export function prefersImperialUnits(localeTag?: string): boolean {
  const region = getLocaleRegion(localeTag);
  return region != null && IMPERIAL_UNIT_REGIONS.has(region);
}
