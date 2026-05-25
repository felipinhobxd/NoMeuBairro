# 🏢 No Meu Bairro — Vitória Régia

Plataforma comunitária interativa para moradores do bairro Vitória Régia registrarem problemas, acompanharem estatísticas locais, descobrirem comércios e fortalecerem a comunicação no bairro.

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
![Lucide Icons](https://img.shields.io/badge/Lucide_Icons-F1F5F9?style=for-the-badge&logo=lucide&logoColor=black)

#### **Backend & Infraestrutura**
![Supabase](https://img.shields.io/badge/Supabase-1C1C1C?style=for-the-badge&logo=supabase&logoColor=3ECF8E)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

#### **Ferramentas & Outros**
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)
![Markdown](https://img.shields.io/badge/Markdown-000000?style=for-the-badge&logo=markdown&logoColor=white)
![JSON](https://img.shields.io/badge/JSON-000000?style=for-the-badge&logo=json&logoColor=white)

---

## 🌟 Funcionalidades Principais

*   **📝 Feed de Mensagens**: Registre e acompanhe problemas comunitários (buracos, iluminação, segurança) com fotos e descrições detalhadas.
*   **📍 Mapa do Bairro**: Localize geograficamente todos os relatos em um mapa interativo, facilitando a visualização dos pontos críticos do Vitória Régia.
*   **📊 Painel de Estatísticas**: Acompanhe gráficos em tempo real sobre os problemas mais frequentes e a taxa de solução do bairro.
*   **🏪 Guia Comercial & Serviços**: Descubra e avalie comércios locais com sistema de 1 a 5 estrelas e comentários dos vizinhos.
*   **🗓️ Mural de Eventos**: Fique por dentro de tudo o que acontece na comunidade, desde feiras locais até reuniões de moradores.
*   **🛡️ Denúncias 100% Anônimas**: Canal seguro para relatos sensíveis, garantindo total privacidade e anonimato do morador.
*   **⚖️ Painel do Administrador**: Ferramenta exclusiva para moderação, permitindo gerenciar denúncias e manter o ambiente organizado.
*   **🔍 Filtro "Perto de Mim"**: Use a geolocalização exata para ver apenas as ocorrências que estão acontecendo na sua rua ou quadra.

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
**Felipe, Gustavo, Jonathan, Sophia e Maria**

---

## 📄 Licença
Este projeto é para fins educacionais e comunitários.
