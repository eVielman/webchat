require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configure web-push
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Database connection
const db = new sqlite3.Database(process.env.DB_PATH || './database.sqlite');

// Utility functions
const getSubscriptions = (callback) => {
  db.all('SELECT * FROM subscriptions ORDER BY created_at DESC', callback);
};

const getSubscriptionById = (id, callback) => {
  db.get('SELECT * FROM subscriptions WHERE id = ?', [id], callback);
};

const getSubscriptionsByGroup = (group, callback) => {
  db.all('SELECT * FROM subscriptions WHERE groups LIKE ?', [`%"${group}"%`], callback);
};

// API Routes

// Get VAPID public key
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Subscribe endpoint
app.post('/api/subscribe', (req, res) => {
  const { endpoint, keys, userAgent, groups = [] } = req.body;
  
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'Invalid subscription data' });
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO subscriptions (endpoint, p256dh, auth, user_agent, groups, last_active)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run([endpoint, keys.p256dh, keys.auth, userAgent, JSON.stringify(groups)], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }
    
    res.json({ 
      success: true, 
      subscriptionId: this.lastID,
      message: 'Subscription saved successfully' 
    });
  });

  stmt.finalize();
});

// Unsubscribe endpoint
app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  
  db.run('DELETE FROM subscriptions WHERE endpoint = ?', [endpoint], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to unsubscribe' });
    }
    
    res.json({ 
      success: true, 
      message: 'Unsubscribed successfully' 
    });
  });
});

// Get all subscriptions (admin)
app.get('/api/subscriptions', (req, res) => {
  getSubscriptions((err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
    
    const subscriptions = rows.map(row => ({
      ...row,
      groups: JSON.parse(row.groups)
    }));
    
    res.json(subscriptions);
  });
});

// Send notification
app.post('/api/send-notification', async (req, res) => {
  const { title, body, icon, badge, data = {}, targetType, targetValue } = req.body;
  
  if (!title || !body || !targetType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Save message to database
    const messageId = await new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO messages (title, body, icon, badge, data, target_type, target_value, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([title, body, icon, badge, JSON.stringify(data), targetType, targetValue], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
      
      stmt.finalize();
    });

    // Get target subscriptions
    let subscriptions = [];
    
    if (targetType === 'all') {
      subscriptions = await new Promise((resolve, reject) => {
        getSubscriptions((err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    } else if (targetType === 'individual') {
      const subscription = await new Promise((resolve, reject) => {
        getSubscriptionById(targetValue, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      if (subscription) subscriptions = [subscription];
    } else if (targetType === 'group') {
      subscriptions = await new Promise((resolve, reject) => {
        getSubscriptionsByGroup(targetValue, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }

    // Send notifications
    const payload = JSON.stringify({
      title,
      body,
      icon,
      badge,
      data: { ...data, messageId }
    });

    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        }, payload);

        // Log successful delivery
        db.run(
          'INSERT INTO message_recipients (message_id, subscription_id) VALUES (?, ?)',
          [messageId, subscription.id]
        );
        
        return { success: true, subscriptionId: subscription.id };
      } catch (error) {
        console.error('Failed to send notification:', error);
        
        // Remove invalid subscription
        if (error.statusCode === 410) {
          db.run('DELETE FROM subscriptions WHERE id = ?', [subscription.id]);
        }
        
        return { success: false, subscriptionId: subscription.id, error: error.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      messageId,
      sent: successful,
      failed,
      results
    });
    
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Submit reply
app.post('/api/reply', (req, res) => {
  const { messageId, replyText, subscriptionEndpoint } = req.body;
  
  if (!messageId || !replyText || !subscriptionEndpoint) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Find subscription by endpoint
  db.get('SELECT id FROM subscriptions WHERE endpoint = ?', [subscriptionEndpoint], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const stmt = db.prepare(`
      INSERT INTO replies (original_message_id, subscription_id, reply_text)
      VALUES (?, ?, ?)
    `);

    stmt.run([messageId, row.id, replyText], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to save reply' });
      }
      
      res.json({ 
        success: true, 
        replyId: this.lastID,
        message: 'Reply saved successfully' 
      });
    });

    stmt.finalize();
  });
});

// Get replies (admin)
app.get('/api/replies', (req, res) => {
  const query = `
    SELECT r.*, m.title as original_title, m.body as original_body,
           s.user_agent, s.created_at as subscription_created
    FROM replies r
    JOIN messages m ON r.original_message_id = m.id
    JOIN subscriptions s ON r.subscription_id = s.id
    ORDER BY r.created_at DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch replies' });
    }
    
    res.json(rows);
  });
});

// Get messages history
app.get('/api/messages', (req, res) => {
  const query = `
    SELECT m.*, 
           COUNT(mr.id) as recipients_count,
           COUNT(CASE WHEN mr.read_at IS NOT NULL THEN 1 END) as read_count
    FROM messages m
    LEFT JOIN message_recipients mr ON m.id = mr.message_id
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
    
    const messages = rows.map(row => ({
      ...row,
      data: JSON.parse(row.data || '{}')
    }));
    
    res.json(messages);
  });
});

// Get groups
app.get('/api/groups', (req, res) => {
  db.all('SELECT groups FROM subscriptions', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch groups' });
    }
    
    const allGroups = new Set();
    rows.forEach(row => {
      try {
        const groups = JSON.parse(row.groups);
        groups.forEach(group => allGroups.add(group));
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    res.json(Array.from(allGroups).sort());
  });
});

// Static file routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/client', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'client.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Web Notification Service running on http://localhost:${PORT}`);
  console.log(`📱 Admin interface: http://localhost:${PORT}/admin`);
  console.log(`👤 Client interface: http://localhost:${PORT}/client`);
});