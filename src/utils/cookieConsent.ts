const COOKIE_CONSENT_KEY = 'anb-cookie-consent';
export const COOKIE_CONSENT_EVENT = 'nmb-cookie-consent-changed';

export type CookieConsentChoice = 'all' | 'essential';

export function hasCookieConsentChoice() {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem(COOKIE_CONSENT_KEY));
  } catch {
    return false;
  }
}

export function saveCookieConsentChoice(choice: CookieConsentChoice) {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  } catch {}

  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, {
    detail: { choice },
  }));
}
