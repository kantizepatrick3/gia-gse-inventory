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
      partsById: '/api/parts/:id',
      addPart: '/api/parts (POST)',
      receivePart: '/api/receive (POST)',
      receiveParts: '/api/receive-parts (POST)',
      issuePart: '/api/issue (POST)',
      pendingApprovals: '/api/approvals/pending (GET)',
      approveRequest: '/api/approvals/:id/approve (PUT)',
      rejectRequest: '/api/approvals/:id/reject (PUT)',
      priceHistory: '/api/price-history/:partId',
      transactionsReceive: '/api/transactions/receive',
      requestsIssue: '/api/requests/issue',
      myRequests: '/api/requests/my-requests'
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
// ⭐ PARTS CRUD ROUTES - COMPLETE
// ============================================================

// GET ALL PARTS
app.get('/api/parts', authenticateToken, async (req, res) => {
  try {
    console.log('📦 Fetching all parts...');
    const result = await db.execute('SELECT * FROM parts ORDER BY part_number');
    console.log(`✅ Found ${result.rows.length} parts`);
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
    console.log(`📦 Fetching part with ID: ${id}`);
    
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

// ============================================================
// ⭐ ADD NEW PART - POST
// ============================================================
app.post('/api/parts', authenticateToken, async (req, res) => {
  console.log('\n=== 📦 ADDING NEW PART ===');
  console.log('User:', req.user.username);
  console.log('Request body:', req.body);

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

    // Validate required fields
    if (!part_number) {
      return res.status(400).json({ error: 'Part number is required' });
    }
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Check if part already exists
    const existing = await db.execute({
      sql: 'SELECT id FROM parts WHERE part_number = ?',
      args: [part_number]
    });

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `Part "${part_number}" already exists` });
    }

    // Insert new part
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
        part_number,
        description,
        manufacturer || '',
        compatible_gse || '',
        location_bin || '',
        sanitizeNumber(quantity_on_hand, 0),
        sanitizeNumber(min_stock, 0),
        sanitizeNumber(max_stock, 100),
        sanitizeNumber(unit_price, 0),
        sanitizeNumber(current_price, 0),
        maintenance_type || 'none',
        sanitizeNumber(service_interval_hours, 0),
        sanitizeNumber(service_interval_months, 0),
        sanitizeNumber(service_interval_years, 0),
        contact_person || '',
        contact_phone || '',
        contact_email || ''
      ]
    });

    const newId = result.rows[0].id;
    console.log(`✅ Part "${part_number}" added with ID: ${newId}`);

    res.status(201).json({
      success: true,
      message: `Part "${part_number}" added successfully`,
      id: newId
    });

  } catch (err) {
    console.error('❌ Error adding part:', err.message);
    res.status(500).json({
      error: 'Failed to add part',
      details: err.message
    });
  }
});

