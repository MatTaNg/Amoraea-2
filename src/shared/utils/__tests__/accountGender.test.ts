import {
  accountGenderFromAuthMetadata,
  normalizeAccountGenderRaw,
} from '../accountGender';

describe('accountGender', () => {
  it('normalizes signup and legacy gender strings to DB values', () => {
    expect(normalizeAccountGenderRaw('Man')).toBe('man');
    expect(normalizeAccountGenderRaw('Woman')).toBe('woman');
    expect(normalizeAccountGenderRaw('Non-binary')).toBe('non-binary');
    expect(normalizeAccountGenderRaw('male')).toBe('man');
  });

  it('reads gender from auth user metadata', () => {
    expect(accountGenderFromAuthMetadata({ gender: 'Woman' })).toBe('woman');
    expect(accountGenderFromAuthMetadata({ gender: '' })).toBeUndefined();
  });
});
