import { describe, expect, it } from '@jest/globals';

import { splitScenarioTransitionForEmotionModal } from '@features/aria/emotionModalTransitionOrchestration';
import { coerceScenarioCBoundaryHandoffForTts } from '@features/aria/scenarioCPromptDetection';

describe('coerceScenarioCBoundaryHandoffForTts', () => {
  it('expands truncated end-of-situation-three wrap cut off at "What landed"', () => {
    const truncated = "Got it. That's the end of situation three. What landed";
    const out = coerceScenarioCBoundaryHandoffForTts(truncated, 'Matt');
    const split = splitScenarioTransitionForEmotionModal(out);
    expect(split.afterModal).toMatch(/held a grudge|really hard time with/i);
    expect(out).not.toMatch(/What landed\s*$/i);
  });

  it('expands truncated S3 wrap with dangling [SCENARIO control token', () => {
    const truncated =
      'That wraps up the third situation — nice work getting through all three. [SCENARIO';
    const out = coerceScenarioCBoundaryHandoffForTts(truncated, 'Matt');
    const split = splitScenarioTransitionForEmotionModal(out);
    expect(split.afterModal).toMatch(/held a grudge|really hard time with/i);
    expect(out).not.toContain('[SCENARIO');
    expect(out).not.toMatch(/wraps up the third situation/i);
  });

  it('leaves unrelated scenario C repair questions unchanged', () => {
    const repair = 'How do you think this situation could be repaired?';
    expect(coerceScenarioCBoundaryHandoffForTts(repair)).toBe(repair);
  });

  it('does not coerce S2→S3 boundary reflection lead into Moment 4 personal card', () => {
    const s2ToS3Lead =
      "That scenario is complete. What I heard was that when someone's hurt, you'd reach for emotional acknowledgment before any practical fix. Here's the third situation — after this we'll move to something more personal.";
    expect(coerceScenarioCBoundaryHandoffForTts(s2ToS3Lead, 'Alex')).toBe(s2ToS3Lead);
  });

  it('does not coerce Sophie vignette opener into Moment 4 personal card', () => {
    const sophieOpener =
      'Sophie and Daniel have had the same argument for the third time. Sophie says she needs ten minutes to cool down.';
    expect(coerceScenarioCBoundaryHandoffForTts(sophieOpener, 'Alex')).toBe(sophieOpener);
  });
});
