import {
  normalizeArchetypesFromProfile,
  archetypeIdFromStored,
  isArchetypeId,
} from '../archetypes';

describe('archetypes', () => {
  it('normalizes ids and display names from profile array', () => {
    expect(normalizeArchetypesFromProfile(['Sage', 'hero'])).toEqual(['sage', 'hero']);
    expect(normalizeArchetypesFromProfile(['invalid', 'Jester', 'extra'])).toEqual(['jester']);
  });

  it('caps at two archetypes', () => {
    expect(
      normalizeArchetypesFromProfile(['innocent', 'sage', 'explorer']),
    ).toEqual(['innocent', 'sage']);
  });

  it('maps stored labels to ids', () => {
    expect(archetypeIdFromStored('Everyman')).toBe('everyman');
    expect(isArchetypeId('rebel')).toBe(true);
  });
});
