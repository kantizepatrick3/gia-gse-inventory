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

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
    ip: req.ip,
    user: req.user?.username || 'unauthenticated'
  });
  next();
});

// ============================================================
// 🧪 TEST ROUTE - Must be at the top
// ============================================================
app.get('/api/test', (req, res) => {
  console.log('🧪 Test route called!');
  res.json({
    status: 'OK',
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    routes: {
      test: '/api/test',
      login: '/api/login',
      parts: '/api/parts',
      partsCount: '/api/parts/count',
      users: '/api/users',
      issue: '/api/requests/issue',
      myRequests: '/api/requests/my-requests',
      approvals: '/api/approvals/pending',
      approvalsCount: '/api/approvals/pending/count',
      approve: '/api/approvals/:id/approve',
      reject: '/api/approvals/:id/reject',
      priceHistory: '/api/price-history/:partId',
      dashboard: '/api/dashboard/stats',
      maintenance: '/api/gse-maintenance',
      serviceHistory: '/api/gse-maintenance/:id/history'
    }
  });
});

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
    // Try fallback
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
    console.error('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// USERS ROUTES
// ============================================================
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await db.execute({
      sql: 'SELECT id, username, full_name, role, email FROM users ORDER BY id',
      args: []
    });
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { username, password, full_name, role, email } = req.body;

    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [username]
    });

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `Username "${username}" already exists` });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = await db.execute({
      sql: `INSERT INTO users (username, password_hash, full_name, role, email)
            VALUES (?, ?, ?, ?, ?) RETURNING id, username, full_name, role, email`,
      args: [username, hashedPassword, full_name || username, role || 'storekeeper', email || '']
    });

    res.status(201).json({
      success: true,
      message: `User "${username}" created successfully`,
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating user:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const userCheck = await db.execute({
      sql: 'SELECT username FROM users WHERE id = ?',
      args: [id]
    });

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userCheck.rows[0].username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete the admin user' });
    }

    await db.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [id]
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PARTS ROUTES
// ============================================================
app.get('/api/parts', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM parts ORDER BY part_number',
      args: []
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching parts:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/parts/count', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM parts',
      args: []
    });
    res.json({ count: result.rows[0]?.count || 0 });
  } catch (err) {
    console.error('Error fetching parts count:', err.message);
    res.json({ count: 0 });
  }
});

