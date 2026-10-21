/**
 * Native replacement for the browser form validation the web login page
 * relies on (`required`, `type="email"`, `minLength={6}`). Fields are
 * checked in the web's DOM order so the first invalid one gets focus.
 */

export type AuthView = 'login' | 'register' | 'forgot';
export type AuthFieldName = 'username' | 'email' | 'password';

export interface AuthFormValues {
  email: string;
  password: string;
  username: string;
}

export interface AuthValidationError {
  field: AuthFieldName;
  message: string;
}

export const MIN_PASSWORD_LENGTH = 6;

/** HTML `input[type=email]` validity pattern (WHATWG spec). */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export const FILL_FIELD_MESSAGE = 'Wypełnij to pole.';
export const EMPTY_EMAIL_MESSAGE = 'Wpisz swój adres e-mail';
export const INVALID_EMAIL_MESSAGE = 'Wprowadź adres e-mail.';
export const SHORT_PASSWORD_MESSAGE = 'Hasło musi mieć co najmniej 6 znaków';

/** Browsers strip leading/trailing whitespace from `type="email"` values before submitting. */
export function normalizeEmail(value: string): string {
  return value.trim();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function validateAuthForm(view: AuthView, values: AuthFormValues): AuthValidationError | null {
  // `required` accepts whitespace-only text inputs, so the username is not trimmed.
  if (view === 'register' && values.username.length === 0) {
    return { field: 'username', message: FILL_FIELD_MESSAGE };
  }

  const email = normalizeEmail(values.email);
  if (!email) {
    return { field: 'email', message: EMPTY_EMAIL_MESSAGE };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { field: 'email', message: INVALID_EMAIL_MESSAGE };
  }

  if (view === 'forgot') {
    return null;
  }

  if (values.password.length === 0) {
    return { field: 'password', message: FILL_FIELD_MESSAGE };
  }
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    return { field: 'password', message: SHORT_PASSWORD_MESSAGE };
  }

  return null;
}
