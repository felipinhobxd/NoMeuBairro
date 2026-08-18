import type { PostCategory } from '../types';

type PublicServiceContact = {
  authority: string;
  phone: string;
  tel: string;
  purpose: string;
  channelUrl: string;
  channelLabel: string;
  note?: string;
};

const publicServiceContacts: Record<PostCategory, PublicServiceContact> = {
  buraco: {
    authority: 'Central 156 de Curitiba',
    phone: '156',
    tel: '156',
    purpose: 'Buracos e pavimentação de ruas',
    channelUrl: 'https://156.curitiba.pr.gov.br/Servico/Pavimenta%C3%A7%C3%A3o/424/Veja-todos-tipos-servicos-para-atender-cidadao-da-central-156-prefeitura-curitiba',
    channelLabel: 'Abrir serviço no 156',
  },
  iluminacao: {
    authority: 'Central 156 de Curitiba',
    phone: '156',
    tel: '156',
    purpose: 'Lâmpadas, postes e iluminação pública',
    channelUrl: 'https://156.curitiba.pr.gov.br/Servico/Ilumina%C3%A7%C3%A3o-P%C3%BAblica/58/Veja-todos-tipos-servicos-para-atender-cidadao-da-central-156-prefeitura-curitiba',
    channelLabel: 'Abrir serviço no 156',
    note: 'Se possível, anote o número da plaqueta do poste.',
  },
  fios: {
    authority: 'Copel Distribuição',
    phone: '0800 51 00 116',
    tel: '08005100116',
    purpose: 'Falta de energia, postes e fios elétricos',
    channelUrl: 'https://www.copel.com/site/copel-distribuicao/atendimento/',
    channelLabel: 'Abrir canais da Copel',
    note: 'Não toque em fios caídos; mantenha distância do local.',
  },
  saneamento: {
    authority: 'Sanepar',
    phone: '0800 200 0115',
    tel: '08002000115',
    purpose: 'Água, esgoto e vazamentos',
    channelUrl: 'https://www.sanepar.com.br/informe-um-problema',
    channelLabel: 'Informar à Sanepar',
  },
  limpeza: {
    authority: 'Central 156 de Curitiba',
    phone: '156',
    tel: '156',
    purpose: 'Coleta de lixo e limpeza urbana',
    channelUrl: 'https://156.curitiba.pr.gov.br/Servico/Coleta/27/Veja-todos-tipos-servicos-para-atender-cidadao-da-central-156-prefeitura-curitiba',
    channelLabel: 'Abrir serviço no 156',
  },
  transporte: {
    authority: 'URBS / Central 156',
    phone: '156',
    tel: '156',
    purpose: 'Ônibus e transporte coletivo de Curitiba',
    channelUrl: 'https://www.urbs.curitiba.pr.gov.br/portal/fale-conosco/',
    channelLabel: 'Falar com a URBS',
  },
  seguranca: {
    authority: 'Guarda Municipal de Curitiba',
    phone: '153',
    tel: '153',
    purpose: 'Segurança urbana e ocorrências em andamento',
    channelUrl: 'https://www.curitiba.pr.gov.br/noticias/saiba-quando-ligar-para-o-telefone-153-da-guarda-municipal/50965',
    channelLabel: 'Quando ligar para 153',
    note: 'Em emergência policial, ligue 190.',
  },
  outros: {
    authority: 'Central 156 de Curitiba',
    phone: '156',
    tel: '156',
    purpose: 'Outros serviços da Prefeitura de Curitiba',
    channelUrl: 'https://156.curitiba.pr.gov.br/',
    channelLabel: 'Encontrar serviço no 156',
  },
};

export function getPublicServiceContact(category: PostCategory) {
  return publicServiceContacts[category] ?? publicServiceContacts.outros;
}
