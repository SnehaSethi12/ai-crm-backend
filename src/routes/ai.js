const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function ask(prompt) {
  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000
  });
  return res.choices[0].message.content.trim();
}

router.post('/segment', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt is required' });

    const text = await ask(`You are a CRM assistant. Convert this natural language description into segment conditions JSON.

Available condition fields:
- min_spent: minimum total amount spent (number)
- max_spent: maximum total amount spent (number)
- min_orders: minimum number of orders (number)
- max_orders: maximum number of orders (number)
- inactive_days: customers who haven't ordered in this many days (number)
- active_days: customers who ordered within this many days (number)
- city: one of: Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Pune, Kolkata, Jaipur (string)
- gender: Male or Female (string)
- min_age: minimum age (number)
- max_age: maximum age (number)

User request: "${prompt}"

Respond with ONLY a valid JSON object. No explanation, no markdown, no code blocks. Example: {"min_spent": 5000, "inactive_days": 30}`);

    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const conditions = JSON.parse(clean);
    res.json({ success: true, data: conditions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/message', async (req, res) => {
  try {
    const { segment_description, campaign_goal, channel, brand_name } = req.body;
    if (!segment_description || !campaign_goal) {
      return res.status(400).json({ success: false, error: 'Segment description and campaign goal are required' });
    }

    const message = await ask(`You are a marketing copywriter for ${brand_name || 'a fashion brand'}.
Write a personalized ${channel || 'email'} message for:
- Target audience: ${segment_description}
- Campaign goal: ${campaign_goal}
Rules: under 150 words, warm and personal, use {name} for customer name, {city} for city, clear call to action, feel exclusive.
Respond with ONLY the message text.`);

    res.json({ success: true, data: { message } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/insights', async (req, res) => {
  try {
    const { campaign_name, analytics } = req.body;
    if (!analytics) return res.status(400).json({ success: false, error: 'Analytics data is required' });

    const insights = await ask(`You are a marketing analyst. Analyze this campaign and give 3 bullet point insights.
Campaign: ${campaign_name}
Sent: ${analytics.total_sent}, Delivered: ${analytics.delivered} (${analytics.delivery_rate}%), Opened: ${analytics.opened} (${analytics.open_rate}%), Clicked: ${analytics.clicked} (${analytics.click_rate}%), Failed: ${analytics.failed}
Give exactly 3 bullet points, each under 30 words, specific and actionable.`);

    res.json({ success: true, data: { insights } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    const reply = await ask(`You are an AI assistant for a fashion brand CRM called Xeno CRM.
Current stats: ${context || 'No context provided'}
User: ${message}
Be helpful, concise, friendly. Under 100 words.`);

    res.json({ success: true, data: { reply } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;