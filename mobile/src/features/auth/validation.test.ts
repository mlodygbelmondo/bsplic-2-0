import { describe, expect, it } from 'vitest';

import { normalizeEmail, validateAuthForm } from './validation';

const valid = { email: 'gracz@bsplic.pl', password: 'sekret1', username: 'Gracz' };

describe('validateAuthForm', () => {
  it('accepts a complete login form', () => {
    expect(validateAuthForm('login', valid)).toBeNull();
  });

  it('requires the username only when registering', () => {
    expect(validateAuthForm('register', { ...valid, username: '' })).toEqual({
      field: 'username',
      message: 'Wypełnij to pole.',
    });
    expect(validateAuthForm('login', { ...valid, username: '' })).toBeNull();
  });

  it('accepts a whitespace-only username like the browser `required` check', () => {
    expect(validateAuthForm('register', { ...valid, username: '   ' })).toBeNull();
  });

  it('checks fields in the web form order (username before email)', () => {
    expect(validateAuthForm('register', { email: '', password: '', username: '' })?.field).toBe('username');
    expect(validateAuthForm('login', { email: '', password: '', username: '' })?.field).toBe('email');
  });

  it('asks for the email when it is empty or blank', () => {
    const expected = { field: 'email', message: 'Wpisz swój adres e-mail' };
    expect(validateAuthForm('login', { ...valid, email: '' })).toEqual(expected);
    expect(validateAuthForm('forgot', { ...valid, email: '   ' })).toEqual(expected);
  });

  it('rejects malformed email addresses', () => {
    for (const email of ['gracz', 'gracz@', '@bsplic.pl', 'gra cz@bsplic.pl', 'gracz@-bsplic.pl']) {
      expect(validateAuthForm('login', { ...valid, email })).toEqual({
        field: 'email',
        message: 'Wprowadź adres e-mail.',
      });
    }
  });

  it('accepts emails the browser accepts, including a dotless domain and surrounding spaces', () => {
    expect(validateAuthForm('login', { ...valid, email: 'gracz@localhost' })).toBeNull();
    expect(validateAuthForm('login', { ...valid, email: '  gracz+bet@bsplic.pl ' })).toBeNull();
  });

  it('requires a password of at least 6 characters on login and registration', () => {
    expect(validateAuthForm('login', { ...valid, password: '' })).toEqual({
      field: 'password',
      message: 'Wypełnij to pole.',
    });
    expect(validateAuthForm('register', { ...valid, password: '12345' })).toEqual({
      field: 'password',
      message: 'Hasło musi mieć co najmniej 6 znaków',
    });
    expect(validateAuthForm('login', { ...valid, password: '123456' })).toBeNull();
  });

  it('ignores the password in the forgot-password view', () => {
    expect(validateAuthForm('forgot', { ...valid, password: '' })).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('strips surrounding whitespace like the browser email input', () => {
    expect(normalizeEmail('  gracz@bsplic.pl\n')).toBe('gracz@bsplic.pl');
  });
});
