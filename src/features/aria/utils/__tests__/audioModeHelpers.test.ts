import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { logAndApplyPlaybackModeForTts, setPlaybackMode, setRecordingMode } from '../audioModeHelpers';

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

const setAudioModeAsync = Audio.setAudioModeAsync as jest.MockedFunction<typeof Audio.setAudioModeAsync>;

describe('audioModeHelpers', () => {
  const origOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: origOS });
    jest.clearAllMocks();
  });

  it('setPlaybackMode no-ops on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    await setPlaybackMode();
    expect(setAudioModeAsync).not.toHaveBeenCalled();
  });

  it('setPlaybackMode sets speaker-friendly mode on native', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    await setPlaybackMode();
    expect(setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      })
    );
  });

  it('setRecordingMode enables mic on native', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    await setRecordingMode();
    expect(setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsRecordingIOS: true,
      })
    );
  });

  it('logAndApplyPlaybackModeForTts skips setAudioModeAsync on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await logAndApplyPlaybackModeForTts('test');
    expect(setAudioModeAsync).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
