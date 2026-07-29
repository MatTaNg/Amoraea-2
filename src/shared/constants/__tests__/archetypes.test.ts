import {
  normalizeArchetypesFromProfile,
  archetypeIdFromStored,
  isArchetypeId,
  isCompleteArchetypeSelection,
} from '../archetypes';

describe('archetypes', () => {
  it('normalizes ids and display names from profile array', () => {
    expect(normalizeArchetypesFromProfile(['Sage', 'hero'])).toEqual(['sage', 'hero']);
    expect(normalizeArchetypesFromProfile(['invalid', 'Jester', 'extra'])).toEqual(['jester']);
  });

  it('caps at three archetypes', () => {
    expect(
      normalizeArchetypesFromProfile(['innocent', 'sage', 'explorer']),
    ).toEqual(['innocent', 'sage', 'explorer']);
    expect(
      normalizeArchetypesFromProfile(['innocent', 'sage', 'explorer', 'hero']),
    ).toEqual(['innocent', 'sage', 'explorer']);
  });

  it('maps stored labels to ids', () => {
    expect(archetypeIdFromStored('Everyman')).toBe('everyman');
    expect(isArchetypeId('rebel')).toBe(true);
  });

  it('accepts two or three selections for onboarding and edit profile', () => {
    expect(isCompleteArchetypeSelection(1)).toBe(false);
    expect(isCompleteArchetypeSelection(2)).toBe(true);
    expect(isCompleteArchetypeSelection(3)).toBe(true);
    expect(isCompleteArchetypeSelection(4)).toBe(false);
  });
});
