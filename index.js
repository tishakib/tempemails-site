const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = process.cwd();
const DATA_FILE = process.env.VERCEL ? '/tmp/data_store.json' : path.join(__dirname, 'data_store.json');

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

// Initial Database Structure
const initialData = {
  settings: {
    max_inboxes_per_user: 7,
    max_email_changes_per_inbox: 3,
    retention_days: 7,
    service_enabled: true,
    maintenance_message: 'Our email servers are currently undergoing scheduled maintenance. New inbox generation will resume shortly. Thank you for your patience!',
    turnstile_enabled: true,
    turnstile_site_key: '1x00000000000000000000AA',
    turnstile_secret_key: '1x0000000000000000000000000000000AA',
    admin_password: 'shakib2026',
    supabase_url: '',
    supabase_key: '',
    google_search_console: '',
    google_analytics_id: '',
    custom_head_scripts: ''
  },
  stats: {
    lifetime_inboxes_created: 1420,
    lifetime_messages_received: 8640
  },
  inboxes: [
    {
      address: 'demo.falcon88@tempemails.site',
      device_id: 'Desktop-macOS-DEMO88',
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      expires_at: new Date(Date.now() + 3600000 * 24 * 5).toISOString(),
      is_active: true
    }
  ],
  messages: [
    {
      id: 'msg-seed-1',
      inbox_address: 'demo.falcon88@tempemails.site',
      from: 'Twitter / X Security <verify@x.com>',
      from_name: 'Twitter / X Security',
      subject: 'Your confirmation code is 849201',
      body_html: '<div style="font-family:sans-serif;padding:15px;"><h2>Confirm your email</h2><p>Your code is: <strong>849201</strong></p></div>',
      snippet: 'Your confirmation code is 849201. Expires in 10 minutes.',
      otp: '849201',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      is_unread: true
    }
  ],
  blogs: [
    {
      id: 'blog-1',
      title: 'Protecting Your Primary Email from Data Breaches in 2026',
      slug: 'protecting-primary-email-data-breaches',
      category: 'Security',
      cover_image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
      summary: 'Discover why entering your real email on public Wi-Fi or one-time trials is dangerous, and how throwaway inboxes protect your core accounts.',
      created_at: new Date().toISOString()
    },
    {
      id: 'blog-2',
      title: 'How OTP Verification Codes Work on Temporary Mail',
      slug: 'how-otp-verification-codes-work',
      category: 'Tutorial',
      cover_image: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&auto=format&fit=crop&q=80',
      summary: 'A comprehensive look at edge email routing, regex extraction, and how automated disposable inboxes catch one-time passwords instantly.',
      created_at: new Date().toISOString()
    }
  ]
};

// In-memory store cache
let storeCache = null;

function getStore() {
  if (storeCache) return storeCache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      storeCache = JSON.parse(content);
      return storeCache;
    }
  } catch (e) {
    console.error('Error reading data file, using default:', e);
  }
  storeCache = JSON.parse(JSON.stringify(initialData));
  saveStore(storeCache);
  return storeCache;
}

function saveStore(data) {
  storeCache = data;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // Non-fatal if filesystem is restricted
  }
}

// Helper: Parse JSON Body
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

