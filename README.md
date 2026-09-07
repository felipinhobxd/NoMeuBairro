# 🏘️ No Meu Bairro

Plataforma comunitária criada para aproximar moradores de Curitiba, dar visibilidade a problemas locais e reunir, em um só lugar, relatos, eventos, oportunidades de emprego, dados do bairro, notificações e canais de denúncia.

<p align="center">
  <a href="https://nomeubairro.vercel.app/">
    <strong>🌐 Acessar o No Meu Bairro</strong>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/STATUS-ONLINE-16a34a?style=for-the-badge" alt="Status online" />
  <img src="https://img.shields.io/badge/DEPLOY-VERCEL-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Deploy na Vercel" />
  <img src="https://img.shields.io/badge/BACKEND-SUPABASE-1C1C1C?style=for-the-badge&logo=supabase&logoColor=3ECF8E" alt="Backend Supabase" />
</p>

> O projeto está em evolução, mas já possui versão publicada, autenticação, moderação, experiência responsiva, acessibilidade, PWA, monitoramento de produção e backend protegido por políticas do Supabase.

---

## ✨ O que é o projeto

O **No Meu Bairro** funciona como uma central comunitária para Curitiba. A proposta é facilitar a comunicação entre moradores, empresas e comunidade local, além de tornar relatos, eventos, oportunidades e informações do bairro mais fáceis de encontrar e acompanhar.

A aplicação é uma SPA em React + TypeScript, hospedada na Vercel e integrada ao Supabase para autenticação, banco de dados, Storage, Realtime, RPCs, migrations e Edge Functions.

A interface foi pensada para computador e celular, com navegação adaptativa, onboarding interativo, modo claro/escuro, tamanhos de fonte configuráveis e instalação como PWA.

---

## 🌟 Principais funcionalidades

### 📝 Feed comunitário

- Publicação de relatos com título, descrição, imagem, categoria e localização.
- Status de acompanhamento como **Pendente**, **Em andamento** e **Resolvido**.
- Apoios, comentários e respostas em múltiplos níveis.
- Contadores agregados de apoio e comentários no próprio card.
- Botão rápido `+` para criar um novo relato.
- Filtro por bairro e localidades de Curitiba.
- Denúncia de conteúdo inadequado.
- Itens salvos e páginas compartilháveis de relatos.

### 🗺️ Mapa comunitário

- Visualização conjunta de **relatos, eventos e oportunidades de emprego**.
- Marcadores e agrupamentos conforme o nível de zoom.
- Mapa de calor calculado a partir da densidade dos pontos exibidos.
- Agrupamento por distância geográfica.
- Atualização dos agrupamentos durante a navegação pelo mapa.
- Tratamento diferenciado entre localizações exatas e aproximadas.
- Acesso direto de cards para o ponto correspondente no mapa.

### 📊 Dados da comunidade

- Indicadores e estatísticas agregadas no banco.
- Visão dos assuntos, bairros e categorias mais frequentes.
- Agregações independentes do subconjunto de cards carregado visualmente no Feed.

### 💼 Empregos e empresas

- Publicação e busca de vagas.
- Perfis públicos de empresas.
- Área própria para empresas gerenciarem informações e vagas.
- Currículo privado do candidato.
- Fluxo de interesse/candidatura em vagas.
- Área da empresa para acompanhar interessados nas próprias vagas.
- Localização das oportunidades e integração com o mapa.

Dados privados de empresas e candidatos são protegidos no banco; contatos empresariais só podem ser publicados quando houver opt-in explícito.

### 🗓️ Mural

- Eventos, campanhas, reuniões, feiras, esportes e outras atividades comunitárias.
- Endereço e localização vinculados ao item.
- Registro de presença/interesse.
- Integração com o mapa através de **Ver no mapa**.
- Denúncia de conteúdo do Mural.

### 🚨 Denúncias sérias

A área de **Denúncias** é separada dos relatos do Feed e atende situações sensíveis ou graves, como violência, abuso, assédio, exploração, fraude e outros casos que exigem maior cuidado de privacidade.

### 👤 Perfis, salvos e notificações

- Perfil público de moradores.
- Área de atividade da própria conta.
- Histórico de relatos, comentários, apoios, eventos e outras interações.
- Itens salvos.
- Notificações in-app.
- Infraestrutura de Web Push através de Supabase Edge Function quando houver subscription registrada no navegador.

