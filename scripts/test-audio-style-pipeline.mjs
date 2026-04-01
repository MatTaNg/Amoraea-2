/**
 * Validates per-turn audio style pipeline behavior with deterministic scenarios.
 *
 * Scenarios covered:
 * 1) Successful turn processing after retries logs success and continues.
 * 2) Failed turn processing logs failure but does not throw.
 * 3) Session finalization computes duration-weighted averages + audio confidence.
 */

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearlyEqual(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) <= epsilon;
}

async function processTurnAudioWithRetry({
  maxRetries = 3,
  retryDelays = [1, 1, 1],
  submitAndExtract,
  writeSuccessRow,
  writeFailureRow,
}) {
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const features = await submitAndExtract(attempt);
      await writeSuccessRow(features);
      return { success: true, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt] ?? 1));
      }
    }
  }
  await writeFailureRow(lastError ? String(lastError.message ?? lastError) : 'Unknown error');
  return { success: false, attempts: maxRetries };
}

function finalizeAudioProfileFromTurns(turns) {
  const successful = turns.filter((t) => t.processing_status === 'success');
  const totalTurns = turns.length;
  if (successful.length === 0 || totalTurns === 0) {
    return { averaged: null, audio_confidence: 0 };
  }
  const totalDuration = successful.reduce((sum, t) => sum + (t.audio_duration_seconds || 1), 0);
  const weightedAverage = (field) =>
    successful.reduce((sum, t) => {
      const weight = (t.audio_duration_seconds || 1) / totalDuration;
      return sum + (t[field] || 0) * weight;
    }, 0);
  return {
    averaged: {
      pitch_mean: weightedAverage('pitch_mean'),
      pitch_range: weightedAverage('pitch_range'),
      speech_rate: weightedAverage('speech_rate'),
      pause_frequency: weightedAverage('pause_frequency'),
      energy_variation: weightedAverage('energy_variation'),
      emotional_expressiveness: weightedAverage('emotional_expressiveness'),
      warmth_score: weightedAverage('warmth_score'),
    },
    audio_confidence: successful.length / totalTurns,
  };
}

async function run() {
  // Scenario 1: retries succeed and success row is written.
  const scenario1Writes = [];
  let callCount = 0;
  const scenario1 = await processTurnAudioWithRetry({
    submitAndExtract: async () => {
      callCount += 1;
      if (callCount < 3) throw new Error('transient Hume failure');
      return { pitch_mean: 210, speech_rate: 138, warmth_score: 0.72 };
    },
    writeSuccessRow: async (features) => scenario1Writes.push({ type: 'success', features }),
    writeFailureRow: async (error) => scenario1Writes.push({ type: 'failed', error }),
  });
  assert(scenario1.success === true, 'Scenario 1 should succeed');
  assert(scenario1.attempts === 3, 'Scenario 1 should take 3 attempts');
  assert(scenario1Writes.length === 1 && scenario1Writes[0].type === 'success', 'Scenario 1 should write one success row');

  // Scenario 2: retries exhaust and failure row is written.
  const scenario2Writes = [];
  const scenario2 = await processTurnAudioWithRetry({
    submitAndExtract: async () => {
      throw new Error('permanent failure');
    },
    writeSuccessRow: async (features) => scenario2Writes.push({ type: 'success', features }),
    writeFailureRow: async (error) => scenario2Writes.push({ type: 'failed', error }),
  });
  assert(scenario2.success === false, 'Scenario 2 should fail');
  assert(scenario2.attempts === 3, 'Scenario 2 should exhaust retries');
  assert(
    scenario2Writes.length === 1 && scenario2Writes[0].type === 'failed',
    'Scenario 2 should write one failure row'
  );

  // Scenario 3: finalize weighted averages and confidence from mixed turn statuses.
  const turns = [
    {
      processing_status: 'success',
      audio_duration_seconds: 4,
      pitch_mean: 200,
      pitch_range: 30,
      speech_rate: 130,
      pause_frequency: 3,
      energy_variation: 0.4,
      emotional_expressiveness: 0.55,
      warmth_score: 0.62,
    },
    {
      processing_status: 'failed',
      audio_duration_seconds: 5,
      pitch_mean: 999,
      pitch_range: 999,
      speech_rate: 999,
      pause_frequency: 999,
      energy_variation: 999,
      emotional_expressiveness: 999,
      warmth_score: 999,
    },
    {
      processing_status: 'success',
      audio_duration_seconds: 6,
      pitch_mean: 220,
      pitch_range: 42,
      speech_rate: 150,
      pause_frequency: 2,
      energy_variation: 0.6,
      emotional_expressiveness: 0.65,
      warmth_score: 0.74,
    },
  ];
  const finalized = finalizeAudioProfileFromTurns(turns);
  assert(finalized.averaged != null, 'Scenario 3 should produce averaged features');
  assert(nearlyEqual(finalized.audio_confidence, 2 / 3), 'Scenario 3 confidence should be success/total turns');
  // Duration-weighted check for pitch_mean: (200*4 + 220*6) / 10 = 212
  assert(nearlyEqual(finalized.averaged.pitch_mean, 212), 'Scenario 3 weighted pitch_mean mismatch');

  console.log('PASS: audio style pipeline scenarios validated (3/3).');
}

run().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});

