import npcRepository from '../npcs/npc.repository';
import npcService from '../npcs/npc.service';
import questRepository from './quest.repository';

type SeedNpcSpec = {
  code: string;
  name: string;
};

type SeedQuestObjectiveSpec = {
  objectiveType: string;
  targetRef: string;
  requiredCount: number;
};

type SeedQuestPrerequisiteSpec = {
  prerequisiteType: string;
  referenceValue: string;
  operator?: string;
  requiredCount?: number;
};

type SeedQuestSpec = {
  code: string;
  title: string;
  description: string;
  giverNpcCode: string;
  turninNpcCode: string;
  minLevel?: number;
  recurrenceType?: string;
  autoTrack?: boolean;
  objectiveLogic?: 'all' | 'any';
  objectives: SeedQuestObjectiveSpec[];
  prerequisites?: SeedQuestPrerequisiteSpec[];
};

type ShadowlandSeedCatalog = {
  npcs: SeedNpcSpec[];
  quests: SeedQuestSpec[];
};

export type ShadowlandSeedResult = {
  npcs: { created: number; updated: number; total: number };
  quests: { created: number; updated: number; total: number };
};

// NOTE: This catalog is embedded to avoid deployment issues where `scripts/` is not copied into
// the production container image. Keep it deterministic and idempotent.
const SHADOWLAND_SEED_CATALOG: ShadowlandSeedCatalog = {
  npcs: [
    { code: 'wandering_trader1', name: 'Wanderer' },
    { code: 'dealer', name: 'Dealer' },
    { code: 'sister_marwen_ashveil', name: 'Sister Marwen Ashveil' },
    { code: 'arcanist_lyra_voidwhisper', name: 'Arcanist Lyra Voidwhisper' }
  ],
  quests: [
    {
      code: 'W-ANT-01',
      title: 'Marcas no Barro',
      description: 'A estrada está viva debaixo dos seus pés. Comece pelo enxame comum.',
      giverNpcCode: 'wandering_trader1',
      turninNpcCode: 'wandering_trader1',
      minLevel: 1,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Ant', requiredCount: 20 }],
      prerequisites: []
    },
    {
      code: 'W-ANT-02',
      title: 'A Trilha Negra',
      description: 'As formigas negras seguem uma rota marcada. Corte a trilha.',
      giverNpcCode: 'wandering_trader1',
      turninNpcCode: 'wandering_trader1',
      minLevel: 1,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Black Ant', requiredCount: 15 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'W-ANT-01', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'W-ANT-03',
      title: 'Gelo Fora de Lugar',
      description: 'Um frio estranho acompanha o enxame. Elimine a fonte.',
      giverNpcCode: 'wandering_trader1',
      turninNpcCode: 'wandering_trader1',
      minLevel: 1,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Ice Ant', requiredCount: 15 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'W-ANT-02', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'W-ANT-04',
      title: 'Controle de Praga',
      description: 'Não é um enxame, é uma invasão. Faça uma limpeza pesada.',
      giverNpcCode: 'wandering_trader1',
      turninNpcCode: 'wandering_trader1',
      minLevel: 2,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Ant', requiredCount: 50 },
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Black Ant', requiredCount: 35 },
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Ice Ant', requiredCount: 35 }
      ],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'W-ANT-03', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'W-ANT-05',
      title: 'A Colônia Não Dorme',
      description: 'O enxame continua vindo. Mostre que a estrada tem dono.',
      giverNpcCode: 'wandering_trader1',
      turninNpcCode: 'wandering_trader1',
      minLevel: 3,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Ant', requiredCount: 80 },
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Black Ant', requiredCount: 60 },
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Ice Ant', requiredCount: 60 }
      ],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'W-ANT-04', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'W-GBL-01',
      title: 'Primeiras Pegadas Verdes',
      description: 'Depois do enxame, vieram os saqueadores. Comece pelos Goblins comuns.',
      giverNpcCode: 'wandering_trader1',
      turninNpcCode: 'wandering_trader1',
      minLevel: 3,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Goblin', requiredCount: 20 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'W-ANT-05', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'D-GBL-01',
      title: 'Lança na Sombra',
      description: 'Eu pago por estradas seguras. Comece derrubando os lanceiros.',
      giverNpcCode: 'dealer',
      turninNpcCode: 'dealer',
      minLevel: 3,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Goblin Spearman', requiredCount: 25 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'W-GBL-01', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'D-GBL-02',
      title: 'Choque e Corrida',
      description: 'Os Chargers atropelam qualquer um. Corte o ímpeto.',
      giverNpcCode: 'dealer',
      turninNpcCode: 'dealer',
      minLevel: 4,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Goblin Charger', requiredCount: 25 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'D-GBL-01', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'D-GBL-03',
      title: 'Máscaras e Totens',
      description: 'Sem Shaman, sem maldição. Sem maldição, sem pânico.',
      giverNpcCode: 'dealer',
      turninNpcCode: 'dealer',
      minLevel: 4,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Goblin Shaman', requiredCount: 20 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'D-GBL-02', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'D-GBL-04',
      title: 'Ponta de Lança',
      description: 'Os Spearmen estão segurando a linha. Quebre a linha.',
      giverNpcCode: 'dealer',
      turninNpcCode: 'dealer',
      minLevel: 5,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Goblin Spearman', requiredCount: 35 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'D-GBL-03', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'D-GBL-05',
      title: 'Carga Repetida',
      description: 'Os Chargers voltam sempre. Faça eles pararem.',
      giverNpcCode: 'dealer',
      turninNpcCode: 'dealer',
      minLevel: 5,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Goblin Charger', requiredCount: 35 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'D-GBL-04', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'D-GBL-06',
      title: 'Quebrar o Totem',
      description: 'Os Shamans estão fortalecendo o bando. Apague a faísca.',
      giverNpcCode: 'dealer',
      turninNpcCode: 'dealer',
      minLevel: 6,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Goblin Shaman', requiredCount: 30 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'D-GBL-05', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'D-GBL-07',
      title: 'Saqueadores Comuns',
      description: 'Sem peões, sem bando. Reduza os Goblins comuns.',
      giverNpcCode: 'dealer',
      turninNpcCode: 'dealer',
      minLevel: 6,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Goblin', requiredCount: 60 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'D-GBL-06', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'D-PLG-01',
      title: 'O Cheiro da Praga',
      description: 'O bando era financiado por algo pior. Siga o fedor.',
      giverNpcCode: 'dealer',
      turninNpcCode: 'dealer',
      minLevel: 6,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Zombie', requiredCount: 15 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'D-GBL-07', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'M-UND-01',
      title: 'Ossos que Andam',
      description: 'Quebre os ossos antes que virem exército.',
      giverNpcCode: 'sister_marwen_ashveil',
      turninNpcCode: 'sister_marwen_ashveil',
      minLevel: 6,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Skeleton', requiredCount: 30 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'D-PLG-01', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'M-UND-02',
      title: 'Purga na Névoa',
      description: 'Se anda e não respira, devolva ao chão.',
      giverNpcCode: 'sister_marwen_ashveil',
      turninNpcCode: 'sister_marwen_ashveil',
      minLevel: 6,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Zombie', requiredCount: 30 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'M-UND-01', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'M-UND-03',
      title: 'Vanguarda Esquelética',
      description: 'Eles estão se organizando. Corte a vanguarda.',
      giverNpcCode: 'sister_marwen_ashveil',
      turninNpcCode: 'sister_marwen_ashveil',
      minLevel: 7,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Skeleton', requiredCount: 80 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'M-UND-02', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'M-UND-04',
      title: 'A Horda Cambaleante',
      description: 'O apodrecido também conta como ameaça.',
      giverNpcCode: 'sister_marwen_ashveil',
      turninNpcCode: 'sister_marwen_ashveil',
      minLevel: 8,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Zombie', requiredCount: 80 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'M-UND-03', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'M-ELI-01',
      title: 'Sangue no Cascalho',
      description: 'Pegadas pesadas surgiram na estrada. Trolls.',
      giverNpcCode: 'sister_marwen_ashveil',
      turninNpcCode: 'sister_marwen_ashveil',
      minLevel: 9,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Troll', requiredCount: 10 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'M-UND-04', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'M-ELI-02',
      title: 'Sombras no Céu',
      description: 'Asas cortam as nuvens. Wyverns.',
      giverNpcCode: 'sister_marwen_ashveil',
      turninNpcCode: 'sister_marwen_ashveil',
      minLevel: 9,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Wyvern', requiredCount: 8 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'M-ELI-01', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'L-ELI-01',
      title: 'Prova de Força',
      description: 'Antes do abismo, você precisa sobreviver ao peso da realidade.',
      giverNpcCode: 'arcanist_lyra_voidwhisper',
      turninNpcCode: 'arcanist_lyra_voidwhisper',
      minLevel: 9,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Troll', requiredCount: 25 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'M-ELI-02', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'L-ELI-02',
      title: 'Prova de Caça',
      description: 'O céu também mata. Traga as asas ao chão.',
      giverNpcCode: 'arcanist_lyra_voidwhisper',
      turninNpcCode: 'arcanist_lyra_voidwhisper',
      minLevel: 10,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Wyvern', requiredCount: 20 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'L-ELI-01', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'L-RIT-01',
      title: 'Quebrar o Ritual',
      description: 'Servos alimentam o véu. Corte o fluxo antes do Demon se firmar.',
      giverNpcCode: 'arcanist_lyra_voidwhisper',
      turninNpcCode: 'arcanist_lyra_voidwhisper',
      minLevel: 11,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Goblin Shaman', requiredCount: 40 },
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Skeleton', requiredCount: 40 },
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Zombie', requiredCount: 40 }
      ],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'L-ELI-02', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'L-ELI-03',
      title: 'Últimos Preparativos',
      description: 'Uma última ronda. Se falharmos aqui, o Demon vem para ficar.',
      giverNpcCode: 'arcanist_lyra_voidwhisper',
      turninNpcCode: 'arcanist_lyra_voidwhisper',
      minLevel: 12,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Troll', requiredCount: 25 },
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Wyvern', requiredCount: 25 }
      ],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'L-RIT-01', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'L-DEMON-01',
      title: 'O Chefe do Abismo',
      description: 'Acabou. Encontre o Demon e vença.',
      giverNpcCode: 'arcanist_lyra_voidwhisper',
      turninNpcCode: 'arcanist_lyra_voidwhisper',
      minLevel: 12,
      recurrenceType: 'none',
      autoTrack: true,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Demon', requiredCount: 1 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'L-ELI-03', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'L-DEMON-02',
      title: 'Prova do Caçador de Demônios',
      description: 'Uma vitória pode ser sorte. Três vitórias viram história.',
      giverNpcCode: 'arcanist_lyra_voidwhisper',
      turninNpcCode: 'arcanist_lyra_voidwhisper',
      minLevel: 12,
      recurrenceType: 'none',
      autoTrack: false,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Demon', requiredCount: 3 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'L-DEMON-01', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'L-DEMON-03',
      title: 'Exorcismo Final',
      description: 'O véu fecha quando o Demon cai... repetidas vezes.',
      giverNpcCode: 'arcanist_lyra_voidwhisper',
      turninNpcCode: 'arcanist_lyra_voidwhisper',
      minLevel: 13,
      recurrenceType: 'none',
      autoTrack: false,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Demon', requiredCount: 7 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'L-DEMON-02', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'RW-ANT-01',
      title: 'Extermínio do Enxame',
      description: 'O Wanderer sempre encontra mais trilhas tomadas. Limpe outra vez.',
      giverNpcCode: 'wandering_trader1',
      turninNpcCode: 'wandering_trader1',
      minLevel: 5,
      recurrenceType: 'daily',
      autoTrack: false,
      objectiveLogic: 'all',
      objectives: [
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Ant', requiredCount: 60 },
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Black Ant', requiredCount: 40 },
        { objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Ice Ant', requiredCount: 40 }
      ],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'W-ANT-05', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'RD-GBL-01',
      title: 'Operação Anti-Shaman',
      description: 'O Dealer quer os Shamans fora de circulação.',
      giverNpcCode: 'dealer',
      turninNpcCode: 'dealer',
      minLevel: 7,
      recurrenceType: 'daily',
      autoTrack: false,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Goblin Shaman', requiredCount: 25 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'D-PLG-01', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'RM-UND-01',
      title: 'Pilha de Ossos',
      description: 'Marwen precisa de paz. Dê a ela isso.',
      giverNpcCode: 'sister_marwen_ashveil',
      turninNpcCode: 'sister_marwen_ashveil',
      minLevel: 8,
      recurrenceType: 'daily',
      autoTrack: false,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Skeleton', requiredCount: 60 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'M-UND-04', operator: 'eq', requiredCount: 1 }]
    },
    {
      code: 'RL-DEMON-01',
      title: 'Prova do Véu',
      description: 'Lyra mantém o selo estável com vitórias repetidas.',
      giverNpcCode: 'arcanist_lyra_voidwhisper',
      turninNpcCode: 'arcanist_lyra_voidwhisper',
      minLevel: 13,
      recurrenceType: 'weekly',
      autoTrack: false,
      objectiveLogic: 'all',
      objectives: [{ objectiveType: 'WIN_DUEL_VS_MONSTER_TEMPLATE', targetRef: 'Demon', requiredCount: 5 }],
      prerequisites: [{ prerequisiteType: 'QUEST_COMPLETED', referenceValue: 'L-DEMON-03', operator: 'eq', requiredCount: 1 }]
    }
  ]
};

