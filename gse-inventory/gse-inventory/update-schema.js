const { createClient } = require('@libsql/client');
require('dotenv').config();

// Database connection
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function updateSchema() {
  try {
    console.log('🔧 Updating database schema...\n');
    
    // Check current table structure
    console.log('📋 Checking current table structure...');
    const tableInfo = await db.execute("PRAGMA table_info(parts)");
    console.log('Current columns:', tableInfo.rows.map(r => r.name).join(', '));
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
      { name: 'compatible_gse', type: 'TEXT' },
      { name: 'location_bin', type: 'TEXT' },
      { name: 'min_stock', type: 'INTEGER DEFAULT 5' },
      { name: 'quantity_on_hand', type: 'INTEGER DEFAULT 0' },
      { name: 'max_stock', type: 'INTEGER DEFAULT 0' }
    ];
    
    for (const col of columnsToAdd) {
      try {
        await db.execute(`ALTER TABLE parts ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✅ Added column: ${col.name}`);
      } catch (e) {
        if (e.message.includes('duplicate column name')) {
          console.log(`ℹ️ Column ${col.name} already exists`);
        } else {
          console.log(`❌ Error adding ${col.name}:`, e.message);
        }
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