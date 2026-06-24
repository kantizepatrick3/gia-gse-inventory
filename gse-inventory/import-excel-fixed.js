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
          // Update existing part
          await db.execute({
            sql: `UPDATE parts SET 
              description = ?,
              manufacturer = ?,
              compatible_gse = ?,
              location_bin = ?,
              min_stock = ?,
              quantity_on_hand = ?,
              unit_price = ?,
              current_price = ?,
              maintenance_type = ?,
              service_interval_hours = ?,
              service_interval_months = ?,
              service_interval_years = ?,
              contact_person = ?,
              contact_phone = ?,
              contact_email = ?,
              updated_at = CURRENT_TIMESTAMP
              WHERE part_number = ?`,
            args: [
              description,
              manufacturer,
              compatibleGse,
              locationBin,
              minStock,
              stock,
              unitPrice,
              currentPrice,
              maintenanceType,
              serviceIntervalHours,
              serviceIntervalMonths,
              serviceIntervalYears,
              contactPerson,
              contactPhone,
              contactEmail,
              partNumber
            ]
          });
          console.log(`   ✅ Updated: ${partNumber}`);
          updated++;
        } else {
          // Insert new part
          const result = await db.execute({
            sql: `INSERT INTO parts (
              part_number,
              description,
              manufacturer,
              compatible_gse,
              location_bin,
              min_stock,
              quantity_on_hand,
              unit_price,
              current_price,
              average_cost,
              last_purchase_price,
              maintenance_type,
              service_interval_hours,
              service_interval_months,
              service_interval_years,
              contact_person,
              contact_phone,
              contact_email,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            args: [
              partNumber,
              description,
              manufacturer,
              compatibleGse,
              locationBin,
              minStock,
              stock,
              unitPrice,
              currentPrice,
              unitPrice,
              unitPrice,
              maintenanceType,
              serviceIntervalHours,
              serviceIntervalMonths,
              serviceIntervalYears,
              contactPerson,
              contactPhone,
              contactEmail
            ]
          });
          
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
    
    // Show sample of imported data
    const sample = await db.execute('SELECT part_number, description, quantity_on_hand, unit_price, maintenance_type FROM parts LIMIT 5');
    console.log('\n📋 Sample of imported parts:');
    console.log('='.repeat(70));
    for (const row of sample.rows) {
      console.log(`${String(row.part_number).padEnd(12)} | ${String(row.description).padEnd(25)} | Stock: ${String(row.quantity_on_hand).padEnd(5)} | Price: $${String(row.unit_price)} | Type: ${row.maintenance_type}`);
    }
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
  }
}

importParts().then(() => {
  console.log('\n✅ Import script completed');
  process.exit(0);
});