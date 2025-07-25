// Service Worker for Web Push Notifications

const CACHE_NAME = 'notification-service-v1';
const urlsToCache = [
  '/',
  '/admin',
  '/client',
  '/service-worker.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service Worker installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Cache install failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Push event - handle incoming notifications
self.addEventListener('push', event => {
  console.log('Push message received:', event);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('Error parsing push data:', error);
    data = {
      title: 'New Notification',
      body: 'You have received a new message',
      icon: '/icon-192.png'
    };
  }
  
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge.png',
    tag: data.tag || 'notification',
    data: data.data || {},
    requireInteraction: false,
    silent: false,
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icon-view.png'
      },
      {
        action: 'reply',
        title: 'Reply',
        icon: '/icon-reply.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icon-dismiss.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'New Notification', options)
      .then(() => {
        console.log('Notification displayed successfully');
        
        // Send message to client about received notification
        return self.clients.matchAll();
      })
      .then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'notification-received',
            notification: {
              title: data.title,
              body: data.body,
              timestamp: new Date().toISOString(),
              messageId: data.data?.messageId
            }
          });
        });
      })
      .catch(error => {
        console.error('Error showing notification:', error);
      })
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data;
  
  if (action === 'reply') {
    // Handle reply action
    event.waitUntil(
      handleReplyAction(notificationData)
    );
  } else if (action === 'view' || !action) {
    // Handle view action or default click
    event.waitUntil(
      handleViewAction(notificationData)
    );
  } else if (action === 'dismiss') {
    // Handle dismiss action
    console.log('Notification dismissed');
  }
});

// Handle reply action
async function handleReplyAction(data) {
  try {
    // Try to focus existing client window first
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    let clientWindow = null;
    
    // Look for an existing client window
    for (const client of clients) {
      if (client.url.includes('/client')) {
        clientWindow = client;
        break;
      }
    }
    
    if (clientWindow) {
      // Focus existing window and send reply message
      clientWindow.focus();
      clientWindow.postMessage({
        type: 'show-reply-dialog',
        messageId: data.messageId,
        originalTitle: data.title
      });
    } else {
      // Open new window to client page
      clientWindow = await self.clients.openWindow('/client');
      if (clientWindow) {
        // Wait a bit for the page to load, then send message
        setTimeout(() => {
          clientWindow.postMessage({
            type: 'show-reply-dialog',
            messageId: data.messageId,
            originalTitle: data.title
          });
        }, 1000);
      }
    }
  } catch (error) {
    console.error('Error handling reply action:', error);
  }
}

// Handle view action
async function handleViewAction(data) {
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    let clientWindow = null;
    
    // Look for an existing window
    for (const client of clients) {
      if (client.url.includes(self.location.origin)) {
        clientWindow = client;
        break;
      }
    }
    
    if (clientWindow) {
      // Focus existing window
      clientWindow.focus();
    } else {
      // Open new window
      clientWindow = await self.clients.openWindow('/client');
    }
    
    if (clientWindow && data.messageId) {
      // Send message to highlight the notification
      clientWindow.postMessage({
        type: 'highlight-notification',
        messageId: data.messageId
      });
    }
  } catch (error) {
    console.error('Error handling view action:', error);
  }
}

// Notification close event
self.addEventListener('notificationclose', event => {
  console.log('Notification closed:', event);
  
  // Track notification close analytics here if needed
  const notificationData = event.notification.data;
  
  // Send message to client about notification close
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'notification-closed',
        data: notificationData
      });
    });
  });
});

// Background sync event (for offline functionality)
self.addEventListener('sync', event => {
  console.log('Background sync:', event);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Background sync function
async function doBackgroundSync() {
  try {
    // Check for pending replies or other data to sync
    const pendingReplies = await getStoredReplies();
    
    for (const reply of pendingReplies) {
      try {
        const response = await fetch('/api/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reply)
        });
        
        if (response.ok) {
          // Remove from pending replies
          await removeStoredReply(reply.id);
        }
      } catch (error) {
        console.error('Error syncing reply:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Store reply for background sync
async function storeReply(reply) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const pendingReplies = await getStoredReplies();
    pendingReplies.push({ ...reply, id: Date.now() });
    
    await cache.put('/pending-replies', new Response(JSON.stringify(pendingReplies)));
  } catch (error) {
    console.error('Error storing reply:', error);
  }
}

// Get stored replies
async function getStoredReplies() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match('/pending-replies');
    
    if (response) {
      return await response.json();
    }
  } catch (error) {
    console.error('Error getting stored replies:', error);
  }
  
  return [];
}

// Remove stored reply
async function removeStoredReply(replyId) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const pendingReplies = await getStoredReplies();
    const filteredReplies = pendingReplies.filter(reply => reply.id !== replyId);
    
    await cache.put('/pending-replies', new Response(JSON.stringify(filteredReplies)));
  } catch (error) {
    console.error('Error removing stored reply:', error);
  }
}

// Fetch event - handle network requests
self.addEventListener('fetch', event => {
  // Only handle GET requests for now
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(error => {
        console.error('Fetch failed:', error);
        
        // Return a fallback response for critical pages
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
        
        throw error;
      })
  );
});

// Message event - handle messages from client
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'skip-waiting':
      self.skipWaiting();
      break;
      
    case 'store-reply':
      storeReply(data);
      break;
      
    case 'get-version':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

// Error event
self.addEventListener('error', event => {
  console.error('Service Worker error:', event.error);
});

// Unhandled rejection event
self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('Service Worker loaded successfully');