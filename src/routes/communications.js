const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Get all communications for a campaign
router.get('/campaign/:campaignId', (req, res) => {
  try {
    const communications = db.prepare(`
      SELECT comm.*, c.name as customer_name, c.email as customer_email
      FROM communications comm
      LEFT JOIN customers c ON comm.customer_id = c.id
      WHERE comm.campaign_id = ?
      ORDER BY comm.sent_at DESC
    `).all(req.params.campaignId);
    res.json({ success: true, data: communications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Receipt callback from channel service
router.post('/receipt', (req, res) => {
  try {
    const { comm_id, status } = req.body;
    if (!comm_id || !status) {
      return res.status(400).json({ success: false, error: 'comm_id and status are required' });
    }

    const validStatuses = ['delivered', 'failed', 'opened', 'clicked', 'read'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Update communication status
    db.prepare(`
      UPDATE communications 
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, comm_id);

    // Get the communication to find campaign
    const comm = db.prepare('SELECT * FROM communications WHERE id = ?').get(comm_id);
    if (!comm) {
      return res.status(404).json({ success: false, error: 'Communication not found' });
    }

    // Update campaign counts
    const countField = `${status}_count`;
    const validFields = ['delivered_count', 'failed_count', 'opened_count', 'clicked_count'];
    
    if (validFields.includes(countField)) {
      db.prepare(`
        UPDATE campaigns 
        SET ${countField} = ${countField} + 1
        WHERE id = ?
      `).run(comm.campaign_id);
    }

    res.json({ success: true, message: `Communication ${comm_id} updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get campaign analytics
router.get('/analytics/:campaignId', (req, res) => {
  try {
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.campaignId);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });

    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM communications
      WHERE campaign_id = ?
      GROUP BY status
    `).all(req.params.campaignId);

    const analytics = {
      total_sent: campaign.sent_count || 0,
      delivered: campaign.delivered_count || 0,
      opened: campaign.opened_count || 0,
      clicked: campaign.clicked_count || 0,
      failed: campaign.failed_count || 0,
      delivery_rate: campaign.sent_count > 0 
        ? ((campaign.delivered_count / campaign.sent_count) * 100).toFixed(1) 
        : 0,
      open_rate: campaign.delivered_count > 0 
        ? ((campaign.opened_count / campaign.delivered_count) * 100).toFixed(1) 
        : 0,
      click_rate: campaign.opened_count > 0 
        ? ((campaign.clicked_count / campaign.opened_count) * 100).toFixed(1) 
        : 0,
      status_breakdown: statusCounts
    };

    res.json({ success: true, data: analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get overall dashboard stats
router.get('/dashboard/stats', (req, res) => {
  try {
    const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get();
    const totalCampaigns = db.prepare('SELECT COUNT(*) as count FROM campaigns').get();
    const totalSegments = db.prepare('SELECT COUNT(*) as count FROM segments').get();
    const totalRevenue = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM orders').get();
    const recentCampaigns = db.prepare(`
      SELECT camp.*, s.name as segment_name
      FROM campaigns camp
      LEFT JOIN segments s ON camp.segment_id = s.id
      ORDER BY camp.created_at DESC
      LIMIT 5
    `).all();

    res.json({
      success: true,
      data: {
        total_customers: totalCustomers.count,
        total_campaigns: totalCampaigns.count,
        total_segments: totalSegments.count,
        total_revenue: totalRevenue.total,
        recent_campaigns: recentCampaigns
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;