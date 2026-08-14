import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Building2, Eye, EyeOff, KeyRound, MapPin, MailCheck, ArrowLeft } from 'lucide-react';

const HCAPTCHA_SITEKEY = 'a306b7dc-5146-4ae0-b146-eefac760b3c2';

function friendlyAuthError(message: string) {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'E-mail ou senha incorretos. Se você acabou de criar a conta, confirme o e-mail recebido antes de entrar.';
  if (text.includes('email not confirmed')) return 'Seu e-mail ainda não foi confirmado. Abra o e-mail enviado pelo No Meu Bairro e clique no link de confirmação.';
  if (text.includes('user already registered') || text.includes('already been registered')) return 'Este e-mail já possui uma conta. Use o login ou recupere o acesso.';
  if (text.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (text.includes('captcha')) return 'Confirme a verificação de segurança antes de continuar.';
  if (text.includes('same password')) return 'A nova senha precisa ser diferente da senha atual.';
  return message;
}

function getModeFromUrl(): 'login' | 'forgot' | 'reset' {
  const mode = new URLSearchParams(window.location.search).get('mode');
  if (mode === 'forgot') return 'forgot';
  if (mode === 'reset') return 'reset';
  return 'login';
}

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [companyMode, setCompanyMode] = useState(false), [register, setRegister] = useState(false);
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [loading, setLoading] = useState(false), [resending, setResending] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(() => getModeFromUrl());
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const captchaRef = useRef<HCaptcha>(null);
  const normalizedEmail = email.trim().toLowerCase();

  useEffect(() => setMode(getModeFromUrl()), []);

  const resetCaptcha = () => {
    captchaRef.current?.resetCaptcha();
    setCaptchaToken('');
    setCaptchaKey((key) => key + 1);
  };

  const navigateMode = (nextMode: 'login' | 'forgot' | 'reset') => {
    const suffix = nextMode === 'login' ? '' : `?mode=${nextMode}`;
    window.history.replaceState({}, document.title, `${window.location.pathname}${suffix}${window.location.hash || '#/login'}`);
    setMode(nextMode);
    setError('');
    setSuccess('');
    setLoading(false);
    if (nextMode !== 'reset') resetCaptcha();
  };

  const resendConfirmation = async () => {
    if (!normalizedEmail) return setError('Digite seu e-mail para reenviar a confirmação.');
    setError(''); setSuccess(''); setResending(true);
    const { error: e } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail });
    if (e) setError(friendlyAuthError(e.message)); else setSuccess('Novo e-mail de confirmação enviado. Verifique sua caixa de entrada e o spam.');
    setResending(false);
  };

  const sendResetLink = async () => {
    if (!normalizedEmail) return setError('Informe o e-mail da sua conta.');
    if (!captchaToken) return setError('Confirme a verificação de segurança antes de continuar.');
    setError(''); setSuccess(''); setLoading(true);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}?mode=reset#/login`;
      const { error: e } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo, captchaToken });
      resetCaptcha();
      if (e) setError(friendlyAuthError(e.message)); else setSuccess('Enviamos um link para redefinir sua senha. Verifique seu e-mail e também a pasta de spam.');
    } catch (err) {
      resetCaptcha();
      setError(err instanceof Error ? friendlyAuthError(err.message) : 'Não foi possível enviar o link de recuperação.');
    } finally { setLoading(false); }
  };

  const updateForgottenPassword = async () => {
    if (password.length < 6) return setError('A nova senha precisa ter pelo menos 6 caracteres.');
    if (password !== confirmPassword) return setError('As senhas não conferem.');
    setError(''); setSuccess(''); setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setError('O link de recuperação expirou ou já foi utilizado. Solicite um novo link.');
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) return setError(friendlyAuthError(e.message));
      await supabase.auth.signOut();
      setPassword(''); setConfirmPassword('');
      setSuccess('Senha alterada com sucesso. Agora você já pode entrar com a nova senha.');
      navigateMode('login');
    } catch (err) { setError(err instanceof Error ? friendlyAuthError(err.message) : 'Não foi possível alterar sua senha.'); }
    finally { setLoading(false); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (mode === 'forgot') return sendResetLink();
    if (mode === 'reset') return updateForgottenPassword();
    if (!normalizedEmail) return setError('Informe um e-mail válido.');
    if (!captchaToken) return setError('Confirme a verificação de segurança antes de continuar.');
    setLoading(true);
    try {
      if (register) {
        const { data, error: e } = await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { name: name.trim(), account_type: companyMode ? 'company' : 'resident' }, captchaToken } });
        if (e) return setError(friendlyAuthError(e.message));
        if (!data.user) return setError('Não foi possível criar a conta.');
        resetCaptcha();
        if (!data.session) { setSuccess('Conta criada! Confirme seu e-mail antes de fazer login.'); setRegister(false); setPassword(''); return; }
        nav(companyMode ? '/empresa' : '/perfil'); return;
      }
      const { data, error: e } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password, options: { captchaToken } });
      resetCaptcha();
      if (e) return setError(friendlyAuthError(e.message));
      if (!data.user) return setError('Não foi possível entrar.');
      if (companyMode) {
        const { data: profile } = await supabase.from('users').select('account_type').eq('id', data.user.id).maybeSingle();
        if (profile?.account_type !== 'company') { await supabase.auth.signOut(); return setError('Esta conta é de morador. Use o acesso de morador.'); }
        nav('/empresa'); return;
      }
      nav('/perfil');
    } catch (err) { resetCaptcha(); setError(err instanceof Error ? friendlyAuthError(err.message) : 'Ocorreu um erro. Tente novamente.'); }
    finally { setLoading(false); }
  };

  const title = mode === 'forgot' ? 'Recuperar senha' : mode === 'reset' ? 'Criar nova senha' : companyMode ? (register ? 'Criar conta empresarial' : 'Área da Empresa') : (register ? 'Criar conta' : 'Bem-vindo de volta');
  const subtitle = mode === 'forgot' ? 'Informe seu e-mail para receber o link de recuperação.' : mode === 'reset' ? 'Defina uma nova senha para sua conta.' : companyMode ? 'Publique e gerencie suas vagas.' : 'Entre para participar da comunidade.';
  const showCaptcha = mode !== 'reset';

  return <div className="min-h-[80vh] flex items-center justify-center px-4 py-12"><div className="w-full max-w-md">
    <div className="text-center mb-8"><div className="inline-flex w-16 h-16 rounded-2xl bg-emerald-600 items-center justify-center mb-4">{mode !== 'login' ? <KeyRound className="w-8 h-8 text-white"/> : companyMode ? <Building2 className="w-8 h-8 text-white"/> : <MapPin className="w-8 h-8 text-white"/>}</div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1><p className="text-sm text-slate-500 mt-1">{subtitle}</p></div>
    <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-6 sm:p-8">
      <form onSubmit={submit} className="space-y-4">
        {mode === 'forgot' && <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"/>}
        {mode === 'reset' && <><div className="relative"><input required minLength={6} type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nova senha" autoComplete="new-password" className="w-full px-4 py-3 pr-12 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show?<EyeOff className="w-5 h-5"/>:<Eye className="w-5 h-5"/>}</button></div><input required minLength={6} type={show?'text':'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirme a nova senha" autoComplete="new-password" className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"/>}
        {mode === 'login' && register && <input required value={name} onChange={e=>setName(e.target.value)} placeholder={companyMode?'Nome da empresa':'Nome completo'} className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"/>}
        {mode === 'login' && <><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"/><div className="relative"><input required minLength={6} type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" autoComplete={register?'new-password':'current-password'} className="w-full px-4 py-3 pr-12 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show?<EyeOff className="w-5 h-5"/>:<Eye className="w-5 h-5"/>}</button></div></>}
        {showCaptcha && <div className="flex justify-center py-1"><HCaptcha key={captchaKey} ref={captchaRef} sitekey={HCAPTCHA_SITEKEY} onVerify={setCaptchaToken} onExpire={()=>setCaptchaToken('')} onError={()=>setCaptchaToken('')} /></div>}
        {error && <p className="text-sm text-red-500 leading-relaxed">{error}</p>}{success && <p className="text-sm text-emerald-600 leading-relaxed">{success}</p>}
        <button disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50">{loading?'Aguarde...':mode==='forgot'?'Enviar link de recuperação':mode==='reset'?'Alterar senha':register?'Criar conta':companyMode?'Entrar como empresa':'Entrar'}</button>
      </form>
      <div className="mt-5 space-y-2">
        {mode !== 'login' ? <button type="button" onClick={()=>navigateMode('login')} className="w-full text-sm text-slate-500 hover:text-emerald-600 flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4"/>Voltar para o login</button> : <>
          {!register && <button type="button" onClick={()=>navigateMode('forgot')} className="w-full text-sm text-emerald-600 font-semibold flex items-center justify-center gap-2"><KeyRound className="w-4 h-4"/>Esqueci minha senha</button>}
          {!register && <button type="button" disabled={resending} onClick={resendConfirmation} className="w-full text-sm text-slate-500 hover:text-emerald-600 flex items-center justify-center gap-2 disabled:opacity-50"><MailCheck className="w-4 h-4"/>{resending?'Enviando...':'Reenviar confirmação por e-mail'}</button>}
          <button type="button" onClick={()=>{setRegister(!register);setError('');setSuccess('');setPassword('');resetCaptcha();}} className="w-full text-sm text-emerald-600 font-semibold">{register?'Já tenho conta':'Criar uma conta'}</button>
          <button type="button" onClick={()=>{setCompanyMode(!companyMode);setRegister(false);setError('');setSuccess('');setPassword('');resetCaptcha();}} className="w-full text-sm text-slate-500 flex items-center justify-center gap-2"><Building2 className="w-4 h-4"/>{companyMode?'Sou morador':'Sou uma empresa'}</button>
        </>}
      </div>
    </div>
  </div></div>;
}
