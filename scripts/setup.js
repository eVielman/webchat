const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

console.log('🚀 Setting up Web Notification Service...\n');

// Generate VAPID keys
console.log('📝 Generating VAPID keys...');
const vapidKeys = webpush.generateVAPIDKeys();

console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);

// Create .env file
const envContent = `# Web Push VAPID Keys
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_SUBJECT=mailto:admin@example.com

# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DB_PATH=./database.sqlite
`;

fs.writeFileSync('.env', envContent);
console.log('✅ Created .env file with VAPID keys\n');

// Initialize database
console.log('🗄️  Initializing database...');
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
  // Subscriptions table
  db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    groups TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Messages table
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    icon TEXT,
    badge TEXT,
    data TEXT DEFAULT '{}',
    target_type TEXT NOT NULL, -- 'all', 'individual', 'group'
    target_value TEXT, -- subscription_id or group_name
    sender_type TEXT DEFAULT 'admin', -- 'admin' or 'client'
    sender_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME
  )`);

  // Message recipients table
  db.run(`CREATE TABLE IF NOT EXISTS message_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    subscription_id INTEGER NOT NULL,
    delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    FOREIGN KEY (message_id) REFERENCES messages (id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions (id)
  )`);

  // Replies table
  db.run(`CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_message_id INTEGER NOT NULL,
    subscription_id INTEGER NOT NULL,
    reply_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (original_message_id) REFERENCES messages (id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions (id)
  )`);
});

db.close((err) => {
  if (err) {
    console.error('❌ Error creating database:', err);
  } else {
    console.log('✅ Database initialized successfully\n');
    console.log('🎉 Setup complete! You can now run:');
    console.log('   npm install');
    console.log('   npm start');
    console.log('\n📱 Access the application at:');
    console.log('   Admin: http://localhost:3000/admin');
    console.log('   Client: http://localhost:3000/client');
  }
});