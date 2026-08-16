import { useEffect } from 'react';
import { supabase } from '../utils/supabase';

const RECOVERY_FLAG = 'nmb-password-recovery';
const RECOVERY_STARTED_AT = 'nmb-password-recovery-at';
const RECOVERY_MAX_AGE_MS = 20 * 60 * 1000;

function urlErrorCode() {
  const search = new URLSearchParams(window.location.search);
  const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = rawHash && !rawHash.startsWith('/') ? new URLSearchParams(rawHash) : new URLSearchParams();
  return hashParams.get('error_code') || hashParams.get('error') || search.get('error_code') || search.get('error') || '';
}

function clearRecoveryState() {
  try {
    sessionStorage.removeItem(RECOVERY_FLAG);
    sessionStorage.removeItem(RECOVERY_STARTED_AT);
  } catch {}
}

function clearStaleRecoveryState() {
  try {
    const startedAt = Number(sessionStorage.getItem(RECOVERY_STARTED_AT) || 0);
    if (!startedAt || Date.now() - startedAt > RECOVERY_MAX_AGE_MS) clearRecoveryState();
  } catch {}
}

/**
 * Supabase recovery links may arrive as an implicit token fragment (#access_token)
 * or as a PKCE-style query (?code=...). This component runs before HashRouter so
 * the authentication payload is consumed before the application writes its own hash.
 */
export default function RecoveryRedirect() {
  useEffect(() => {
    let active = true;
    let redirected = false;
    let recoveryEventSeen = false;

    clearStaleRecoveryState();

    const goToReset = () => {
      if (!active || redirected) return;
      redirected = true;
      try {
        sessionStorage.setItem(RECOVERY_FLAG, '1');
        sessionStorage.setItem(RECOVERY_STARTED_AT, String(Date.now()));
      } catch {}
      window.history.replaceState({}, document.title, `${window.location.pathname}#/login?mode=reset`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };

    const goToExpired = () => {
      if (!active || redirected) return;
      redirected = true;
      clearRecoveryState();
      window.history.replaceState({}, document.title, `${window.location.pathname}#/login?mode=forgot&recoveryError=expired`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };

    const search = new URLSearchParams(window.location.search);
    const recoveryHint = search.get('recovery') === '1';
    const code = search.get('code');
    const rawHash = window.location.hash;
    const tokenInHash = rawHash.includes('type=recovery') || (recoveryHint && rawHash.includes('access_token='));
    const recoveryContext = recoveryHint || tokenInHash;
    const explicitRecoveryPayload = Boolean((code && recoveryHint) || tokenInHash);

    const errorCode = urlErrorCode();
    if (recoveryContext && (errorCode === 'otp_expired' || errorCode === 'access_denied' || errorCode === 'bad_code_verifier')) {
      goToExpired();
      return;
    }

    // Ignore OAuth/signup confirmation codes. Only a code that came back through
    // the password-recovery redirect (?recovery=1) belongs to this component.
    if (!recoveryContext) return;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        recoveryEventSeen = true;
        goToReset();
      }
    });

    const consumeRecovery = async () => {
      if (code && recoveryHint && !redirected) {
        const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active || redirected) return;
        if (!error && exchanged.session) {
          goToReset();
          return;
        }
        // The SDK may have exchanged the code automatically before this component.
        const { data: current } = await supabase.auth.getSession();
        if (current.session && (recoveryEventSeen || recoveryHint)) {
          goToReset();
          return;
        }
        goToExpired();
        return;
      }

      if (!tokenInHash && !recoveryHint) return;

      // Implicit fragments are normally consumed automatically by supabase-js.
      // Wait briefly for PASSWORD_RECOVERY/getSession instead of rewriting the hash early.
      for (let attempt = 0; attempt < 8 && active && !redirected; attempt += 1) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session && (recoveryEventSeen || explicitRecoveryPayload)) {
          goToReset();
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }

      if (active && !redirected && recoveryHint) goToExpired();
    };

    void consumeRecovery();

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return null;
}
