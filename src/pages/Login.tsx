import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Building2, Eye, EyeOff, KeyRound, MapPin, MailCheck, ArrowLeft } from 'lucide-react';

const HCAPTCHA_SITEKEY = 'a306b7dc-5146-4ae0-b146-eefac760b3c2';
const RECOVERY_FLAG = 'nmb-password-recovery';

function friendlyAuthError(message: string) {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'E-mail ou senha incorretos. Se você acabou de criar a conta, confirme o e-mail recebido antes de entrar.';
  if (text.includes('email not confirmed')) return 'Seu e-mail ainda não foi confirmado. Abra o e-mail enviado pelo No Meu Bairro e clique no link de confirmação.';
  if (text.includes('user already registered') || text.includes('already been registered')) return 'Este e-mail já possui uma conta. Use o login ou recupere o acesso.';
  if (text.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (text.includes('captcha')) return 'Confirme a verificação de segurança antes de continuar.';
  if (text.includes('same password')) return 'A nova senha precisa ser diferente da senha atual.';
  if (text.includes('expired') || text.includes('otp')) return 'O link de recuperação expirou ou já foi utilizado. Solicite um novo link.';
  return message;
}

function routeParams() {
  const hash = window.location.hash || '';
  const queryIndex = hash.indexOf('?');
  return queryIndex >= 0 ? new URLSearchParams(hash.slice(queryIndex + 1)) : new URLSearchParams();
}

function getModeFromUrl(): 'login' | 'forgot' | 'reset' {
  const searchMode = new URLSearchParams(window.location.search).get('mode');
  const hashMode = routeParams().get('mode');
  const mode = hashMode || searchMode;
  if (mode === 'forgot') return 'forgot';
  if (mode === 'reset') return 'reset';
  return 'login';
}

function getRecoveryError() {
  return routeParams().get('recoveryError') || new URLSearchParams(window.location.search).get('recoveryError') || '';
}

async function waitForRecoverySession() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise((resolve) => window.setTimeout(resolve, 200));
  }
  return null;
}

