const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const customersRouter = require('./src/routes/customers');
const segmentsRouter = require('./src/routes/segments');
const campaignsRouter = require('./src/routes/campaigns');
const communicationsRouter = require('./src/routes/communications');
const aiRouter = require('./src/routes/ai');

// Use routes
app.use('/api/customers', customersRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/communications', communicationsRouter);
app.use('/api/ai', aiRouter);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Xeno CRM Backend is running!',
    version: '1.0.0'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on http://localhost:${PORT}`);
});

module.exports = app;