### 🔎 Busca global

A busca global permite encontrar:

- relatos;
- bairros;
- eventos;
- vagas de emprego.

No computador também pode ser aberta com **Ctrl/Cmd + K**.

---

## 🛡️ Administração e moderação

Contas com as permissões apropriadas possuem uma área administrativa protegida pelas regras do Supabase.

O painel inclui:

- **Pendentes:** fila de conteúdos denunciados aguardando decisão;
- **Histórico:** registro das decisões anteriores;
- filtros por ação, tipo de conteúdo, moderador e período;
- identificação de quem moderou e quando;
- opção de **manter** ou **excluir** conteúdo denunciado;
- **Uso:** analytics agregados por área do site;
- **Produção:** erros reais, lentidão de páginas/APIs, incidentes e teste do canal de alertas;
- **Histórico JS:** registros da coleta anterior, preservados até sua expiração.

As permissões críticas não dependem apenas da interface: funções, grants e políticas RLS do banco validam o acesso.

### Monitoramento de produção

O navegador registra erros e medições lentas somente no domínio oficial de produção. O servidor também mede as APIs, e `/api/health` verifica de forma reduzida a disponibilidade do banco e do coletor.

A workflow **Production monitor** executa a cada 15 minutos e depois de builds bem-sucedidos da `main`. Incidentes podem gerar uma issue de acompanhamento no GitHub e são encerrados após a recuperação.

Consulte [docs/MONITORING.md](docs/MONITORING.md) para detalhes de operação, privacidade, limites e recuperação.

---

## 🔐 Segurança e prevenção de abuso

O estado atual do projeto inclui:

- Row Level Security (RLS) nas tabelas públicas;
- grants de browser reduzidos ao necessário;
- funções/RPCs com permissões controladas;
- dados privados de currículos, candidaturas, Push e áreas internas protegidos;
- contatos empresariais privados por padrão, com opt-in para publicação;
- limites server-side para fluxos de escrita e endpoints sujeitos a abuso;
- quotas e validações para uploads no Supabase Storage;
- bloqueio de novos relatos com imagens `data:image/...` armazenadas diretamente no banco;
- limitação contra flood e duplicação em fluxos sensíveis;
- moderação com histórico;
- Realtime restrito às tabelas que possuem consumidores atuais (`posts` e `notifications`);
- secrets de servidor fora do frontend e do repositório;
- hCaptcha no fluxo de autenticação compatível;
- páginas públicas de **Privacidade** e **Termos de uso**.

Nunca coloque uma `service_role`, secret key, chave SMTP, chave privada VAPID ou outro segredo em variáveis `VITE_*`: tudo que começa com `VITE_` pode ser incorporado ao bundle do navegador.

---

## ♿ Acessibilidade

O No Meu Bairro inclui recursos voltados à acessibilidade e facilidade de uso:

- **VLibras oficial**;
- modo claro e modo escuro;
- navegação por teclado e estados de foco visíveis;
- áreas de toque maiores em telas pequenas;
- escolha de fonte pequena, média, grande ou gigante antes do primeiro acesso;
- reflow para diferentes tamanhos de tela e fonte;
- tour interativo da interface;
- testes automatizados de acessibilidade com Playwright + axe-core.

---

## 🧭 Onboarding adaptativo

O guia inicial destaca controles reais do site em vez de funcionar apenas como uma sequência de textos.

### Desktop

O tour utiliza a navegação superior e apresenta Feed, publicação, Mapa, Dados, Empregos, Mural, Denúncias, Perfil e, quando aplicável, Admin.

### Celular e tablet

A experiência acompanha a interface mobile:

- Feed;
- botão `+` para publicar;
- Mapa;
- Empregos;
- Mural;
- menu **Mais**;
- Dados;
- Denúncias;
- Perfil;
- Admin, somente quando autorizado.

O guia pode ser aberto novamente pelo link **Como funciona**.

---

## 📱 Experiência responsiva e PWA

A navegação muda conforme o espaço disponível.

### Celular e tablet

A barra inferior mantém os atalhos principais:

**Feed · Mapa · Empregos · Mural · Mais**

O menu **Mais** concentra opções secundárias como Dados, Denúncias, Perfil, Admin, busca, instalação, tema e sair da conta.

### Desktop

A navegação completa fica no cabeçalho e se adapta a notebooks menores.

### Instalação como aplicativo