export default function Login() {
  const nav = useNavigate();
  const [companyMode, setCompanyMode] = useState(false);
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(() => getModeFromUrl());
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const normalizedEmail = email.trim().toLowerCase();

  useEffect(() => {
    const syncMode = () => {
      const nextMode = getModeFromUrl();
      setMode(nextMode);
      if (getRecoveryError() === 'expired') {
        setError('Este link de recuperação expirou ou já foi usado. Solicite um novo link abaixo.');
      }
    };
    syncMode();
    window.addEventListener('hashchange', syncMode);
    return () => window.removeEventListener('hashchange', syncMode);
  }, []);

  const resetCaptcha = () => {
    setCaptchaToken('');
    setCaptchaKey((key) => key + 1);
  };

  const navigateMode = (nextMode: 'login' | 'forgot' | 'reset') => {
    const suffix = nextMode === 'login' ? '' : `?mode=${nextMode}`;
    window.location.hash = `/login${suffix}`;
    setMode(nextMode);
    setError('');
    setSuccess('');
    setLoading(false);
    if (nextMode !== 'reset') resetCaptcha();
  };

  const resendConfirmation = async () => {
    if (!normalizedEmail) {
      setError('Digite seu e-mail para reenviar a confirmação.');
      return;
    }
    setError('');
    setSuccess('');
    setResending(true);
    const { error: e } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail });
    if (e) setError(friendlyAuthError(e.message));
    else setSuccess('Novo e-mail de confirmação enviado. Verifique sua caixa de entrada e o spam.');
    setResending(false);
  };

  const sendResetLink = async () => {
    if (!normalizedEmail) {
      setError('Informe o e-mail da sua conta.');
      return;
    }
    if (!captchaToken) {
      setError('Confirme a verificação de segurança antes de continuar.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      // Do not put a HashRouter route in redirectTo. Supabase needs the URL fragment
      // for its temporary recovery session and the app routes only after it is parsed.
      const redirectTo = `${window.location.origin}${window.location.pathname}?recovery=1`;
      const { error: e } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
        captchaToken,
      });
      resetCaptcha();
      if (e) setError(friendlyAuthError(e.message));
      else setSuccess('Enviamos um link para redefinir sua senha. Use o link mais recente recebido e verifique também o spam.');
    } catch (err) {
      resetCaptcha();
      setError(err instanceof Error ? friendlyAuthError(err.message) : 'Não foi possível enviar o link de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  const updateForgottenPassword = async () => {
    if (password.length < 6) {
      setError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      let recoveryFlag = false;
      try { recoveryFlag = sessionStorage.getItem(RECOVERY_FLAG) === '1'; } catch {}
      const session = await waitForRecoverySession();
      if (!session || !recoveryFlag) {
        setError('O link de recuperação expirou ou já foi utilizado. Solicite um novo link.');
        return;
      }
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) {
        setError(friendlyAuthError(e.message));
        return;
      }
      try { sessionStorage.removeItem(RECOVERY_FLAG); } catch {}
      await supabase.auth.signOut();
      setPassword('');
      setConfirmPassword('');
      navigateMode('login');
      setSuccess('Senha alterada com sucesso. Agora você já pode entrar com a nova senha.');
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : 'Não foi possível alterar sua senha.');
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'forgot') {
      await sendResetLink();
      return;
    }
    if (mode === 'reset') {
      await updateForgottenPassword();
      return;
    }
    if (!normalizedEmail) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (!captchaToken) {
      setError('Confirme a verificação de segurança antes de continuar.');
      return;
    }

    setLoading(true);
    try {
      if (register) {
        const { data, error: e } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { name: name.trim(), account_type: companyMode ? 'company' : 'resident' },
            captchaToken,
          },
        });
        if (e) {
          setError(friendlyAuthError(e.message));
          return;
        }
        if (!data.user) {
          setError('Não foi possível criar a conta.');
          return;
        }
        resetCaptcha();
        if (!data.session) {
          setSuccess('Conta criada! Confirme seu e-mail antes de fazer login.');
          setRegister(false);
          setPassword('');
          return;
        }
        nav(companyMode ? '/empresa' : '/perfil');
        return;
      }

      const { data, error: e } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
        options: { captchaToken },
      });
      resetCaptcha();
      if (e) {
        setError(friendlyAuthError(e.message));
        return;
      }
      if (!data.user) {
        setError('Não foi possível entrar.');
        return;
      }
      if (companyMode) {
        const { data: profile } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', data.user.id)
          .maybeSingle();
        if (profile?.account_type !== 'company') {
          await supabase.auth.signOut();
          setError('Esta conta é de morador. Use o acesso de morador.');
          return;
        }
        nav('/empresa');
        return;
      }
      nav('/perfil');
    } catch (err) {
      resetCaptcha();
      setError(err instanceof Error ? friendlyAuthError(err.message) : 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === 'forgot'
      ? 'Recuperar senha'
      : mode === 'reset'
        ? 'Criar nova senha'
        : companyMode
          ? (register ? 'Criar conta empresarial' : 'Área da Empresa')
          : (register ? 'Criar conta' : 'Bem-vindo de volta');
  const subtitle =
    mode === 'forgot'
      ? 'Informe seu e-mail para receber o link de recuperação.'
      : mode === 'reset'
        ? 'Defina uma nova senha para sua conta.'
        : companyMode
          ? 'Publique e gerencie suas vagas.'
          : 'Entre para participar da comunidade.';

  const renderPassword = (placeholder: string, autoComplete: string, value: string, onChange: (value: string) => void) => (
    <div className="relative">
      <input
        required
        minLength={6}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full px-4 py-3 pr-12 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
      />
      <button
        type="button"
        onClick={() => setShow((value) => !value)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-emerald-600 items-center justify-center mb-4">
            {mode !== 'login' ? <KeyRound className="w-8 h-8 text-white" /> : companyMode ? <Building2 className="w-8 h-8 text-white" /> : <MapPin className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-4">
            {mode === 'forgot' && (
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            )}

            {mode === 'reset' && (
              <>
                {renderPassword('Nova senha', 'new-password', password, setPassword)}
                <input
                  required
                  minLength={6}
                  type={show ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a nova senha"
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </>
            )}

            {mode === 'login' && register && (
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={companyMode ? 'Nome da empresa' : 'Nome completo'}
                className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            )}

            {mode === 'login' && (
              <>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
                {renderPassword('Senha', register ? 'new-password' : 'current-password', password, setPassword)}
              </>
            )}

            {mode !== 'reset' && (
              <div className="flex justify-center py-1">
                <HCaptcha
                  key={captchaKey}
                  sitekey={HCAPTCHA_SITEKEY}
                  onVerify={setCaptchaToken}
                  onExpire={() => setCaptchaToken('')}
                  onError={() => setCaptchaToken('')}
                />
              </div>
            )}

            {error && <p className="text-sm text-red-500 leading-relaxed">{error}</p>}
            {success && <p className="text-sm text-emerald-600 leading-relaxed">{success}</p>}

            <button
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50"
            >
              {loading
                ? 'Aguarde...'
                : mode === 'forgot'
                  ? 'Enviar link de recuperação'
                  : mode === 'reset'
                    ? 'Alterar senha'
                    : register
                      ? 'Criar conta'
                      : companyMode
                        ? 'Entrar como empresa'
                        : 'Entrar'}
            </button>
          </form>

          <div className="mt-5 space-y-2">
            {mode !== 'login' ? (
              <button
                type="button"
                onClick={() => navigateMode('login')}
                className="w-full text-sm text-slate-500 hover:text-emerald-600 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para o login
              </button>
            ) : (
              <>
                {!register && (
                  <button
                    type="button"
                    onClick={() => navigateMode('forgot')}
                    className="w-full text-sm text-emerald-600 font-semibold flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" /> Esqueci minha senha
                  </button>
                )}
                {!register && (
                  <button
                    type="button"
                    disabled={resending}
                    onClick={resendConfirmation}
                    className="w-full text-sm text-slate-500 hover:text-emerald-600 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <MailCheck className="w-4 h-4" />
                    {resending ? 'Enviando...' : 'Reenviar confirmação por e-mail'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setRegister((value) => !value);
                    setError('');
                    setSuccess('');
                    setPassword('');
                    resetCaptcha();
                  }}
                  className="w-full text-sm text-emerald-600 font-semibold"
                >
                  {register ? 'Já tenho conta' : 'Criar uma conta'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCompanyMode((value) => !value);
                    setRegister(false);
                    setError('');
                    setSuccess('');
                    setPassword('');
                    resetCaptcha();
                  }}
                  className="w-full text-sm text-slate-500 flex items-center justify-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  {companyMode ? 'Sou morador' : 'Sou uma empresa'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
