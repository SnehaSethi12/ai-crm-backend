const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// Get all customers
router.get('/', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT c.*, 
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.amount), 0) as total_spent,
        MAX(o.created_at) as last_order_date
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all();
    res.json({ success: true, data: customers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single customer with orders
router.get('/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json({ success: true, data: { ...customer, orders } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Seed fake data
router.post('/seed', (req, res) => {
  try {
    const existing = db.prepare('SELECT COUNT(*) as count FROM customers').get();
    if (existing.count > 0) {
      return res.json({ success: true, message: 'Data already seeded' });
    }

    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Jaipur'];
    const genders = ['Male', 'Female'];
    const products = [
      { name: 'Silk Saree', category: 'Ethnic Wear', price: 4500 },
      { name: 'Leather Handbag', category: 'Accessories', price: 3200 },
      { name: 'Gold Earrings', category: 'Jewellery', price: 2800 },
      { name: 'Embroidered Kurti', category: 'Ethnic Wear', price: 1500 },
      { name: 'Designer Watch', category: 'Accessories', price: 8000 },
      { name: 'Casual Dress', category: 'Western Wear', price: 2200 },
      { name: 'Denim Jacket', category: 'Western Wear', price: 3500 },
      { name: 'Pearl Necklace', category: 'Jewellery', price: 5500 },
      { name: 'Printed Scarf', category: 'Accessories', price: 800 },
      { name: 'Palazzo Set', category: 'Ethnic Wear', price: 1800 },
    ];

    const firstNames = ['Priya', 'Aarav', 'Sneha', 'Rohan', 'Ananya', 'Vikram', 'Kavya', 'Arjun', 'Meera', 'Rahul',
      'Pooja', 'Siddharth', 'Divya', 'Karan', 'Nisha', 'Aditya', 'Shreya', 'Amit', 'Riya', 'Varun',
      'Sunita', 'Deepak', 'Anjali', 'Rajesh', 'Simran', 'Nikhil', 'Tanya', 'Vivek', 'Neha', 'Harsh'];
    const lastNames = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Shah', 'Mehta', 'Joshi', 'Rao', 'Nair'];

    const insertCustomer = db.prepare(`
      INSERT INTO customers (id, name, email, phone, city, age, gender) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, customer_id, amount, product, category, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction(() => {
      for (let i = 0; i < 50; i++) {
        const customerId = uuidv4();
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const name = `${firstName} ${lastName}`;
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@gmail.com`;
        const phone = `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`;
        const city = cities[Math.floor(Math.random() * cities.length)];
        const age = Math.floor(18 + Math.random() * 42);
        const gender = genders[Math.floor(Math.random() * genders.length)];

        insertCustomer.run(customerId, name, email, phone, city, age, gender);

        // Each customer gets 1-5 orders
        const orderCount = Math.floor(1 + Math.random() * 5);
        for (let j = 0; j < orderCount; j++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const daysAgo = Math.floor(Math.random() * 180);
          const orderDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
          insertOrder.run(uuidv4(), customerId, product.price, product.name, product.category, orderDate);
        }
      }
    });

    insertMany();
    const count = db.prepare('SELECT COUNT(*) as count FROM customers').get();
    res.json({ success: true, message: `Seeded ${count.count} customers with orders` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;