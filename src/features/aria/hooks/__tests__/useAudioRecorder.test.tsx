import { renderHook, act } from '@testing-library/react-native';
import { Audio } from 'expo-av';
import { useAudioRecorder } from '../useAudioRecorder';

jest.mock('expo-av', () => ({
  Audio: {
    setIsEnabledAsync: jest.fn(() => Promise.resolve()),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    Recording: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          recording: {
            stopAndUnloadAsync: jest.fn(() => Promise.resolve()),
            getURI: () => 'file:///tmp/recording.m4a',
          },
        })
      ),
    },
    AndroidOutputFormat: { MPEG_4: 0 },
    AndroidAudioEncoder: { AAC: 0 },
    IOSOutputFormat: { MPEG4AAC: 0 },
    IOSAudioQuality: { HIGH: 127 },
  },
}));

jest.mock('@features/aria/utils/audioModeHelpers', () => ({
  setRecordingMode: jest.fn(() => Promise.resolve()),
  setPlaybackMode: jest.fn(() => Promise.resolve()),
  transitionFromRecordingToPlaybackNative: jest.fn(() => Promise.resolve()),
  logAndApplyPlaybackModeForTts: jest.fn(() => Promise.resolve()),
}));

global.fetch = jest.fn(() =>
  Promise.resolve({
    blob: () => Promise.resolve(new Blob([], { type: 'audio/m4a' })),
  })
) as jest.Mock;

const requestPermissionsAsync = Audio.requestPermissionsAsync as jest.MockedFunction<
  typeof Audio.requestPermissionsAsync
>;
const createAsync = Audio.Recording.createAsync as jest.MockedFunction<
  typeof Audio.Recording.createAsync
>;

describe('useAudioRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    createAsync.mockResolvedValue({
      recording: {
        stopAndUnloadAsync: jest.fn(() => Promise.resolve()),
        getURI: () => 'file:///tmp/recording.m4a',
      },
    });
  });

  it('exposes initial idle state', () => {
    const { result } = renderHook(() => useAudioRecorder({}));
    expect(result.current.isRecording).toBe(false);
    expect(result.current.permissionStatus).toBe(null);
  });

  it('requestPermission marks granted on native', async () => {
    const { result } = renderHook(() => useAudioRecorder({}));
    await act(async () => {
      const ok = await result.current.requestPermission();
      expect(ok).toBe(true);
    });
    expect(result.current.permissionStatus).toBe('granted');
    expect(requestPermissionsAsync).toHaveBeenCalled();
  });

  it('startRecording sets isRecording after native createAsync', async () => {
    const { result } = renderHook(() => useAudioRecorder({}));
    await act(async () => {
      await result.current.requestPermission();
    });
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);
    expect(createAsync).toHaveBeenCalled();
  });

  it('requestPermission reflects denied status', async () => {
    requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    const { result } = renderHook(() => useAudioRecorder({}));
    await act(async () => {
      const ok = await result.current.requestPermission();
      expect(ok).toBe(false);
    });
    expect(result.current.permissionStatus).toBe('denied');
  });

  it('stopRecording clears isRecording after native stop', async () => {
    const { result } = renderHook(() => useAudioRecorder({}));
    await act(async () => {
      await result.current.requestPermission();
    });
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);
    await act(async () => {
      await result.current.stopRecording();
    });
    expect(result.current.isRecording).toBe(false);
  });
});
