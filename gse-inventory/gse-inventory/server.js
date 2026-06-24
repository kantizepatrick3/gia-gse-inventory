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
// GSE MAINTENANCE ROUTES - COMPLETE
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
    
    // Enhance each record with calculated fields matching frontend expectations
    const enhanced = result.rows.map(item => {
      let daysRemaining = null;
      let hoursRemaining = null;
      let status = 'serviced';
      let daysOverdue = 0;
      let alertReason = null;

      // Calculate days remaining if next_service_date exists
      if (item.next_service_date) {
        daysRemaining = calculateDaysUntil(item.next_service_date);
      }

      // Calculate hours remaining for hour-based maintenance
      if (item.maintenance_type === 'hour' && item.target_hours && item.current_hours !== undefined) {
        hoursRemaining = parseInt(item.target_hours) - (parseInt(item.current_hours) || 0);
      }

      // Determine status based on conditions
      if (item.maintenance_type === 'none') {
        status = 'no_maintenance';
      } else if (item.maintenance_type === 'hour') {
        // Check both conditions
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

      // Build display values for frontend
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

      // Return enhanced object matching frontend expectations
      return {
        ...item,
        days_remaining: daysRemaining,
        hours_remaining: hoursRemaining,
        remaining_hours: hoursRemaining,
        daysOverdue: daysOverdue,
        alert_reason: alertReason,
        current_service_display: currentServiceDisplay,
        next_service_column: item.next_service_date ? new Date(item.next_service_date).toLocaleDateString() : 'Not scheduled',
        // Important: Keep next_service_date as ISO string for frontend formatDate function
        next_service_date: item.next_service_date,
        status: status,
        // For month-based display
        days_remaining_display: daysRemaining !== null ? daysRemaining : 'N/A'
      };
    });

    console.log(`✅ Returning ${enhanced.length} maintenance records`);
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

    // Calculate next service based on maintenance type
    if (maintenance_type === 'hour') {
      if (service_interval_months_for_hour && service_interval_months_for_hour > 0 && last_service_date) {
        nextServiceDate = calculateNextServiceDate(last_service_date, service_interval_months_for_hour);
      }
      if (service_interval_hours) {
        // target_hours is the same as service_interval_hours for hour-based
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

// RECORD SERVICE
app.post('/api/gse-maintenance/:id/service', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    service_performed,
    technician_name,
    notes,
    service_date,
    current_hours,
    target_hours,
    months_interval
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
    let nextServiceDate = null;
    let nextServiceYear = null;
    let status = 'serviced';

    // Calculate next service based on maintenance type
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
          status,
          id
        ]
      });
    }

    // Record in service history
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
        equipment.maintenance_category || 'preventive',
        current_hours || 0,
        target_hours || 0,
        parseInt(months_interval) || 0,
        equipment.service_interval_years || 0,
        req.user.username
      ]
    });

    res.json({
      success: true,
      message: '✅ Service recorded successfully!'
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

    // Delete associated records first
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

// GET ATTACHMENTS FOR MAINTENANCE RECORD
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
// PARTS CRUD ROUTES (Basic)
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
      console.log(`\n📊 Maintenance API Endpoints:`);
      console.log(`   GET    /api/gse-maintenance - All equipment with status`);
      console.log(`   POST   /api/gse-maintenance - Add equipment`);
      console.log(`   PUT    /api/gse-maintenance/:id - Update equipment`);
      console.log(`   DELETE /api/gse-maintenance/:id - Delete equipment`);
      console.log(`   PUT    /api/gse-maintenance/:id/hours - Update hours`);
      console.log(`   POST   /api/gse-maintenance/:id/service - Record service`);
      console.log(`   GET    /api/maintenance-attachments/:id - Get attachments`);
      console.log(`   POST   /api/maintenance-attachment/:id - Upload attachment`);
      console.log(`   DELETE /api/maintenance-attachment/:id - Delete attachment`);
    });
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
};

startServer();