O projeto possui suporte a PWA com:

- manifest próprio;
- service worker;
- ícones de instalação;
- atalho **Instalar aplicativo**;
- instruções específicas quando o navegador não oferece instalação automática;
- ícone `maskable`;
- atalhos para **Novo relato** e **Mapa**;
- política própria de atualização e cache.

---

## ⚡ Performance

Entre as otimizações atuais estão:

- rotas carregadas com `React.lazy` e `Suspense`;
- recuperação automática de falhas de chunks após deploys;
- consultas direcionadas ao Supabase;
- agregações no banco quando apropriado;
- atualização Realtime apenas onde é utilizada;
- imagens no Supabase Storage, com versões leves para feed/mapa quando aplicável;
- renderização e agrupamento espacial otimizados no mapa;
- interface adaptativa para celular, tablet, notebook e desktop;
- verificação de tamanho dos bundles no CI;
- PWA com atualização voltada a evitar versões antigas presas em cache.

---

## 🧰 Tecnologias

### Frontend

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=react-router&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199903?style=for-the-badge&logo=leaflet&logoColor=white)

Versões principais definidas em `package.json`:

- React 19
- TypeScript 5.9
- Vite 7
- Tailwind CSS 4
- React Router DOM 7
- Leaflet + React Leaflet
- Supabase JS 2
- Lucide React
- Playwright + axe-core para testes de navegador/acessibilidade

### Backend e infraestrutura

