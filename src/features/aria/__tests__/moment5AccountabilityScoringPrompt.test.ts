import { describe, expect, it } from '@jest/globals';
import { buildMoment5AccountabilityScoringPrompt } from '../moment5AccountabilityScoringPrompt';

describe('buildMoment5AccountabilityScoringPrompt', () => {
  it('includes low conflict-validity ceilings when client metadata flags low validity', () => {
    const prompt = buildMoment5AccountabilityScoringPrompt(
      [
        {
          role: 'assistant',
          content:
            'Was there a point where it actually got tense between you two, or did it resolve pretty smoothly?',
        },
        { role: 'user', content: 'It resolved pretty smoothly. We just talked it out.' },
      ],
      {
        accountabilityProbeFired: false,
        conflictValidityClarificationAsked: true,
        conflictValidityLow: true,
      },
    );

    expect(prompt).toContain('LOW CONFLICT VALIDITY');
    expect(prompt).toContain('conflict_validity: low');
    expect(prompt).toContain('cap repair at 4');
    expect(prompt).toContain('mentalizing at 5');
    expect(prompt).toContain('regulation at 5');
    expect(prompt).toContain('Accountability and contempt_expression may still be scored normally');
  });

  it('includes warm acknowledgment metadata when the probe used the standard scripted lead-in', () => {
    const prompt = buildMoment5AccountabilityScoringPrompt(
      [
        { role: 'assistant', content: 'Think of a time when you had a conflict with someone important to you.' },
        { role: 'user', content: 'We argued sometimes but talked it through.' },
      ],
      {
        accountabilityProbeFired: true,
        warmAckBeforeAccountabilityProbe: true,
      },
    );

    expect(prompt).toContain('WARM ACKNOWLEDGMENT BEFORE PROBE');
    expect(prompt).toContain('standard pipeline tone');
  });

  it('echoes path flags and abstract-followup note when metadata includes them', () => {
    const prompt = buildMoment5AccountabilityScoringPrompt(
      [{ role: 'user', content: 'stub' }],
      {
        accountabilityProbeFired: true,
        conflictValidityClarificationFired: true,
        conflictValiditySecondResponseAbstract: true,
        accountabilityProbeFiredOnAbstractFollowup: true,
      },
    );

    expect(prompt).toContain('PATH FLAGS');
    expect(prompt).toContain('conflict_validity_clarification_fired: true');
    expect(prompt).toContain('conflict_validity_second_response_abstract: true');
    expect(prompt).toContain('accountability_probe_fired_on_abstract_followup: true');
    expect(prompt).toContain('ABSTRACT FOLLOW-UP AFTER SPECIFICITY REDIRECT');
  });
});
