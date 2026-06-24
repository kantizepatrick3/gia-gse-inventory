const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function updateSchema() {
  try {
    console.log('🔧 Adding missing timestamp columns...\n');
    
    // Check current table structure
    const tableInfo = await db.execute("PRAGMA table_info(parts)");
    console.log('Current columns:', tableInfo.rows.map(r => r.name).join(', '));
    console.log('');
    
    // Add created_at column if it doesn't exist
    try {
      await db.execute(`ALTER TABLE parts ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
      console.log('✅ Added column: created_at');
    } catch (e) {
      if (e.message.includes('duplicate column name')) {
        console.log('ℹ️ Column created_at already exists');
      } else {
        console.log('⚠️ Error adding created_at:', e.message);
      }
    }
    
    // Add updated_at column if it doesn't exist
    try {
      await db.execute(`ALTER TABLE parts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
      console.log('✅ Added column: updated_at');
    } catch (e) {
      if (e.message.includes('duplicate column name')) {
        console.log('ℹ️ Column updated_at already exists');
      } else {
        console.log('⚠️ Error adding updated_at:', e.message);
      }
    }
    
    console.log('\n📋 Updated table structure:');
    const updatedInfo = await db.execute("PRAGMA table_info(parts)");
    console.log('Columns now:', updatedInfo.rows.map(r => r.name).join(', '));
    
    console.log('\n✅ Schema update complete!');
    
  } catch (error) {
    console.error('❌ Schema update failed:', error.message);
  }
}

updateSchema().then(() => process.exit(0));