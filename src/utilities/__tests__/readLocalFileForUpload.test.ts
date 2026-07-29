import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import {
  inferImageContentType,
  readLocalFileForUpload,
} from '../readLocalFileForUpload';

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: jest.fn(),
}));

describe('readLocalFileForUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('inferImageContentType', () => {
    it('maps common extensions', () => {
      expect(inferImageContentType('photo.png', 'file:///x')).toBe('image/png');
      expect(inferImageContentType('photo.heic', 'file:///x')).toBe('image/heic');
      expect(inferImageContentType('photo.jpg', 'file:///x')).toBe('image/jpeg');
    });
  });

  describe('readLocalFileForUpload', () => {
    it('reads native URIs via FileSystem base64', async () => {
      (Platform as { OS: string }).OS = 'ios';
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('aGVsbG8=');

      const out = await readLocalFileForUpload('content://media/photo.jpg', 'photo.jpg');

      expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('content://media/photo.jpg', {
        encoding: 'base64',
      });
      expect(out.contentType).toBe('image/jpeg');
      expect(Array.from(out.body as Uint8Array)).toEqual([104, 101, 108, 108, 111]);
    });

    it('reads web URIs via fetch blob', async () => {
      (Platform as { OS: string }).OS = 'web';
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          blob: () => Promise.resolve({ type: 'image/png' }),
        }),
      ) as unknown as typeof fetch;

      const out = await readLocalFileForUpload('blob:http://localhost/x', 'photo.png');

      expect(fetch).toHaveBeenCalledWith('blob:http://localhost/x');
      expect(out.contentType).toBe('image/png');
      expect(out.body).toEqual({ type: 'image/png' });
    });
  });
});
