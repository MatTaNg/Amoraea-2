import {
  interviewAssistantTextHasDisallowedNameMarker,
  sanitizeAssistantInterviewerCharacterNames,
} from '@/constants/interviewCharacterNames';

describe('interviewAssistantTextHasDisallowedNameMarker', () => {
  it('detects Reese as a whole word', () => {
    expect(interviewAssistantTextHasDisallowedNameMarker('What does Reese think?')).toBe(true);
  });

  it('does not flag James', () => {
    expect(interviewAssistantTextHasDisallowedNameMarker('What does James think?')).toBe(false);
  });
});

describe('sanitizeAssistantInterviewerCharacterNames', () => {
  it('maps Reese to James', () => {
    expect(sanitizeAssistantInterviewerCharacterNames('Ask Reese about it.')).toBe('Ask James about it.');
  });

  it('handles possessive Reese', () => {
    expect(sanitizeAssistantInterviewerCharacterNames("Reese's tone")).toBe("James's tone");
  });

  it('preserves unrelated copy', () => {
    const s = 'Sarah and James discuss the plan.';
    expect(sanitizeAssistantInterviewerCharacterNames(s)).toBe(s);
  });
});
