import {
  evaluateHybridCutOffDetection,
  looksLikeMicStopFromAudioTelemetry,
  mergeHybridCutOffWithLlm,
} from '@features/aria/interviewCutOffDetection';
import { parseCutOffCompletenessLlmJson } from '@features/aria/fetchInterviewCutOffCompletenessFromLlm';

describe('interviewCutOffDetection', () => {
  const suspiciousAudio = {
    audioDurationMs: 0,
    wordCount: 6,
    wordsPerSecond: 0,
    ratioFlag: true,
  };

  it('detects structural cut-offs with high confidence', () => {
    const result = evaluateHybridCutOffDetection({
      transcriptText: "If I'm right and I really",
      telemetry: suspiciousAudio,
    });
    expect(result.isCutOff).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('audio_structural');
  });

  it('flags audio-suspicious medium-length clips without structural match', () => {
    const result = evaluateHybridCutOffDetection({
      transcriptText: 'Emma was frustrated about the whole thing',
      telemetry: suspiciousAudio,
    });
    expect(result.isCutOff).toBe(true);
    expect(result.confidence).toBe('medium');
    expect(result.source).toBe('audio_telemetry');
  });

  it('does not flag complete substantive answers', () => {
    const result = evaluateHybridCutOffDetection({
      transcriptText:
        'I would apologize to Emma and tell Ryan we need to protect our shared time together.',
      telemetry: {
        audioDurationMs: 4200,
        wordCount: 14,
        wordsPerSecond: 2.1,
        ratioFlag: false,
      },
    });
    expect(result.isCutOff).toBe(false);
  });

  it('does not flag Scenario B celebration answers ending in "she was" even with native zero-duration telemetry', () => {
    const transcriptText =
      'Got excited with her, asked her how she went, and told her how proud of her she was.';
    const result = evaluateHybridCutOffDetection({
      transcriptText,
      telemetry: {
        ...suspiciousAudio,
        wordCount: transcriptText.split(/\s+/).filter(Boolean).length,
      },
    });
    expect(result.isCutOff).toBe(false);
  });

  it('does not flag valid hard stops even with suspicious audio', () => {
    const result = evaluateHybridCutOffDetection({
      transcriptText: "I don't know",
      telemetry: suspiciousAudio,
    });
    expect(result.isCutOff).toBe(false);
  });

  it('does not flag complete interview-process meta requests even with suspicious audio', () => {
    const result = evaluateHybridCutOffDetection({
      transcriptText: 'Give a question.',
      telemetry: suspiciousAudio,
    });
    expect(result.isCutOff).toBe(false);
    expect(result.source).toBe('none');
  });

  it('does not flag cut-off process question repeat prefixes even with suspicious audio', () => {
    const result = evaluateHybridCutOffDetection({
      transcriptText: 'Give a ques-',
      telemetry: suspiciousAudio,
    });
    expect(result.isCutOff).toBe(false);
    expect(result.source).toBe('none');
  });

  it('looksLikeMicStopFromAudioTelemetry respects word-count bounds', () => {
    expect(looksLikeMicStopFromAudioTelemetry(suspiciousAudio)).toBe(true);
    expect(
      looksLikeMicStopFromAudioTelemetry({
        ...suspiciousAudio,
        wordCount: 25,
      }),
    ).toBe(false);
  });

  it('merges LLM confirmation for medium-confidence audio cases', () => {
    const heuristic = evaluateHybridCutOffDetection({
      transcriptText: 'Emma was frustrated about the whole thing',
      telemetry: suspiciousAudio,
    });
    const merged = mergeHybridCutOffWithLlm(heuristic, {
      cutOff: true,
      confidence: 0.91,
      reason: 'trails off mid thought',
    });
    expect(merged.isCutOff).toBe(true);
    expect(merged.source).toBe('llm_live');
    expect(merged.confidence).toBe('high');
  });

  it('parses cut-off completeness LLM JSON', () => {
    expect(
      parseCutOffCompletenessLlmJson(
        '{"cut_off": true, "confidence": 0.88, "reason": "incomplete clause"}',
      ),
    ).toEqual({
      cutOff: true,
      confidence: 0.88,
      reason: 'incomplete clause',
    });
  });
});
