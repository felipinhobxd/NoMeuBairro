import { Clock3, Database, ExternalLink, Eye, LockKeyhole, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { Card } from '../components/UI';

const retentionRows = [
  {
    data: 'Conta e perfil',
    period: 'Enquanto a conta estiver ativa. A exclusão pode ser solicitada pelo Perfil e passa por revisão administrativa para evitar fraude ou remoção indevida.',
  },
  {
    data: 'Relatos, comentários e eventos',
    period: 'Enquanto o conteúdo estiver publicado. O autor pode excluir o que a interface permitir; conteúdo também pode ser removido pela moderação ou no tratamento de uma solicitação de conta.',
  },
  {
    data: 'Currículo e candidaturas',
    period: 'Enquanto forem mantidos pela pessoa. O currículo pode ser atualizado; uma candidatura pode ser retirada, e ambos entram na análise quando houver solicitação de exclusão da conta.',
  },
  {
    data: 'Denúncias e decisões de moderação',
    period: 'Pelo período necessário para segurança, prevenção de abuso e auditoria das decisões. O acesso é restrito a quem possui permissão de moderação.',
  },
  {
    data: 'Monitoramento técnico',
    period: 'Amostras agregadas de erros e lentidão por até 45 dias; incidentes resolvidos por até 180 dias. Registros de erro do sistema anterior permanecem por até 90 dias. A manutenção remove automaticamente os registros vencidos.',
  },
  {
    data: 'Métricas agregadas',
    period: 'Mantidas como contagens por página e dia, sem e-mail, ID de conta, IP ou identificador do dispositivo.',
  },
];

const sections = [
  {
    icon: UserRound,
    title: 'Quais dados podem ser usados',
    text: 'Para a plataforma funcionar, podemos tratar dados da sua conta (como nome, e-mail e foto), conteúdo que você publica, comentários, apoios, presença em eventos, denúncias, informações de currículo/candidatura e dados de empresa ou vaga quando você optar por preencher essas áreas.',
  },
  {
    icon: MapPin,
    title: 'Localização e bairro',
    text: 'Relatos, eventos e vagas podem guardar o bairro, endereço ou coordenadas que forem informados no cadastro daquele conteúdo. A função “Perto de mim” do mapa usa a localização do navegador somente enquanto você utiliza a tela e não grava essa posição no nosso banco.',
  },
  {
    icon: Eye,
    title: 'Métricas de uso',
    text: 'Registramos apenas contagens agregadas por página e por dia para entender quais áreas são mais usadas. Essa tabela de métricas não armazena IP, e-mail, ID do usuário ou identificador do dispositivo.',
  },
  {
    icon: ShieldCheck,
    title: 'Segurança, moderação e erros',
    text: 'Denúncias e decisões de moderação são mantidas para proteger a comunidade. O monitoramento técnico registra códigos fixos de erro, páginas genéricas sem identificadores, versão/arquivo do aplicativo, tipo de tela, duração e código HTTP. A coleta não envia texto digitado, fotos, senhas, tokens, IP ou referência da conta. Detalhes ficam restritos à administração; avisos públicos no GitHub informam somente o estado do serviço. Registros históricos da coleta anterior podem conter a referência da conta até expirarem.',
  },
  {
    icon: Database,
    title: 'Serviços que ajudam o site a funcionar',
    text: 'A plataforma utiliza serviços como Supabase (banco, autenticação e arquivos), Vercel (hospedagem), OpenStreetMap (mapa), VLibras (acessibilidade) e hCaptcha quando aplicável. Esses serviços podem receber os dados técnicos necessários para atender a requisição, de acordo com suas próprias políticas.',
  },
  {
    icon: LockKeyhole,
    title: 'Controle e segurança dos seus dados',
    text: 'Conteúdo publicado para a comunidade pode ser visível publicamente. Informações privadas de conta e dados administrativos não são expostos como conteúdo público. Você pode corrigir informações disponíveis no Perfil e solicitar a remoção de dados quando isso for aplicável, respeitando registros que precisem ser preservados por segurança, prevenção de abuso ou obrigações legais.',
  },
];

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <div className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-widest mb-2"><ShieldCheck className="w-4 h-4" /> Transparência</div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Política de Privacidade</h1>
        <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">Esta página explica, em linguagem simples, quais informações o No Meu Bairro usa e por quê. Última atualização: 31 de agosto de 2026.</p>
      </div>

      <Card className="!p-5 sm:!p-6 bg-emerald-50/50 dark:bg-emerald-500/5 !border-emerald-100 dark:!border-emerald-500/15">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Resumo rápido</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Coletamos somente o necessário para operar a comunidade, autenticar contas, exibir o conteúdo enviado, moderar abusos, corrigir falhas e entender o uso geral do produto. Não vendemos os dados da plataforma e as métricas internas foram desenhadas para funcionar sem identificar quem visitou cada página.</p>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {sections.map(({ icon: Icon, title, text }) => (
          <Card key={title} className="!p-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4"><Icon className="w-5 h-5 text-emerald-700 dark:text-emerald-400" /></div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
          </Card>
        ))}
      </div>

      <Card className="!p-5 sm:!p-6">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Armazenamento no seu navegador</h2>
        <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">O site usa armazenamento local e de sessão para lembrar escolhas úteis, como tema, tamanho da fonte, bairro selecionado, conclusão do guia inicial e qual conteúdo deve receber foco após uma navegação. O aplicativo instalado também usa um cache técnico limitado para abrir a interface de forma mais confiável. Imagens exibidas pelo próprio site só são reutilizadas como suporte offline por até 7 dias, com limite de 48 arquivos; dados de consultas do Supabase, mapas e serviços externos não entram nesse cache de imagens.</p>
      </Card>

      <Card className="!p-5 sm:!p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"><Clock3 className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Prazos e critérios de retenção</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">O prazo depende da finalidade e do controle disponível para cada tipo de informação.</p>
          </div>
        </div>
        <dl className="mt-5 divide-y divide-slate-200 dark:divide-slate-800">
          {retentionRows.map((row) => (
            <div key={row.data} className="grid gap-1 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-5">
              <dt className="text-sm font-extrabold text-slate-900 dark:text-white">{row.data}</dt>
              <dd className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">{row.period}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="!p-5 sm:!p-6">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Responsável e canais para solicitações</h2>
        <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">A administração do projeto No Meu Bairro é responsável pelas decisões sobre o tratamento de dados dentro da plataforma. Para baixar seus dados ou pedir a exclusão da conta, use os controles disponíveis no Perfil. Se você não conseguir acessar a conta ou precisar relatar algo confidencial, utilize o canal privado de segurança do projeto. Não publique documentos ou dados pessoais em uma issue pública do GitHub.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a href="#/perfil" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-emerald-800">Abrir controles no Perfil</a>
          <a href="https://github.com/felipinhobxd/NoMeuBairro/security/advisories/new" target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 py-3 text-sm font-extrabold text-slate-800 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Canal privado de segurança <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
        </div>
      </Card>

      <Card className="!p-5 sm:!p-6">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Seus direitos e alterações desta política</h2>
        <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">Você pode confirmar a existência de tratamento, acessar ou corrigir dados editáveis, baixar uma cópia em JSON e solicitar exclusão quando aplicável. Algumas informações podem precisar ser preservadas temporariamente por segurança, prevenção de abuso, auditoria ou obrigação legal; nesses casos, a justificativa deve acompanhar a análise. Esta política pode ser atualizada quando o funcionamento da plataforma mudar, e a data no início da página indicará a versão mais recente.</p>
      </Card>
    </div>
  );
}
