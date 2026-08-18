import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Briefcase, Building2, Globe2, Mail, MapPin,
  MessageCircle, Phone, Loader2,
} from 'lucide-react';
import { Card } from '../components/UI';
import { supabase } from '../utils/supabase';

type PublicCompany = {
  id: string;
  company_name?: string | null;
  description?: string | null;
  logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  address?: string | null;
  neighborhood?: string | null;
};

type PublicJob = {
  id: string;
  title?: string | null;
  description?: string | null;
  neighborhood?: string | null;
  locality?: string | null;
  employment_type?: string | null;
  work_model?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
};

const employmentLabels: Record<string, string> = {
  clt: 'CLT', pj: 'PJ', estagio: 'Estágio', aprendiz: 'Aprendiz',
  temporario: 'Temporário', freelancer: 'Freelancer',
};

const workModelLabels: Record<string, string> = {
  presencial: 'Presencial', hibrido: 'Híbrido', remoto: 'Remoto',
};

function externalWebsite(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function whatsappHref(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return value;
}

export default function CompanyPublicProfile() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<PublicCompany | null>(null);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!companyId) {
        setError('Empresa inválida.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      const [companyResult, jobsResult] = await Promise.all([
        supabase
          .from('public_company_profiles')
          .select('id,company_name,description,logo_url,email,phone,whatsapp,website,address,neighborhood')
          .eq('id', companyId)
          .maybeSingle(),
        supabase
          .from('public_job_posts')
          .select('id,title,description,neighborhood,locality,employment_type,work_model,salary_min,salary_max')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (!active) return;
      if (companyResult.error || !companyResult.data) {
        setCompany(null);
        setJobs([]);
        setError('Não foi possível encontrar o perfil público desta empresa.');
      } else {
        setCompany(companyResult.data);
        setJobs(jobsResult.error ? [] : (jobsResult.data || []));
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [companyId]);

  const contactItems = useMemo(() => {
    if (!company) return [];
    return [
      company.email ? { icon: Mail, label: 'E-mail', value: company.email, href: `mailto:${company.email}` } : null,
      company.phone ? { icon: Phone, label: 'Telefone', value: formatPhone(company.phone), href: `tel:${company.phone.replace(/\D/g, '')}` } : null,
      company.whatsapp ? { icon: MessageCircle, label: 'WhatsApp', value: formatPhone(company.whatsapp), href: whatsappHref(company.whatsapp) } : null,
      company.website ? { icon: Globe2, label: 'Site', value: company.website, href: externalWebsite(company.website) } : null,
    ].filter(Boolean) as Array<{ icon: typeof Mail; label: string; value: string; href: string }>;
  }, [company]);

  const openJob = (jobId: string) => {
    try { sessionStorage.setItem('anb-job-focus', jobId); } catch {}
    navigate('/empregos');
  };

  if (loading) {
    return <div className="min-h-[55vh] flex items-center justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />Carregando empresa...</div>;
  }

  if (!company || error) {
    return (
      <Card className="max-w-2xl mx-auto !p-8 text-center">
        <Building2 className="w-12 h-12 mx-auto text-slate-300" />
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Empresa não encontrada</h1>
        <p className="mt-2 text-sm text-slate-500">{error || 'Este perfil empresarial não está disponível.'}</p>
        <button onClick={() => navigate('/empregos')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-bold text-white">
          <ArrowLeft className="w-4 h-4" /> Voltar para Empregos
        </button>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
      <button onClick={() => navigate('/empregos')} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-orange-700 dark:hover:text-orange-300">
        <ArrowLeft className="w-4 h-4" /> Voltar para Empregos
      </button>

      <Card className="!p-5 sm:!p-7 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-orange-50 dark:bg-orange-500/10 ring-1 ring-orange-200 dark:ring-orange-500/20 flex items-center justify-center overflow-hidden shrink-0">
            {company.logo_url ? <img src={company.logo_url} alt={`Logo de ${company.company_name || 'empresa'}`} className="w-full h-full object-cover" /> : <Building2 className="w-10 h-10 text-orange-700 dark:text-orange-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700 dark:text-orange-300">Perfil da empresa</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white break-words">{company.company_name || 'Empresa'}</h1>
            {(company.neighborhood || company.address) && (
              <div className="mt-2 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-orange-700" />
                <span>{[company.address, company.neighborhood].filter(Boolean).join(' · ')}</span>
              </div>
            )}
            {company.description ? (
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line">{company.description}</p>
            ) : (
              <p className="mt-4 text-sm text-slate-500">A empresa ainda não adicionou uma descrição ao perfil.</p>
            )}
          </div>
        </div>

        {contactItems.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Informações de contato</h2>
            <div className="mt-3 grid sm:grid-cols-2 gap-2.5">
              {contactItems.map(({ icon: Icon, label, value, href }) => (
                <a key={label} href={href} target={label === 'Site' || label === 'WhatsApp' ? '_blank' : undefined} rel={label === 'Site' || label === 'WhatsApp' ? 'noreferrer' : undefined} className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5 flex items-center gap-3 hover:border-orange-300 dark:hover:border-orange-500/40 transition-colors">
                  <span className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-orange-700 dark:text-orange-300" /></span>
                  <span className="min-w-0"><span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span><span className="block text-sm font-semibold text-slate-900 dark:text-white break-all">{value}</span></span>
                </a>
              ))}
            </div>
          </div>
        )}
      </Card>

      <section aria-labelledby="company-jobs-title">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 id="company-jobs-title" className="text-lg sm:text-xl font-black text-slate-950 dark:text-white flex items-center gap-2"><Briefcase className="w-5 h-5 text-orange-700" />Vagas desta empresa</h2>
            <p className="text-sm text-slate-500 mt-1">{jobs.length} {jobs.length === 1 ? 'oportunidade ativa' : 'oportunidades ativas'}</p>
          </div>
        </div>

        {jobs.length === 0 ? (
          <Card className="!p-7 text-center"><Briefcase className="w-9 h-9 mx-auto text-slate-300" /><p className="mt-3 font-bold text-slate-900 dark:text-white">Nenhuma vaga ativa no momento.</p></Card>
        ) : (
          <div className="grid gap-3">
            {jobs.map((job) => {
              const area = [job.locality, job.neighborhood].filter(Boolean).join(' · ');
              return (
                <Card key={job.id} className="!p-4 sm:!p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-black text-slate-950 dark:text-white break-words">{job.title || 'Oportunidade'}</h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {area && <span className="rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-800 dark:text-orange-300 px-2.5 py-1 font-semibold inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{area}</span>}
                        {job.employment_type && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-200">{employmentLabels[job.employment_type] || job.employment_type}</span>}
                        {job.work_model && <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-200">{workModelLabels[job.work_model] || job.work_model}</span>}
                        {job.salary_min != null && <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-700 dark:text-emerald-300">R$ {Number(job.salary_min).toLocaleString('pt-BR')}{job.salary_max != null ? ` – ${Number(job.salary_max).toLocaleString('pt-BR')}` : ''}</span>}
                      </div>
                      {job.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-line">{job.description}</p>}
                    </div>
                    <button onClick={() => openJob(job.id)} className="min-h-11 shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-700 hover:bg-orange-800 px-4 py-2.5 text-sm font-bold text-white">
                      Ver vaga <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
