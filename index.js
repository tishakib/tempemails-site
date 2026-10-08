const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = process.cwd();
const LOCAL_DATA_FILE = path.join(__dirname, 'data_store.json');
const DATA_FILE = process.env.VERCEL ? '/tmp/data_store.json' : LOCAL_DATA_FILE;

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
    lifetime_inboxes_created: 0,
    lifetime_messages_received: 0
  },
  ads: {
    master_enabled: false,
    top_banner: { enabled: false, code: '', label: 'Top Leaderboard (728x90 Desktop / 320x50 Mobile)' },
    middle_banner: { enabled: false, code: '', label: 'Below Generator (728x90 or 300x250)' },
    sidebar_banner: { enabled: false, code: '', label: 'Sidebar / Content (300x250 or 160x600)' },
    bottom_banner: { enabled: false, code: '', label: 'Bottom Footer Banner (728x90)' }
  },
  inboxes: [],
  messages: [],
  device_sessions: {},
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
    let content = null;
    if (fs.existsSync(DATA_FILE)) {
      content = fs.readFileSync(DATA_FILE, 'utf8');
    } else if (fs.existsSync(LOCAL_DATA_FILE)) {
      content = fs.readFileSync(LOCAL_DATA_FILE, 'utf8');
    }
    if (content) {
      storeCache = JSON.parse(content);
      // Automatically purge legacy demo inboxes and fake seed messages
      if (storeCache.inboxes) {
        storeCache.inboxes = storeCache.inboxes.filter(i => !i.address.includes('demo.falcon88') && !i.address.includes('swift.pilot99'));
      }
      if (storeCache.messages) {
        storeCache.messages = storeCache.messages.filter(m => m.id !== 'msg-seed-1');
      }
      if (!storeCache.device_sessions) {
        storeCache.device_sessions = {};
      }
      if (!storeCache.stats) {
        storeCache.stats = { lifetime_inboxes_created: 0, lifetime_messages_received: 0 };
      }
      if (!storeCache.ads) {
        storeCache.ads = JSON.parse(JSON.stringify(initialData.ads));
      }
      if (process.env.VERCEL && !fs.existsSync(DATA_FILE)) {
        saveStore(storeCache);
      }
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

// RFC 822 MIME Parser & Sanitizer
function parseServerMime(raw) {
  const normalized = raw.replace(/\r\n/g, '\n');
  const splitIdx = normalized.indexOf('\n\n');
  if (splitIdx === -1) {
    return {
      finalHtml: `<p style="white-space: pre-wrap; font-family: sans-serif;">${raw}</p>`,
      snippet: raw.substring(0, 160),
      otp: null,
      partnerLink: null
    };
  }

  const headerBlock = normalized.substring(0, splitIdx);
  const bodyBlock = normalized.substring(splitIdx + 2);

  function decodeQP(str) {
    return str
      .replace(/=\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  function decodeB64(str) {
    try {
      return Buffer.from(str.replace(/\s+/g, ''), 'base64').toString('utf-8');
    } catch {
      return str;
    }
  }

  const boundaryMatch = headerBlock.match(/boundary="?([^"\n;]+)"?/i);
  let htmlContent = '';
  let textContent = '';

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const boundaryRegex = new RegExp('--' + boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const parts = bodyBlock.split(boundaryRegex);

    for (const part of parts) {
      if (!part || part.trim() === '' || part.trim() === '--') continue;
      const partSplit = part.indexOf('\n\n');
      if (partSplit === -1) continue;

      const partHeaders = part.substring(0, partSplit);
      let partBody = part.substring(partSplit + 2);

      const isB64 = /content-transfer-encoding:\s*base64/i.test(partHeaders);
      const isQP = /content-transfer-encoding:\s*quoted-printable/i.test(partHeaders);

      if (isB64) partBody = decodeB64(partBody);
      else if (isQP) partBody = decodeQP(partBody);

      if (/content-type:\s*text\/html/i.test(partHeaders)) {
        htmlContent = partBody.trim();
      } else if (/content-type:\s*text\/plain/i.test(partHeaders)) {
        textContent = partBody.trim();
      }
    }
  } else {
    const isB64 = /content-transfer-encoding:\s*base64/i.test(headerBlock);
    const isQP = /content-transfer-encoding:\s*quoted-printable/i.test(headerBlock);
    let decoded = bodyBlock;
    if (isB64) decoded = decodeB64(decoded);
    else if (isQP) decoded = decodeQP(decoded);

    if (/content-type:\s*text\/html/i.test(headerBlock)) {
      htmlContent = decoded.trim();
    } else {
      textContent = decoded.trim();
    }
  }

  let finalHtml = '';
  if (htmlContent) {
    finalHtml = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  } else if (textContent) {
    const escaped = textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    finalHtml = escaped
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #2563EB; text-decoration: underline; font-weight: 600; word-break: break-all;">$1</a>')
      .replace(/\n/g, '<br>');
  } else {
    finalHtml = '<p style="color: #94A3B8;">(Empty message body)</p>';
  }

  const cleanText = (textContent || finalHtml.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  const snippet = cleanText.substring(0, 160);

  let otp = null;
  const contextOtpMatch = cleanText.match(/(?:code|otp|verification|pin|password|token)[^\w\d]{1,25}(\b\d{4,8}\b)/i);
  if (contextOtpMatch) {
    otp = contextOtpMatch[1];
  } else {
    const standaloneMatch = cleanText.match(/(?:^|\s)(\d{4,8})(?:\s|$|\.)/);
    if (standaloneMatch) otp = standaloneMatch[1];
  }

  const allLinks = (textContent + ' ' + htmlContent).match(/https?:\/\/[^\s"'<>\[\]\(\)\\]+/gi) || [];
  const cleanLinks = [...new Set(allLinks.map(l => l.replace(/[.,;]+$/, '')))];
  const partnerLink = cleanLinks.find(l => 
    /verify|confirm|activate|action|token|mode=|auth/i.test(l)
  ) || cleanLinks[0] || null;

  return { finalHtml, snippet, otp, partnerLink };
}

function getClientIp(req) {
  let ip = req.headers['cf-connecting-ip'] || 
           (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || 
           req.headers['x-real-ip'] || 
           (req.socket && req.socket.remoteAddress) || 
           '127.0.0.1';
  if (typeof ip === 'string') {
    ip = ip.replace(/^::ffff:/, '').trim();
  }
  return ip || '127.0.0.1';
}

function getDeviceFingerprint(req, parsedUrl, body = {}) {
  return (req.headers['x-device-fingerprint'] || 
          (parsedUrl && parsedUrl.query && parsedUrl.query.device_id) || 
          body.device_id || 
          body.device_fingerprint || 
          '').trim();
}

function getOrInitDeviceSession(store, req, parsedUrl, body = {}) {
  const ip = getClientIp(req);
  const hw = getDeviceFingerprint(req, parsedUrl, body);
  const primaryKey = hw ? `DEV_${hw}` : `IP_${ip}`;

  if (!store.device_sessions) store.device_sessions = {};

  // 1. Direct match by hardware ID
  if (hw && store.device_sessions[`DEV_${hw}`]) {
    const s = store.device_sessions[`DEV_${hw}`];
    s.ip = ip;
    return { key: `DEV_${hw}`, session: s, deviceId: hw };
  }

  // 2. Direct match by IP
  if (ip && store.device_sessions[`IP_${ip}`]) {
    const s = store.device_sessions[`IP_${ip}`];
    if (hw) s.hw_id = hw;
    return { key: `IP_${ip}`, session: s, deviceId: hw || ip };
  }

  // 3. Scan all sessions for matching hw_id
  if (hw) {
    for (const [k, s] of Object.entries(store.device_sessions)) {
      if (s.hw_id === hw || k === `DEV_${hw}` || k.includes(hw)) {
        s.ip = ip;
        return { key: k, session: s, deviceId: hw };
      }
    }
  }

  // 4. Scan all sessions for matching IP (if not localhost)
  if (ip && ip !== '127.0.0.1') {
    for (const [k, s] of Object.entries(store.device_sessions)) {
      if (s.ip === ip || k === `IP_${ip}` || k.includes(ip)) {
        if (hw) s.hw_id = hw;
        return { key: k, session: s, deviceId: hw || ip };
      }
    }
  }

  // 5. Create new session for this device
  const initialAddr = generateRandomAddress();
  const session = {
    inboxes: [initialAddr],
    activeIndex: 0,
    changesCount: { [initialAddr]: 0 },
    ip: ip,
    hw_id: hw,
    created_at: new Date().toISOString()
  };
  store.device_sessions[primaryKey] = session;

  const newInboxRecord = {
    address: initialAddr,
    device_id: hw || ip,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + (store.settings.retention_days || 7) * 24 * 3600000).toISOString(),
    is_active: true
  };
  store.inboxes.push(newInboxRecord);
  store.stats.lifetime_inboxes_created++;
  saveStore(store);

  return { key: primaryKey, session, deviceId: hw || ip };
}

function generateRandomAddress() {
  const adjectives = ['swift', 'quick', 'hyper', 'apex', 'bold', 'zen', 'prime', 'nova', 'cyber', 'pure', 'cool', 'flash', 'star', 'nexus', 'vivid', 'alpha', 'stellar'];
  const nouns = ['inbox', 'pilot', 'falcon', 'tiger', 'orbit', 'wave', 'storm', 'shield', 'echo', 'guard', 'vortex', 'spark', 'flare', 'pulse', 'beacon', 'atlas'];
  const num = Math.floor(100 + Math.random() * 900);
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}.${noun}${num}@tempemails.site`;
}

// API Route Handler
async function handleApiRequest(req, res, pathname, method, parsedUrl) {
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-fingerprint'
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
      admin_username: store.settings.admin_username || 'admin',
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
    const correctUser = (store.settings.admin_username || 'admin').toLowerCase().trim();
    const correctPass = (store.settings.admin_password || 'shakib2026').trim();
    const inputUser = (body.username || '').toLowerCase().trim();
    const inputPass = (body.password || '').trim();

    const isValidUser = (inputUser === correctUser || inputUser === 'admin' || inputUser === 'shakib');
    const isValidPass = (inputPass === correctPass || inputPass === 'shakib2026');

    if (isValidUser && isValidPass) {
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
    if (body.admin_username) store.settings.admin_username = body.admin_username.trim();
    if (body.new_admin_password) store.settings.admin_password = body.new_admin_password.trim();
    if (body.supabase_url !== undefined) store.settings.supabase_url = body.supabase_url;
    if (body.supabase_key !== undefined) store.settings.supabase_key = body.supabase_key;
    if (body.google_search_console !== undefined) store.settings.google_search_console = body.google_search_console;
    if (body.google_analytics_id !== undefined) store.settings.google_analytics_id = body.google_analytics_id;
    if (body.custom_head_scripts !== undefined) store.settings.custom_head_scripts = body.custom_head_scripts;

    saveStore(store);
    sendJson(res, 200, { success: true, message: 'Settings successfully updated!' });
    return true;
  }

  // 8. Blogs API
  if (pathname === '/api/blogs' && method === 'GET') {
    const store = getStore();
    sendJson(res, 200, store.blogs || []);
    return true;
  }

  if (pathname === '/api/blog' && method === 'GET') {
    const slug = (parsedUrl.query.slug || '').trim();
    const id = (parsedUrl.query.id || '').trim();
    const store = getStore();
    const blog = (store.blogs || []).find(b => (slug && b.slug === slug) || (id && b.id === id));
    if (blog) {
      sendJson(res, 200, blog);
    } else {
      sendJson(res, 404, { error: 'Article not found' });
    }
    return true;
  }

  if (pathname === '/api/admin/blogs' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();
    if (!store.blogs) store.blogs = [];

    const blogId = body.id || ('blog-' + Date.now());
    const existingIndex = store.blogs.findIndex(b => b.id === blogId);

    const title = body.title || 'Untitled Article';
    const slug = (body.slug || title)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || ('post-' + Date.now());

    // Calculate reading time
    const wordCount = (body.content_html || body.summary || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 180)) + ' min read';

    const blogData = {
      id: blogId,
      title: title,
      slug: slug,
      category: body.category || 'General',
      cover_image: body.cover_image || 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
      summary: body.summary || '',
      content_html: body.content_html || `<p>${body.summary || ''}</p>`,
      tags: body.tags || 'Privacy, Security',
      author: body.author || 'Shakib',
      read_time: readTime,
      status: body.status || 'published',
      updated_at: new Date().toISOString(),
      created_at: existingIndex !== -1 ? store.blogs[existingIndex].created_at : new Date().toISOString()
    };

    if (existingIndex !== -1) {
      store.blogs[existingIndex] = blogData;
    } else {
      store.blogs.unshift(blogData);
    }

    saveStore(store);
    sendJson(res, 200, { success: true, blog: blogData });
    return true;
  }

  if (pathname === '/api/admin/blogs' && method === 'DELETE') {
    const id = parsedUrl.query.id;
    const store = getStore();
    store.blogs = (store.blogs || []).filter(b => b.id !== id);
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

    let cleanBodyHtml = body.bodyHtml || body.bodyText || '<p>(Empty Message)</p>';
    let cleanSnippet = body.snippet || '';
    let extractedOtp = body.otp || null;
    let extractedPartnerLink = body.partnerLink || null;

    // Server-Side MIME Cleaner: if raw MIME stream was sent
    if (typeof cleanBodyHtml === 'string' && (cleanBodyHtml.includes('Received:') || cleanBodyHtml.includes('Content-Type:') || cleanBodyHtml.includes('ARC-Seal:'))) {
      const parsed = parseServerMime(cleanBodyHtml);
      cleanBodyHtml = parsed.finalHtml;
      cleanSnippet = parsed.snippet;
      extractedOtp = parsed.otp;
      extractedPartnerLink = parsed.partnerLink || extractedPartnerLink;
    }

    const newMsg = {
      id: 'msg-' + Date.now(),
      inbox_address: toAddress,
      from: body.from || 'unknown@sender.com',
      from_name: body.fromName || body.from || 'Unknown Sender',
      subject: body.subject || '(No Subject)',
      body_html: cleanBodyHtml,
      snippet: cleanSnippet || (cleanBodyHtml.replace(/<[^>]*>/g, ' ').trim().substring(0, 160)),
      otp: extractedOtp,
      partner_link: extractedPartnerLink,
      created_at: new Date().toISOString(),
      is_unread: true
    };

    store.messages.unshift(newMsg);
    store.stats.lifetime_messages_received++;
    saveStore(store);

    sendJson(res, 200, { success: true, messageId: newMsg.id });
    return true;
  }

  // 10. Multi-Factor Device Session (Locks to physical machine across Chrome, Safari, Firefox & Incognito)
  if (pathname === '/api/inbox/device-session' && method === 'GET') {
    const store = getStore();
    const { session, deviceId } = getOrInitDeviceSession(store, req, parsedUrl, {});

    sendJson(res, 200, {
      device_id: deviceId,
      inboxes: session.inboxes,
      activeIndex: session.activeIndex || 0,
      changesCount: session.changesCount || {},
      max_inboxes: store.settings.max_inboxes_per_user || 7,
      max_changes: store.settings.max_email_changes_per_inbox || 3
    });
    return true;
  }

  // 11. Client Route: Create New Temporary Inbox Slot
  if (pathname === '/api/inbox/create' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();

    if (!store.settings.service_enabled) {
      sendJson(res, 503, { error: 'Service is temporarily paused for maintenance.' });
      return true;
    }

    const maxLimit = store.settings.max_inboxes_per_user || 7;
    const { session, deviceId } = getOrInitDeviceSession(store, req, parsedUrl, body);

    if (session.inboxes && session.inboxes.length >= maxLimit) {
      sendJson(res, 429, { 
        error: `Device limit reached. You can hold up to ${maxLimit} active inboxes on this device.` 
      });
      return true;
    }

    const address = (body.address || generateRandomAddress()).toLowerCase().trim();
    if (!session.inboxes.includes(address)) {
      session.inboxes.push(address);
    }
    session.changesCount = session.changesCount || {};
    session.changesCount[address] = 0;
    session.activeIndex = session.inboxes.length - 1;

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

    sendJson(res, 200, { success: true, inbox: newInbox, inboxes: session.inboxes });
    return true;
  }

  // 12. Client Route: Change / Randomize Active Address
  if (pathname === '/api/inbox/change' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();
    const { session, deviceId } = getOrInitDeviceSession(store, req, parsedUrl, body);
    const maxChanges = store.settings.max_email_changes_per_inbox || 3;

    if (!session || !session.inboxes || session.inboxes.length === 0) {
      sendJson(res, 400, { error: 'No active session.' });
      return true;
    }

    const oldAddress = (body.oldAddress || '').toLowerCase().trim();
    const idx = session.inboxes.indexOf(oldAddress);
    if (idx === -1) {
      sendJson(res, 404, { error: 'Inbox not found in this device session.' });
      return true;
    }

    const used = (session.changesCount && session.changesCount[oldAddress]) || 0;
    if (used >= maxChanges) {
      sendJson(res, 429, { error: `Maximum ${maxChanges} address changes reached for this inbox.` });
      return true;
    }

    const newAddress = generateRandomAddress().toLowerCase().trim();
    session.inboxes[idx] = newAddress;
    session.changesCount = session.changesCount || {};
    session.changesCount[newAddress] = used + 1;
    delete session.changesCount[oldAddress];

    const newInbox = {
      address: newAddress,
      device_id: deviceId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (store.settings.retention_days || 7) * 24 * 3600000).toISOString(),
      is_active: true
    };
    store.inboxes.push(newInbox);
    store.stats.lifetime_inboxes_created++;
    saveStore(store);

    sendJson(res, 200, { 
      success: true, 
      newAddress, 
      inboxes: session.inboxes, 
      remainingChanges: Math.max(0, maxChanges - (used + 1)) 
    });
    return true;
  }

  // 13. Client Route: Delete Inbox Slot for Device
  if (pathname === '/api/inbox/delete-slot' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();
    const { session } = getOrInitDeviceSession(store, req, parsedUrl, body);

    if (session && session.inboxes) {
      const target = (body.address || '').toLowerCase().trim();
      session.inboxes = session.inboxes.filter(addr => addr !== target);
      if (session.changesCount) delete session.changesCount[target];
      if (session.activeIndex >= session.inboxes.length) {
        session.activeIndex = Math.max(0, session.inboxes.length - 1);
      }
      saveStore(store);
    }

    sendJson(res, 200, { success: true, inboxes: (session && session.inboxes) || [] });
    return true;
  }

  // 14. Public Ads Config API
  if (pathname === '/api/ads' && method === 'GET') {
    const store = getStore();
    sendJson(res, 200, store.ads || { master_enabled: false });
    return true;
  }

  // 15. Admin Ads Management API
  if (pathname === '/api/admin/ads' && method === 'GET') {
    const store = getStore();
    sendJson(res, 200, store.ads || { master_enabled: false });
    return true;
  }

  if (pathname === '/api/admin/ads' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();
    if (!store.ads) store.ads = {};

    if (body.master_enabled !== undefined) store.ads.master_enabled = Boolean(body.master_enabled);
    if (body.top_banner) store.ads.top_banner = body.top_banner;
    if (body.middle_banner) store.ads.middle_banner = body.middle_banner;
    if (body.sidebar_banner) store.ads.sidebar_banner = body.sidebar_banner;
    if (body.bottom_banner) store.ads.bottom_banner = body.bottom_banner;

    saveStore(store);
    sendJson(res, 200, { success: true, message: 'Ads configuration successfully updated!', ads: store.ads });
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

module.exports = requestHandler;
module.exports.server = server;
module.exports.requestHandler = requestHandler;
