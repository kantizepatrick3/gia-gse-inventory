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

// ============================================================
// 🧪 TEST ROUTE
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
      approvals: '/api/approvals/pending',
      priceHistory: '/api/price-history/:partId',
      dashboard: '/api/dashboard/stats',
      maintenance: '/api/gse-maintenance',
      serviceHistory: '/api/gse-maintenance/:id/history',
      gseStatus: '/api/gse-status',
      gseStatusSummary: '/api/gse-status/summary',
      gseStatusExport: '/api/gse-status/export'
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
// HELPER: Validate and sanitize numbers
// ============================================================
const sanitizeNumber = (value, defaultValue = 0) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }
  return num;
};

// ============================================================
// 👥 USER MANAGEMENT ROUTES
// ============================================================

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    console.log('👥 Fetching all users...');
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
    res.status(201).json({ success: true, message: `User "${username}" created successfully`, user: result.rows[0] });
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
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/reset-password', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { user_id, new_password } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    if (!new_password || new_password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    const userCheck = await db.execute({
      sql: 'SELECT username FROM users WHERE id = ?',
      args: [user_id]
    });
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const username = userCheck.rows[0].username;
    const hashedPassword = bcrypt.hashSync(new_password, 10);
    await db.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [hashedPassword, user_id]
    });
    res.json({ success: true, message: `Password reset for ${username} successfully` });
  } catch (err) {
    console.error('Error resetting password:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 📤 ISSUE REQUESTS ROUTES
// ============================================================

app.post('/api/requests/issue', authenticateToken, async (req, res) => {
  console.log('\n=== 📤 SUBMITTING ISSUE REQUEST ===');
  try {
    const { part_number, quantity, gse_registration, technician_name, work_order, notes } = req.body;
    if (!part_number) return res.status(400).json({ error: 'Part number is required' });
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Valid quantity is required' });
    if (!gse_registration) return res.status(400).json({ error: 'GSE registration is required' });

    const partResult = await db.execute({
      sql: 'SELECT id, part_number, quantity_on_hand, description FROM parts WHERE part_number = ?',
      args: [part_number]
    });
    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: `Part "${part_number}" not found` });
    }

    const part = partResult.rows[0];
    const currentStock = part.quantity_on_hand || 0;
    if (currentStock < parseInt(quantity)) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${currentStock}, Requested: ${quantity}` });
    }

    const result = await db.execute({
      sql: `
        INSERT INTO pending_issues (
          part_number, part_id, quantity, gse_registration, technician_name,
          work_order, notes, requested_by, requested_by_name, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        RETURNING id
      `,
      args: [part_number, part.id, parseInt(quantity), gse_registration, technician_name || '',
        work_order || '', notes || '', req.user.id, req.user.username, 'pending']
    });

    res.status(201).json({
      success: true,
      message: 'Issue request submitted for approval',
      request_id: result.rows[0].id
    });
  } catch (err) {
    console.error('Error submitting issue request:', err.message);
    res.status(500).json({ error: 'Failed to submit issue request', details: err.message });
  }
});

app.get('/api/requests/my-requests', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Fetching requests for user:', req.user.username, 'ID:', req.user.id);
    const result = await db.execute({
      sql: `SELECT * FROM pending_issues WHERE requested_by = ? ORDER BY created_at DESC`,
      args: [req.user.id]
    });
    console.log(`✅ Found ${result.rows.length} requests for user ${req.user.username}`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching my requests:', err.message);
    res.json([]);
  }
});

app.get('/api/requests/pending', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await db.execute({
      sql: `
        SELECT p.*, parts.quantity_on_hand as current_stock, parts.description
        FROM pending_issues p
        LEFT JOIN parts ON p.part_id = parts.id
        WHERE p.status = 'pending'
        ORDER BY p.created_at ASC
      `,
      args: []
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending requests:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/approvals/pending', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await db.execute({
      sql: `
        SELECT p.*, parts.quantity_on_hand as current_stock, parts.description
        FROM pending_issues p
        LEFT JOIN parts ON p.part_id = parts.id
        WHERE p.status = 'pending'
        ORDER BY p.created_at ASC
      `,
      args: []
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending approvals:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/approvals/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const requestId = parseInt(id);
    if (isNaN(requestId)) return res.status(400).json({ error: 'Invalid request ID' });

    const requestResult = await db.execute({
      sql: 'SELECT * FROM pending_issues WHERE id = ?',
      args: [requestId]
    });
    if (requestResult.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const request = requestResult.rows[0];
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    if (request.part_id) {
      const partResult = await db.execute({
        sql: 'SELECT quantity_on_hand FROM parts WHERE id = ?',
        args: [request.part_id]
      });
      if (partResult.rows.length > 0) {
        const currentQty = partResult.rows[0].quantity_on_hand || 0;
        const newQty = currentQty - request.quantity;
        if (newQty < 0) {
          return res.status(400).json({ error: `Insufficient stock. Available: ${currentQty}, Requested: ${request.quantity}` });
        }
        await db.execute({
          sql: 'UPDATE parts SET quantity_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          args: [newQty, request.part_id]
        });
      }
    }

    await db.execute({
      sql: `UPDATE pending_issues SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, admin_comment = ? WHERE id = ?`,
      args: [req.user.username, comment || 'Approved', requestId]
    });

    let maintTypeText = '';
    if (request.notes) {
      if (request.notes.includes('🔧 Preventive') || request.notes.includes('Preventive')) {
        maintTypeText = '🔧 Preventive Maintenance';
      } else if (request.notes.includes('🛠️ Corrective') || request.notes.includes('Corrective')) {
        maintTypeText = '🛠️ Corrective Maintenance';
      }
    }

    let transactionNotes = `Approved request #${id} - ${comment || 'Approved'}`;
    if (maintTypeText) {
      transactionNotes = `${maintTypeText} - ${transactionNotes}`;
    }

    await db.execute({
      sql: `INSERT INTO transactions 
            (part_id, transaction_type, quantity, gse_registration, technician_name, work_order, notes, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [
        request.part_id,
        'ISSUE',
        request.quantity,
        request.gse_registration || '',
        request.technician_name || '',
        request.work_order || '',
        transactionNotes,
        req.user.username
      ]
    });

    res.json({ success: true, message: 'Request approved successfully' });
  } catch (err) {
    console.error('Error approving request:', err.message);
    res.status(500).json({ error: 'Failed to approve request', details: err.message });
  }
});

app.put('/api/approvals/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const requestId = parseInt(id);
    if (isNaN(requestId)) return res.status(400).json({ error: 'Invalid request ID' });

    const requestResult = await db.execute({
      sql: 'SELECT * FROM pending_issues WHERE id = ?',
      args: [requestId]
    });
    if (requestResult.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const request = requestResult.rows[0];
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    await db.execute({
      sql: `UPDATE pending_issues SET status = 'rejected', admin_comment = ? WHERE id = ?`,
      args: [comment || 'Rejected', requestId]
    });

    res.json({ success: true, message: 'Request rejected successfully' });
  } catch (err) {
    console.error('Error rejecting request:', err.message);
    res.status(500).json({ error: 'Failed to reject request', details: err.message });
  }
});

// ============================================================
// ⭐ PARTS CRUD ROUTES - FIXED ORDER
// ============================================================

app.get('/api/parts', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM parts ORDER BY part_number');
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
    const partId = parseInt(id);
    if (isNaN(partId)) {
      return res.status(400).json({ error: 'Invalid part ID' });
    }
    const result = await db.execute({
      sql: 'SELECT * FROM parts WHERE id = ?',
      args: [partId]
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
      part_number, description, manufacturer, compatible_gse, location_bin,
      quantity_on_hand = 0, min_stock = 0, max_stock = 100,
      unit_price = 0, current_price = 0, maintenance_type = 'none',
      service_interval_hours = 0, service_interval_months = 0, service_interval_years = 0,
      contact_person = '', contact_phone = '', contact_email = ''
    } = req.body;

    if (!part_number || !description) {
      return res.status(400).json({ error: 'Part number and description are required' });
    }

    const existing = await db.execute({
      sql: 'SELECT id FROM parts WHERE part_number = ?',
      args: [part_number]
    });
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `Part "${part_number}" already exists` });
    }

    const result = await db.execute({
      sql: `
        INSERT INTO parts (
          part_number, description, manufacturer, compatible_gse, location_bin,
          quantity_on_hand, min_stock, max_stock, unit_price, current_price,
          maintenance_type, service_interval_hours, service_interval_months, service_interval_years,
          contact_person, contact_phone, contact_email, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `,
      args: [
        part_number, description, manufacturer || '', compatible_gse || '', location_bin || '',
        sanitizeNumber(quantity_on_hand), sanitizeNumber(min_stock), sanitizeNumber(max_stock, 100),
        sanitizeNumber(unit_price), sanitizeNumber(current_price), maintenance_type || 'none',
        sanitizeNumber(service_interval_hours), sanitizeNumber(service_interval_months),
        sanitizeNumber(service_interval_years), contact_person || '', contact_phone || '', contact_email || ''
      ]
    });

    res.status(201).json({ success: true, message: `Part "${part_number}" added successfully`, id: result.rows[0].id });
  } catch (err) {
    console.error('Error adding part:', err.message);
    res.status(500).json({ error: 'Failed to add part', details: err.message });
  }
});

app.put('/api/parts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const partId = parseInt(id);
    if (isNaN(partId)) return res.status(400).json({ error: 'Invalid part ID' });

    const {
      description, manufacturer, compatible_gse, location_bin,
      min_stock, max_stock, unit_price, current_price,
      maintenance_type, service_interval_hours, service_interval_months, service_interval_years,
      contact_person, contact_phone, contact_email
    } = req.body;

    await db.execute({
      sql: `
        UPDATE parts SET
          description = ?, manufacturer = ?, compatible_gse = ?, location_bin = ?,
          min_stock = ?, max_stock = ?, unit_price = ?, current_price = ?,
          maintenance_type = ?, service_interval_hours = ?, service_interval_months = ?,
          service_interval_years = ?, contact_person = ?, contact_phone = ?, contact_email = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [
        description || '', manufacturer || '', compatible_gse || '', location_bin || '',
        sanitizeNumber(min_stock), sanitizeNumber(max_stock, 100), sanitizeNumber(unit_price),
        sanitizeNumber(current_price), maintenance_type || 'none',
        sanitizeNumber(service_interval_hours), sanitizeNumber(service_interval_months),
        sanitizeNumber(service_interval_years), contact_person || '', contact_phone || '',
        contact_email || '', partId
      ]
    });

    res.json({ success: true, message: 'Part updated successfully' });
  } catch (err) {
    console.error('Error updating part:', err.message);
    res.status(500).json({ error: 'Failed to update part', details: err.message });
  }
});

app.delete('/api/parts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const partId = parseInt(id);
    if (isNaN(partId)) return res.status(400).json({ error: 'Invalid part ID' });

    const existing = await db.execute({
      sql: 'SELECT part_number FROM parts WHERE id = ?',
      args: [partId]
    });
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Part not found' });

    await db.execute({ sql: 'DELETE FROM parts WHERE id = ?', args: [partId] });
    res.json({ success: true, message: `Part deleted successfully` });
  } catch (err) {
    console.error('Error deleting part:', err.message);
    res.status(500).json({ error: 'Failed to delete part', details: err.message });
  }
});

