const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkImport() {
  try {
    console.log('\n📋 All Parts in Database:\n');
    console.log('='.repeat(100));
    console.log('Part Number   | Description                 | Stock | Price      | Maintenance Type');
    console.log('='.repeat(100));
    
    const result = await db.execute('SELECT part_number, description, quantity_on_hand, unit_price, maintenance_type FROM parts ORDER BY part_number');
    
    if (result.rows.length === 0) {
      console.log('⚠️ No parts found in database');
      return;
    }
    
    let totalValue = 0;
    
    for (const row of result.rows) {
      const partNum = String(row.part_number || '').padEnd(12);
      const desc = String(row.description || '').substring(0, 25).padEnd(25);
      const stock = String(row.quantity_on_hand || 0).padEnd(5);
      const price = parseFloat(row.unit_price || 0);
      const priceStr = `$${price.toFixed(2)}`.padEnd(10);
      const type = row.maintenance_type || 'none';
      const value = price * (row.quantity_on_hand || 0);
      totalValue += value;
      
      console.log(`${partNum} | ${desc} | ${stock} | ${priceStr} | ${type}`);
    }
    
    console.log('='.repeat(100));
    console.log(`✅ Total Parts: ${result.rows.length}`);
    console.log(`💰 Total Inventory Value: $${totalValue.toFixed(2)}`);
    
    // Check maintenance records
    const maintCount = await db.execute('SELECT COUNT(*) as count FROM gse_maintenance');
    console.log(`📊 Maintenance Records: ${maintCount.rows[0].count}`);
    
    // Show maintenance types breakdown
    const typeCount = await db.execute(`
      SELECT maintenance_type, COUNT(*) as count 
      FROM parts 
      GROUP BY maintenance_type
    `);
    console.log('\n📋 Maintenance Type Breakdown:');
    for (const row of typeCount.rows) {
      const type = row.maintenance_type || 'none';
      console.log(`   ${type}: ${row.count} parts`);
    }
    
    // Show low stock items
    const lowStock = await db.execute(`
      SELECT part_number, description, quantity_on_hand, min_stock 
      FROM parts 
      WHERE quantity_on_hand <= min_stock
    `);
    
    if (lowStock.rows.length > 0) {
      console.log('\n⚠️ Low Stock Items (Quantity <= Min Stock):');
      console.log('='.repeat(60));
      for (const row of lowStock.rows) {
        console.log(`   ${row.part_number}: ${row.quantity_on_hand} (Min: ${row.min_stock}) - ${row.description}`);
      }
      console.log('='.repeat(60));
    } else {
      console.log('\n✅ No low stock items found.');
    }
    
  } catch (error) {
    console.error('❌ Error checking import:', error.message);
  }
}

checkImport().then(() => {
  console.log('\n✅ Check completed');
  process.exit(0);
});