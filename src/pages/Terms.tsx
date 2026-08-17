import { Briefcase, MapPin, MessageSquare, Scale, ShieldAlert, UserRound } from 'lucide-react';
import { Card } from '../components/UI';

const rules = [
  {
    icon: MessageSquare,
    title: 'Participação responsável',
    text: 'Publique informações de boa-fé e relacionadas à comunidade. Não é permitido usar o serviço para assédio, ameaças, discriminação, spam, golpes, conteúdo ilegal, denúncias sabidamente falsas ou exposição indevida de dados pessoais de terceiros.',
  },
  {
    icon: ShieldAlert,
    title: 'Denúncias e moderação',
    text: 'Conteúdos podem ser denunciados e analisados pela equipe administrativa. A moderação pode manter ou remover publicações, comentários e eventos quando houver violação das regras, risco à comunidade ou uso abusivo da plataforma.',
  },
  {
    icon: UserRound,
    title: 'Conta e segurança',
    text: 'Você é responsável por manter o acesso à sua conta seguro e por não compartilhar credenciais. A plataforma pode aplicar limites temporários ou outras proteções quando detectar volume incompatível com uso normal, automação abusiva ou tentativa de contornar controles de segurança.',
  },
  {
    icon: MapPin,
    title: 'Mapa e informações comunitárias',
    text: 'O mapa e os relatos ajudam a comunidade a visualizar informações, mas não substituem serviços de emergência, órgãos públicos ou fontes oficiais. Localizações podem ser aproximadas e a existência de um relato não significa confirmação do fato ou garantia de atendimento pelo poder público.',
  },
  {
    icon: Briefcase,
    title: 'Vagas e empresas',
    text: 'O No Meu Bairro aproxima candidatos e anunciantes, mas não é empregador nem garante contratação, remuneração ou veracidade absoluta de uma oportunidade. Desconfie de cobranças para participar de processos seletivos e denuncie anúncios suspeitos.',
  },
  {
    icon: Scale,
    title: 'Conteúdo enviado e disponibilidade',
    text: 'Quem publica continua responsável pelo conteúdo enviado e autoriza sua exibição dentro da plataforma enquanto ele permanecer disponível. Podemos ajustar, suspender ou atualizar funcionalidades para manter segurança, estabilidade e qualidade do serviço.',
  },
];

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <div className="inline-flex items-center gap-2 text-orange-700 dark:text-orange-300 text-xs font-black uppercase tracking-widest mb-2"><Scale className="w-4 h-4" /> Regras da comunidade</div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Termos de Uso</h1>
        <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">Ao usar o No Meu Bairro, você concorda em utilizar a plataforma de forma responsável e respeitar estas regras. Última atualização: 17 de agosto de 2026.</p>
      </div>

      <Card className="!p-5 sm:!p-6 bg-orange-50/60 dark:bg-orange-500/5 !border-orange-100 dark:!border-orange-500/15">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Para que existe o No Meu Bairro</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">A proposta é facilitar a participação comunitária em Curitiba: registrar problemas do bairro, trocar informações, descobrir eventos, acompanhar dados locais e aproximar moradores de oportunidades de trabalho. O serviço não deve ser usado para prejudicar outras pessoas ou criar informações enganosas.</p>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {rules.map(({ icon: Icon, title, text }) => (
          <Card key={title} className="!p-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4"><Icon className="w-5 h-5 text-orange-700 dark:text-orange-300" /></div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
          </Card>
        ))}
      </div>

      <Card className="!p-5 sm:!p-6">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Mudanças e continuidade do serviço</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Recursos, regras de segurança e estes termos podem mudar conforme o produto evolui. Mudanças relevantes serão refletidas nesta página. O uso contínuo da plataforma após uma atualização significa que você concorda com a versão vigente dos termos.</p>
      </Card>
    </div>
  );
}
