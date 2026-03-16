"use strict";
/**
 * Script para importar cartas do arquivo JavaScript original para o banco de dados
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../config/database");
const card_repository_1 = __importDefault(require("../modules/cards/card.repository"));
async function importCardsFromJS() {
    try {
        console.log('🔄 Starting card import from JavaScript file...');
        // Initialize database
        await (0, database_1.initializeDatabase)();
        // Read the JavaScript file
        const jsFilePath = path_1.default.join(__dirname, '../../client/js/data/cards-database.js');
        const jsContent = fs_1.default.readFileSync(jsFilePath, 'utf-8');
        // Extract the CARDS_DATABASE array using regex
        // This is a simple approach - we'll eval it in a safe context
        const cardsMatch = jsContent.match(/export const CARDS_DATABASE = \[([\s\S]*?)\];/);
        if (!cardsMatch) {
            throw new Error('Could not find CARDS_DATABASE in file');
        }
        // Create a safe context to evaluate the cards
        const cardsArrayString = cardsMatch[1];
        // Replace the constants with their values
        let processedString = `[${cardsArrayString}]`;
        // Replace CARD_TYPES
        processedString = processedString.replace(/CARD_TYPES\.GENERAL/g, "'general'");
        processedString = processedString.replace(/CARD_TYPES\.DEFENDER/g, "'defender'");
        processedString = processedString.replace(/CARD_TYPES\.EQUIPMENT/g, "'equipment'");
        processedString = processedString.replace(/CARD_TYPES\.MOUNT/g, "'mount'");
        processedString = processedString.replace(/CARD_TYPES\.CONSUMABLE/g, "'consumable'");
        processedString = processedString.replace(/CARD_TYPES\.ABILITY/g, "'ability'");
        // Replace RACES
        processedString = processedString.replace(/RACES\.HUMAN/g, "'human'");
        processedString = processedString.replace(/RACES\.DEVA/g, "'deva'");
        processedString = processedString.replace(/RACES\.ORC/g, "'orc'");
        processedString = processedString.replace(/RACES\.DWARF/g, "'dwarf'");
        processedString = processedString.replace(/RACES\.ELF/g, "'elf'");
        // Replace CLASSES
        processedString = processedString.replace(/CLASSES\.WARRIOR/g, "'warrior'");
        processedString = processedString.replace(/CLASSES\.BARBARIAN/g, "'barbarian'");
        processedString = processedString.replace(/CLASSES\.DRUID/g, "'druid'");
        processedString = processedString.replace(/CLASSES\.ELEMENTALIST/g, "'elementalist'");
        processedString = processedString.replace(/CLASSES\.NECROMANCER/g, "'necromancer'");
        processedString = processedString.replace(/CLASSES\.ARCHER/g, "'archer'");
        processedString = processedString.replace(/CLASSES\.ASSASSIN/g, "'assassin'");
        processedString = processedString.replace(/CLASSES\.CHIVALRY/g, "'chivalry'");
        // Replace ABILITIES
        processedString = processedString.replace(/ABILITIES\.RUSH/g, "'rush'");
        processedString = processedString.replace(/ABILITIES\.TAUNT/g, "'taunt'");
        processedString = processedString.replace(/ABILITIES\.DIVINE_SHIELD/g, "'divine_shield'");
        processedString = processedString.replace(/ABILITIES\.LIFESTEAL/g, "'lifesteal'");
        processedString = processedString.replace(/ABILITIES\.CHARGE/g, "'charge'");
        processedString = processedString.replace(/ABILITIES\.DRAW_CARD/g, "'draw_card'");
        processedString = processedString.replace(/ABILITIES\.BUFF_ALL/g, "'buff_all'");
        processedString = processedString.replace(/ABILITIES\.DAMAGE_ALL/g, "'damage_all'");
        processedString = processedString.replace(/ABILITIES\.STEALTH/g, "'stealth'");
        processedString = processedString.replace(/ABILITIES\.REGENERATE/g, "'regenerate'");
        // Parse the JSON
        const cards = eval(processedString);
        console.log(`📊 Found ${cards.length} cards in JavaScript file`);
        // Get existing cards
        const existingCards = await card_repository_1.default.getAllCards();
        const existingCardIds = new Set(existingCards.map(c => c.id));
        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        // Process each card
        for (const card of cards) {
            try {
                // Prepare card data
                const cardData = {
                    id: card.id,
                    name: card.name,
                    type: card.type,
                    race: card.race || null,
                    class: card.class || undefined,
                    cost: card.cost,
                    attack: card.attack !== undefined ? card.attack : null,
                    defense: card.defense !== undefined ? card.defense : null,
                    abilities: card.abilities || [],
                    text: card.text,
                    rarity: card.rarity,
                    image_url: card.artPath || null,
                    effect: card.effect || undefined
                };
                if (existingCardIds.has(card.id)) {
                    // Update existing card
                    await card_repository_1.default.updateCard(card.id, cardData);
                    console.log(`  🔄 Updated: ${card.name} (${card.id})`);
                    updated++;
                }
                else {
                    // Insert new card
                    await card_repository_1.default.createCard(cardData);
                    console.log(`  ✅ Inserted: ${card.name} (${card.id})`);
                    inserted++;
                }
            }
            catch (error) {
                console.error(`  ❌ Error processing card ${card.id}:`, error.message);
                skipped++;
            }
        }
        console.log(`
╔════════════════════════════════════════════╗
║   Card Import Complete!                    ║
║                                            ║
║   ✅ Inserted: ${inserted.toString().padEnd(28)}║
║   🔄 Updated: ${updated.toString().padEnd(29)}║
║   ⏭️  Skipped: ${skipped.toString().padEnd(29)}║
║   📊 Total: ${cards.length.toString().padEnd(32)}║
║                                            ║
╚════════════════════════════════════════════╝
    `);
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    }
}
importCardsFromJS();
//# sourceMappingURL=import-cards-from-js.js.map