// UPDATE PART
app.put('/api/parts/:id', authenticateToken, async (req, res) => {
  console.log('\n=== 🔄 UPDATING PART ===');
  console.log('Part ID:', req.params.id);
  console.log('Request body:', req.body);

  try {
    const { id } = req.params;
    const {
      description,
      manufacturer,
      compatible_gse,
      location_bin,
      min_stock,
      max_stock,
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

    const partId = parseInt(id);
    if (isNaN(partId)) {
      return res.status(400).json({ error: 'Invalid part ID' });
    }

    // Check if part exists
    const existing = await db.execute({
      sql: 'SELECT id FROM parts WHERE id = ?',
      args: [partId]
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    await db.execute({
      sql: `
        UPDATE parts SET
          description = ?,
          manufacturer = ?,
          compatible_gse = ?,
          location_bin = ?,
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
        sanitizeNumber(min_stock, 0),
        sanitizeNumber(max_stock, 100),
        sanitizeNumber(unit_price, 0),
        sanitizeNumber(current_price, 0),
        maintenance_type || 'none',
        sanitizeNumber(service_interval_hours, 0),
        sanitizeNumber(service_interval_months, 0),
        sanitizeNumber(service_interval_years, 0),
        contact_person || '',
        contact_phone || '',
        contact_email || '',
        partId
      ]
    });

    console.log(`✅ Part ID ${partId} updated successfully`);
    res.json({
      success: true,
      message: 'Part updated successfully'
    });

  } catch (err) {
    console.error('❌ Error updating part:', err.message);
    res.status(500).json({ error: 'Failed to update part', details: err.message });
  }
});

// DELETE PART
app.delete('/api/parts/:id', authenticateToken, async (req, res) => {
  console.log('\n=== 🗑️ DELETING PART ===');
  console.log('Part ID:', req.params.id);

  try {
    const { id } = req.params;
    const partId = parseInt(id);
    if (isNaN(partId)) {
      return res.status(400).json({ error: 'Invalid part ID' });
    }

    // Check if part exists
    const existing = await db.execute({
      sql: 'SELECT part_number FROM parts WHERE id = ?',
      args: [partId]
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const partNumber = existing.rows[0].part_number;

    // Delete part (cascade will handle related records)
    await db.execute({
      sql: 'DELETE FROM parts WHERE id = ?',
      args: [partId]
    });

    console.log(`✅ Part "${partNumber}" deleted successfully`);
    res.json({
      success: true,
      message: `Part "${partNumber}" deleted successfully`
    });

  } catch (err) {
    console.error('❌ Error deleting part:', err.message);
    res.status(500).json({ error: 'Failed to delete part', details: err.message });
  }
});

// ============================================================
// ⭐ RECEIVE PART - POST
// ============================================================
app.post('/api/receive', authenticateToken, async (req, res) => {
  console.log('\n=== 📥 RECEIVING PART ===');
  console.log('User:', req.user.username);
  console.log('Request body:', req.body);

  try {
    const { part_number, quantity, unit_price, location_bin, supplier, notes, po_number } = req.body;

    if (!part_number) {
      return res.status(400).json({ error: 'Part number is required' });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    // Find the part
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

    // Update quantity
    await db.execute({
      sql: 'UPDATE parts SET quantity_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [newQuantity, partId]
    });

    // Update price if provided
    if (sanitizedUnitPrice > 0) {
      await db.execute({
        sql: 'UPDATE parts SET unit_price = ?, current_price = ? WHERE id = ?',
        args: [sanitizedUnitPrice, sanitizedUnitPrice, partId]
      });

      // Record price history
      await db.execute({
        sql: `
          INSERT INTO price_history (part_id, price, quantity, transaction_type, notes, recorded_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        args: [
          partId,
          sanitizedUnitPrice,
          parseInt(quantity),
          'RECEIVE',
          notes || `Received ${quantity} units from ${supplier || 'unknown supplier'}`,
          req.user.username
        ]
      });
    }

    // Record transaction
    await db.execute({
      sql: `
        INSERT INTO transactions (part_id, transaction_type, quantity, price, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      args: [
        partId,
        'RECEIVE',
        parseInt(quantity),
        sanitizedUnitPrice,
        notes || `Received from ${supplier || 'unknown'}`,
        req.user.username
      ]
    });

    console.log(`✅ Received ${quantity} of "${part_number}"`);
    res.json({
      success: true,
      message: `Received ${quantity} of "${part_number}" successfully`,
      data: {
        part_number: part_number,
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
// ⭐ ISSUE PART - POST
// ============================================================
app.post('/api/issue', authenticateToken, async (req, res) => {
  console.log('\n=== 📤 ISSUING PART ===');
  console.log('User:', req.user.username);
  console.log('Request body:', req.body);

  try {
    const { part_number, quantity, technician_name, gse_registration, work_order, notes } = req.body;

    if (!part_number) {
      return res.status(400).json({ error: 'Part number is required' });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    // Find the part
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
    const newQuantity = oldQuantity - parseInt(quantity);

    if (newQuantity < 0) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${oldQuantity}` });
    }

    // Update quantity
    await db.execute({
      sql: 'UPDATE parts SET quantity_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [newQuantity, partId]
    });

    // Record transaction
    await db.execute({
      sql: `
        INSERT INTO transactions (part_id, transaction_type, quantity, price, gse_registration, technician_name, work_order, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      args: [
        partId,
        'ISSUE',
        parseInt(quantity),
        0,
        gse_registration || '',
        technician_name || '',
        work_order || '',
        notes || `Issued ${quantity} to ${technician_name || 'unknown'}`,
        req.user.username
      ]
    });

    console.log(`✅ Issued ${quantity} of "${part_number}"`);
    res.json({
      success: true,
      message: `Issued ${quantity} of "${part_number}" successfully`,
      data: {
        part_number: part_number,
        old_quantity: oldQuantity,
        new_quantity: newQuantity,
        issued_quantity: parseInt(quantity)
      }
    });

  } catch (err) {
    console.error('❌ Error issuing part:', err.message);
    res.status(500).json({ error: 'Failed to issue part', details: err.message });
  }
});

// ============================================================
// ⭐ APPROVALS ROUTES
// ============================================================

// GET PENDING APPROVALS
app.get('/api/approvals/pending', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Fetching pending approvals...');
    
    const result = await db.execute({
      sql: 'SELECT * FROM pending_issues WHERE status = "pending" ORDER BY created_at DESC',
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
    const requestId = parseInt(id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    // Get the request
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

    // Update request status
    await db.execute({
      sql: `
        UPDATE pending_issues SET
          status = 'approved',
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP,
          admin_comment = ?
        WHERE id = ?
      `,
      args: [req.user.username, req.body.comment || 'Approved', requestId]
    });

    // Update part quantity
    if (request.part_id) {
      const partResult = await db.execute({
        sql: 'SELECT quantity_on_hand FROM parts WHERE id = ?',
        args: [request.part_id]
      });

      if (partResult.rows.length > 0) {
        const currentQty = partResult.rows[0].quantity_on_hand || 0;
        const newQty = currentQty - request.quantity;
        
        if (newQty >= 0) {
          await db.execute({
            sql: 'UPDATE parts SET quantity_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            args: [newQty, request.part_id]
          });
        }
      }
    }

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
    const requestId = parseInt(id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    // Get the request
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

    // Update request status
    await db.execute({
      sql: `
        UPDATE pending_issues SET
          status = 'rejected',
          admin_comment = ?
        WHERE id = ?
      `,
      args: [req.body.comment || 'Rejected', requestId]
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
// ⭐ PRICE HISTORY ROUTES
// ============================================================

// GET PRICE HISTORY FOR A SPECIFIC PART
app.get('/api/price-history/:partId', authenticateToken, async (req, res) => {
  try {
    const { partId } = req.params;
    console.log('💰 Getting price history for part:', partId);

    try {
      const tableCheck = await db.execute(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='price_history'
      `);
      if (tableCheck.rows.length === 0) {
        console.log('⚠️ price_history table does not exist');
        return res.json([]);
      }
    } catch (e) {
      console.log('⚠️ Could not check table:', e.message);
      return res.json([]);
    }

    const result = await db.execute({
      sql: `SELECT * FROM price_history WHERE part_id = ? ORDER BY created_at DESC LIMIT 10`,
      args: [partId]
    });

    console.log('✅ Found', result.rows.length, 'price history records');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching price history:', err.message);
    res.json([]);
  }
});

// ADD PRICE HISTORY RECORD
app.post('/api/price-history', authenticateToken, async (req, res) => {
  const { part_id, price, quantity, transaction_type, notes } = req.body;

  console.log('💰 Adding price history:', { part_id, price, quantity, transaction_type, notes });

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

    console.log('✅ Price updated successfully for part:', part_id);
    res.json({ success: true, message: 'Price updated successfully!' });
  } catch (err) {
    console.error('Error adding price history:', err.message);
    res.status(500).json({ error: err.message });
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
    console.log('📥 Fetching receive transactions...');
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
    console.log(`✅ Found ${result.rows.length} receive transactions`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching receive transactions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET ISSUE TRANSACTIONS
app.get('/api/transactions/issue', authenticateToken, async (req, res) => {
  try {
    console.log('📤 Fetching issue transactions...');
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
    console.log(`✅ Found ${result.rows.length} issue transactions`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching issue transactions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 📋 REQUESTS ROUTES
// ============================================================

// GET MY REQUESTS
app.get('/api/requests/my-requests', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Fetching my requests for user:', req.user.username);
    
    const result = await db.execute({
      sql: 'SELECT * FROM pending_issues WHERE requested_by_name = ? ORDER BY created_at DESC',
      args: [req.user.username]
    });
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching my requests:', err.message);
    res.json([]);
  }
});

// GET ISSUE REQUESTS
app.get('/api/requests/issue', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Fetching issue requests...');
    
    const result = await db.execute({
      sql: 'SELECT * FROM pending_issues ORDER BY created_at DESC LIMIT 100',
      args: []
    });
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching issue requests:', err.message);
    res.json([]);
  }
});

// GET PENDING REQUESTS
app.get('/api/requests/pending', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Fetching pending requests count...');
    
    const tableCheck = await db.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='pending_issues'
    `);
    
    let count = 0;
    if (tableCheck.rows.length > 0) {
      const result = await db.execute({
        sql: 'SELECT COUNT(*) as count FROM pending_issues',
        args: []
      });
      count = result.rows[0]?.count || 0;
    }
    console.log(`📊 Pending requests: ${count}`);
    res.json({ count });
  } catch (err) {
    console.error('Error fetching pending requests:', err.message);
    res.json({ count: 0 });
  }
});

// ============================================================
// ⭐ RECEIVE PARTS - WITH PRICE TRACKING (Original)
// ============================================================
app.post('/api/receive-parts', authenticateToken, async (req, res) => {
  console.log('\n=== 📥 RECEIVING PARTS (Bulk) ===');
  console.log('User:', req.user.username);
  console.log('Request body:', req.body);

  try {
    const { items, notes, receive_date } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items to receive' });
    }

    console.log(`📊 Receiving ${items.length} items`);

    const results = {
      received: [],
      errors: [],
      priceHistoryUpdated: []
    };

    for (const [index, item] of items.entries()) {
      try {
        const {
          part_id,
          part_number,
          quantity,
          unit_price,
          total_price,
          location_bin,
          supplier,
          po_number,
          price_notes,
          notes: itemNotes
        } = item;

        if (!part_id && !part_number) {
          results.errors.push({ row: index + 1, error: 'Missing part_id or part_number' });
          continue;
        }

        const sanitizedQuantity = sanitizeNumber(quantity, 1);
        const sanitizedUnitPrice = sanitizeNumber(unit_price, 0);
        const sanitizedTotalPrice = sanitizeNumber(total_price, sanitizedUnitPrice * sanitizedQuantity);

        let partResult;
        if (part_id) {
          partResult = await db.execute({
            sql: 'SELECT id, part_number, description, quantity_on_hand, current_price, unit_price FROM parts WHERE id = ?',
            args: [part_id]
          });
        } else {
          partResult = await db.execute({
            sql: 'SELECT id, part_number, description, quantity_on_hand, current_price, unit_price FROM parts WHERE part_number = ?',
            args: [part_number]
          });
        }

        if (partResult.rows.length === 0) {
          results.errors.push({
            row: index + 1,
            error: `Part ${part_number || part_id} not found`
          });
          continue;
        }

        const part = partResult.rows[0];
        const partId = part.id;
        const oldQuantity = part.quantity_on_hand || 0;
        const oldPrice = part.current_price || 0;
        const newQuantity = oldQuantity + sanitizedQuantity;

        await db.execute({
          sql: `
            UPDATE parts SET
              quantity_on_hand = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          args: [newQuantity, partId]
        });

        let priceUpdated = false;
        let priceChangeDetails = '';

        if (sanitizedUnitPrice > 0) {
          await db.execute({
            sql: `
              UPDATE parts SET
                unit_price = ?,
                current_price = ?,
                last_purchase_price = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            args: [sanitizedUnitPrice, sanitizedUnitPrice, sanitizedUnitPrice, partId]
          });

          const historyNotes = [
            `Received ${sanitizedQuantity} units @ $${sanitizedUnitPrice.toFixed(2)} each`,
            price_notes ? `(${price_notes})` : '',
            itemNotes ? `Notes: ${itemNotes}` : '',
            supplier ? `Supplier: ${supplier}` : '',
            po_number ? `PO: ${po_number}` : ''
          ].filter(Boolean).join(' | ');

          await db.execute({
            sql: `
              INSERT INTO price_history (
                part_id, price, quantity, transaction_type,
                reference_number, notes, recorded_by, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `,
            args: [
              partId,
              sanitizedUnitPrice,
              sanitizedQuantity,
              'RECEIVE',
              po_number || '',
              historyNotes || `Received ${sanitizedQuantity} units @ $${sanitizedUnitPrice.toFixed(2)} each`,
              req.user.username
            ]
          });

          priceUpdated = true;
          priceChangeDetails = `Price updated from $${oldPrice.toFixed(2)} to $${sanitizedUnitPrice.toFixed(2)}`;

          results.priceHistoryUpdated.push({
            part_number: part.part_number,
            old_price: oldPrice,
            new_price: sanitizedUnitPrice,
            quantity: sanitizedQuantity,
            total_price: sanitizedTotalPrice
          });

          console.log(`💰 Price updated for ${part.part_number}: $${oldPrice} → $${sanitizedUnitPrice}`);
        } else {
          priceChangeDetails = 'Price unchanged (no new price provided)';
          console.log(`ℹ️ No price change for ${part.part_number}`);
        }

        await db.execute({
          sql: `
            INSERT INTO transactions (
              part_id, transaction_type, quantity, price,
              gse_registration, technician_name, work_order,
              reference_number, notes, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `,
          args: [
            partId,
            'RECEIVE',
            sanitizedQuantity,
            sanitizedUnitPrice,
            location_bin || '',
            supplier || '',
            po_number || '',
            po_number || '',
            `Received ${sanitizedQuantity} units. ${priceChangeDetails}. ${itemNotes || ''}`,
            req.user.username
          ]
        });

        results.received.push({
          part_number: part.part_number,
          description: part.description,
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          added_quantity: sanitizedQuantity,
          unit_price: sanitizedUnitPrice,
          total_price: sanitizedTotalPrice,
          price_updated: priceUpdated,
          price_change: priceChangeDetails
        });

        console.log(`✅ Received ${sanitizedQuantity} of ${part.part_number} at $${sanitizedUnitPrice.toFixed(2)} each`);

      } catch (rowError) {
        console.error(`❌ Error processing row ${index + 1}:`, rowError.message);
        results.errors.push({
          row: index + 1,
          error: rowError.message,
          data: item
        });
      }
    }

    console.log(`✅ Receive complete: ${results.received.length} items received`);

    res.json({
      success: true,
      message: `Successfully received ${results.received.length} items`,
      results: {
        received: results.received.length,
        priceHistoryUpdated: results.priceHistoryUpdated.length,
        errors: results.errors.length
      },
      details: {
        received: results.received,
        priceHistoryUpdated: results.priceHistoryUpdated,
        errors: results.errors
      }
    });

  } catch (error) {
    console.error('❌ Receive error:', error);
    res.status(500).json({
      error: 'Failed to receive parts',
      details: error.message
    });
  }
});

// ============================================================
// ⭐ GET RECEIVE HISTORY
// ============================================================
app.get('/api/receive-history', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, partId } = req.query;

    let query = `
      SELECT
        t.*,
        p.part_number,
        p.description
      FROM transactions t
      LEFT JOIN parts p ON t.part_id = p.id
      WHERE t.transaction_type = 'RECEIVE'
    `;

    const params = [];

    if (startDate) {
      query += ` AND date(t.created_at) >= date(?)`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND date(t.created_at) <= date(?)`;
      params.push(endDate);
    }

    if (partId) {
      query += ` AND t.part_id = ?`;
      params.push(partId);
    }

    query += ` ORDER BY t.created_at DESC`;

    const result = await db.execute({ sql: query, args: params });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching receive history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PRICE UPDATE ROUTE - For React frontend (PUT)
// ============================================================
app.put('/api/parts/:partId/price', authenticateToken, async (req, res) => {
  console.log('\n=== 🔄 PRICE UPDATE REQUEST ===');
  console.log('Part ID:', req.params.partId);
  console.log('New Price:', req.body.price);

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

    await db.execute({
      sql: 'UPDATE parts SET current_price = ?, unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [newPrice, newPrice, partIdNumber]
    });

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
// IMPORT PARTS FROM EXCEL WITH AUTO-MAINTENANCE CREATION
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

        if (!part_number) {
          results.errors.push({ row: index + 1, error: 'Missing part_number' });
          continue;
        }

        const existingPart = await db.execute({
          sql: 'SELECT id, part_number FROM parts WHERE part_number = ?',
          args: [part_number]
        });

        let partId;

        if (existingPart.rows.length > 0) {
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
              sanitizeNumber(quantity_on_hand, 0),
              sanitizeNumber(min_stock, 0),
              sanitizeNumber(max_stock, 100),
              sanitizeNumber(unit_price, 0),
              sanitizeNumber(current_price, 0),
              maintenance_type || 'none',
              sanitizeNumber(service_interval_hours, 0),
              sanitizeNumber(service_interval_months, 0),
              sanitizeNumber(service_interval_years, 0),
              contact_person || '',
              contact_phone || '',
              contact_email || '',
              partId
            ]
          });
          results.skipped.push({ part_number, reason: 'Updated existing part' });
        } else {
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
              sanitizeNumber(quantity_on_hand, 0),
              sanitizeNumber(min_stock, 0),
              sanitizeNumber(max_stock, 100),
              sanitizeNumber(unit_price, 0),
              sanitizeNumber(current_price, 0),
              maintenance_type || 'none',
              sanitizeNumber(service_interval_hours, 0),
              sanitizeNumber(service_interval_months, 0),
              sanitizeNumber(service_interval_years, 0),
              contact_person || '',
              contact_phone || '',
              contact_email || ''
            ]
          });

          partId = insertResult.rows[0].id;
          results.imported.push({ part_number, description });
        }

        // Auto-create maintenance record
        if (maintenance_type && maintenance_type !== 'none') {
          const existingMaintenance = await db.execute({
            sql: 'SELECT id FROM gse_maintenance WHERE part_id = ?',
            args: [partId]
          });

          if (existingMaintenance.rows.length === 0) {
            const equipmentName = description || part_number;

            let nextServiceDate = null;
            let nextServiceYear = null;

            const intervalMonths = sanitizeNumber(service_interval_months, 0);
            const intervalYears = sanitizeNumber(service_interval_years, 0);
            const intervalHours = sanitizeNumber(service_interval_hours, 0);

            if (maintenance_type === 'month' && intervalMonths > 0) {
              const today = new Date();
              nextServiceDate = new Date(today);
              nextServiceDate.setMonth(nextServiceDate.getMonth() + intervalMonths);
              nextServiceDate = nextServiceDate.toISOString().split('T')[0];
            } else if (maintenance_type === 'year' && intervalYears > 0) {
              const today = new Date();
              nextServiceYear = today.getFullYear() + intervalYears;
            }

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
                null,
                0,
                null,
                null,
                intervalHours,
                intervalMonths,
                intervalYears,
                0,
                0,
                intervalHours,
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
              interval: maintenance_type === 'month' ? `${intervalMonths} months` :
                        maintenance_type === 'year' ? `${intervalYears} years` :
                        maintenance_type === 'hour' ? `${intervalHours} hours` : 'N/A'
            });

            console.log(`✅ Auto-created maintenance for ${part_number}`);
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
// 📊 DASHBOARD ROUTES
// ============================================================

// GET low stock report for dashboard
app.get('/api/reports/low-stock', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Fetching low stock items...');
    const result = await db.execute({
      sql: `SELECT * FROM parts WHERE quantity_on_hand <= min_stock ORDER BY quantity_on_hand ASC LIMIT 20`,
      args: []
    });
    console.log(`📊 Low stock items: ${result.rows.length}`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching low stock:', err.message);
    res.json([]);
  }
});

// GET maintenance count for dashboard
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

// GET overdue maintenance count for dashboard
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

// GET all requests
app.get('/api/requests', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM pending_issues';
    const args = [];

    if (status) {
      sql += ' WHERE status = ?';
      args.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching requests:', err.message);
    res.json([]);
  }
});

console.log('✅ Dashboard routes loaded');

// ============================================================
// 🐛 DEBUG: Get all maintenance equipment
// ============================================================
app.get('/api/debug/maintenance', authenticateToken, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT id, equipment_name, maintenance_type, status 
      FROM gse_maintenance 
      ORDER BY id
    `);
    res.json({
      count: result.rows.length,
      equipment: result.rows
    });
  } catch (err) {
    console.error('Error fetching maintenance debug:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 📋 GET ALL MAINTENANCE (for dropdown/selection)
// ============================================================
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

// ============================================================
// 🐛 DEBUG: Check service_history table
// ============================================================
app.get('/api/debug/service-history', authenticateToken, async (req, res) => {
  try {
    console.log('🐛 Debugging service_history...');
    
    const tableCheck = await db.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='service_history'
    `);
    
    const result = {
      table_exists: tableCheck.rows.length > 0,
      records: [],
      count: 0
    };
    
    if (tableCheck.rows.length > 0) {
      const records = await db.execute(`
        SELECT * FROM service_history ORDER BY id DESC LIMIT 20
      `);
      result.records = records.rows;
      result.count = records.rows.length;
      console.log(`✅ Found ${records.rows.length} records in service_history`);
    } else {
      console.log('⚠️ service_history table does not exist');
    }
    
    res.json(result);
  } catch (err) {
    console.error('Error debugging service_history:', err.message);
    res.json({ error: err.message });
  }
});

