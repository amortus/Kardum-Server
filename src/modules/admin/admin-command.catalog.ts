export type AdminCommandDoc = {
  command: string;
  description: string;
  scope: 'chat';
  permission: 'admin' | 'any';
  example: string;
};

export const ADMIN_COMMANDS_CATALOG: AdminCommandDoc[] = [
  {
    command: '/spawn <nome_do_monstro>',
    description:
      'Cria um spawn do template no ponto atual do jogador (zona atual), registrando no backend/dashboard.',
    scope: 'chat',
    permission: 'admin',
    example: '/spawn Monstro1'
  },
  {
    command: '/perf <mobile|balanced|high>',
    description:
      'Troca em runtime o preset de performance MMO (AOI, delta e resync) para a zona Shadowland.',
    scope: 'chat',
    permission: 'admin',
    example: '/perf mobile'
  },
  {
    command: '/channels',
    description:
      'Mostra snapshot de saude dos channels (players, media de visibilidade AOI e distribuicao por shard).',
    scope: 'chat',
    permission: 'admin',
    example: '/channels'
  }
];

