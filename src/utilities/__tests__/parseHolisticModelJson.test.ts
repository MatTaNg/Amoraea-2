import { extractEgoDevelopmentLevel } from '@features/aria/aggregateMarkerScoresFromSlices';
import {
  coerceHolisticInterviewModelObject,
  parseHolisticInterviewModelObjectFromModelText,
} from '../parseHolisticModelJson';

describe('parseHolisticInterviewModelObjectFromModelText', () => {
  it('prefers a later JSON object that includes ego over an earlier object without it', () => {
    const raw = `Some prose here.
{"pillarScores":{"repair":8,"mentalizing":7},"keyEvidence":{}}
{"pillarScores":{"repair":8,"mentalizing":7},"ego_development_level":4,"keyEvidence":{}}`;
    const best = parseHolisticInterviewModelObjectFromModelText(raw);
    expect(extractEgoDevelopmentLevel(best)).toBe(4);
  });

  it('returns first valid object when only one parses', () => {
    const raw = '{"pillarScores":{"repair":5},"ego_development_level":2}';
    const best = parseHolisticInterviewModelObjectFromModelText(raw);
    expect(extractEgoDevelopmentLevel(best)).toBe(2);
  });

  it('parses ego when model emits a decimal JSON literal', () => {
    const raw = '{"pillarScores":{"repair":8},"ego_development_level":4.0,"keyEvidence":{}}';
    const best = parseHolisticInterviewModelObjectFromModelText(raw);
    expect(extractEgoDevelopmentLevel(best)).toBe(4);
  });

  it('salvages ego from prose phrase in raw text', () => {
    const raw =
      '{"pillarScores":{"repair":8},"keyEvidence":{}}\nOverall ego development level: 3 based on transcript.';
    const best = parseHolisticInterviewModelObjectFromModelText(raw);
    expect(extractEgoDevelopmentLevel(best)).toBe(3);
  });

  it('salvages ego from raw text when the chosen JSON object omits it', () => {
    const raw =
      '{"pillarScores":{"repair":8,"mentalizing":7},"keyEvidence":{}}\nTrailing note with "ego_development_level": 4 for the rater.';
    const best = parseHolisticInterviewModelObjectFromModelText(raw);
    expect(extractEgoDevelopmentLevel(best)).toBe(4);
  });

  it('does not spread invalid null ego from model into coerced output', () => {
    const out = coerceHolisticInterviewModelObject({
      pillarScores: { repair: 8 },
      ego_development_level: null,
    });
    expect(out.ego_development_level).toBeUndefined();
  });

  it('throws when no JSON object parses', () => {
    expect(() => parseHolisticInterviewModelObjectFromModelText('no braces')).toThrow(SyntaxError);
  });
});
