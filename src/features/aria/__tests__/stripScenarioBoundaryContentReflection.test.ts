import { describe, expect, it } from '@jest/globals';

import {
  shouldDropScenarioBoundaryContentReflectionSentence,
  stripScenarioBoundaryContentReflection,
} from '@features/aria/stripScenarioBoundaryContentReflection';

describe('stripScenarioBoundaryContentReflection', () => {
  it('removes Nice work content reflections from S1 wrap handoffs', () => {
    const input =
      "That's a wrap on that one. Nice work, Matt — You framed when someone's hurt, you'd reach for emotional acknowledgment before any practical fix. We've got two more situations to get through.\n\nSarah has been job hunting for four months.";
    const out = stripScenarioBoundaryContentReflection(input);
    expect(out).toContain("That's a wrap on that one.");
    expect(out).toContain("We've got two more situations to get through.");
    expect(out).toContain('Sarah has been job hunting');
    expect(out).not.toMatch(/Nice work/i);
    expect(out).not.toMatch(/You framed/i);
  });

  it('removes What I heard was reflections from boundary leads', () => {
    const input =
      "That's the second one done. What I heard was that James needed to celebrate first. One more situation and then we'll get personal.";
    const out = stripScenarioBoundaryContentReflection(input);
    expect(out).toContain("That's the second one done.");
    expect(out).toContain("One more situation and then we'll get personal.");
    expect(out).not.toMatch(/What I heard/i);
  });

  it('drops standalone positive-address reflection sentences', () => {
    expect(
      shouldDropScenarioBoundaryContentReflectionSentence(
        'Nice work, Matt — you focused on putting concrete limits on calls during dates.',
      ),
    ).toBe(true);
    expect(
      shouldDropScenarioBoundaryContentReflectionSentence(
        "That's a wrap on that one. We've got two more situations to get through.",
      ),
    ).toBe(false);
  });

  it('drops LLM You-picked-up-on boundary reflections including wrap compounds', () => {
    const weird =
      "You picked up on some real tension there — the way frustration can sit just beneath the surface, even when the words sound calm. That wraps up this scenario, so let's move on to the next one.";
    expect(shouldDropScenarioBoundaryContentReflectionSentence(weird)).toBe(true);
    const stripped = stripScenarioBoundaryContentReflection(weird);
    expect(stripped).not.toMatch(/You picked up on/i);
    expect(stripped).not.toMatch(/frustration can sit/i);
  });
});
