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
      users: '/api/users',
      issue: '/api/requests/issue',
      approvals: '/api/approvals/pending',
      priceHistory: '/api/price-history/:partId'
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
// 👥 USER MANAGEMENT ROUTES - FIXED
// ============================================================

// GET ALL USERS - Fixed (removed created_at)
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
    
    console.log(`✅ Found ${result.rows.length} users`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// CREATE NEW USER
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { username, password, full_name, role, email } = req.body;

    console.log('👤 Creating new user:', { username, role, full_name, email });

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
      sql: `
        INSERT INTO users (username, password_hash, full_name, role, email)
        VALUES (?, ?, ?, ?, ?)
        RETURNING id, username, full_name, role, email
      `,
      args: [username, hashedPassword, full_name || username, role || 'storekeeper', email || '']
    });

    console.log(`✅ User "${username}" created with ID: ${result.rows[0].id}`);
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

// DELETE USER
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

    console.log(`✅ User ID ${id} deleted successfully`);
    res.json({ success: true, message: 'User deleted successfully' });

  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// RESET PASSWORD
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

    console.log(`✅ Password reset for user: ${username}`);
    res.json({
      success: true,
      message: `Password reset for ${username} successfully`
    });

  } catch (err) {
    console.error('Error resetting password:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 📤 ISSUE REQUESTS ROUTES - FIXED
// ============================================================

// SUBMIT ISSUE REQUEST - Fixed (added requested_by user ID)
app.post('/api/requests/issue', authenticateToken, async (req, res) => {
  console.log('\n=== 📤 SUBMITTING ISSUE REQUEST ===');
  console.log('User:', req.user.username);
  console.log('Request body:', req.body);

  try {
    const {
      part_number,
      quantity,
      gse_registration,
      technician_name,
      work_order,
      notes
    } = req.body;

    if (!part_number) {
      return res.status(400).json({ error: 'Part number is required' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }
    if (!gse_registration) {
      return res.status(400).json({ error: 'GSE registration is required' });
    }

    const partResult = await db.execute({
      sql: 'SELECT id, part_number, quantity_on_hand, description FROM parts WHERE part_number = ?',
      args: [part_number]
    });

    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: `Part "${part_number}" not found` });
    }

    const part = partResult.rows[0];
    const partId = part.id;
    const currentStock = part.quantity_on_hand || 0;

    if (currentStock < parseInt(quantity)) {
      return res.status(400).json({ 
        error: `Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`
      });
    }

    // FIX: Insert both requested_by (user ID) and requested_by_name
    const result = await db.execute({
      sql: `
        INSERT INTO pending_issues (
          part_number,
          part_id,
          quantity,
          gse_registration,
          technician_name,
          work_order,
          notes,
          requested_by,
          requested_by_name,
          status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        RETURNING id
      `,
      args: [
        part_number,
        partId,
        parseInt(quantity),
        gse_registration,
        technician_name || '',
        work_order || '',
        notes || '',
        req.user.id,        // requested_by (user ID)
        req.user.username,  // requested_by_name (username)
        'pending'
      ]
    });

    const requestId = result.rows[0].id;

    console.log(`✅ Issue request #${requestId} submitted for "${part_number}" by ${req.user.username}`);
    
    res.status(201).json({
      success: true,
      message: 'Issue request submitted for approval',
      request_id: requestId,
      data: {
        part_number,
        quantity: parseInt(quantity),
        requested_by: req.user.username,
        status: 'pending',
        gse_registration
      }
    });

  } catch (err) {
    console.error('❌ Error submitting issue request:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      error: 'Failed to submit issue request',
      details: err.message 
    });
  }
});

