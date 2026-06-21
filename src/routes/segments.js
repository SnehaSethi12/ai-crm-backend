const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// Helper function to build SQL query from conditions
function buildSegmentQuery(conditions) {
  let query = `
    SELECT c.*, 
      COUNT(o.id) as order_count,
      COALESCE(SUM(o.amount), 0) as total_spent,
      MAX(o.created_at) as last_order_date
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id
    GROUP BY c.id
    HAVING 1=1
  `;

  const params = [];

  if (conditions.min_spent) {
    query += ` AND COALESCE(SUM(o.amount), 0) >= ?`;
    params.push(Number(conditions.min_spent));
  }
  if (conditions.max_spent) {
    query += ` AND COALESCE(SUM(o.amount), 0) <= ?`;
    params.push(Number(conditions.max_spent));
  }
  if (conditions.min_orders) {
    query += ` AND COUNT(o.id) >= ?`;
    params.push(Number(conditions.min_orders));
  }
  if (conditions.max_orders) {
    query += ` AND COUNT(o.id) <= ?`;
    params.push(Number(conditions.max_orders));
  }
  if (conditions.inactive_days) {
    const cutoff = new Date(Date.now() - conditions.inactive_days * 24 * 60 * 60 * 1000).toISOString();
    query += ` AND (MAX(o.created_at) < ? OR MAX(o.created_at) IS NULL)`;
    params.push(cutoff);
  }
  if (conditions.active_days) {
    const cutoff = new Date(Date.now() - conditions.active_days * 24 * 60 * 60 * 1000).toISOString();
    query += ` AND MAX(o.created_at) >= ?`;
    params.push(cutoff);
  }
  if (conditions.city) {
    query += ` AND c.city = ?`;
    params.push(conditions.city);
  }
  if (conditions.gender) {
    query += ` AND c.gender = ?`;
    params.push(conditions.gender);
  }
  if (conditions.min_age) {
    query += ` AND c.age >= ?`;
    params.push(Number(conditions.min_age));
  }
  if (conditions.max_age) {
    query += ` AND c.age <= ?`;
    params.push(Number(conditions.max_age));
  }

  return { query, params };
}

// Get all segments
router.get('/', (req, res) => {
  try {
    const segments = db.prepare('SELECT * FROM segments ORDER BY created_at DESC').all();
    res.json({ success: true, data: segments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Preview segment - show matching customers without saving
router.post('/preview', (req, res) => {
  try {
    const { conditions } = req.body;
    const { query, params } = buildSegmentQuery(conditions);
    const customers = db.prepare(query).all(...params);
    res.json({ success: true, data: customers, count: customers.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create segment
router.post('/', (req, res) => {
  try {
    const { name, description, conditions } = req.body;
    if (!name || !conditions) {
      return res.status(400).json({ success: false, error: 'Name and conditions are required' });
    }

    const { query, params } = buildSegmentQuery(conditions);
    const customers = db.prepare(query).all(...params);

    const id = uuidv4();
    db.prepare(`
      INSERT INTO segments (id, name, description, conditions, customer_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description || '', JSON.stringify(conditions), customers.length);

    const segment = db.prepare('SELECT * FROM segments WHERE id = ?').get(id);
    res.json({ success: true, data: segment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get customers in a segment
router.get('/:id/customers', (req, res) => {
  try {
    const segment = db.prepare('SELECT * FROM segments WHERE id = ?').get(req.params.id);
    if (!segment) return res.status(404).json({ success: false, error: 'Segment not found' });

    const conditions = JSON.parse(segment.conditions);
    const { query, params } = buildSegmentQuery(conditions);
    const customers = db.prepare(query).all(...params);
    res.json({ success: true, data: customers, count: customers.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete segment
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM segments WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Segment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;