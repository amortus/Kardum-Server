/**
 * Script de migração das cartas do cards-database.js para o banco de dados
 */

import { initializeDatabase } from '../config/database';
import cardRepository from '../modules/cards/card.repository';
import { Card, CardType, Race, Class, Ability, Rarity } from '../shared/types';

// Importar dados das cartas do arquivo JavaScript
const CARDS_DATABASE: any[] = [];

// GENERALS
CARDS_DATABASE.push({
  id: 'gen_absalon',
  name: 'Absalon, Rei Guerreiro',
  type: CardType.GENERAL,
  race: Race.HUMAN,
  class: Class.WARRIOR,
  cost: 0,
  attack: 0,
  defense: 30,
  abilities: [],
  text: 'General Humano. Líder indomável das forças humanas.',
  rarity: Rarity.LEGENDARY
});

CARDS_DATABASE.push({
  id: 'gen_griven',
  name: 'Griven Belafonte',
  type: CardType.GENERAL,
  race: Race.HUMAN,
  class: Class.CHIVALRY,
  cost: 0,
  attack: 0,
  defense: 30,
  abilities: [],
  text: 'General Humano. Cavaleiro da ordem sagrada.',
  rarity: Rarity.LEGENDARY,
  hero_power_text: 'Cura 2 de vida ao seu General.',
  hero_power_cost: 2,
  hero_power_effect: { type: 'heal', amount: 2 }
});

CARDS_DATABASE.push({
  id: 'gen_ivin',
  name: 'Ivin Melfor',
  type: CardType.GENERAL,
  race: Race.ELF,
  class: Class.ARCHER,
  cost: 0,
  attack: 0,
  defense: 30,
  abilities: [],
  text: 'General Élfico. Mestre arqueiro das florestas antigas.',
  rarity: Rarity.LEGENDARY
});

CARDS_DATABASE.push({
  id: 'gen_lysandra',
  name: 'Lysandra, Luz Celestial',
  type: CardType.GENERAL,
  race: Race.DEVA,
  class: Class.CHIVALRY,
  cost: 0,
  attack: 0,
  defense: 30,
  abilities: [Ability.DIVINE_SHIELD],
  text: 'General Deva. Anjo guerreiro com escudo divino.',
  rarity: Rarity.LEGENDARY
});

CARDS_DATABASE.push({
  id: 'gen_grommash',
  name: 'Grommash Grito Infernal',
  type: CardType.GENERAL,
  race: Race.ORC,
  class: Class.BARBARIAN,
  cost: 0,
  attack: 0,
  defense: 30,
  abilities: [],
  text: 'General Orc. Senhor da guerra brutal e implacável.',
  rarity: Rarity.LEGENDARY
});

CARDS_DATABASE.push({
  id: 'gen_thorin',
  name: 'Thorin Martelo de Pedra',
  type: CardType.GENERAL,
  race: Race.DWARF,
  class: Class.WARRIOR,
  cost: 0,
  attack: 0,
  defense: 30,
  abilities: [],
  text: 'General Anão. Mestre ferreiro e guardião das montanhas.',
  rarity: Rarity.LEGENDARY
});

// DEFENDERS - HUMANOS
CARDS_DATABASE.push({
  id: 'def_h001',
  name: 'Recruta da Guarda',
  type: CardType.DEFENDER,
  race: Race.HUMAN,
  cost: 1,
  attack: 1,
  defense: 2,
  abilities: [],
  text: 'Soldado básico. Jovem e determinado.',
  rarity: Rarity.COMMON
});

CARDS_DATABASE.push({
  id: 'def_h002',
  name: 'Lanceiro Veterano',
  type: CardType.DEFENDER,
  race: Race.HUMAN,
  cost: 2,
  attack: 2,
  defense: 3,
  abilities: [],
  text: 'Guerreiro experiente com lança longa.',
  rarity: Rarity.COMMON
});

CARDS_DATABASE.push({
  id: 'def_h003',
  name: 'Cavaleiro Real',
  type: CardType.DEFENDER,
  race: Race.HUMAN,
  cost: 3,
  attack: 3,
  defense: 3,
  abilities: [],
  text: 'Cavaleiro montado da ordem real.',
  rarity: Rarity.COMMON
});

CARDS_DATABASE.push({
  id: 'def_h004',
  name: 'Paladino Sagrado',
  type: CardType.DEFENDER,
  race: Race.HUMAN,
  cost: 4,
  attack: 3,
  defense: 5,
  abilities: [Ability.DIVINE_SHIELD],
  text: 'Guerreiro santo. Imune ao primeiro dano.',
  rarity: Rarity.RARE
});

CARDS_DATABASE.push({
  id: 'def_h005',
  name: 'Campeão do Reino',
  type: CardType.DEFENDER,
  race: Race.HUMAN,
  cost: 5,
  attack: 5,
  defense: 5,
  abilities: [],
  text: 'Elite do exército. Temido em batalha.',
  rarity: Rarity.EPIC
});

CARDS_DATABASE.push({
  id: 'def_h006',
  name: 'Clérigo Curador',
  type: CardType.DEFENDER,
  race: Race.HUMAN,
  cost: 3,
  attack: 1,
  defense: 4,
  abilities: [Ability.LIFESTEAL],
  text: 'Cura ao causar dano.',
  rarity: Rarity.RARE
});

CARDS_DATABASE.push({
  id: 'def_h007',
  name: 'Guardião da Muralha',
  type: CardType.DEFENDER,
  race: Race.HUMAN,
  cost: 4,
  attack: 2,
  defense: 7,
  abilities: [Ability.TAUNT],
  text: 'Deve ser alvo de ataques. Defesa impenetrável.',
  rarity: Rarity.RARE
});

