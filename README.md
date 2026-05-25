# 🏢 No Meu Bairro — Vitória Régia

Plataforma comunitária interativa para moradores do bairro Vitória Régia registrarem problemas, acompanharem estatísticas locais, descobrirem comércios e fortalecerem a comunicação no bairro.

---

### 🚧 Status do Projeto
![Em Desenvolvimento](https://img.shields.io/badge/STATUS-EM%20DESENVOLVIMENTO-orange?style=for-the-badge)

### 💻 Tecnologias Utilizadas
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-1C1C1C?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199903?style=for-the-badge&logo=leaflet&logoColor=white)
![Lucide](https://img.shields.io/badge/Lucide_Icons-F1F5F9?style=for-the-badge&logo=lucide&logoColor=black)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)

---

## 🌟 Funcionalidades Principais

*   **📍 Mapa Comunitário**: Visualize todos os problemas do bairro em um mapa interativo com marcadores coloridos por categoria.
*   **📊 Painel de Estatísticas**: Gráficos em tempo real que mostram os problemas mais frequentes e a taxa de solução do bairro.
*   **🔍 Filtro "Perto de Mim"**: Use a geolocalização exata para ver apenas o que está acontecendo na sua rua ou quadra.
*   **🛡️ Denúncias 100% Anônimas**: Sistema seguro de denúncias que garante total privacidade, mesmo estando logado.
*   **⚖️ Painel do Administrador**: Central de moderação exclusiva para o administrador gerenciar denúncias e conteúdos ofensivos.
*   **🏪 Guia Comercial com Avaliações**: Descubra serviços locais e avalie-os com sistema de 1 a 5 estrelas e comentários.
*   **🔔 Notificações em Tempo Real**: Receba alertas instantâneos sempre que alguém interagir com suas postagens.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
*   Node.js instalado
*   Conta no Supabase

### Instalação
1. Clone o repositório:
   ```bash
   git clone https://github.com/felipinhobxd/NoMeuBairro.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o arquivo `.env.local` na raiz com suas chaves do Supabase:
   ```env
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
   ```
4. Execute o banco de dados:
   Copie o conteúdo de `backend/schema.sql` e cole no **SQL Editor** do Supabase.
5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

---

## 👨‍💻 Autor e Administrador
**Felipe**  
Email: `felipe@gmail.com`

---

## 📄 Licença
Este projeto é para fins educacionais e comunitários.
