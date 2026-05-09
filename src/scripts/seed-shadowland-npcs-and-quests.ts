import { initializeDatabase } from '../config/database';
import { seedShadowlandNpcsAndQuests } from '../modules/quests/shadowland-quest.seed';

async function main() {
  await initializeDatabase();

  const result = await seedShadowlandNpcsAndQuests();
  console.log(
    `✅ Seed Shadowland NPCs/Quests complete: npcs(created=${result.npcs.created}, updated=${result.npcs.updated}, total=${result.npcs.total}) quests(created=${result.quests.created}, updated=${result.quests.updated}, total=${result.quests.total})`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ seed-shadowland-npcs-and-quests failed:', err);
    process.exit(1);
  });

