# books.hhartur

Plataforma de distribuição de livros em PDF.

## Stack
- **Backend:** Node.js + Express 5
- **Frontend:** HTML / CSS / JavaScript puro
- **Banco de dados:** Supabase (PostgreSQL)
- **Armazenamento de PDFs:** Cloudinary
- **Auth:** JWT (access token 15min + refresh token 7d com rotação)

## Estrutura

```
books-hhartur/
├── server/
│   └── src/
│       ├── index.js              # Entry point Express
│       ├── config/
│       │   ├── supabase.js
│       │   ├── cloudinary.js
│       │   └── jwt.js
│       ├── middleware/
│       │   └── auth.js           # JWT + guards de role
│       ├── routes/
│       │   ├── auth.js
│       │   ├── users.js
│       │   └── books.js
│       └── controllers/
│           ├── authController.js
│           ├── usersController.js
│           └── booksController.js
├── client/
│   ├── index.html                # Login
│   ├── books.html                # Biblioteca (todos os usuários)
│   ├── reader.html               # Leitor de PDF
│   ├── admin.html                # Dashboard admin
│   ├── styles/
│   │   └── main.css
│   └── js/
│       └── api.js                # Cliente de API + gerenciamento de tokens
└── database/
    ├── schema.sql                # Schema Supabase (execute primeiro)
    └── generate-hash.js          # Gera hash bcrypt da senha do global
```

## Roles e Permissões

| Ação                        | global | admin | editor | reader |
|-----------------------------|:------:|:-----:|:------:|:------:|
| Ver livros                  | ✓      | ✓     | ✓      | ✓      |
| Ler/baixar PDF              | ✓      | ✓     | ✓      | ✓      |
| Adicionar livros            | ✓      | ✓     | ✓      | ✗      |
| Editar livros               | ✓      | ✓     | ✓      | ✗      |
| Remover livros              | ✓      | ✓     | ✗      | ✗      |
| Criar usuários              | ✓      | ✓     | ✗      | ✗      |
| Editar usuários             | ✓      | ✓     | ✗      | ✗      |
| Remover usuários            | ✓      | ✗     | ✗      | ✗      |
| Criar admin                 | ✓      | ✗     | ✗      | ✗      |

## Setup

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e execute o conteúdo de `database/schema.sql`
3. Antes de executar, gere o hash da senha do usuário global:
   ```bash
   npm run generate-hash
   ```
4. Substitua o `PLACEHOLDER` no `schema.sql` pelo hash gerado e execute

### 2. Cloudinary

1. Crie uma conta em [cloudinary.com](https://cloudinary.com)
2. Anote: **Cloud Name**, **API Key**, **API Secret**

### 3. Configurar variáveis de ambiente

```bash
cd server
cp .env.example .env
```

Edite `.env` com suas credenciais reais.

**JWT_SECRET** e **JWT_REFRESH_SECRET**: gere valores aleatórios longos:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Instalar dependências e iniciar

```bash
npm run install:server
npm run dev        # desenvolvimento
npm start          # produção
```

O servidor inicia na porta **3001** e serve o frontend estático automaticamente.

Acesse: http://localhost:3001

### 5. Login inicial

- **Username:** `hhartur`
- **Senha:** `010203`

> ⚠️ Altere a senha do usuário global após o primeiro acesso.

## API Endpoints

### Auth
| Método | Rota              | Descrição          |
|--------|-------------------|--------------------|
| POST   | /api/auth/login   | Login              |
| POST   | /api/auth/refresh | Renovar token      |
| POST   | /api/auth/logout  | Logout             |

### Books (requer auth)
| Método | Rota                      | Permissão      | Descrição             |
|--------|---------------------------|----------------|-----------------------|
| GET    | /api/books                | reader+        | Listar livros         |
| GET    | /api/books/:id            | reader+        | Buscar livro          |
| GET    | /api/books/:id/secure-url | reader+        | URL assinada (15min)  |
| POST   | /api/books                | editor+        | Criar livro + PDF     |
| PUT    | /api/books/:id            | editor+        | Atualizar livro       |
| DELETE | /api/books/:id            | admin+         | Remover livro         |

### Users (requer auth)
| Método | Rota             | Permissão | Descrição         |
|--------|------------------|-----------|-------------------|
| GET    | /api/users       | admin+    | Listar usuários   |
| POST   | /api/users       | admin+    | Criar usuário     |
| PUT    | /api/users/:id   | admin+    | Editar usuário    |
| DELETE | /api/users/:id   | global    | Remover usuário   |

## Segurança implementada

- **Helmet.js** — headers HTTP seguros + CSP
- **Rate limiting** — global (300/15min), login (10/15min), refresh (20/5min)
- **CORS** configurado para domínio específico
- **Bcrypt** (12 rounds) para senhas
- **JWT access token** curto (15min) + **refresh token com rotação**
- **Refresh tokens armazenados no banco** e invalidados no logout
- **Guards de role** em cada rota
- **URLs assinadas** do Cloudinary para PDFs (expiram em 15min)
- Senhas nunca expostas na API
