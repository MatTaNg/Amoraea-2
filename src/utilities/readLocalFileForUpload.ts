import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export type LocalFileUploadPayload = {
  body: Blob | Uint8Array;
  contentType: string;
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Infer MIME type from a file name or URI when the picker does not provide one. */
export function inferImageContentType(fileName: string, fileUri: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase();
  const fromUri = fileUri.split('?')[0]?.split('.').pop()?.toLowerCase();
  const ext = fromName || fromUri || 'jpg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/** Read a local picker URI into bytes suitable for Supabase storage upload. */
export async function readLocalFileForUpload(
  fileUri: string,
  fileName: string,
  fallbackContentType?: string,
): Promise<LocalFileUploadPayload> {
  if (Platform.OS === 'web') {
    const response = await fetch(fileUri);
    if (!response.ok) {
      throw new Error(`Failed to read local file: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const contentType =
      blob.type || fallbackContentType || inferImageContentType(fileName, fileUri);
    return { body: blob, contentType };
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return {
    body: base64ToUint8Array(base64),
    contentType: fallbackContentType || inferImageContentType(fileName, fileUri),
  };
}
