const { createClient } = require('@libsql/client');
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://gse-inventory-2-giagambia.aws-eu-west-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE3NzA4NjYsImlkIjoiMDE5ZWQ5Y2UtODMwMS03ZTY5LTg5MTUtNzZkZGJhOWYxNzQ2IiwicmlkIjoiNTIzYmJmNzktZWZjYi00ZmMxLTk5MzYtNGY0MjhjZGVlNjlkIn0.dM9IJXN490vrYGCOJiG2yXpm2nYTGoMlKg38frLHyUof5Piho2QvtQb2X7znE6S_cHWgeCMepG_IvV4-RwqeAw'
});

async function test() {
  console.log('🔍 Testing server database connection...');
  
  // Check if service_history table exists
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='service_history'");
  console.log('Service_history table exists:', tables.rows.length > 0);
  
  if (tables.rows.length > 0) {
    // Get column names
    const cols = await db.execute("PRAGMA table_info(service_history)");
    console.log('Columns:', cols.rows.map(c => c.name).join(', '));
    
    // Count records
    const count = await db.execute('SELECT COUNT(*) as count FROM service_history');
    console.log('Total records:', count.rows[0].count);
    
    // Test the exact query the API uses
    const query = 'SELECT * FROM service_history WHERE 1=1 ORDER BY equipment_name, service_date DESC, created_at DESC LIMIT 500';
    console.log('Query:', query);
    
    const result = await db.execute(query);
    console.log('Result count:', result.rows.length);
    
    if (result.rows.length > 0) {
      console.log('First record:', result.rows[0]);
    }
  }
}
test();