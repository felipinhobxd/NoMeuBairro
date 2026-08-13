import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Building2, Check, Mail, MessageCircle, Pencil, Plus, Power, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import { Card } from '../components/UI';
import type { EmploymentType, JobFormData, JobPost, WorkModel } from '../types/jobs';

const employmentOptions: Array<[EmploymentType, string]> = [
  ['clt', 'CLT'], ['pj', 'PJ'], ['estagio', 'Estágio'], ['aprendiz', 'Aprendiz'], ['temporario', 'Temporário'], ['freelancer', 'Freelancer'],
];
const modelOptions: Array<[WorkModel, string]> = [['presencial', 'Presencial'], ['hibrido', 'Híbrido'], ['remoto', 'Remoto']];
const emptyForm: JobFormData = {
  title: '', description: '', requirements: '', benefits: '', salaryMin: '', salaryMax: '', employmentType: 'clt', workModel: 'presencial',
  location: '', neighborhood: '', contactEmail: '', contactWhatsapp: '', contactEmailEnabled: true, contactWhatsappEnabled: false, expiresAt: '',
};

const toForm = (job: any): JobFormData => ({
  title: job.title || '', description: job.description || '', requirements: job.requirements || '', benefits: job.benefits || '',
  salaryMin: job.salary_min ?? '', salaryMax: job.salary_max ?? '', employmentType: job.employment_type || 'clt', workModel: job.work_model || 'presencial',
  location: job.location || '', neighborhood: job.neighborhood || '', contactEmail: job.contact_email || '', contactWhatsapp: job.contact_whatsapp || '',
  contactEmailEnabled: !!job.contact_email_enabled, contactWhatsappEnabled: !!job.contact_whatsapp_enabled, expiresAt: job.expires_at || '',
});