// ============================================================
// 📥 RECEIVE PART
// ============================================================

app.post('/api/receive', authenticateToken, async (req, res) => {
  try {
    const { part_number, quantity, unit_price, notes } = req.body;
    if (!part_number) return res.status(400).json({ error: 'Part number is required' });
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Valid quantity is required' });

    const partResult = await db.execute({
      sql: 'SELECT id, part_number, quantity_on_hand FROM parts WHERE part_number = ?',
      args: [part_number]
    });
    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: `Part "${part_number}" not found` });
    }

    const part = partResult.rows[0];
    const oldQty = part.quantity_on_hand || 0;
    const newQty = oldQty + parseInt(quantity);
    const price = parseFloat(unit_price) || 0;

    await db.execute({
      sql: 'UPDATE parts SET quantity_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [newQty, part.id]
    });

    if (price > 0) {
      await db.execute({
        sql: 'UPDATE parts SET unit_price = ?, current_price = ? WHERE id = ?',
        args: [price, price, part.id]
      });
      await db.execute({
        sql: `INSERT INTO price_history (part_id, price, quantity, transaction_type, notes, recorded_by, created_at)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        args: [part.id, price, parseInt(quantity), 'RECEIVE', notes || '', req.user.username]
      });
    }

    await db.execute({
      sql: `INSERT INTO transactions (part_id, transaction_type, quantity, price, notes, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [part.id, 'RECEIVE', parseInt(quantity), price, notes || '', req.user.username]
    });

    res.json({ success: true, message: `Received ${quantity} of "${part_number}" successfully` });
  } catch (err) {
    console.error('Error receiving part:', err.message);
    res.status(500).json({ error: 'Failed to receive part', details: err.message });
  }
});

