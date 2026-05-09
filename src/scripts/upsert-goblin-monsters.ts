import { initializeDatabase } from '../config/database';
import monsterRepository from '../modules/monsters/monster.repository';
import monsterService from '../modules/monsters/monster.service';

type GoblinSpec = {
  name: string;
  visual: string;
};

const MONSTERS: GoblinSpec[] = [
  { name: 'Goblin', visual: 'res://assets/Charset/Goblin/goblin.png' },
  { name: 'Goblin Charger', visual: 'res://assets/Charset/Goblin/goblin_charger.png' },
  { name: 'Goblin Shaman', visual: 'res://assets/Charset/Goblin/goblin_shaman.png' },
  { name: 'Goblin Spearman', visual: 'res://assets/Charset/Goblin/goblin_spearman.png' },
  { name: 'Zombie', visual: 'res://assets/Charset/Zombie/zombie.png' },
  { name: 'Skeleton', visual: 'res://assets/Charset/Skeleton/skeleton.png' },
  { name: 'Troll', visual: 'res://assets/Charset/Troll/troll.png' },
  { name: 'Demon', visual: 'res://assets/Charset/Demon/demon.png' },
  { name: 'Ant', visual: 'res://assets/Charset/Ant/ant.png' },
  { name: 'Black Ant', visual: 'res://assets/Charset/Ant/black_ant.png' },
  { name: 'Ice Ant', visual: 'res://assets/Charset/Ant/ice_ant.png' },
  { name: 'Wyvern', visual: 'res://assets/Charset/Wyvern/wyvern.png' }
];

async function main() {
  await initializeDatabase();

  // Use an admin/system user id for deck ownership.
  const userId = Number(process.env.SEED_USER_ID || 1);

  for (const spec of MONSTERS) {
    const existing = await monsterRepository.getTemplateByName(spec.name);
    if (!existing) {
      const id = await monsterService.createTemplate({
        user_id: userId,
        name: spec.name,
        difficulty: 'easy',
        visual: spec.visual
      });
      console.log(`✅ Created monster template: "${spec.name}" (id=${id}) visual=${spec.visual}`);
    } else {
      await monsterService.updateTemplate(existing.id, {
        user_id: userId,
        name: spec.name,
        visual: spec.visual
      });
      console.log(`🔁 Updated monster template: "${spec.name}" (id=${existing.id}) visual=${spec.visual}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ upsert-goblin-monsters failed:', err);
    process.exit(1);
  });

