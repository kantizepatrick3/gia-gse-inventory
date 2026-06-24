const { createClient } = require('@libsql/client');
const db = createClient({
  url: 'libsql://gse-inventory-2-giagambia.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE3NzA4NjYsImlkIjoiMDE5ZWQ5Y2UtODMwMS03ZTY5LTg5MTUtNzZkZGJhOWYxNzQ2IiwicmlkIjoiNTIzYmJmNzktZWZjYi00ZmMxLTk5MzYtNGY0MjhjZGVlNjlkIn0.dM9IJXN490vrYGCOJiG2yXpm2nYTGoMlKg38frLHyUof5Piho2QvtQb2X7znE6S_cHWgeCMepG_IvV4-RwqeAw'
});

async function check() {
  const result = await db.execute('SELECT DISTINCT equipment_name FROM service_history');
  console.log('Equipment names:', result.rows.map(r => r.equipment_name));
  
  const count = await db.execute('SELECT COUNT(*) as count FROM service_history');
  console.log('Total records:', count.rows[0].count);
}
check();