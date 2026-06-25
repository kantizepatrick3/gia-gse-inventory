const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createClient } = require('@libsql/client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'gse_inventory_jwt_secret_key_2024';

// ========== FIX: Handle BigInt serialization ==========
if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function() {
    return Number(this);
  };
}

// CORS Origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://giagse.onrender.com',
  'https://gia-gse-inventory.onrender.com',
  'https://gse-frontend.onrender.com',
  'https://gse-backend.onrender.com'
];

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS policy does not allow this origin'), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection
let db;

const initDatabase = async () => {
  try {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:gse_inventory.db',
      authToken: process.env.TURSO_AUTH_TOKEN
    });
    console.log('✅ Database connected');
  } catch (err) {
    console.error('Database connection error:', err);
    try {
      const sqlite3 = require('sqlite3');
      const { open } = require('sqlite');
      db = await open({
        filename: './gse_inventory.db',
        driver: sqlite3.Database
      });
      console.log('✅ SQLite database connected (fallback)');
    } catch (sqliteErr) {
      console.error('SQLite connection error:', sqliteErr);
      throw sqliteErr;
    }
  }
};

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// ============================================================
// ⭐ PRICE HISTORY ROUTES
// ============================================================

// GET PRICE HISTORY FOR A SPECIFIC PART
app.get('/api/price-history/:partId', authenticateToken, async (req, res) => {
  try {
    const { partId } = req.params;
    console.log('💰 Getting price history for part:', partId);
    
    const result = await db.execute({
      sql: `SELECT * FROM price_history WHERE part_id = ? ORDER BY created_at DESC LIMIT 10`,
      args: [partId]
    });
    
    console.log('✅ Found', result.rows.length, 'price history records');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching price history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET FULL PRICE HISTORY (No limit)
app.get('/api/price-history/full/:partId', authenticateToken, async (req, res) => {
  try {
    const { partId } = req.params;
    console.log('💰 Getting full price history for part:', partId);
    
    const result = await db.execute({
      sql: `SELECT * FROM price_history WHERE part_id = ? ORDER BY created_at DESC`,
      args: [partId]
    });
    
    console.log('✅ Found', result.rows.length, 'price history records');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching full price history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET LATEST PRICE FOR A PART
app.get('/api/price-history/latest/:partId', authenticateToken, async (req, res) => {
  try {
    const { partId } = req.params;
    console.log('💰 Getting latest price for part:', partId);
    
    const result = await db.execute({
      sql: `SELECT price, created_at FROM price_history WHERE part_id = ? ORDER BY created_at DESC LIMIT 1`,
      args: [partId]
    });
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No price history found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching latest price:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ADD PRICE HISTORY RECORD
app.post('/api/price-history', authenticateToken, async (req, res) => {
  const { part_id, price, quantity, transaction_type, notes } = req.body;
  
  console.log('💰 Adding price for part:', part_id, 'price:', price);
  
  try {
    // Validate part exists
    const partResult = await db.execute({
      sql: 'SELECT * FROM parts WHERE id = ?',
      args: [part_id]
    });

    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    // Insert price history
    await db.execute({
      sql: `INSERT INTO price_history (part_id, price, quantity, transaction_type, notes, recorded_by) 
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [part_id, price, quantity || 1, transaction_type || 'MANUAL', notes || '', req.user.username]
    });
    
    // Update part's current price
    await db.execute({
      sql: `UPDATE parts SET current_price = ?, unit_price = ? WHERE id = ?`,
      args: [price, price, part_id]
    });
    
    res.json({ success: true, message: 'Price updated successfully!' });
  } catch (err) {
    console.error('Error adding price history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ⭐ PRICE UPDATE ROUTE - For React frontend (PUT)
// ============================================================
app.put('/api/parts/:partId/price', authenticateToken, async (req, res) => {
  console.log('\n=== 🔄 PRICE UPDATE REQUEST ===');
  console.log('Part ID:', req.params.partId);
  console.log('New Price:', req.body.price);
  console.log('Full body:', req.body);

  try {
    const { partId } = req.params;
    const { price } = req.body;

    // Validate input
    if (price === undefined || price === null) {
      return res.status(400).json({ error: 'Price is required' });
    }

    const newPrice = parseFloat(price);
    if (isNaN(newPrice) || newPrice < 0) {
      return res.status(400).json({ error: 'Invalid price value' });
    }

    // Check if part exists (try by part_number first, then by id)
    let partResult;
    
    partResult = await db.execute({
      sql: 'SELECT id, part_number, current_price, description FROM parts WHERE part_number = ?',
      args: [partId]
    });

    if (partResult.rows.length === 0) {
      partResult = await db.execute({
        sql: 'SELECT id, part_number, current_price, description FROM parts WHERE id = ?',
        args: [partId]
      });
    }

    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: `Part ${partId} not found` });
    }

    const part = partResult.rows[0];
    const oldPrice = part.current_price || 0;
    const partIdNumber = part.id;

    // Update the price in parts table
    await db.execute({
      sql: 'UPDATE parts SET current_price = ?, unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [newPrice, newPrice, partIdNumber]
    });

    // Add to price history
    await db.execute({
      sql: `INSERT INTO price_history (part_id, price, transaction_type, notes, recorded_by, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [partIdNumber, newPrice, 'PRICE_UPDATE', `Price updated from ${oldPrice} to ${newPrice} by ${req.user.username}`, req.user.username]
    });

    console.log('✅ Price updated successfully');
    console.log(`   Part: ${part.part_number} - ${part.description}`);
    console.log(`   Old price: ${oldPrice}`);
    console.log(`   New price: ${newPrice}`);

    res.json({
      success: true,
      message: `Price updated for ${part.part_number}`,
      partId: part.part_number,
      oldPrice: oldPrice,
      newPrice: newPrice,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error updating price:', error);
    res.status(500).json({ 
      error: 'Failed to update price',
      details: error.message 
    });
  }
});

// ============================================================
// ⭐ IMPORT PARTS FROM EXCEL WITH AUTO-MAINTENANCE CREATION
// ============================================================
app.post('/api/parts/import', authenticateToken, async (req, res) => {
  console.log('\n=== 📥 IMPORTING PARTS FROM EXCEL ===');
  console.log('User:', req.user.username);
  
  try {
    const { parts } = req.body;
    
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'No parts data provided' });
    }
    
    console.log(`📊 Received ${parts.length} parts to import`);
    
    const results = {
      imported: [],
      errors: [],
      maintenanceCreated: [],
      skipped: []
    };
    
    for (const [index, partData] of parts.entries()) {
      try {
        // Extract part data with defaults
        const {
          part_number,
          description,
          manufacturer,
          compatible_gse,
          location_bin,
          quantity_on_hand = 0,
          min_stock = 0,
          max_stock = 100,
          unit_price = 0,
          current_price = 0,
          maintenance_type = 'none',
          service_interval_hours = 0,
          service_interval_months = 0,
          service_interval_years = 0,
          contact_person = '',
          contact_phone = '',
          contact_email = ''
        } = partData;
        
        // Validate required fields
        if (!part_number) {
          results.errors.push({ row: index + 1, error: 'Missing part_number' });
          continue;
        }
        
        // Check if part already exists
        const existingPart = await db.execute({
          sql: 'SELECT id, part_number FROM parts WHERE part_number = ?',
          args: [part_number]
        });
        
        let partId;
        let isNew = false;
        
        if (existingPart.rows.length > 0) {
          // Update existing part
          partId = existingPart.rows[0].id;
          await db.execute({
            sql: `
              UPDATE parts SET
                description = ?,
                manufacturer = ?,
                compatible_gse = ?,
                location_bin = ?,
                quantity_on_hand = ?,
                min_stock = ?,
                max_stock = ?,
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
              WHERE id = ?
            `,
            args: [
              description || '',
              manufacturer || '',
              compatible_gse || '',
              location_bin || '',
              quantity_on_hand,
              min_stock,
              max_stock,
              unit_price,
              current_price,
              maintenance_type,
              service_interval_hours,
              service_interval_months,
              service_interval_years,
              contact_person || '',
              contact_phone || '',
              contact_email || '',
              partId
            ]
          });
          results.skipped.push({ part_number, reason: 'Updated existing part' });
        } else {
          // Insert new part
          isNew = true;
          const insertResult = await db.execute({
            sql: `
              INSERT INTO parts (
                part_number, description, manufacturer, compatible_gse,
                location_bin, quantity_on_hand, min_stock, max_stock,
                unit_price, current_price, maintenance_type,
                service_interval_hours, service_interval_months, service_interval_years,
                contact_person, contact_phone, contact_email,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              RETURNING id
            `,
            args: [
              part_number,
              description || '',
              manufacturer || '',
              compatible_gse || '',
              location_bin || '',
              quantity_on_hand,
              min_stock,
              max_stock,
              unit_price,
              current_price,
              maintenance_type,
              service_interval_hours,
              service_interval_months,
              service_interval_years,
              contact_person || '',
              contact_phone || '',
              contact_email || ''
            ]
          });
          
          partId = insertResult.rows[0].id;
          results.imported.push({ part_number, description });
        }
        
        // ============================================================
        // ⭐ AUTO-CREATE MAINTENANCE RECORD
        // ============================================================
        if (maintenance_type && maintenance_type !== 'none') {
          // Check if maintenance record already exists for this part
          const existingMaintenance = await db.execute({
            sql: 'SELECT id FROM gse_maintenance WHERE part_id = ?',
            args: [partId]
          });
          
          if (existingMaintenance.rows.length === 0) {
            // Create maintenance record
            const equipmentName = description || part_number;
            
            // Calculate next service dates based on maintenance type
            let nextServiceDate = null;
            let nextServiceYear = null;
            
            if (maintenance_type === 'month' && service_interval_months > 0) {
              const today = new Date();
              nextServiceDate = new Date(today);
              nextServiceDate.setMonth(nextServiceDate.getMonth() + parseInt(service_interval_months));
              nextServiceDate = nextServiceDate.toISOString().split('T')[0];
            } else if (maintenance_type === 'year' && service_interval_years > 0) {
              const today = new Date();
              nextServiceYear = today.getFullYear() + parseInt(service_interval_years);
            }
            
            // Insert maintenance record
            await db.execute({
              sql: `
                INSERT INTO gse_maintenance (
                  equipment_name, equipment_type, part_id, maintenance_type,
                  service_performed, technician_name, notes,
                  last_service_date, last_service_hours, last_service_year,
                  last_service_full_date,
                  service_interval_hours, service_interval_months,
                  service_interval_years, service_interval_months_for_hour,
                  current_hours, target_hours,
                  next_service_date, next_service_year,
                  status, maintenance_category, created_by,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `,
              args: [
                equipmentName,
                manufacturer || 'GSE Equipment',
                partId,
                maintenance_type,
                'Initial setup from import',
                req.user.username,
                `Auto-created from Excel import on ${new Date().toISOString()}`,
                null, // last_service_date
                0, // last_service_hours
                null, // last_service_year
                null, // last_service_full_date
                service_interval_hours || 0,
                service_interval_months || 0,
                service_interval_years || 0,
                0, // service_interval_months_for_hour
                0, // current_hours
                service_interval_hours || 0, // target_hours
                nextServiceDate,
                nextServiceYear,
                'serviced',
                'preventive',
                req.user.username
              ]
            });
            
            results.maintenanceCreated.push({
              part_number,
              equipment_name: equipmentName,
              maintenance_type: maintenance_type,
              interval: maintenance_type === 'month' ? `${service_interval_months} months` :
                        maintenance_type === 'year' ? `${service_interval_years} years` :
                        maintenance_type === 'hour' ? `${service_interval_hours} hours` : 'N/A'
            });
            
            console.log(`✅ Auto-created maintenance for ${part_number}`);
          } else {
            // Update existing maintenance with new intervals
            await db.execute({
              sql: `
                UPDATE gse_maintenance SET
                  service_interval_hours = ?,
                  service_interval_months = ?,
                  service_interval_years = ?,
                  maintenance_type = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE part_id = ?
              `,
              args: [
                service_interval_hours || 0,
                service_interval_months || 0,
                service_interval_years || 0,
                maintenance_type,
                partId
              ]
            });
            
            results.maintenanceCreated.push({
              part_number,
              equipment_name: description || part_number,
              maintenance_type: 'Updated existing maintenance',
              interval: 'Updated intervals'
            });
          }
        }
        
      } catch (rowError) {
        console.error(`❌ Error importing row ${index + 1}:`, rowError.message);
        results.errors.push({
          row: index + 1,
          error: rowError.message,
          data: partData
        });
      }
    }
    
    console.log(`✅ Import complete: ${results.imported.length} new, ${results.maintenanceCreated.length} maintenance records created`);
    
    res.json({
      success: true,
      message: `Imported ${parts.length} parts successfully`,
      results: {
        imported: results.imported.length,
        maintenanceCreated: results.maintenanceCreated.length,
        skipped: results.skipped.length,
        errors: results.errors.length
      },
      details: {
        imported: results.imported,
        maintenanceCreated: results.maintenanceCreated,
        skipped: results.skipped,
        errors: results.errors
      }
    });
    
  } catch (error) {
    console.error('❌ Import error:', error);
    res.status(500).json({
      error: 'Failed to import parts',
      details: error.message
    });
  }
});

// ============================================================
// TEST ROUTE - To verify server is running
// ============================================================
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    routes: {
      priceHistory: '/api/price-history/:partId',
      fullPriceHistory: '/api/price-history/full/:partId',
      latestPrice: '/api/price-history/latest/:partId',
      addPrice: '/api/price-history (POST)',
      updatePrice: '/api/parts/:partId/price (PUT)',
      importParts: '/api/parts/import (POST)'
    }
  });
});

// ============================================================
// UTILITY FUNCTIONS FOR MAINTENANCE CALCULATIONS
// ============================================================
const calculateNextServiceDate = (lastServiceDate, intervalMonths) => {
  if (!lastServiceDate || !intervalMonths || parseInt(intervalMonths) <= 0) return null;
  const date = new Date(lastServiceDate);
  date.setMonth(date.getMonth() + parseInt(intervalMonths));
  return date.toISOString().split('T')[0];
};

const calculateNextServiceDateYears = (lastServiceDate, intervalYears) => {
  if (!lastServiceDate || !intervalYears || parseInt(intervalYears) <= 0) return null;
  const date = new Date(lastServiceDate);
  date.setFullYear(date.getFullYear() + parseInt(intervalYears));
  return date.toISOString().split('T')[0];
};

const calculateDaysUntil = (dateString) => {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateString);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// ============================================================
// DATABASE INITIALIZATION
// ============================================================
const createTables = async () => {
  try {
    // Users table
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      role TEXT DEFAULT 'storekeeper',
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Parts table
    await db.execute(`CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_number TEXT UNIQUE NOT NULL,
      description TEXT,
      manufacturer TEXT,
      compatible_gse TEXT,
      location_bin TEXT,
      quantity_on_hand INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 0,
      max_stock INTEGER DEFAULT 0,
      unit_price REAL DEFAULT 0,
      current_price REAL DEFAULT 0,
      average_cost REAL DEFAULT 0,
      last_purchase_price REAL DEFAULT 0,
      maintenance_type TEXT DEFAULT 'none',
      service_interval_hours INTEGER DEFAULT 0,
      service_interval_months INTEGER DEFAULT 0,
      service_interval_years INTEGER DEFAULT 0,
      contact_person TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Transactions table
    await db.execute(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER,
      transaction_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL,
      gse_registration TEXT,
      technician_name TEXT,
      work_order TEXT,
      reference_number TEXT,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (part_id) REFERENCES parts(id)
    )`);

    // Pending Issues table
    await db.execute(`CREATE TABLE IF NOT EXISTS pending_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_number TEXT NOT NULL,
      part_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      gse_registration TEXT,
      technician_name TEXT,
      work_order TEXT,
      notes TEXT,
      requested_by INTEGER,
      requested_by_name TEXT,
      admin_comment TEXT,
      approved_by TEXT,
      approved_at DATETIME,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (part_id) REFERENCES parts(id)
    )`);

    // GSE Maintenance table
    await db.execute(`CREATE TABLE IF NOT EXISTS gse_maintenance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_name TEXT NOT NULL,
      equipment_type TEXT,
      part_id INTEGER,
      maintenance_type TEXT NOT NULL DEFAULT 'none',
      service_performed TEXT,
      technician_name TEXT,
      notes TEXT,
      last_service_date TEXT,
      last_service_full_date TEXT,
      last_service_hours INTEGER DEFAULT 0,
      last_service_year INTEGER,
      current_hours INTEGER DEFAULT 0,
      service_interval_hours INTEGER DEFAULT 0,
      service_interval_months INTEGER DEFAULT 0,
      service_interval_years INTEGER DEFAULT 0,
      service_interval_months_for_hour INTEGER DEFAULT 0,
      target_hours INTEGER DEFAULT 0,
      next_service_hours INTEGER DEFAULT 0,
      next_service_date TEXT,
      next_service_year INTEGER,
      hours_remaining INTEGER DEFAULT 0,
      days_remaining INTEGER DEFAULT 0,
      years_remaining INTEGER DEFAULT 0,
      maintenance_category TEXT DEFAULT 'preventive',
      checklist_items TEXT,
      status TEXT DEFAULT 'serviced',
      date_performed DATETIME,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (part_id) REFERENCES parts(id)
    )`);

    // Service History table
    await db.execute(`CREATE TABLE IF NOT EXISTS service_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_id INTEGER NOT NULL,
      equipment_name TEXT NOT NULL,
      equipment_type TEXT,
      maintenance_type TEXT,
      service_date TEXT,
      service_performed TEXT,
      technician_name TEXT,
      notes TEXT,
      maintenance_category TEXT,
      checklist_items TEXT,
      checklist_completed TEXT,
      current_hours INTEGER DEFAULT 0,
      target_hours INTEGER DEFAULT 0,
      service_interval_months INTEGER DEFAULT 0,
      service_interval_years INTEGER DEFAULT 0,
      recorded_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (maintenance_id) REFERENCES gse_maintenance(id)
    )`);

    // Maintenance Attachments table
    await db.execute(`CREATE TABLE IF NOT EXISTS maintenance_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_data TEXT,
      file_type TEXT,
      file_size INTEGER,
      uploaded_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (maintenance_id) REFERENCES gse_maintenance(id)
    )`);

    // Price History table
    await db.execute(`CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      transaction_type TEXT NOT NULL,
      reference_number TEXT,
      notes TEXT,
      recorded_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (part_id) REFERENCES parts(id)
    )`);

    console.log('✅ All tables created successfully');
  } catch (err) {
    console.error('Error creating tables:', err.message);
  }
};

// ============================================================
// ENSURE ALL COLUMNS EXIST
// ============================================================
const ensureAllColumns = async () => {
  try {
    console.log('🔧 Ensuring all columns exist...');
    
    const tableInfo = await db.execute("PRAGMA table_info(parts)");
    const columns = tableInfo.rows.map(r => r.name);
    
    const requiredColumns = [
      { name: 'unit_price', type: 'REAL DEFAULT 0' },
      { name: 'current_price', type: 'REAL DEFAULT 0' },
      { name: 'average_cost', type: 'REAL DEFAULT 0' },
      { name: 'last_purchase_price', type: 'REAL DEFAULT 0' },
      { name: 'maintenance_type', type: 'TEXT DEFAULT "none"' },
      { name: 'service_interval_hours', type: 'INTEGER DEFAULT 0' },
      { name: 'service_interval_months', type: 'INTEGER DEFAULT 0' },
      { name: 'service_interval_years', type: 'INTEGER DEFAULT 0' },
      { name: 'contact_person', type: 'TEXT' },
      { name: 'contact_phone', type: 'TEXT' },
      { name: 'contact_email', type: 'TEXT' },
      { name: 'max_stock', type: 'INTEGER DEFAULT 0' },
      { name: 'created_at', type: 'DATETIME' },
      { name: 'updated_at', type: 'DATETIME' }
    ];
    
    for (const col of requiredColumns) {
      if (!columns.includes(col.name)) {
        try {
          await db.execute(`ALTER TABLE parts ADD COLUMN ${col.name} ${col.type}`);
          console.log(`✅ Added column: ${col.name}`);
        } catch (e) {
          console.log(`⚠️ Could not add ${col.name}: ${e.message}`);
        }
      }
    }
    
    console.log('✅ Column check complete');
  } catch (error) {
    console.error('❌ Error in ensureAllColumns:', error.message);
  }
};

// ============================================================
// CREATE USERS
// ============================================================
const createUsers = async () => {
  try {
    const check = await db.execute('SELECT COUNT(*) as count FROM users');
    if (check.rows[0].count > 0) {
      console.log('✅ Default users already exist');
      return;
    }

    const adminHash = bcrypt.hashSync('1991', 10);
    const managerHash = bcrypt.hashSync('manager123', 10);
    const keeperHash = bcrypt.hashSync('keeper123', 10);

    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)',
      args: ['admin', adminHash, 'System Admin', 'admin', 'admin@example.com']
    });
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)',
      args: ['manager', managerHash, 'Manager User', 'manager', 'manager@example.com']
    });
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)',
      args: ['storekeeper', keeperHash, 'Store Keeper', 'storekeeper', 'keeper@example.com']
    });

    console.log('✅ Default users created');
  } catch (err) {
    console.error('Error creating users:', err.message);
  }
};