export default function CompanyDashboard() {
  const { user, logout } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [form, setForm] = useState<JobFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showJobForm, setShowJobForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({ companyName: '', description: '', email: '', phone: '', whatsapp: '', website: '', address: '', neighborhood: '' });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: companyData }, { data: jobData, error: jobError }] = await Promise.all([
      supabase.from('company_profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('job_posts').select('*').eq('company_id', user.id).order('created_at', { ascending: false }),
    ]);
    setCompany(companyData);
    setProfile({
      companyName: companyData?.company_name || '', description: companyData?.description || '', email: companyData?.email || user.email || '',
      phone: companyData?.phone || '', whatsapp: companyData?.whatsapp || '', website: companyData?.website || '', address: companyData?.address || '', neighborhood: companyData?.neighborhood || '',
    });
    setJobs((jobData || []).map((r: any) => ({ id: r.id, companyId: r.company_id, companyName: companyData?.company_name || 'Empresa', title: r.title, description: r.description,
      requirements: r.requirements, benefits: r.benefits, salaryMin: r.salary_min, salaryMax: r.salary_max, employmentType: r.employment_type, workModel: r.work_model,
      location: r.location, neighborhood: r.neighborhood, contactEmail: r.contact_email, contactWhatsapp: r.contact_whatsapp, contactEmailEnabled: r.contact_email_enabled,
      contactWhatsappEnabled: r.contact_whatsapp_enabled, isActive: r.is_active, expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at })));
    setError(jobError?.message || '');
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const activeJobs = useMemo(() => jobs.filter(j => j.isActive).length, [jobs]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true); setError('');
    const { error: e } = await supabase.from('company_profiles').update({ company_name: profile.companyName, description: profile.description, email: profile.email,
      phone: profile.phone || null, whatsapp: profile.whatsapp || null, website: profile.website || null, address: profile.address || null, neighborhood: profile.neighborhood || null,
      updated_at: new Date().toISOString() }).eq('id', user.id);
    if (e) setError(e.message); else setCompany((c: any) => ({ ...c, company_name: profile.companyName }));
    setSaving(false);
  };

  const saveJob = async () => {
    if (!user) return;
    setSaving(true); setError('');
    if (!form.title.trim() || !form.description.trim()) { setError('Preencha título e descrição.'); setSaving(false); return; }
    if (!form.contactEmailEnabled && !form.contactWhatsappEnabled) { setError('Escolha pelo menos uma forma de contato.'); setSaving(false); return; }
    if (form.contactEmailEnabled && !form.contactEmail.trim()) { setError('Informe o e-mail de contato ou desative essa opção.'); setSaving(false); return; }
    if (form.contactWhatsappEnabled && !form.contactWhatsapp.trim()) { setError('Informe o WhatsApp ou desative essa opção.'); setSaving(false); return; }
    const payload = { company_id: user.id, title: form.title.trim(), description: form.description.trim(), requirements: form.requirements.trim() || null, benefits: form.benefits.trim() || null,
      salary_min: form.salaryMin ? Number(form.salaryMin) : null, salary_max: form.salaryMax ? Number(form.salaryMax) : null, employment_type: form.employmentType, work_model: form.workModel,
      location: form.location.trim() || null, neighborhood: form.neighborhood.trim() || null, contact_email: form.contactEmail.trim() || null, contact_whatsapp: form.contactWhatsapp.replace(/\D/g, '') || null,
      contact_email_enabled: form.contactEmailEnabled, contact_whatsapp_enabled: form.contactWhatsappEnabled, expires_at: form.expiresAt || null, is_active: true };
    const result = editingId
      ? await supabase.from('job_posts').update(payload).eq('id', editingId).eq('company_id', user.id)
      : await supabase.from('job_posts').insert(payload);
    if (result.error) setError(result.error.message); else { setShowJobForm(false); setEditingId(null); setForm(emptyForm); await load(); }
    setSaving(false);
  };

  const editJob = (job: any) => { setEditingId(job.id); setForm(toForm(job)); setShowJobForm(true); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleJob = async (job: any) => { const { error: e } = await supabase.from('job_posts').update({ is_active: !job.isActive }).eq('id', job.id).eq('company_id', user?.id); if (e) setError(e.message); else load(); };
  const deleteJob = async (job: any) => { if (!window.confirm(`Excluir a vaga "${job.title}"?`)) return; const { error: e } = await supabase.from('job_posts').delete().eq('id', job.id).eq('company_id', user?.id); if (e) setError(e.message); else load(); };

  if (!user || !company) return <Card><div className="py-16 text-center"><Building2 className="mx-auto w-10 h-10 text-emerald-600"/><h1 className="font-bold mt-3">Área da Empresa</h1><p className="text-sm text-slate-500 mt-1">Entre com uma conta empresarial confirmada por e-mail.</p></div></Card>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="text-emerald-600"/>{company.company_name}</h1><p className="text-sm text-slate-500 mt-1">{activeJobs} vaga{activeJobs === 1 ? '' : 's'} ativa{activeJobs === 1 ? '' : 's'}</p></div><button onClick={logout} className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Sair</button></div>
    {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

    <Card><h2 className="font-bold mb-4">Perfil da empresa</h2><div className="grid sm:grid-cols-2 gap-3">
      {([['companyName','Nome da empresa'],['email','E-mail'],['phone','Telefone'],['whatsapp','WhatsApp'],['website','Site'],['address','Endereço'],['neighborhood','Bairro']] as const).map(([key,label]) => <input key={key} value={profile[key]} onChange={e=>setProfile({...profile,[key]:e.target.value})} placeholder={label} className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />)}
      <textarea value={profile.description} onChange={e=>setProfile({...profile,description:e.target.value})} placeholder="Descrição da empresa" rows={4} className="sm:col-span-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
    </div><button onClick={saveProfile} disabled={saving} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50"><Save className="w-4 h-4"/>Salvar perfil</button></Card>

    <Card><div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h2 className="font-bold">Minhas vagas</h2><button onClick={()=>{setEditingId(null);setForm({...emptyForm,contactEmail:company.email||user.email||''});setShowJobForm(true);setError('');}} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold"><Plus className="w-4 h-4"/>Nova vaga</button></div>
      {jobs.length===0?<p className="text-sm text-slate-500 py-8 text-center">Você ainda não publicou nenhuma vaga.</p>:<div className="space-y-3">{jobs.map(j=><div key={j.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{j.title}</h3><p className="text-xs text-slate-500 mt-1">{j.neighborhood||'Sem bairro'} · {j.workModel} · {j.employmentType}</p></div><span className={`text-xs font-bold px-2 py-1 rounded-full ${j.isActive?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{j.isActive?'Ativa':'Pausada'}</span></div><div className="flex flex-wrap gap-2 mt-4"><button onClick={()=>editJob(j)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold"><Pencil className="w-4 h-4"/>Editar</button><button onClick={()=>toggleJob(j)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold"><Power className="w-4 h-4"/>{j.isActive?'Pausar':'Ativar'}</button><button onClick={()=>deleteJob(j)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold"><Trash2 className="w-4 h-4"/>Excluir</button></div></div>)}</div>}
    </Card>

    {showJobForm && <div className="fixed inset-0 z-50 bg-slate-950/60 p-4 overflow-y-auto"><div className="max-w-3xl mx-auto my-8 bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-7"><div className="flex items-center justify-between mb-5"><div><h2 className="text-xl font-bold">{editingId?'Editar vaga':'Publicar vaga'}</h2><p className="text-sm text-slate-500">Somente sua empresa poderá editar esta vaga.</p></div><button onClick={()=>setShowJobForm(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X/></button></div><div className="grid sm:grid-cols-2 gap-3">
      <input className="sm:col-span-2 px-4 py-3 rounded-xl border" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Título da vaga"/>
      <textarea className="sm:col-span-2 px-4 py-3 rounded-xl border" rows={5} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição"/>
      <textarea className="px-4 py-3 rounded-xl border" rows={4} value={form.requirements} onChange={e=>setForm({...form,requirements:e.target.value})} placeholder="Requisitos"/>
      <textarea className="px-4 py-3 rounded-xl border" rows={4} value={form.benefits} onChange={e=>setForm({...form,benefits:e.target.value})} placeholder="Benefícios"/>
      <select className="px-4 py-3 rounded-xl border" value={form.employmentType} onChange={e=>setForm({...form,employmentType:e.target.value as EmploymentType})}>{employmentOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      <select className="px-4 py-3 rounded-xl border" value={form.workModel} onChange={e=>setForm({...form,workModel:e.target.value as WorkModel})}>{modelOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      <input className="px-4 py-3 rounded-xl border" value={form.salaryMin} onChange={e=>setForm({...form,salaryMin:e.target.value.replace(/\D/g,'')})} placeholder="Salário mínimo" inputMode="numeric"/>
      <input className="px-4 py-3 rounded-xl border" value={form.salaryMax} onChange={e=>setForm({...form,salaryMax:e.target.value.replace(/\D/g,'')})} placeholder="Salário máximo" inputMode="numeric"/>
      <input className="px-4 py-3 rounded-xl border" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Localização"/>
      <input className="px-4 py-3 rounded-xl border" value={form.neighborhood} onChange={e=>setForm({...form,neighborhood:e.target.value})} placeholder="Bairro"/>
      <input className="px-4 py-3 rounded-xl border" value={form.expiresAt} onChange={e=>setForm({...form,expiresAt:e.target.value})} type="date"/>
      <input className="px-4 py-3 rounded-xl border" value={form.contactEmail} onChange={e=>setForm({...form,contactEmail:e.target.value})} placeholder="E-mail para contato" type="email"/>
      <input className="px-4 py-3 rounded-xl border" value={form.contactWhatsapp} onChange={e=>setForm({...form,contactWhatsapp:e.target.value})} placeholder="WhatsApp (somente números)"/>
    </div><div className="mt-4 space-y-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.contactEmailEnabled} onChange={e=>setForm({...form,contactEmailEnabled:e.target.checked})}/><Mail className="w-4 h-4"/>Mostrar contato por e-mail</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.contactWhatsappEnabled} onChange={e=>setForm({...form,contactWhatsappEnabled:e.target.checked})}/><MessageCircle className="w-4 h-4"/>Mostrar contato por WhatsApp</label></div><div className="mt-6 flex justify-end gap-2"><button onClick={()=>setShowJobForm(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold">Cancelar</button><button onClick={saveJob} disabled={saving} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50"><Check className="w-4 h-4 inline mr-2"/>{saving?'Salvando...':editingId?'Salvar alterações':'Publicar vaga'}</button></div></div></div>}
  </div>;
}
