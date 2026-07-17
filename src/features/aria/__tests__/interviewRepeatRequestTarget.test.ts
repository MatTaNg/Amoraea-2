import {
  buildScenarioPlusQuestionRepeatTts,
  looksLikeScenarioRepeatRequest,
  resolveInterviewRepeatRequestTarget,
  shouldAttachScenarioVignetteForRepeat,
  stripBriefInterviewAcknowledgmentPrefixForRepeat,
  withRepeatRequestAcknowledgment,
} from '@features/aria/interviewRepeatRequestTarget';
import { SHOW_SCENARIO_2_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import { classifyUserMetaComment } from '@features/aria/metaCommentClassification';

describe('interviewRepeatRequestTarget', () => {
  it('treats scenario/situation phrasing as scenario repeat', () => {
    expect(looksLikeScenarioRepeatRequest('Repeat the scenario')).toBe(true);
    expect(looksLikeScenarioRepeatRequest('Can you repeat the situation?')).toBe(true);
    expect(looksLikeScenarioRepeatRequest('Say the scenario again')).toBe(true);
    expect(looksLikeScenarioRepeatRequest('What was the scenario?')).toBe(true);
    expect(resolveInterviewRepeatRequestTarget('Repeat the scenario')).toBe('scenario');
  });

  it('keeps explicit question-only phrasing as question', () => {
    expect(looksLikeScenarioRepeatRequest('Repeat the question')).toBe(false);
    expect(looksLikeScenarioRepeatRequest('Can you say that again?')).toBe(false);
    expect(resolveInterviewRepeatRequestTarget('Repeat the question')).toBe('question');
  });

  it('treats "repeat what you/she said" as scenario repeat', () => {
    expect(looksLikeScenarioRepeatRequest('Repeat what you said.')).toBe(true);
    expect(looksLikeScenarioRepeatRequest('Can you repeat what she said?')).toBe(true);
    expect(looksLikeScenarioRepeatRequest('What did you say?')).toBe(true);
    expect(resolveInterviewRepeatRequestTarget('Repeat what she said')).toBe('scenario');
  });

  it('builds vignette + question TTS for scenario repeat', () => {
    const question = 'What do you think is going on here?';
    const out = buildScenarioPlusQuestionRepeatTts(SHOW_SCENARIO_2_VIGNETTE_EXACT, question);
    expect(out.startsWith(SHOW_SCENARIO_2_VIGNETTE_EXACT)).toBe(true);
    expect(out).toContain(question);
  });

  it('only attaches vignette for Situations 1–3', () => {
    expect(
      shouldAttachScenarioVignetteForRepeat({
        target: 'scenario',
        interviewMoment: 2,
        scenarioNumber: 2,
      }),
    ).toBe(true);
    expect(
      shouldAttachScenarioVignetteForRepeat({
        target: 'question',
        interviewMoment: 2,
        scenarioNumber: 2,
      }),
    ).toBe(false);
    expect(
      shouldAttachScenarioVignetteForRepeat({
        target: 'scenario',
        interviewMoment: 4,
        scenarioNumber: 3,
      }),
    ).toBe(false);
  });

  it('preclassifies scenario repeat as confusion repeat_request', () => {
    const r = classifyUserMetaComment('Repeat the scenario');
    expect(r?.type).toBe('confusion');
    expect(r?.confusion_subtype).toBe('repeat_request');
  });

  it('prefixes Sure. before spoken repeat body', () => {
    expect(withRepeatRequestAcknowledgment('What do you think is going on here?')).toBe(
      'Sure. What do you think is going on here?',
    );
    expect(withRepeatRequestAcknowledgment('Sure. Already acked')).toBe('Sure. Already acked');
  });

  it('strips brief acknowledgments so repeat speaks only the question', () => {
    expect(
      stripBriefInterviewAcknowledgmentPrefixForRepeat(
        'Got it. What do you think is going on between these two?',
      ),
    ).toBe('What do you think is going on between these two?');
    expect(
      stripBriefInterviewAcknowledgmentPrefixForRepeat(
        'Got it. Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?',
      ),
    ).toBe(
      'At what point do you decide when a relationship is something to work through versus something you need to walk away from?',
    );
    expect(
      stripBriefInterviewAcknowledgmentPrefixForRepeat(
        "That's a real read on it. And if you were James, how would you repair?",
      ),
    ).toBe('And if you were James, how would you repair?');
  });
});
