import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Building2, Check, Mail, MessageCircle, Pencil, Plus, Power, Save, Trash2, X, Rocket } from 'lucide-react';
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

const normalizeJob = (row: any): JobPost => ({
  id: row.id,
  companyId: row.company_id,
  companyName: row.company_name || 'Empresa',
  companyLogoUrl: row.company_logo_url,
  title: row.title,
  description: row.description,
  requirements: row.requirements,
  benefits: row.benefits,
  salaryMin: row.salary_min,
  salaryMax: row.salary_max,
  employmentType: row.employment_type,
  workModel: row.work_model,
  location: row.location,
  neighborhood: row.neighborhood,
  contactEmail: row.contact_email,
  contactWhatsapp: row.contact_whatsapp,
  contactEmailEnabled: row.contact_email_enabled,
  contactWhatsappEnabled: row.contact_whatsapp_enabled,
  isActive: row.is_active,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function errorText(error: any) {
  const message = error?.message || 'Não foi possível concluir a operação.';
  if (message.includes('COMPANY_ACCOUNT_REQUIRED')) return 'Esta conta não está configurada como empresa.';
  if (message.includes('AUTH_REQUIRED')) return 'Sua sessão expirou. Entre novamente.';
  if (message.includes('JOB_VALIDATION_FAILED')) return message.replace('JOB_VALIDATION_FAILED: ', 'Dados inválidos: ');
  if (message.includes('row-level security')) return 'O banco recusou a operação. Confirme o e-mail e que a conta é empresarial.';
  return message;
}

export default function CompanyDashboard() {
  const { user, logout } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [form, setForm] = useState<JobFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: companyData, error: companyError }, { data: jobData, error: jobError }] = await Promise.all([
      supabase.from('company_profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('job_posts').select('*').eq('company_id', user.id).order('created_at', { ascending: false }),
    ]);
    if (companyError || jobError) setMessage({ type: 'error', text: errorText(companyError || jobError) });
    setCompany(companyData);
    setJobs((jobData || []).map(normalizeJob));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const activeJobs = useMemo(() => jobs.filter(j => j.isActive).length, [jobs]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, contactEmail: company?.email || user?.email || '' });
    setMessage(null);
    setShowForm(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true); setMessage(null);
    const { error } = await supabase.from('company_profiles').update({
      company_name: company.company_name,
      description: company.description || null,
      email: company.email || user.email,
      phone: company.phone || null,
      whatsapp: company.whatsapp || null,
      website: company.website || null,
      address: company.address || null,
      neighborhood: company.neighborhood || null,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    setMessage(error ? { type: 'error', text: errorText(error) } : { type: 'success', text: 'Perfil atualizado.' });
    setSaving(false);
  };

  const publish = async () => {
    if (!user) return;
    const title = form.title.trim();
    const description = form.description.trim();
    if (title.length < 2) return setMessage({ type: 'error', text: 'Informe um título para a oportunidade.' });
    if (description.length < 10) return setMessage({ type: 'error', text: 'A descrição precisa ter pelo menos 10 caracteres.' });
    if (form.salaryMin && form.salaryMax && Number(form.salaryMin) > Number(form.salaryMax)) return setMessage({ type: 'error', text: 'O salário mínimo não pode ser maior que o máximo.' });
    if (!form.contactEmailEnabled && !form.contactWhatsappEnabled) return setMessage({ type: 'error', text: 'Escolha e-mail, WhatsApp ou ambos como contato.' });
    if (form.contactEmailEnabled && !form.contactEmail.trim()) return setMessage({ type: 'error', text: 'Informe o e-mail de contato.' });
    if (form.contactWhatsappEnabled && form.contactWhatsapp.replace(/\D/g, '').length < 10) return setMessage({ type: 'error', text: 'Informe um WhatsApp válido.' });

    setSaving(true); setMessage(null);
    const payload = {
      title,
      description,
      requirements: form.requirements.trim(),
      benefits: form.benefits.trim(),
      salary_min: form.salaryMin,
      salary_max: form.salaryMax,
      employment_type: form.employmentType,
      work_model: form.workModel,
      location: form.location.trim(),
      neighborhood: form.neighborhood.trim(),
      contact_email: form.contactEmail.trim(),
      contact_whatsapp: form.contactWhatsapp.replace(/\D/g, ''),
      contact_email_enabled: form.contactEmailEnabled,
      contact_whatsapp_enabled: form.contactWhatsappEnabled,
      expires_at: form.expiresAt,
    };

    let error: any = null;
    if (editingId) {
      const result = await supabase.from('job_posts').update({ ...payload, is_active: true }).eq('id', editingId).eq('company_id', user.id);
      error = result.error;
    } else {
      const result = await supabase.rpc('create_company_job', { job: payload });
      error = result.error;
    }

    if (error) {
      setMessage({ type: 'error', text: errorText(error) });
    } else {
      setMessage({ type: 'success', text: editingId ? 'Oportunidade atualizada com sucesso.' : 'Oportunidade publicada com sucesso.' });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    }
    setSaving(false);
  };

  const edit = (job: any) => {
    setEditingId(job.id);
    setForm({
      title: job.title, description: job.description, requirements: job.requirements || '', benefits: job.benefits || '',
      salaryMin: job.salaryMin ?? '', salaryMax: job.salaryMax ?? '', employmentType: job.employmentType, workModel: job.workModel,
      location: job.location || '', neighborhood: job.neighborhood || '', contactEmail: job.contactEmail || '', contactWhatsapp: job.contactWhatsapp || '',
      contactEmailEnabled: job.contactEmailEnabled, contactWhatsappEnabled: job.contactWhatsappEnabled, expiresAt: job.expiresAt || '',
    });
    setMessage(null); setShowForm(true);
  };

  const toggle = async (job: JobPost) => {
    const { error } = await supabase.from('job_posts').update({ is_active: !job.isActive }).eq('id', job.id).eq('company_id', user?.id);
    if (error) setMessage({ type: 'error', text: errorText(error) }); else { setMessage({ type: 'success', text: job.isActive ? 'Oportunidade pausada.' : 'Oportunidade reativada.' }); await load(); }
  };

  const remove = async (job: JobPost) => {
    if (!confirm(`Excluir a oportunidade "${job.title}"?`)) return;
    const { error } = await supabase.from('job_posts').delete().eq('id', job.id).eq('company_id', user?.id);
    if (error) setMessage({ type: 'error', text: errorText(error) }); else { setMessage({ type: 'success', text: 'Oportunidade excluída.' }); await load(); }
  };

  if (!user || loading) return <Card><div className="py-16 text-center"><Building2 className="mx-auto w-10 h-10 text-emerald-600"/><h1 className="font-bold mt-3">Área da Empresa</h1><p className="text-sm text-slate-500">Carregando...</p></div></Card>;
  if (!company) return <Card><div className="py-16 text-center"><Building2 className="mx-auto w-10 h-10 text-emerald-600"/><h1 className="font-bold mt-3">Perfil empresarial não encontrado</h1><p className="text-sm text-slate-500">Entre novamente com uma conta empresarial confirmada.</p></div></Card>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="text-emerald-600"/>{company.company_name}</h1><p className="text-sm text-slate-500">{activeJobs} oportunidade{activeJobs === 1 ? '' : 's'} ativa{activeJobs === 1 ? '' : 's'}</p></div>
      <div className="flex gap-2"><button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold"><Rocket className="w-4 h-4"/>Publicar oportunidade</button><button onClick={logout} className="px-3 py-2 rounded-xl text-sm text-slate-500">Sair</button></div>
    </div>

    {message && <div className={message.type === 'error' ? 'p-3 rounded-xl bg-red-50 text-red-700 text-sm' : 'p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm'}>{message.text}</div>}

    <Card><div className="flex items-center justify-between gap-3 mb-4"><div><h2 className="font-bold">Suas oportunidades</h2><p className="text-sm text-slate-500">Publique vagas para os moradores.</p></div><button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold"><Plus className="w-4 h-4"/>Nova oportunidade</button></div>
      {jobs.length === 0 ? <div className="text-center py-10"><Briefcase className="w-10 h-10 mx-auto text-emerald-500 mb-3"/><p className="font-semibold">Nenhuma oportunidade publicada.</p><button onClick={openNew} className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold">Publicar agora</button></div> : <div className="space-y-3">{jobs.map(job => <div key={job.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{job.title}</h3><p className="text-xs text-slate-500 mt-1">{job.neighborhood || 'Sem bairro'} · {job.workModel} · {job.employmentType}</p></div><span className={`text-xs font-bold px-2 py-1 rounded-full ${job.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{job.isActive ? 'Ativa' : 'Pausada'}</span></div><div className="flex gap-2 mt-4 flex-wrap"><button onClick={()=>edit(job)} className="px-3 py-2 rounded-lg bg-slate-100 text-sm font-semibold inline-flex gap-2 items-center"><Pencil className="w-4 h-4"/>Editar</button><button onClick={()=>toggle(job)} className="px-3 py-2 rounded-lg bg-slate-100 text-sm font-semibold inline-flex gap-2 items-center"><Power className="w-4 h-4"/>{job.isActive ? 'Pausar' : 'Ativar'}</button><button onClick={()=>remove(job)} className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold inline-flex gap-2 items-center"><Trash2 className="w-4 h-4"/>Excluir</button></div></div>)}</div>}
    </Card>

    <Card><h2 className="font-bold mb-4">Perfil da empresa</h2><div className="grid sm:grid-cols-2 gap-3">
      {(['company_name','email','phone','whatsapp','website','address','neighborhood'] as const).map(key => <input key={key} value={company[key] || ''} onChange={e=>setCompany({...company,[key]:e.target.value})} placeholder={key.replace('_',' ')} className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800"/>)}
      <textarea value={company.description || ''} onChange={e=>setCompany({...company,description:e.target.value})} placeholder="Descrição da empresa" rows={4} className="sm:col-span-2 px-4 py-3 rounded-xl border bg-white dark:bg-slate-800"/>
    </div><button onClick={saveProfile} disabled={saving} className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold inline-flex gap-2 items-center"><Save className="w-4 h-4"/>Salvar perfil</button></Card>

    {showForm && <div className="fixed inset-0 z-50 bg-black/60 p-4 overflow-y-auto"><div className="max-w-3xl mx-auto my-8 bg-white dark:bg-slate-900 rounded-2xl p-6"><div className="flex justify-between items-center mb-5"><div><h2 className="text-xl font-bold">{editingId ? 'Editar oportunidade' : 'Publicar oportunidade'}</h2><p className="text-sm text-slate-500">Preencha os dados da vaga e escolha como receber contatos.</p></div><button onClick={()=>setShowForm(false)}><X/></button></div>
      <div className="grid sm:grid-cols-2 gap-3"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Título" className="sm:col-span-2 px-4 py-3 rounded-xl border"/><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição" rows={5} className="sm:col-span-2 px-4 py-3 rounded-xl border"/><textarea value={form.requirements} onChange={e=>setForm({...form,requirements:e.target.value})} placeholder="Requisitos" rows={4} className="px-4 py-3 rounded-xl border"/><textarea value={form.benefits} onChange={e=>setForm({...form,benefits:e.target.value})} placeholder="Benefícios" rows={4} className="px-4 py-3 rounded-xl border"/><select value={form.employmentType} onChange={e=>setForm({...form,employmentType:e.target.value as EmploymentType})} className="px-4 py-3 rounded-xl border">{employmentOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select value={form.workModel} onChange={e=>setForm({...form,workModel:e.target.value as WorkModel})} className="px-4 py-3 rounded-xl border">{modelOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><input value={form.salaryMin} onChange={e=>setForm({...form,salaryMin:e.target.value.replace(/\D/g,'')})} placeholder="Salário mínimo" className="px-4 py-3 rounded-xl border"/><input value={form.salaryMax} onChange={e=>setForm({...form,salaryMax:e.target.value.replace(/\D/g,'')})} placeholder="Salário máximo" className="px-4 py-3 rounded-xl border"/><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Localização" className="px-4 py-3 rounded-xl border"/><input value={form.neighborhood} onChange={e=>setForm({...form,neighborhood:e.target.value})} placeholder="Bairro" className="px-4 py-3 rounded-xl border"/><input type="date" value={form.expiresAt} onChange={e=>setForm({...form,expiresAt:e.target.value})} className="px-4 py-3 rounded-xl border"/><input type="email" value={form.contactEmail} onChange={e=>setForm({...form,contactEmail:e.target.value})} placeholder="E-mail de contato" className="px-4 py-3 rounded-xl border"/><input value={form.contactWhatsapp} onChange={e=>setForm({...form,contactWhatsapp:e.target.value})} placeholder="WhatsApp" className="px-4 py-3 rounded-xl border"/></div>
      <div className="mt-4 space-y-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.contactEmailEnabled} onChange={e=>setForm({...form,contactEmailEnabled:e.target.checked})}/><Mail className="w-4 h-4"/>Receber contatos por e-mail</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.contactWhatsappEnabled} onChange={e=>setForm({...form,contactWhatsappEnabled:e.target.checked})}/><MessageCircle className="w-4 h-4"/>Receber contatos por WhatsApp</label></div>
      <div className="mt-6 flex justify-end gap-2"><button onClick={()=>setShowForm(false)} className="px-4 py-2 rounded-xl bg-slate-100 font-semibold">Cancelar</button><button onClick={publish} disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold inline-flex gap-2 items-center"><Check className="w-4 h-4"/>{saving ? 'Publicando...' : editingId ? 'Salvar alterações' : 'Publicar oportunidade'}</button></div></div></div>}
  </div>;
}
