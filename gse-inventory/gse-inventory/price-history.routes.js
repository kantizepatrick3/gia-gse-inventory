// price-history.routes.js - Complete price history routes
const authenticateToken = require('./middleware/auth');

module.exports = function(app, db) {
  
  // ============================================================
  // GET - Fetch price history for a specific part
  // ============================================================
  app.get('/api/price-history/:partId', authenticateToken, async (req, res) => {
    try {
      const { partId } = req.params;
      console.log(`💰 Fetching price history for part: ${partId}`);
      
      // Check if table exists first
      try {
        const tableCheck = await db.execute({
          sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='price_history'",
          args: []
        });
        
        if (tableCheck.rows.length === 0) {
          console.log('⚠️ price_history table does not exist yet');
          return res.json([]);
        }
      } catch (e) {
        console.log('⚠️ Could not check table existence:', e.message);
      }
      
      const result = await db.execute({
        sql: `
          SELECT 
            ph.*,
            p.part_number,
            p.description
          FROM price_history ph
          LEFT JOIN parts p ON p.id = ph.part_id
          WHERE ph.part_id = ?
          ORDER BY ph.created_at DESC
          LIMIT 50
        `,
        args: [partId]
      });
      
      console.log(`✅ Found ${result.rows.length} price history records`);
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching price history:', err.message);
      // Return empty array instead of error to prevent UI issues
      res.json([]);
    }
  });

  // ============================================================
  // POST - Add price history record
  // ============================================================
  app.post('/api/price-history', authenticateToken, async (req, res) => {
    const { part_id, price, quantity, transaction_type, reference_number, notes } = req.body;

    console.log(`💰 Price update request for part: ${part_id}, price: ${price}`);

    // Validate required fields
    if (!part_id) {
      return res.status(400).json({ error: 'Part ID is required' });
    }
    
    if (price === undefined || price === null || price === '') {
      return res.status(400).json({ error: 'Price is required' });
    }

    const sanitizedPrice = parseFloat(price);
    if (isNaN(sanitizedPrice) || sanitizedPrice < 0) {
      return res.status(400).json({ error: 'Invalid price value' });
    }

    try {
      // Validate part exists
      const partResult = await db.execute({
        sql: 'SELECT id, part_number, current_price FROM parts WHERE id = ?',
        args: [part_id]
      });

      if (partResult.rows.length === 0) {
        return res.status(404).json({ error: 'Part not found' });
      }

      const part = partResult.rows[0];
      const oldPrice = part.current_price || 0;

      console.log(`💰 Updating price for ${part.part_number}: ${oldPrice} → ${sanitizedPrice}`);

      // Check if price_history table exists, if not create it
      try {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            part_id INTEGER NOT NULL,
            price REAL NOT NULL,
            quantity INTEGER DEFAULT 1,
            transaction_type TEXT NOT NULL DEFAULT 'MANUAL',
            reference_number TEXT,
            notes TEXT,
            recorded_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
          )
        `);
      } catch (e) {
        console.log('⚠️ Could not create price_history table:', e.message);
      }

      // Insert price history
      await db.execute({
        sql: `
          INSERT INTO price_history (
            part_id, price, quantity, transaction_type, 
            reference_number, notes, recorded_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        args: [
          part_id, 
          sanitizedPrice, 
          parseInt(quantity) || 1, 
          transaction_type || 'MANUAL', 
          reference_number || '', 
          notes || `Price updated from ${oldPrice} to ${sanitizedPrice}`, 
          req.user?.username || 'system'
        ]
      });

      // Update part's current price
      await db.execute({
        sql: `
          UPDATE parts 
          SET current_price = ?, unit_price = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [sanitizedPrice, sanitizedPrice, part_id]
      });

      console.log(`✅ Price updated successfully for ${part.part_number}`);
      
      res.json({
        success: true,
        message: `Price updated from ${oldPrice} to ${sanitizedPrice}`,
        data: {
          part_number: part.part_number,
          old_price: oldPrice,
          new_price: sanitizedPrice
        }
      });
    } catch (err) {
      console.error('Error adding price history:', err.message);
      res.status(500).json({ 
        error: 'Failed to update price: ' + err.message 
      });
    }
  });

  // ============================================================
  // GET - Get latest price for a part
  // ============================================================
  app.get('/api/price-history/latest/:partId', authenticateToken, async (req, res) => {
    try {
      const { partId } = req.params;
      
      const result = await db.execute({
        sql: `
          SELECT price, created_at FROM price_history 
          WHERE part_id = ? 
          ORDER BY created_at DESC 
          LIMIT 1
        `,
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

  // ============================================================
  // GET - Get full price history (no limit)
  // ============================================================
  app.get('/api/price-history/full/:partId', authenticateToken, async (req, res) => {
    try {
      const { partId } = req.params;
      
      const result = await db.execute({
        sql: `
          SELECT * FROM price_history 
          WHERE part_id = ? 
          ORDER BY created_at DESC
        `,
        args: [partId]
      });
      
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching full price history:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  console.log('✅ Price History routes loaded successfully');
};