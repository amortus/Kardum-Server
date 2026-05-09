# Kardum Server

Servidor do Kardum, um MMORPG com combate tatico por cartas, inspirado em Magic Shandalar e Ultima Online.

## 🎮 Caracteristicas

- ✅ Mundo online persistente (MMORPG)
- ✅ Combate PvP em tempo real com fila casual
- ✅ Sistema de ranking/ELO
- ✅ Sistema de quests e NPCs
- ✅ Sistema social (amizades e chat)
- ✅ Suporte a shard/world state no backend
- ✅ Dashboard administrativo

## 🚀 Setup rapido

### Pre-requisitos

- Node.js 18+
- npm
- Docker Desktop (recomendado, para Postgres/Redis local)

### Instalacao

```bash
npm install
```

### Ambiente

Crie e configure seu `.env` com as variaveis do ambiente (banco, JWT, Redis, etc).

### Rodando em desenvolvimento

```bash
npm run dev
```

### Rodando em desenvolvimento (Postgres igual produção)

Suba Postgres + Redis + App via Docker Compose (dev):

```bash
docker compose -f docker-compose.dev.yml up --build
```

- **Admin**: `http://localhost:3000/admin`
- **API**: `http://localhost:3000/api/*`

Observações:
- O servidor usa **Postgres** quando `DATABASE_URL` está presente.
- O compose dev já injeta `DATABASE_URL=postgres://kardum:kardum@db:5432/kardum`.
- O arquivo `.env` ainda pode manter `DATABASE_PATH` só para cenários legados (SQLite), mas no fluxo recomendado ele não é usado.

### Clonar o banco de produção (AWS EC2) para o Postgres local

Pré-requisitos:
- Docker Desktop rodando
- Acesso SSH na EC2 (chave `.pem`)
- O `.env` no servidor (EC2) contém `DATABASE_URL` apontando para o Postgres de produção

1) Gerar e baixar dump da produção (roda `pg_dump` via container `postgres:16-alpine` na EC2):

```powershell
$env:KARDUM_EC2_HOST="x.x.x.x"
$env:KARDUM_EC2_USER="ec2-user"
$env:KARDUM_EC2_KEY_PATH="C:\\caminho\\kardum.pem"
$env:KARDUM_EC2_APP_DIR="/home/ec2-user/kardum"  # pasta onde está o docker compose + .env

.\scripts\db\pull-prod.ps1
```

2) Restaurar no Postgres local:

```powershell
.\scripts\db\restore-local.ps1 -DumpPath .\scripts\db\dumps\kardum-prod-YYYYMMDD-HHMMSS.dump
```

3) Subir o app local (com DB já clonado):

```bash
docker compose -f docker-compose.dev.yml up --build app
```

### Build e execucao em producao

```bash
npm run build
npm start
```

Servidor padrao em `http://localhost:3000` (ou porta definida no `.env`).

## 📁 Estrutura

```
kardum-mobile/
├── src/            # Codigo-fonte TypeScript do servidor
├── admin/          # Assets e recursos do painel admin
├── server/         # Arquivos auxiliares/legados do backend
├── deploy/         # Scripts e docs de deploy
└── package.json
```

## 🛠️ Stack

- **Runtime**: Node.js
- **Framework**: Express
- **Linguagem**: TypeScript
- **Tempo real**: Socket.IO + ws
- **Banco**: SQLite (`better-sqlite3`) e PostgreSQL (`pg`)
- **Cache/pub-sub**: Redis (`redis` + `@socket.io/redis-adapter`)
- **Autenticacao**: JWT (`jsonwebtoken`) + bcrypt
- **Upload**: multer

## 📝 Licenca

MIT
