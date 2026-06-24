const xlsx = require('xlsx');
const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function importParts() {
  try {
    console.log('🚀 Starting Excel import...\n');
    
    const filePath = './GSE_Parts_Inventory new.xlsx';
    console.log(`📂 Reading: ${filePath}`);
    
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    console.log(`📊 Found ${data.length} parts to import\n`);
    
    // Get existing columns
    const tableInfo = await db.execute("PRAGMA table_info(parts)");
    const existingColumns = tableInfo.rows.map(r => r.name);
    console.log('📋 Existing columns:', existingColumns.join(', '));
    console.log('');
    
    let success = 0;
    let failed = 0;
    let updated = 0;
    let inserted = 0;
    
    for (const row of data) {
      try {
        const partNumber = String(row['Part Number'] || '').trim();
        const description = String(row['Description'] || '').trim();
        const manufacturer = String(row['Manufacturer'] || '').trim();
        const compatibleGse = String(row['Compatible GSE'] || '').trim();
        const locationBin = String(row['Location Bin'] || '').trim();
        const minStock = parseInt(row['Min Stock']) || 5;
        const stock = parseInt(row['Stock']) || 0;
        const unitPrice = parseFloat(row['Unit Price']) || 0;
        const currentPrice = parseFloat(row['Current Price']) || 0;
        const maintenanceType = String(row['Maintenance Type'] || 'none').trim().toLowerCase();
        const serviceIntervalHours = parseInt(row['Service Interval Hours']) || 0;
        const serviceIntervalMonths = parseInt(row['Service Interval Months']) || 0;
        const serviceIntervalYears = parseInt(row['Service Interval Years']) || 0;
        const contactPerson = String(row['Contact Person'] || '').trim();
        const contactPhone = String(row['Contact Phone'] || '').trim();
        const contactEmail = String(row['Contact Email'] || '').trim();
        
        if (!partNumber) {
          console.log(`⚠️ Skipping row - missing Part Number`);
          failed++;
          continue;
        }
        
        console.log(`📝 Processing: ${partNumber} - ${description}`);
        
        // Check if part exists
        const existing = await db.execute({
          sql: 'SELECT id FROM parts WHERE part_number = ?',
          args: [partNumber]
        });
        
        if (existing.rows.length > 0) {
          // Build update query dynamically
          const updates = [];
          const values = [];
          
          if (existingColumns.includes('description')) { updates.push('description = ?'); values.push(description); }
          if (existingColumns.includes('manufacturer')) { updates.push('manufacturer = ?'); values.push(manufacturer); }
          if (existingColumns.includes('compatible_gse')) { updates.push('compatible_gse = ?'); values.push(compatibleGse); }
          if (existingColumns.includes('location_bin')) { updates.push('location_bin = ?'); values.push(locationBin); }
          if (existingColumns.includes('min_stock')) { updates.push('min_stock = ?'); values.push(minStock); }
          if (existingColumns.includes('quantity_on_hand')) { updates.push('quantity_on_hand = ?'); values.push(stock); }
          if (existingColumns.includes('unit_price')) { updates.push('unit_price = ?'); values.push(unitPrice); }
          if (existingColumns.includes('current_price')) { updates.push('current_price = ?'); values.push(currentPrice); }
          if (existingColumns.includes('maintenance_type')) { updates.push('maintenance_type = ?'); values.push(maintenanceType); }
          if (existingColumns.includes('service_interval_hours')) { updates.push('service_interval_hours = ?'); values.push(serviceIntervalHours); }
          if (existingColumns.includes('service_interval_months')) { updates.push('service_interval_months = ?'); values.push(serviceIntervalMonths); }
          if (existingColumns.includes('service_interval_years')) { updates.push('service_interval_years = ?'); values.push(serviceIntervalYears); }
          if (existingColumns.includes('contact_person')) { updates.push('contact_person = ?'); values.push(contactPerson); }
          if (existingColumns.includes('contact_phone')) { updates.push('contact_phone = ?'); values.push(contactPhone); }
          if (existingColumns.includes('contact_email')) { updates.push('contact_email = ?'); values.push(contactEmail); }
          
          values.push(partNumber);
          
          const query = `UPDATE parts SET ${updates.join(', ')} WHERE part_number = ?`;
          await db.execute({ sql: query, args: values });
          
          console.log(`   ✅ Updated: ${partNumber}`);
          updated++;
        } else {
          // Build insert query dynamically
          const columns = [];
          const placeholders = [];
          const values = [];
          
          if (existingColumns.includes('part_number')) { columns.push('part_number'); placeholders.push('?'); values.push(partNumber); }
          if (existingColumns.includes('description')) { columns.push('description'); placeholders.push('?'); values.push(description); }
          if (existingColumns.includes('manufacturer')) { columns.push('manufacturer'); placeholders.push('?'); values.push(manufacturer); }
          if (existingColumns.includes('compatible_gse')) { columns.push('compatible_gse'); placeholders.push('?'); values.push(compatibleGse); }
          if (existingColumns.includes('location_bin')) { columns.push('location_bin'); placeholders.push('?'); values.push(locationBin); }
          if (existingColumns.includes('min_stock')) { columns.push('min_stock'); placeholders.push('?'); values.push(minStock); }
          if (existingColumns.includes('quantity_on_hand')) { columns.push('quantity_on_hand'); placeholders.push('?'); values.push(stock); }
          if (existingColumns.includes('unit_price')) { columns.push('unit_price'); placeholders.push('?'); values.push(unitPrice); }
          if (existingColumns.includes('current_price')) { columns.push('current_price'); placeholders.push('?'); values.push(currentPrice); }
          if (existingColumns.includes('average_cost')) { columns.push('average_cost'); placeholders.push('?'); values.push(unitPrice); }
          if (existingColumns.includes('last_purchase_price')) { columns.push('last_purchase_price'); placeholders.push('?'); values.push(unitPrice); }
          if (existingColumns.includes('maintenance_type')) { columns.push('maintenance_type'); placeholders.push('?'); values.push(maintenanceType); }
          if (existingColumns.includes('service_interval_hours')) { columns.push('service_interval_hours'); placeholders.push('?'); values.push(serviceIntervalHours); }
          if (existingColumns.includes('service_interval_months')) { columns.push('service_interval_months'); placeholders.push('?'); values.push(serviceIntervalMonths); }
          if (existingColumns.includes('service_interval_years')) { columns.push('service_interval_years'); placeholders.push('?'); values.push(serviceIntervalYears); }
          if (existingColumns.includes('contact_person')) { columns.push('contact_person'); placeholders.push('?'); values.push(contactPerson); }
          if (existingColumns.includes('contact_phone')) { columns.push('contact_phone'); placeholders.push('?'); values.push(contactPhone); }
          if (existingColumns.includes('contact_email')) { columns.push('contact_email'); placeholders.push('?'); values.push(contactEmail); }
          
          const query = `INSERT INTO parts (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
          const result = await db.execute({ sql: query, args: values });
          
          console.log(`   ✅ Inserted: ${partNumber} (ID: ${result.lastInsertRowid})`);
          inserted++;
        }
        
        success++;
        
      } catch (rowError) {
        console.error(`❌ Error: ${rowError.message}`);
        failed++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Inserted: ${inserted} new parts`);
    console.log(`🔄 Updated: ${updated} existing parts`);
    if (failed > 0) console.log(`❌ Failed: ${failed} parts`);
    console.log('='.repeat(60));
    
    const totalParts = await db.execute('SELECT COUNT(*) as count FROM parts');
    console.log(`\n📦 Total parts in database: ${totalParts.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
  }
}

importParts().then(() => {
  console.log('\n✅ Import script completed');
  process.exit(0);
});