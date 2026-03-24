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
