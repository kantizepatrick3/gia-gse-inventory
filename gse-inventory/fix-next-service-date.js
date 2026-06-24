const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function fixNextServiceDates() {
  try {
    console.log('🔧 Fixing next_service_date for existing records...\n');
    
    // Get all maintenance records without next_service_date
    const records = await db.execute(`
      SELECT id, equipment_name, last_service_date, service_interval_months 
      FROM gse_maintenance 
      WHERE next_service_date IS NULL OR next_service_date = ''
    `);
    
    console.log(`📊 Found ${records.rows.length} records without next_service_date\n`);
    
    if (records.rows.length === 0) {
      console.log('✅ All records already have next_service_date set!');
      return;
    }
    
    let fixed = 0;
    
    for (const record of records.rows) {
      const lastDate = record.last_service_date || new Date().toISOString().split('T')[0];
      const interval = parseInt(record.service_interval_months) || 6;
      
      const nextDate = new Date(lastDate);
      nextDate.setMonth(nextDate.getMonth() + interval);
      const next_service_date = nextDate.toISOString().split('T')[0];
      
      await db.execute({
        sql: `UPDATE gse_maintenance SET next_service_date = ? WHERE id = ?`,
        args: [next_service_date, record.id]
      });
      
      console.log(`✅ ${record.equipment_name}: next_service_date set to ${next_service_date}`);
      fixed++;
    }
    
    console.log(`\n✅ Fixed ${fixed} records`);
    
    // Verify the fix
    const remaining = await db.execute(`
      SELECT COUNT(*) as count FROM gse_maintenance 
      WHERE next_service_date IS NULL OR next_service_date = ''
    `);
    console.log(`📊 Remaining records without next_service_date: ${remaining.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixNextServiceDates().then(() => process.exit(0));