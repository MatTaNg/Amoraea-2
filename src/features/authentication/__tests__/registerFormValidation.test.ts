import {
  REGISTER_PASSWORD_MIN_LENGTH_MESSAGE,
  canSubmitRegisterForm,
  getRegisterFormFieldErrors,
  isValidRegisterEmail,
} from '../registerFormValidation';

const validBase = {
  email: 'join@example.com',
  password: 'password1',
  confirm: 'password1',
  age: '28',
  gender: 'Female',
};

describe('registerFormValidation', () => {
  it('accepts a basic email address', () => {
    expect(isValidRegisterEmail('join@example.com')).toBe(true);
    expect(isValidRegisterEmail('')).toBe(false);
    expect(isValidRegisterEmail('not-an-email')).toBe(false);
  });

  it('requires email, matching password, gender, and age', () => {
    expect(canSubmitRegisterForm(validBase)).toBe(true);
    expect(canSubmitRegisterForm({ ...validBase, email: '' })).toBe(false);
    expect(canSubmitRegisterForm({ ...validBase, password: 'short' })).toBe(false);
    expect(canSubmitRegisterForm({ ...validBase, confirm: 'password2' })).toBe(false);
    expect(canSubmitRegisterForm({ ...validBase, gender: '' })).toBe(false);
    expect(canSubmitRegisterForm({ ...validBase, age: '' })).toBe(false);
  });

  it('returns a password minimum-length error even when other fields are empty', () => {
    const errors = getRegisterFormFieldErrors({
      email: '',
      password: 'short',
      confirm: '',
      age: '',
      gender: '',
    });
    expect(errors.password).toBe(REGISTER_PASSWORD_MIN_LENGTH_MESSAGE);
    expect(errors.email).toBe('Please enter your email.');
    expect(errors.confirm).toBe('Please confirm your password.');
  });

  it('returns a password minimum-length error for an empty password', () => {
    expect(getRegisterFormFieldErrors(validBase).password).toBeUndefined();
    expect(getRegisterFormFieldErrors({ ...validBase, password: '' }).password).toBe(
      REGISTER_PASSWORD_MIN_LENGTH_MESSAGE,
    );
  });
});
