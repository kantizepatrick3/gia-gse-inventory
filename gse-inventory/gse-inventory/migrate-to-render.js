const { createClient } = require('@libsql/client');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://gse-inventory-2-giagambia.aws-eu-west-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE3NzA4NjYsImlkIjoiMDE5ZWQ5Y2UtODMwMS03ZTY5LTg5MTUtNzZkZGJhOWYxNzQ2IiwicmlkIjoiNTIzYmJmNzktZWZjYi00ZmMxLTk5MzYtNGY0MjhjZGVlNjlkIn0.dM9IJXN490vrYGCOJiG2yXpm2nYTGoMlKg38frLHyUof5Piho2QvtQb2X7znE6S_cHWgeCMepG_IvV4-RwqeAw'
});

async function migrateToRender() {
  try {
    console.log('🔄 Migrating data to deployed database...');
    
    // Check current count
    const countBefore = await db.execute('SELECT COUNT(*) as count FROM service_history');
    console.log(`📊 Records before migration: ${countBefore.rows[0].count}`);
    
    // Get all transactions for BAT-001
    const txns = await db.execute(`
      SELECT t.*, p.part_number, p.description as part_description 
      FROM transactions t
      JOIN parts p ON t.part_id = p.id
      WHERE p.part_number = 'BAT-001'
      ORDER BY t.created_at ASC
    `);
    
    console.log(`Found ${txns.rows.length} transactions for BAT-001`);
    
    // Get the maintenance_id for BAT-001
    const maint = await db.execute(`SELECT id FROM gse_maintenance WHERE equipment_name = 'BAT-001'`);
    if (maint.rows.length === 0) {
      console.log('No maintenance record found for BAT-001');
      return;
    }
    const maintenanceId = maint.rows[0].id;
    console.log(`Maintenance ID: ${maintenanceId}`);
    
    let inserted = 0;
    
    for (const txn of txns.rows) {
      const serviceDate = txn.created_at.split('T')[0];
      
      // Check if this date already exists in history
      const existing = await db.execute({
        sql: `SELECT id FROM service_history WHERE maintenance_id = ? AND service_date LIKE ?`,
        args: [maintenanceId, `%${serviceDate}%`]
      });
      
      if (existing.rows.length > 0) {
        console.log(`⏭️ Skipping ${serviceDate} - already in history`);
        continue;
      }
      
      let servicePerformed = txn.notes || 'Maintenance service';
      let technicianName = txn.created_by || 'admin';
      
      // Insert into service_history
      await db.execute({
        sql: `INSERT INTO service_history 
              (maintenance_id, equipment_name, equipment_type, maintenance_type,
               service_date, service_performed, technician_name, notes,
               maintenance_category, checklist_items, current_hours, target_hours,
               service_interval_months, service_interval_years, recorded_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          maintenanceId,
          'BAT-001',
          'Battery',
          'month',
          txn.created_at,
          servicePerformed,
          technicianName,
          `Transaction ID: ${txn.id} - ${txn.notes || ''}`,
          'preventive',
          JSON.stringify(['Service performed']),
          0,
          0,
          1,
          1,
          technicianName
        ]
      });
      inserted++;
      console.log(`✅ Inserted record for ${serviceDate}`);
    }
    
    const countAfter = await db.execute('SELECT COUNT(*) as count FROM service_history');
    console.log(`\n✅ Migration complete!`);
    console.log(`   - Inserted: ${inserted} records`);
    console.log(`   - Total records: ${countAfter.rows[0].count}`);
    
  } catch (err) {
    console.error('Error during migration:', err.message);
  }
}
migrateToRender();