const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function resetDatabase() {
  try {
    console.log('🗑️ RESETTING DATABASE...\n');

    // Delete all data from tables
    console.log('📝 Deleting maintenance_attachments...');
    await db.execute('DELETE FROM maintenance_attachments');
    
    console.log('📝 Deleting maintenance_checklist...');
    await db.execute('DELETE FROM maintenance_checklist');
    
    console.log('📝 Deleting service_history...');
    await db.execute('DELETE FROM service_history');
    
    console.log('📝 Deleting gse_maintenance...');
    await db.execute('DELETE FROM gse_maintenance');
    
    console.log('📝 Deleting price_history...');
    await db.execute('DELETE FROM price_history');
    
    console.log('📝 Deleting pending_issues...');
    await db.execute('DELETE FROM pending_issues');
    
    console.log('📝 Deleting transactions...');
    await db.execute('DELETE FROM transactions');
    
    console.log('📝 Deleting parts...');
    await db.execute('DELETE FROM parts');

    console.log('\n✅ All data deleted successfully!');
    console.log('📊 Database is now clean.');
    
    console.log('\n🔧 IMPORTANT: The sample data will be recreated when you restart the server.');
    console.log('   Run: node server.js');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

resetDatabase();