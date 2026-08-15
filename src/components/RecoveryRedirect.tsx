import { useEffect } from 'react';
import { supabase } from '../utils/supabase';

/**
 * O Supabase entrega o token de recuperação no fragmento da URL.
 * Como o app usa HashRouter, esse fragmento pode ser interpretado como rota.
 * Este componente espera o evento PASSWORD_RECOVERY e então envia o usuário
 * para a tela de nova senha do aplicativo.
 */
export default function RecoveryRedirect() {
  useEffect(() => {
    let redirected = false;

    const redirectToReset = () => {
      if (redirected) return;
      redirected = true;
      try {
        sessionStorage.setItem('nmb-password-recovery', '1');
      } catch {
        // sessionStorage pode estar indisponível em navegação privada muito restritiva.
      }
      window.location.hash = '/login?mode=reset';
    };

    const hash = window.location.hash.slice(1);
    const looksLikeRecoveryUrl =
      hash.includes('type=recovery') ||
      hash.includes('access_token=') ||
      hash.includes('error_code=otp_expired');

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        redirectToReset();
      }
    });

    const fallback = looksLikeRecoveryUrl
      ? window.setTimeout(() => redirectToReset(), 1500)
      : undefined;

    return () => {
      data.subscription.unsubscribe();
      if (fallback) window.clearTimeout(fallback);
    };
  }, []);

  return null;
}
