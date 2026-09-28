import {
  shouldBypassConfusionRepeatOfferForClaude,
  shouldBypassLegacyMetaInjectForClaude,
} from '@features/aria/shouldBypassLegacyMetaInjectForClaude';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';

describe('shouldBypassLegacyMetaInjectForClaude', () => {
  it('bypasses for identity / off-topic asks when Phase 2 is enabled', () => {
    expect(shouldBypassLegacyMetaInjectForClaude('Are you an alien?', null)).toBe(true);
    expect(shouldBypassLegacyMetaInjectForClaude('Who made you?', null)).toBe(true);
  });

  it('bypasses for content-confusion and ambiguous_short meta classifications', () => {
    const contentConfusion: MetaCommentClassification = {
      type: 'confusion',
      confidence: 0.8,
      confusion_subtype: 'content',
    };
    expect(shouldBypassLegacyMetaInjectForClaude('I do not get it', contentConfusion)).toBe(true);

    const ambiguous: MetaCommentClassification = {
      type: 'ambiguous_short',
      confidence: 0.6,
    };
    expect(shouldBypassLegacyMetaInjectForClaude('um', ambiguous)).toBe(true);
  });

  it('does not bypass process question repeat requests — client replay path stays', () => {
    expect(shouldBypassLegacyMetaInjectForClaude('Give a question.', null)).toBe(false);
    expect(shouldBypassLegacyMetaInjectForClaude('Give a ques-', null)).toBe(false);
  });

  it('does not bypass repeat_request confusion — legacy replay path stays', () => {
    const repeatRequest: MetaCommentClassification = {
      type: 'confusion',
      confidence: 0.9,
      confusion_subtype: 'repeat_request',
    };
    expect(shouldBypassLegacyMetaInjectForClaude('Can you say that again?', repeatRequest)).toBe(
      false,
    );
    expect(shouldBypassConfusionRepeatOfferForClaude(repeatRequest)).toBe(false);
  });

  it('does not bypass mic cut-offs or repair echoes', () => {
    expect(shouldBypassLegacyMetaInjectForClaude('If I were Ryan, I would', null)).toBe(false);
    expect(
      shouldBypassLegacyMetaInjectForClaude('This situation can be repaired.', null),
    ).toBe(false);
  });

  it('does not bypass empty user text', () => {
    expect(shouldBypassLegacyMetaInjectForClaude('', null)).toBe(false);
    expect(shouldBypassLegacyMetaInjectForClaude('   ', null)).toBe(false);
  });
});

describe('shouldBypassConfusionRepeatOfferForClaude', () => {
  it('bypasses content-confusion repeat offer when Phase 2 is enabled', () => {
    const contentConfusion: MetaCommentClassification = {
      type: 'confusion',
      confidence: 0.75,
      confusion_subtype: 'content',
    };
    expect(shouldBypassConfusionRepeatOfferForClaude(contentConfusion)).toBe(true);
  });

  it('does not bypass non-confusion meta types', () => {
    expect(
      shouldBypassConfusionRepeatOfferForClaude({ type: 'frustration', confidence: 0.7 }),
    ).toBe(false);
  });
});