// ============================================================
// 🐛 DEBUG: Check raw service records for a specific equipment
// ============================================================
app.get('/api/debug/raw-history/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🐛 Debugging raw history for equipment ID: ${id}`);
    
    const maintenance = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });
    
    const history = await db.execute({
      sql: 'SELECT * FROM service_history WHERE maintenance_id = ? ORDER BY id DESC',
      args: [id]
    });
    
    const columns = await db.execute(`PRAGMA table_info(service_history)`);
    
    const result = {
      maintenance: maintenance.rows[0] || null,
      history: history.rows || [],
      history_count: history.rows.length,
      table_columns: columns.rows.map(c => c.name)
    };
    
    console.log(`✅ Found ${history.rows.length} history records for equipment ${id}`);
    res.json(result);
  } catch (err) {
    console.error('Error in raw history debug:', err.message);
    res.json({ error: err.message });
  }
});

// ============================================================
// UTILITY FUNCTIONS
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

    const sanitizedServiceIntervalHours = sanitizeNumber(service_interval_hours, 0);
    const sanitizedServiceIntervalMonths = sanitizeNumber(service_interval_months, 0);
    const sanitizedServiceIntervalYears = sanitizeNumber(service_interval_years, 0);
    const sanitizedServiceIntervalMonthsForHour = sanitizeNumber(service_interval_months_for_hour, 0);
    const sanitizedCurrentHours = sanitizeNumber(current_hours, 0);
    const sanitizedTargetHours = sanitizeNumber(target_hours, 0);

    if (maintenance_type === 'hour') {
      if (sanitizedServiceIntervalMonthsForHour > 0 && last_service_date) {
        nextServiceDate = calculateNextServiceDate(last_service_date, sanitizedServiceIntervalMonthsForHour);
      }
    } else if (maintenance_type === 'month') {
      if (last_service_date && sanitizedServiceIntervalMonths > 0) {
        nextServiceDate = calculateNextServiceDate(last_service_date, sanitizedServiceIntervalMonths);
      }
    } else if (maintenance_type === 'year') {
      if (last_service_year && sanitizedServiceIntervalYears > 0) {
        nextServiceYear = parseInt(last_service_year) + sanitizedServiceIntervalYears;
      }
      if (last_service_full_date && sanitizedServiceIntervalYears > 0) {
        nextServiceDate = calculateNextServiceDateYears(last_service_full_date, sanitizedServiceIntervalYears);
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
        sanitizedServiceIntervalHours,
        last_service_year || null,
        last_service_full_date || null,
        sanitizedServiceIntervalHours,
        sanitizedServiceIntervalMonths,
        sanitizedServiceIntervalYears,
        sanitizedServiceIntervalMonthsForHour,
        sanitizedCurrentHours,
        sanitizedTargetHours,
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

    const sanitizedServiceIntervalHours = sanitizeNumber(service_interval_hours, 0);
    const sanitizedServiceIntervalMonths = sanitizeNumber(service_interval_months, 0);
    const sanitizedServiceIntervalYears = sanitizeNumber(service_interval_years, 0);
    const sanitizedServiceIntervalMonthsForHour = sanitizeNumber(service_interval_months_for_hour, 0);
    const sanitizedTargetHours = sanitizeNumber(target_hours, 0);

    if (maintenance_type === 'hour') {
      if (sanitizedServiceIntervalMonthsForHour > 0 && last_service_date) {
        newNextServiceDate = calculateNextServiceDate(last_service_date, sanitizedServiceIntervalMonthsForHour);
      }
    } else if (maintenance_type === 'month') {
      if (last_service_date && sanitizedServiceIntervalMonths > 0) {
        newNextServiceDate = calculateNextServiceDate(last_service_date, sanitizedServiceIntervalMonths);
      }
    } else if (maintenance_type === 'year') {
      if (last_service_year && sanitizedServiceIntervalYears > 0) {
        newNextServiceYear = parseInt(last_service_year) + sanitizedServiceIntervalYears;
      }
      if (last_service_full_date && sanitizedServiceIntervalYears > 0) {
        newNextServiceDate = calculateNextServiceDateYears(last_service_full_date, sanitizedServiceIntervalYears);
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
        sanitizedServiceIntervalHours,
        sanitizedServiceIntervalMonths,
        sanitizedServiceIntervalYears,
        sanitizedServiceIntervalMonthsForHour,
        last_service_date || null,
        sanitizeNumber(last_service_hours, 0),
        last_service_year || null,
        last_service_full_date || null,
        sanitizedTargetHours,
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
    const sanitizedCurrentHours = sanitizeNumber(current_hours, 0);
    const hoursRemaining = (equipment.target_hours || equipment.service_interval_hours || 0) - sanitizedCurrentHours;

    await db.execute({
      sql: `
        UPDATE gse_maintenance SET
          current_hours = ?,
          hours_remaining = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [sanitizedCurrentHours, hoursRemaining, id]
    });

    res.json({
      success: true,
      message: 'Hours updated successfully',
      data: { current_hours: sanitizedCurrentHours, hours_remaining: hoursRemaining }
    });
  } catch (err) {
    console.error('Error updating hours:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ⭐ RECORD SERVICE - FIXED TO SAVE TO service_history
// ============================================================
app.post('/api/gse-maintenance/:id/service', authenticateToken, async (req, res) => {
  console.log('\n=== 🔧 RECORDING SERVICE ===');
  console.log('Maintenance ID:', req.params.id);
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const { id } = req.params;
  const {
    service_performed,
    technician_name,
    notes,
    service_date,
    current_hours,
    target_hours,
    months_interval,
    maintenance_category
  } = req.body;

  try {
    if (!service_performed && !technician_name && !notes) {
      return res.status(400).json({ 
        error: 'At least one of service_performed, technician_name, or notes is required' 
      });
    }

    const result = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const equipment = result.rows[0];
    const isPreventive = maintenance_category === 'preventive';
    const serviceDate = service_date || new Date().toISOString().split('T')[0];

    const sanitizedCurrentHours = sanitizeNumber(current_hours, 0);
    const sanitizedTargetHours = sanitizeNumber(target_hours, equipment.target_hours || 0);
    const sanitizedMonthsInterval = sanitizeNumber(months_interval, 0);
    const sanitizedServiceIntervalMonths = sanitizeNumber(equipment.service_interval_months, 0);
    const sanitizedServiceIntervalYears = sanitizeNumber(equipment.service_interval_years, 0);
    const sanitizedServiceIntervalMonthsForHour = sanitizeNumber(equipment.service_interval_months_for_hour, 0);

    let nextServiceDate = null;
    let nextServiceYear = null;

    // ============================================================
    // 1. INSERT INTO service_history FIRST
    // ============================================================
    console.log('📝 Inserting into service_history...');
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS service_history (
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
      )
    `);
    console.log('✅ service_history table verified');

    try {
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
          parseInt(id),
          equipment.equipment_name,
          equipment.equipment_type,
          equipment.maintenance_type,
          serviceDate,
          service_performed || '',
          technician_name || '',
          notes || '',
          maintenance_category || 'preventive',
          sanitizedCurrentHours,
          sanitizedTargetHours,
          sanitizedMonthsInterval > 0 ? sanitizedMonthsInterval : sanitizedServiceIntervalMonths,
          sanitizedServiceIntervalYears,
          req.user.username
        ]
      });
      console.log('✅ Inserted into service_history');
    } catch (insertErr) {
      console.error('❌ Error inserting into service_history:', insertErr.message);
    }

    // ============================================================
    // 2. UPDATE gse_maintenance
    // ============================================================
    console.log('📝 Updating gse_maintenance...');

    if (isPreventive) {
      if (equipment.maintenance_type === 'hour') {
        const intervalMonths = sanitizedMonthsInterval > 0 ? sanitizedMonthsInterval : sanitizedServiceIntervalMonthsForHour;
        if (intervalMonths > 0 && serviceDate) {
          nextServiceDate = calculateNextServiceDate(serviceDate, intervalMonths);
        }
        
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
            serviceDate,
            sanitizedCurrentHours,
            sanitizedCurrentHours,
            sanitizedTargetHours,
            service_performed || '',
            technician_name || '',
            notes || '',
            nextServiceDate,
            intervalMonths,
            'preventive',
            'serviced',
            parseInt(id)
          ]
        });
      } else if (equipment.maintenance_type === 'month') {
        const intervalMonths = sanitizedMonthsInterval > 0 ? sanitizedMonthsInterval : sanitizedServiceIntervalMonths;
        if (serviceDate && intervalMonths > 0) {
          nextServiceDate = calculateNextServiceDate(serviceDate, intervalMonths);
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
            serviceDate,
            service_performed || '',
            technician_name || '',
            notes || '',
            nextServiceDate,
            intervalMonths,
            'preventive',
            'serviced',
            parseInt(id)
          ]
        });
      } else if (equipment.maintenance_type === 'year') {
        const currentYear = new Date(serviceDate).getFullYear();
        const intervalYears = sanitizedMonthsInterval > 0 ? sanitizedMonthsInterval : sanitizedServiceIntervalYears;
        nextServiceYear = currentYear + parseInt(intervalYears || 1);
        
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
            serviceDate,
            currentYear,
            service_performed || '',
            technician_name || '',
            notes || '',
            nextServiceYear,
            'preventive',
            'serviced',
            parseInt(id)
          ]
        });
      }
    } else {
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
              maintenance_category = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          args: [
            serviceDate,
            sanitizedCurrentHours,
            sanitizedCurrentHours,
            service_performed || '',
            technician_name || '',
            notes || '',
            'corrective',
            'serviced',
            parseInt(id)
          ]
        });
      } else {
        await db.execute({
          sql: `
            UPDATE gse_maintenance SET
              last_service_date = ?,
              service_performed = ?,
              technician_name = ?,
              notes = ?,
              maintenance_category = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          args: [
            serviceDate,
            service_performed || '',
            technician_name || '',
            notes || '',
            'corrective',
            'serviced',
            parseInt(id)
          ]
        });
      }
    }

    console.log('✅ Updated gse_maintenance');

    const categoryText = isPreventive ? 'Preventive' : 'Corrective';
    const scheduleMsg = isPreventive && nextServiceDate ? ` (Next service: ${nextServiceDate})` : '';

    res.json({
      success: true,
      message: `✅ ${categoryText} service recorded successfully!${scheduleMsg}`,
      data: {
        service_date: serviceDate,
        next_service_date: nextServiceDate
      }
    });

  } catch (err) {
    console.error('❌ Error recording service:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({
      error: 'Failed to record service',
      details: err.message
    });
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
// 📊 MAINTENANCE HISTORY - FIXED
// ============================================================
app.get('/api/gse-maintenance/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    
    console.log(`📊 Fetching maintenance history for ID: ${id}`);
    
    const equipmentId = parseInt(id);
    if (isNaN(equipmentId) || equipmentId <= 0) {
      return res.status(400).json({ 
        error: 'Invalid equipment ID',
        equipment: null,
        history: []
      });
    }
    
    const equipmentResult = await db.execute({
      sql: 'SELECT * FROM gse_maintenance WHERE id = ?',
      args: [equipmentId]
    });
    
    let equipment = null;
    if (equipmentResult.rows.length > 0) {
      equipment = equipmentResult.rows[0];
      console.log(`✅ Found equipment: ${equipment.equipment_name || 'Unknown'}`);
    } else {
      console.log(`⚠️ No equipment found for ID: ${equipmentId}`);
      return res.json({
        equipment: null,
        history: []
      });
    }
    
    const equipmentResponse = {
      id: equipment.id,
      name: equipment.equipment_name || 'Unknown',
      type: equipment.equipment_type || 'N/A',
      status: equipment.status || 'serviced',
      last_service_date: equipment.last_service_date || null,
      next_service_date: equipment.next_service_date || null,
      current_hours: equipment.current_hours || 0,
      target_hours: equipment.target_hours || 0,
      maintenance_type: equipment.maintenance_type || 'none',
      maintenance_category: equipment.maintenance_category || equipment.category || 'Not specified'
    };
    
    let history = [];
    try {
      const columnsCheck = await db.execute(`PRAGMA table_info(service_history)`);
      const columnNames = columnsCheck.rows.map(c => c.name);
      console.log('📋 Available columns in service_history:', columnNames.join(', '));
      
      let selectFields = `
        id,
        service_date,
        service_performed,
        technician_name,
        notes,
        maintenance_category as category,
        current_hours as hours_at_service,
        target_hours,
        service_interval_months as interval_months,
        recorded_by,
        created_at
      `;
      
      if (columnNames.includes('next_service_date')) {
        selectFields += ', next_service_date as next_service_due';
      }
      
      const historyResult = await db.execute({
        sql: `
          SELECT ${selectFields}
          FROM service_history
          WHERE maintenance_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `,
        args: [equipmentId, parseInt(limit)]
      });
      history = historyResult.rows || [];
      console.log(`✅ Found ${history.length} history records in service_history`);
    } catch (err) {
      console.log('⚠️ Error fetching history:', err.message);
      history = [];
    }
    
    res.json({
      equipment: equipmentResponse,
      history: history
    });
    
  } catch (err) {
    console.error('❌ Error fetching maintenance history:', err.message);
    res.json({
      equipment: null,
      history: [],
      error: err.message
    });
  }
});

// ============================================================
// SERVICE HISTORY REPORT ENDPOINTS
// ============================================================

app.get('/api/service-history/all', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, equipmentName, technician, category } = req.query;

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

    const result = await db.execute({ sql: query, args: params });

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching service history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

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
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('🔧 Fixing NULL categories in service_history...');

    const checkResult = await db.execute(`
      SELECT COUNT(*) as count FROM service_history
      WHERE maintenance_category IS NULL OR maintenance_category = ''
    `);
    const nullCount = checkResult.rows[0].count;
    console.log(`📊 Found ${nullCount} records with NULL categories`);

    await db.execute(`
      UPDATE service_history
      SET maintenance_category = 'preventive'
      WHERE maintenance_category IS NULL OR maintenance_category = ''
    `);

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
      console.log(`\n🧪 Test Route:`);
      console.log(`   GET /api/test - Check if server is running`);
      console.log(`\n📦 Parts API:`);
      console.log(`   GET /api/parts - Get all parts`);
      console.log(`   GET /api/parts/:id - Get part by ID`);
      console.log(`   POST /api/parts - Add new part`);
      console.log(`   PUT /api/parts/:id - Update part`);
      console.log(`   DELETE /api/parts/:id - Delete part`);
      console.log(`\n💰 Price History API:`);
      console.log(`   GET /api/price-history/:partId - Get price history`);
      console.log(`   POST /api/price-history - Add price record`);
      console.log(`   PUT /api/parts/:partId/price - Update price`);
      console.log(`\n📥 Receive API:`);
      console.log(`   POST /api/receive - Receive part`);
      console.log(`   POST /api/receive-parts - Bulk receive parts`);
      console.log(`   GET /api/receive-history - Get receive history`);
      console.log(`\n📤 Issue API:`);
      console.log(`   POST /api/issue - Issue part`);
      console.log(`\n📋 Approvals API:`);
      console.log(`   GET /api/approvals/pending - Get pending approvals`);
      console.log(`   PUT /api/approvals/:id/approve - Approve request`);
      console.log(`   PUT /api/approvals/:id/reject - Reject request`);
      console.log(`\n📋 Requests API:`);
      console.log(`   GET /api/requests/my-requests - My requests`);
      console.log(`   GET /api/requests/issue - Issue requests`);
      console.log(`\n📊 Dashboard API:`);
      console.log(`   GET /api/reports/low-stock - Low stock report`);
      console.log(`\n🔧 Maintenance API:`);
      console.log(`   GET /api/gse-maintenance - Get all maintenance`);
      console.log(`   GET /api/gse-maintenance/:id/history - Get maintenance history`);
      console.log(`   POST /api/gse-maintenance/:id/service - Record service`);
    });
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
};

startServer();