import {
  coerceExactScenarioModalQuestionDisplay,
  coerceScenario1MetaPlayNarrationForTts,
  isScenarioANonScriptedModalParaphrase,
  looksLikeScenario1MetaPlayNarration,
  looksLikeScenarioAEmmaCoachingParaphrase,
  resolveSituation1ExactModalPrompt,
} from '../situation1ExactModalPrompt';
import { SCENARIO_1_OPENING } from '../interviewScenarioOpeningStreamGate';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '../probeAndScoringUtils';
import { SHOW_SCENARIO_1_VIGNETTE_EXACT } from '../interviewShowScenarioExactCopy';

const S1_VIGNETTE_SNIPPET =
  'Emma and Ryan have dinner plans. Ryan takes a call from his mother halfway through.';

describe('situation1ExactModalPrompt', () => {
  it('flags Ryan mentalizing paraphrases as non-scripted modal copy', () => {
    expect(
      isScenarioANonScriptedModalParaphrase(
        'So what do you think is actually going on for Ryan in that moment?',
      ),
    ).toBe(true);
    expect(
      isScenarioANonScriptedModalParaphrase(
        'Just say whatever comes to mind — how would Ryan respond to her in that moment?',
      ),
    ).toBe(true);
    expect(
      isScenarioANonScriptedModalParaphrase('How would Ryan respond to her in that moment?'),
    ).toBe(true);
    expect(
      isScenarioANonScriptedModalParaphrase(
        'What could Ryan have done differently in that moment — before Emma ever said anything — to avoid this getting to that point?',
      ),
    ).toBe(true);
  });

  it('flags incomplete Emma coaching without question mark (streaming cut-off)', () => {
    expect(looksLikeScenarioAEmmaCoachingParaphrase('How do you think Emma actually')).toBe(true);
    expect(isScenarioANonScriptedModalParaphrase('How do you think Emma actually')).toBe(true);
    expect(
      isScenarioANonScriptedModalParaphrase(
        'What about when Emma says "I know, you\'ve made that very clear"?',
      ),
    ).toBe(false);
  });

  it('returns contempt exact copy when contempt is in transcript', () => {
    const transcript = [
      { role: 'assistant', content: `${S1_VIGNETTE_SNIPPET} ${SCENARIO_1_OPENING}` },
      { role: 'user', content: 'Emma feels sidelined.' },
      {
        role: 'assistant',
        content:
          'So what do you think is actually going on for Ryan in that moment?',
      },
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
    ];
    expect(resolveSituation1ExactModalPrompt(transcript)).toBe(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
  });

  it('returns opening before contempt is delivered', () => {
    const transcript = [{ role: 'assistant', content: `${S1_VIGNETTE_SNIPPET} ${SCENARIO_1_OPENING}` }];
    expect(resolveSituation1ExactModalPrompt(transcript)).toBe(SCENARIO_1_OPENING);
  });

  it('returns repair exact copy after contempt when repair is last', () => {
    const transcript = [
      { role: 'assistant', content: `${S1_VIGNETTE_SNIPPET} ${SCENARIO_1_OPENING}` },
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
      { role: 'user', content: 'She sounds dismissive.' },
      { role: 'assistant', content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY },
    ];
    expect(resolveSituation1ExactModalPrompt(transcript)).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
  });

  it('returns contempt when delivery ref says contempt asked even without transcript', () => {
    expect(
      resolveSituation1ExactModalPrompt(
        [{ role: 'assistant', content: `${S1_VIGNETTE_SNIPPET} ${SCENARIO_1_OPENING}` }],
        null,
        { contemptProbeAsked: true },
      ),
    ).toBe(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
  });

  it('returns repair when delivery ref says repair asked', () => {
    expect(
      resolveSituation1ExactModalPrompt([], null, { repairQuestionAsked: true }),
    ).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('coerces truncated Emma repair stream fragments to the canonical repair footer', () => {
    expect(resolveSituation1ExactModalPrompt([], 'Now, things with Emma?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
    expect(
      resolveSituation1ExactModalPrompt(
        [
          { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
          { role: 'assistant', content: 'Now, things with Emma?' },
        ],
        null,
        { contemptProbeAsked: true },
      ),
    ).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('coerces truncated Emma repair tails for modal display', () => {
    expect(isScenarioANonScriptedModalParaphrase('Now, things with Emma?')).toBe(false);
    expect(
      coerceExactScenarioModalQuestionDisplay('Now, things with Emma?', 'Situation 1'),
    ).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('detects and coerces meta "play Situation 1" narration into the canonical vignette', () => {
    const filler = 'The app will now play Situation 1 for you.';
    expect(looksLikeScenario1MetaPlayNarration(filler)).toBe(true);
    expect(looksLikeScenario1MetaPlayNarration('I will now play situation 1 for you')).toBe(true);
    const out = coerceScenario1MetaPlayNarrationForTts(filler);
    expect(out).toContain(SHOW_SCENARIO_1_VIGNETTE_EXACT);
    expect(out).toContain(SCENARIO_1_OPENING);
    expect(looksLikeScenario1MetaPlayNarration(out)).toBe(false);
  });
});
