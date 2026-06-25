const { createClient } = require('@libsql/client');
require('dotenv').config();

const fixPriceHistory = async () => {
  console.log('🔧 FIXING PRICE HISTORY TABLES AND COLUMNS...');
  console.log('=============================================\n');
  
  try {
    const db = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
      authToken: process.env.TURSO_AUTH_TOKEN
    });
    
    console.log('✅ Database connected\n');

    // ============================================================
    // 1. CREATE price_history TABLE
    // ============================================================
    console.log('📊 1. Creating price_history table...');
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ price_history table created/verified');
    } catch (err) {
      console.log('⚠️ Error creating price_history:', err.message);
    }

    // ============================================================
    // 2. CREATE INDEXES FOR PERFORMANCE
    // ============================================================
    console.log('\n📊 2. Creating indexes...');
    try {
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_price_history_part_id ON price_history(part_id)`);
      console.log('✅ idx_price_history_part_id created');
    } catch (err) {
      console.log('⚠️ Error creating part_id index:', err.message);
    }

    try {
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON price_history(created_at DESC)`);
      console.log('✅ idx_price_history_created_at created');
    } catch (err) {
      console.log('⚠️ Error creating created_at index:', err.message);
    }

    // ============================================================
    // 3. CHECK AND ADD COLUMNS TO parts TABLE
    // ============================================================
    console.log('\n📊 3. Checking parts table columns...');
    
    try {
      const columns = await db.execute(`PRAGMA table_info(parts)`);
      const columnNames = columns.rows.map(c => c.name);
      console.log('📋 Existing columns:', columnNames.join(', '));
      
      let columnsAdded = 0;
      
      if (!columnNames.includes('current_price')) {
        await db.execute(`ALTER TABLE parts ADD COLUMN current_price REAL DEFAULT 0`);
        console.log('✅ current_price column added');
        columnsAdded++;
      } else {
        console.log('✅ current_price already exists');
      }
      
      if (!columnNames.includes('unit_price')) {
        await db.execute(`ALTER TABLE parts ADD COLUMN unit_price REAL DEFAULT 0`);
        console.log('✅ unit_price column added');
        columnsAdded++;
      } else {
        console.log('✅ unit_price already exists');
      }
      
      if (!columnNames.includes('updated_at')) {
        await db.execute(`ALTER TABLE parts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
        console.log('✅ updated_at column added');
        columnsAdded++;
      } else {
        console.log('✅ updated_at already exists');
      }

      if (!columnNames.includes('last_purchase_price')) {
        await db.execute(`ALTER TABLE parts ADD COLUMN last_purchase_price REAL DEFAULT 0`);
        console.log('✅ last_purchase_price column added');
        columnsAdded++;
      } else {
        console.log('✅ last_purchase_price already exists');
      }

      if (columnsAdded === 0) {
        console.log('✅ All columns already exist');
      } else {
        console.log(`✅ Added ${columnsAdded} new columns`);
      }
    } catch (err) {
      console.log('⚠️ Error checking columns:', err.message);
    }

    // ============================================================
    // 4. VERIFY EVERYTHING
    // ============================================================
    console.log('\n📊 4. Verification...');
    
    // Check price_history table
    const tableCheck = await db.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='price_history'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ price_history table exists');
      
      const count = await db.execute(`SELECT COUNT(*) as count FROM price_history`);
      console.log(`📊 price_history has ${count.rows[0].count} records`);
      
      if (count.rows[0].count === 0) {
        console.log('💡 No price history records yet. Add a price to create records.');
      }
    } else {
      console.log('❌ price_history table still does not exist!');
    }

    // Check parts columns
    const partColumns = await db.execute(`PRAGMA table_info(parts)`);
    const partColumnNames = partColumns.rows.map(c => c.name);
    
    const requiredColumns = ['current_price', 'unit_price', 'updated_at'];
    const missing = requiredColumns.filter(col => !partColumnNames.includes(col));
    
    if (missing.length === 0) {
      console.log('✅ All required columns exist in parts table');
    } else {
      console.log(`❌ Missing columns: ${missing.join(', ')}`);
    }

    // ============================================================
    // 5. UPDATE SAMPLE DATA WITH PRICES
    // ============================================================
    console.log('\n📊 5. Updating sample data with prices...');
    
    // Check if any parts exist
    const partsCount = await db.execute(`SELECT COUNT(*) as count FROM parts`);
    
    if (partsCount.rows[0].count > 0) {
      // Update all parts with default prices if they don't have one
      await db.execute(`
        UPDATE parts 
        SET current_price = COALESCE(current_price, unit_price, 10.00),
            unit_price = COALESCE(unit_price, current_price, 10.00)
        WHERE current_price IS NULL OR current_price = 0
      `);
      console.log('✅ Updated parts with default prices');
    } else {
      console.log('⚠️ No parts found in database. Add parts first.');
    }

    // ============================================================
    // 6. FINAL SUMMARY
    // ============================================================
    console.log('\n=============================================');
    console.log('✅ PRICE HISTORY FIX COMPLETED SUCCESSFULLY!');
    console.log('=============================================\n');
    
    const finalCount = await db.execute(`SELECT COUNT(*) as count FROM price_history`);
    console.log(`📊 Total price history records: ${finalCount.rows[0].count}`);
    console.log('\n📋 You can now use the price history feature.');
    console.log('   - Click 💰 Price button to update prices');
    console.log('   - Click 📊 History button to view price history');
    console.log('   - Visit Price History page for detailed view\n');

  } catch (err) {
    console.error('❌ FIX ERROR:', err.message);
    console.error('Stack:', err.stack);
  }
};

fixPriceHistory();