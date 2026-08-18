import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase, Search, MapPin, Mail, MessageCircle, Building2, Rocket, ArrowRight,
  SlidersHorizontal, X, FileText, ClipboardList, CheckCircle2, UserRoundCheck,
  Pencil, Loader2, Undo2, LocateFixed, Bookmark,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, EmptyState, Modal } from '../components/UI';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { neighborhoodSearchText, normalizeNeighborhoodText } from '../contexts/NeighborhoodContext';
import { useSavedItems } from '../hooks/useSavedItems';
import { cn } from '../utils/cn';
import type {
  JobPost, EmploymentType, WorkModel, UserResume, JobApplication, JobApplicationStatus,
} from '../types/jobs';

const labels: Record<EmploymentType | WorkModel, string> = {
  clt: 'CLT', pj: 'PJ', estagio: 'Estágio', aprendiz: 'Aprendiz', temporario: 'Temporário', freelancer: 'Freelancer',
  presencial: 'Presencial', hibrido: 'Híbrido', remoto: 'Remoto',
};

const applicationLabels: Record<JobApplicationStatus, string> = {
  interested: 'Interesse enviado',
  viewed: 'Currículo visualizado',
  contacted: 'Empresa entrou em contato',
  withdrawn: 'Interesse retirado',
};

const JOB_SELECT = 'id,company_id,company_name,company_logo_url,title,description,requirements,benefits,salary_min,salary_max,employment_type,work_model,location,neighborhood,locality,latitude,longitude,location_precision,contact_email,contact_whatsapp,contact_email_enabled,contact_whatsapp_enabled,is_active,expires_at,created_at,updated_at';
const RESUME_SELECT = 'user_id,email,phone,neighborhood,objective,experience,education,skills,created_at,updated_at';
const APPLICATION_SELECT = 'id,job_id,user_id,status,created_at,updated_at';
const JOB_CACHE_TTL = 60_000;
let jobsCache: { fetchedAt: number; jobs: JobPost[] } | null = null;
let jobsRequest: Promise<{ jobs: JobPost[]; error: any }> | null = null;

