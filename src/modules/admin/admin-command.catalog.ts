export type AdminCommandDoc = {
  command: string;
  description: string;
  scope: 'chat';
  permission: 'admin' | 'any';
  example: string;
};

export const ADMIN_COMMANDS_CATALOG: AdminCommandDoc[] = [
  // ─── Spawn de monstros / NPCs ──────────────────────────────────────────────
  {
    command: '/spawn <nome>',
    description:
      'Cria 1 spawn do template de monstro ou NPC na posição atual do jogador. Registra no banco e fica no mapa de spawns do dashboard.',
    scope: 'chat',
    permission: 'admin',
    example: '/spawn Goblin'
  },
  {
    command: '/4spawn <nome> [offset]',
    description:
      'Cria 4 spawns do template em padrão X ao redor do jogador (4 cantos diagonais). Offset em px do mundo (padrão 400). Nomes com espaço funcionam sem aspas.',
    scope: 'chat',
    permission: 'admin',
    example: '/4spawn Duelista Iniciante 350'
  },

  // ─── Regiões nomeadas (Dark Souls label) ───────────────────────────────────
  {
    command: '/spawnpoint <nome> [raio]',
    description:
      'Cria uma região nomeada na posição atual do jogador. Quando outro jogador entrar no raio, o nome aparece no centro da tela estilo Dark Souls. Alias: /region. Raio padrão: 800px.',
    scope: 'chat',
    permission: 'admin',
    example: '/spawnpoint Floresta do Norte 1200'
  },
  {
    command: '/delregion <nome>',
    description:
      'Remove uma região nomeada pelo nome (case-insensitive). Alias: /delreg. Broadcast imediato para todos os jogadores da zona.',
    scope: 'chat',
    permission: 'admin',
    example: '/delregion Floresta do Norte'
  },

  // ─── Modo Deus / velocidade ────────────────────────────────────────────────
  {
    command: '/god',
    description:
      'Liga/desliga o modo Deus para o jogador admin: sem colisão, sem batalhas e sem dano.',
    scope: 'chat',
    permission: 'admin',
    example: '/god'
  },
  {
    command: '/speed <multiplicador>',
    description:
      'Define o multiplicador de velocidade de movimento do jogador (1 = padrão, 5 = 5× mais rápido). Útil para navegar o mapa rapidamente.',
    scope: 'chat',
    permission: 'admin',
    example: '/speed 5'
  },

  // ─── Diagnóstico / performance ─────────────────────────────────────────────
  {
    command: '/perf <mobile|balanced|high>',
    description:
      'Troca em runtime o preset de performance MMO (AOI radius, delta interval, resync rate) para a zona Shadowland.',
    scope: 'chat',
    permission: 'admin',
    example: '/perf mobile'
  },
  {
    command: '/channels',
    description:
      'Mostra snapshot de saúde dos channels: players online, média de visibilidade AOI e distribuição por shard.',
    scope: 'chat',
    permission: 'admin',
    example: '/channels'
  },

  // ─── Chat ──────────────────────────────────────────────────────────────────
  {
    command: '/w <username> <mensagem>',
    description:
      'Envia uma mensagem privada (whisper) para outro jogador online. Aliases: /whisper, /pm.',
    scope: 'chat',
    permission: 'any',
    example: '/w amortus oi!'
  },
  {
    command: '/help',
    description:
      'Lista todos os comandos disponíveis no chat (este catálogo). Alias: /commands.',
    scope: 'chat',
    permission: 'any',
    example: '/help'
  }
];
