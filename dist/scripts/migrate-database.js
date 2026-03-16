"use strict";
/**
 * Script para adicionar a coluna effects na tabela cards
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const database_2 = __importDefault(require("../config/database"));
async function migrateDatabase() {
    try {
        console.log('🔄 Starting database migration...');
        // Initialize database
        await (0, database_1.initializeDatabase)();
        // Add effects column if it doesn't exist
        try {
            await database_2.default.exec(`ALTER TABLE cards ADD COLUMN effects TEXT`);
            console.log('✅ Added effects column to cards table');
        }
        catch (error) {
            if (error.message.includes('duplicate column name') || error.message.includes('already exists')) {
                console.log('⏭️  Effects column already exists');
            }
            else {
                throw error;
            }
        }
        const generalColumns = [
            { name: 'hero_power_text', sql: 'ALTER TABLE cards ADD COLUMN hero_power_text TEXT' },
            { name: 'hero_power_cost', sql: 'ALTER TABLE cards ADD COLUMN hero_power_cost INTEGER' },
            { name: 'hero_power_effect', sql: 'ALTER TABLE cards ADD COLUMN hero_power_effect TEXT' },
            { name: 'passive_effect', sql: 'ALTER TABLE cards ADD COLUMN passive_effect TEXT' }
        ];
        for (const col of generalColumns) {
            try {
                await database_2.default.exec(col.sql);
                console.log(`✅ Added column: ${col.name}`);
            }
            catch (err) {
                if (err.message?.includes('duplicate column name') || err.message?.includes('already exists')) {
                    console.log(`⏭️  Column ${col.name} already exists`);
                }
                else {
                    throw err;
                }
            }
        }
        console.log('✅ Database migration complete');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}
migrateDatabase();
//# sourceMappingURL=migrate-database.js.map