// GET MY ISSUE REQUESTS
app.get('/api/requests/my-requests', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Fetching my requests for user:', req.user.username);
    
    const result = await db.execute({
      sql: `
        SELECT 
          id,
          part_number,
          part_id,
          quantity,
          gse_registration,
          technician_name,
          work_order,
          notes,
          requested_by_name,
          status,
          admin_comment,
          approved_by,
          approved_at,
          created_at
        FROM pending_issues 
        WHERE requested_by_name = ? 
        ORDER BY created_at DESC
      `,
      args: [req.user.username]
    });
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching my requests:', err.message);
    res.json([]);
  }
});

// GET ALL PENDING REQUESTS (for approvals)
app.get('/api/requests/pending', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log('📋 Fetching all pending requests...');
    
    const result = await db.execute({
      sql: `
        SELECT 
          p.*,
          parts.quantity_on_hand as current_stock,
          parts.description
        FROM pending_issues p
        LEFT JOIN parts ON p.part_id = parts.id
        WHERE p.status = 'pending'
        ORDER BY p.created_at ASC
      `,
      args: []
    });
    
    console.log(`✅ Found ${result.rows.length} pending requests`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending requests:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET APPROVALS PENDING (alias)
app.get('/api/approvals/pending', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log('📋 Fetching pending approvals...');
    
    const result = await db.execute({
      sql: `
        SELECT 
          p.*,
          parts.quantity_on_hand as current_stock,
          parts.description
        FROM pending_issues p
        LEFT JOIN parts ON p.part_id = parts.id
        WHERE p.status = 'pending'
        ORDER BY p.created_at ASC
      `,
      args: []
    });
    
    console.log(`✅ Found ${result.rows.length} pending approvals`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending approvals:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// APPROVE REQUEST
app.put('/api/approvals/:id/approve', authenticateToken, async (req, res) => {
  console.log('\n=== ✅ APPROVING REQUEST ===');
  console.log('Request ID:', req.params.id);
  console.log('Approved by:', req.user.username);

  try {
    const { id } = req.params;
    const { comment } = req.body;
    const requestId = parseInt(id);
    
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const requestResult = await db.execute({
      sql: 'SELECT * FROM pending_issues WHERE id = ?',
      args: [requestId]
    });

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

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
          return res.status(400).json({ 
            error: `Insufficient stock. Available: ${currentQty}, Requested: ${request.quantity}`
          });
        }
        
        await db.execute({
          sql: 'UPDATE parts SET quantity_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          args: [newQty, request.part_id]
        });
      }
    }

    await db.execute({
      sql: `
        UPDATE pending_issues SET
          status = 'approved',
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP,
          admin_comment = ?
        WHERE id = ?
      `,
      args: [req.user.username, comment || 'Approved', requestId]
    });

    console.log(`✅ Request ${requestId} approved by ${req.user.username}`);
    res.json({
      success: true,
      message: 'Request approved successfully'
    });

  } catch (err) {
    console.error('❌ Error approving request:', err.message);
    res.status(500).json({ error: 'Failed to approve request', details: err.message });
  }
});

// REJECT REQUEST
app.put('/api/approvals/:id/reject', authenticateToken, async (req, res) => {
  console.log('\n=== ❌ REJECTING REQUEST ===');
  console.log('Request ID:', req.params.id);
  console.log('Rejected by:', req.user.username);

  try {
    const { id } = req.params;
    const { comment } = req.body;
    const requestId = parseInt(id);
    
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const requestResult = await db.execute({
      sql: 'SELECT * FROM pending_issues WHERE id = ?',
      args: [requestId]
    });

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    await db.execute({
      sql: `
        UPDATE pending_issues SET
          status = 'rejected',
          admin_comment = ?
        WHERE id = ?
      `,
      args: [comment || 'Rejected', requestId]
    });

    console.log(`✅ Request ${requestId} rejected by ${req.user.username}`);
    res.json({
      success: true,
      message: 'Request rejected successfully'
    });

  } catch (err) {
    console.error('❌ Error rejecting request:', err.message);
    res.status(500).json({ error: 'Failed to reject request', details: err.message });
  }
});

// ============================================================
// ⭐ PARTS CRUD ROUTES
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

// ADD NEW PART
app.post('/api/parts', authenticateToken, async (req, res) => {
  console.log('\n=== 📦 ADDING NEW PART ===');
  console.log('User:', req.user.username);

  try {
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
        part_number, description, manufacturer || '', compatible_gse || '',
        location_bin || '', sanitizeNumber(quantity_on_hand), sanitizeNumber(min_stock),
        sanitizeNumber(max_stock, 100), sanitizeNumber(unit_price), sanitizeNumber(current_price),
        maintenance_type || 'none', sanitizeNumber(service_interval_hours),
        sanitizeNumber(service_interval_months), sanitizeNumber(service_interval_years),
        contact_person || '', contact_phone || '', contact_email || ''
      ]
    });

    console.log(`✅ Part "${part_number}" added with ID: ${result.rows[0].id}`);
    res.status(201).json({
      success: true,
      message: `Part "${part_number}" added successfully`,
      id: result.rows[0].id
    });

  } catch (err) {
    console.error('❌ Error adding part:', err.message);
    res.status(500).json({ error: 'Failed to add part', details: err.message });
  }
});