// ============================================================
// CREATE SAMPLE DATA
// ============================================================
const createSampleData = async () => {
  try {
    const count = await db.execute('SELECT COUNT(*) as count FROM parts');
    if (count.rows[0].count > 0) {
      console.log('📦 Sample data already exists');
      return;
    }

    const parts = [
      ['P001', 'Air Filter', 'Donaldson', 'Boeing 737', 'C-03', 25, 5, 28.90, 'month', 0, 3, 0],
      ['P002', 'Hydraulic Fluid', 'Shell', 'Airbus A320', 'D-01', 100, 20, 8.50, 'month', 0, 3, 0],
      ['P003', 'Battery', 'Exide', 'Boeing 737', 'E-01', 2, 5, 10.99, 'year', 0, 0, 1],
      ['P004', 'Fire Extinguisher', 'Amerex', 'All GSE', 'F-01', 8, 2, 89.99, 'year', 0, 0, 1],
      ['P005', 'Load Cell', 'Interface', 'Test Equipment', 'G-01', 5, 1, 225.00, 'month', 0, 6, 0],
      ['P006', 'Hand Tools Set', 'Stanley', 'Hand Tools', 'H-01', 20, 5, 34.50, 'none', 0, 0, 0],
    ];

    for (const part of parts) {
      await db.execute({
        sql: `INSERT INTO parts (
          part_number, description, manufacturer, compatible_gse, 
          location_bin, quantity_on_hand, min_stock, 
          unit_price, maintenance_type, service_interval_hours,
          service_interval_months, service_interval_years,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: part
      });
      console.log(`✅ Added ${part[0]} - ${part[1]}`);
    }

    console.log('✅ Sample data created');
  } catch (err) {
    console.error('Error creating sample data:', err.message);
  }
};

// ============================================================
// LOGIN ROUTE
// ============================================================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GSE MAINTENANCE ROUTES
// ============================================================

// GET ALL MAINTENANCE
app.get('/api/gse-maintenance', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT 
        gm.*,
        p.part_number,
        p.description as part_description
      FROM gse_maintenance gm
      LEFT JOIN parts p ON gm.part_id = p.id
      ORDER BY gm.equipment_name
    `);
    
    const enhanced = result.rows.map(item => {
      let daysRemaining = null;
      let hoursRemaining = null;
      let status = 'serviced';
      let daysOverdue = 0;
      let alertReason = null;

      if (item.next_service_date) {
        daysRemaining = calculateDaysUntil(item.next_service_date);
      }

      if (item.maintenance_type === 'hour' && item.target_hours && item.current_hours !== undefined) {
        hoursRemaining = parseInt(item.target_hours) - (parseInt(item.current_hours) || 0);
      }

      if (item.maintenance_type === 'none') {
        status = 'no_maintenance';
      } else if (item.maintenance_type === 'hour') {
        if (daysRemaining !== null && daysRemaining < 0) {
          status = 'overdue';
          daysOverdue = Math.abs(daysRemaining);
          alertReason = `Date overdue by ${Math.abs(daysRemaining)} days`;
        } else if (hoursRemaining !== null && hoursRemaining < 0) {
          status = 'overdue';
          daysOverdue = Math.abs(hoursRemaining);
          alertReason = `Hours overdue by ${Math.abs(hoursRemaining)} hrs`;
        } else if (daysRemaining !== null && daysRemaining <= 4) {
          status = 'due_soon';
          alertReason = `Date due in ${daysRemaining} days`;
        } else if (hoursRemaining !== null && hoursRemaining <= 40) {
          status = 'due_soon';
          alertReason = `Hours due in ${hoursRemaining} hrs`;
        } else {
          status = 'serviced';
        }
      } else if (item.maintenance_type === 'month') {
        if (daysRemaining !== null) {
          if (daysRemaining < 0) {
            status = 'overdue';
            daysOverdue = Math.abs(daysRemaining);
          } else if (daysRemaining <= 7) {
            status = 'due_soon';
          } else {
            status = 'serviced';
          }
        }
      } else if (item.maintenance_type === 'year') {
        if (item.next_service_year) {
          const currentYear = new Date().getFullYear();
          const yearsRemaining = parseInt(item.next_service_year) - currentYear;
          if (yearsRemaining < 0) {
            status = 'overdue';
            daysOverdue = Math.abs(yearsRemaining) * 365;
          } else if (yearsRemaining === 0) {
            status = 'due_soon';
          } else {
            status = 'serviced';
          }
        }
      }

      let currentServiceDisplay = 'Not recorded';
      if (item.maintenance_type === 'hour') {
        if (item.last_service_date && item.last_service_hours !== undefined) {
          currentServiceDisplay = `${new Date(item.last_service_date).toLocaleDateString()} @ ${item.last_service_hours} hrs`;
        } else if (item.last_service_date) {
          currentServiceDisplay = new Date(item.last_service_date).toLocaleDateString();
        }
      } else if (item.maintenance_type === 'month') {
        currentServiceDisplay = item.last_service_date ? new Date(item.last_service_date).toLocaleDateString() : 'Not recorded';
      } else if (item.maintenance_type === 'year') {
        currentServiceDisplay = item.last_service_year ? `${item.last_service_year}` : 'Not recorded';
      }

      return {
        ...item,
        days_remaining: daysRemaining,
        hours_remaining: hoursRemaining,
        remaining_hours: hoursRemaining,
        daysOverdue: daysOverdue,
        alert_reason: alertReason,
        current_service_display: currentServiceDisplay,
        next_service_column: item.next_service_date ? new Date(item.next_service_date).toLocaleDateString() : 'Not scheduled',
        next_service_date: item.next_service_date,
        status: status,
        days_remaining_display: daysRemaining !== null ? daysRemaining : 'N/A'
      };
    });

    res.json({ success: true, equipment: enhanced });
  } catch (err) {
    console.error('Error fetching maintenance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET MAINTENANCE BY ID
app.get('/api/gse-maintenance/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [req.params.id]
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching maintenance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// CREATE MAINTENANCE RECORD
app.post('/api/gse-maintenance', authenticateToken, async (req, res) => {
  const {
    equipment_name,
    equipment_type,
    maintenance_type,
    service_performed,
    technician_name,
    notes,
    last_service_date,
    last_service_hours,
    last_service_year,
    last_service_full_date,
    service_interval_hours,
    service_interval_months,
    service_interval_years,
    service_interval_months_for_hour,
    current_hours,
    target_hours
  } = req.body;

  try {
    let nextServiceDate = null;
    let nextServiceYear = null;
    let status = 'serviced';

    if (maintenance_type === 'hour') {
      if (service_interval_months_for_hour && service_interval_months_for_hour > 0 && last_service_date) {
        nextServiceDate = calculateNextServiceDate(last_service_date, service_interval_months_for_hour);
      }
    } else if (maintenance_type === 'month') {
      if (last_service_date && service_interval_months && service_interval_months > 0) {
        nextServiceDate = calculateNextServiceDate(last_service_date, service_interval_months);
      }
    } else if (maintenance_type === 'year') {
      if (last_service_year && service_interval_years) {
        nextServiceYear = parseInt(last_service_year) + parseInt(service_interval_years);
      }
      if (last_service_full_date && service_interval_years) {
        nextServiceDate = calculateNextServiceDateYears(last_service_full_date, service_interval_years);
      }
    } else if (maintenance_type === 'none') {
      status = 'no_maintenance';
    }

    const result = await db.execute({
      sql: `
        INSERT INTO gse_maintenance (
          equipment_name,
          equipment_type,
          maintenance_type,
          service_performed,
          technician_name,
          notes,
          last_service_date,
          last_service_hours,
          last_service_year,
          last_service_full_date,
          service_interval_hours,
          service_interval_months,
          service_interval_years,
          service_interval_months_for_hour,
          current_hours,
          target_hours,
          next_service_date,
          next_service_year,
          status,
          created_by,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      args: [
        equipment_name,
        equipment_type || 'General',
        maintenance_type || 'none',
        service_performed || '',
        technician_name || '',
        notes || '',
        last_service_date || null,
        last_service_hours || 0,
        last_service_year || null,
        last_service_full_date || null,
        service_interval_hours || 0,
        service_interval_months || 0,
        service_interval_years || 0,
        service_interval_months_for_hour || 0,
        current_hours || 0,
        target_hours || 0,
        nextServiceDate,
        nextServiceYear,
        status,
        req.user.username
      ]
    });

    res.json({
      success: true,
      message: 'Equipment added to maintenance schedule',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating maintenance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE MAINTENANCE RECORD
app.put('/api/gse-maintenance/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    equipment_name,
    equipment_type,
    maintenance_type,
    service_interval_hours,
    service_interval_months,
    service_interval_years,
    service_interval_months_for_hour,
    last_service_date,
    last_service_hours,
    last_service_year,
    last_service_full_date,
    target_hours,
    next_service_date
  } = req.body;

  try {
    let newNextServiceDate = next_service_date || null;
    let newNextServiceYear = null;

    if (maintenance_type === 'hour') {
      if (service_interval_months_for_hour && service_interval_months_for_hour > 0 && last_service_date) {
        newNextServiceDate = calculateNextServiceDate(last_service_date, service_interval_months_for_hour);
      }
    } else if (maintenance_type === 'month') {
      if (last_service_date && service_interval_months && service_interval_months > 0) {
        newNextServiceDate = calculateNextServiceDate(last_service_date, service_interval_months);
      }
    } else if (maintenance_type === 'year') {
      if (last_service_year && service_interval_years) {
        newNextServiceYear = parseInt(last_service_year) + parseInt(service_interval_years);
      }
      if (last_service_full_date && service_interval_years) {
        newNextServiceDate = calculateNextServiceDateYears(last_service_full_date, service_interval_years);
      }
    }

    await db.execute({
      sql: `
        UPDATE gse_maintenance SET
          equipment_name = ?,
          equipment_type = ?,
          maintenance_type = ?,
          service_interval_hours = ?,
          service_interval_months = ?,
          service_interval_years = ?,
          service_interval_months_for_hour = ?,
          last_service_date = ?,
          last_service_hours = ?,
          last_service_year = ?,
          last_service_full_date = ?,
          target_hours = ?,
          next_service_date = ?,
          next_service_year = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [
        equipment_name,
        equipment_type,
        maintenance_type,
        service_interval_hours || 0,
        service_interval_months || 0,
        service_interval_years || 0,
        service_interval_months_for_hour || 0,
        last_service_date || null,
        last_service_hours || 0,
        last_service_year || null,
        last_service_full_date || null,
        target_hours || 0,
        newNextServiceDate,
        newNextServiceYear,
        id
      ]
    });

    res.json({
      success: true,
      message: 'Equipment updated successfully'
    });
  } catch (err) {
    console.error('Error updating maintenance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE CURRENT HOURS
app.put('/api/gse-maintenance/:id/hours', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { current_hours } = req.body;

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const equipment = result.rows[0];
    const hoursRemaining = (equipment.target_hours || equipment.service_interval_hours || 0) - parseInt(current_hours);

    await db.execute({
      sql: `
        UPDATE gse_maintenance SET
          current_hours = ?,
          hours_remaining = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [current_hours, hoursRemaining, id]
    });

    res.json({
      success: true,
      message: 'Hours updated successfully',
      data: { current_hours, hours_remaining: hoursRemaining }
    });
  } catch (err) {
    console.error('Error updating hours:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// RECORD SERVICE - WITH PREVENTIVE VS CORRECTIVE HANDLING
app.post('/api/gse-maintenance/:id/service', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    service_performed,
    technician_name,
    notes,
    service_date,
    current_hours,
    target_hours,
    months_interval,
    maintenance_category // 'preventive' or 'corrective'
  } = req.body;

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const equipment = result.rows[0];
    const isPreventive = maintenance_category === 'preventive';

    let nextServiceDate = null;
    let nextServiceYear = null;
    let status = 'serviced';

    // For Preventive: Update both last and next service dates
    // For Corrective: Only update last service date, keep next_service_date unchanged
    if (isPreventive) {
      // PREVENTIVE: Update the schedule
      if (equipment.maintenance_type === 'hour') {
        const intervalMonths = months_interval || equipment.service_interval_months_for_hour || 0;
        if (intervalMonths > 0 && service_date) {
          nextServiceDate = calculateNextServiceDate(service_date, intervalMonths);
        }
        const newTargetHours = target_hours || equipment.target_hours || equipment.service_interval_hours || 0;
        const newCurrentHours = current_hours || equipment.current_hours || 0;
        
        await db.execute({
          sql: `
            UPDATE gse_maintenance SET
              last_service_date = ?,
              last_service_hours = ?,
              current_hours = ?,
              target_hours = ?,
              service_performed = ?,
              technician_name = ?,
              notes = ?,
              next_service_date = ?,
              service_interval_months_for_hour = ?,
              maintenance_category = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          args: [
            service_date,
            current_hours || 0,
            newCurrentHours,
            newTargetHours,
            service_performed || '',
            technician_name || '',
            notes || '',
            nextServiceDate,
            parseInt(intervalMonths) || 0,
            'preventive',
            status,
            id
          ]
        });
      } else if (equipment.maintenance_type === 'month') {
        const intervalMonths = months_interval || equipment.service_interval_months || 0;
        if (service_date && intervalMonths > 0) {
          nextServiceDate = calculateNextServiceDate(service_date, intervalMonths);
        }
        
        await db.execute({
          sql: `
            UPDATE gse_maintenance SET
              last_service_date = ?,
              service_performed = ?,
              technician_name = ?,
              notes = ?,
              next_service_date = ?,
              service_interval_months = ?,
              maintenance_category = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          args: [
            service_date,
            service_performed || '',
            technician_name || '',
            notes || '',
            nextServiceDate,
            parseInt(intervalMonths) || 0,
            'preventive',
            status,
            id
          ]
        });
      } else if (equipment.maintenance_type === 'year') {
        const currentYear = new Date(service_date).getFullYear();
        const intervalYears = equipment.service_interval_years || 1;
        nextServiceYear = currentYear + parseInt(intervalYears);
        
        await db.execute({
          sql: `
            UPDATE gse_maintenance SET
              last_service_full_date = ?,
              last_service_year = ?,
              service_performed = ?,
              technician_name = ?,
              notes = ?,
              next_service_year = ?,
              maintenance_category = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          args: [
            service_date,
            currentYear,
            service_performed || '',
            technician_name || '',
            notes || '',
            nextServiceYear,
            'preventive',
            status,
            id
          ]
        });
      }
    } else {
      // CORRECTIVE: Only update last_service_date, DO NOT change next_service_date
      if (equipment.maintenance_type === 'hour') {
        await db.execute({
          sql: `
            UPDATE gse_maintenance SET
              last_service_date = ?,
              last_service_hours = ?,
              current_hours = ?,
              service_performed = ?,
              technician_name = ?,
              notes = ?,
              -- next_service_date stays the same
              maintenance_category = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          args: [
            service_date,
            current_hours || 0,
            current_hours || equipment.current_hours || 0,
            service_performed || '',
            technician_name || '',
            notes || '',
            'corrective',
            status,
            id
          ]
        });
      } else if (equipment.maintenance_type === 'month' || equipment.maintenance_type === 'year') {
        await db.execute({
          sql: `
            UPDATE gse_maintenance SET
              last_service_date = ?,
              service_performed = ?,
              technician_name = ?,
              notes = ?,
              -- next_service_date stays the same
              maintenance_category = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          args: [
            service_date,
            service_performed || '',
            technician_name || '',
            notes || '',
            'corrective',
            status,
            id
          ]
        });
      }
    }

    // Record in service history with category
    await db.execute({
      sql: `
        INSERT INTO service_history (
          maintenance_id,
          equipment_name,
          equipment_type,
          maintenance_type,
          service_date,
          service_performed,
          technician_name,
          notes,
          maintenance_category,
          current_hours,
          target_hours,
          service_interval_months,
          service_interval_years,
          recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        equipment.equipment_name,
        equipment.equipment_type,
        equipment.maintenance_type,
        service_date,
        service_performed || '',
        technician_name || '',
        notes || '',
        maintenance_category || 'preventive',
        current_hours || 0,
        target_hours || 0,
        parseInt(months_interval) || 0,
        equipment.service_interval_years || 0,
        req.user.username
      ]
    });

    const categoryText = isPreventive ? 'Preventive' : 'Corrective';
    const scheduleMsg = isPreventive ? ' (Next service date updated)' : ' (Preventive schedule unchanged)';
    
    res.json({
      success: true,
      message: `✅ ${categoryText} service recorded successfully!${scheduleMsg}`
    });
  } catch (err) {
    console.error('Error recording service:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE MAINTENANCE RECORD
app.delete('/api/gse-maintenance/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.execute({
      sql: 'SELECT equipment_name FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    await db.execute({
      sql: 'DELETE FROM service_history WHERE maintenance_id = ?',
      args: [id]
    });
    await db.execute({
      sql: 'DELETE FROM maintenance_attachments WHERE maintenance_id = ?',
      args: [id]
    });
    await db.execute({
      sql: 'DELETE FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    res.json({
      success: true,
      message: 'Equipment deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting equipment:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MAINTENANCE ATTACHMENTS ROUTES
// ============================================================

// GET ATTACHMENTS
app.get('/api/maintenance-attachments/:maintenanceId', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM maintenance_attachments WHERE maintenance_id = ? ORDER BY created_at DESC',
      args: [req.params.maintenanceId]
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching attachments:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// UPLOAD ATTACHMENT
app.post('/api/maintenance-attachment/:maintenanceId', authenticateToken, async (req, res) => {
  const { maintenanceId } = req.params;
  const { filename, file_data, file_type } = req.body;

  try {
    const result = await db.execute({
      sql: `
        INSERT INTO maintenance_attachments (
          maintenance_id,
          filename,
          original_filename,
          file_data,
          file_type,
          uploaded_by
        ) VALUES (?, ?, ?, ?, ?, ?)
        RETURNING *
      `,
      args: [
        maintenanceId,
        filename,
        filename,
        file_data,
        file_type || 'image/png',
        req.user.username
      ]
    });

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error uploading attachment:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DOWNLOAD ATTACHMENT
app.get('/api/maintenance-attachment/:id/download', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM maintenance_attachments WHERE id = ?',
      args: [req.params.id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];
    const fileBuffer = Buffer.from(attachment.file_data, 'base64');

    res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${attachment.original_filename}"`);
    res.send(fileBuffer);
  } catch (err) {
    console.error('Error downloading attachment:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE ATTACHMENT
app.delete('/api/maintenance-attachment/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM maintenance_attachments WHERE id = ?',
      args: [req.params.id]
    });

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting attachment:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MAINTENANCE HISTORY ENDPOINT - GET HISTORY FOR SPECIFIC EQUIPMENT
// ============================================================
app.get('/api/gse-maintenance/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;
    
    // Get equipment details
    const equipmentResult = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });
    
    if (equipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    
    const equipment = equipmentResult.rows[0];
    
    // Get history from service_history table with category
    const historyResult = await db.execute({
      sql: `
        SELECT 
          service_date,
          service_performed,
          technician_name as technician,
          current_hours as hours_at_service,
          service_interval_months as interval_months,
          notes,
          next_service_date as next_service_due,
          COALESCE(maintenance_category, 'preventive') as category,
          created_at
        FROM service_history
        WHERE maintenance_id = ?
        ORDER BY service_date DESC
        ${limit ? `LIMIT ${parseInt(limit)}` : ''}
      `,
      args: [id]
    });
    
    res.json({
      equipment: {
        id: equipment.id,
        name: equipment.equipment_name,
        type: equipment.equipment_type,
        status: equipment.status,
        last_service_date: equipment.last_service_date,
        next_service_date: equipment.next_service_date,
        current_hours: equipment.current_hours,
        target_hours: equipment.target_hours
      },
      history: historyResult.rows
    });
  } catch (err) {
    console.error('Error fetching maintenance history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SERVICE HISTORY REPORT ENDPOINTS
// ============================================================

// GET ALL SERVICE HISTORY WITH FILTERS
app.get('/api/service-history/all', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, equipmentName, technician, category } = req.query;
    
    console.log('📊 Service History Report Request:');
    console.log('   Start Date:', startDate);
    console.log('   End Date:', endDate);
    console.log('   Equipment:', equipmentName);
    console.log('   Technician:', technician);
    console.log('   Category:', category);
    
    let query = `
      SELECT 
        sh.id,
        sh.maintenance_id,
        sh.equipment_name,
        sh.equipment_type,
        sh.maintenance_type,
        sh.service_date,
        sh.service_performed as services_performed,
        sh.technician_name as technician,
        sh.notes,
        sh.maintenance_category as category,
        sh.current_hours,
        sh.target_hours,
        sh.service_interval_months,
        sh.service_interval_years,
        sh.recorded_by,
        sh.created_at,
        gm.status,
        gm.next_service_date,
        gm.last_service_date
      FROM service_history sh
      LEFT JOIN gse_maintenance gm ON gm.id = sh.maintenance_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (startDate) {
      query += ` AND date(sh.service_date) >= date(?)`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND date(sh.service_date) <= date(?)`;
      params.push(endDate);
    }
    
    if (equipmentName) {
      query += ` AND sh.equipment_name LIKE ?`;
      params.push(`%${equipmentName}%`);
    }
    
    if (technician) {
      query += ` AND sh.technician_name LIKE ?`;
      params.push(`%${technician}%`);
    }
    
    if (category && category !== 'All Categories') {
      query += ` AND sh.maintenance_category = ?`;
      params.push(category);
    }
    
    query += ` ORDER BY sh.service_date DESC`;
    
    console.log('📝 Executing query with params:', params);
    
    const result = await db.execute({ sql: query, args: params });
    
    console.log(`✅ Found ${result.rows.length} service history records`);
    
    const enhanced = result.rows.map(row => ({
      ...row,
      service_date: row.service_date ? row.service_date : null,
      next_service_date: row.next_service_date ? row.next_service_date : null,
      status: row.status ? row.status.toUpperCase() : 'UNKNOWN'
    }));
    
    res.json(enhanced);
  } catch (err) {
    console.error('❌ Error fetching service history:', err.message);
    res.status(500).json({ 
      error: 'Failed to fetch service history',
      details: err.message 
    });
  }
});

// GET SERVICE HISTORY BY EQUIPMENT
app.get('/api/service-history/equipment/:equipmentId', authenticateToken, async (req, res) => {
  try {
    const { equipmentId } = req.params;
    
    const result = await db.execute({
      sql: `
        SELECT 
          sh.*,
          gm.status,
          gm.next_service_date,
          gm.last_service_date
        FROM service_history sh
        LEFT JOIN gse_maintenance gm ON gm.id = sh.maintenance_id
        WHERE sh.maintenance_id = ?
        ORDER BY sh.service_date DESC
      `,
      args: [equipmentId]
    });
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching equipment history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET SERVICE HISTORY STATISTICS
app.get('/api/service-history/stats', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT 
        COUNT(*) as total_services,
        COUNT(DISTINCT maintenance_id) as unique_equipment,
        COUNT(DISTINCT technician_name) as unique_technicians,
        SUM(CASE WHEN gm.status = 'serviced' THEN 1 ELSE 0 END) as serviced_count,
        SUM(CASE WHEN gm.status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN gm.status = 'due_soon' THEN 1 ELSE 0 END) as due_soon_count
      FROM service_history sh
      LEFT JOIN gse_maintenance gm ON gm.id = sh.maintenance_id
    `);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching service stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PARTS CRUD ROUTES
// ============================================================

// GET ALL PARTS
app.get('/api/parts', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM parts ORDER BY part_number');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching parts:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET PART BY ID
app.get('/api/parts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM parts WHERE id = ?',
      args: [req.params.id]
    });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching part:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================================
// ONE-TIME FIX: Update NULL categories in service_history
// ============================================================
app.post('/api/fix-categories', authenticateToken, async (req, res) => {
  try {
    // Only admin can run this
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('🔧 Fixing NULL categories in service_history...');

    // Check current NULL records
    const checkResult = await db.execute(`
      SELECT COUNT(*) as count FROM service_history 
      WHERE maintenance_category IS NULL OR maintenance_category = ''
    `);
    const nullCount = checkResult.rows[0].count;
    console.log(`📊 Found ${nullCount} records with NULL categories`);

    // Update NULL categories to 'preventive'
    await db.execute(`
      UPDATE service_history 
      SET maintenance_category = 'preventive' 
      WHERE maintenance_category IS NULL OR maintenance_category = ''
    `);

    // Verify the update
    const verifyResult = await db.execute(`
      SELECT COUNT(*) as count FROM service_history 
      WHERE maintenance_category IS NULL OR maintenance_category = ''
    `);
    const remaining = verifyResult.rows[0].count;

    console.log(`✅ Updated ${nullCount} records. Remaining NULL: ${remaining}`);

    res.json({
      success: true,
      message: `✅ Fixed ${nullCount} records. Remaining NULL: ${remaining}`,
      fixedCount: nullCount,
      remaining: remaining
    });
  } catch (err) {
    console.error('❌ Error fixing categories:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// START SERVER
// ============================================================
const startServer = async () => {
  try {
    console.log('🚀 Starting GSE Inventory Server...');
    
    await initDatabase();
    console.log('✅ Database connection established');
    
    await createTables();
    console.log('✅ Tables created/verified');
    
    await ensureAllColumns();
    console.log('✅ Columns verified');
    
    await createUsers();
    console.log('✅ Users created');
    
    await createSampleData();
    console.log('✅ Sample data initialized');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ GSE Server running on port ${PORT}`);
      console.log(`\n📋 Login with:`);
      console.log(`   admin / 1991 (Admin)`);
      console.log(`   manager / manager123 (Manager)`);
      console.log(`   storekeeper / keeper123 (Storekeeper)`);
      console.log(`\n📊 Service History API:`);
      console.log(`   GET /api/service-history/all - All history with filters`);
      console.log(`   GET /api/service-history/equipment/:id - By equipment`);
      console.log(`   GET /api/service-history/stats - Statistics`);
      console.log(`\n📋 Maintenance History API:`);
      console.log(`   GET /api/gse-maintenance/:id/history - Get history for equipment`);
      console.log(`\n💰 Price History API:`);
      console.log(`   GET /api/price-history/:partId - Get last 10 price changes`);
      console.log(`   GET /api/price-history/full/:partId - Get all price changes`);
      console.log(`   GET /api/price-history/latest/:partId - Get latest price`);
      console.log(`   POST /api/price-history - Add price record and update current price`);
      console.log(`   PUT /api/parts/:partId/price - Update price (React frontend)`);
      console.log(`\n📥 Import API:`);
      console.log(`   POST /api/parts/import - Import parts from Excel with auto-maintenance creation`);
      console.log(`\n🔧 Maintenance Categories:`);
      console.log(`   Preventive - Updates next_service_date`);
      console.log(`   Corrective - Does NOT change next_service_date`);
      console.log(`\n🛠️ Fix Endpoint:`);
      console.log(`   POST /api/fix-categories - Fix NULL categories (Admin only)`);
      console.log(`\n🧪 Test Route:`);
      console.log(`   GET /api/test - Check if server is running`);
    });
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
};

startServer();