![Supabase](https://img.shields.io/badge/Supabase-1C1C1C?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

- Supabase Auth
- PostgreSQL
- Row Level Security
- Supabase Realtime
- Supabase Storage
- RPCs e triggers
- migrations SQL versionadas
- Supabase Edge Functions
- Vercel Functions em `api/`
- Vercel para hosting e deploy
- GitHub Actions para CI e monitoramento

---

## 🗂️ Estrutura relevante do projeto

```text
NoMeuBairro/
├── .github/workflows/        # CI e monitoramento de produção
├── api/                      # Vercel Functions (health, imagem e compartilhamento)
├── database/                 # SQL/documentação histórica e verificações de banco
├── docs/                     # documentação operacional adicional
├── public/                   # manifest, service worker, ícones e assets públicos
├── scripts/                  # verificações de bundle e monitor de produção
├── server/                   # utilitários compartilhados pelas funções server-side
├── src/
│   ├── components/           # componentes e layout
│   ├── config/               # configurações da aplicação
│   ├── contexts/             # Auth, dados, tema, fonte e contexto de bairro
│   ├── hooks/                # hooks reutilizáveis
│   ├── pages/                # Feed, Mapa, Empregos, Mural, Admin, perfis etc.
│   ├── types/                # tipos TypeScript
│   └── utils/                # Supabase, monitoramento e utilitários
├── supabase/
│   ├── functions/            # Edge Functions: anonymous-post-control e send-push
│   ├── migrations/           # migrations aplicadas/versionadas
│   └── tests/                # verificações relacionadas ao banco
├── tests/                    # testes de contrato e testes E2E
├── package.json
├── playwright.config.ts
├── vercel.json               # rewrite da página compartilhável de relatos
└── vite.config.ts
```

---

## 🚀 Como rodar localmente

### Pré-requisitos

- **Node.js 22** recomendado, igual ao usado no GitHub Actions;
- npm;
- acesso a um projeto Supabase compatível com o schema/migrations da aplicação.

### 1. Clone o repositório

```bash
git clone https://github.com/felipinhobxd/NoMeuBairro.git
cd NoMeuBairro
```

### 2. Instale as dependências

Para reproduzir exatamente o `package-lock.json` usado no CI:

```bash
npm ci
```

Durante desenvolvimento, `npm install` também pode ser usado quando houver necessidade de alterar dependências.

### 3. Configure o ambiente

Crie `.env.local` na raiz:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publicavel
```

Variáveis utilizadas pela aplicação:

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Sim | URL pública do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sim* | chave pública/publishable usada pelo browser e pelas funções públicas |
| `VITE_SUPABASE_ANON_KEY` | Não | fallback legado para ambientes antigos; não é necessária quando a publishable key está definida |

\* O código aceita `VITE_SUPABASE_ANON_KEY` no lugar da publishable key por compatibilidade, mas novos ambientes devem preferir `VITE_SUPABASE_PUBLISHABLE_KEY`.

`.env`, `.env.local` e `.env.*.local` estão ignorados pelo Git.

Não é necessário configurar manualmente no `.env.local`:

- `VERCEL`, `VERCEL_ENV` e `VERCEL_GIT_COMMIT_SHA`: são fornecidas pela Vercel quando aplicável;
- `GITHUB_TOKEN`, `GITHUB_REPOSITORY` e `GITHUB_RUN_ID`: são fornecidas pelo GitHub Actions nos workflows;
- `VITE_MONITORING_TEST`: é reservado ao ambiente de teste local do Playwright e não deve apontar para o Supabase real.

> Nunca coloque `service_role`, secret keys, SMTP passwords ou outros secrets no frontend ou no repositório.

### 4. Inicie o desenvolvimento

```bash
npm run dev
```

### 5. Gere a build de produção

```bash
npm run build
```

### 6. Visualize a build localmente

```bash
npm run preview
```

---

## ✅ Validação e testes

Scripts existentes no projeto:

```bash
npm run typecheck   # TypeScript sem emitir arquivos
npm test            # testes de contrato em tests/*.test.mjs
npm run build       # build Vite de produção
npm run check:bundle
npm run check       # typecheck + testes de contrato + build + bundle check
```

Os testes reais de navegador usam Playwright:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

A configuração atual cobre desktop, notebooks, mobile, reflow e acessibilidade.

> O projeto **não possui atualmente um script de lint separado** em `package.json`. A validação automatizada atual é formada por TypeScript, testes de contrato, build, bundle check e Playwright. Não adicione um comando `npm run lint` à documentação enquanto esse script não existir no projeto.

---

## 🗄️ Supabase

O Supabase é parte central da arquitetura. O projeto usa Auth, PostgreSQL, RLS, Storage, Realtime, RPCs/triggers e Edge Functions.

As alterações de schema e segurança ficam versionadas em `supabase/migrations/`. Ao criar ou migrar outro ambiente, aplique as migrations na ordem correta e configure também Auth, Storage e os secrets server-side necessários às Edge Functions.

As Edge Functions versionadas atualmente são:

- `anonymous-post-control`: controle server-side de fluxos anônimos/geocodificação/upload e limites associados;
- `send-push`: envio controlado de Web Push.

O frontend não precisa e não deve receber `service_role`.

### Auth

Os fluxos de signup, reenvio de confirmação e recuperação estão configurados para usar como origem canônica:

```text
https://nomeubairro.vercel.app/
```

Essa decisão evita que URLs de preview da Vercel se tornem destino acidental de links de autenticação. Se o domínio oficial mudar, atualize a configuração correspondente no código e no Supabase Auth.

---

## ▲ Vercel

A versão pública está hospedada em:

**https://nomeubairro.vercel.app/**

A integração com a Vercel é responsável por:

- build/deploy da aplicação;
- Vercel Functions em `api/`;
- página compartilhável `/relato/:postId`, reescrita por `vercel.json` para `api/share-post.js`;
- variáveis de ambiente de produção/preview definidas no projeto da Vercel.

As funções serverless versionadas atualmente são:

- `api/health.js`;
- `api/post-image.js`;
- `api/share-post.js`.

---

## 🔄 CI/CD

O workflow **Build check** roda em pushes e PRs para `main` com Node 22 e executa:

1. `npm ci`;
2. `npm run check`;
3. instalação do Chromium;
4. `npm run test:e2e`.

O Playwright testa múltiplas larguras de desktop/notebook/mobile e acessibilidade. O relatório é publicado como artifact do GitHub Actions.

O workflow **Production monitor** roda periodicamente e depois de builds bem-sucedidos da `main` para verificar a versão publicada.

---

## 🔒 Relato de segurança e privacidade

Falhas de segurança, exposição de dados ou situações confidenciais não devem ser publicadas em issues abertas. Utilize o [canal privado de segurança do projeto](https://github.com/felipinhobxd/NoMeuBairro/security/advisories/new) e consulte [SECURITY.md](SECURITY.md).

Para baixar os próprios dados ou solicitar exclusão da conta, utilize os controles disponíveis no Perfil do site.

---

## 👨‍💻 Autores

**Felipe, Gustavo, Jonathan, Sophia e Maria**

Projeto desenvolvido no contexto do **2°DS**, com foco educacional e impacto comunitário.

---

## 📄 Licença

Projeto para fins educacionais e comunitários.
