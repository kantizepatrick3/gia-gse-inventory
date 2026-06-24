const { createClient } = require('@libsql/client');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://gse-inventory-2-giagambia.aws-eu-west-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE3NzA4NjYsImlkIjoiMDE5ZWQ5Y2UtODMwMS03ZTY5LTg5MTUtNzZkZGJhOWYxNzQ2IiwicmlkIjoiNTIzYmJmNzktZWZjYi00ZmMxLTk5MzYtNGY0MjhjZGVlNjlkIn0.dM9IJXN490vrYGCOJiG2yXpm2nYTGoMlKg38frLHyUof5Piho2QvtQb2X7znE6S_cHWgeCMepG_IvV4-RwqeAw'
});

async function verify() {
  const count = await db.execute('SELECT COUNT(*) as count FROM service_history');
  console.log('Total service_history records:', count.rows[0].count);
  
  const bat = await db.execute('SELECT * FROM service_history WHERE equipment_name = ? ORDER BY service_date DESC', ['BAT-001']);
  console.log('\nBAT-001 records:', bat.rows.length);
  console.log('----------------------------------------');
  bat.rows.forEach((r, i) => {
    console.log(`${i+1}. ${r.service_date}: ${r.service_performed} (by ${r.technician_name})`);
  });
}
verify();