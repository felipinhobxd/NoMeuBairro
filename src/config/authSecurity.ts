export const MIN_NEW_PASSWORD_LENGTH = 8;

export function minimumPasswordMessage(subject = 'A senha') {
  return `${subject} precisa ter pelo menos ${MIN_NEW_PASSWORD_LENGTH} caracteres.`;
}
