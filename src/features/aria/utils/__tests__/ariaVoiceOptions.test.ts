import * as Speech from 'expo-speech';
import { getAriaVoiceOptions, getPreferredAriaVoiceGender } from '../ariaVoiceOptions';

jest.mock('expo-speech', () => ({
  getAvailableVoicesAsync: jest.fn(),
}));

const getVoices = Speech.getAvailableVoicesAsync as jest.MockedFunction<typeof Speech.getAvailableVoicesAsync>;

describe('ariaVoiceOptions', () => {
  describe('getPreferredAriaVoiceGender', () => {
    it('uses opposite gender for Man and Woman; defaults female for Non-binary and null', () => {
      expect(getPreferredAriaVoiceGender('Man')).toBe('female');
      expect(getPreferredAriaVoiceGender('Woman')).toBe('male');
      expect(getPreferredAriaVoiceGender('Non-binary')).toBe('female');
      expect(getPreferredAriaVoiceGender(null)).toBe('female');
    });
  });

  describe('getAriaVoiceOptions', () => {
    beforeEach(() => {
      getVoices.mockResolvedValue([
        {
          identifier: 'com.apple.voice.Samantha',
          name: 'Samantha',
          language: 'en-US',
          localService: true,
        } as Speech.Voice,
      ]);
    });

    it('returns warm TTS defaults and prefers a voice when available', async () => {
      const o = await getAriaVoiceOptions('Man');
      expect(o.language).toBe('en-US');
      expect(o.rate).toBeCloseTo(0.78, 2);
      expect(o.pitch).toBeCloseTo(0.95, 2);
      expect(o.volume).toBe(1);
      expect(o.voice).toBeDefined();
    });

    it('falls back gracefully when getAvailableVoicesAsync throws', async () => {
      getVoices.mockRejectedValueOnce(new Error('no voices'));
      const o = await getAriaVoiceOptions('Woman');
      expect(o.voice).toBeUndefined();
      expect(o.language).toBe('en-US');
    });
  });
});
