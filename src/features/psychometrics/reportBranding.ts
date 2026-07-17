import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoModule = require('../../../assets/branding/amoraea-logo.png');

/** Logo URL or data URI for embedding in report HTML (PDF / print). */
export async function getReportLogoSrc(): Promise<string> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/amoraea-logo.png`;
    }
    return '/amoraea-logo.png';
  }

  try {
    const asset = Asset.fromModule(logoModule);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) {
      return '';
    }
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    console.warn('[ReportBranding] logo embed failed:', err);
    return '';
  }
}
