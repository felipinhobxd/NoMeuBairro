import { Database, Eye, LockKeyhole, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { Card } from '../components/UI';

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
    text: 'Denúncias e decisões de moderação são mantidas para proteger a comunidade. Quando ocorre uma falha técnica no navegador, podemos registrar a página, mensagem do erro, informações técnicas do navegador e, se houver sessão iniciada, a referência da conta. Esses registros ficam restritos à administração e são mantidos por até 90 dias.',
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
        <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">Esta página explica, em linguagem simples, quais informações o No Meu Bairro usa e por quê. Última atualização: 17 de agosto de 2026.</p>
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
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">O site usa armazenamento local e de sessão para lembrar escolhas úteis, como tema, tamanho da fonte, bairro selecionado, conclusão do guia inicial e qual conteúdo deve receber foco após uma navegação. O aplicativo instalado também usa um cache técnico limitado para abrir a interface de forma mais confiável; dados do Supabase, mapas e serviços externos não são colocados nesse cache pelo nosso service worker.</p>
      </Card>

      <Card className="!p-5 sm:!p-6">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Seus direitos e alterações desta política</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Você pode atualizar dados editáveis pelo próprio Perfil. Para pedidos que não estejam disponíveis pela interface, utilize os canais disponibilizados pelo projeto. Esta política pode ser atualizada quando o funcionamento da plataforma mudar; a data no início da página indicará a versão mais recente.</p>
      </Card>
    </div>
  );
}
