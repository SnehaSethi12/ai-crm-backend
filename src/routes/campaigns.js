const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// Helper to build segment query (same as segments route)
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

// Get all campaigns
router.get('/', (req, res) => {
  try {
    const campaigns = db.prepare(`
      SELECT camp.*, s.name as segment_name
      FROM campaigns camp
      LEFT JOIN segments s ON camp.segment_id = s.id
      ORDER BY camp.created_at DESC
    `).all();
    res.json({ success: true, data: campaigns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single campaign
router.get('/:id', (req, res) => {
  try {
    const campaign = db.prepare(`
      SELECT camp.*, s.name as segment_name
      FROM campaigns camp
      LEFT JOIN segments s ON camp.segment_id = s.id
      WHERE camp.id = ?
    `).get(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create campaign
router.post('/', (req, res) => {
  try {
    const { name, segment_id, message, channel } = req.body;
    if (!name || !segment_id || !message) {
      return res.status(400).json({ success: false, error: 'Name, segment and message are required' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO campaigns (id, name, segment_id, message, channel, status)
      VALUES (?, ?, ?, ?, ?, 'draft')
    `).run(id, name, segment_id, message, channel || 'email');

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send campaign
router.post('/:id/send', async (req, res) => {
  try {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
    if (campaign.status === 'sent') return res.status(400).json({ success: false, error: 'Campaign already sent' });

    const segment = db.prepare('SELECT * FROM segments WHERE id = ?').get(campaign.segment_id);
    if (!segment) return res.status(404).json({ success: false, error: 'Segment not found' });

    const conditions = JSON.parse(segment.conditions);
    const { query, params } = buildSegmentQuery(conditions);
    const customers = db.prepare(query).all(...params);

    if (customers.length === 0) {
      return res.status(400).json({ success: false, error: 'No customers in this segment' });
    }

    // Create communication records
    const insertComm = db.prepare(`
      INSERT INTO communications (id, campaign_id, customer_id, message, channel, status)
      VALUES (?, ?, ?, ?, ?, 'sent')
    `);

    const commIds = [];
    const insertAll = db.transaction(() => {
      for (const customer of customers) {
        const commId = uuidv4();
        const personalizedMessage = campaign.message
          .replace('{name}', customer.name)
          .replace('{city}', customer.city || '')
          .replace('{total_spent}', customer.total_spent || 0);
        insertComm.run(commId, campaign.id, customer.id, personalizedMessage, campaign.channel);
        commIds.push({ commId, customer, message: personalizedMessage });
      }
    });
    insertAll();

    // Update campaign status
    db.prepare(`
      UPDATE campaigns SET status = 'sent', sent_count = ? WHERE id = ?
    `).run(customers.length, campaign.id);

    // Send to channel service asynchronously
    const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:4000';
    
    // Fire and forget - don't await
    (async () => {
      for (const { commId, customer, message } of commIds) {
        try {
          await fetch(`${CHANNEL_SERVICE_URL}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              comm_id: commId,
              recipient: customer.email || customer.phone,
              message: message,
              channel: campaign.channel,
              callback_url: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/communications/receipt`
            })
          });
        } catch (e) {
          console.error('Failed to send to channel service:', e.message);
        }
      }
    })();

    res.json({ 
      success: true, 
      message: `Campaign sent to ${customers.length} customers`,
      data: { sent_count: customers.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete campaign
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM communications WHERE campaign_id = ?').run(req.params.id);
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;