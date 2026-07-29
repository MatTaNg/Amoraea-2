import { isStaleNativeRecorderError } from '../nativeRecorderErrors';

describe('isStaleNativeRecorderError', () => {
  it('matches recorder does not exist', () => {
    expect(isStaleNativeRecorderError(new Error('Recorder does not exist.'))).toBe(true);
  });

  it('matches already unloaded', () => {
    expect(isStaleNativeRecorderError(new Error('Recording has already been unloaded'))).toBe(true);
  });

  it('does not match permission errors', () => {
    expect(isStaleNativeRecorderError(new Error('Microphone permission denied'))).toBe(false);
  });
});
