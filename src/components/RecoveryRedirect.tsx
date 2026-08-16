import { useEffect } from 'react';
import { supabase } from '../utils/supabase';

const RECOVERY_FLAG = 'nmb-password-recovery';

function recoveryErrorFromHash() {
  const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  if (!raw || raw.startsWith('/')) return '';
  const params = new URLSearchParams(raw);
  return params.get('error_code') || params.get('error') || '';
}

/**
 * Supabase's implicit recovery flow needs to read the token fragment before the
 * HashRouter replaces it with an application route. Only after a real recovery
 * session exists do we move the user to #/login?mode=reset.
 */
export default function RecoveryRedirect() {
  useEffect(() => {
    let active = true;
    let redirected = false;

    const goToReset = () => {
      if (!active || redirected) return;
      redirected = true;
      try { sessionStorage.setItem(RECOVERY_FLAG, '1'); } catch {}
      window.history.replaceState({}, document.title, `${window.location.pathname}#/login?mode=reset`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };

    const goToExpired = () => {
      if (!active || redirected) return;
      redirected = true;
      try { sessionStorage.removeItem(RECOVERY_FLAG); } catch {}
      window.history.replaceState({}, document.title, `${window.location.pathname}#/login?mode=forgot&recoveryError=expired`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };

    const hashError = recoveryErrorFromHash();
    if (hashError === 'otp_expired' || hashError === 'access_denied') {
      goToExpired();
      return;
    }

    const recoveryHint = new URLSearchParams(window.location.search).get('recovery') === '1';
    const rawHash = window.location.hash;
    const tokenInHash = rawHash.includes('type=recovery') || rawHash.includes('access_token=');

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' && session) goToReset();
    });

    // A valid link can already have been consumed by the SDK before this effect's
    // event handler attaches. In that case the recovery query hint + session is enough.
    const verifyExistingSession = async () => {
      if (!recoveryHint && !tokenInHash) return;
      // Give supabase-js a short moment to parse/persist the implicit token fragment.
      for (let attempt = 0; attempt < 6 && active && !redirected; attempt += 1) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          goToReset();
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      if (active && !redirected && recoveryHint) goToExpired();
    };

    void verifyExistingSession();

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return null;
}
