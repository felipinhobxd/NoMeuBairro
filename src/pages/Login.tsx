import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import { Building2, Eye, EyeOff, MapPin, MailCheck } from 'lucide-react';

function friendlyAuthError(message: string) {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'E-mail ou senha incorretos. Se você acabou de criar a conta, confirme o e-mail recebido antes de entrar.';
  if (text.includes('email not confirmed')) return 'Seu e-mail ainda não foi confirmado. Abra o e-mail enviado pelo No Meu Bairro e clique no link de confirmação.';
  if (text.includes('user already registered') || text.includes('already been registered')) return 'Este e-mail já possui uma conta. Use o login ou recupere o acesso.';
  if (text.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  return message;
}

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [companyMode, setCompanyMode] = useState(false), [register, setRegister] = useState(false);
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [show, setShow] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [loading, setLoading] = useState(false), [resending, setResending] = useState(false);
  const normalizedEmail = email.trim().toLowerCase();

  const resendConfirmation = async () => {
    if (!normalizedEmail) return setError('Digite seu e-mail para reenviar a confirmação.');
    setError(''); setSuccess(''); setResending(true);
    const { error: e } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail });
    if (e) setError(friendlyAuthError(e.message)); else setSuccess('Novo e-mail de confirmação enviado. Verifique sua caixa de entrada e o spam.');
    setResending(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      if (!normalizedEmail) return setError('Informe um e-mail válido.');
      if (register) {
        const { data, error: e } = await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { name: name.trim(), account_type: companyMode ? 'company' : 'resident' } } });
        if (e) return setError(friendlyAuthError(e.message));
        if (!data.user) return setError('Não foi possível criar a conta.');
        if (!data.session) { setSuccess('Conta criada! Confirme seu e-mail antes de fazer login.'); setRegister(false); setPassword(''); return; }
        nav(companyMode ? '/empresa' : '/perfil'); return;
      }
      if (companyMode) {
        const { data, error: e } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (e) return setError(friendlyAuthError(e.message));
        if (!data.user) return setError('Não foi possível entrar.');
        const { data: profile } = await supabase.from('users').select('account_type').eq('id', data.user.id).maybeSingle();
        if (profile?.account_type !== 'company') { await supabase.auth.signOut(); return setError('Esta conta é de morador. Use o acesso de morador.'); }
        nav('/empresa'); return;
      }
      const r = await login(normalizedEmail, password);
      if (!r.ok) return setError(friendlyAuthError(r.error || 'Login não realizado.'));
      nav('/perfil');
    } catch (err) { setError(err instanceof Error ? friendlyAuthError(err.message) : 'Ocorreu um erro. Tente novamente.'); }
    finally { setLoading(false); }
  };

  return <div className="min-h-[80vh] flex items-center justify-center px-4 py-12"><div className="w-full max-w-md">
    <div className="text-center mb-8"><div className="inline-flex w-16 h-16 rounded-2xl bg-emerald-600 items-center justify-center mb-4">{companyMode ? <Building2 className="w-8 h-8 text-white"/> : <MapPin className="w-8 h-8 text-white"/>}</div>
      <h1 className="text-xl font-bold">{companyMode ? (register ? 'Criar conta empresarial' : 'Área da Empresa') : (register ? 'Criar conta' : 'Bem-vindo de volta')}</h1><p className="text-sm text-slate-500 mt-1">{companyMode ? 'Publique e gerencie suas vagas.' : 'Entre para participar da comunidade.'}</p></div>
    <div className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800 p-6 sm:p-8"><form onSubmit={submit} className="space-y-4">
      {register && <input required value={name} onChange={e=>setName(e.target.value)} placeholder={companyMode?'Nome da empresa':'Nome completo'} className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800"/>}
      <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" className="w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800"/>
      <div className="relative"><input required minLength={6} type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" autoComplete={register?'new-password':'current-password'} className="w-full px-4 py-3 pr-12 rounded-xl border bg-white dark:bg-slate-800"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show?<EyeOff className="w-5 h-5"/>:<Eye className="w-5 h-5"/>}</button></div>
      {error && <p className="text-sm text-red-500 leading-relaxed">{error}</p>}{success && <p className="text-sm text-emerald-600 leading-relaxed">{success}</p>}
      <button disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50">{loading?'Aguarde...':register?'Criar conta':companyMode?'Entrar como empresa':'Entrar'}</button></form>
      <div className="mt-5 space-y-2">{!register && <button disabled={resending} onClick={resendConfirmation} className="w-full text-sm text-slate-500 hover:text-emerald-600 flex items-center justify-center gap-2 disabled:opacity-50"><MailCheck className="w-4 h-4"/>{resending?'Enviando...':'Reenviar confirmação por e-mail'}</button>}
        <button onClick={()=>{setRegister(!register);setError('');setSuccess('')}} className="w-full text-sm text-emerald-600 font-semibold">{register?'Já tenho conta':'Criar uma conta'}</button>
        <button onClick={()=>{setCompanyMode(!companyMode);setRegister(false);setError('');setSuccess('');setPassword('')}} className="w-full text-sm text-slate-500 flex items-center justify-center gap-2"><Building2 className="w-4 h-4"/>{companyMode?'Sou morador':'Sou uma empresa'}</button></div>
    </div></div></div>;
}
