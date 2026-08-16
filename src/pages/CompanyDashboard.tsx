import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Pencil, Power, Save, Trash2, X, Users, Mail, Phone, MapPin, FileText, LocateFixed, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canonicalNeighborhoodName, curitibaNeighborhoods } from '../contexts/NeighborhoodContext';
import { supabase } from '../utils/supabase';
import { resolveCuritibaLocation } from '../utils/locationResolver';
import { Card, Modal } from '../components/UI';
import MapPicker from '../components/MapPicker';
import type { EmploymentType, JobFormData, WorkModel, JobApplicationStatus } from '../types/jobs';

const employmentOptions: Array<[EmploymentType, string]> = [
  ['clt', 'CLT'], ['pj', 'PJ'], ['estagio', 'Estágio'], ['aprendiz', 'Aprendiz'],
  ['temporario', 'Temporário'], ['freelancer', 'Freelancer'],
];
const modelOptions: Array<[WorkModel, string]> = [
  ['presencial', 'Presencial'], ['hibrido', 'Híbrido'], ['remoto', 'Remoto'],
];
const applicantStatusLabels: Record<JobApplicationStatus, string> = {
  interested: 'Interessado', viewed: 'Visualizado', contacted: 'Contatado', withdrawn: 'Retirado',
};
const emptyForm: JobFormData = {
  title: '', description: '', requirements: '', benefits: '', salaryMin: '', salaryMax: '',
  employmentType: 'clt', workModel: 'presencial', location: '', neighborhood: '', locality: '',
  latitude: undefined, longitude: undefined, contactEmail: '', contactWhatsapp: '',
  contactEmailEnabled: true, contactWhatsappEnabled: false, expiresAt: '',
};

function toForm(job: any): JobFormData {
  return {
    title: job.title || '', description: job.description || '', requirements: job.requirements || '',
    benefits: job.benefits || '', salaryMin: job.salary_min == null ? '' : String(job.salary_min),
    salaryMax: job.salary_max == null ? '' : String(job.salary_max), employmentType: job.employment_type || 'clt',
    workModel: job.work_model || 'presencial', location: job.location || '', neighborhood: job.neighborhood || '',
    locality: job.locality || '', latitude: job.latitude == null ? undefined : Number(job.latitude),
    longitude: job.longitude == null ? undefined : Number(job.longitude),
    contactEmail: job.contact_email || '', contactWhatsapp: job.contact_whatsapp || '',
    contactEmailEnabled: Boolean(job.contact_email_enabled), contactWhatsappEnabled: Boolean(job.contact_whatsapp_enabled),
    expiresAt: job.expires_at || '',
  };
}

