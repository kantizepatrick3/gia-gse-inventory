const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function addJHJKKK() {
  try {
    console.log('📝 Adding JHJKKK to database...');
    
    // Calculate next service date (6 months from last service)
    const lastServiceDate = '2026-06-22';
    const date = new Date(lastServiceDate);
    date.setMonth(date.getMonth() + 6);
    const nextServiceDate = date.toISOString().split('T')[0];
    
    // Insert the equipment
    await db.execute({
      sql: `INSERT INTO gse_maintenance (
        equipment_name, 
        equipment_type, 
        maintenance_type, 
        last_service_date, 
        service_interval_months, 
        next_service_date, 
        current_hours, 
        target_hours, 
        service_interval_hours, 
        status, 
        created_at, 
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'serviced', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        'JHJKKK',           // equipment_name
        'fghhhh',           // equipment_type
        'hour',             // maintenance_type
        lastServiceDate,    // last_service_date
        6,                  // service_interval_months
        nextServiceDate,    // next_service_date
        200,                // current_hours
        250,                // target_hours
        250,                // service_interval_hours
      ]
    });
    
    console.log('✅ JHJKKK added successfully!');
    console.log(`📅 Next service date: ${nextServiceDate}`);
    
    // Verify it was added
    const verify = await db.execute({
      sql: "SELECT id, equipment_name, last_service_date, next_service_date, current_hours, target_hours FROM gse_maintenance WHERE equipment_name = 'JHJKKK'"
    });
    console.log('📊 Verification:', verify.rows[0]);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

addJHJKKK();