# No Meu Bairro — Vitória Régia

Plataforma comunitária para o bairro Vitória Régia, em Curitiba, com foco em relatos, guia comercial, mural de publicações e denúncias anônimas.

## ✨ Visão geral

O projeto reúne funcionalidades para fortalecer a comunicação entre moradores e apoiar a organização da comunidade. A aplicação possui páginas para feed, guia comercial, mural, denúncias, login e perfis de usuários, além de recursos de segurança como botão de pânico e consentimento de cookies.

## 🚀 Acesse a aplicação

- **Site online:** https://nomeubairro.vercel.app/
- **Repositório:** https://github.com/felipinhobxd/NoMeuBairro

## 🛠️ Tecnologias utilizadas

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router DOM
- Lucide React
- Supabase SDK

### Backend
- Python
- Flask
- Flask-RESTful
- Flask-CORS
- Flask-Limiter
- Flask-SQLAlchemy
- Flask-Migrate
- PostgreSQL / SQLAlchemy

### Outros recursos
- JWT
- Argon2id para hash de senhas
- Criptografia para denúncias
- Gunicorn
- Docker / Docker Compose

## 📌 Funcionalidades

- Feed principal da comunidade
- Guia comercial com negócios locais
- Mural de publicações
- Sistema de denúncias anônimas
- Login e perfis de usuário
- Perfil público para visualização de usuários
- Botão de pânico
- Consentimento de cookies
- Tema centralizado por provider
- Controle de dados e autenticação

## 🗂️ Estrutura do projeto

```bash
.
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── middleware.py
│   ├── models.py
│   ├── schema.sql
│   ├── wsgi.py
│   └── ...
├── src/
│   ├── components/
│   ├── contexts/
│   ├── hooks/
│   ├── pages/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.ts
└── vercel.json
```

## ▶️ Como executar o projeto

### Pré-requisitos
- Node.js 18+
- Python 3.11+
- PostgreSQL
- Git

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
flask run
```

## 🔧 Build de produção

### Frontend

```bash
npm run build
npm run preview
```

### Backend

```bash
cd backend
gunicorn wsgi:app
```

## ⚙️ Variáveis de ambiente

Crie os arquivos de ambiente conforme o projeto exigir, por exemplo:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

DATABASE_URL=your_database_url
SECRET_KEY=your_secret_key
JWT_SECRET_KEY=your_jwt_secret_key
```

## 📄 Banco de dados

O arquivo `backend/schema.sql` contém a estrutura do banco, incluindo tabelas para usuários, posts, comentários, negócios locais, eventos, apoios e denúncias anônimas.

## 🧩 Rotas principais

- `/` - Feed
- `/guia` - Guia comercial
- `/mural` - Mural
- `/denuncias` - Denúncias
- `/login` - Login
- `/perfil` - Perfil do usuário
- `/perfil/:userId` - Perfil público

## 👨‍💻 Autor

Projeto publicado por **felipinhobxd**.

## 📜 Licença

Defina aqui a licença do projeto se desejar.
