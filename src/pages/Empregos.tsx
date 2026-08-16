import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Search, MapPin, Mail, MessageCircle, Building2, Rocket, ArrowRight, SlidersHorizontal, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, EmptyState } from '../components/UI';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { JobPost, EmploymentType, WorkModel } from '../types/jobs';

const labels: Record<EmploymentType | WorkModel, string> = {
  clt: 'CLT', pj: 'PJ', estagio: 'Estágio', aprendiz: 'Aprendiz', temporario: 'Temporário', freelancer: 'Freelancer',
  presencial: 'Presencial', hibrido: 'Híbrido', remoto: 'Remoto',
};

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
  contactEmail: r.contact_email || undefined,
  contactWhatsapp: r.contact_whatsapp || undefined,
  contactEmailEnabled: Boolean(r.contact_email_enabled),
  contactWhatsappEnabled: Boolean(r.contact_whatsapp_enabled),
  isActive: Boolean(r.is_active),
  expiresAt: r.expires_at || undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export default function Empregos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentType | 'all'>('all');
  const [workModelFilter, setWorkModelFilter] = useState<WorkModel | 'all'>('all');
  const isCompany = user?.accountType === 'company';

  useEffect(() => {
    let active = true;
    const loadJobs = async () => {
      setLoading(true);
      setError('');
      const { data, error: queryError } = await supabase
        .from('public_job_posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (!active) return;
      if (queryError) {
        setJobs([]);
        setError('Não foi possível carregar as oportunidades agora. Tente novamente em alguns instantes.');
      } else {
        setJobs((data || []).map(mapJob));
      }
      setLoading(false);
    };
    void loadJobs();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return jobs.filter((job) => {
      const matchesQuery = !q || `${job.title} ${job.companyName} ${job.neighborhood || ''} ${job.location || ''}`.toLowerCase().includes(q);
      const matchesEmployment = employmentFilter === 'all' || job.employmentType === employmentFilter;
      const matchesWorkModel = workModelFilter === 'all' || job.workModel === workModelFilter;
      return matchesQuery && matchesEmployment && matchesWorkModel;
    });
  }, [jobs, query, employmentFilter, workModelFilter]);

  const activeFilters = employmentFilter !== 'all' || workModelFilter !== 'all';
  const clearFilters = () => { setEmploymentFilter('all'); setWorkModelFilter('all'); };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-6 px-0 sm:px-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0"><Briefcase className="w-5 h-5 text-emerald-600" /></span>
            <span>Empregos</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Vagas publicadas por empresas da comunidade.</p>
        </div>
        {isCompany && (
          <button onClick={() => navigate('/empresa')} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700 active:scale-[0.99] min-h-11">
            <Rocket className="w-4 h-4" /> Publicar oportunidade <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="sticky top-[72px] sm:static z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 sm:py-0 bg-slate-50/95 dark:bg-slate-950/95 sm:bg-transparent sm:dark:bg-transparent backdrop-blur-md sm:backdrop-blur-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar vaga, empresa ou bairro..."
            className="w-full min-h-11 pl-10 pr-12 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button type="button" onClick={() => setFiltersOpen(true)} className="absolute right-2 top-1/2 -translate-y-1/2 min-w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center" aria-label="Abrir filtros">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 mt-2 sm:hidden">
          <p className="text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? 'vaga' : 'vagas'}</p>
          {activeFilters && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-emerald-600">Limpar filtros</button>}
        </div>
      </div>

      {activeFilters && (
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {employmentFilter !== 'all' && <button onClick={() => setEmploymentFilter('all')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">{labels[employmentFilter]} <X className="w-3 h-3" /></button>}
          {workModelFilter !== 'all' && <button onClick={() => setWorkModelFilter('all')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">{labels[workModelFilter]} <X className="w-3 h-3" /></button>}
          <button onClick={clearFilters} className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Limpar filtros</button>
        </div>
      )}

      {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm">{error}</div>}

      {isCompany && (
        <Card className="!p-4 sm:!p-5 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white">Você está conectado como empresa.</p>
              <p className="text-sm text-slate-500 mt-1">Publique uma oportunidade para os moradores encontrarem.</p>
            </div>
            <button onClick={() => navigate('/empresa')} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-emerald-200 dark:ring-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm font-semibold min-h-11">
              <Building2 className="w-4 h-4" /> Área da empresa
            </button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-400">Carregando vagas...</div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={Briefcase} title="Nenhuma vaga encontrada" description="As vagas publicadas por empresas aparecerão aqui." /></Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {filtered.map((job) => (
            <Card key={job.id} className="!p-4 sm:!p-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {job.companyLogoUrl ? <img src={job.companyLogoUrl} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-emerald-600" />}
                  </div>
                  <div className="min-w-0 sm:hidden">
                    <h2 className="font-bold text-base text-slate-900 dark:text-white leading-snug break-words">{job.title}</h2>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mt-0.5 break-words">{job.companyName}</p>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="hidden sm:block">
                    <h2 className="font-bold text-lg text-slate-900 dark:text-white leading-snug break-words">{job.title}</h2>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mt-0.5 break-words">{job.companyName}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 text-xs text-slate-600 dark:text-slate-300">
                    {job.neighborhood && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1"><MapPin className="w-3 h-3 shrink-0" />{job.neighborhood}</span>}
                    {job.employmentType && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1">{labels[job.employmentType]}</span>}
                    {job.workModel && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1">{labels[job.workModel]}</span>}
                    {typeof job.salaryMin === 'number' && <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 font-semibold">R$ {job.salaryMin.toLocaleString('pt-BR')}{typeof job.salaryMax === 'number' ? ` – ${job.salaryMax.toLocaleString('pt-BR')}` : ''}</span>}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 sm:mt-4 whitespace-pre-line break-words">{job.description}</p>
                  {job.requirements && <div className="mt-4"><h3 className="text-xs font-bold text-slate-900 dark:text-white">Requisitos</h3><p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-line mt-1 break-words">{job.requirements}</p></div>}
                  {job.benefits && <div className="mt-4"><h3 className="text-xs font-bold text-slate-900 dark:text-white">Benefícios</h3><p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-line mt-1 break-words">{job.benefits}</p></div>}

                  {(job.contactEmailEnabled && job.contactEmail) || (job.contactWhatsappEnabled && job.contactWhatsapp) ? (
                    <div className="mt-4 sm:mt-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5 sm:p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Contato da empresa</p>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        {job.contactEmailEnabled && job.contactEmail && (
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"><Mail className="w-4 h-4 text-slate-600 dark:text-slate-300" /></div>
                            <div className="min-w-0"><p className="text-xs text-slate-500">E-mail</p><p className="font-semibold text-slate-900 dark:text-white break-all text-sm sm:text-base leading-snug">{job.contactEmail}</p></div>
                          </div>
                        )}
                        {job.contactWhatsappEnabled && job.contactWhatsapp && (
                          <a target="_blank" rel="noreferrer" href={`https://wa.me/${job.contactWhatsapp}`} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shrink-0 min-h-11"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filtersOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setFiltersOpen(false)}>
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Filtrar vagas</h2><p className="text-xs text-slate-500 mt-1">Escolha os filtros que deseja aplicar.</p></div>
              <button onClick={() => setFiltersOpen(false)} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <label className="block"><span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">Tipo de contratação</span><select value={employmentFilter} onChange={(e) => setEmploymentFilter(e.target.value as EmploymentType | 'all')} className="w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-white"><option value="all">Todos</option><option value="clt">CLT</option><option value="pj">PJ</option><option value="estagio">Estágio</option><option value="aprendiz">Aprendiz</option><option value="temporario">Temporário</option><option value="freelancer">Freelancer</option></select></label>
              <label className="block"><span className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">Modelo de trabalho</span><select value={workModelFilter} onChange={(e) => setWorkModelFilter(e.target.value as WorkModel | 'all')} className="w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-white"><option value="all">Todos</option><option value="presencial">Presencial</option><option value="hibrido">Híbrido</option><option value="remoto">Remoto</option></select></label>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-6">
              <button onClick={clearFilters} className="min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold">Limpar</button>
              <button onClick={() => setFiltersOpen(false)} className="min-h-11 rounded-xl bg-emerald-600 text-white font-semibold">Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
