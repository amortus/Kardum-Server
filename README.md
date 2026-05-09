# Kardum Server

Servidor do **Kardum**, um MMORPG com combate tático por cartas, inspirado em *Magic: The Gathering — Shandalar* e *Ultima Online*.

## Características

- Mundo online persistente com AOI e múltiplos canais por zona
- Combate PvP em tempo real com fila casual e sistema de ELO
- Sistema de quests, NPCs e drops
- Sistema social: amizades, chat por zona e whisper
- Verificação de email e sessão única por conta (anti-compartilhamento)
- Conformidade com LGPD: consentimento explícito no cadastro
- Dashboard administrativo completo

## Pré-requisitos

- Node.js 18+
- Docker Desktop (para subir Postgres + Redis localmente)

## Configuração

Copie `.env.example` para `.env` e preencha os valores:

```bash
cp .env.example .env
```

Variáveis obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`.

## Rodando em desenvolvimento

**SQLite local (sem Docker):**
```bash
npm install
npm run dev
```

**Postgres + Redis via Docker Compose:**
```bash
docker compose -f docker-compose.dev.yml up --build
```

- Admin: `http://localhost:3000/admin`
- API: `http://localhost:3000/api/*`

## Build

```bash
npm run build
npm start
```

## Estrutura

```
src/
├── config/         # Banco de dados, env, socket, Redis
├── modules/        # Domínios: auth, cards, decks, quests, monsters, chat...
├── shared/         # Tipos e constantes compartilhados
└── server.ts       # Entry point

admin/              # Dashboard administrativo (HTML/JS/CSS)
deploy/             # Configurações de deploy (Docker, Nginx)
```

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express |
| Linguagem | TypeScript |
| Tempo real | Socket.IO |
| Banco principal | PostgreSQL |
| Cache / pub-sub | Redis |
| Autenticação | JWT + bcrypt |
| Email | Resend |

## Licença

MIT
