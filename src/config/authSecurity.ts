// Keep Auth email links pinned to the canonical production origin. In particular,
// do not let Vercel preview hosts become confirmation/recovery destinations.
// HashRouter routes must not be placed here because Supabase Auth uses the URL
// fragment for implicit-flow tokens before the app router starts.
export const AUTH_EMAIL_REDIRECT_TO = 'https://nomeubairro.vercel.app/';

export const MIN_NEW_PASSWORD_LENGTH = 8;

export function minimumPasswordMessage(subject = 'A senha') {
  return `${subject} precisa ter pelo menos ${MIN_NEW_PASSWORD_LENGTH} caracteres.`;
}