const mapJob = (r: any): JobPost => ({
  id: r.id,
  companyId: r.company_id,
  companyName: r.company_name || 'Empresa',
  companyLogoUrl: r.company_logo_url,
  title: r.title || 'Oportunidade',
  description: r.description || '',
  requirements: r.requirements || undefined,
  benefits: r.benefits || undefined,
  salaryMin: r.salary_min == null ? undefined : Number(r.salary_min),
  salaryMax: r.salary_max == null ? undefined : Number(r.salary_max),
  employmentType: r.employment_type,
  workModel: r.work_model,
  location: r.location || undefined,
  neighborhood: r.neighborhood || undefined,
  locality: r.locality || undefined,
  latitude: r.latitude == null ? undefined : Number(r.latitude),
  longitude: r.longitude == null ? undefined : Number(r.longitude),
  locationPrecision: r.location_precision || undefined,
  contactEmail: r.contact_email || undefined,
  contactWhatsapp: r.contact_whatsapp || undefined,
  contactEmailEnabled: Boolean(r.contact_email_enabled),
  contactWhatsappEnabled: Boolean(r.contact_whatsapp_enabled),
  isActive: Boolean(r.is_active),
  expiresAt: r.expires_at || undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapResume = (r: any): UserResume => ({
  userId: r.user_id,
  email: r.email || undefined,
  phone: r.phone || undefined,
  neighborhood: r.neighborhood || undefined,
  objective: r.objective || undefined,
  experience: r.experience || undefined,
  education: r.education || undefined,
  skills: r.skills || undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapApplication = (r: any): JobApplication => ({
  id: r.id,
  jobId: r.job_id,
  userId: r.user_id,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

async function fetchActiveJobs() {
  if (jobsCache && Date.now() - jobsCache.fetchedAt < JOB_CACHE_TTL) return { jobs: jobsCache.jobs, error: null };
  if (jobsRequest) return jobsRequest;

  jobsRequest = (async () => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('public_job_posts')
      .select(JOB_SELECT)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gte.${now}`)
      .order('created_at', { ascending: false })
      .limit(100);
    const jobs = error ? [] : (data || []).map(mapJob);
    if (!error) jobsCache = { fetchedAt: Date.now(), jobs };
    return { jobs, error };
  })();

  try { return await jobsRequest; }
  finally { jobsRequest = null; }
}

type UserPoint = { lat: number; lng: number };

function distanceKm(a: UserPoint, b: UserPoint) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function Empregos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSaved: isJobSaved, toggleSaved: toggleSavedJob } = useSavedItems('job');
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentType | 'all'>('all');
  const [workModelFilter, setWorkModelFilter] = useState<WorkModel | 'all'>('all');
  const [nearMe, setNearMe] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<UserPoint | null>(null);
  const [resume, setResume] = useState<UserResume | null>(null);
  const [resumeDraft, setResumeDraft] = useState({ email: '', phone: '', neighborhood: '', objective: '', experience: '', education: '', skills: '' });
  const [resumeOpen, setResumeOpen] = useState(false);
  const [applicationsOpen, setApplicationsOpen] = useState(false);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [savingResume, setSavingResume] = useState(false);
  const [actionJobId, setActionJobId] = useState<string | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);

  const isCompany = user?.accountType === 'company';
  const isResident = user?.accountType === 'resident';
  const openCompanyProfile = (companyId: string) => navigate(`/empresa/${companyId}`);

  const resumeIsComplete = (value: UserResume | null) => Boolean(
    value && (value.email || value.phone) && (value.objective || value.experience || value.education || value.skills),
  );

  const fillResumeDraft = (value?: UserResume | null) => {
    setResumeDraft({
      email: value?.email || user?.email || '',
      phone: value?.phone || '',
      neighborhood: value?.neighborhood || '',
      objective: value?.objective || '',
      experience: value?.experience || '',
      education: value?.education || '',
      skills: value?.skills || '',
    });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const jobsPromise = fetchActiveJobs();

      if (isResident && user) {
        const [jobsResult, resumeResult, applicationsResult] = await Promise.all([
          jobsPromise,
          supabase.from('user_resumes').select(RESUME_SELECT).eq('user_id', user.id).maybeSingle(),
          supabase.from('job_applications').select(APPLICATION_SELECT).eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        ]);
        if (!active) return;
        if (jobsResult.error) {
          setJobs([]);
          setError('Não foi possível carregar as oportunidades agora. Tente novamente em alguns instantes.');
        } else setJobs(jobsResult.jobs);
        if (!resumeResult.error && resumeResult.data) {
          const mapped = mapResume(resumeResult.data);
          setResume(mapped);
          fillResumeDraft(mapped);
        } else {
          setResume(null);
          fillResumeDraft(null);
        }
        if (!applicationsResult.error) setApplications((applicationsResult.data || []).map(mapApplication));
      } else {
        const jobsResult = await jobsPromise;
        if (!active) return;
        if (jobsResult.error) {
          setJobs([]);
          setError('Não foi possível carregar as oportunidades agora. Tente novamente em alguns instantes.');
        } else setJobs(jobsResult.jobs);
        setResume(null);
        setApplications([]);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user?.id, isResident]);

  useEffect(() => {
    const focusedId = new URLSearchParams(window.location.search).get('vaga');
    if (!focusedId) return;
    try { sessionStorage.setItem('anb-job-focus', focusedId); } catch {}
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', cleanUrl);
  }, []);

  useEffect(() => {
    const focusedId = sessionStorage.getItem('anb-job-focus');
    if (!focusedId || loading) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`job-${focusedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sessionStorage.removeItem('anb-job-focus');
    }, 120);
    return () => window.clearTimeout(timer);
  }, [loading, jobs.length]);

  const filtered = useMemo(() => {
    const q = normalizeNeighborhoodText(query);
    const result = jobs.filter((job) => {
      const searchable = normalizeNeighborhoodText([
        job.title, job.companyName, job.neighborhood || '', job.locality || '', job.location || '',
        neighborhoodSearchText(job.neighborhood), neighborhoodSearchText(job.locality),
      ].join(' '));
      const matchesQuery = !q || searchable.includes(q);
      const matchesEmployment = employmentFilter === 'all' || job.employmentType === employmentFilter;
      const matchesWorkModel = workModelFilter === 'all' || job.workModel === workModelFilter;
      const matchesNearMe = !nearMe || !userLocation || (
        job.latitude != null && job.longitude != null
        && distanceKm(userLocation, { lat: job.latitude, lng: job.longitude }) <= 20
      );
      return matchesQuery && matchesEmployment && matchesWorkModel && matchesNearMe;
    });

    if (nearMe && userLocation) {
      result.sort((a, b) => {
        const da = a.latitude != null && a.longitude != null ? distanceKm(userLocation, { lat: a.latitude, lng: a.longitude }) : Number.POSITIVE_INFINITY;
        const db = b.latitude != null && b.longitude != null ? distanceKm(userLocation, { lat: b.latitude, lng: b.longitude }) : Number.POSITIVE_INFINITY;
        return da - db;
      });
    }
    return result;
  }, [jobs, query, employmentFilter, workModelFilter, nearMe, userLocation]);

  const applicationByJob = useMemo(() => new Map(applications.map((app) => [app.jobId, app])), [applications]);
  const activeApplications = useMemo(() => applications.filter((app) => app.status !== 'withdrawn'), [applications]);
  const activeFilters = employmentFilter !== 'all' || workModelFilter !== 'all' || nearMe;
  const clearFilters = () => { setEmploymentFilter('all'); setWorkModelFilter('all'); setNearMe(false); };

  const toggleNearMe = () => {
    if (nearMe) {
      setNearMe(false);
      return;
    }
    if (!navigator.geolocation) {
      setNotice({ type: 'error', text: 'Seu navegador não oferece localização por GPS.' });
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setNearMe(true);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setNotice({ type: 'error', text: 'Não foi possível acessar sua localização. Verifique a permissão do navegador.' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const openResume = (jobId?: string) => {
    fillResumeDraft(resume);
    setPendingJobId(jobId || null);
    setNotice(null);
    setResumeOpen(true);
  };

  const saveInterest = async (jobId: string) => {
    if (!user || !isResident) return;
    setActionJobId(jobId);
    setNotice(null);
    const existing = applicationByJob.get(jobId);
    const result = existing
      ? await supabase.from('job_applications').update({ status: 'interested' }).eq('id', existing.id).eq('user_id', user.id).select(APPLICATION_SELECT).single()
      : await supabase.from('job_applications').insert({ job_id: jobId, user_id: user.id, status: 'interested' }).select(APPLICATION_SELECT).single();

    if (result.error || !result.data) {
      setNotice({ type: 'error', text: 'Não foi possível registrar seu interesse. Tente novamente.' });
    } else {
      const mapped = mapApplication(result.data);
      setApplications((prev) => {
        const found = prev.some((app) => app.id === mapped.id);
        return found ? prev.map((app) => app.id === mapped.id ? mapped : app) : [mapped, ...prev];
      });
      setNotice({ type: 'success', text: 'Interesse enviado! A empresa já pode visualizar seu currículo.' });
    }
    setActionJobId(null);
  };

  const handleInterest = async (jobId: string) => {
    if (!user) { navigate('/login'); return; }
    if (!isResident) return;
    if (!resumeIsComplete(resume)) { openResume(jobId); return; }
    await saveInterest(jobId);
  };

  const withdrawInterest = async (application: JobApplication) => {
    if (!user) return;
    setActionJobId(application.jobId);
    const { data, error: updateError } = await supabase
      .from('job_applications').update({ status: 'withdrawn' }).eq('id', application.id).eq('user_id', user.id).select(APPLICATION_SELECT).single();
    if (updateError || !data) setNotice({ type: 'error', text: 'Não foi possível retirar o interesse.' });
    else {
      const mapped = mapApplication(data);
      setApplications((prev) => prev.map((app) => app.id === mapped.id ? mapped : app));
      setNotice({ type: 'success', text: 'Interesse retirado desta vaga.' });
    }
    setActionJobId(null);
  };

  const saveResume = async () => {
    if (!user || !isResident) return;
    if (!resumeDraft.email.trim() && !resumeDraft.phone.trim()) {
      setNotice({ type: 'error', text: 'Informe pelo menos um e-mail ou telefone no currículo.' });
      return;
    }
    if (![resumeDraft.objective, resumeDraft.experience, resumeDraft.education, resumeDraft.skills].some((item) => item.trim())) {
      setNotice({ type: 'error', text: 'Preencha ao menos objetivo, experiência, formação ou habilidades.' });
      return;
    }
    setSavingResume(true);
    setNotice(null);
    const payload = {
      user_id: user.id,
      email: resumeDraft.email.trim() || null,
      phone: resumeDraft.phone.trim() || null,
      neighborhood: resumeDraft.neighborhood.trim() || null,
      objective: resumeDraft.objective.trim() || null,
      experience: resumeDraft.experience.trim() || null,
      education: resumeDraft.education.trim() || null,
      skills: resumeDraft.skills.trim() || null,
    };
    const { data, error: resumeError } = await supabase.from('user_resumes').upsert(payload, { onConflict: 'user_id' }).select(RESUME_SELECT).single();

    if (resumeError || !data) {
      setNotice({ type: 'error', text: 'Não foi possível salvar seu currículo.' });
      setSavingResume(false);
      return;
    }

    const mapped = mapResume(data);
    setResume(mapped);
    const jobToApply = pendingJobId;
    setPendingJobId(null);
    setResumeOpen(false);
    setNotice({ type: 'success', text: 'Currículo salvo com sucesso.' });
    setSavingResume(false);
    if (jobToApply) await saveInterest(jobToApply);
  };

  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-6 px-0 sm:px-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0"><Briefcase className="w-5 h-5 text-emerald-600" /></span><span>Empregos</span></h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Encontre oportunidades por bairro ou até 20 km da sua localização.</p>
        </div>
        {isCompany && <button onClick={() => navigate('/empresa')} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700 active:scale-[0.99] min-h-11"><Rocket className="w-4 h-4" /> Publicar oportunidade <ArrowRight className="w-4 h-4" /></button>}
      </div>

      {notice && <div className={notice.type === 'success' ? 'p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-sm font-medium' : 'p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm font-medium'}>{notice.text}</div>}

      {isResident && user && (
        <Card className="!p-4 sm:!p-5 border-orange-200/80 dark:border-orange-500/20 bg-orange-50/40 dark:bg-orange-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><UserRoundCheck className="w-5 h-5 text-emerald-600" /><p className="font-bold text-slate-900 dark:text-white">Sua área de candidatura</p></div><p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Mantenha seu currículo atualizado e acompanhe as vagas em que demonstrou interesse.</p></div><div className="grid grid-cols-2 gap-2 sm:flex shrink-0"><button onClick={() => openResume()} className="min-h-11 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm">{resumeIsComplete(resume) ? <Pencil className="w-4 h-4" /> : <FileText className="w-4 h-4" />}{resumeIsComplete(resume) ? 'Editar currículo' : 'Criar currículo'}</button><button onClick={() => setApplicationsOpen(true)} className="min-h-11 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 dark:bg-orange-600 text-white font-semibold text-sm"><ClipboardList className="w-4 h-4" /> Candidaturas <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{activeApplications.length}</span></button></div></div>
        </Card>
      )}

      {!user && <Card className="!p-4 sm:!p-5"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><p className="font-bold text-slate-900 dark:text-white">Quer demonstrar interesse em uma vaga?</p><p className="text-sm text-slate-500 mt-1">Entre na sua conta para criar um currículo e acompanhar suas candidaturas.</p></div><button onClick={() => navigate('/login')} className="min-h-11 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold shrink-0">Entrar na conta</button></div></Card>}

      <div className="sticky top-[72px] sm:static z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 sm:py-0 bg-slate-50/95 dark:bg-slate-950/95 sm:bg-transparent sm:dark:bg-transparent backdrop-blur-md sm:backdrop-blur-0">
        <div className="flex gap-2">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar vaga, empresa, bairro ou CIC..." className="w-full min-h-11 pl-10 pr-12 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500" /><button type="button" onClick={() => setFiltersOpen(true)} className="absolute right-2 top-1/2 -translate-y-1/2 min-w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center" aria-label="Abrir filtros"><SlidersHorizontal className="w-4 h-4" /></button></div>
          <button type="button" onClick={toggleNearMe} disabled={locating} aria-pressed={nearMe} className={nearMe ? 'min-h-11 shrink-0 inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-3.5 font-bold text-sm' : 'min-h-11 shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3.5 font-bold text-sm'}>{locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}<span className="hidden sm:inline">{nearMe ? 'Perto de mim ativo' : 'Perto de mim'}</span></button>
        </div>
        <div className="flex items-center justify-between gap-3 mt-2"><p className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'vaga' : 'vagas'}{nearMe ? ' em até 20 km' : ''}</p>{activeFilters && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-emerald-600">Limpar filtros</button>}</div>
      </div>

      {activeFilters && <div className="hidden sm:flex flex-wrap items-center gap-2">{nearMe && <button onClick={() => setNearMe(false)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-semibold"><LocateFixed className="w-3 h-3" />Perto de mim <X className="w-3 h-3" /></button>}{employmentFilter !== 'all' && <button onClick={() => setEmploymentFilter('all')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">{labels[employmentFilter]} <X className="w-3 h-3" /></button>}{workModelFilter !== 'all' && <button onClick={() => setWorkModelFilter('all')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">{labels[workModelFilter]} <X className="w-3 h-3" /></button>}<button onClick={clearFilters} className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Limpar filtros</button></div>}

      {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm">{error}</div>}
      {isCompany && <Card className="!p-4 sm:!p-5 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-slate-900 dark:text-white">Você está conectado como empresa.</p><p className="text-sm text-slate-500 mt-1">Publique oportunidades com endereço, GPS ou ponto exato no mapa.</p></div><button onClick={() => navigate('/empresa')} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-emerald-200 dark:ring-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm font-semibold min-h-11"><Building2 className="w-4 h-4" /> Área da empresa</button></div></Card>}

      {loading ? <div className="py-16 text-center text-slate-400">Carregando vagas...</div> : filtered.length === 0 ? <Card><EmptyState icon={Briefcase} title="Nenhuma vaga encontrada" description={nearMe ? 'Não encontramos vagas com localização confirmada em até 20 km de você.' : 'As vagas publicadas por empresas aparecerão aqui.'} /></Card> : (
        <div className="grid gap-3 sm:gap-4">
          {filtered.map((job) => {
            const application = applicationByJob.get(job.id);
            const activeApplication = application && application.status !== 'withdrawn' ? application : null;
            const area = [job.locality, job.neighborhood].filter(Boolean).join(' · ');
            const distance = userLocation && job.latitude != null && job.longitude != null ? distanceKm(userLocation, { lat: job.latitude, lng: job.longitude }) : null;
            return <Card key={job.id} id={`job-${job.id}`} className="relative !p-4 sm:!p-6 scroll-mt-28">
              <button type="button" onClick={() => void toggleSavedJob(job.id)} className={cn('absolute top-4 right-4 sm:top-5 sm:right-5 z-10 w-10 h-10 rounded-xl flex items-center justify-center ring-1 transition-all', isJobSaved(job.id) ? 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20' : 'bg-white/95 dark:bg-slate-900/95 text-slate-400 ring-slate-200 dark:ring-slate-700 hover:text-orange-600')} aria-label={isJobSaved(job.id) ? 'Remover vaga dos salvos' : 'Salvar vaga'} aria-pressed={isJobSaved(job.id)}><Bookmark className={cn('w-4.5 h-4.5', isJobSaved(job.id) && 'fill-current')} /></button>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pr-11 sm:pr-12">
                <div className="flex items-start gap-3 min-w-0">
                  <button type="button" onClick={() => openCompanyProfile(job.companyId)} aria-label={`Ver perfil de ${job.companyName}`} className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-transparent hover:ring-orange-300 dark:hover:ring-orange-500/40 transition-all">
                    {job.companyLogoUrl ? <img src={job.companyLogoUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /> : <Building2 className="w-6 h-6 text-emerald-600" />}
                  </button>
                  <div className="min-w-0 sm:hidden">
                    <h2 className="font-bold text-base text-slate-900 dark:text-white leading-snug break-words">{job.title}</h2>
                    <button type="button" onClick={() => openCompanyProfile(job.companyId)} className="text-left text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 break-words hover:underline underline-offset-2">{job.companyName}</button>
                    <p className="text-[10px] text-slate-400 mt-0.5">Ver perfil da empresa</p>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="hidden sm:block">
                    <h2 className="font-bold text-lg text-slate-900 dark:text-white leading-snug break-words">{job.title}</h2>
                    <button type="button" onClick={() => openCompanyProfile(job.companyId)} className="text-left text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 break-words hover:underline underline-offset-2">{job.companyName}</button>
                    <span className="ml-2 text-[10px] font-semibold text-slate-400">Ver perfil</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 text-xs text-slate-600 dark:text-slate-300">{area && <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-800 dark:text-orange-300 px-2.5 py-1 font-semibold"><MapPin className="w-3 h-3 shrink-0" />{area}</span>}{nearMe && distance != null && <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2.5 py-1 font-semibold">{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</span>}{job.employmentType && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1">{labels[job.employmentType]}</span>}{job.workModel && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1">{labels[job.workModel]}</span>}{typeof job.salaryMin === 'number' && <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 font-semibold">R$ {job.salaryMin.toLocaleString('pt-BR')}{typeof job.salaryMax === 'number' ? ` – ${job.salaryMax.toLocaleString('pt-BR')}` : ''}</span>}</div>
                  {job.location && <p className="mt-2 text-xs text-slate-500 inline-flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />{job.location}{job.locationPrecision === 'neighborhood' ? ' · posição aproximada' : job.latitude != null ? ' · localização confirmada' : ''}</p>}
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 sm:mt-4 whitespace-pre-line break-words">{job.description}</p>
                  {job.requirements && <div className="mt-4"><h3 className="text-xs font-bold text-slate-900 dark:text-white">Requisitos</h3><p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-line mt-1 break-words">{job.requirements}</p></div>}
                  {job.benefits && <div className="mt-4"><h3 className="text-xs font-bold text-slate-900 dark:text-white">Benefícios</h3><p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-line mt-1 break-words">{job.benefits}</p></div>}

                  {!isCompany && <div className="mt-4 sm:mt-5 rounded-xl border border-orange-200/80 dark:border-orange-500/20 bg-orange-50/40 dark:bg-orange-500/5 p-3.5 sm:p-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="min-w-0">{activeApplication ? <><p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{applicationLabels[activeApplication.status]}</p><p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Seu currículo está disponível para esta empresa.</p></> : <><p className="font-bold text-slate-900 dark:text-white">Gostou da oportunidade?</p><p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Ao marcar interesse, a empresa poderá visualizar o currículo que você cadastrou.</p></>}</div><div className="flex gap-2 shrink-0">{activeApplication ? <button onClick={() => void withdrawInterest(activeApplication)} disabled={actionJobId === job.id} className="min-h-11 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm disabled:opacity-60">{actionJobId === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}Retirar interesse</button> : <button onClick={() => void handleInterest(job.id)} disabled={actionJobId === job.id} className="min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-60">{actionJobId === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserRoundCheck className="w-4 h-4" />}Tenho interesse</button>}</div></div></div>}

                  {(job.contactEmailEnabled && job.contactEmail) || (job.contactWhatsappEnabled && job.contactWhatsapp) ? <div className="mt-4 sm:mt-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5 sm:p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Contato da empresa</p><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">{job.contactEmailEnabled && job.contactEmail && <div className="flex items-start gap-3 min-w-0"><div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"><Mail className="w-4 h-4 text-slate-600 dark:text-slate-300" /></div><div className="min-w-0"><p className="text-xs text-slate-500">E-mail</p><p className="font-semibold text-slate-900 dark:text-white break-all text-sm sm:text-base leading-snug">{job.contactEmail}</p></div></div>}{job.contactWhatsappEnabled && job.contactWhatsapp && <a target="_blank" rel="noreferrer" href={`https://wa.me/${job.contactWhatsapp}`} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shrink-0 min-h-11"><MessageCircle className="w-4 h-4" /> WhatsApp</a>}</div></div> : null}
                </div>
              </div>
            </Card>;
          })}
        </div>
      )}

      <Modal open={resumeOpen} onClose={() => { setResumeOpen(false); setPendingJobId(null); }} title="Meu currículo">
        <div className="space-y-4"><div className="rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-3"><p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</p><p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Somente empresas de vagas em que você demonstrar interesse poderão visualizar este currículo.</p></div><div className="grid sm:grid-cols-2 gap-3"><label className="space-y-1.5"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">E-mail</span><input type="email" value={resumeDraft.email} onChange={(e) => setResumeDraft({ ...resumeDraft, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="seu@email.com" /></label><label className="space-y-1.5"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Telefone / WhatsApp</span><input value={resumeDraft.phone} onChange={(e) => setResumeDraft({ ...resumeDraft, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="(41) 99999-9999" /></label><label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Bairro</span><input value={resumeDraft.neighborhood} onChange={(e) => setResumeDraft({ ...resumeDraft, neighborhood: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="Ex.: Água Verde" /></label><label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Objetivo profissional</span><textarea rows={3} value={resumeDraft.objective} onChange={(e) => setResumeDraft({ ...resumeDraft, objective: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="Conte que tipo de oportunidade procura..." /></label><label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Experiência</span><textarea rows={4} value={resumeDraft.experience} onChange={(e) => setResumeDraft({ ...resumeDraft, experience: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="Empresas, funções, atividades ou experiências relevantes..." /></label><label className="space-y-1.5"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Formação</span><textarea rows={4} value={resumeDraft.education} onChange={(e) => setResumeDraft({ ...resumeDraft, education: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="Escolaridade, cursos..." /></label><label className="space-y-1.5"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Habilidades</span><textarea rows={4} value={resumeDraft.skills} onChange={(e) => setResumeDraft({ ...resumeDraft, skills: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="Ex.: atendimento, Excel, vendas..." /></label></div><button onClick={() => void saveResume()} disabled={savingResume} className="w-full min-h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">{savingResume ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}{pendingJobId ? 'Salvar currículo e enviar interesse' : 'Salvar currículo'}</button></div>
      </Modal>

      <Modal open={applicationsOpen} onClose={() => setApplicationsOpen(false)} title="Minhas candidaturas">
        <div className="space-y-3">{applications.length === 0 ? <div className="py-8 text-center"><ClipboardList className="w-10 h-10 mx-auto text-slate-300" /><p className="font-bold text-slate-900 dark:text-white mt-3">Nenhuma candidatura ainda</p><p className="text-sm text-slate-500 mt-1">Use “Tenho interesse” em uma vaga para começar.</p></div> : applications.map((application) => { const job = jobById.get(application.jobId); return <div key={application.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-slate-900 dark:text-white">{job?.title || 'Vaga'}</p>{job ? <button type="button" onClick={() => { setApplicationsOpen(false); openCompanyProfile(job.companyId); }} className="text-left text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5 hover:underline underline-offset-2">{job.companyName}</button> : <p className="text-sm text-slate-500 mt-0.5">Empresa</p>}</div><span className={application.status === 'contacted' ? 'text-xs font-bold rounded-full px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : application.status === 'withdrawn' ? 'text-xs font-bold rounded-full px-2.5 py-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'text-xs font-bold rounded-full px-2.5 py-1 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'}>{applicationLabels[application.status]}</span></div>{job?.neighborhood && <p className="text-xs text-slate-500 mt-2 inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{[job.locality, job.neighborhood].filter(Boolean).join(' · ')}</p>}{application.status !== 'withdrawn' && <button onClick={() => void withdrawInterest(application)} className="mt-3 text-xs font-semibold text-slate-500 hover:text-red-600 inline-flex items-center gap-1.5"><Undo2 className="w-3.5 h-3.5" />Retirar interesse</button>}</div>; })}</div>
      </Modal>

      {filtersOpen && <div className="fixed inset-0 z-[80] bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setFiltersOpen(false)}><div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between gap-3 mb-5"><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Filtrar vagas</h2><p className="text-xs text-slate-500 mt-1">Escolha os filtros que deseja aplicar.</p></div><button onClick={() => setFiltersOpen(false)} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button></div><div className="space-y-4"><label className="block"><span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">Tipo de contratação</span><select value={employmentFilter} onChange={(e) => setEmploymentFilter(e.target.value as EmploymentType | 'all')} className="w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-white"><option value="all">Todos</option><option value="clt">CLT</option><option value="pj">PJ</option><option value="estagio">Estágio</option><option value="aprendiz">Aprendiz</option><option value="temporario">Temporário</option><option value="freelancer">Freelancer</option></select></label><label className="block"><span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">Modelo de trabalho</span><select value={workModelFilter} onChange={(e) => setWorkModelFilter(e.target.value as WorkModel | 'all')} className="w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-white"><option value="all">Todos</option><option value="presencial">Presencial</option><option value="hibrido">Híbrido</option><option value="remoto">Remoto</option></select></label></div><div className="grid grid-cols-2 gap-2 mt-6"><button onClick={clearFilters} className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold">Limpar</button><button onClick={() => setFiltersOpen(false)} className="min-h-11 rounded-xl bg-emerald-600 text-white font-semibold">Aplicar</button></div></div></div>}
    </div>
  );
}
