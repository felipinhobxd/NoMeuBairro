import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Search, MapPin, Mail, MessageCircle, Building2, Rocket, ArrowRight } from 'lucide-react';
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
  title: r.title,
  description: r.description,
  requirements: r.requirements,
  benefits: r.benefits,
  salaryMin: r.salary_min,
  salaryMax: r.salary_max,
  employmentType: r.employment_type,
  workModel: r.work_model,
  location: r.location,
  neighborhood: r.neighborhood,
  contactEmail: r.contact_email,
  contactWhatsapp: r.contact_whatsapp,
  contactEmailEnabled: r.contact_email_enabled,
  contactWhatsappEnabled: r.contact_whatsapp_enabled,
  isActive: r.is_active,
  expiresAt: r.expires_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export default function Empregos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const isCompany = user?.accountType === 'company';

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('public_job_posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (active) {
        if (!error) setJobs((data || []).map(mapJob));
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return jobs;
    return jobs.filter(j => `${j.title} ${j.companyName} ${j.neighborhood || ''} ${j.location || ''}`.toLowerCase().includes(q));
  }, [jobs, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="text-emerald-600" /> Empregos
          </h1>
          <p className="text-sm text-slate-500 mt-1">Vagas publicadas por empresas da comunidade.</p>
        </div>
        {isCompany && (
          <button onClick={() => navigate('/empresa')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700">
            <Rocket className="w-4 h-4" /> Publicar oportunidade <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar vaga, empresa ou bairro..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {isCompany && (
        <Card className="!p-4 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Você está conectado como empresa.</p>
              <p className="text-sm text-slate-500">Publique uma oportunidade para os moradores encontrarem.</p>
            </div>
            <button onClick={() => navigate('/empresa')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-emerald-200 dark:ring-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
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
        <div className="grid gap-4">
          {filtered.map(job => (
            <Card key={job.id}>
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {job.companyLogoUrl ? <img src={job.companyLogoUrl} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-emerald-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-slate-900 dark:text-white">{job.title}</h2>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{job.companyName}</p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
                    {job.neighborhood && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{job.neighborhood}</span>}
                    <span>{labels[job.employmentType]}</span>
                    <span>{labels[job.workModel]}</span>
                    {typeof job.salaryMin === 'number' && <span>R$ {job.salaryMin.toLocaleString('pt-BR')}{typeof job.salaryMax === 'number' ? ` – ${job.salaryMax.toLocaleString('pt-BR')}` : ''}</span>}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-4 whitespace-pre-line">{job.description}</p>
                  {job.requirements && <div className="mt-4"><h3 className="text-xs font-bold text-slate-900 dark:text-white">Requisitos</h3><p className="text-sm text-slate-500 whitespace-pre-line mt-1">{job.requirements}</p></div>}
                  {job.benefits && <div className="mt-4"><h3 className="text-xs font-bold text-slate-900 dark:text-white">Benefícios</h3><p className="text-sm text-slate-500 whitespace-pre-line mt-1">{job.benefits}</p></div>}
                  <div className="flex flex-wrap gap-2 mt-5">
                    {job.contactEmailEnabled && job.contactEmail && <a href={`mailto:${job.contactEmail}`} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200"><Mail className="w-4 h-4" /> E-mail</a>}
                    {job.contactWhatsappEnabled && job.contactWhatsapp && <a target="_blank" rel="noreferrer" href={`https://wa.me/${job.contactWhatsapp}`} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold"><MessageCircle className="w-4 h-4" /> WhatsApp</a>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
