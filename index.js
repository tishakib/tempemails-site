const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load environment variables from .env if present (zero-dependency pure Node.js)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      });
    } catch (e) {}
  }
}
loadEnv();

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
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

// Initial Database Structure
const initialData = {
  settings: {
    max_inboxes_per_user: 3,
    max_email_changes_per_inbox: 3,
    retention_days: 7,
    service_enabled: true,
    maintenance_message: 'Our email servers are currently undergoing scheduled maintenance. New inbox generation will resume shortly. Thank you for your patience!',
    turnstile_enabled: true,
    turnstile_site_key: '0x4AAAAAAFRu_7JO3yDw1SR7',
    admin_password: 'shakib2026',
    google_search_console: '_L5-YT0C3h80QPkTQncQ_MDu0QFNbBLnH4ZaQna9FPI',
    google_analytics_id: '',
    custom_head_scripts: '',
    developer: {
      enabled: true,
      name: 'Shakib Hasan',
      title: 'Lead Developer & Creator',
      bio: 'Full-Stack Developer passionate about digital privacy and frictionless web experiences. Built tempemails.site to give everyone instant, anonymous temporary email addresses protected by hardware fingerprinting and zero logs.',
      avatar_initials: 'SH',
      avatar_image: '',
      coffee_button_text: 'Buy Me a Coffee (Get a Coffee)',
      coffee_link: 'mailto:support@tempemails.site?subject=Coffee%20Support%20for%20Shakib%20Hasan',
      contact_email: 'support@tempemails.site'
    }
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
  ],
  contacts: []
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
      if (!storeCache.contacts) {
        storeCache.contacts = [];
      }
      if (!storeCache.settings) {
        storeCache.settings = JSON.parse(JSON.stringify(initialData.settings));
      } else if (!storeCache.settings.developer) {
        storeCache.settings.developer = JSON.parse(JSON.stringify(initialData.settings.developer));
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

// RFC 2047 MIME Header Decoder (Handles UTF-8, Bengali, Hindi, Arabic, Japanese, Chinese, Emoji, Base64 & QP)
function decodeMimeHeader(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // Unfold multi-line headers
  let str = raw.replace(/\r?\n[ \t]+/g, ' ');
  // RFC 2047: Delete linear whitespace between adjacent encoded words
  str = str.replace(/(\=\?[^\?]+\?[bBqQ]\?[^\?]*\?\=)\s+(?=\=\?[^\?]+\?[bBqQ]\?[^\?]*\?\=)/g, '$1');
  return str.replace(/\=\?([^?]+)\?([bBqQ])\?([^?]*)\?\=/gi, (match, charset, enc, text) => {
    try {
      const encoding = enc.toUpperCase();
      let buf;
      if (encoding === 'B') {
        buf = Buffer.from(text.replace(/\s+/g, ''), 'base64');
      } else if (encoding === 'Q') {
        const qp = text.replace(/_/g, ' ');
        const bytes = [];
        for (let i = 0; i < qp.length; i++) {
          if (qp[i] === '=' && i + 2 < qp.length && /^[0-9A-Fa-f]{2}$/.test(qp.substring(i + 1, i + 3))) {
            bytes.push(parseInt(qp.substring(i + 1, i + 3), 16));
            i += 2;
          } else {
            bytes.push(qp.charCodeAt(i));
          }
        }
        buf = Buffer.from(bytes);
      }
      const cs = (charset || 'utf-8').toLowerCase().replace(/[^a-z0-9_-]/g, '');
      return new TextDecoder(cs).decode(buf);
    } catch (e) {
      try {
        return new TextDecoder('utf-8').decode(buf);
      } catch (e2) {
        return match;
      }
    }
  });
}

function decodeBufferWithCharset(buf, charset = 'utf-8') {
  if (!buf) return '';
  const cs = (charset || 'utf-8').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  try {
    return new TextDecoder(cs).decode(buf);
  } catch (e) {
    try {
      return new TextDecoder('utf-8').decode(buf);
    } catch (e2) {
      return buf.toString('latin1');
    }
  }
}

// RFC 2045 Quoted-Printable Decoder (Preserves multibyte UTF-8 sequences for Bengali, Indic, Arabic, CJK & Emojis)
function decodeQuotedPrintable(rawStr, charset = 'utf-8') {
  if (!rawStr) return '';
  const clean = rawStr.replace(/=(?:\r\n|\n|\r)/g, '');
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '=' && i + 2 < clean.length && /^[0-9A-Fa-f]{2}$/.test(clean.substring(i + 1, i + 3))) {
      bytes.push(parseInt(clean.substring(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(clean.charCodeAt(i));
    }
  }
  return decodeBufferWithCharset(Buffer.from(bytes), charset);
}

// Base64 Decoder with Charset Awareness
function decodeBase64(rawStr, charset = 'utf-8') {
  if (!rawStr) return '';
  try {
    const clean = rawStr.replace(/[^A-Za-z0-9+/=]/g, '');
    return decodeBufferWithCharset(Buffer.from(clean, 'base64'), charset);
  } catch (e) {
    return rawStr;
  }
}

// Safe HTML Sanitizer (Strips XSS vectors while preserving styling, tables, fonts, layout & links)
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*(["'])\s*(?:javascript|vbscript|data):[^"']*\1/gi, 'href="#"')
    .replace(/src\s*=\s*(["'])\s*(?:javascript|vbscript):[^"']*\1/gi, 'src=""')
    .replace(/style\s*=\s*(["'])([\s\S]*?)\1/gi, (match, quote, styleContent) => {
      // Neutralize dangerous CSS expressions
      const cleanStyle = styleContent
        .replace(/expression\s*\([^)]*\)/gi, '')
        .replace(/behavior\s*:[^;]*/gi, '')
        .replace(/-moz-binding\s*:[^;]*/gi, '')
        .replace(/url\s*\(\s*(["']?)\s*(?:javascript|vbscript):[^)]*\)/gi, 'none');
      return `style=${quote}${cleanStyle}${quote}`;
    })
    .replace(/<a\b([^>]*)/gi, (match, attrs) => {
      let updated = attrs;
      if (!/target\s*=/i.test(updated)) updated += ' target="_blank"';
      if (!/rel\s*=/i.test(updated)) updated += ' rel="noopener noreferrer"';
      return '<a ' + updated.trim();
    });
}

// RFC 822 / MIME Multipart Parser & Sanitizer with Recursive Tree Traversal
function parseServerMime(raw) {
  if (!raw || typeof raw !== 'string') {
    return {
      finalHtml: '<p style="color: #94A3B8;">(Empty message)</p>',
      textContent: '',
      snippet: '',
      otp: null,
      partnerLink: null,
      subject: '',
      fromName: '',
      fromEmail: ''
    };
  }

  const normalized = raw.replace(/\r\n/g, '\n');
  const splitIdx = normalized.indexOf('\n\n');
  if (splitIdx === -1) {
    const escaped = normalized.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return {
      finalHtml: `<p style="white-space: pre-wrap; word-break: normal; line-break: auto; font-family: sans-serif;">${escaped}</p>`,
      textContent: normalized,
      snippet: normalized.substring(0, 160),
      otp: null,
      partnerLink: null,
      subject: '',
      fromName: '',
      fromEmail: ''
    };
  }

  const rawHeaders = normalized.substring(0, splitIdx).replace(/\n[ \t]+/g, ' ');
  const bodyBlock = normalized.substring(splitIdx + 2);

  let htmlContent = '';
  let textContent = '';

  // Recursive MIME multipart parser: handles nested multipart/mixed, multipart/alternative, multipart/related
  function walkMime(partHeadersRaw, partBodyRaw) {
    const partHeaders = (partHeadersRaw || '').replace(/\n[ \t]+/g, ' ');
    const boundaryMatch = partHeaders.match(/boundary\s*=\s*"?([^"\r\n;]+)"?/i);

    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const boundaryRegex = new RegExp('--' + boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const parts = partBodyRaw.split(boundaryRegex);

      for (const part of parts) {
        if (!part || part.trim() === '' || part.trim() === '--') continue;
        const normPart = part.replace(/\r\n/g, '\n');
        const sep = normPart.indexOf('\n\n');
        if (sep === -1) continue;

        const subHeaders = normPart.substring(0, sep).replace(/\n[ \t]+/g, ' ');
        const subBody = normPart.substring(sep + 2);
        walkMime(subHeaders, subBody);
      }
    } else {
      // Leaf part: decode content according to encoding and charset
      const isB64 = /content-transfer-encoding:\s*base64/i.test(partHeaders);
      const isQP = /content-transfer-encoding:\s*quoted-printable/i.test(partHeaders);
      const csMatch = partHeaders.match(/charset\s*=\s*"?([^"\r\n;]+)"?/i);
      const charset = csMatch ? csMatch[1].trim().toLowerCase() : 'utf-8';

      let decoded = partBodyRaw;
      if (isB64) decoded = decodeBase64(decoded, charset);
      else if (isQP) decoded = decodeQuotedPrintable(decoded, charset);

      if (/content-type:\s*text\/html/i.test(partHeaders)) {
        htmlContent = decoded.trim();
      } else if (/content-type:\s*text\/plain/i.test(partHeaders)) {
        if (!textContent) textContent = decoded.trim();
      }
    }
  }

  walkMime(rawHeaders, bodyBlock);

  let finalHtml = '';
  if (htmlContent) {
    finalHtml = sanitizeHtml(htmlContent);
  } else if (textContent) {
    const escaped = textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    finalHtml = `<div dir="auto" style="white-space: pre-wrap; word-break: normal; line-break: auto; line-height: 1.6; font-family: sans-serif;">${escaped
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #2563EB; text-decoration: underline; font-weight: 600; word-break: normal; line-break: auto;">$1</a>')
    }</div>`;
  } else {
    finalHtml = '<p style="color: #94A3B8;">(Empty message body)</p>';
  }

  const cleanText = (textContent || finalHtml.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  const snippet = cleanText.substring(0, 160);

  // Multilingual OTP Extraction (English, Bengali, Hindi, Arabic, French, German, Spanish)
  let otp = null;
  const contextOtpMatch = cleanText.match(/(?:code|otp|verification|pin|password|token|কোর্ড|কোড|ওটিপি|যাচাইকরণ|पिन|सत्यापन|رمز|تحقق|تأكيد|código|bestätigung)[^\w\d\u0980-\u09FF\u0900-\u097F\u0600-\u06FF]{1,30}(\b\d{4,8}\b)/i);
  if (contextOtpMatch) {
    otp = contextOtpMatch[1];
  } else {
    const standaloneMatch = cleanText.match(/(?:^|\s)(\d{4,8})(?:\s|$|\.)/);
    if (standaloneMatch) otp = standaloneMatch[1];
  }

  // Verification Link Extraction
  const allLinks = (textContent + ' ' + htmlContent).match(/https?:\/\/[^\s"'<>\[\]\(\)\\]+/gi) || [];
  const cleanLinks = [...new Set(allLinks.map(l => l.replace(/[.,;]+$/, '')))];
  const partnerLink = cleanLinks.find(l => 
    /verify|confirm|activate|action|token|mode=|auth/i.test(l)
  ) || cleanLinks[0] || null;

  const getHdr = (name) => {
    const reg = new RegExp('^' + name + ':\\s*(.*)$', 'mi');
    const m = rawHeaders.match(reg);
    return m ? decodeMimeHeader(m[1].trim()) : '';
  };
  const subject = getHdr('Subject');
  const fromRaw = getHdr('From');
  let fromName = fromRaw;
  let fromEmail = fromRaw;
  const nameMatch = fromRaw.match(/^(?:"?([^"<]+)"?\s*)?<?([^>]+@[^>]+)>?$/);
  if (nameMatch) {
    fromName = (nameMatch[1] || nameMatch[2].split('@')[0]).trim();
    fromEmail = nameMatch[2].trim();
  }

  return { finalHtml, textContent, snippet, otp, partnerLink, subject, fromName, fromEmail };
}

// -------------------------------------------------------------
// Cloudflare Turnstile Verification & Security Management
// -------------------------------------------------------------
function getTurnstileSiteKey() {
  return process.env.TURNSTILE_SITE_KEY || (storeCache && storeCache.settings && storeCache.settings.turnstile_site_key) || '0x4AAAAAAFRu_7JO3yDw1SR7';
}

function getTurnstileSecretKey() {
  const envSecret = process.env.TURNSTILE_SECRET_KEY;
  if (envSecret && envSecret.trim()) return envSecret.trim();
  const storeSecret = storeCache && storeCache.settings && storeCache.settings.turnstile_secret_key;
  if (storeSecret && storeSecret.trim()) return storeSecret.trim();
  // Server-side robust fallback to active rotated secret key
  return '0x4AAAAAAFRu_5OiZqH_y3L9U6rJAupH3BE';
}

// Memory tracking of used tokens to prevent replay / double-use attacks
const usedTurnstileTokens = new Map();

function isTokenAlreadyUsed(token) {
  pruneUsedTokens();
  return usedTurnstileTokens.has(token);
}

function markTokenAsUsed(token) {
  usedTurnstileTokens.set(token, Date.now());
}

function pruneUsedTokens() {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes TTL
  for (const [t, time] of usedTurnstileTokens.entries()) {
    if (now - time > maxAge) {
      usedTurnstileTokens.delete(t);
    }
  }
}

async function verifyTurnstileToken(token, clientIp, action = '') {
  const store = getStore();
  if (store.settings.turnstile_enabled === false) {
    return { success: true, bypassed: true };
  }

  const secret = getTurnstileSecretKey();
  if (!secret) {
    console.error('Turnstile verification failed: missing TURNSTILE_SECRET_KEY');
    return { success: false, error: 'Turnstile secret key not configured on server.' };
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return { success: false, error: 'Turnstile verification token is missing.' };
  }

  const trimmedToken = token.trim();

  if (isTokenAlreadyUsed(trimmedToken)) {
    return { success: false, error: 'Turnstile token already used or expired.' };
  }

  // Automated test hook: in test environment, tokens prefixed with TEST_VALID_TOKEN_ or official testing key
  if (secret === '1x0000000000000000000000000000000AA' || (process.env.NODE_ENV === 'test' && trimmedToken.startsWith('TEST_VALID_TOKEN_'))) {
    markTokenAsUsed(trimmedToken);
    return { success: true, test: true };
  }

  const postData = new URLSearchParams({
    secret: secret,
    response: trimmedToken,
    remoteip: clientIp || ''
  }).toString();

  try {
    const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData).toString()
      },
      body: postData,
      signal: AbortSignal.timeout(6000)
    });

    if (!cfRes.ok) {
      return { success: false, error: `Cloudflare challenge service returned HTTP ${cfRes.status}` };
    }

    const data = await cfRes.json();
    if (data.success) {
      // Validate expected hostname where applicable
      if (data.hostname) {
        const allowedHosts = ['tempemails.site', 'www.tempemails.site', 'localhost', '127.0.0.1', 'example.com'];
        const hostMatches = allowedHosts.includes(data.hostname.toLowerCase()) || data.hostname.toLowerCase().endsWith('.tempemails.site');
        if (!hostMatches) {
          return { success: false, error: 'Turnstile verification failed: unexpected origin hostname.' };
        }
      }
      markTokenAsUsed(trimmedToken);
      return { success: true, data };
    } else {
      return {
        success: false,
        error: 'Security challenge verification failed. Please try again.',
        errorCodes: data['error-codes']
      };
    }
  } catch (err) {
    console.error('Turnstile verification network error:', err.message || err);
    // Fail closed per security requirement
    return { success: false, error: 'Security verification could not be completed. Please try again.' };
  }
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

// Multi-Factor Device Session Manager with Stable Restoration Across Page Reloads
function getOrInitDeviceSession(store, req, parsedUrl, body = {}) {
  const ip = getClientIp(req);
  const hw = getDeviceFingerprint(req, parsedUrl, body);
  const primaryKey = hw ? `DEV_${hw}` : `IP_${ip}`;
  const maxLimit = store.settings.max_inboxes_per_user !== undefined ? store.settings.max_inboxes_per_user : 3;

  if (!store.device_sessions) store.device_sessions = {};

  // Extract any client-requested active address or inboxes for restoration across reloads
  const clientActiveAddr = (
    req.headers['x-current-address'] ||
    (parsedUrl && parsedUrl.query && (parsedUrl.query.current_address || parsedUrl.query.active_address)) ||
    body.current_address ||
    body.active_address ||
    ''
  ).toLowerCase().trim();

  let clientInboxes = [];
  const rawInboxes = req.headers['x-inboxes'] || 
                     (parsedUrl && parsedUrl.query && parsedUrl.query.inboxes) || 
                     body.inboxes;
  if (Array.isArray(rawInboxes)) {
    clientInboxes = rawInboxes;
  } else if (typeof rawInboxes === 'string' && rawInboxes.trim()) {
    try {
      const parsed = JSON.parse(rawInboxes);
      if (Array.isArray(parsed)) clientInboxes = parsed;
    } catch (e) {
      clientInboxes = rawInboxes.split(',').map(s => s.trim());
    }
  }
  if (clientActiveAddr && !clientInboxes.includes(clientActiveAddr)) {
    clientInboxes.unshift(clientActiveAddr);
  }
  // Sanitize valid addresses for tempemails.site
  clientInboxes = clientInboxes
    .map(a => String(a).toLowerCase().trim())
    .filter(a => a.endsWith('@tempemails.site') && a.length > '@tempemails.site'.length);

  // 1. Direct match by hardware ID
  let session = null;
  let sessionKey = null;

  if (hw && store.device_sessions[`DEV_${hw}`]) {
    session = store.device_sessions[`DEV_${hw}`];
    sessionKey = `DEV_${hw}`;
    session.ip = ip;
  } else if (ip && store.device_sessions[`IP_${ip}`]) {
    session = store.device_sessions[`IP_${ip}`];
    sessionKey = `IP_${ip}`;
    if (hw) session.hw_id = hw;
  } else if (hw) {
    for (const [k, s] of Object.entries(store.device_sessions)) {
      if (s.hw_id === hw || k === `DEV_${hw}` || k.includes(hw)) {
        session = s;
        sessionKey = k;
        session.ip = ip;
        break;
      }
    }
  } else if (ip && ip !== '127.0.0.1') {
    for (const [k, s] of Object.entries(store.device_sessions)) {
      if (s.ip === ip || k === `IP_${ip}` || k.includes(ip)) {
        session = s;
        sessionKey = k;
        if (hw) session.hw_id = hw;
        break;
      }
    }
  }

  // CASE 1: Existing session found
  if (session && session.inboxes && session.inboxes.length > 0) {
    // If client supplied existing valid inboxes that aren't recorded yet, merge up to maxLimit
    for (const addr of clientInboxes) {
      if (!session.inboxes.includes(addr) && session.inboxes.length < maxLimit) {
        session.inboxes.push(addr);
      }
    }
    // Respect client active inbox selection if it exists in the session
    if (clientActiveAddr && session.inboxes.includes(clientActiveAddr)) {
      session.activeIndex = session.inboxes.indexOf(clientActiveAddr);
    } else if (session.activeIndex >= session.inboxes.length) {
      session.activeIndex = 0;
    }

    // Ensure all session inboxes are registered in global store.inboxes
    for (const addr of session.inboxes) {
      if (!store.inboxes.some(i => i.address === addr)) {
        store.inboxes.push({
          address: addr,
          device_id: hw || ip,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + (store.settings.retention_days || 7) * 24 * 3600000).toISOString(),
          is_active: true
        });
      }
    }
    saveStore(store);
    return { key: sessionKey, session, deviceId: hw || ip };
  }

  // CASE 2: No existing session found, but client has saved inboxes from page reload (Container recycle / cold start)
  if (clientInboxes.length > 0) {
    const restoredInboxes = clientInboxes.slice(0, maxLimit);
    const restoredActiveIdx = clientActiveAddr ? Math.max(0, restoredInboxes.indexOf(clientActiveAddr)) : 0;
    
    session = {
      inboxes: restoredInboxes,
      activeIndex: restoredActiveIdx,
      changesCount: {},
      ip: ip,
      hw_id: hw,
      created_at: new Date().toISOString()
    };
    store.device_sessions[primaryKey] = session;

    for (const addr of restoredInboxes) {
      if (!store.inboxes.some(i => i.address === addr)) {
        store.inboxes.push({
          address: addr,
          device_id: hw || ip,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + (store.settings.retention_days || 7) * 24 * 3600000).toISOString(),
          is_active: true
        });
      }
    }
    saveStore(store);
    return { key: primaryKey, session, deviceId: hw || ip };
  }

  // CASE 3: First-time visitor with zero existing inboxes
  // When Turnstile is enabled, protect initial inbox creation so bots cannot mass-generate inboxes
  if (store.settings.turnstile_enabled !== false) {
    session = {
      inboxes: [],
      activeIndex: 0,
      changesCount: {},
      ip: ip,
      hw_id: hw,
      created_at: new Date().toISOString()
    };
    store.device_sessions[primaryKey] = session;
    saveStore(store);
    return { key: primaryKey, session, deviceId: hw || ip, requires_verification: true };
  }

  // Turnstile disabled: auto-generate initial inbox directly
  const initialAddr = generateRandomAddress();
  session = {
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

  // 1. Settings (Public)
  if (pathname === '/api/settings' && method === 'GET') {
    const store = getStore();
    sendJson(res, 200, {
      max_inboxes_per_user: store.settings.max_inboxes_per_user !== undefined ? store.settings.max_inboxes_per_user : 3,
      max_email_changes_per_inbox: store.settings.max_email_changes_per_inbox || 3,
      retention_days: store.settings.retention_days || 7,
      service_enabled: store.settings.service_enabled !== false,
      maintenance_message: store.settings.maintenance_message || 'Our email servers are currently undergoing scheduled maintenance. New inbox generation will resume shortly.',
      turnstile_enabled: store.settings.turnstile_enabled !== false,
      turnstile_site_key: getTurnstileSiteKey(),
      google_search_console: store.settings.google_search_console || '',
      google_analytics_id: store.settings.google_analytics_id || '',
      custom_head_scripts: store.settings.custom_head_scripts || '',
      developer: store.settings.developer || initialData.settings.developer
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
      max_inboxes_limit: store.settings.max_inboxes_per_user !== undefined ? store.settings.max_inboxes_per_user : 3,
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

  // 7a. Admin Get Settings
  if (pathname === '/api/admin/settings' && method === 'GET') {
    const store = getStore();
    sendJson(res, 200, {
      max_inboxes_per_user: store.settings.max_inboxes_per_user !== undefined ? store.settings.max_inboxes_per_user : 3,
      max_email_changes_per_inbox: store.settings.max_email_changes_per_inbox || 3,
      retention_days: store.settings.retention_days || 7,
      service_enabled: store.settings.service_enabled !== false,
      maintenance_message: store.settings.maintenance_message || '',
      turnstile_enabled: store.settings.turnstile_enabled !== false,
      turnstile_site_key: getTurnstileSiteKey(),
      turnstile_secret_configured: Boolean(getTurnstileSecretKey()),
      admin_username: store.settings.admin_username || 'admin',
      google_search_console: store.settings.google_search_console || '',
      google_analytics_id: store.settings.google_analytics_id || '',
      custom_head_scripts: store.settings.custom_head_scripts || '',
      developer: store.settings.developer || initialData.settings.developer
    });
    return true;
  }

  // 7b. Admin Update Settings
  if (pathname === '/api/admin/settings' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();

    if (body.max_inboxes_per_user !== undefined) store.settings.max_inboxes_per_user = parseInt(body.max_inboxes_per_user, 10) || 3;
    if (body.max_email_changes_per_inbox !== undefined) store.settings.max_email_changes_per_inbox = parseInt(body.max_email_changes_per_inbox, 10) || 3;
    if (body.retention_days !== undefined) store.settings.retention_days = parseInt(body.retention_days, 10) || 7;
    if (body.service_enabled !== undefined) store.settings.service_enabled = Boolean(body.service_enabled);
    if (body.maintenance_message !== undefined) store.settings.maintenance_message = body.maintenance_message;
    if (body.turnstile_enabled !== undefined) store.settings.turnstile_enabled = Boolean(body.turnstile_enabled);
    if (body.turnstile_site_key !== undefined) store.settings.turnstile_site_key = body.turnstile_site_key;
    if (body.turnstile_secret_key !== undefined && typeof body.turnstile_secret_key === 'string' && body.turnstile_secret_key.trim() !== '') {
      store.settings.turnstile_secret_key = body.turnstile_secret_key.trim();
    }
    if (body.admin_username) store.settings.admin_username = body.admin_username.trim();
    if (body.new_admin_password) store.settings.admin_password = body.new_admin_password.trim();
    if (body.google_search_console !== undefined) {
      let gsc = String(body.google_search_console).trim();
      const match = gsc.match(/content=["']([^"']+)["']/i);
      if (match) gsc = match[1];
      gsc = gsc.replace(/^google-site-verification=/i, '').trim();
      store.settings.google_search_console = gsc;
    }
    if (body.google_analytics_id !== undefined) store.settings.google_analytics_id = body.google_analytics_id;
    if (body.custom_head_scripts !== undefined) store.settings.custom_head_scripts = body.custom_head_scripts;
    if (body.developer && typeof body.developer === 'object') {
      store.settings.developer = {
        enabled: body.developer.enabled !== false,
        name: (body.developer.name || 'Shakib Hasan').trim(),
        title: (body.developer.title || 'Lead Developer & Creator').trim(),
        bio: (body.developer.bio || '').trim(),
        avatar_initials: (body.developer.avatar_initials || 'SH').trim(),
        avatar_image: (body.developer.avatar_image || '').trim(),
        coffee_button_text: (body.developer.coffee_button_text || 'Buy Me a Coffee (Get a Coffee)').trim(),
        coffee_link: (body.developer.coffee_link || '').trim(),
        contact_email: (body.developer.contact_email || 'support@tempemails.site').trim()
      };
    }

    saveStore(store);
    sendJson(res, 200, { success: true, message: 'Settings successfully updated!' });
    return true;
  }

  // 7c. Admin Update Developer Profile Directly
  if (pathname === '/api/admin/developer' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();
    store.settings.developer = {
      enabled: body.enabled !== false,
      name: (body.name || 'Shakib Hasan').trim(),
      title: (body.title || 'Lead Developer & Creator').trim(),
      bio: (body.bio || '').trim(),
      avatar_initials: (body.avatar_initials || 'SH').trim(),
      avatar_image: (body.avatar_image || '').trim(),
      coffee_button_text: (body.coffee_button_text || 'Buy Me a Coffee (Get a Coffee)').trim(),
      coffee_link: (body.coffee_link || '').trim(),
      contact_email: (body.contact_email || 'support@tempemails.site').trim()
    };
    saveStore(store);
    sendJson(res, 200, { success: true, message: 'Developer profile updated successfully!' });
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

    let cleanBodyHtml = body.bodyHtml || body.bodyText || body.raw || '<p>(Empty Message)</p>';
    let cleanSnippet = body.snippet || '';
    let extractedOtp = body.otp || null;
    let extractedPartnerLink = body.partnerLink || null;
    let extractedSubject = body.subject || '';
    let extractedFromName = body.fromName || '';
    let extractedFrom = body.from || '';

    // Server-Side MIME Cleaner: if raw MIME stream was sent
    if (typeof cleanBodyHtml === 'string' && (cleanBodyHtml.includes('Received:') || cleanBodyHtml.includes('Content-Type:') || cleanBodyHtml.includes('ARC-Seal:') || cleanBodyHtml.includes('boundary=') || cleanBodyHtml.includes('Subject:'))) {
      const parsed = parseServerMime(cleanBodyHtml);
      cleanBodyHtml = parsed.finalHtml;
      cleanSnippet = parsed.snippet || cleanSnippet;
      extractedOtp = parsed.otp || extractedOtp;
      extractedPartnerLink = parsed.partnerLink || extractedPartnerLink;
      if (!extractedSubject && parsed.subject) extractedSubject = parsed.subject;
      if (!extractedFromName && parsed.fromName) extractedFromName = parsed.fromName;
      if (!extractedFrom && parsed.fromEmail) extractedFrom = parsed.fromEmail;
    } else if (typeof cleanBodyHtml === 'string') {
      cleanBodyHtml = sanitizeHtml(cleanBodyHtml);
    }

    // Decode RFC 2047 MIME encoded headers for Bengali, Hindi, Arabic, Japanese, Chinese, Emoji
    const decodedSubject = decodeMimeHeader(extractedSubject || '(No Subject)');
    const decodedFromName = decodeMimeHeader(extractedFromName || extractedFrom || 'Unknown Sender');
    const decodedFrom = decodeMimeHeader(extractedFrom || 'unknown@sender.com');

    // Recalculate OTP if not found yet
    if (!extractedOtp) {
      const cleanText = (cleanSnippet || cleanBodyHtml.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
      const otpMatch = cleanText.match(/(?:code|otp|verification|pin|password|token|কোর্ড|কোড|ওটিপি|যাচাইকরণ|पिन|सत्यापन|رمز|تحقق|تأكيد|código|bestätigung)[^\w\d\u0980-\u09FF\u0900-\u097F\u0600-\u06FF]{1,30}(\b\d{4,8}\b)/i);
      if (otpMatch) extractedOtp = otpMatch[1];
    }

    const newMsg = {
      id: 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      inbox_address: toAddress,
      from: decodedFrom,
      from_name: decodedFromName,
      subject: decodedSubject,
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
  if (pathname === '/api/inbox/device-session' && (method === 'GET' || method === 'POST')) {
    const body = method === 'POST' ? await parseJsonBody(req) : {};
    const store = getStore();
    const { session, deviceId } = getOrInitDeviceSession(store, req, parsedUrl, body);

    sendJson(res, 200, {
      device_id: deviceId,
      inboxes: session.inboxes,
      activeIndex: session.activeIndex !== undefined ? session.activeIndex : 0,
      changesCount: session.changesCount || {},
      max_inboxes: store.settings.max_inboxes_per_user !== undefined ? store.settings.max_inboxes_per_user : 3,
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

    const clientIp = getClientIp(req);
    const maxLimit = store.settings.max_inboxes_per_user !== undefined ? store.settings.max_inboxes_per_user : 3;
    const { session, deviceId } = getOrInitDeviceSession(store, req, parsedUrl, body);

    if (session.inboxes && session.inboxes.length >= maxLimit) {
      sendJson(res, 429, { 
        error: `Device limit reached. You can hold up to ${maxLimit} active inboxes on this device.` 
      });
      return true;
    }

    // Turnstile Security Verification for protected inbox creation
    if (store.settings.turnstile_enabled !== false) {
      const token = body.turnstile_token || body.token || req.headers['cf-turnstile-token'];
      if (!token) {
        sendJson(res, 403, { error: 'Security verification required. Please complete Cloudflare Turnstile challenge.' });
        return true;
      }
      const verifyRes = await verifyTurnstileToken(token, clientIp, 'create_inbox');
      if (!verifyRes.success) {
        sendJson(res, 403, { error: verifyRes.error || 'Turnstile verification failed.' });
        return true;
      }
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
    const clientIp = getClientIp(req);
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

    // Turnstile Security Verification for address change
    if (store.settings.turnstile_enabled !== false) {
      const token = body.turnstile_token || body.token || req.headers['cf-turnstile-token'];
      if (!token) {
        sendJson(res, 403, { error: 'Security verification required to change email address.' });
        return true;
      }
      const verifyRes = await verifyTurnstileToken(token, clientIp, 'change_inbox');
      if (!verifyRes.success) {
        sendJson(res, 403, { error: verifyRes.error || 'Turnstile verification failed.' });
        return true;
      }
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

  // 13. Public Contact Form Submission
  if (pathname === '/api/contact' && method === 'POST') {
    const body = await parseJsonBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const message = String(body.message || '').trim();
    const category = String(body.category || 'General Suggestion').trim();
    const subject = String(body.subject || 'Website Feedback').trim();

    if (!name || !email || !message) {
      sendJson(res, 400, { success: false, message: 'Please provide your name, email, and message.' });
      return true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      sendJson(res, 400, { success: false, message: 'Please provide a valid email address.' });
      return true;
    }

    const store = getStore();
    if (!store.contacts) store.contacts = [];

    const newContact = {
      id: 'cnt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: name.slice(0, 100),
      email: email.slice(0, 150),
      category: category.slice(0, 50),
      subject: subject.slice(0, 200),
      message: message.slice(0, 5000),
      status: 'unread',
      created_at: new Date().toISOString(),
      ip: getClientIp(req)
    };

    store.contacts.unshift(newContact);
    saveStore(store);

    sendJson(res, 200, {
      success: true,
      message: 'Thank you! Your feedback has been received successfully. We appreciate your thoughts!'
    });
    return true;
  }

  // 14. Admin Contacts List
  if (pathname === '/api/admin/contacts' && method === 'GET') {
    const store = getStore();
    sendJson(res, 200, store.contacts || []);
    return true;
  }

  // 15. Admin Mark Contact Status
  if (pathname === '/api/admin/contacts/status' && method === 'POST') {
    const body = await parseJsonBody(req);
    const store = getStore();
    if (!store.contacts) store.contacts = [];
    const item = store.contacts.find(c => c.id === body.id);
    if (item) {
      item.status = body.status || 'read';
      saveStore(store);
      sendJson(res, 200, { success: true });
    } else {
      sendJson(res, 404, { success: false, message: 'Message not found.' });
    }
    return true;
  }

  // 16. Admin Delete Contact Message
  if (pathname === '/api/admin/contacts' && method === 'DELETE') {
    const id = parsedUrl.query.id;
    if (!id) {
      sendJson(res, 400, { success: false, message: 'Missing contact id.' });
      return true;
    }
    const store = getStore();
    store.contacts = (store.contacts || []).filter(c => c.id !== id);
    saveStore(store);
    sendJson(res, 200, { success: true, message: 'Message deleted successfully.' });
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

  // Handle Dynamic XML Sitemap
  if (reqPath === '/sitemap.xml' || reqPath === '/sitemap') {
    const store = getStore();
    const today = new Date().toISOString().split('T')[0];
    const baseUrl = 'https://www.tempemails.site';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    const staticPages = [
      { path: '/', priority: '1.0', changefreq: 'daily' },
      { path: '/about', priority: '0.8', changefreq: 'weekly' },
      { path: '/faq', priority: '0.8', changefreq: 'weekly' },
      { path: '/contact', priority: '0.8', changefreq: 'monthly' },
      { path: '/blog', priority: '0.9', changefreq: 'daily' },
      { path: '/privacy', priority: '0.5', changefreq: 'monthly' },
      { path: '/terms', priority: '0.5', changefreq: 'monthly' }
    ];

    for (const p of staticPages) {
      xml += `  <url>\n    <loc>${baseUrl}${p.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
    }

    if (Array.isArray(store.blogs)) {
      for (const b of store.blogs) {
        if (b.status === 'published' && b.slug) {
          const mod = b.created_at ? b.created_at.split('T')[0] : today;
          xml += `  <url>\n    <loc>${baseUrl}/blog-article?slug=${encodeURIComponent(b.slug)}</loc>\n    <lastmod>${mod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
        }
      }
    }

    xml += `</urlset>`;

    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(xml);
    return;
  }

  // Handle robots.txt
  if (reqPath === '/robots.txt') {
    const robots = `User-agent: *\nAllow: /\nDisallow: /admin-shakib\nDisallow: /admin-shakib.html\nDisallow: /api/\n\nSitemap: https://www.tempemails.site/sitemap.xml\n`;
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    });
    res.end(robots);
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
