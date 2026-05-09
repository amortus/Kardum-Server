import monsterRepository from './monster.repository';
import monsterService from './monster.service';
import cardRepository from '../cards/card.repository';

export type ArchetypeSeedResult = {
  archetype: string;
  collection_id: string;
  monsters: Array<{
    name: string;
    template_id: number | null;
    drops_inserted: number;
    chance_breakdown?: Record<string, number>;
    skipped_reason?: string;
  }>;
  total_cards: number;
  tier_summary: Record<string, number>;
};

type ArchetypeSpec = {
  archetype: string;
  collection_id: string;
  monster_names: string[]; // ordem importa para a partição determinística
};

const ARCHETYPES: ArchetypeSpec[] = [
  {
    archetype: 'goblin',
    collection_id: 'goblin',
    monster_names: ['Goblin', 'Goblin Charger', 'Goblin Shaman', 'Goblin Spearman']
  },
  {
    archetype: 'ant',
    collection_id: 'ant',
    monster_names: ['Ant', 'Black Ant', 'Ice Ant']
  },
  {
    archetype: 'necromancer',
    collection_id: 'necromancer',
    monster_names: ['Skeleton', 'Zombie', 'Demon']
  }
];

/**
 * Distribuição de raridade por rank (cards ordenados por custo desc, id asc).
 * Para uma coleção de 70 cartas, garante exatamente:
 *   - 1 carta a 0.01% (mítica — top custo)
 *   - 4 cartas a 1%   (lendárias)
 *   - 10 cartas a 10% (épicas)
 *   - 20 cartas a 50% (raras)
 *   - 35 cartas a 99% (comuns)
 * O primeiro monstro listado de cada arquétipo herda a carta mítica
 * (rank 0) graças à partição intercalada (i % N).
 */
function computeDropChanceByRank(rank: number, total: number): number {
  if (total <= 0) return 99;
  if (rank === 0) return 0.01;
  if (rank < 5) return 1;
  if (rank < 15) return 10;
  if (rank < 35) return 50;
  return 99;
}

function tierLabel(chance: number): string {
  if (chance <= 0.01) return 'mythic_0.01';
  if (chance <= 1) return 'legendary_1';
  if (chance <= 10) return 'epic_10';
  if (chance <= 50) return 'rare_50';
  return 'common_99';
}

/**
 * Configura cada monstro listado para usar o deck da coleção do seu arquétipo
 * e distribui as 70 cartas da coleção de forma intercalada entre os monstros,
 * com 100% de chance de drop por carta. Como `rollTemplateDrop` rola cada drop
 * separadamente e concede no máximo 1 carta por vitória, o jogador precisa
 * derrotar todos os monstros do arquétipo várias vezes para completar a coleção.
 */
export async function seedMonsterArchetypes(options?: {
  userId?: number;
}): Promise<ArchetypeSeedResult[]> {
  const userId = Number(options?.userId || 1);
  const results: ArchetypeSeedResult[] = [];

  for (const spec of ARCHETYPES) {
    const cards = await cardRepository.getAllCards({ collection_id: spec.collection_id });
    // Ordenação determinística: maior custo primeiro (mais raro), id asc para empate.
    // Isso faz com que rank 0 = carta mais cara da coleção (mítica 0.01%).
    const sortedCards = [...cards].sort((a, b) => {
      const costA = Number(a.cost ?? 0);
      const costB = Number(b.cost ?? 0);
      if (costB !== costA) return costB - costA;
      return String(a.id).localeCompare(String(b.id));
    });

    const total = sortedCards.length;
    const tierSummary: Record<string, number> = {};
    const cardChance = new Map<string, number>();
    for (let rank = 0; rank < total; rank += 1) {
      const chance = computeDropChanceByRank(rank, total);
      cardChance.set(String(sortedCards[rank].id), chance);
      const label = tierLabel(chance);
      tierSummary[label] = (tierSummary[label] || 0) + 1;
    }

    const result: ArchetypeSeedResult = {
      archetype: spec.archetype,
      collection_id: spec.collection_id,
      monsters: [],
      total_cards: total,
      tier_summary: tierSummary
    };

    // Partição intercalada: cards[rank] → monsters[rank % N]. Garante distribuição
    // uniforme em quantidade. O monstro de índice 0 herda o rank 0 (mítica 0.01%).
    const monsterCount = spec.monster_names.length;
    const partitions: string[][] = Array.from({ length: monsterCount }, () => []);
    for (let rank = 0; rank < total; rank += 1) {
      partitions[rank % monsterCount].push(String(sortedCards[rank].id));
    }

    for (let i = 0; i < spec.monster_names.length; i += 1) {
      const monsterName = spec.monster_names[i];
      const partition = partitions[i];
      const template = await monsterRepository.getTemplateByName(monsterName);
      if (!template) {
        result.monsters.push({
          name: monsterName,
          template_id: null,
          drops_inserted: 0,
          skipped_reason: 'template not found (rode Seed Shadowland Monsters antes)'
        });
        continue;
      }

      // Atualiza o template para usar a coleção do arquétipo. Isso dispara
      // buildDeckCards no service e regenera o deck do monstro a partir
      // das 70 cartas da coleção.
      await monsterService.updateTemplate(template.id, {
        user_id: userId,
        name: template.name,
        difficulty: template.difficulty,
        visual: template.visual,
        sprite_ref: template.sprite_ref,
        collection_id: spec.collection_id,
        deck_mode: 'auto',
        manual_deck_cards: []
      } as any);

      // Limpa drops antigos e insere a partição com chance variando por raridade.
      await monsterRepository.clearTemplateDrops(template.id);
      const chanceBreakdown: Record<string, number> = {};
      for (const cardId of partition) {
        const chance = cardChance.get(cardId) ?? 99;
        await monsterRepository.upsertTemplateDrop(template.id, cardId, chance);
        const label = tierLabel(chance);
        chanceBreakdown[label] = (chanceBreakdown[label] || 0) + 1;
      }

      result.monsters.push({
        name: monsterName,
        template_id: template.id,
        drops_inserted: partition.length,
        chance_breakdown: chanceBreakdown
      });
    }

    results.push(result);
  }

  return results;
}