async function ensureNpcTemplateByCode(
  code: string,
  desired: {
    name: string;
    sprite_ref: string;
    frame_count: number;
    frame_cols: number;
    frame_rows: number;
    idle_start: number;
    idle_count: number;
    dialogue_json?: any[] | null;
  }
): Promise<{ id: number; created: boolean; updated: boolean }> {
  const existing = await npcRepository.getTemplateByCode(code);
  const dialogue_json =
    desired.dialogue_json == null ? null : JSON.stringify(desired.dialogue_json);

  if (!existing) {
    const id = await npcService.createTemplate({
      code,
      name: desired.name,
      sprite_ref: desired.sprite_ref,
      frame_count: desired.frame_count,
      frame_cols: desired.frame_cols,
      frame_rows: desired.frame_rows,
      idle_start: desired.idle_start,
      idle_count: desired.idle_count,
      dialogue_json
    });
    return { id, created: true, updated: false };
  }

  const shouldUpdate =
    String(existing.name || '') !== desired.name ||
    String(existing.sprite_ref || '') !== desired.sprite_ref ||
    Number(existing.frame_count || 0) !== desired.frame_count ||
    Number(existing.frame_cols || 0) !== desired.frame_cols ||
    Number(existing.frame_rows || 0) !== desired.frame_rows ||
    Number(existing.idle_start || 0) !== desired.idle_start ||
    Number(existing.idle_count || 0) !== desired.idle_count ||
    (dialogue_json != null && String(existing.dialogue_json || '') !== dialogue_json);

  if (!shouldUpdate) {
    return { id: existing.id, created: false, updated: false };
  }

  await npcService.updateTemplate(existing.id, {
    code,
    name: desired.name,
    sprite_ref: desired.sprite_ref,
    frame_count: desired.frame_count,
    frame_cols: desired.frame_cols,
    frame_rows: desired.frame_rows,
    idle_start: desired.idle_start,
    idle_count: desired.idle_count,
    dialogue_json
  });

  return { id: existing.id, created: false, updated: true };
}

