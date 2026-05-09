import monsterRepository from './monster.repository';
import monsterService from './monster.service';

export type ShadowlandMonsterSeedResult = {
  created: number;
  updated: number;
  total: number;
};

type MonsterSpec = {
  name: string;
  visual: string;
};

const SHADOWLAND_MONSTERS: MonsterSpec[] = [
  { name: 'Goblin', visual: 'res://assets/Charset/Goblin/goblin.png' },
  { name: 'Goblin Charger', visual: 'res://assets/Charset/Goblin/goblin_charger.png' },
  { name: 'Goblin Shaman', visual: 'res://assets/Charset/Goblin/goblin_shaman.png' },
  { name: 'Goblin Spearman', visual: 'res://assets/Charset/Goblin/goblin_spearman.png' },
  { name: 'Zombie', visual: 'res://assets/Charset/Zombie/zombie.png' },
  { name: 'Skeleton', visual: 'res://assets/Charset/Skeleton/skeleton.png' },
  { name: 'Lich', visual: 'res://assets/Charset/Lich/Lich.png' },
  { name: 'Troll', visual: 'res://assets/Charset/Troll/troll.png' },
  { name: 'Demon', visual: 'res://assets/Charset/Demon/demon.png' },
  { name: 'Ant', visual: 'res://assets/Charset/Ant/ant.png' },
  { name: 'Black Ant', visual: 'res://assets/Charset/Ant/black_ant.png' },
  { name: 'Ice Ant', visual: 'res://assets/Charset/Ant/ice_ant.png' },
  { name: 'Wyvern', visual: 'res://assets/Charset/Wyvern/wyvern.png' }
];

export async function seedShadowlandMonsterTemplates(options?: {
  userId?: number;
  forceUpdate?: boolean;
}): Promise<ShadowlandMonsterSeedResult> {
  const userId = Number(options?.userId || 1);
  const result: ShadowlandMonsterSeedResult = { created: 0, updated: 0, total: SHADOWLAND_MONSTERS.length };

  for (const spec of SHADOWLAND_MONSTERS) {
    const existing = await monsterRepository.getTemplateByName(spec.name);
    if (!existing) {
      await monsterService.createTemplate({
        user_id: userId,
        name: spec.name,
        difficulty: 'easy',
        visual: spec.visual,
        collection_id: 'shadowland_creatures',
        deck_mode: 'hybrid',
        manual_deck_cards: []
      });
      result.created += 1;
      continue;
    }

    const shouldUpdate =
      options?.forceUpdate === true ||
      String(existing.visual || '') !== spec.visual ||
      String(existing.name || '') !== spec.name;

    if (!shouldUpdate) continue;

    await monsterService.updateTemplate(existing.id, {
      user_id: userId,
      name: spec.name,
      visual: spec.visual,
      collection_id: existing.collection_id || 'shadowland_creatures',
      deck_mode: existing.deck_mode || 'hybrid'
    } as any);
    result.updated += 1;
  }

  return result;
}

