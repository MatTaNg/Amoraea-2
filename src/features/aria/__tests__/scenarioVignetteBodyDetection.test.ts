import { describe, expect, it } from '@jest/globals';

import {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
  looksLikeNonCanonicalScenarioCVignetteFiction,
} from '@features/aria/scenarioVignetteBodyDetection';

describe('scenarioVignetteBodyDetection', () => {
  it('detects canonical Situation 2 job-hunting vignette', () => {
    expect(
      textContainsScenarioBVignetteBody(
        "Sarah has been job hunting for four months. She gets an offer and calls James from the street.",
      ),
    ).toBe(true);
  });

  it('detects known wrong Situation 2 fiction so TTS can rewrite it', () => {
    expect(
      textContainsScenarioBVignetteBody(
        'Sarah has just got a promotion at work and comes home excited to tell James.',
      ),
    ).toBe(true);
    expect(
      textContainsScenarioBVignetteBody(
        'Sarah has been planning a birthday dinner and James says must be nice to finally go out.',
      ),
    ).toBe(true);
    expect(
      textContainsScenarioBVignetteBody(
        'Sarah has been working late all week and James mentions in passing that he made dinner.',
      ),
    ).toBe(true);
  });

  it('does not treat probe-only Sarah/James mentions as vignette body', () => {
    expect(
      textContainsScenarioBVignetteBody(
        "What could James have done differently to make Sarah feel more appreciated?",
      ),
    ).toBe(false);
  });

  it('detects Situation 3 Sophie/Daniel vignette markers', () => {
    expect(
      textContainsScenarioCVignetteBody(
        "Sophie and Daniel have had the same argument for the third time. When Daniel comes back and says 'I didn't know what to say' Sophie is still upset.",
      ),
    ).toBe(true);
  });

  it('flags model-invented Sophie fiction that is not the authoritative vignette', () => {
    expect(
      looksLikeNonCanonicalScenarioCVignetteFiction(
        'Sophie has been trying to get closer to Daniel.',
      ),
    ).toBe(true);
    expect(
      looksLikeNonCanonicalScenarioCVignetteFiction(
        'Every time she brings up something personal about herself he says "yeah I\'ve been through that too" and launches into his own story.',
      ),
    ).toBe(true);
    expect(
      looksLikeNonCanonicalScenarioCVignetteFiction(
        "Sophie and Daniel have had the same argument for the third time. Sophie feels unheard because Daniel goes silent or leaves.",
      ),
    ).toBe(false);
  });

  it('flags family-Sunday Sophie fiction and nameless continuations', () => {
    expect(
      looksLikeNonCanonicalScenarioCVignetteFiction(
        'Sophie has been dating Daniel for eight months.',
      ),
    ).toBe(true);
    expect(
      looksLikeNonCanonicalScenarioCVignetteFiction(
        "She's close to her family and sees them every Sunday. Over the last month Daniel has started coming along.",
      ),
    ).toBe(true);
    expect(
      looksLikeNonCanonicalScenarioCVignetteFiction(
        'Last Sunday Sophie\'s sister made a comment that made Sophie feel like an outsider in her own family.',
      ),
    ).toBe(true);
    expect(
      looksLikeNonCanonicalScenarioCVignetteFiction(
        'When they got home Sophie said "I guess I just don\'t belong anywhere." Daniel said "don\'t say that, it\'s not true." Sophie went quiet and went to bed early.',
      ),
    ).toBe(true);
  });
});
