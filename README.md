# 🏘️ NoMeuBairro

Plataforma comunitária para moradores de Curitiba registrarem problemas, acompanharem relatos por bairro, participarem de eventos, encontrarem oportunidades de emprego e contribuírem para a comunidade.

---

### 🚧 Status do Projeto
![Em Desenvolvimento](https://img.shields.io/badge/STATUS-EM%20DESENVOLVIMENTO-orange?style=for-the-badge)

### 💻 Tecnologias Utilizadas

#### **Frontend**
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=react-router&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199903?style=for-the-badge&logo=leaflet&logoColor=white)

#### **Backend & Infraestrutura**
![Supabase](https://img.shields.io/badge/Supabase-1C1C1C?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

---

## 🌟 Funcionalidades Principais

- **📝 Feed comunitário** com relatos, fotos, categorias, apoios, comentários e status Pendente / Em andamento / Resolvido.
- **📍 Filtro por bairro** com catálogo de bairros de Curitiba, aliases como `CIC` e suporte a localidades específicas como Vitória Régia.
- **🗺️ Mapa integrado** com relatos, eventos e empregos, além de localização aproximada quando não existe coordenada exata.
- **📊 Dados da comunidade** calculados por agregações no banco, sem depender apenas dos itens visíveis no Feed.
- **💼 Empregos** com perfil público de empresa, currículo privado, candidaturas, localização e busca em até 20 km.
- **🗓️ Mural de eventos** com presença, busca, bairro/localidade e integração com o mapa.
- **🛡️ Denúncias anônimas** com controle privado para atualizar status e excluir sem revelar autoria publicamente.
- **🔔 Notificações** para interações comunitárias e candidaturas.
- **👤 Perfis públicos e Minha atividade** com relatos, apoios, comentários, eventos e candidaturas.
- **⚖️ Moderação** protegida por permissões no Supabase.

---

## ⚡ Arquitetura de Performance

O frontend evita carregar dados que a rota atual não utiliza:

- O **Feed** carrega somente relatos.
- O **Mural** carrega eventos e a presença do usuário uma única vez por sessão da página.
- O **Mapa** carrega relatos e eventos; vagas são carregadas apenas quando a camada de Empregos é usada.
- **Comentários** são buscados somente quando a conversa de um relato é aberta.
- **Perfis** usam consultas direcionadas e agregações leves em vez de baixar Feed e Mural completos.
- **Empregos** usa campos explícitos, apenas vagas ativas/não expiradas, limite de resultados e cache curto no cliente.
- **Notificações Realtime** recebem novos itens individualmente em vez de refazer a lista inteira em cada mudança.
- O **Leaflet do seletor de localização** é carregado sob demanda.
- Imagens de relatos e avatares ficam no **Supabase Storage**, com cache longo; o banco armazena apenas URLs.
- Arquivos órfãos são evitados na falha/exclusão dos fluxos de imagem e denúncias anônimas têm limpeza segura própria.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- Node.js
- Conta/projeto no Supabase

### Instalação
1. Clone o repositório:
   ```bash
   git clone https://github.com/felipinhobxd/NoMeuBairro.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure `.env.local`:
   ```env
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_publicavel_aqui
   ```
4. Inicie o frontend:
   ```bash
   npm run dev
   ```

> O banco de produção possui migrations, policies, triggers, RPCs e Edge Functions além do schema inicial. Para outro ambiente, replique as migrations do projeto em vez de depender somente de um snapshot antigo do schema.

---

## 👨‍💻 Autores
**Felipe, Gustavo, Jonathan, Sophia e Maria**

---

## 📄 Licença
Projeto para fins educacionais e comunitários.
