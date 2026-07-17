import {
  coerceMidScenarioRelationalReflectionToBriefAck,
  ensureScenario3VignetteOpening,
  sanitizeClosingLanguage,
  stripFlatReflectionAcknowledgmentOpeners,
  stripForbiddenReflectionLead,
  stripInternalReflectionSchemaLeak,
  looksLikeInternalReflectionSchemaLeak,
} from '../interviewAssistantReflection';
import { looksLikeInterviewClosingAssistantMessage } from '../elongatingProbe';

describe('interviewAssistantReflection', () => {
  it('sanitizeClosingLanguage removes banned openers and stacked thank-yous', () => {
    const raw =
      'Sure — Good work. Thank you for walking through all of this. Thank you for being so open with me.';
    const out = sanitizeClosingLanguage(raw);
    expect(out.toLowerCase()).not.toMatch(/^sure\b/);
    expect(out.toLowerCase()).not.toContain('walking through');
    expect(out.toLowerCase()).toContain('thank you for being so open');
  });

  it('stripFlatReflectionAcknowledgmentOpeners preserves Scenario A repair lead-in', () => {
    const text =
      "That makes sense. What if you were Ryan — how would you repair this situation?";
    expect(stripFlatReflectionAcknowledgmentOpeners(text)).toBe(text);
  });

  it('coerceMidScenarioRelationalReflectionToBriefAck replaces mid-scenario reflection before next question', () => {
    const text =
      'So for you, the emotional moment needed to land before anything practical could. What do you think James could have done differently to help Sarah feel appreciated?';
    const out = coerceMidScenarioRelationalReflectionToBriefAck(text);
    expect(out).toMatch(/^(Got it\.|Makes sense\.|That makes a lot of sense\.|I'm with you\.)/);
    expect(out).toContain('What do you think James could have done differently');
    expect(out).not.toMatch(/^So for you,/);
  });

  it('coerceMidScenarioRelationalReflectionToBriefAck prepends ack when question has no lead', () => {
    const text = 'What if you were Ryan — how would you repair this situation?';
    const out = coerceMidScenarioRelationalReflectionToBriefAck(text);
    expect(out).toMatch(/^(Got it\.|Makes sense\.|That makes a lot of sense\.|I'm with you\.)/);
    expect(out).toContain('What if you were Ryan');
  });

  it('coerceMidScenarioRelationalReflectionToBriefAck preserves boundary closure reflection', () => {
    const text =
      'That situation is complete. So your read is that repair means meeting her where she is.';
    expect(coerceMidScenarioRelationalReflectionToBriefAck(text)).toBe(text);
  });

  it('stripFlatReflectionAcknowledgmentOpeners removes empty Sure/That makes sense lead when remainder is long enough', () => {
    const text =
      "That makes sense, I hear you naming Emma's contempt while still seeing Ryan's side.";
    const out = stripFlatReflectionAcknowledgmentOpeners(text);
    expect(out.toLowerCase()).not.toMatch(/^that makes sense,/);
    expect(out.toLowerCase()).toContain('emma');
  });

  it('stripFlatReflectionAcknowledgmentOpeners keeps Sure. before a repeated question', () => {
    const text = "Sure. What about when Emma says you've made that very clear — what do you make of that?";
    expect(stripFlatReflectionAcknowledgmentOpeners(text)).toBe(text);
  });

  it('stripForbiddenReflectionLead removes leading quoted user paste', () => {
    const text = '"She already knows he will not change" — I hear you naming resignation.';
    const out = stripForbiddenReflectionLead(text);
    expect(out).not.toMatch(/^["“]/);
    expect(out.toLowerCase()).toContain('i hear you');
  });

  it('ensureScenario3VignetteOpening re-inserts repetition frame when missing', () => {
    const body =
      "Sophie feels unheard because Daniel goes silent. Daniel says 'I need ten minutes' and leaves.";
    const out = ensureScenario3VignetteOpening(body);
    expect(out).toContain('Sophie and Daniel have had the same argument for the third time.');
    expect(out).toContain('Sophie feels unheard');
  });

  it('stripInternalReflectionSchemaLeak removes leaked reflection_reasoning metadata', () => {
    const leaked =
      'reflection_reasoning: { specific_element_from_answer: "I took a breath and owned it", relational_orientation_identified: "This user path to resolution" } Thank you for being so open with me.';
    expect(looksLikeInternalReflectionSchemaLeak(leaked)).toBe(true);
    const out = stripInternalReflectionSchemaLeak(leaked);
    expect(out.toLowerCase()).not.toContain('reflection_reasoning');
    expect(out.toLowerCase()).not.toContain('specific_element_from_answer');
    expect(out).toContain('Thank you for being so open with me');
  });

  it('looksLikeInterviewClosingAssistantMessage rejects reflection schema leaks', () => {
    const leaked =
      'reflection_reasoning: { specific_element_from_answer: "owned it" } Thank you for being so open with me.';
    expect(looksLikeInterviewClosingAssistantMessage(leaked)).toBe(false);
  });
});