// DEFENDERS - ELFOS
CARDS_DATABASE.push({
  id: 'def_e001',
  name: 'Sentinela Élfico',
  type: CardType.DEFENDER,
  race: Race.ELF,
  cost: 1,
  attack: 2,
  defense: 1,
  abilities: [],
  text: 'Guardião ágil. Ataque rápido.',
  rarity: Rarity.COMMON
});

CARDS_DATABASE.push({
  id: 'def_e002',
  name: 'Arqueiro Florestal',
  type: CardType.DEFENDER,
  race: Race.ELF,
  cost: 2,
  attack: 3,
  defense: 2,
  abilities: [],
  text: 'Arqueiro preciso das florestas.',
  rarity: Rarity.COMMON
});

CARDS_DATABASE.push({
  id: 'def_e003',
  name: 'Guardião da Natureza',
  type: CardType.DEFENDER,
  race: Race.ELF,
  cost: 3,
  attack: 2,
  defense: 5,
  abilities: [Ability.TAUNT],
  text: 'Protetor das árvores antigas. Taunt.',
  rarity: Rarity.RARE
});

CARDS_DATABASE.push({
  id: 'def_e004',
  name: 'Mestre Arqueiro',
  type: CardType.DEFENDER,
  race: Race.ELF,
  cost: 4,
  attack: 5,
  defense: 3,
  abilities: [],
  text: 'Lendário com o arco. Precisão mortal.',
  rarity: Rarity.EPIC
});

CARDS_DATABASE.push({
  id: 'def_e005',
  name: 'Ancião Druida',
  type: CardType.DEFENDER,
  race: Race.ELF,
  cost: 5,
  attack: 2,
  defense: 6,
  abilities: [Ability.LIFESTEAL],
  text: 'Sabedoria ancestral. Cura ao atacar.',
  rarity: Rarity.EPIC
});

// EQUIPAMENTOS - HUMANOS
CARDS_DATABASE.push({
  id: 'eq_h001',
  name: 'Espada Longa',
  type: CardType.EQUIPMENT,
  race: Race.HUMAN,
  cost: 2,
  attack: 2,
  defense: 0,
  abilities: [],
  text: '+2 Ataque.',
  rarity: Rarity.COMMON
});

CARDS_DATABASE.push({
  id: 'eq_h002',
  name: 'Escudo Real',
  type: CardType.EQUIPMENT,
  race: Race.HUMAN,
  cost: 2,
  attack: 0,
  defense: 3,
  abilities: [],
  text: '+3 Defesa.',
  rarity: Rarity.COMMON
});

// CONSUMÍVEIS
CARDS_DATABASE.push({
  id: 'con_001',
  name: 'Poção de Cura Menor',
  type: CardType.CONSUMABLE,
  race: null,
  cost: 1,
  attack: 0,
  defense: 0,
  abilities: [],
  text: 'Restaura 3 de vida ao General.',
  rarity: Rarity.COMMON,
  effect: { type: 'heal', target: 'self_general', amount: 3 }
});

CARDS_DATABASE.push({
  id: 'con_002',
  name: 'Poção de Cura',
  type: CardType.CONSUMABLE,
  race: null,
  cost: 2,
  attack: 0,
  defense: 0,
  abilities: [],
  text: 'Restaura 5 de vida ao General.',
  rarity: Rarity.COMMON,
  effect: { type: 'heal', target: 'self_general', amount: 5 }
});

async function migrateCards() {
  try {
    console.log('🔄 Starting card migration...');
    
    // Initialize database
    await initializeDatabase();
    
    // Get existing cards
    const existingCards = await cardRepository.getAllCards();
    const existingCardIds = new Set(existingCards.map(c => c.id));
    
    let inserted = 0;
    let skipped = 0;
    
    let updated = 0;
    // Insert or update cards
    for (const card of CARDS_DATABASE) {
      const hasHeroPower = (card as any).hero_power_text != null || (card as any).hero_power_cost != null;
      if (existingCardIds.has(card.id)) {
        if (hasHeroPower) {
          const existing = await cardRepository.getCardById(card.id);
          if (existing) {
            await cardRepository.updateCard(card.id, {
              ...existing,
              hero_power_text: (card as any).hero_power_text ?? existing.hero_power_text,
              hero_power_cost: (card as any).hero_power_cost ?? existing.hero_power_cost,
              hero_power_effect: (card as any).hero_power_effect ?? existing.hero_power_effect,
              passive_effect: (card as any).passive_effect ?? existing.passive_effect
            });
            console.log(`  🔄 Updated (hero power): ${card.name} (${card.id})`);
            updated++;
          } else {
            skipped++;
          }
        } else {
          console.log(`  ⏭️  Skipping existing card: ${card.name}`);
          skipped++;
        }
        continue;
      }

      await cardRepository.createCard(card as Card);
      console.log(`  ✅ Inserted: ${card.name} (${card.id})`);
      inserted++;
    }
    
    console.log(`
╔═══════════════════════════════════════╗
║   Card Migration Complete!            ║
║                                       ║
║   ✅ Inserted: ${inserted.toString().padEnd(23)}║
║   🔄 Updated: ${updated.toString().padEnd(24)}║
║   ⏭️  Skipped: ${skipped.toString().padEnd(24)}║
║   📊 Total in DB: ${(inserted + existingCards.length).toString().padEnd(18)}║
║                                       ║
╚═══════════════════════════════════════╝
    `);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateCards();