async function resolveNpcTemplateId(code: string): Promise<number> {
  const existing = await npcRepository.getTemplateByCode(code);
  if (existing) return existing.id;

  // Fallback: if the code is missing, create a sane default matching the current dashboard seed.
  if (code === 'wandering_trader1') {
    const created = await ensureNpcTemplateByCode('wandering_trader1', {
      name: 'Wandering Trader',
      sprite_ref: 'res://assets/NPC/wandering_trader1.png',
      frame_count: 6,
      frame_cols: 6,
      frame_rows: 1,
      idle_start: 0,
      idle_count: 6,
      dialogue_json: [
        'Saudacoes, duelista.',
        'Preciso que voce prove seu valor contra o Duelista Iniciante.',
        'Venca 3 duelos e volte para receber sua recompensa.'
      ]
    });
    return created.id;
  }

  throw new Error(`NPC template not found: code=${code}`);
}

export async function seedShadowlandNpcsAndQuests(options?: {
  // If true, always update templates/quests even when unchanged (normally false).
  forceUpdate?: boolean;
}): Promise<ShadowlandSeedResult> {
  const catalog = SHADOWLAND_SEED_CATALOG;

  const result: ShadowlandSeedResult = {
    npcs: { created: 0, updated: 0, total: 0 },
    quests: { created: 0, updated: 0, total: 0 }
  };

  // Upsert NPC templates (idempotent).
  // - Keep wandering_trader1 compatible with existing seed-initial.
  // - Dealer uses its own spritesheet.
  // - Marwen/Lyra temporarily use Wanderer visuals.
  const npcCodes = new Set((catalog.npcs || []).map((n) => String(n.code || '').trim()).filter(Boolean));
  if (npcCodes.has('wandering_trader1')) {
    result.npcs.total += 1;
    const r = await ensureNpcTemplateByCode('wandering_trader1', {
      name: 'Wandering Trader',
      sprite_ref: 'res://assets/NPC/wandering_trader1.png',
      frame_count: 6,
      frame_cols: 6,
      frame_rows: 1,
      idle_start: 0,
      idle_count: 6
    });
    if (r.created) result.npcs.created += 1;
    if (r.updated) result.npcs.updated += 1;
  }

  if (npcCodes.has('dealer')) {
    result.npcs.total += 1;
    const r = await ensureNpcTemplateByCode('dealer', {
      name: 'Dealer',
      sprite_ref: 'res://assets/NPC/wandering_trader1.png',
      frame_count: 6,
      frame_cols: 6,
      frame_rows: 1,
      idle_start: 0,
      idle_count: 6
    });
    if (r.created) result.npcs.created += 1;
    if (r.updated) result.npcs.updated += 1;
  }

  if (npcCodes.has('sister_marwen_ashveil')) {
    result.npcs.total += 1;
    const r = await ensureNpcTemplateByCode('sister_marwen_ashveil', {
      name: 'Sister Marwen Ashveil',
      sprite_ref: 'res://assets/NPC/wandering_trader1.png',
      frame_count: 6,
      frame_cols: 6,
      frame_rows: 1,
      idle_start: 0,
      idle_count: 6
    });
    if (r.created) result.npcs.created += 1;
    if (r.updated) result.npcs.updated += 1;
  }

  if (npcCodes.has('arcanist_lyra_voidwhisper')) {
    result.npcs.total += 1;
    const r = await ensureNpcTemplateByCode('arcanist_lyra_voidwhisper', {
      name: 'Arcanist Lyra Voidwhisper',
      sprite_ref: 'res://assets/NPC/wandering_trader1.png',
      frame_count: 6,
      frame_cols: 6,
      frame_rows: 1,
      idle_start: 0,
      idle_count: 6
    });
    if (r.created) result.npcs.created += 1;
    if (r.updated) result.npcs.updated += 1;
  }

  // Upsert quests (idempotent).
  const quests = Array.isArray(catalog.quests) ? catalog.quests : [];
  result.quests.total = quests.length;

  for (const quest of quests) {
    const code = String(quest.code || '').trim();
    if (!code) continue;

    const giverId = await resolveNpcTemplateId(String(quest.giverNpcCode || '').trim());
    const turninId = await resolveNpcTemplateId(String(quest.turninNpcCode || '').trim());

    const existing = await questRepository.getQuestByCode(code);
    const objectiveLogic = (quest.objectiveLogic === 'any' ? 'any' : 'all') as 'any' | 'all';
    const definitionPayload = {
      code,
      title: String(quest.title || '').trim(),
      description: String(quest.description || ''),
      giver_npc_template_id: giverId,
      turnin_npc_template_id: turninId,
      min_level: Math.max(1, Number(quest.minLevel || 1)),
      recurrence_type: String(quest.recurrenceType || 'none'),
      auto_track: quest.autoTrack !== false,
      objective_logic: objectiveLogic,
      metadata_json: null as string | null,
      is_active: true
    };

    let questId: number;
    if (!existing) {
      questId = await questRepository.createQuestDefinition(definitionPayload);
      result.quests.created += 1;
    } else {
      questId = existing.id;
      const shouldUpdate =
        options?.forceUpdate === true ||
        String(existing.title || '') !== definitionPayload.title ||
        String(existing.description || '') !== definitionPayload.description ||
        Number(existing.giver_npc_template_id || 0) !== Number(definitionPayload.giver_npc_template_id || 0) ||
        Number(existing.turnin_npc_template_id || 0) !== Number(definitionPayload.turnin_npc_template_id || 0) ||
        Number(existing.min_level || 1) !== Number(definitionPayload.min_level || 1) ||
        String(existing.recurrence_type || 'none') !== String(definitionPayload.recurrence_type || 'none') ||
        Boolean(existing.auto_track) !== Boolean(definitionPayload.auto_track) ||
        String(existing.objective_logic || 'all') !== String(definitionPayload.objective_logic || 'all') ||
        Boolean(existing.is_active) !== Boolean(definitionPayload.is_active);

      if (shouldUpdate) {
        // Note: updateQuestDefinition reads back only active quests; so keep is_active true.
        await questRepository.updateQuestDefinition(questId, definitionPayload);
        result.quests.updated += 1;
      }
    }

    // Objectives (replace always for determinism).
    const objectives = Array.isArray(quest.objectives) ? quest.objectives : [];
    await questRepository.replaceQuestObjectives(
      questId,
      objectives.map((o, idx) => ({
        objective_type: String(o.objectiveType || '').trim(),
        target_ref: String(o.targetRef || '').trim(),
        required_count: Math.max(1, Number(o.requiredCount || 1)),
        filters_json: null,
        order_index: idx
      }))
    );

    // Rewards: keep consistent with existing Duelist seed style (small EXP, AI match type).
    // If you want more complex rewards later, add rewards[] to the catalog JSON.
    await questRepository.replaceQuestRewards(questId, [
      {
        reward_type: 'EXP',
        reward_ref: 'ai',
        amount: 3,
        metadata_json: JSON.stringify({ match_type: 'ai' })
      }
    ]);

    // Prerequisites (replace always).
    const prerequisites = Array.isArray(quest.prerequisites) ? quest.prerequisites : [];
    await questRepository.replaceQuestPrerequisites(
      questId,
      prerequisites.map((p) => ({
        prerequisite_type: String(p.prerequisiteType || '').trim(),
        reference_value: String(p.referenceValue || '').trim(),
        operator: String(p.operator || 'eq'),
        required_count: Math.max(1, Number(p.requiredCount || 1))
      }))
    );
  }

  return result;
}

