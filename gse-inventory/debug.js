const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkDatabase() {
  try {
    // Get ALL records, not just sample data
    const result = await db.execute(`
      SELECT 
        id, 
        equipment_name, 
        last_service_date_text, 
        service_interval_months, 
        next_service_date_text 
      FROM gse_maintenance 
      ORDER BY id
    `);
    
    console.log('\n🔍 DATABASE CHECK - ALL RECORDS');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('ID | Equipment           | Last Service | Interval | Next Service');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    
    let hasNull = 0;
    for (const row of result.rows) {
      const nextDate = row.next_service_date_text || 'NULL';
      if (row.next_service_date_text === null) hasNull++;
      console.log(`${String(row.id).padEnd(3)} | ${String(row.equipment_name || '').padEnd(20)} | ${String(row.last_service_date_text || 'NULL').padEnd(13)} | ${String(row.service_interval_months || 'NULL').padEnd(8)} | ${nextDate}`);
    }
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(`\n📊 Total records: ${result.rows.length}`);
    console.log(`⚠️ Records with NULL next_service_date: ${hasNull}`);
    
    if (hasNull === 0) {
      console.log('\n✅ All records have next_service_date!');
    } else {
      console.log(`\n❌ ${hasNull} records need next_service_date set.`);
    }
    
    // Specifically check for JHJKKK
    const jhjkkk = await db.execute({
      sql: "SELECT * FROM gse_maintenance WHERE equipment_name LIKE '%JHJKKK%' OR equipment_name LIKE '%JH%'"
    });
    if (jhjkkk.rows.length > 0) {
      console.log('\n🔍 Found JHJKKK:');
      console.log(jhjkkk.rows[0]);
    } else {
      console.log('\n❌ JHJKKK not found in database!');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkDatabase();