import { gatherParallelStreamingTtsPlaybackTelemetry } from '../sessionAudioTelemetry';
import { buildWebAudioRouteChangedEventData } from '../webMediaDeviceAudioRoute';

describe('gatherParallelStreamingTtsPlaybackTelemetry', () => {
  it('tags parallel streaming playback with route fields and pipeline metadata', () => {
    const payload = gatherParallelStreamingTtsPlaybackTelemetry({
      ttsPlaybackActiveImmediatelyPrior: false,
      afterRecording: true,
      charCount: 120,
      momentNumber: 1,
      scenarioNumber: 2,
      prefetchedMpeg: true,
      htmlAudioVolume: 1,
    });
    expect(payload.tts_pipeline).toBe('parallel_streaming');
    expect(payload.playback_strategy).toBe('buffered_complete');
    expect(payload.after_recording).toBe(true);
    expect(payload.prefetched_mpeg).toBe(true);
    expect(payload.html_audio_volume).toBe(1);
    expect(payload.audio_output_route).toBeDefined();
  });
});

describe('buildWebAudioRouteChangedEventData', () => {
  it('returns null when route unchanged', () => {
    expect(
      buildWebAudioRouteChangedEventData(
        {
          changed: false,
          previous: null,
          inference: {
            input_route: 'default',
            output_route: 'speaker',
            headphones_connected: false,
            devices_audit: [],
            headphone_detection_status: 'ok',
            enumerate_devices_result: 'ok',
            time_since_permission_granted_ms: 1000,
          },
        },
        { source: 'parallel_tts_chunk' },
      ),
    ).toBeNull();
  });

  it('builds session log payload when output route changes', () => {
    const data = buildWebAudioRouteChangedEventData(
      {
        changed: true,
        previous: { input_route: 'default', output_route: 'unknown' },
        inference: {
          input_route: 'default',
          output_route: 'speaker',
          headphones_connected: false,
          devices_audit: [],
          headphone_detection_status: 'ok',
          enumerate_devices_result: 'ok',
          time_since_permission_granted_ms: 1000,
        },
      },
      { source: 'parallel_tts_after_recording', moment_number: 1 },
    );
    expect(data).toMatchObject({
      previous_output_route: 'unknown',
      new_output_route: 'speaker',
      source: 'parallel_tts_after_recording',
      moment_number: 1,
    });
    expect(data?.timestamp).toBeTruthy();
  });
});