export default function CompanyDashboard() {
  const { user, logout } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [resumesByUser, setResumesByUser] = useState<Record<string, any>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locatingJob, setLocatingJob] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [companyResult, jobsResult] = await Promise.all([
      supabase.from('company_profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('job_posts').select('*').eq('company_id', user.id).order('created_at', { ascending: false }),
    ]);
    if (companyResult.error) setMessage({ type: 'error', text: companyResult.error.message });
    else if (jobsResult.error) setMessage({ type: 'error', text: jobsResult.error.message });
    setCompany(companyResult.data);
    const loadedJobs = jobsResult.data || [];
    setJobs(loadedJobs);

    if (loadedJobs.length > 0) {
      const jobIds = loadedJobs.map((job) => job.id);
      const applicationsResult = await supabase
        .from('job_applications').select('*').in('job_id', jobIds).neq('status', 'withdrawn').order('created_at', { ascending: false });
      if (!applicationsResult.error) {
        const loadedApplications = applicationsResult.data || [];
        setApplications(loadedApplications);
        const applicantIds = [...new Set(loadedApplications.map((application: any) => application.user_id))];
        if (applicantIds.length > 0) {
          const resumesResult = await supabase.from('user_resumes').select('*, users(name, avatar_url)').in('user_id', applicantIds);
          if (!resumesResult.error) {
            const resumeMap: Record<string, any> = {};
            for (const resume of resumesResult.data || []) resumeMap[resume.user_id] = resume;
            setResumesByUser(resumeMap);
          } else setResumesByUser({});
        } else setResumesByUser({});
      } else {
        setApplications([]);
        setResumesByUser({});
      }
    } else {
      setApplications([]);
      setResumesByUser({});
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const activeJobs = useMemo(() => jobs.filter((job) => job.is_active).length, [jobs]);
  const applicationCountByJob = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const application of applications) counts[application.job_id] = (counts[application.job_id] || 0) + 1;
    return counts;
  }, [applications]);
  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId), [jobs, selectedJobId]);
  const selectedApplications = useMemo(() => applications.filter((application) => application.job_id === selectedJobId), [applications, selectedJobId]);

  const openNew = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      contactEmail: company?.email || user?.email || '',
      location: company?.address || '',
      neighborhood: canonicalNeighborhoodName(company?.neighborhood) || '',
    });
    setMessage(null);
    setShowForm(true);
  };

  const saveProfile = async () => {
    if (!user || !company) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('company_profiles').update({
      company_name: company.company_name,
      description: company.description || null,
      email: company.email || user.email,
      phone: company.phone || null,
      whatsapp: company.whatsapp || null,
      website: company.website || null,
      address: company.address || null,
      neighborhood: canonicalNeighborhoodName(company.neighborhood) || company.neighborhood || null,
    }).eq('id', user.id);
    setMessage(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Perfil da empresa salvo.' });
    setSaving(false);
    if (!error) void load();
  };

  const resolveAndApplyPoint = async (latitude: number, longitude: number, fillAddress = false) => {
    const snapshot = form;
    setForm((prev) => ({ ...prev, latitude, longitude }));
    const resolved = await resolveCuritibaLocation({
      location: snapshot.location,
      neighborhood: snapshot.neighborhood,
      latitude,
      longitude,
    });
    setForm((prev) => ({
      ...prev,
      latitude: resolved.latitude ?? latitude,
      longitude: resolved.longitude ?? longitude,
      neighborhood: resolved.neighborhood || prev.neighborhood,
      locality: resolved.locality || '',
      location: fillAddress && !prev.location.trim() && resolved.displayAddress ? resolved.displayAddress : prev.location,
    }));
  };

  const useCurrentJobLocation = () => {
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Este navegador não oferece localização por GPS.' });
      return;
    }
    setLocatingJob(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void resolveAndApplyPoint(position.coords.latitude, position.coords.longitude, true)
          .then(() => setMessage({ type: 'success', text: 'Localização capturada. Confira o ponto no mapa antes de publicar.' }))
          .finally(() => setLocatingJob(false));
      },
      () => {
        setLocatingJob(false);
        setMessage({ type: 'error', text: 'Não foi possível acessar sua localização. Autorize o GPS ou marque o ponto no mapa.' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  const saveJob = async () => {
    if (!user) return;
    const title = form.title.trim();
    const description = form.description.trim();
    if (title.length < 2) return setMessage({ type: 'error', text: 'Informe o título da oportunidade.' });
    if (description.length < 10) return setMessage({ type: 'error', text: 'A descrição precisa ter pelo menos 10 caracteres.' });
    if (form.salaryMin && form.salaryMax && Number(form.salaryMin) > Number(form.salaryMax)) return setMessage({ type: 'error', text: 'O salário mínimo não pode ser maior que o máximo.' });
    if (!form.contactEmailEnabled && !form.contactWhatsappEnabled) return setMessage({ type: 'error', text: 'Escolha pelo menos uma forma de contato.' });
    if (form.contactEmailEnabled && !form.contactEmail.trim()) return setMessage({ type: 'error', text: 'Informe o e-mail de contato.' });
    if (form.contactWhatsappEnabled && form.contactWhatsapp.replace(/\D/g, '').length < 10) return setMessage({ type: 'error', text: 'Informe um WhatsApp válido.' });
    if (form.workModel !== 'remoto' && !form.location.trim() && (form.latitude == null || form.longitude == null)) {
      return setMessage({ type: 'error', text: 'Informe o endereço, use sua localização ou marque o ponto da vaga no mapa.' });
    }

    setSaving(true);
    setMessage(null);
    const resolved = await resolveCuritibaLocation({
      location: form.location,
      neighborhood: form.neighborhood,
      latitude: form.latitude,
      longitude: form.longitude,
    });

    const payload = {
      company_id: user.id,
      title,
      description,
      requirements: form.requirements.trim() || null,
      benefits: form.benefits.trim() || null,
      salary_min: form.salaryMin ? Number(form.salaryMin) : null,
      salary_max: form.salaryMax ? Number(form.salaryMax) : null,
      employment_type: form.employmentType,
      work_model: form.workModel,
      location: form.location.trim() || null,
      neighborhood: resolved.neighborhood || canonicalNeighborhoodName(form.neighborhood) || null,
      locality: resolved.locality || form.locality || null,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      location_precision: resolved.precision,
      contact_email: form.contactEmailEnabled ? form.contactEmail.trim() : null,
      contact_whatsapp: form.contactWhatsappEnabled ? form.contactWhatsapp.replace(/\D/g, '') : null,
      contact_email_enabled: form.contactEmailEnabled,
      contact_whatsapp_enabled: form.contactWhatsappEnabled,
      expires_at: form.expiresAt || null,
      is_active: true,
    };

    const result = editingId
      ? await supabase.from('job_posts').update(payload).eq('id', editingId).eq('company_id', user.id)
      : await supabase.from('job_posts').insert(payload);

    if (result.error) setMessage({ type: 'error', text: result.error.message });
    else {
      const area = [resolved.locality, resolved.neighborhood].filter(Boolean).join(' · ');
      const locationNote = resolved.precision === 'neighborhood'
        ? ` Localização aproximada${area ? ` em ${area}` : ''}. Informe uma rua/número ou marque o mapa para maior precisão.`
        : resolved.latitude != null
          ? ` Localização confirmada${area ? ` em ${area}` : ''}.`
          : '';
      setMessage({ type: 'success', text: `${editingId ? 'Oportunidade atualizada.' : 'Oportunidade publicada com sucesso.'}${locationNote}` });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      void load();
    }
    setSaving(false);
  };

  const editJob = (job: any) => {
    setEditingId(job.id);
    setForm(toForm(job));
    setMessage(null);
    setShowForm(true);
  };

  const toggleJob = async (job: any) => {
    const { error } = await supabase.from('job_posts').update({ is_active: !job.is_active }).eq('id', job.id).eq('company_id', user?.id);
    if (error) setMessage({ type: 'error', text: error.message });
    else { setMessage({ type: 'success', text: job.is_active ? 'Oportunidade pausada.' : 'Oportunidade ativada.' }); void load(); }
  };

  const deleteJob = async (job: any) => {
    if (!window.confirm(`Excluir a oportunidade "${job.title}"?`)) return;
    const { error } = await supabase.from('job_posts').delete().eq('id', job.id).eq('company_id', user?.id);
    if (error) setMessage({ type: 'error', text: error.message });
    else { setMessage({ type: 'success', text: 'Oportunidade excluída.' }); void load(); }
  };

  const updateApplicantStatus = async (applicationId: string, status: JobApplicationStatus) => {
    const { data, error } = await supabase.from('job_applications').update({ status }).eq('id', applicationId).select('*').single();
    if (error || !data) {
      setMessage({ type: 'error', text: 'Não foi possível atualizar o candidato.' });
      return;
    }
    setApplications((prev) => prev.map((application) => application.id === applicationId ? data : application));
    setMessage({ type: 'success', text: status === 'contacted' ? 'Candidato marcado como contatado.' : 'Status do candidato atualizado.' });
  };

  if (loading) return <Card><div className="py-16 text-center text-slate-500">Carregando área da empresa...</div></Card>;
  if (!user || !company) return <Card><div className="py-16 text-center"><Building2 className="mx-auto w-10 h-10 text-emerald-600" /><h1 className="font-bold mt-3 text-slate-900 dark:text-white">Perfil empresarial não encontrado</h1><p className="text-sm text-slate-500 mt-1">Entre com uma conta empresarial confirmada.</p></div></Card>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white"><Building2 className="text-emerald-600" />{company.company_name}</h1><p className="text-sm text-slate-500">{activeJobs} oportunidade{activeJobs === 1 ? '' : 's'} ativa{activeJobs === 1 ? '' : 's'} · {applications.length} interessado{applications.length === 1 ? '' : 's'}</p></div>
      <div className="flex gap-2"><button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold"><Plus className="w-4 h-4" />Publicar oportunidade</button><button onClick={logout} className="px-3 py-2 rounded-xl text-sm text-slate-500">Sair</button></div>
    </div>

    {message && <div className={message.type === 'error' ? 'p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm' : 'p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm'}>{message.text}</div>}

    <Card><div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h2 className="font-bold text-slate-900 dark:text-white">Suas oportunidades</h2><p className="text-sm text-slate-500">Publique vagas e acompanhe quem demonstrou interesse.</p></div><button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold"><Plus className="w-4 h-4" />Nova oportunidade</button></div>
      {jobs.length === 0 ? <div className="py-10 text-center"><p className="font-semibold text-slate-900 dark:text-white">Nenhuma oportunidade publicada.</p><button onClick={openNew} className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold">Publicar agora</button></div> : <div className="space-y-3">{jobs.map((job) => { const interestedCount = applicationCountByJob[job.id] || 0; const area = [job.locality, job.neighborhood].filter(Boolean).join(' · '); return <div key={job.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700"><div className="flex justify-between gap-3"><div><h3 className="font-bold text-slate-900 dark:text-white">{job.title}</h3><p className="text-xs text-slate-500 mt-1">{area || 'Sem bairro identificado'} · {modelOptions.find((item) => item[0] === job.work_model)?.[1] || job.work_model} · {employmentOptions.find((item) => item[0] === job.employment_type)?.[1] || job.employment_type}</p>{job.latitude != null && <p className="text-[11px] text-slate-400 mt-1 inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location_precision === 'neighborhood' ? 'Posição aproximada pelo bairro' : 'Posição confirmada no mapa'}</p>}</div><span className={job.is_active ? 'text-xs font-bold text-emerald-700 dark:text-emerald-300' : 'text-xs font-bold text-slate-500'}>{job.is_active ? 'Ativa' : 'Pausada'}</span></div><div className="flex gap-2 mt-4 flex-wrap">{interestedCount > 0 && <button onClick={() => setSelectedJobId(job.id)} className="px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-800 dark:text-orange-300 text-sm font-semibold inline-flex gap-2 items-center border border-orange-200 dark:border-orange-500/20"><Users className="w-4 h-4" />Interessados ({interestedCount})</button>}<button onClick={() => editJob(job)} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold inline-flex gap-2 items-center"><Pencil className="w-4 h-4" />Editar</button><button onClick={() => toggleJob(job)} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold inline-flex gap-2 items-center"><Power className="w-4 h-4" />{job.is_active ? 'Pausar' : 'Ativar'}</button><button onClick={() => deleteJob(job)} className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold inline-flex gap-2 items-center"><Trash2 className="w-4 h-4" />Excluir</button></div></div>; })}</div>}
    </Card>

    <Card><h2 className="font-bold mb-4 text-slate-900 dark:text-white">Perfil da empresa</h2><div className="grid sm:grid-cols-2 gap-3">
      {([['company_name','Nome da empresa'],['email','E-mail'],['phone','Telefone'],['whatsapp','WhatsApp'],['website','Site'],['address','Endereço']] as const).map(([key, label]) => <input key={key} value={company[key] || ''} onChange={(event) => setCompany({ ...company, [key]: event.target.value })} placeholder={label} className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />)}
      <select value={canonicalNeighborhoodName(company.neighborhood) || ''} onChange={(event) => setCompany({ ...company, neighborhood: event.target.value })} className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white"><option value="">Bairro da empresa</option>{curitibaNeighborhoods.map((item) => <option key={item.name} value={item.name}>{item.name}{item.kind === 'locality' ? ` (${item.parentNeighborhood})` : ''}</option>)}</select>
      <textarea value={company.description || ''} onChange={(event) => setCompany({ ...company, description: event.target.value })} placeholder="Descrição da empresa" rows={4} className="sm:col-span-2 px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />
    </div><button onClick={saveProfile} disabled={saving} className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold inline-flex gap-2 items-center"><Save className="w-4 h-4" />Salvar perfil</button></Card>

    {showForm && <div className="fixed inset-0 z-[120] bg-black/60 p-4 overflow-y-auto"><div className="max-w-3xl mx-auto my-8 bg-white dark:bg-slate-900 rounded-2xl p-6"><div className="flex justify-between items-center mb-5"><div><h2 className="text-xl font-bold text-slate-900 dark:text-white">{editingId ? 'Editar oportunidade' : 'Publicar oportunidade'}</h2><p className="text-sm text-slate-500">Use endereço, GPS ou marque o ponto. O bairro será validado pela coordenada antes de salvar.</p></div><button onClick={() => setShowForm(false)} className="p-2 rounded-lg text-slate-500"><X /></button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título da oportunidade" className="sm:col-span-2 px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição da oportunidade" rows={5} className="sm:col-span-2 px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />
        <textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} placeholder="Requisitos" rows={4} className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />
        <textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} placeholder="Benefícios" rows={4} className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />
        <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as EmploymentType })} className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white"><option value="clt">CLT</option><option value="pj">PJ</option><option value="estagio">Estágio</option><option value="aprendiz">Aprendiz</option><option value="temporario">Temporário</option><option value="freelancer">Freelancer</option></select>
        <select value={form.workModel} onChange={(e) => setForm({ ...form, workModel: e.target.value as WorkModel })} className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white"><option value="presencial">Presencial</option><option value="hibrido">Híbrido</option><option value="remoto">Remoto</option></select>
        <input value={form.salaryMin} onChange={(e) => setForm({ ...form, salaryMin: e.target.value.replace(/\D/g, '') })} placeholder="Salário mínimo" className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />
        <input value={form.salaryMax} onChange={(e) => setForm({ ...form, salaryMax: e.target.value.replace(/\D/g, '') })} placeholder="Salário máximo" className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />
        <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value, latitude: undefined, longitude: undefined })} placeholder="Rua e número (ex.: Rua XV de Novembro, 100)" className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />
        <select value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white"><option value="">Bairro (apoio para localização)</option>{curitibaNeighborhoods.map((item) => <option key={item.name} value={item.name}>{item.name}{item.kind === 'locality' ? ` (${item.parentNeighborhood})` : ''}</option>)}</select>
        <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 p-3"><div className="flex-1"><p className="text-sm font-bold text-slate-900 dark:text-white">Localização da vaga</p><p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{form.locality || form.neighborhood ? `Identificada: ${[form.locality, form.neighborhood].filter(Boolean).join(' · ')}` : form.latitude != null ? 'Ponto definido; o bairro será validado ao salvar.' : 'Use o GPS ou marque exatamente no mapa.'}</p></div><button type="button" onClick={useCurrentJobLocation} disabled={locatingJob} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60">{locatingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}{locatingJob ? 'Localizando...' : 'Usar minha localização'}</button></div>
        <div className="sm:col-span-2"><MapPicker address={form.location} initialLat={form.latitude} initialLng={form.longitude} onLocationSelect={(lat, lng) => { void resolveAndApplyPoint(lat, lng); }} className="h-72 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 z-0" /></div>
        <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
        <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="E-mail para contato" className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />
        <input value={form.contactWhatsapp} onChange={(e) => setForm({ ...form, contactWhatsapp: e.target.value })} placeholder="WhatsApp" className="px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />
      </div>
      <div className="mt-4 space-y-2 text-slate-700 dark:text-slate-200"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.contactEmailEnabled} onChange={(e) => setForm({ ...form, contactEmailEnabled: e.target.checked })} />Permitir contato por e-mail</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.contactWhatsappEnabled} onChange={(e) => setForm({ ...form, contactWhatsappEnabled: e.target.checked })} />Permitir contato por WhatsApp</label></div>
      <div className="mt-6 flex justify-end gap-2"><button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200">Cancelar</button><button onClick={() => void saveJob()} disabled={saving || locatingJob} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-60">{saving ? 'Salvando e validando bairro...' : editingId ? 'Salvar alterações' : 'Publicar oportunidade'}</button></div>
    </div></div>}

    <Modal open={Boolean(selectedJobId)} onClose={() => setSelectedJobId(null)} title={`Interessados${selectedJob ? ` — ${selectedJob.title}` : ''}`}>
      <div className="space-y-3">
        {selectedApplications.length === 0 ? <div className="py-8 text-center"><Users className="w-10 h-10 text-slate-300 mx-auto" /><p className="font-bold text-slate-900 dark:text-white mt-3">Nenhum interessado nesta vaga.</p></div> : selectedApplications.map((application) => {
          const resume = resumesByUser[application.user_id];
          const person = resume?.users;
          return <div key={application.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-500/10 overflow-hidden flex items-center justify-center shrink-0">{person?.avatar_url ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-orange-700 dark:text-orange-300" />}</div>
              <div className="min-w-0 flex-1"><p className="font-bold text-slate-900 dark:text-white">{person?.name || 'Candidato'}</p>{resume?.neighborhood && <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{resume.neighborhood}</p>}</div>
              <select value={application.status} onChange={(e) => void updateApplicantStatus(application.id, e.target.value as JobApplicationStatus)} className="min-h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-semibold"><option value="interested">Interessado</option><option value="viewed">Visualizado</option><option value="contacted">Contatado</option></select>
            </div>
            {resume ? <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">{resume.email && <a href={`mailto:${resume.email}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><Mail className="w-4 h-4" />{resume.email}</a>}{resume.phone && <a href={`tel:${resume.phone.replace(/\D/g, '')}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><Phone className="w-4 h-4" />{resume.phone}</a>}</div>
              {resume.objective && <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Objetivo</p><p className="text-sm text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-line">{resume.objective}</p></div>}
              {resume.experience && <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Experiência</p><p className="text-sm text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-line">{resume.experience}</p></div>}
              <div className="grid sm:grid-cols-2 gap-3">{resume.education && <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Formação</p><p className="text-sm text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-line">{resume.education}</p></div>}{resume.skills && <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Habilidades</p><p className="text-sm text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-line">{resume.skills}</p></div>}</div>
            </div> : <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-500 flex items-center gap-2"><FileText className="w-4 h-4" />Currículo indisponível.</div>}
            <p className="mt-4 text-[11px] text-slate-400">Status: {applicantStatusLabels[application.status as JobApplicationStatus]}</p>
          </div>;
        })}
      </div>
    </Modal>
  </div>;
}
