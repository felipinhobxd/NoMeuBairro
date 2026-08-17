# 🏘️ No Meu Bairro

Plataforma comunitária criada para aproximar moradores de Curitiba, dar visibilidade a problemas locais e concentrar, em um só lugar, relatos, eventos, oportunidades de emprego, dados do bairro e canais de denúncia.

<p align="center">
  <a href="https://no-meu-bairro.vercel.app/">
    <strong>🌐 Acessar o No Meu Bairro</strong>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/STATUS-ONLINE-16a34a?style=for-the-badge" alt="Status online" />
  <img src="https://img.shields.io/badge/DEPLOY-VERCEL-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Deploy na Vercel" />
  <img src="https://img.shields.io/badge/BACKEND-SUPABASE-1C1C1C?style=for-the-badge&logo=supabase&logoColor=3ECF8E" alt="Backend Supabase" />
</p>

> O projeto continua em evolução, mas já possui fluxo completo de uso, moderação, acessibilidade, experiência responsiva e versão publicada.

---

## ✨ O que é o projeto

O **No Meu Bairro** funciona como uma central comunitária para Curitiba. A ideia é facilitar a comunicação entre moradores e tornar informações locais mais fáceis de encontrar e visualizar.

A plataforma foi pensada para funcionar bem tanto no computador quanto no celular, com navegação adaptativa, onboarding interativo, modo claro/escuro e suporte à instalação como aplicativo.

---

## 🌟 Principais funcionalidades

### 📝 Feed comunitário

- Publicação de relatos com título, descrição, imagem, categoria e localização.
- Status de acompanhamento como **Pendente**, **Em andamento** e **Resolvido**.
- Apoios, comentários e respostas em múltiplos níveis.
- Botão rápido `+` para criar um novo relato.
- Filtro por bairro e localidades de Curitiba.
- Denúncia de conteúdo inadequado diretamente nos itens da comunidade.

### 🗺️ Mapa comunitário

- Visualização conjunta de **relatos, eventos e oportunidades de emprego**.
- Marcadores e agrupamentos numéricos conforme o nível de zoom.
- **Mapa de calor permanente**, calculado pela densidade dos pontos exibidos.
- Heatmap baseado em distribuição Gaussiana, com escala geográfica adaptada ao zoom.
- Agrupamento por distância real no mapa, evitando divisões artificiais por células visuais.
- Zoom animado e atualização dos agrupamentos ao navegar pelo mapa.
- Localizações aproximadas recebem peso menor que coordenadas exatas no cálculo de densidade.
- Acesso direto do Mural ao ponto correspondente no mapa.

### 📊 Dados da comunidade

- Indicadores e estatísticas agregadas no banco.
- Visão dos assuntos e categorias mais frequentes.
- Dados calculados além do que está carregado visualmente no Feed.

### 💼 Empregos

- Publicação e busca de vagas.
- Perfis públicos de empresas.
- Currículo privado do candidato.
- Candidaturas e acompanhamento de interações.
- Localização das oportunidades e integração com o mapa.

### 🗓️ Mural

- Eventos, campanhas, reuniões, feiras, esportes e outras atividades comunitárias.
- Endereço informado no próprio card.
- Registro de presença/interesse.
- Integração com o mapa através de **Ver no mapa**.
- Possibilidade de denunciar conteúdo do Mural.

### 🚨 Denúncias sérias

A área de **Denúncias** é um canal separado para situações sensíveis ou graves, como violência, abuso, assédio, exploração, fraude e outros casos que exigem atenção especial.

Ela não funciona como uma simples lista de reclamações do Feed e foi desenhada com maior cuidado de privacidade.

### 👤 Perfis e notificações

- Perfil público de moradores.
- Área de atividade da própria conta.
- Histórico de relatos, comentários, apoios, eventos e outras interações.
- Notificações para atividades importantes da plataforma.

### 🔎 Busca global

A busca global permite encontrar rapidamente:

- relatos;
- bairros;
- eventos;
- vagas de emprego.

No computador também pode ser aberta com **Ctrl/Cmd + K**.

---

## 🛡️ Administração e moderação

Contas com permissão de administrador possuem uma área exclusiva, protegida pelas regras do Supabase.

O painel inclui:

- **Pendentes:** fila de conteúdos denunciados aguardando decisão;
- **Histórico:** registro das decisões anteriores;
- filtros por ação, tipo de conteúdo, moderador e período;
- identificação de quem moderou e quando;
- opção de **manter** ou **excluir** o conteúdo denunciado;
- **Uso:** analytics agregados por área do site;
- **Erros:** monitoramento de erros importantes do frontend.

As permissões críticas não dependem apenas da interface: funções e políticas do banco validam o acesso administrativo.

---

## 🔐 Segurança e prevenção de abuso

O projeto possui proteções adicionais no banco e no frontend, incluindo:

