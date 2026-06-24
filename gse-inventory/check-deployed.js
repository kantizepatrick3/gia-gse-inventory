const { createClient } = require('@libsql/client');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://gse-inventory-2-giagambia.aws-eu-west-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE3NzA4NjYsImlkIjoiMDE5ZWQ5Y2UtODMwMS03ZTY5LTg5MTUtNzZkZGJhOWYxNzQ2IiwicmlkIjoiNTIzYmJmNzktZWZjYi00ZmMxLTk5MzYtNGY0MjhjZGVlNjlkIn0.dM9IJXN490vrYGCOJiG2yXpm2nYTGoMlKg38frLHyUof5Piho2QvtQb2X7znE6S_cHWgeCMepG_IvV4-RwqeAw'
});

async function checkDeployed() {
  console.log('🔍 Checking deployed database...');
  
  // Check tables
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables:', tables.rows.map(r => r.name).join(', '));
  
  // Check service_history
  const hist = await db.execute("SELECT COUNT(*) as count FROM service_history");
  console.log('Service history count:', hist.rows[0].count);
  
  // Show some records
  if (hist.rows[0].count > 0) {
    const sample = await db.execute("SELECT * FROM service_history LIMIT 5");
    console.log('Sample records:', sample.rows.length);
    sample.rows.forEach(r => {
      console.log(`  - ${r.service_date}: ${r.equipment_name} - ${r.service_performed}`);
    });
  }
}
checkDeployed();