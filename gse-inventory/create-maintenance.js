const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function createMaintenanceRecords() {
  try {
    console.log('🔧 Creating maintenance records for parts...\n');

    const today = new Date().toISOString().split('T')[0];

    // Get all parts with maintenance type
    const parts = await db.execute(`
      SELECT id, part_number, manufacturer, maintenance_type, 
             service_interval_hours, service_interval_months, service_interval_years
      FROM parts 
      WHERE maintenance_type != 'none'
    `);

    console.log(`📊 Found ${parts.rows.length} parts with maintenance requirements\n`);

    let created = 0;
    let skipped = 0;

    for (const part of parts.rows) {
      // Check if maintenance record already exists
      const existing = await db.execute({
        sql: 'SELECT id FROM gse_maintenance WHERE part_id = ?',
        args: [part.id]
      });

      if (existing.rows.length > 0) {
        console.log(`⏭️ Skipping ${part.part_number} - maintenance record already exists`);
        skipped++;
        continue;
      }

      console.log(`📝 Creating maintenance for: ${part.part_number}`);

      if (part.maintenance_type === 'year') {
        await db.execute({
          sql: `INSERT INTO gse_maintenance (
            equipment_name, equipment_type, maintenance_type, part_id,
            last_service_full_date, service_interval_years, status,
            created_by, created_at, updated_at
          ) VALUES (?, ?, 'year', ?, ?, ?, 'serviced', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          args: [part.part_number, part.manufacturer || 'GSE Part', part.id, today, part.service_interval_years || 1]
        });
        console.log(`   ✅ Created year-based maintenance for ${part.part_number}`);
      } else if (part.maintenance_type === 'month') {
        await db.execute({
          sql: `INSERT INTO gse_maintenance (
            equipment_name, equipment_type, maintenance_type, part_id,
            last_service_date, service_interval_months, status,
            created_by, created_at, updated_at
          ) VALUES (?, ?, 'month', ?, ?, ?, 'serviced', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          args: [part.part_number, part.manufacturer || 'GSE Part', part.id, today, part.service_interval_months || 6]
        });
        console.log(`   ✅ Created month-based maintenance for ${part.part_number}`);
      } else if (part.maintenance_type === 'hour') {
        const hours = part.service_interval_hours || 250;
        await db.execute({
          sql: `INSERT INTO gse_maintenance (
            equipment_name, equipment_type, maintenance_type, part_id,
            last_service_date, service_interval_hours, target_hours,
            status, created_by, created_at, updated_at
          ) VALUES (?, ?, 'hour', ?, ?, ?, ?, 'serviced', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          args: [part.part_number, part.manufacturer || 'GSE Part', part.id, today, hours, hours]
        });
        console.log(`   ✅ Created hour-based maintenance for ${part.part_number}`);
      }

      created++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 MAINTENANCE RECORDS CREATED');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${created} maintenance records`);
    console.log(`⏭️ Skipped: ${skipped} (already exist)`);
    console.log('='.repeat(60));

    // Show summary
    const summary = await db.execute(`
      SELECT maintenance_type, COUNT(*) as count 
      FROM gse_maintenance 
      GROUP BY maintenance_type
    `);
    console.log('\n📋 Maintenance Type Summary:');
    for (const row of summary.rows) {
      console.log(`   ${row.maintenance_type}: ${row.count}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createMaintenanceRecords().then(() => {
  console.log('\n✅ Maintenance setup complete');
  process.exit(0);
});