const { createClient } = require('@libsql/client');
require('dotenv').config();

const runMigration = async () => {
  console.log('🚀 Starting price history migration...');
  
  try {
    const db = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
      authToken: process.env.TURSO_AUTH_TOKEN
    });
    
    console.log('✅ Database connected');

    // ============================================================
    // Check if price_history table exists and create it if not
    // ============================================================
    console.log('📊 Checking price_history table...');
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS price_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          part_id INTEGER NOT NULL,
          price REAL NOT NULL,
          quantity INTEGER DEFAULT 1,
          transaction_type TEXT NOT NULL DEFAULT 'MANUAL',
          reference_number TEXT,
          notes TEXT,
          recorded_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ price_history table created/verified');
    } catch (err) {
      console.log('⚠️ Error creating price_history:', err.message);
    }

    // ============================================================
    // Check if columns exist in parts table
    // ============================================================
    console.log('📊 Checking parts columns...');
    try {
      const columns = await db.execute(`PRAGMA table_info(parts)`);
      const columnNames = columns.rows.map(c => c.name);
      
      if (!columnNames.includes('current_price')) {
        await db.execute(`ALTER TABLE parts ADD COLUMN current_price REAL DEFAULT 0`);
        console.log('✅ current_price column added');
      } else {
        console.log('✅ current_price already exists');
      }
      
      if (!columnNames.includes('unit_price')) {
        await db.execute(`ALTER TABLE parts ADD COLUMN unit_price REAL DEFAULT 0`);
        console.log('✅ unit_price column added');
      } else {
        console.log('✅ unit_price already exists');
      }
      
      if (!columnNames.includes('updated_at')) {
        await db.execute(`ALTER TABLE parts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
        console.log('✅ updated_at column added');
      } else {
        console.log('✅ updated_at already exists');
      }
    } catch (err) {
      console.log('⚠️ Error checking columns:', err.message);
    }

    // ============================================================
    // Create indexes for performance
    // ============================================================
    console.log('📊 Creating indexes...');
    try {
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_price_history_part_id ON price_history(part_id)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON price_history(created_at DESC)`);
      console.log('✅ Indexes created');
    } catch (err) {
      console.log('⚠️ Error creating indexes:', err.message);
    }

    // ============================================================
    // Verify the table exists
    // ============================================================
    console.log('📊 Verifying price_history table...');
    const verify = await db.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='price_history'
    `);
    
    if (verify.rows.length > 0) {
      console.log('✅ price_history table verified successfully!');
      
      // Check how many records
      const count = await db.execute(`SELECT COUNT(*) as count FROM price_history`);
      console.log(`📊 price_history has ${count.rows[0].count} records`);
    } else {
      console.log('❌ price_history table not found!');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('📋 You can now use the price history feature.');
    
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    console.error('Stack:', err.stack);
  }
};

runMigration();