// ============================================================
// 📥 RECEIVE PART
// ============================================================
app.post('/api/receive', authenticateToken, async (req, res) => {
  console.log('\n=== 📥 RECEIVING PART ===');
  console.log('User:', req.user.username);
  console.log('Request body:', req.body);

  try {
    const { part_number, quantity, unit_price, supplier, notes, location_bin, po_number } = req.body;

    if (!part_number) {
      return res.status(400).json({ error: 'Part number is required' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    const partResult = await db.execute({
      sql: 'SELECT id, part_number, quantity_on_hand, current_price FROM parts WHERE part_number = ?',
      args: [part_number]
    });

    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: `Part "${part_number}" not found` });
    }

    const part = partResult.rows[0];
    const partId = part.id;
    const oldQuantity = part.quantity_on_hand || 0;
    const newQuantity = oldQuantity + parseInt(quantity);
    const sanitizedUnitPrice = parseFloat(unit_price) || 0;

    await db.execute({
      sql: 'UPDATE parts SET quantity_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [newQuantity, partId]
    });

    if (sanitizedUnitPrice > 0) {
      await db.execute({
        sql: 'UPDATE parts SET unit_price = ?, current_price = ? WHERE id = ?',
        args: [sanitizedUnitPrice, sanitizedUnitPrice, partId]
      });

      await db.execute({
        sql: `
          INSERT INTO price_history (part_id, price, quantity, transaction_type, notes, recorded_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        args: [
          partId, sanitizedUnitPrice, parseInt(quantity),
          'RECEIVE', notes || `Received ${quantity} units`, req.user.username
        ]
      });
    }

    await db.execute({
      sql: `
        INSERT INTO transactions (part_id, transaction_type, quantity, price, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      args: [partId, 'RECEIVE', parseInt(quantity), sanitizedUnitPrice, notes || '', req.user.username]
    });

    console.log(`✅ Received ${quantity} of "${part_number}"`);
    res.json({
      success: true,
      message: `Received ${quantity} of "${part_number}" successfully`,
      data: {
        part_number,
        old_quantity: oldQuantity,
        new_quantity: newQuantity,
        added_quantity: parseInt(quantity),
        unit_price: sanitizedUnitPrice
      }
    });

  } catch (err) {
    console.error('❌ Error receiving part:', err.message);
    res.status(500).json({ error: 'Failed to receive part', details: err.message });
  }
});

// ============================================================
// ⭐ PRICE HISTORY ROUTES
// ============================================================

// GET PRICE HISTORY
app.get('/api/price-history/:partId', authenticateToken, async (req, res) => {
  try {
    const { partId } = req.params;
    console.log('💰 Getting price history for part:', partId);

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

// ADD PRICE HISTORY
app.post('/api/price-history', authenticateToken, async (req, res) => {
  const { part_id, price, quantity, transaction_type, notes } = req.body;

  try {
    const partResult = await db.execute({
      sql: 'SELECT * FROM parts WHERE id = ?',
      args: [part_id]
    });

    if (partResult.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const sanitizedPrice = parseFloat(price) || 0;
    const sanitizedQuantity = parseInt(quantity) || 1;

    await db.execute({
      sql: `INSERT INTO price_history (part_id, price, quantity, transaction_type, notes, recorded_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [part_id, sanitizedPrice, sanitizedQuantity, transaction_type || 'MANUAL', notes || '', req.user?.username || 'system']
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

// UPDATE PRICE
app.put('/api/parts/:partId/price', authenticateToken, async (req, res) => {
  const { partId } = req.params;
  const { price } = req.body;

  try {
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

    res.json({
      success: true,
      message: `Price updated for ${part.part_number}`,
      oldPrice,
      newPrice
    });

  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ error: 'Failed to update price', details: error.message });
  }
});

// ============================================================
// 📊 TRANSACTIONS ROUTES
// ============================================================

// GET ALL TRANSACTIONS
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0, type, part_id } = req.query;
    
    let query = `
      SELECT 
        t.*,
        p.part_number,
        p.description
      FROM transactions t
      LEFT JOIN parts p ON t.part_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ` AND t.transaction_type = ?`;
      params.push(type);
    }

    if (part_id) {
      query += ` AND t.part_id = ?`;
      params.push(part_id);
    }

    query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.execute({ sql: query, args: params });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET RECEIVE TRANSACTIONS
app.get('/api/transactions/receive', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `
        SELECT 
          t.*,
          p.part_number,
          p.description
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

// GET ISSUE TRANSACTIONS
app.get('/api/transactions/issue', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `
        SELECT 
          t.*,
          p.part_number,
          p.description
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

// ============================================================
// 📊 DASHBOARD ROUTES
// ============================================================

// GET PENDING REQUESTS COUNT
app.get('/api/requests/pending/count', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM pending_issues WHERE status = "pending"',
      args: []
    });
    res.json({ count: result.rows[0]?.count || 0 });
  } catch (err) {
    console.error('Error fetching pending requests:', err.message);
    res.json({ count: 0 });
  }
});

// GET LOW STOCK REPORT
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

// GET PARTS COUNT
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

// GET MAINTENANCE COUNT
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

// GET OVERDUE MAINTENANCE
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

// ============================================================
// 🏥 HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
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
      console.log(`\n👥 Users API:`);
      console.log(`   GET /api/users - Get all users`);
      console.log(`   POST /api/users - Create user`);
      console.log(`   DELETE /api/users/:id - Delete user`);
      console.log(`   POST /api/admin/reset-password - Reset password`);
      console.log(`\n📤 Issue API:`);
      console.log(`   POST /api/requests/issue - Submit issue request`);
      console.log(`   GET /api/requests/my-requests - Get my requests`);
      console.log(`   GET /api/requests/pending - Get pending requests`);
      console.log(`   PUT /api/approvals/:id/approve - Approve request`);
      console.log(`   PUT /api/approvals/:id/reject - Reject request`);
      console.log(`\n📦 Parts API:`);
      console.log(`   GET /api/parts - Get all parts`);
      console.log(`   POST /api/parts - Add part`);
      console.log(`   GET /api/parts/:id - Get part`);
      console.log(`\n💰 Price History API:`);
      console.log(`   GET /api/price-history/:partId - Get price history`);
      console.log(`   POST /api/price-history - Add price`);
      console.log(`   PUT /api/parts/:partId/price - Update price`);
      console.log(`\n📥 Receive API:`);
      console.log(`   POST /api/receive - Receive part`);
      console.log(`\n📊 Dashboard API:`);
      console.log(`   GET /api/reports/low-stock - Low stock report`);
    });
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
};

startServer();