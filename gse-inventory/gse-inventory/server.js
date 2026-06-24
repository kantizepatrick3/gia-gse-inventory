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
// DATABASE INITIALIZATION
// ============================================================
const createTables = async () => {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      role TEXT DEFAULT 'storekeeper',
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

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
      current_hours INTEGER DEFAULT 0,
      target_hours INTEGER DEFAULT 0,
      service_interval_months INTEGER DEFAULT 0,
      service_interval_years INTEGER DEFAULT 0,
      recorded_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (maintenance_id) REFERENCES gse_maintenance(id)
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS maintenance_checklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_id INTEGER NOT NULL,
      checklist_item TEXT NOT NULL,
      is_checked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (maintenance_id) REFERENCES gse_maintenance(id)
    )`);

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
    
    console.log('📋 Current columns:', columns.join(', '));
    
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
    
    let added = 0;
    for (const col of requiredColumns) {
      if (!columns.includes(col.name)) {
        try {
          await db.execute(`ALTER TABLE parts ADD COLUMN ${col.name} ${col.type}`);
          console.log(`✅ Added column: ${col.name}`);
          added++;
        } catch (e) {
          console.log(`⚠️ Could not add ${col.name}: ${e.message}`);
        }
      }
    }
    
    if (added > 0) {
      console.log(`✅ Added ${added} new columns`);
    } else {
      console.log('✅ All columns already exist');
    }
    
    try {
      await db.execute(`UPDATE parts SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL`);
      await db.execute(`UPDATE parts SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`);
    } catch (e) {
      console.log('⚠️ Could not update timestamps:', e.message);
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
      ['P001', 'Air Filter', 'Donaldson', 'Boeing 737', 'C-03', 25, 5, 28.90, 'Filter maintenance', 3, 1],
      ['P002', 'Hydraulic Fluid', 'Shell', 'Airbus A320', 'D-01', 100, 20, 8.50, 'Fluid maintenance', 3, 1],
      ['P003', 'Battery', 'Exide', 'Boeing 737', 'E-01', 2, 5, 10.99, 'Battery maintenance', 6, 1],
      ['P004', 'Fire Extinguisher', 'Amerex', 'All GSE', 'F-01', 8, 2, 89.99, 'Safety maintenance', 12, 1],
      ['P005', 'Load Cell', 'Interface', 'Test Equipment', 'G-01', 5, 1, 225.00, 'Calibration', 6, 1],
      ['P006', 'Hand Tools Set', 'Stanley', 'Hand Tools', 'H-01', 20, 5, 34.50, 'none', 0, 0],
    ];

    for (const part of parts) {
      await db.execute({
        sql: `INSERT INTO parts (
          part_number, description, manufacturer, compatible_gse, 
          location_bin, quantity_on_hand, min_stock, 
          unit_price, maintenance_type, service_interval_months, 
          service_interval_years, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
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
// LOGIN
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

// CREATE PART
app.post('/api/parts', authenticateToken, async (req, res) => {
  const { 
    part_number, 
    description, 
    manufacturer, 
    compatible_gse, 
    location_bin, 
    min_stock,
    quantity_on_hand,
    unit_price,
    current_price,
    maintenance_type,
    service_interval_hours,
    service_interval_months,
    service_interval_years,
    contact_person,
    contact_phone,
    contact_email
  } = req.body;
  
  try {
    console.log('📝 Creating part:', { part_number, description, manufacturer });
    
    if (!part_number) {
      return res.status(400).json({ error: 'Part number is required' });
    }
    
    const existing = await db.execute({ 
      sql: 'SELECT id FROM parts WHERE part_number = ?', 
      args: [part_number] 
    });
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Part number already exists' });
    }
    
    const tableInfo = await db.execute("PRAGMA table_info(parts)");
    const columns = tableInfo.rows.map(r => r.name);
    
    const insertFields = [];
    const placeholders = [];
    const values = [];
    
    const fieldMap = {
      part_number, description, manufacturer, compatible_gse, location_bin,
      min_stock: min_stock || 5,
      quantity_on_hand: quantity_on_hand || 0,
      unit_price: unit_price || 0,
      current_price: current_price || 0,
      average_cost: unit_price || 0,
      last_purchase_price: unit_price || 0,
      maintenance_type: maintenance_type || 'none',
      service_interval_hours: service_interval_hours || 0,
      service_interval_months: service_interval_months || 0,
      service_interval_years: service_interval_years || 0,
      contact_person: contact_person || '',
      contact_phone: contact_phone || '',
      contact_email: contact_email || ''
    };
    
    for (const [key, value] of Object.entries(fieldMap)) {
      if (columns.includes(key)) {
        insertFields.push(key);
        placeholders.push('?');
        values.push(value);
      }
    }
    
    if (columns.includes('created_at')) {
      insertFields.push('created_at');
      placeholders.push('CURRENT_TIMESTAMP');
    }
    if (columns.includes('updated_at')) {
      insertFields.push('updated_at');
      placeholders.push('CURRENT_TIMESTAMP');
    }
    
    const query = `INSERT INTO parts (${insertFields.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const result = await db.execute({ sql: query, args: values });
    
    const partId = result.lastInsertRowid;
    console.log(`✅ Part inserted with ID: ${partId}`);
    
    if (maintenance_type && maintenance_type !== 'none') {
      try {
        const today = new Date().toISOString().split('T')[0];
        const eqName = part_number;
        const eqType = manufacturer || 'GSE Part';
        
        const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gse_maintenance'");
        if (tables.rows.length > 0) {
          if (maintenance_type === 'year') {
            await db.execute({
              sql: `INSERT INTO gse_maintenance (equipment_name, equipment_type, maintenance_type, part_id, last_service_full_date, service_interval_years, status, created_by)
                    VALUES (?, ?, 'year', ?, ?, ?, 'serviced', ?)`,
              args: [eqName, eqType, partId, today, parseInt(service_interval_years) || 1, req.user.username]
            });
          } else if (maintenance_type === 'month') {
            await db.execute({
              sql: `INSERT INTO gse_maintenance (equipment_name, equipment_type, maintenance_type, part_id, last_service_date, service_interval_months, status, created_by)
                    VALUES (?, ?, 'month', ?, ?, ?, 'serviced', ?)`,
              args: [eqName, eqType, partId, today, parseInt(service_interval_months) || 6, req.user.username]
            });
          } else {
            await db.execute({
              sql: `INSERT INTO gse_maintenance (equipment_name, equipment_type, maintenance_type, part_id, last_service_date, service_interval_hours, target_hours, status, created_by)
                    VALUES (?, ?, 'hour', ?, ?, ?, ?, 'serviced', ?)`,
              args: [eqName, eqType, partId, today, parseInt(service_interval_hours) || 250, parseInt(service_interval_hours) || 250, req.user.username]
            });
          }
          console.log(`✅ Maintenance record created for part: ${part_number}`);
        }
      } catch (e) {
        console.log('⚠️ Could not create maintenance record:', e.message);
      }
    }
    
    if (unit_price > 0) {
      try {
        await db.execute({
          sql: `INSERT INTO price_history (part_id, price, quantity, transaction_type, notes, recorded_by)
                VALUES (?, ?, ?, 'INITIAL', 'Initial price set', ?)`,
          args: [partId, unit_price, quantity_on_hand || 1, req.user.username]
        });
        console.log(`✅ Price history recorded for part: ${part_number}`);
      } catch (e) {
        console.log('⚠️ Could not record price history:', e.message);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Part added successfully!', 
      id: Number(partId) 
    });
  } catch (err) {
    console.error('Create part error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// BULK IMPORT FROM EXCEL - FIXED
// ============================================================
app.post('/api/parts/bulk-import', authenticateToken, async (req, res) => {
  const { parts } = req.body;
  
  console.log(`📊 Bulk import: Received ${parts?.length || 0} parts`);
  
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: 'No parts data provided' });
  }

  try {
    const tableInfo = await db.execute("PRAGMA table_info(parts)");
    const columns = tableInfo.rows.map(r => r.name);
    console.log('📋 Available columns:', columns.join(', '));

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    for (const part of parts) {
      try {
        const {
          part_number,
          description,
          manufacturer,
          compatible_gse,
          location_bin,
          min_stock,
          stock,
          unit_price,
          current_price,
          maintenance_type,
          service_interval_hours,
          service_interval_months,
          service_interval_years,
          contact_person,
          contact_phone,
          contact_email
        } = part;

        if (!part_number) {
          failed++;
          errors.push({ part: part_number || 'unknown', error: 'Part number is required' });
          continue;
        }

        console.log(`📝 Processing: ${part_number} - ${description}`);

        const existing = await db.execute({
          sql: 'SELECT id FROM parts WHERE part_number = ?',
          args: [part_number]
        });

        const fieldMap = {
          'part_number': part_number,
          'description': description || '',
          'manufacturer': manufacturer || '',
          'compatible_gse': compatible_gse || '',
          'location_bin': location_bin || '',
          'min_stock': min_stock || 5,
          'quantity_on_hand': stock || 0,
          'unit_price': unit_price || 0,
          'current_price': current_price || 0,
          'average_cost': unit_price || 0,
          'last_purchase_price': unit_price || 0,
          'maintenance_type': maintenance_type || 'none',
          'service_interval_hours': service_interval_hours || 0,
          'service_interval_months': service_interval_months || 0,
          'service_interval_years': service_interval_years || 0,
          'contact_person': contact_person || '',
          'contact_phone': contact_phone || '',
          'contact_email': contact_email || ''
        };

        if (existing.rows.length > 0) {
          const updates = [];
          const values = [];
          
          for (const [key, value] of Object.entries(fieldMap)) {
            if (columns.includes(key)) {
              updates.push(`${key} = ?`);
              values.push(value);
            }
          }
          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(part_number);

          const query = `UPDATE parts SET ${updates.join(', ')} WHERE part_number = ?`;
          await db.execute({ sql: query, args: values });
          console.log(`   ✅ Updated: ${part_number}`);
          updated++;

        } else {
          const insertFields = [];
          const placeholders = [];
          const values = [];

          for (const [key, value] of Object.entries(fieldMap)) {
            if (columns.includes(key)) {
              insertFields.push(key);
              placeholders.push('?');
              values.push(value);
            }
          }

          if (columns.includes('created_at')) {
            insertFields.push('created_at');
            placeholders.push('CURRENT_TIMESTAMP');
          }
          if (columns.includes('updated_at')) {
            insertFields.push('updated_at');
            placeholders.push('CURRENT_TIMESTAMP');
          }

          const query = `INSERT INTO parts (${insertFields.join(', ')}) VALUES (${placeholders.join(', ')})`;
          const result = await db.execute({ sql: query, args: values });
          console.log(`   ✅ Inserted: ${part_number} (ID: ${result.lastInsertRowid})`);
          inserted++;

          if (maintenance_type && maintenance_type !== 'none') {
            try {
              const today = new Date().toISOString().split('T')[0];
              const eqName = part_number;
              const eqType = manufacturer || 'GSE Part';
              
              const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gse_maintenance'");
              if (tables.rows.length > 0) {
                if (maintenance_type === 'year') {
                  await db.execute({
                    sql: `INSERT INTO gse_maintenance (equipment_name, equipment_type, maintenance_type, part_id, last_service_full_date, service_interval_years, status, created_by)
                          VALUES (?, ?, 'year', ?, ?, ?, 'serviced', ?)`,
                    args: [eqName, eqType, result.lastInsertRowid, today, parseInt(service_interval_years) || 1, req.user.username]
                  });
                } else if (maintenance_type === 'month') {
                  await db.execute({
                    sql: `INSERT INTO gse_maintenance (equipment_name, equipment_type, maintenance_type, part_id, last_service_date, service_interval_months, status, created_by)
                          VALUES (?, ?, 'month', ?, ?, ?, 'serviced', ?)`,
                    args: [eqName, eqType, result.lastInsertRowid, today, parseInt(service_interval_months) || 6, req.user.username]
                  });
                } else if (maintenance_type === 'hour') {
                  await db.execute({
                    sql: `INSERT INTO gse_maintenance (equipment_name, equipment_type, maintenance_type, part_id, last_service_date, service_interval_hours, target_hours, status, created_by)
                          VALUES (?, ?, 'hour', ?, ?, ?, ?, 'serviced', ?)`,
                    args: [eqName, eqType, result.lastInsertRowid, today, parseInt(service_interval_hours) || 250, parseInt(service_interval_hours) || 250, req.user.username]
                  });
                }
                console.log(`   ✅ Maintenance record created for: ${part_number}`);
              }
            } catch (e) {
              console.log(`   ⚠️ Could not create maintenance record: ${e.message}`);
            }
          }

          if (unit_price > 0) {
            try {
              await db.execute({
                sql: `INSERT INTO price_history (part_id, price, quantity, transaction_type, notes, recorded_by)
                      VALUES (?, ?, ?, 'INITIAL', 'Initial price from Excel import', ?)`,
                args: [result.lastInsertRowid, unit_price, stock || 1, req.user.username]
              });
              console.log(`   ✅ Price history recorded`);
            } catch (e) {
              console.log(`   ⚠️ Could not record price history: ${e.message}`);
            }
          }
        }

      } catch (rowError) {
        console.error(`❌ Error processing row:`, rowError.message);
        failed++;
        errors.push({ part: part.part_number || 'unknown', error: rowError.message });
      }
    }

    res.json({
      success: true,
      summary: {
        inserted,
        updated,
        failed,
        total: parts.length
      },
      errors: errors.length > 0 ? errors : undefined,
      message: `✅ Import complete! ${inserted} new parts, ${updated} updated, ${failed} failed.`
    });

  } catch (err) {
    console.error('❌ Bulk import error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE PART
app.put('/api/parts/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Admin or Manager access required' });
  }
  
  const { id } = req.params;
  const {
    part_number,
    description,
    manufacturer,
    compatible_gse,
    location_bin,
    min_stock,
    quantity_on_hand,
    unit_price,
    current_price,
    maintenance_type,
    service_interval_hours,
    service_interval_months,
    service_interval_years,
    contact_person,
    contact_phone,
    contact_email
  } = req.body;
  
  try {
    const partResult = await db.execute({ sql: 'SELECT * FROM parts WHERE id = ?', args: [id] });
    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    const oldPart = partResult.rows[0];
    
    await db.execute({
      sql: `UPDATE parts SET 
        part_number = ?,
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
        WHERE id = ?`,
      args: [
        part_number || oldPart.part_number,
        description || oldPart.description,
        manufacturer || oldPart.manufacturer,
        compatible_gse || oldPart.compatible_gse,
        location_bin || oldPart.location_bin,
        min_stock || oldPart.min_stock,
        quantity_on_hand || oldPart.quantity_on_hand,
        unit_price || oldPart.unit_price,
        current_price || oldPart.current_price,
        maintenance_type || oldPart.maintenance_type,
        service_interval_hours || oldPart.service_interval_hours,
        service_interval_months || oldPart.service_interval_months,
        service_interval_years || oldPart.service_interval_years,
        contact_person || oldPart.contact_person,
        contact_phone || oldPart.contact_phone,
        contact_email || oldPart.contact_email,
        id
      ]
    });
    
    res.json({ success: true, message: 'Part updated successfully' });
  } catch (err) {
    console.error('Update part error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE PART
app.delete('/api/parts/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Admin or Manager access required' });
  }
  try {
    const partResult = await db.execute({ sql: 'SELECT part_number FROM parts WHERE id = ?', args: [req.params.id] });
    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    const part = partResult.rows[0];
    
    await db.execute({ sql: 'DELETE FROM price_history WHERE part_id = ?', args: [req.params.id] });
    await db.execute({ sql: 'DELETE FROM transactions WHERE part_id = ?', args: [req.params.id] });
    await db.execute({ sql: 'DELETE FROM pending_issues WHERE part_id = ?', args: [req.params.id] });
    await db.execute({ sql: 'DELETE FROM gse_maintenance WHERE part_id = ?', args: [req.params.id] });
    await db.execute({ sql: 'DELETE FROM parts WHERE id = ?', args: [req.params.id] });
    
    res.json({ success: true, message: `✓ Part "${part.part_number}" deleted!` });
  } catch (err) {
    console.error('Delete part error:', err.message);
    res.status(500).json({ error: 'Delete failed: ' + err.message });
  }
});

// ============================================================
// PRICE HISTORY ROUTES
// ============================================================

app.get('/api/price-history/:partId', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM price_history WHERE part_id = ? ORDER BY created_at DESC',
      args: [req.params.partId]
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Price history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/price-history/full/:partId', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT 
        ph.*,
        p.part_number,
        p.description,
        p.manufacturer
      FROM price_history ph
      JOIN parts p ON p.id = ph.part_id
      WHERE ph.part_id = ?
      ORDER BY ph.created_at DESC`,
      args: [req.params.partId]
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Full price history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/price-history', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Admin or Manager access required' });
  }

  const { part_id, price, quantity, transaction_type, reference_number, notes } = req.body;
  
  try {
    await db.execute({
      sql: `INSERT INTO price_history (part_id, price, quantity, transaction_type, reference_number, notes, recorded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [part_id, price, quantity || 1, transaction_type || 'MANUAL', reference_number || '', notes || '', req.user.username]
    });
    
    await db.execute({
      sql: `UPDATE parts SET current_price = ?, unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [price, price, part_id]
    });
    
    res.json({ success: true, message: 'Price history added successfully' });
  } catch (err) {
    console.error('Add price history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// TRANSACTIONS ROUTES
// ============================================================

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/transactions/part/:partId', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM transactions WHERE part_id = ? ORDER BY created_at DESC',
      args: [req.params.partId]
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching part transactions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/receive', authenticateToken, async (req, res) => {
  const { part_number, quantity, price, reference_number, notes } = req.body;
  const receiveQty = parseInt(quantity);
  const unitPrice = parseFloat(price) || 0;
  
  if (isNaN(receiveQty) || receiveQty <= 0) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }
  
  try {
    const partResult = await db.execute({ 
      sql: 'SELECT id, quantity_on_hand, current_price, average_cost FROM parts WHERE part_number = ?', 
      args: [part_number] 
    });
    
    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    const part = partResult.rows[0];
    const newQuantity = (part.quantity_on_hand || 0) + receiveQty;
    
    const currentTotalCost = (part.average_cost || 0) * (part.quantity_on_hand || 0);
    const newTotalCost = currentTotalCost + (unitPrice * receiveQty);
    const newAverageCost = newQuantity > 0 ? newTotalCost / newQuantity : 0;
    
    await db.execute({ 
      sql: `UPDATE parts SET 
            quantity_on_hand = ?, 
            current_price = ?,
            last_purchase_price = ?,
            average_cost = ?,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`, 
      args: [newQuantity, unitPrice, unitPrice, newAverageCost, part.id] 
    });
    
    await db.execute({ 
      sql: `INSERT INTO transactions (part_id, transaction_type, quantity, price, reference_number, notes, created_by, created_at) 
            VALUES (?, 'RECEIVE', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, 
      args: [part.id, receiveQty, unitPrice, reference_number || '', notes || '', req.user.username] 
    });
    
    await db.execute({ 
      sql: `INSERT INTO price_history (part_id, price, quantity, transaction_type, reference_number, notes, recorded_by) 
            VALUES (?, ?, ?, 'RECEIVE', ?, ?, ?)`, 
      args: [part.id, unitPrice, receiveQty, reference_number || '', notes || '', req.user.username] 
    });
    
    res.json({ 
      success: true, 
      message: `✅ ${receiveQty} units received at $${unitPrice.toFixed(2)} each`,
      new_stock: newQuantity,
      average_cost: newAverageCost,
      current_price: unitPrice
    });
  } catch (err) {
    console.error('Receive error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PENDING ISSUES / APPROVALS ROUTES
// ============================================================

app.get('/api/requests/pending', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const result = await db.execute("SELECT * FROM pending_issues WHERE status = 'pending' ORDER BY created_at DESC");
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    console.error('Error fetching pending requests:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/requests/my-requests', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM pending_issues WHERE requested_by = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    console.error('Error fetching my requests:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests/issue', authenticateToken, async (req, res) => {
  const { part_number, quantity, gse_registration, technician_name, work_order, notes } = req.body;
  const requestQty = parseInt(quantity);
  if (isNaN(requestQty) || requestQty <= 0) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }
  
  try {
    const partResult = await db.execute({ 
      sql: 'SELECT id, quantity_on_hand FROM parts WHERE part_number = ?', 
      args: [part_number] 
    });
    
    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    const part = partResult.rows[0];
    if ((part.quantity_on_hand || 0) < requestQty) {
      return res.status(400).json({ error: `Insufficient stock! Only ${part.quantity_on_hand} units available.` });
    }
    
    await db.execute({ 
      sql: `INSERT INTO pending_issues (part_number, part_id, quantity, gse_registration, technician_name, work_order, notes, requested_by, requested_by_name, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`, 
      args: [part_number, part.id, requestQty, gse_registration || '', technician_name || '', work_order || '', notes || '', req.user.id, req.user.username] 
    });
    
    res.json({ success: true, message: 'Issue request submitted for approval' });
  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests/:id/approve', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    const requestResult = await db.execute({ 
      sql: "SELECT * FROM pending_issues WHERE id = ? AND status = 'pending'", 
      args: [id] 
    });
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const request = requestResult.rows[0];
    const requestQty = parseInt(request.quantity);
    
    const partResult = await db.execute({ 
      sql: 'SELECT quantity_on_hand FROM parts WHERE id = ?', 
      args: [request.part_id] 
    });
    
    const currentStock = partResult.rows[0].quantity_on_hand;
    const newStock = currentStock - requestQty;
    
    if (currentStock < requestQty) {
      return res.status(400).json({ error: `Insufficient stock! Only ${currentStock} units available.` });
    }
    
    await db.execute({ 
      sql: `INSERT INTO transactions (part_id, transaction_type, quantity, gse_registration, technician_name, work_order, notes, created_by, created_at) 
            VALUES (?, 'ISSUE', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, 
      args: [request.part_id, requestQty, request.gse_registration || '', request.technician_name || '', request.work_order || '', request.notes || '', req.user.username] 
    });
    
    await db.execute({ 
      sql: 'UPDATE parts SET quantity_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      args: [newStock, request.part_id] 
    });
    
    await db.execute({ 
      sql: "UPDATE pending_issues SET status = 'approved', admin_comment = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?", 
      args: [comment || null, req.user.username, id] 
    });
    
    res.json({ success: true, message: 'Request approved and stock deducted' });
  } catch (err) {
    console.error('Approve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests/:id/reject', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    await db.execute({ 
      sql: "UPDATE pending_issues SET status = 'rejected', admin_comment = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?", 
      args: [comment || null, req.user.username, id] 
    });
    
    res.json({ success: true, message: 'Request rejected' });
  } catch (err) {
    console.error('Reject error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MAINTENANCE ROUTES
// ============================================================

app.get('/api/gse-maintenance', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM gse_maintenance ORDER BY equipment_name');
    res.json({ success: true, equipment: result.rows });
  } catch (err) {
    console.error('Error fetching maintenance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gse-maintenance/part/:partId', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE part_id = ?',
      args: [req.params.partId]
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching maintenance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// REPORTS AND DASHBOARD
// ============================================================

app.get('/api/reports/low-stock', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute('SELECT part_number, description, quantity_on_hand, min_stock, location_bin FROM parts WHERE quantity_on_hand <= min_stock');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching low stock report:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/summary', authenticateToken, async (req, res) => {
  try {
    const lowStock = await db.execute('SELECT COUNT(*) as count FROM parts WHERE quantity_on_hand <= min_stock');
    const pendingRequests = await db.execute("SELECT COUNT(*) as count FROM pending_issues WHERE status = 'pending'");
    const totalParts = await db.execute('SELECT COUNT(*) as count FROM parts');
    const totalMaintenance = await db.execute('SELECT COUNT(*) as count FROM gse_maintenance');

    res.json({
      lowStockCount: Number(lowStock.rows[0]?.count || 0),
      pendingRequests: Number(pendingRequests.rows[0]?.count || 0),
      totalParts: Number(totalParts.rows[0]?.count || 0),
      totalMaintenance: Number(totalMaintenance.rows[0]?.count || 0)
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
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
    });
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
};

startServer();