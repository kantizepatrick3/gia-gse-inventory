const { createClient } = require('@libsql/client');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://gse-inventory-2-giagambia.aws-eu-west-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE3NzA4NjYsImlkIjoiMDE5ZWQ5Y2UtODMwMS03ZTY5LTg5MTUtNzZkZGJhOWYxNzQ2IiwicmlkIjoiNTIzYmJmNzktZWZjYi00ZmMxLTk5MzYtNGY0MjhjZGVlNjlkIn0.dM9IJXN490vrYGCOJiG2yXpm2nYTGoMlKg38frLHyUof5Piho2QvtQb2X7znE6S_cHWgeCMepG_IvV4-RwqeAw'
});

async function check() {
  try {
    const result = await db.execute('SELECT COUNT(*) as count FROM service_history');
    console.log('Service history records:', result.rows[0].count);
    
    if (result.rows[0].count > 0) {
      const sample = await db.execute('SELECT * FROM service_history LIMIT 2');
      console.log('Sample records:', JSON.stringify(sample.rows, null, 2));
    } else {
      console.log('No records found in service_history table');
      const maint = await db.execute('SELECT COUNT(*) as count FROM gse_maintenance');
      console.log('gse_maintenance records:', maint.rows[0].count);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}
check();