app.get('/api/parts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: 'SELECT * FROM parts WHERE id = ?',
      args: [id]
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

app.post('/api/parts', authenticateToken, async (req, res) => {
  try {
    const { 
      part_number, description, manufacturer, compatible_gse,
      location_bin, quantity_on_hand, min_stock, max_stock,
      unit_price, maintenance_type, service_interval_hours,
      service_interval_months, service_interval_years,
      contact_person, contact_phone, contact_email
    } = req.body;

    // Validate required fields
    if (!part_number) {
      return res.status(400).json({ error: 'Part number is required' });
    }

    // Check for duplicate part number
    const existing = await db.execute({
      sql: 'SELECT id FROM parts WHERE part_number = ?',
      args: [part_number]
    });

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `Part number "${part_number}" already exists` });
    }

    const result = await db.execute({
      sql: `INSERT INTO parts 
            (part_number, description, manufacturer, compatible_gse,
             location_bin, quantity_on_hand, min_stock, max_stock,
             unit_price, maintenance_type, service_interval_hours,
             service_interval_months, service_interval_years,
             contact_person, contact_phone, contact_email,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING *`,
      args: [
        part_number, description || '', manufacturer || '', compatible_gse || '',
        location_bin || '', quantity_on_hand || 0, min_stock || 0, max_stock || 0,
        unit_price || 0, maintenance_type || 'none', service_interval_hours || 0,
        service_interval_months || 0, service_interval_years || 0,
        contact_person || '', contact_phone || '', contact_email || ''
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Part created successfully',
      part: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating part:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/parts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      part_number, description, manufacturer, compatible_gse,
      location_bin, quantity_on_hand, min_stock, max_stock,
      unit_price, maintenance_type, service_interval_hours,
      service_interval_months, service_interval_years,
      contact_person, contact_phone, contact_email
    } = req.body;

    // Check if part exists
    const partCheck = await db.execute({
      sql: 'SELECT id FROM parts WHERE id = ?',
      args: [id]
    });

    if (partCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    // Check for duplicate part number (excluding current part)
    if (part_number) {
      const duplicate = await db.execute({
        sql: 'SELECT id FROM parts WHERE part_number = ? AND id != ?',
        args: [part_number, id]
      });
      if (duplicate.rows.length > 0) {
        return res.status(400).json({ error: `Part number "${part_number}" already exists` });
      }
    }

    const result = await db.execute({
      sql: `UPDATE parts SET 
            part_number = COALESCE(?, part_number),
            description = COALESCE(?, description),
            manufacturer = COALESCE(?, manufacturer),
            compatible_gse = COALESCE(?, compatible_gse),
            location_bin = COALESCE(?, location_bin),
            quantity_on_hand = COALESCE(?, quantity_on_hand),
            min_stock = COALESCE(?, min_stock),
            max_stock = COALESCE(?, max_stock),
            unit_price = COALESCE(?, unit_price),
            maintenance_type = COALESCE(?, maintenance_type),
            service_interval_hours = COALESCE(?, service_interval_hours),
            service_interval_months = COALESCE(?, service_interval_months),
            service_interval_years = COALESCE(?, service_interval_years),
            contact_person = COALESCE(?, contact_person),
            contact_phone = COALESCE(?, contact_phone),
            contact_email = COALESCE(?, contact_email),
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            RETURNING *`,
      args: [
        part_number, description, manufacturer, compatible_gse,
        location_bin, quantity_on_hand, min_stock, max_stock,
        unit_price, maintenance_type, service_interval_hours,
        service_interval_months, service_interval_years,
        contact_person, contact_phone, contact_email,
        id
      ]
    });

    res.json({
      success: true,
      message: 'Part updated successfully',
      part: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating part:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/parts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if part exists
    const partCheck = await db.execute({
      sql: 'SELECT part_number FROM parts WHERE id = ?',
      args: [id]
    });

    if (partCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    // Check if part is used in any pending issues
    const pendingCheck = await db.execute({
      sql: 'SELECT id FROM pending_issues WHERE part_id = ? AND status = "pending"',
      args: [id]
    });

    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete part with pending requests. Approve or reject pending requests first.' 
      });
    }

    await db.execute({
      sql: 'DELETE FROM parts WHERE id = ?',
      args: [id]
    });

    res.json({ 
      success: true, 
      message: 'Part deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting part:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// LOW STOCK REPORT
// ============================================================
app.get('/api/reports/low-stock', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM parts WHERE quantity_on_hand <= min_stock ORDER BY part_number',
      args: []
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching low stock report:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DASHBOARD ROUTES
// ============================================================
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    // Execute all queries in parallel
    const [partsResult, maintenanceResult, pendingResult, lowStockResult] = await Promise.all([
      db.execute({ sql: 'SELECT COUNT(*) as count FROM parts', args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM gse_maintenance', args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM pending_issues WHERE status = "pending"', args: [] }),
      db.execute({ 
        sql: 'SELECT COUNT(*) as count FROM parts WHERE quantity_on_hand <= min_stock AND quantity_on_hand > 0', 
        args: [] 
      })
    ]);

    const stats = {
      total_parts: Number(partsResult.rows[0]?.count) || 0,
      total_maintenance: Number(maintenanceResult.rows[0]?.count) || 0,
      pending_requests: Number(pendingResult.rows[0]?.count) || 0,
      low_stock_items: Number(lowStockResult.rows[0]?.count) || 0
    };

    console.log('📊 Dashboard Stats:', stats);
    res.json(stats);
  } catch (err) {
    console.error('Error fetching dashboard stats:', err.message);
    // Return defaults with error details for debugging
    res.json({ 
      total_parts: 0, 
      total_maintenance: 0, 
      pending_requests: 0, 
      low_stock_items: 0
    });
  }
});

// ============================================================
// MAINTENANCE ROUTES
// ============================================================
app.get('/api/gse-maintenance', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT gm.*, p.part_number, p.description as part_description
      FROM gse_maintenance gm
      LEFT JOIN parts p ON gm.part_id = p.id
      ORDER BY gm.equipment_name
    `);
    res.json({ success: true, equipment: result.rows });
  } catch (err) {
    console.error('Error fetching maintenance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/maintenance/count', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM gse_maintenance',
      args: []
    });
    res.json({ count: result.rows[0]?.count || 0 });
  } catch (err) {
    console.error('Error fetching maintenance count:', err.message);
    res.json({ count: 0 });
  }
});

// ============================================================
// REQUESTS & APPROVALS ROUTES
// ============================================================

// Create a pending request (storekeeper or any authenticated user)
app.post('/api/requests/issue', authenticateToken, async (req, res) => {
  try {
    const { part_id, part_number, quantity, gse_registration, technician_name, work_order, notes } = req.body;

    // Validate required fields
    if (!quantity) {
      return res.status(400).json({ error: 'Quantity is required' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    // Get part info - either by id or part_number
    let part;
    if (part_id) {
      const result = await db.execute({
        sql: 'SELECT id, part_number, quantity_on_hand FROM parts WHERE id = ?',
        args: [part_id]
      });
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Part not found' });
      }
      part = result.rows[0];
    } else if (part_number) {
      const result = await db.execute({
        sql: 'SELECT id, part_number, quantity_on_hand FROM parts WHERE part_number = ?',
        args: [part_number]
      });
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Part not found' });
      }
      part = result.rows[0];
    } else {
      return res.status(400).json({ error: 'Either part_id or part_number is required' });
    }

    // Check if enough stock is available
    if (part.quantity_on_hand < quantity) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${part.quantity_on_hand}, Requested: ${quantity}`
      });
    }

    // Create pending issue
    const result = await db.execute({
      sql: `INSERT INTO pending_issues 
            (part_id, part_number, quantity, gse_registration, technician_name, 
             work_order, notes, requested_by, requested_by_name, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            RETURNING *`,
      args: [
        part.id,
        part.part_number,
        quantity,
        gse_registration || '',
        technician_name || '',
        work_order || '',
        notes || '',
        req.user.id,
        req.user.username,
        'pending'
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Request submitted for approval',
      request: result.rows[0]
    });

  } catch (err) {
    console.error('Error creating pending issue:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get current user's pending requests
app.get('/api/requests/my-requests', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT pi.*, p.description as part_description, p.quantity_on_hand as current_stock
            FROM pending_issues pi
            LEFT JOIN parts p ON pi.part_id = p.id
            WHERE pi.requested_by = ?
            ORDER BY pi.created_at DESC`,
      args: [req.user.id]
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching user requests:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get all pending requests (admin only)
app.get('/api/approvals/pending', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await db.execute({
      sql: `SELECT 
            pi.*,
            p.description as part_description,
            p.quantity_on_hand as current_stock,
            u.full_name as requester_full_name,
            u.email as requester_email
            FROM pending_issues pi
            LEFT JOIN parts p ON pi.part_id = p.id
            LEFT JOIN users u ON pi.requested_by = u.id
            WHERE pi.status = 'pending'
            ORDER BY pi.created_at DESC`,
      args: []
    });
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending approvals:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get count of pending requests
app.get('/api/approvals/pending/count', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM pending_issues WHERE status = "pending"',
      args: []
    });
    res.json({ count: result.rows[0]?.count || 0 });
  } catch (err) {
    console.error('Error fetching pending count:', err.message);
    res.json({ count: 0 });
  }
});

// Approve a pending request (admin only)
app.put('/api/approvals/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { admin_comment } = req.body;

    // Get the pending issue
    const issue = await db.execute({
      sql: 'SELECT * FROM pending_issues WHERE id = ? AND status = "pending"',
      args: [id]
    });

    if (issue.rows.length === 0) {
      return res.status(404).json({ error: 'Pending request not found' });
    }

    const pending = issue.rows[0];

    // Check stock
    const stockCheck = await db.execute({
      sql: 'SELECT quantity_on_hand FROM parts WHERE id = ?',
      args: [pending.part_id]
    });

    if (stockCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const currentStock = stockCheck.rows[0].quantity_on_hand;
    if (currentStock < pending.quantity) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${currentStock}, Requested: ${pending.quantity}`
      });
    }

    // Update inventory
    await db.execute({
      sql: 'UPDATE parts SET quantity_on_hand = quantity_on_hand - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [pending.quantity, pending.part_id]
    });

    // Update pending issue
    const result = await db.execute({
      sql: `UPDATE pending_issues 
            SET status = 'approved', 
                admin_comment = ?, 
                approved_by = ?, 
                approved_at = CURRENT_TIMESTAMP
            WHERE id = ?
            RETURNING *`,
      args: [admin_comment || 'Approved', req.user.username, id]
    });

    // Log transaction
    await db.execute({
      sql: `INSERT INTO transactions 
            (part_id, transaction_type, quantity, notes, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [
        pending.part_id,
        'issue',
        pending.quantity,
        `Approved request #${id} - ${admin_comment || ''}`,
        req.user.username
      ]
    });

    res.json({
      success: true,
      message: 'Request approved successfully',
      request: result.rows[0]
    });

  } catch (err) {
    console.error('Error approving request:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Reject a pending request (admin only)
app.put('/api/approvals/:id/reject', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { admin_comment } = req.body;

    // Get the pending issue
    const issue = await db.execute({
      sql: 'SELECT * FROM pending_issues WHERE id = ? AND status = "pending"',
      args: [id]
    });

    if (issue.rows.length === 0) {
      return res.status(404).json({ error: 'Pending request not found' });
    }

    // Update pending issue
    const result = await db.execute({
      sql: `UPDATE pending_issues 
            SET status = 'rejected', 
                admin_comment = ?, 
                approved_by = ?, 
                approved_at = CURRENT_TIMESTAMP
            WHERE id = ?
            RETURNING *`,
      args: [admin_comment || 'Rejected', req.user.username, id]
    });

    res.json({
      success: true,
      message: 'Request rejected',
      request: result.rows[0]
    });

  } catch (err) {
    console.error('Error rejecting request:', err.message);
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
// 404 HANDLER - Must be at the end
// ============================================================
app.use((req, res, next) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

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
      email TEXT
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

const ensureAllColumns = async () => {
  try {
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
  } catch (error) {
    console.error('Error ensuring columns:', error.message);
  }
};

const createUsers = async () => {
  try {
    const check = await db.execute('SELECT COUNT(*) as count FROM users');
    if (check.rows[0].count > 0) return;

    const adminHash = bcrypt.hashSync('1991', 10);
    const managerHash = bcrypt.hashSync('manager123', 10);
    const keeperHash = bcrypt.hashSync('keeper123', 10);

    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)',
      args: ['admin', adminHash, 'System Admin', 'admin', 'admin@example.com']
    });
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)',
      args: ['manager', managerHash, 'GSE Manager', 'manager', 'manager@example.com']
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

const createSampleData = async () => {
  try {
    const count = await db.execute('SELECT COUNT(*) as count FROM parts');
    if (count.rows[0].count > 0) return;

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
    }
    console.log('✅ Sample data created');
  } catch (err) {
    console.error('Error creating sample data:', err.message);
  }
};

// ============================================================
// START SERVER
// ============================================================
const startServer = async () => {
  try {
    console.log('🚀 Starting GSE Inventory Server...');
    await initDatabase();
    await createTables();
    await ensureAllColumns();
    await createUsers();
    await createSampleData();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ GSE Server running on port ${PORT}`);
      console.log(`\n📋 Login with:`);
      console.log(`   admin / 1991 (Admin)`);
      console.log(`   manager / manager123 (Manager)`);
      console.log(`   storekeeper / keeper123 (Storekeeper)`);
      console.log(`\n🧪 Test Route:`);
      console.log(`   GET /api/test - Check if server is running`);
      console.log(`\n📊 Dashboard:`);
      console.log(`   GET /api/dashboard/stats - Get dashboard statistics`);
      console.log(`\n📝 Pending Approvals:`);
      console.log(`   GET /api/approvals/pending - List pending requests`);
      console.log(`   GET /api/approvals/pending/count - Count pending requests`);
      console.log(`   PUT /api/approvals/:id/approve - Approve a request`);
      console.log(`   PUT /api/approvals/:id/reject - Reject a request`);
      console.log(`\n📋 My Requests:`);
      console.log(`   GET /api/requests/my-requests - List my requests`);
      console.log(`   POST /api/requests/issue - Create a new request`);
    });
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
};

startServer();