/**
 * Script para adicionar a coluna effects na tabela cards
 */

import { initializeDatabase } from '../config/database';
import dbHelpers from '../config/database';

async function migrateDatabase() {
  try {
    console.log('🔄 Starting database migration...');
    
    // Initialize database
    await initializeDatabase();
    
    // Add effects column if it doesn't exist
    try {
      await dbHelpers.exec(`ALTER TABLE cards ADD COLUMN effects TEXT`);
      console.log('✅ Added effects column to cards table');
    } catch (error: any) {
      if (error.message.includes('duplicate column name') || error.message.includes('already exists')) {
        console.log('⏭️  Effects column already exists');
      } else {
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
        await dbHelpers.exec(col.sql);
        console.log(`✅ Added column: ${col.name}`);
      } catch (err: any) {
        if (err.message?.includes('duplicate column name') || err.message?.includes('already exists')) {
          console.log(`⏭️  Column ${col.name} already exists`);
        } else {
          throw err;
        }
      }
    }
    
    console.log('✅ Database migration complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateDatabase();
