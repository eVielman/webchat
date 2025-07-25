# Web Notification Service

A complete web push notification system with admin controls and client subscriptions. Send targeted notifications, manage recipients, and enable two-way communication.

## Features

- 📱 **Web Push Notifications** - Send notifications to web browsers
- 🎯 **Targeted Messaging** - Send to individuals, groups, or all subscribers
- 💬 **Two-way Communication** - Clients can reply to notifications
- 🛠️ **Admin Panel** - Comprehensive management interface
- 📊 **Analytics** - Track message delivery and engagement
- 👥 **Group Management** - Organize subscribers into groups
- 🔧 **Service Worker** - Handles background notifications
- 💾 **SQLite Database** - Stores subscriptions, messages, and replies
- 🎨 **Modern UI** - Beautiful, responsive interface

## Quick Start

### 1. Installation

```bash
# Clone or download the project
cd web-notification-service

# Install dependencies
npm install

# Setup VAPID keys and database
npm run setup
```

### 2. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Or production mode
npm start
```

### 3. Access the Application

- **Home Page**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **Client Demo**: http://localhost:3000/client

## Project Structure

```
web-notification-service/
├── server.js                 # Main Express server
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables (auto-generated)
├── database.sqlite           # SQLite database (auto-generated)
├── scripts/
│   └── setup.js              # Setup script for VAPID keys and DB
└── public/
    ├── index.html            # Landing page
    ├── admin.html            # Admin interface
    ├── client.html           # Client demo
    └── service-worker.js     # Service worker for notifications
```

## Usage Guide

### Admin Panel Features

1. **Send Notifications**
   - Create rich notifications with title, message, and icon
   - Target all subscribers, specific individuals, or groups
   - Real-time delivery status

2. **Manage Subscriptions**
   - View all active subscriptions
   - See user agents, groups, and activity timestamps
   - Automatic cleanup of invalid subscriptions

3. **Message History**
   - Track all sent messages
   - View delivery statistics
   - See target audience for each message

4. **Client Replies**
   - View all replies from clients
   - See original message context
   - Track engagement metrics

### Client Features

1. **Subscribe to Notifications**
   - Request notification permission
   - Join specific groups
   - View subscription status

2. **Receive Notifications**
   - Real-time push notifications
   - Action buttons (View, Reply, Dismiss)
   - Notification history

3. **Reply to Messages**
   - Send replies directly from notifications
   - Reply from notification history
   - Offline reply support

### API Endpoints

#### Public Endpoints
- `GET /api/vapid-public-key` - Get VAPID public key
- `POST /api/subscribe` - Subscribe to notifications
- `POST /api/unsubscribe` - Unsubscribe from notifications
- `POST /api/reply` - Send reply to message

#### Admin Endpoints
- `GET /api/subscriptions` - Get all subscriptions
- `GET /api/messages` - Get message history
- `GET /api/replies` - Get all replies
- `GET /api/groups` - Get available groups
- `POST /api/send-notification` - Send notification

## Configuration

### Environment Variables

The setup script automatically generates a `.env` file with:

```bash
# Web Push VAPID Keys
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:admin@example.com

# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DB_PATH=./database.sqlite
```

### Database Schema

The system uses SQLite with the following tables:

- **subscriptions** - Store push subscription data
- **messages** - Track all sent messages
- **message_recipients** - Link messages to recipients
- **replies** - Store client replies

## Browser Support

### Requirements
- Service Workers support
- Push API support
- Notification API support

### Supported Browsers
- ✅ Chrome 50+
- ✅ Firefox 44+
- ✅ Safari 16+
- ✅ Edge 17+
- ❌ Internet Explorer (not supported)

## Development

### Running in Development

```bash
# Install dependencies
npm install

# Run setup (first time only)
npm run setup

# Start development server
npm run dev
```

### Project Dependencies

- **express** - Web server framework
- **web-push** - Web push notification library
- **sqlite3** - SQLite database driver
- **cors** - Cross-origin resource sharing
- **body-parser** - Request body parsing
- **uuid** - Unique identifier generation
- **dotenv** - Environment variables

## Deployment

### Production Setup

1. **Install dependencies**:
   ```bash
   npm install --production
   ```

2. **Configure environment**:
   ```bash
   npm run setup
   # Edit .env file with production values
   ```

3. **Start server**:
   ```bash
   npm start
   ```

### Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run setup
EXPOSE 3000
CMD ["npm", "start"]
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Testing

### Manual Testing

1. **Start the server** and open multiple browser tabs
2. **Subscribe to notifications** in the client demo
3. **Send notifications** from the admin panel
4. **Test replies** by clicking notification action buttons
5. **Check different targeting** options (all, individual, group)

### Browser Testing

Test in different browsers to ensure compatibility:
- Desktop: Chrome, Firefox, Safari, Edge
- Mobile: Chrome Mobile, Safari Mobile

## Troubleshooting

### Common Issues

1. **Notifications not appearing**
   - Check browser permissions
   - Verify VAPID keys are correctly set
   - Check console for errors

2. **Service Worker not registering**
   - Ensure HTTPS (or localhost)
   - Check service worker file path
   - Clear browser cache

3. **Database errors**
   - Ensure write permissions in project directory
   - Check SQLite installation
   - Run setup script again

4. **VAPID key errors**
   - Re-run `npm run setup`
   - Check `.env` file exists and has valid keys
   - Verify email format in VAPID_SUBJECT

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Review browser console for errors
- Ensure all dependencies are installed
- Verify environment configuration