const { createClient } = require('@libsql/client');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://gse-inventory-2-giagambia.aws-eu-west-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE3NzA4NjYsImlkIjoiMDE5ZWQ5Y2UtODMwMS03ZTY5LTg5MTUtNzZkZGJhOWYxNzQ2IiwicmlkIjoiNTIzYmJmNzktZWZjYi00ZmMxLTk5MzYtNGY0MjhjZGVlNjlkIn0.dM9IJXN490vrYGCOJiG2yXpm2nYTGoMlKg38frLHyUof5Piho2QvtQb2X7znE6S_cHWgeCMepG_IvV4-RwqeAw'
});

async function migrateHistory() {
  try {
    console.log('🔄 Starting migration...');
    
    // Get all transactions for BAT-001
    const txns = await db.execute(`
      SELECT t.*, p.part_number, p.description as part_description 
      FROM transactions t
      JOIN parts p ON t.part_id = p.id
      WHERE p.part_number = 'BAT-001'
      ORDER BY t.created_at ASC
    `);
    
    console.log(`Found ${txns.rows.length} transactions for BAT-001`);
    
    if (txns.rows.length === 0) {
      console.log('No transactions found to migrate');
      return;
    }
    
    // Get the maintenance_id for BAT-001
    const maint = await db.execute(`SELECT id FROM gse_maintenance WHERE equipment_name = 'BAT-001'`);
    if (maint.rows.length === 0) {
      console.log('No maintenance record found for BAT-001');
      return;
    }
    const maintenanceId = maint.rows[0].id;
    console.log(`Maintenance ID: ${maintenanceId}`);
    
    // First, check what's already in history
    const existingHistory = await db.execute({
      sql: `SELECT service_date FROM service_history WHERE maintenance_id = ?`,
      args: [maintenanceId]
    });
    const existingDates = existingHistory.rows.map(r => r.service_date);
    console.log(`Existing history records: ${existingHistory.rows.length}`);
    
    let inserted = 0;
    let skipped = 0;
    
    for (const txn of txns.rows) {
      const serviceDate = txn.created_at.split('T')[0];
      
      // Check if this date already exists in history
      if (existingDates.includes(serviceDate)) {
        console.log(`⏭️ Skipping ${serviceDate} - already in history`);
        skipped++;
        continue;
      }
      
      // Get the service description from the transaction
      let servicePerformed = txn.notes || 'Maintenance service';
      let technicianName = txn.created_by || 'admin';
      
      // Try to extract details from notes
      if (txn.notes && txn.notes.includes('Service:')) {
        const match = txn.notes.match(/Service:\s*([^,]+)/);
        if (match) servicePerformed = match[1].trim();
      }
      
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
          serviceDate,
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
      console.log(`✅ Inserted record for ${serviceDate} - ${servicePerformed}`);
    }
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   - Inserted: ${inserted} records`);
    console.log(`   - Skipped: ${skipped} records (already exist)`);
    
    // Verify final count
    const finalCount = await db.execute(`SELECT COUNT(*) as count FROM service_history WHERE maintenance_id = ?`, [maintenanceId]);
    console.log(`   - Total records for BAT-001: ${finalCount.rows[0].count}`);
    
  } catch (err) {
    console.error('Error during migration:', err.message);
    console.error(err.stack);
  }
}
migrateHistory();