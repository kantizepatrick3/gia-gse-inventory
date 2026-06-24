const xlsx = require('xlsx');
const { createClient } = require('@libsql/client');
require('dotenv').config();

// Database connection
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function importParts() {
  try {
    console.log('🚀 Starting Excel import...\n');
    
    // Read the Excel file
    const filePath = './GSE_Parts_Inventory new.xlsx';
    console.log(`📂 Reading: ${filePath}`);
    
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    console.log(`📊 Found ${data.length} parts to import\n`);
    console.log('📋 Columns found:', Object.keys(data[0]));
    console.log('');
    
    let success = 0;
    let failed = 0;
    let updated = 0;
    
    for (const row of data) {
      try {
        // Extract data from row
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
        
        let partId;
        
        if (existing.rows.length > 0) {
          // Update existing part
          partId = existing.rows[0].id;
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
          console.log(`   ✅ Updated existing part: ${partNumber}`);
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
          
          partId = Number(result.lastInsertRowid);
          console.log(`   ✅ Inserted new part: ${partNumber} (ID: ${partId})`);
        }
        
        // Check if maintenance record exists
        const maintExisting = await db.execute({
          sql: 'SELECT id FROM gse_maintenance WHERE part_id = ?',
          args: [partId]
        });
        
        // Create or update maintenance record if maintenance type is set
        if (maintenanceType && maintenanceType !== 'none') {
          const today = new Date().toISOString().split('T')[0];
          
          if (maintExisting.rows.length > 0) {
            // Update existing maintenance record
            console.log(`   🔄 Updating maintenance record...`);
            await db.execute({
              sql: `UPDATE gse_maintenance SET
                equipment_name = ?,
                equipment_type = ?,
                maintenance_type = ?,
                service_interval_hours = ?,
                service_interval_months = ?,
                service_interval_years = ?,
                updated_at = CURRENT_TIMESTAMP
                WHERE part_id = ?`,
              args: [
                partNumber,
                manufacturer,
                maintenanceType,
                serviceIntervalHours,
                serviceIntervalMonths,
                serviceIntervalYears,
                partId
              ]
            });
          } else {
            // Create new maintenance record
            console.log(`   🔄 Creating maintenance record...`);
            if (maintenanceType === 'year') {
              await db.execute({
                sql: `INSERT INTO gse_maintenance (
                  equipment_name,
                  equipment_type,
                  maintenance_type,
                  part_id,
                  last_service_full_date,
                  service_interval_years,
                  status,
                  created_by,
                  created_at,
                  updated_at
                ) VALUES (?, ?, 'year', ?, ?, ?, 'serviced', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                args: [partNumber, manufacturer, partId, today, serviceIntervalYears || 1]
              });
            } else if (maintenanceType === 'month') {
              await db.execute({
                sql: `INSERT INTO gse_maintenance (
                  equipment_name,
                  equipment_type,
                  maintenance_type,
                  part_id,
                  last_service_date,
                  service_interval_months,
                  status,
                  created_by,
                  created_at,
                  updated_at
                ) VALUES (?, ?, 'month', ?, ?, ?, 'serviced', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                args: [partNumber, manufacturer, partId, today, serviceIntervalMonths || 6]
              });
            } else if (maintenanceType === 'hour') {
              const hours = serviceIntervalHours || 250;
              await db.execute({
                sql: `INSERT INTO gse_maintenance (
                  equipment_name,
                  equipment_type,
                  maintenance_type,
                  part_id,
                  last_service_date,
                  service_interval_hours,
                  target_hours,
                  status,
                  created_by,
                  created_at,
                  updated_at
                ) VALUES (?, ?, 'hour', ?, ?, ?, ?, 'serviced', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                args: [partNumber, manufacturer, partId, today, hours, hours]
              });
            }
            console.log(`   ✅ Created maintenance record`);
          }
        } else if (maintExisting.rows.length > 0) {
          // If maintenance type is 'none', remove the maintenance record
          console.log(`   🗑️ Removing maintenance record (type: none)`);
          await db.execute({
            sql: 'DELETE FROM gse_maintenance WHERE part_id = ?',
            args: [partId]
          });
        }
        
        success++;
        console.log(`   ✅ Done\n`);
        
      } catch (rowError) {
        console.error(`❌ Error processing row:`, rowError.message);
        console.error(`   Row data:`, row);
        failed++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Inserted: ${success - updated} new parts`);
    console.log(`🔄 Updated: ${updated} existing parts`);
    if (failed > 0) console.log(`❌ Failed: ${failed} parts`);
    console.log('='.repeat(60));
    
    // Show summary
    const totalParts = await db.execute('SELECT COUNT(*) as count FROM parts');
    console.log(`\n📦 Total parts in database: ${totalParts.rows[0].count}`);
    
    const maintenanceTypes = await db.execute(`
      SELECT maintenance_type, COUNT(*) as count 
      FROM parts 
      GROUP BY maintenance_type
    `);
    console.log('\n📋 Maintenance Types:');
    for (const row of maintenanceTypes.rows) {
      console.log(`   ${row.maintenance_type}: ${row.count}`);
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
  }
}

// Run the import
importParts().then(() => {
  console.log('\n✅ Import script completed');
  process.exit(0);
});