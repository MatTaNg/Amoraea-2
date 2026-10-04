export function isValidRegisterEmail(raw: string): boolean {
  const email = raw.trim();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const REGISTER_PASSWORD_MIN_LENGTH = 8;

export const REGISTER_PASSWORD_MIN_LENGTH_MESSAGE =
  `Password must be at least ${REGISTER_PASSWORD_MIN_LENGTH} characters.`;

export type RegisterFormSubmitInput = {
  email: string;
  password: string;
  confirm: string;
  age: string;
  gender: string;
};

export type RegisterFormFieldErrors = {
  email?: string;
  password?: string;
  confirm?: string;
  age?: string;
  gender?: string;
};

/** Field messages shown after the user taps Create Account. */
export function getRegisterFormFieldErrors(input: RegisterFormSubmitInput): RegisterFormFieldErrors {
  const errors: RegisterFormFieldErrors = {};

  if (!input.email.trim()) {
    errors.email = 'Please enter your email.';
  } else if (!isValidRegisterEmail(input.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (input.password.length < REGISTER_PASSWORD_MIN_LENGTH) {
    errors.password = REGISTER_PASSWORD_MIN_LENGTH_MESSAGE;
  }

  if (!input.confirm) {
    errors.confirm = 'Please confirm your password.';
  } else if (input.password !== input.confirm) {
    errors.confirm = "Passwords don't match.";
  }

  const parsedAge = Number.parseInt(input.age, 10);
  if (!input.age.trim() || Number.isNaN(parsedAge) || parsedAge <= 0) {
    errors.age = 'Please enter your age.';
  }

  if (!input.gender.trim()) {
    errors.gender = 'Please select a gender.';
  }

  return errors;
}

export function canSubmitRegisterForm(input: RegisterFormSubmitInput): boolean {
  return Object.keys(getRegisterFormFieldErrors(input)).length === 0;
}