// Helper: JSON Response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// API Route Handler
async function handleApiRequest(req, res, pathname, method, parsedUrl) {
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return true;
  }

  // 1. Settings
  if (pathname === '/api/settings' && method === 'GET') {
    const store = getStore();
    sendJson(res, 200, {
      max_inboxes_per_user: store.settings.max_inboxes_per_user || 7,
      max_email_changes_per_inbox: store.settings.max_email_changes_per_inbox || 3,
      retention_days: store.settings.retention_days || 7,
      service_enabled: store.settings.service_enabled !== false,
      maintenance_message: store.settings.maintenance_message || 'Our email servers are currently undergoing scheduled maintenance. New inbox generation will resume shortly.',
      turnstile_enabled: store.settings.turnstile_enabled !== false,
      turnstile_site_key: store.settings.turnstile_site_key || '1x00000000000000000000AA',
      google_search_console: store.settings.google_search_console || '',
      google_analytics_id: store.settings.google_analytics_id || '',
      custom_head_scripts: store.settings.custom_head_scripts || ''
    });
    return true;
  }

  // 2. Admin Login
  if (pathname === '/api/admin/login' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();
    const correctPass = store.settings.admin_password || 'shakib2026';
    if (body.username === 'admin' && body.password === correctPass) {
      sendJson(res, 200, {
        success: true,
        token: 'tre_admin_session_token_' + Date.now(),
        message: 'Welcome back, Administrator!'
      });
    } else {
      sendJson(res, 401, { success: false, message: 'Invalid admin username or password.' });
    }
    return true;
  }

  // 3. Admin Live Statistics
  if (pathname === '/api/admin/stats' && method === 'GET') {
    const store = getStore();
    const now = Date.now();
    const last24h = now - 24 * 3600000;
    const todayInboxes = store.inboxes.filter(i => new Date(i.created_at).getTime() > last24h).length;
    const activeInboxes = store.inboxes.length;
    const totalMessages = store.messages.length;

    sendJson(res, 200, {
      lifetime_created: store.stats.lifetime_inboxes_created + activeInboxes,
      active_now: activeInboxes,
      created_today: todayInboxes,
      total_messages: store.stats.lifetime_messages_received + totalMessages,
      retention_days: store.settings.retention_days || 7,
      max_inboxes_limit: store.settings.max_inboxes_per_user || 7,
      service_enabled: store.settings.service_enabled !== false
    });
    return true;
  }

  // 4. Admin Inboxes List
  if (pathname === '/api/admin/inboxes' && method === 'GET') {
    const store = getStore();
    const inboxesWithCounts = store.inboxes.map(inbox => {
      const msgCount = store.messages.filter(m => m.inbox_address === inbox.address).length;
      return { ...inbox, message_count: msgCount };
    });
    sendJson(res, 200, inboxesWithCounts);
    return true;
  }

  // 5. Admin Inspect Messages for a specific inbox
  if (pathname === '/api/admin/inbox-messages' && method === 'GET') {
    const address = parsedUrl.query.address;
    const store = getStore();
    const inboxMsgs = store.messages.filter(m => m.inbox_address === address);
    sendJson(res, 200, inboxMsgs);
    return true;
  }

  // 6. Admin Delete an Inbox manually
  if (pathname === '/api/admin/inbox' && method === 'DELETE') {
    const address = parsedUrl.query.address;
    const store = getStore();
    store.inboxes = store.inboxes.filter(i => i.address !== address);
    store.messages = store.messages.filter(m => m.inbox_address !== address);
    saveStore(store);
    sendJson(res, 200, { success: true, message: `Inbox ${address} permanently deleted.` });
    return true;
  }

  // 7. Admin Update Settings
  if (pathname === '/api/admin/settings' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();

    if (body.max_inboxes_per_user !== undefined) store.settings.max_inboxes_per_user = parseInt(body.max_inboxes_per_user, 10) || 7;
    if (body.max_email_changes_per_inbox !== undefined) store.settings.max_email_changes_per_inbox = parseInt(body.max_email_changes_per_inbox, 10) || 3;
    if (body.retention_days !== undefined) store.settings.retention_days = parseInt(body.retention_days, 10) || 7;
    if (body.service_enabled !== undefined) store.settings.service_enabled = Boolean(body.service_enabled);
    if (body.maintenance_message !== undefined) store.settings.maintenance_message = body.maintenance_message;
    if (body.turnstile_enabled !== undefined) store.settings.turnstile_enabled = Boolean(body.turnstile_enabled);
    if (body.turnstile_site_key !== undefined) store.settings.turnstile_site_key = body.turnstile_site_key;
    if (body.turnstile_secret_key !== undefined) store.settings.turnstile_secret_key = body.turnstile_secret_key;
    if (body.new_admin_password) store.settings.admin_password = body.new_admin_password;
    if (body.supabase_url !== undefined) store.settings.supabase_url = body.supabase_url;
    if (body.supabase_key !== undefined) store.settings.supabase_key = body.supabase_key;
    if (body.google_search_console !== undefined) store.settings.google_search_console = body.google_search_console;
    if (body.google_analytics_id !== undefined) store.settings.google_analytics_id = body.google_analytics_id;
    if (body.custom_head_scripts !== undefined) store.settings.custom_head_scripts = body.custom_head_scripts;

    saveStore(store);
    sendJson(res, 200, { success: true, message: 'Settings successfully updated!' });
    return true;
  }

  // 8. Blogs
  if (pathname === '/api/blogs' && method === 'GET') {
    const store = getStore();
    sendJson(res, 200, store.blogs || []);
    return true;
  }

  if (pathname === '/api/admin/blogs' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();
    const newBlog = {
      id: 'blog-' + Date.now(),
      title: body.title || 'Untitled Article',
      slug: (body.title || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: body.category || 'General',
      cover_image: body.cover_image || 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
      summary: body.summary || '',
      created_at: new Date().toISOString()
    };
    store.blogs.unshift(newBlog);
    saveStore(store);
    sendJson(res, 200, { success: true, blog: newBlog });
    return true;
  }

  if (pathname === '/api/admin/blogs' && method === 'DELETE') {
    const id = parsedUrl.query.id;
    const store = getStore();
    store.blogs = store.blogs.filter(b => b.id !== id);
    saveStore(store);
    sendJson(res, 200, { success: true });
    return true;
  }

  // 9. Webhook: Inbound Email Receiver (Called by Cloudflare Worker)
  if (pathname === '/api/inbox/incoming' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();

    const toAddress = (body.to || '').toLowerCase().trim();
    if (!toAddress) {
      sendJson(res, 400, { error: 'Missing recipient "to" address.' });
      return true;
    }

    let existingInbox = store.inboxes.find(i => i.address === toAddress);
    if (!existingInbox) {
      existingInbox = {
        address: toAddress,
        device_id: 'auto-inbound',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (store.settings.retention_days || 7) * 24 * 3600000).toISOString(),
        is_active: true
      };
      store.inboxes.push(existingInbox);
      store.stats.lifetime_inboxes_created++;
    }

    const newMsg = {
      id: 'msg-' + Date.now(),
      inbox_address: toAddress,
      from: body.from || 'unknown@sender.com',
      from_name: body.fromName || body.from || 'Unknown Sender',
      subject: body.subject || '(No Subject)',
      body_html: body.bodyHtml || body.bodyText || '<p>(Empty Message)</p>',
      snippet: (body.snippet || body.bodyText || body.subject || '').substring(0, 160),
      otp: body.otp || null,
      partner_link: body.partnerLink || null,
      created_at: new Date().toISOString(),
      is_unread: true
    };

    store.messages.unshift(newMsg);
    store.stats.lifetime_messages_received++;
    saveStore(store);

    sendJson(res, 200, { success: true, messageId: newMsg.id });
    return true;
  }

  // 10. Client Route: Create New Temporary Inbox
  if (pathname === '/api/inbox/create' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();

    if (!store.settings.service_enabled) {
      sendJson(res, 503, { error: 'Service is temporarily paused for maintenance.' });
      return true;
    }

    const deviceId = body.device_id || 'unknown-device';
    const maxLimit = store.settings.max_inboxes_per_user || 7;

    const userInboxes = store.inboxes.filter(i => i.device_id === deviceId);
    if (userInboxes.length >= maxLimit) {
      sendJson(res, 429, { 
        error: `Device limit reached. You can hold up to ${maxLimit} active inboxes.` 
      });
      return true;
    }

    const address = (body.address || '').toLowerCase();
    const newInbox = {
      address: address,
      device_id: deviceId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (store.settings.retention_days || 7) * 24 * 3600000).toISOString(),
      is_active: true
    };

    store.inboxes.push(newInbox);
    store.stats.lifetime_inboxes_created++;
    saveStore(store);

    sendJson(res, 200, { success: true, inbox: newInbox });
    return true;
  }

  // 11. Client Route: Get Messages for Inbox
  if (pathname === '/api/inbox/messages' && method === 'GET') {
    const email = (parsedUrl.query.email || '').toLowerCase().trim();
    if (!email) {
      sendJson(res, 400, { error: 'Missing email query parameter.' });
      return true;
    }
    const store = getStore();
    const messages = store.messages.filter(m => (m.inbox_address || '').toLowerCase() === email);
    sendJson(res, 200, messages);
    return true;
  }

  // 12. Client Route: Delete a Single Message
  if (pathname === '/api/inbox/message' && method === 'DELETE') {
    const id = parsedUrl.query.id;
    if (!id) {
      sendJson(res, 400, { error: 'Missing message id.' });
      return true;
    }
    const store = getStore();
    store.messages = store.messages.filter(m => m.id !== id);
    saveStore(store);
    sendJson(res, 200, { success: true });
    return true;
  }

  sendJson(res, 404, { error: 'API endpoint not found' });
  return true;
}

// Master HTTP Request Handler
const requestHandler = async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let reqPath = parsedUrl.pathname;

  // Handle API routes
  if (reqPath.startsWith('/api')) {
    await handleApiRequest(req, res, reqPath, req.method, parsedUrl);
    return;
  }

  // Handle Clean URLs & Secret Admin Portal
  if (reqPath === '/admin-shakib' || reqPath === '/admin-shakib/') {
    reqPath = '/admin-shakib.html';
  } else if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, reqPath);

  // If path has no extension and .html exists, serve .html
  if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  fs.stat(resolved, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1><p><a href="/">Return to tempemails.site</a></p>');
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
    });

    const stream = fs.createReadStream(resolved);
    stream.pipe(res);
  });
};

const server = http.createServer(requestHandler);

if (process.env.PORT || require.main === module) {
  server.listen(PORT, () => {
    console.log(`[tempemails.site] Server running on port ${PORT}`);
    console.log(`[Admin Portal] Secret URL: /admin-shakib`);
  });
}

module.exports = server;
