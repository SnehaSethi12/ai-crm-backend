const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../crm.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    city TEXT,
    age INTEGER,
    gender TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    amount REAL NOT NULL,
    product TEXT NOT NULL,
    category TEXT,
    status TEXT DEFAULT 'completed',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS segments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    conditions TEXT NOT NULL,
    customer_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    segment_id TEXT NOT NULL,
    message TEXT NOT NULL,
    channel TEXT DEFAULT 'email',
    status TEXT DEFAULT 'draft',
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (segment_id) REFERENCES segments(id)
  );

  CREATE TABLE IF NOT EXISTS communications (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    message TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    sent_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
`);

module.exports = db;