- Row Level Security (RLS) no Supabase;
- funções/RPCs com permissões controladas;
- limitação contra flood de posts, comentários e denúncias;
- bloqueio de denúncias pendentes duplicadas pelo mesmo usuário;
- moderação com trilha de histórico;
- armazenamento privado quando necessário;
- páginas públicas de **Privacidade** e **Termos de uso**;
- hCaptcha em fluxos compatíveis com autenticação/proteção contra abuso.

---

## ♿ Acessibilidade

O No Meu Bairro inclui recursos voltados à acessibilidade e facilidade de uso:

- **VLibras oficial**, com tradução de conteúdo para Libras;
- modo claro e modo escuro;
- navegação por teclado e estados de foco visíveis;
- áreas de toque maiores em telas pequenas;
- textos e controles adaptados a diferentes tamanhos de tela;
- tour interativo que ensina a usar a própria interface.

---

## 🧭 Onboarding adaptativo

O guia inicial não é apenas uma sequência de textos: ele destaca os controles reais do site e pede para a pessoa clicar ou tocar neles.

### Desktop

O tour utiliza a navegação superior e apresenta Feed, publicação, Mapa, Dados, Empregos, Mural, Denúncias, Perfil e, quando aplicável, Admin.

### Celular e tablet

A experiência acompanha a interface mobile real:

- Feed;
- botão `+` para publicar;
- Mapa;
- Empregos;
- Mural;
- menu **Mais**;
- Dados;
- Denúncias;
- Perfil;
- Admin, somente para administradores.

O guia pode ser aberto novamente pelo link **Como funciona**.

---

## 📱 Experiência responsiva e PWA

A navegação muda de acordo com o espaço disponível.

### Celular e tablet

A barra inferior mantém apenas os atalhos mais usados:

**Feed · Mapa · Empregos · Mural · Mais**

O menu **Mais** concentra as opções secundárias para evitar botões espremidos, incluindo Dados, Denúncias, Perfil, Admin, busca, instalação, tema e sair da conta.

### Desktop

A navegação completa fica disponível no cabeçalho, com adaptação automática para notebooks menores.

### Instalação como aplicativo

O projeto possui suporte a **PWA**:

- manifest próprio;
- service worker;
- ícones para instalação;
- atalho **Instalar aplicativo**;
- instruções específicas quando o navegador não oferece instalação automática.

---

## ⚡ Performance

Algumas decisões adotadas para manter o projeto fluido:

- rotas carregadas com `React.lazy` e `Suspense`;
- recuperação automática em falhas de chunks após novos deploys;
- consultas direcionadas ao Supabase;
- agregações feitas no banco quando apropriado;
- notificações com atualização em tempo real;
- imagens armazenadas no Supabase Storage em vez de dentro do banco;
- mapa de calor renderizado em canvas com resolução adaptativa;
- cache de kernels Gaussianos e buffers reutilizados no heatmap;
- agrupamento espacial otimizado de marcadores;
- interface adaptativa para celular, tablet, notebook e desktop;
- PWA com estratégia de atualização voltada a evitar versões antigas presas em cache.

---

## 🧰 Tecnologias

### Frontend

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=react-router&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199903?style=for-the-badge&logo=leaflet&logoColor=white)

Principais tecnologias atuais:

- React 19
- TypeScript
- Vite 7
- Tailwind CSS 4
- React Router
- Leaflet + React Leaflet
- Lucide Icons
- Capacitor

### Backend e infraestrutura

![Supabase](https://img.shields.io/badge/Supabase-1C1C1C?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

- Supabase Auth
- PostgreSQL
- Row Level Security
- Supabase Realtime
- Supabase Storage
- RPCs, triggers e migrations
- Vercel

---

## 🚀 Como rodar localmente

### Pré-requisitos

- Node.js instalado;
- npm;
- projeto Supabase configurado.

### 1. Clone o repositório

```bash
git clone https://github.com/felipinhobxd/NoMeuBairro.git
cd NoMeuBairro
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_publicavel_do_supabase
```

> Nunca envie chaves privadas/service role para o frontend ou para o GitHub.

### 4. Inicie o ambiente de desenvolvimento

```bash
npm run dev
```

### 5. Gere uma build de produção

```bash
npm run build
```

### 6. Visualize a build localmente

```bash
npm run preview
```

---

## 🗄️ Banco de dados

O projeto de produção utiliza mais do que um schema inicial. A estrutura inclui migrations, policies, triggers, funções/RPCs e regras específicas de moderação e segurança.

Ao criar outro ambiente, utilize as migrations versionadas do projeto e configure corretamente Auth, Storage e RLS no Supabase.

---

## 🌐 Deploy

A versão pública é hospedada na Vercel:

**https://no-meu-bairro.vercel.app/**

O fluxo de CI executa uma verificação de build no GitHub Actions e o projeto é publicado pela integração com a Vercel.

---

## 👨‍💻 Autores

**Felipe, Gustavo, Jonathan, Sophia e Maria**

Projeto desenvolvido no contexto do **2°DS**, com foco educacional e impacto comunitário.

---

## 📄 Licença

Projeto para fins educacionais e comunitários.
