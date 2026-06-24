const { createClient } = require('@libsql/client');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://gse-inventory-2-giagambia.aws-eu-west-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE3NzA4NjYsImlkIjoiMDE5ZWQ5Y2UtODMwMS03ZTY5LTg5MTUtNzZkZGJhOWYxNzQ2IiwicmlkIjoiNTIzYmJmNzktZWZjYi00ZmMxLTk5MzYtNGY0MjhjZGVlNjlkIn0.dM9IJXN490vrYGCOJiG2yXpm2nYTGoMlKg38frLHyUof5Piho2QvtQb2X7znE6S_cHWgeCMepG_IvV4-RwqeAw'
});

async function checkData() {
  console.log('📊 Checking data...');
  
  // Check transactions
  const txns = await db.execute(`SELECT * FROM transactions WHERE part_id IN (SELECT id FROM parts WHERE part_number = 'BAT-001') ORDER BY created_at DESC`);
  console.log('Transactions found:', txns.rows.length);
  
  // Check service_history
  const hist = await db.execute(`SELECT * FROM service_history WHERE equipment_name = 'BAT-001' ORDER BY created_at DESC`);
  console.log('Service history records:', hist.rows.length);
  
  // Check gse_maintenance
  const maint = await db.execute(`SELECT * FROM gse_maintenance WHERE equipment_name = 'BAT-001'`);
  console.log('Maintenance records for BAT-001:', maint.rows.length);
  if (maint.rows.length > 0) {
    console.log('Maintenance ID:', maint.rows[0].id);
    console.log('Maintenance data:', JSON.stringify(maint.rows[0], null, 2));
  }
}
checkData();