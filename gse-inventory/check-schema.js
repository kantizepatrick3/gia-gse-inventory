const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkSchema() {
  try {
    // Get all columns in gse_maintenance
    const pragma = await db.execute('PRAGMA table_info(gse_maintenance)');
    console.log('\n📋 Columns in gse_maintenance:');
    console.log('═══════════════════════════════════');
    pragma.rows.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
    
    // Find date columns
    const columns = pragma.rows.map(r => r.name);
    const lastDateCol = columns.find(c => c.includes('last_service_date'));
    const nextDateCol = columns.find(c => c.includes('next_service_date'));
    
    console.log('\n📅 Date columns found:');
    console.log(`  Last Service Date: ${lastDateCol || 'NOT FOUND'}`);
    console.log(`  Next Service Date: ${nextDateCol || 'NOT FOUND'}`);
    
    // Get all equipment
    const result = await db.execute('SELECT id, equipment_name, * FROM gse_maintenance');
    console.log('\n📊 All Equipment:');
    console.log('═══════════════════════════════════');
    result.rows.forEach(row => {
      console.log(`  ${row.id}. ${row.equipment_name}`);
    });
    
    // Check JHJKKK specifically
    const jhjkkk = await db.execute({
      sql: "SELECT * FROM gse_maintenance WHERE equipment_name = 'JHJKKK'"
    });
    
    if (jhjkkk.rows.length > 0) {
      console.log('\n🔍 JHJKKK Record:');
      console.log('═══════════════════════════════════');
      const data = jhjkkk.rows[0];
      console.log(`  ID: ${data.id}`);
      console.log(`  Equipment: ${data.equipment_name}`);
      console.log(`  Last Service Date: ${data[lastDateCol] || 'NULL'}`);
      console.log(`  Next Service Date: ${data[nextDateCol] || 'NULL'}`);
      console.log(`  Service Interval Months: ${data.service_interval_months || 'NULL'}`);
      console.log(`  Maintenance Type: ${data.maintenance_type || 'NULL'}`);
    } else {
      console.log('\n❌ JHJKKK not found in database!');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkSchema();