const { createClient } = require('@libsql/client');
require('dotenv').config();

// This will use your production database (Render)
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function migrateProduction() {
  try {
    console.log('🔧 Migrating production database...\n');
    
    // Check current columns
    const tableInfo = await db.execute("PRAGMA table_info(parts)");
    const columns = tableInfo.rows.map(r => r.name);
    console.log('📋 Current columns:', columns.join(', '));
    console.log('');
    
    // Add missing columns one by one
    const columnsToAdd = [
      { name: 'unit_price', type: 'REAL DEFAULT 0' },
      { name: 'current_price', type: 'REAL DEFAULT 0' },
      { name: 'average_cost', type: 'REAL DEFAULT 0' },
      { name: 'last_purchase_price', type: 'REAL DEFAULT 0' },
      { name: 'maintenance_type', type: 'TEXT DEFAULT "none"' },
      { name: 'service_interval_hours', type: 'INTEGER DEFAULT 0' },
      { name: 'service_interval_months', type: 'INTEGER DEFAULT 0' },
      { name: 'service_interval_years', type: 'INTEGER DEFAULT 0' },
      { name: 'contact_person', type: 'TEXT' },
      { name: 'contact_phone', type: 'TEXT' },
      { name: 'contact_email', type: 'TEXT' },
      { name: 'max_stock', type: 'INTEGER DEFAULT 0' },
      { name: 'created_at', type: 'DATETIME' },
      { name: 'updated_at', type: 'DATETIME' }
    ];
    
    let added = 0;
    for (const col of columnsToAdd) {
      if (!columns.includes(col.name)) {
        try {
          await db.execute(`ALTER TABLE parts ADD COLUMN ${col.name} ${col.type}`);
          console.log(`✅ Added column: ${col.name}`);
          added++;
        } catch (e) {
          console.log(`⚠️ Could not add ${col.name}: ${e.message}`);
        }
      } else {
        console.log(`ℹ️ Column ${col.name} already exists`);
      }
    }
    
    console.log(`\n✅ Added ${added} new columns`);
    
    // Show updated structure
    const updatedInfo = await db.execute("PRAGMA table_info(parts)");
    console.log('\n📋 Updated columns:', updatedInfo.rows.map(r => r.name).join(', '));
    
    // Update existing records with default values
    console.log('\n🔄 Updating existing records...');
    try {
      await db.execute(`UPDATE parts SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL`);
      await db.execute(`UPDATE parts SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`);
      console.log('✅ Updated timestamps for existing records');
    } catch (e) {
      console.log('⚠️ Could not update timestamps:', e.message);
    }
    
    console.log('\n✅ Production database migration complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
  }
}

migrateProduction().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
});