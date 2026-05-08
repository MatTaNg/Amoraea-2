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
});