// ============================================================
// ⭐ PRICE HISTORY ROUTES
// ============================================================

app.get('/api/price-history/:partId', authenticateToken, async (req, res) => {
  try {
    const { partId } = req.params;
    const result = await db.execute({
      sql: `SELECT * FROM price_history WHERE part_id = ? ORDER BY created_at DESC LIMIT 10`,
      args: [partId]
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching price history:', err.message);
    res.json([]);
  }
});

app.post('/api/price-history', authenticateToken, async (req, res) => {
  try {
    const { part_id, price, quantity, transaction_type, notes } = req.body;
    const partResult = await db.execute({
      sql: 'SELECT * FROM parts WHERE id = ?',
      args: [part_id]
    });
    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    const sanitizedPrice = parseFloat(price) || 0;
    await db.execute({
      sql: `INSERT INTO price_history (part_id, price, quantity, transaction_type, notes, recorded_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [part_id, sanitizedPrice, parseInt(quantity) || 1, transaction_type || 'MANUAL', notes || '', req.user.username]
    });
    await db.execute({
      sql: `UPDATE parts SET current_price = ?, unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [sanitizedPrice, sanitizedPrice, part_id]
    });
    res.json({ success: true, message: 'Price updated successfully!' });
  } catch (err) {
    console.error('Error adding price history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/parts/:partId/price', authenticateToken, async (req, res) => {
  try {
    const { partId } = req.params;
    const { price } = req.body;
    if (price === undefined || price === null) {
      return res.status(400).json({ error: 'Price is required' });
    }
    const newPrice = parseFloat(price);
    if (isNaN(newPrice) || newPrice < 0) {
      return res.status(400).json({ error: 'Invalid price value' });
    }

    let partResult = await db.execute({
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

    await db.execute({
      sql: 'UPDATE parts SET current_price = ?, unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [newPrice, newPrice, partIdNumber]
    });
    await db.execute({
      sql: `INSERT INTO price_history (part_id, price, transaction_type, notes, recorded_by, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [partIdNumber, newPrice, 'PRICE_UPDATE', `Price updated from ${oldPrice} to ${newPrice}`, req.user.username]
    });
    res.json({ success: true, message: `Price updated for ${part.part_number}`, oldPrice, newPrice });
  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ error: 'Failed to update price', details: error.message });
  }
});

// ============================================================
// 📊 TRANSACTIONS ROUTES
// ============================================================

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0, type } = req.query;
    
    let sql = `
      SELECT t.*, p.part_number, p.description
      FROM transactions t
      LEFT JOIN parts p ON t.part_id = p.id
    `;
    
    const args = [];
    
    if (type) {
      sql += ` WHERE t.transaction_type = ?`;
      args.push(type);
    }
    
    sql += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
    args.push(parseInt(limit), parseInt(offset));
    
    const result = await db.execute({
      sql: sql,
      args: args
    });
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/transactions/receive', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `
        SELECT t.*, p.part_number, p.description
        FROM transactions t
        LEFT JOIN parts p ON t.part_id = p.id
        WHERE t.transaction_type = 'RECEIVE'
        ORDER BY t.created_at DESC
        LIMIT 100
      `,
      args: []
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching receive transactions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/transactions/issue', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `
        SELECT t.*, p.part_number, p.description
        FROM transactions t
        LEFT JOIN parts p ON t.part_id = p.id
        WHERE t.transaction_type = 'ISSUE'
        ORDER BY t.created_at DESC
        LIMIT 100
      `,
      args: []
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching issue transactions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: `
        SELECT t.*, p.part_number, p.description
        FROM transactions t
        LEFT JOIN parts p ON t.part_id = p.id
        WHERE t.id = ?
      `,
      args: [id]
    });
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching transaction:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 📊 DASHBOARD ROUTES
// ============================================================

app.get('/api/reports/low-stock', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM parts WHERE quantity_on_hand <= min_stock ORDER BY quantity_on_hand ASC LIMIT 20`,
      args: []
    });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching low stock:', err.message);
    res.json([]);
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

app.get('/api/maintenance/overdue', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT COUNT(*) as count FROM gse_maintenance WHERE status = 'overdue'",
      args: []
    });
    res.json({ count: result.rows[0]?.count || 0 });
  } catch (err) {
    console.error('Error fetching overdue maintenance:', err.message);
    res.json({ count: 0 });
  }
});

app.get('/api/requests/pending/count', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Counting pending requests...');
    const result = await db.execute({
      sql: "SELECT COUNT(*) as count FROM pending_issues WHERE status = 'pending'",
      args: []
    });
    const count = Number(result.rows[0]?.count) || 0;
    console.log(`✅ Pending count: ${count}`);
    res.json({ count: count });
  } catch (err) {
    console.error('Error fetching pending requests count:', err.message);
    res.json({ count: 0 });
  }
});

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats...');
    
    const [partsCount, maintenanceCount, pendingRequests, lowStock] = await Promise.all([
      db.execute({ sql: 'SELECT COUNT(*) as count FROM parts', args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM gse_maintenance', args: [] }),
      db.execute({ sql: "SELECT COUNT(*) as count FROM pending_issues WHERE status = 'pending'", args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM parts WHERE quantity_on_hand <= min_stock', args: [] })
    ]);
    
    const stats = {
      total_parts: Number(partsCount.rows[0]?.count) || 0,
      total_maintenance: Number(maintenanceCount.rows[0]?.count) || 0,
      pending_requests: Number(pendingRequests.rows[0]?.count) || 0,
      low_stock_items: Number(lowStock.rows[0]?.count) || 0
    };
    
    console.log('📊 Dashboard Stats:', stats);
    res.json(stats);
  } catch (err) {
    console.error('Error fetching dashboard stats:', err.message);
    res.json({ total_parts: 0, total_maintenance: 0, pending_requests: 0, low_stock_items: 0 });
  }
});

// ============================================================
// 🔧 MAINTENANCE ROUTES
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

app.get('/api/gse-maintenance/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: `
        SELECT gm.*, p.part_number, p.description as part_description
        FROM gse_maintenance gm
        LEFT JOIN parts p ON gm.part_id = p.id
        WHERE gm.id = ?
      `,
      args: [id]
    });
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching maintenance record:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gse-maintenance/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: 'SELECT * FROM service_history WHERE maintenance_id = ? ORDER BY created_at DESC LIMIT 50',
      args: [id]
    });
    res.json({ history: result.rows });
  } catch (err) {
    console.error('Error fetching maintenance history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/maintenance/all', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT id, equipment_name, equipment_type, maintenance_type, status
      FROM gse_maintenance
      ORDER BY equipment_name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching maintenance list:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gse-maintenance/:id/service', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { service_performed, technician_name, notes, service_date, current_hours, maintenance_category, months_interval, service_interval_years, target_hours } = req.body;

    const maintenanceResult = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    if (maintenanceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    const maintenance = maintenanceResult.rows[0];
    const serviceDate = service_date || new Date().toISOString().split('T')[0];
    const hours = current_hours ? parseInt(current_hours) : (parseInt(maintenance.current_hours) || 0);
    const maintType = maintenance.maintenance_type || 'none';

    let nextServiceDate = null;
    let nextServiceHours = 0;
    let daysRemaining = 0;
    let hoursRemaining = 0;
    let yearsRemaining = 0;
    let nextServiceYear = null;
    let status = 'serviced';

    let intervalHours = parseInt(maintenance.service_interval_hours) || 0;
    let intervalMonths = parseInt(months_interval) || parseInt(maintenance.service_interval_months) || 0;
    let intervalYears = parseInt(service_interval_years) || parseInt(maintenance.service_interval_years) || 0;
    let targetHrs = parseInt(target_hours) || parseInt(maintenance.target_hours) || intervalHours;

    if (maintType === 'hour') {
      if (intervalHours > 0 || targetHrs > 0) {
        const effectiveTarget = targetHrs > 0 ? targetHrs : intervalHours;
        nextServiceHours = hours + effectiveTarget;
        hoursRemaining = effectiveTarget;
      }
      
      if (intervalMonths > 0) {
        const date = new Date(serviceDate);
        date.setMonth(date.getMonth() + intervalMonths);
        nextServiceDate = date.toISOString().split('T')[0];
        
        const today = new Date();
        const nextDate = new Date(nextServiceDate);
        const diffTime = nextDate - today;
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      
      if (intervalHours > 0 && intervalMonths > 0) {
        if (hoursRemaining <= 0 || daysRemaining <= 0) status = 'overdue';
        else if (hoursRemaining <= 50 || daysRemaining <= 30) status = 'due_soon';
      } else if (intervalHours > 0) {
        if (hoursRemaining <= 0) status = 'overdue';
        else if (hoursRemaining <= 50) status = 'due_soon';
      } else if (intervalMonths > 0) {
        if (daysRemaining <= 0) status = 'overdue';
        else if (daysRemaining <= 30) status = 'due_soon';
      }
    } else if (maintType === 'month') {
      if (intervalMonths > 0) {
        const date = new Date(serviceDate);
        date.setMonth(date.getMonth() + intervalMonths);
        nextServiceDate = date.toISOString().split('T')[0];
        
        const today = new Date();
        const nextDate = new Date(nextServiceDate);
        const diffTime = nextDate - today;
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (daysRemaining <= 0) status = 'overdue';
        else if (daysRemaining <= 30) status = 'due_soon';
      }
    } else if (maintType === 'year') {
      if (intervalYears > 0) {
        const date = new Date(serviceDate);
        date.setFullYear(date.getFullYear() + intervalYears);
        nextServiceDate = date.toISOString().split('T')[0];
        nextServiceYear = date.getFullYear();
        yearsRemaining = intervalYears;
        
        const today = new Date();
        const nextDate = new Date(nextServiceDate);
        const diffTime = nextDate - today;
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (daysRemaining <= 0) status = 'overdue';
        else if (daysRemaining <= 60) status = 'due_soon';
      }
    }

    await db.execute({
      sql: `
        INSERT INTO service_history (
          maintenance_id, equipment_name, equipment_type, maintenance_type,
          service_date, service_performed, technician_name, notes,
          maintenance_category, current_hours, recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      args: [
        parseInt(id),
        maintenance.equipment_name || '',
        maintenance.equipment_type || '',
        maintType,
        serviceDate,
        service_performed || '',
        technician_name || '',
        notes || '',
        maintenance_category || 'preventive',
        hours,
        req.user.username
      ]
    });

    let updateFields = [];
    let updateArgs = [];

    updateFields.push('last_service_date = ?');
    updateArgs.push(serviceDate);

    updateFields.push('current_hours = ?');
    updateArgs.push(hours);

    updateFields.push('next_service_date = ?');
    updateArgs.push(nextServiceDate);

    updateFields.push('next_service_hours = ?');
    updateArgs.push(nextServiceHours);

    updateFields.push('next_service_year = ?');
    updateArgs.push(nextServiceYear);

    updateFields.push('hours_remaining = ?');
    updateArgs.push(hoursRemaining);

    updateFields.push('days_remaining = ?');
    updateArgs.push(daysRemaining);

    updateFields.push('years_remaining = ?');
    updateArgs.push(yearsRemaining);

    updateFields.push('status = ?');
    updateArgs.push(status);

    if (months_interval && parseInt(months_interval) > 0) {
      updateFields.push('service_interval_months = ?');
      updateArgs.push(parseInt(months_interval));
    }

    if (service_interval_years && parseInt(service_interval_years) > 0) {
      updateFields.push('service_interval_years = ?');
      updateArgs.push(parseInt(service_interval_years));
    }

    if (target_hours && parseInt(target_hours) > 0) {
      updateFields.push('target_hours = ?');
      updateArgs.push(parseInt(target_hours));
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateArgs.push(id);

    await db.execute({
      sql: `UPDATE gse_maintenance SET ${updateFields.join(', ')} WHERE id = ?`,
      args: updateArgs
    });

    const updatedRecord = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    res.json({
      success: true,
      message: 'Service recorded successfully',
      data: {
        next_service_date: nextServiceDate,
        next_service_hours: nextServiceHours,
        next_service_year: nextServiceYear,
        days_remaining: daysRemaining,
        hours_remaining: hoursRemaining,
        years_remaining: yearsRemaining,
        status: status
      },
      equipment: updatedRecord.rows[0]
    });
  } catch (err) {
    console.error('Error recording service:', err.message);
    res.status(500).json({ error: 'Failed to record service', details: err.message });
  }
});

// ============================================================
// 🔧 MAINTENANCE ROUTES - ADDITIONAL ENDPOINTS
// ============================================================

app.put('/api/gse-maintenance/:id/hours', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { current_hours } = req.body;

    if (current_hours === undefined || current_hours === null) {
      return res.status(400).json({ error: 'Current hours are required' });
    }

    const hours = parseInt(current_hours);
    if (isNaN(hours) || hours < 0) {
      return res.status(400).json({ error: 'Invalid hours value' });
    }

    const maintenanceResult = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    if (maintenanceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    const maintenance = maintenanceResult.rows[0];
    const targetHours = parseInt(maintenance.target_hours) || parseInt(maintenance.service_interval_hours) || 0;
    const hoursRemaining = targetHours > 0 ? targetHours - hours : 0;
    
    let status = maintenance.status;
    if (targetHours > 0) {
      if (hoursRemaining <= 0) {
        status = 'overdue';
      } else if (hoursRemaining <= 50) {
        status = 'due_soon';
      } else {
        status = 'serviced';
      }
    }

    await db.execute({
      sql: `
        UPDATE gse_maintenance SET 
          current_hours = ?,
          hours_remaining = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [hours, hoursRemaining, status, id]
    });

    const updatedRecord = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    res.json({
      success: true,
      message: 'Hours updated successfully',
      data: { 
        current_hours: hours, 
        hours_remaining: hoursRemaining, 
        status: status 
      },
      equipment: updatedRecord.rows[0]
    });
  } catch (err) {
    console.error('Error updating hours:', err.message);
    res.status(500).json({ error: 'Failed to update hours', details: err.message });
  }
});

app.put('/api/gse-maintenance/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      equipment_name, equipment_type, maintenance_type,
      service_interval_hours, service_interval_months, service_interval_years,
      target_hours, notes, part_id
    } = req.body;

    const existing = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    const updates = [];
    const values = [];

    if (equipment_name !== undefined) { updates.push('equipment_name = ?'); values.push(equipment_name); }
    if (equipment_type !== undefined) { updates.push('equipment_type = ?'); values.push(equipment_type); }
    if (maintenance_type !== undefined) { updates.push('maintenance_type = ?'); values.push(maintenance_type); }
    if (service_interval_hours !== undefined) { updates.push('service_interval_hours = ?'); values.push(parseInt(service_interval_hours) || 0); }
    if (service_interval_months !== undefined) { updates.push('service_interval_months = ?'); values.push(parseInt(service_interval_months) || 0); }
    if (service_interval_years !== undefined) { updates.push('service_interval_years = ?'); values.push(parseInt(service_interval_years) || 0); }
    if (target_hours !== undefined) { updates.push('target_hours = ?'); values.push(parseInt(target_hours) || 0); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (part_id !== undefined) { updates.push('part_id = ?'); values.push(part_id || null); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.execute({
      sql: `UPDATE gse_maintenance SET ${updates.join(', ')} WHERE id = ?`,
      args: values
    });

    const result = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    res.json({
      success: true,
      message: 'Equipment updated successfully',
      equipment: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating equipment:', err.message);
    res.status(500).json({ error: 'Failed to update equipment', details: err.message });
  }
});

app.delete('/api/gse-maintenance/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    await db.execute({
      sql: 'DELETE FROM service_history WHERE maintenance_id = ?',
      args: [id]
    });

    await db.execute({
      sql: 'DELETE FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    res.json({
      success: true,
      message: 'Maintenance record deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting maintenance record:', err.message);
    res.status(500).json({ error: 'Failed to delete maintenance record', details: err.message });
  }
});

// ============================================================
// 📎 MAINTENANCE ATTACHMENT ROUTES
// ============================================================

app.get('/api/maintenance-attachments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: 'SELECT id, maintenance_id, filename, original_filename, file_type, file_size, uploaded_by, created_at FROM maintenance_attachments WHERE maintenance_id = ? ORDER BY created_at DESC',
      args: [id]
    });
    res.json(result.rows || []);
  } catch (err) {
    console.error('Error fetching attachments:', err.message);
    res.json([]);
  }
});

app.get('/api/maintenance-attachments/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.execute({
      sql: 'SELECT * FROM maintenance_attachments WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];
    const fileBuffer = Buffer.from(attachment.file_data, 'base64');
    
    res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_filename || attachment.filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    
    res.send(fileBuffer);
  } catch (err) {
    console.error('Error downloading attachment:', err.message);
    res.status(500).json({ error: 'Failed to download attachment', details: err.message });
  }
});

app.post('/api/maintenance-attachments', authenticateToken, async (req, res) => {
  try {
    const { maintenance_id, filename, original_filename, file_data, file_type, file_size } = req.body;
    
    if (!maintenance_id) {
      return res.status(400).json({ error: 'Maintenance ID is required' });
    }

    if (!file_data) {
      return res.status(400).json({ error: 'File data is required' });
    }

    const result = await db.execute({
      sql: `
        INSERT INTO maintenance_attachments 
        (maintenance_id, filename, original_filename, file_data, file_type, file_size, uploaded_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      args: [
        maintenance_id,
        filename || 'upload',
        original_filename || filename || 'upload',
        file_data,
        file_type || 'application/octet-stream',
        file_size || 0,
        req.user.username
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Attachment uploaded successfully',
      attachment: result.rows[0]
    });
  } catch (err) {
    console.error('Error uploading attachment:', err.message);
    res.status(500).json({ error: 'Failed to upload attachment', details: err.message });
  }
});

app.delete('/api/maintenance-attachment/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await db.execute({
      sql: 'SELECT * FROM maintenance_attachments WHERE id = ?',
      args: [id]
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    await db.execute({
      sql: 'DELETE FROM maintenance_attachments WHERE id = ?',
      args: [id]
    });

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting attachment:', err.message);
    res.status(500).json({ error: 'Failed to delete attachment', details: err.message });
  }
});

// ============================================================
// 📊 GSE STATUS ROUTES - NEW FEATURE
// ============================================================

// Get all GSE equipment with status
app.get('/api/gse-status', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT 
        id, 
        equipment_name, 
        equipment_type, 
        gse_status,
        gse_status_updated_at,
        maintenance_type,
        status as maintenance_status,
        last_service_date,
        next_service_date,
        current_hours,
        target_hours
      FROM gse_maintenance
      ORDER BY equipment_name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching GSE status:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update GSE status (In-Service / Out-of-Service)
app.put('/api/gse-status/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { gse_status } = req.body;

    if (!gse_status || !['In-Service', 'Out-of-Service'].includes(gse_status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be "In-Service" or "Out-of-Service"' 
      });
    }

    const existing = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    await db.execute({
      sql: `
        UPDATE gse_maintenance SET 
          gse_status = ?,
          gse_status_updated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [gse_status, id]
    });

    const updated = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    res.json({
      success: true,
      message: `Status updated to "${gse_status}"`,
      equipment: updated.rows[0]
    });
  } catch (err) {
    console.error('Error updating GSE status:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get status summary (for dashboard)
app.get('/api/gse-status/summary', authenticateToken, async (req, res) => {
  try {
    const [total, inService, outOfService] = await Promise.all([
      db.execute('SELECT COUNT(*) as count FROM gse_maintenance'),
      db.execute('SELECT COUNT(*) as count FROM gse_maintenance WHERE gse_status = "In-Service"'),
      db.execute('SELECT COUNT(*) as count FROM gse_maintenance WHERE gse_status = "Out-of-Service"')
    ]);

    res.json({
      total: total.rows[0]?.count || 0,
      in_service: inService.rows[0]?.count || 0,
      out_of_service: outOfService.rows[0]?.count || 0
    });
  } catch (err) {
    console.error('Error fetching GSE status summary:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Export GSE Status Report as CSV (Excel)
app.get('/api/gse-status/export', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT 
        equipment_name as 'Equipment Name',
        equipment_type as 'Equipment Type',
        gse_status as 'GSE Status',
        gse_status_updated_at as 'Status Updated',
        maintenance_type as 'Maintenance Type',
        status as 'Maintenance Status',
        last_service_date as 'Last Service Date',
        next_service_date as 'Next Service Date',
        current_hours as 'Current Hours',
        target_hours as 'Target Hours'
      FROM gse_maintenance
      ORDER BY equipment_name
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No equipment found to export' });
    }

    const headers = Object.keys(result.rows[0]);
    let csv = headers.join(',') + '\n';
    
    for (const row of result.rows) {
      const values = headers.map(header => {
        let value = row[header] || '';
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        if (header === 'GSE Status') {
          value = value === 'In-Service' ? '✅ In-Service' : '🔴 Out-of-Service';
        }
        return value;
      });
      csv += values.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=gse_status_report_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting GSE status:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get GSE status history for a specific equipment
app.get('/api/gse-status/history/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: `
        SELECT 
          gse_status,
          gse_status_updated_at
        FROM gse_maintenance 
        WHERE id = ?
      `,
      args: [id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    res.json({
      current_status: result.rows[0].gse_status,
      last_updated: result.rows[0].gse_status_updated_at
    });
  } catch (err) {
    console.error('Error fetching GSE status history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 🏥 HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

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
      gse_status TEXT DEFAULT 'In-Service',
      gse_status_updated_at DATETIME,
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
      console.log(`\n🏠 Dashboard: /api/dashboard/stats`);
      console.log(`📦 Parts: /api/parts, /api/parts/count`);
      console.log(`📥 Receive: /api/receive`);
      console.log(`📤 Issue: /api/requests/issue`);
      console.log(`⏳ Approvals: /api/approvals/pending`);
      console.log(`🔧 Maintenance: /api/gse-maintenance`);
      console.log(`📜 History: /api/gse-maintenance/:id/history`);
      console.log(`📋 Service History: /api/gse-maintenance/:id/history`);
      console.log(`💰 Price History: /api/price-history/:partId`);
      console.log(`👥 Users: /api/users`);
      console.log(`\n📊 GSE Status: /api/gse-status`);
      console.log(`📊 GSE Status Summary: /api/gse-status/summary`);
      console.log(`📎 GSE Status Export: /api/gse-status/export`);
    });
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
};

startServer();