const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Simulate message delivery outcomes
function getRandomStatus() {
  const rand = Math.random();
  if (rand < 0.70) return 'delivered';
  if (rand < 0.85) return 'opened';
  if (rand < 0.92) return 'clicked';
  if (rand < 0.97) return 'read';
  return 'failed';
}

function getDelay() {
  const base = parseInt(process.env.CALLBACK_DELAY_MS) || 3000;
  return base + Math.floor(Math.random() * 3000);
}

// Send endpoint - receives message from CRM
app.post('/send', async (req, res) => {
  const { comm_id, recipient, message, channel, callback_url } = req.body;

  if (!comm_id || !recipient || !callback_url) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  console.log(`📨 Received message for ${recipient} via ${channel}`);
  console.log(`   Message: ${message?.substring(0, 50)}...`);

  // Immediately respond to CRM
  res.json({ success: true, message: 'Message queued for delivery' });

  // Simulate delivery lifecycle asynchronously
  const simulateLifecycle = async () => {
    const statuses = ['delivered'];
    const rand = Math.random();

    // Randomly add more statuses to simulate engagement
    if (rand > 0.3) statuses.push('opened');
    if (rand > 0.6) statuses.push('clicked');
    if (rand < 0.08) {
      // 8% failure rate - replace all with failed
      statuses.length = 0;
      statuses.push('failed');
    }

    for (const status of statuses) {
      await new Promise(resolve => setTimeout(resolve, getDelay()));

      try {
        const response = await fetch(callback_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comm_id, status })
        });

        if (response.ok) {
          console.log(`✅ Callback sent: ${comm_id} → ${status}`);
        } else {
          console.log(`❌ Callback failed: ${comm_id} → ${status}`);
        }
      } catch (err) {
        console.error(`❌ Callback error for ${comm_id}:`, err.message);
      }
    }
  };

  simulateLifecycle();
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Channel Service is running!',
    version: '1.0.0'
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Channel service running on http://localhost:${PORT}`);
});

module.exports = app;