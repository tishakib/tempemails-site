/**
 * tempemails.site - Client Application
 * Handles 5-Email Slots, Gmail-style Inbox, OTP Extraction, and Real-time Refresh
 */

// Configuration
const CONFIG = {
  DOMAIN: 'tempemails.site',
  MAX_INBOXES: 7,
  MAX_CHANGES: 3, // Allowed changes per address
  REFRESH_INTERVAL: 15, // seconds
  STORAGE_KEY_INBOXES: 'tempemails_slots_v1',
  STORAGE_KEY_ACTIVE: 'tempemails_active_index_v1',
  STORAGE_KEY_MESSAGES: 'tempemails_messages_v1',
  STORAGE_KEY_CHANGES: 'tempemails_changes_count_v1',
  API_ENDPOINT: '/api' // Ready for Cloudflare Worker hookup
};

// Initial Sample Demo Emails for Rich Interactive Experience
const DEMO_EMAILS = [
  {
    id: 'msg-101',
    from: 'Twitter / X Security <verify@x.com>',
    fromName: 'Twitter / X Security',
    to: '', // populated dynamically
    subject: 'Your confirmation code is 849201',
    snippet: 'Confirm your email address. Use this code to complete verification: 849201. This code expires in 10 minutes.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #111;">
        <h2 style="color: #0F172A; font-size: 22px; margin-bottom: 8px;">Confirm your email address</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.5;">There's one quick step you need to complete before creating your account. Please enter this verification code:</p>
        <div style="background: #FFF5F5; border: 2px dashed #F4413D; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #F4413D;">849201</span>
        </div>
        <p style="color: #64748B; font-size: 13px;">Verification codes expire after 10 minutes. If you did not request this, please disregard this email.</p>
      </div>
    `,
    otp: '849201',
    partnerLink: null,
    isUnread: true,
    isStarred: true,
    receivedAt: 'Just now',
    timestamp: Date.now() - 60000
  },
  {
    id: 'msg-102',
    from: 'Discord Notifications <noreply@discord.com>',
    fromName: 'Discord',
    to: '',
    subject: 'Verify your email address for Discord',
    snippet: 'Hey! Thanks for registering an account on Discord. Before we can get started, we need you to verify your email.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #111;">
        <h2 style="color: #5865F2; font-size: 22px;">Verify your Discord account</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.5;">Thanks for signing up! Click the button below to verify your email address:</p>
        <div style="margin: 24px 0;">
          <a href="https://discord.com/verify?token=demo123" target="_blank" style="display: inline-block; background: #5865F2; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Verify Email</a>
        </div>
      </div>
    `,
    otp: null,
    partnerLink: 'https://discord.com/verify?token=demo123',
    isUnread: true,
    isStarred: false,
    receivedAt: '5 min ago',
    timestamp: Date.now() - 300000
  },
  {
    id: 'msg-103',
    from: 'tempemails.site Team <support@tempemails.site>',
    fromName: 'tempemails.site',
    to: '',
    subject: 'Welcome to tempemails.site! Your 100% Free Disposable Inbox',
    snippet: 'Welcome to your anonymous temporary inbox! Protect your personal email from spam, newsletters, and trackers.',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #111;">
        <h2 style="color: #F4413D; font-size: 22px;">Welcome to tempemails.site! 🎉</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">You now have a secure, private, disposable email address. All incoming emails are processed in real-time and will automatically expire.</p>
        <ul style="color: #475569; line-height: 1.8; margin: 16px 0 20px 20px;">
          <li>🛡️ <strong>Zero Spam:</strong> Protect your real inbox from leaks.</li>
          <li>⚡ <strong>Up to 5 inboxes:</strong> Manage up to 5 concurrent addresses simultaneously.</li>
          <li>🔑 <strong>Instant OTP Extraction:</strong> Copy verification codes in one single click.</li>
        </ul>
      </div>
    `,
    otp: null,
    partnerLink: null,
    isUnread: false,
    isStarred: false,
    receivedAt: '15 min ago',
    timestamp: Date.now() - 900000
  }
];

// App State
const state = {
  inboxes: [],
  activeIndex: 0,
  messages: {}, // keyed by email address
  changesCount: {}, // keyed by index or address
  countdown: CONFIG.REFRESH_INTERVAL,
  timerInterval: null,
  activeMessageId: null,
  filterStarredOnly: false
};

// Generate Random Clean Username
function generateRandomUsername() {
  const adjectives = ['swift', 'quick', 'hyper', 'apex', 'bold', 'zen', 'prime', 'nova', 'cyber', 'pure', 'cool', 'flash', 'star'];
  const nouns = ['inbox', 'pilot', 'falcon', 'tiger', 'orbit', 'wave', 'storm', 'shield', 'echo', 'guard', 'vortex', 'spark'];
  const num = Math.floor(100 + Math.random() * 900);
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}.${noun}${num}`;
}

// Initialize Application
async function initApp() {
  loadStateFromStorage();

  // Fetch dynamic system settings from backend
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      if (data.max_inboxes_per_user) {
        CONFIG.MAX_INBOXES = data.max_inboxes_per_user;
      }
      if (data.max_email_changes_per_inbox) {
        CONFIG.MAX_CHANGES = data.max_email_changes_per_inbox;
      }
      if (data.service_enabled === false) {
        showToast('Notice: Service is currently in maintenance mode.', 'warning');
        const overlay = document.getElementById('maintenance-overlay');
        const overlayText = document.getElementById('maintenance-overlay-text');
        if (overlay) overlay.classList.remove('hidden');
        if (overlayText && data.maintenance_message) {
          overlayText.textContent = data.maintenance_message;
        }
      } else {
        const overlay = document.getElementById('maintenance-overlay');
        if (overlay) overlay.classList.add('hidden');
      }

      // Update Dynamic Policy Display Card
      const policyRetention = document.getElementById('policy-retention-days');
      const policyMaxInboxes = document.getElementById('policy-max-inboxes');
      const policyMaxChanges = document.getElementById('policy-max-changes');
      if (policyRetention) policyRetention.textContent = `${data.retention_days || 7} Days`;
      if (policyMaxInboxes) policyMaxInboxes.textContent = data.max_inboxes_per_user || 7;
      if (policyMaxChanges) policyMaxChanges.textContent = data.max_email_changes_per_inbox || 3;

      // Handle Turnstile Visibility
      if (data.turnstile_enabled === false) {
        const turnstileWrap = document.getElementById('turnstile-wrapper');
        if (turnstileWrap) turnstileWrap.classList.add('hidden');
      }

      // Inject Google Search Console if provided
      if (data.google_search_console && !document.querySelector('meta[name="google-site-verification"]')) {
        const meta = document.createElement('meta');
        meta.name = 'google-site-verification';
        meta.content = data.google_search_console;
        document.head.appendChild(meta);
      }
    }
  } catch (err) {
    console.log('Running in offline/local mode');
  }
  
  // If no inboxes, create the initial first inbox
  if (state.inboxes.length === 0) {
    const firstEmail = `${generateRandomUsername()}@${CONFIG.DOMAIN}`;
    state.inboxes.push(firstEmail);
    state.activeIndex = 0;
    
    // Seed demo emails for the first inbox
    state.messages[firstEmail] = DEMO_EMAILS.map(e => ({ ...e, to: firstEmail }));
    saveStateToStorage();
  }

  // Ensure active index is within bounds
  if (state.activeIndex >= state.inboxes.length) {
    state.activeIndex = 0;
  }

  renderApp();
  startRefreshTimer();
}

// LocalStorage Persistence
function loadStateFromStorage() {
  try {
    const savedInboxes = localStorage.getItem(CONFIG.STORAGE_KEY_INBOXES);
    const savedActive = localStorage.getItem(CONFIG.STORAGE_KEY_ACTIVE);
    const savedMessages = localStorage.getItem(CONFIG.STORAGE_KEY_MESSAGES);
    const savedChanges = localStorage.getItem(CONFIG.STORAGE_KEY_CHANGES);

    if (savedInboxes) state.inboxes = JSON.parse(savedInboxes);
    if (savedActive) state.activeIndex = parseInt(savedActive, 10) || 0;
    if (savedMessages) state.messages = JSON.parse(savedMessages);
    if (savedChanges) state.changesCount = JSON.parse(savedChanges);
  } catch (err) {
    console.error('Storage parse error:', err);
  }
}

function saveStateToStorage() {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEY_INBOXES, JSON.stringify(state.inboxes));
    localStorage.setItem(CONFIG.STORAGE_KEY_ACTIVE, state.activeIndex.toString());
    localStorage.setItem(CONFIG.STORAGE_KEY_MESSAGES, JSON.stringify(state.messages));
    localStorage.setItem(CONFIG.STORAGE_KEY_CHANGES, JSON.stringify(state.changesCount));
  } catch (err) {
    console.error('Storage save error:', err);
  }
}

// Current Active Email Getter
function getActiveEmail() {
  return state.inboxes[state.activeIndex] || '';
}

// Get Messages for Active Email
function getActiveMessages() {
  const current = getActiveEmail();
  return state.messages[current] || [];
}

// Render Main App
function renderApp() {
  renderSlotTabs();
  renderEmailBox();
  renderInboxView();
}

// 1. Render Top Slot Selector Tabs (5-Email Limit System)
function renderSlotTabs() {
  const container = document.getElementById('slot-tabs-container');
  if (!container) return;

  const count = state.inboxes.length;
  const isMaxReached = count >= CONFIG.MAX_INBOXES;

  let html = `
    <div class="flex items-center justify-between w-full mb-3 flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <svg class="w-4 h-4 text-[#F4413D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Active Inboxes
        </span>
        <span class="px-2 py-0.5 text-xs font-bold rounded-full ${isMaxReached ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-[#F4413D]'}">
          ${count}/${CONFIG.MAX_INBOXES} Used
        </span>
      </div>
      <div class="text-xs text-slate-400">
        ${isMaxReached ? `⚠️ Max ${CONFIG.MAX_INBOXES} inboxes limit reached` : `You can create up to ${CONFIG.MAX_INBOXES} concurrent inboxes`}
      </div>
    </div>

    <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none w-full">
  `;

  // Render each active inbox slot
  state.inboxes.forEach((email, idx) => {
    const isActive = idx === state.activeIndex;
    const msgs = state.messages[email] || [];
    const unreadCount = msgs.filter(m => m.isUnread).length;

    html += `
      <div class="flex items-center group shrink-0">
        <button 
          onclick="selectInbox(${idx})"
          class="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
            isActive 
              ? 'bg-[#F4413D] text-white shadow-md shadow-red-500/20 ring-2 ring-red-400/30' 
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-sm'
          }">
          <span class="w-2 h-2 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-slate-300'}"></span>
          <span class="font-mono truncate max-w-[130px] md:max-w-[160px]">${email.split('@')[0]}</span>
          ${unreadCount > 0 ? `
            <span class="px-1.5 py-0.2 text-[10px] font-bold rounded-full ${isActive ? 'bg-white text-[#F4413D]' : 'bg-[#F4413D] text-white'}">
              ${unreadCount}
            </span>
          ` : ''}
        </button>
        ${count > 1 ? `
          <button 
            onclick="deleteInboxSlot(${idx}, event)" 
            title="Delete this inbox"
            class="p-1.5 -ml-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ` : ''}
      </div>
    `;
  });

  // "+ Add New Inbox" Button (Disabled if 5 slots filled)
  if (!isMaxReached) {
    html += `
      <button 
        onclick="addNewInboxSlot()" 
        class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs md:text-sm font-semibold border-2 border-dashed border-red-300 text-[#F4413D] hover:bg-red-50/70 hover:border-[#F4413D] transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
        </svg>
        <span>New Inbox</span>
      </button>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

// 2. Render Main Current Email Display Card
function renderEmailBox() {
  const currentEmailEl = document.getElementById('current-email-text');
  if (currentEmailEl) {
    currentEmailEl.textContent = getActiveEmail();
  }

  // Update Change button with remaining limit
  const current = getActiveEmail();
  const maxChanges = CONFIG.MAX_CHANGES || 3;
  const used = state.changesCount[current] || 0;
  const remaining = Math.max(0, maxChanges - used);

  const changeBtn = document.getElementById('btn-change-email');
  const changeText = document.getElementById('btn-change-text');
  if (changeText) {
    changeText.textContent = remaining > 0 ? `Change (${remaining})` : 'Limit Reached';
  }
  if (changeBtn) {
    if (remaining <= 0) {
      changeBtn.classList.add('opacity-50', 'cursor-not-allowed');
      changeBtn.title = 'Maximum changes reached for this address';
    } else {
      changeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      changeBtn.title = `Generate new address (${remaining} changes left)`;
    }
  }
}

// Switch Active Inbox
window.selectInbox = function(index) {
  if (index >= 0 && index < state.inboxes.length) {
    state.activeIndex = index;
    state.activeMessageId = null; // Close message view if open
    saveStateToStorage();
    renderApp();
    showToast(`Switched to inbox #${index + 1}`, 'info');
  }
};

// Add New Inbox Slot (Up to dynamic max limit)
window.addNewInboxSlot = function() {
  if (state.inboxes.length >= CONFIG.MAX_INBOXES) {
    showToast(`Maximum ${CONFIG.MAX_INBOXES} inboxes limit reached!`, 'warning');
    return;
  }

  const newEmail = `${generateRandomUsername()}@${CONFIG.DOMAIN}`;
  state.inboxes.push(newEmail);
  state.activeIndex = state.inboxes.length - 1; // switch to newly created
  state.activeMessageId = null;

  // Add sample welcome email for new inbox
  state.messages[newEmail] = [
    {
      id: 'msg-' + Date.now(),
      from: 'tempemails.site Team <support@tempemails.site>',
      fromName: 'tempemails.site Team',
      to: newEmail,
      subject: `Your new disposable inbox: ${newEmail.split('@')[0]}`,
      snippet: 'This new temporary address is active and ready to receive emails.',
      bodyHtml: `<p style="font-family: Arial; color: #334155;">Your new inbox <strong>${newEmail}</strong> is active. You can receive verification codes, OTPs, and downloads here.</p>`,
      otp: null,
      isUnread: true,
      isStarred: false,
      receivedAt: 'Just now',
      timestamp: Date.now()
    }
  ];

  saveStateToStorage();
  renderApp();
  showToast('New inbox created successfully!', 'success');
};

// Delete an Inbox Slot
window.deleteInboxSlot = function(index, e) {
  if (e) e.stopPropagation();
  if (state.inboxes.length <= 1) {
    showToast('You must keep at least 1 active inbox.', 'warning');
    return;
  }

  const removedEmail = state.inboxes[index];
  state.inboxes.splice(index, 1);
  delete state.messages[removedEmail];
  delete state.changesCount[removedEmail];

  if (state.activeIndex >= state.inboxes.length) {
    state.activeIndex = state.inboxes.length - 1;
  }

  state.activeMessageId = null;
  saveStateToStorage();
  renderApp();
  showToast('Inbox removed. Slot freed up!', 'info');
};

// Randomize / Change Current Active Email (Respects Change Limit)
window.randomizeCurrentEmail = function() {
  const current = getActiveEmail();
  const maxChanges = CONFIG.MAX_CHANGES || 3;
  const used = state.changesCount[current] || 0;

  if (used >= maxChanges) {
    showToast(`Maximum ${maxChanges} address changes reached for this inbox.`, 'warning');
    return;
  }

  const newEmail = `${generateRandomUsername()}@${CONFIG.DOMAIN}`;
  state.inboxes[state.activeIndex] = newEmail;
  delete state.messages[current];
  delete state.changesCount[current];
  state.changesCount[newEmail] = used + 1;
  state.messages[newEmail] = [];
  state.activeMessageId = null;

  saveStateToStorage();
  renderApp();
  const remaining = maxChanges - (used + 1);
  showToast(`Email changed! (${remaining} change${remaining === 1 ? '' : 's'} remaining)`, 'success');
};

// 1-Click Copy Email to Clipboard
window.copyCurrentEmail = function() {
  const email = getActiveEmail();
  if (!email) return;

  navigator.clipboard.writeText(email).then(() => {
    showToast('Copied to clipboard! 📋', 'success');

    // Visual button feedback
    const btn = document.getElementById('btn-copy-email');
    if (btn) {
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `
        <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
        <span class="text-emerald-600 font-bold">Copied!</span>
      `;
      setTimeout(() => {
        btn.innerHTML = originalHtml;
      }, 2000);
    }
  }).catch(() => {
    showToast('Failed to copy. Please select and copy manually.', 'warning');
  });
};

// Copy OTP Code
window.copyOtpCode = function(otp) {
  if (!otp) return;
  navigator.clipboard.writeText(otp).then(() => {
    showToast(`OTP Code [${otp}] copied! 🔑`, 'success');
  });
};

// 3. Render Inbox / Message List (Gmail Style)
function renderInboxView() {
  const listContainer = document.getElementById('inbox-messages-container');
  const readerContainer = document.getElementById('message-reader-container');
  if (!listContainer || !readerContainer) return;

  const messages = getActiveMessages();

  // If a specific message is opened, display reading pane
  if (state.activeMessageId) {
    const msg = messages.find(m => m.id === state.activeMessageId);
    if (msg) {
      listContainer.classList.add('hidden');
      readerContainer.classList.remove('hidden');
      renderMessageDetail(msg, readerContainer);
      return;
    }
  }

  // Otherwise show message list view
  listContainer.classList.remove('hidden');
  readerContainer.classList.add('hidden');

  const filteredMessages = state.filterStarredOnly 
    ? messages.filter(m => m.isStarred) 
    : messages;

  const unreadCount = messages.filter(m => m.isUnread).length;
  const countBadge = document.getElementById('inbox-count-badge');
  if (countBadge) {
    countBadge.textContent = `${unreadCount} unread`;
  }

  if (filteredMessages.length === 0) {
    listContainer.innerHTML = `
      <div class="py-16 px-4 text-center">
        <div class="w-20 h-20 mx-auto mb-4 bg-red-50 text-[#F4413D] rounded-2xl flex items-center justify-center pulse-glow">
          <svg class="w-10 h-10 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h4 class="text-base font-bold text-slate-800 mb-1">Waiting for incoming emails...</h4>
        <p class="text-sm text-slate-500 max-w-sm mx-auto mb-5">Send an email to <span class="font-mono font-semibold text-slate-700">${getActiveEmail()}</span> and it will appear here automatically.</p>
        <button onclick="simulateIncomingEmail()" class="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#F4413D] bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Send Test Simulation Email
        </button>
      </div>
    `;
    return;
  }

  // Render Gmail-style Table/List
  let html = `
    <div class="divide-y divide-slate-100">
  `;

  filteredMessages.forEach(msg => {
    html += `
      <div 
        onclick="openMessage('${msg.id}')"
        class="gmail-row ${msg.isUnread ? 'unread' : 'read'} flex items-center py-3.5 px-4 cursor-pointer select-none group border-b border-slate-100">
        
        <!-- Left: Star & Selection -->
        <div class="flex items-center gap-2 mr-3 shrink-0" onclick="event.stopPropagation()">
          <button 
            onclick="toggleStar('${msg.id}', event)" 
            class="text-slate-300 hover:text-amber-400 p-1 transition-colors ${msg.isStarred ? 'text-amber-400' : ''}">
            <svg class="w-4 h-4 ${msg.isStarred ? 'fill-current' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        </div>

        <!-- Sender Column -->
        <div class="w-36 md:w-48 shrink-0 truncate pr-2">
          <span class="text-sm ${msg.isUnread ? 'font-bold text-slate-900' : 'font-normal text-slate-700'}">${msg.fromName || msg.from}</span>
        </div>

        <!-- Subject & Snippet Column -->
        <div class="flex-1 min-w-0 pr-4 flex items-center gap-2 truncate">
          <span class="text-sm ${msg.isUnread ? 'font-semibold text-slate-900' : 'text-slate-700'} truncate">
            ${msg.subject}
          </span>
          <span class="text-sm text-slate-400 truncate hidden sm:inline">
            - ${msg.snippet}
          </span>

          ${msg.otp ? `
            <span class="shrink-0 px-2 py-0.5 text-[11px] font-bold bg-red-100 text-[#F4413D] rounded border border-red-200">
              OTP: ${msg.otp}
            </span>
          ` : ''}
        </div>

        <!-- Right Side: Date OR Hover Action Icons -->
        <div class="shrink-0 text-right">
          <!-- Date (shown by default) -->
          <span class="row-date text-xs text-slate-400 font-medium whitespace-nowrap">
            ${msg.receivedAt}
          </span>

          <!-- Hover Actions (shown on mouseover) -->
          <div class="hover-actions items-center gap-1" onclick="event.stopPropagation()">
            <button 
              onclick="toggleReadStatus('${msg.id}', event)" 
              title="${msg.isUnread ? 'Mark as read' : 'Mark as unread'}"
              class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5" />
              </svg>
            </button>
            <button 
              onclick="deleteSingleMessage('${msg.id}', event)" 
              title="Delete message"
              class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    `;
  });

  html += `</div>`;
  listContainer.innerHTML = html;
}

// 4. Render Message Detail View (Gmail Message Viewer)
function renderMessageDetail(msg, container) {
  // Mark message as read
  msg.isUnread = false;
  saveStateToStorage();

  const initials = (msg.fromName || 'U').substring(0, 2).toUpperCase();

  container.innerHTML = `
    <div class="animate-fade-in">
      <!-- Toolbar -->
      <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <button 
            onclick="closeMessageView()" 
            class="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Inbox
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <button 
            onclick="toggleStar('${msg.id}')"
            class="p-2 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-slate-100 transition-colors ${msg.isStarred ? 'text-amber-400' : ''}"
            title="Star message">
            <svg class="w-4 h-4 ${msg.isStarred ? 'fill-current' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
          <button 
            onclick="deleteSingleMessage('${msg.id}')"
            class="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            title="Delete this email">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Subject Header -->
      <h2 class="text-xl md:text-2xl font-bold text-slate-900 mb-4">${msg.subject}</h2>

      <!-- Sender Info Card -->
      <div class="flex items-start justify-between mb-6 pb-4 border-b border-slate-100 flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-[#F4413D] text-white flex items-center justify-center font-bold text-sm shadow-sm">
            ${initials}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-900 text-sm md:text-base">${msg.fromName || msg.from}</span>
              <span class="text-xs text-slate-400">&lt;${msg.from}&gt;</span>
            </div>
            <div class="text-xs text-slate-500">
              to: <span class="font-mono text-slate-700">${msg.to || getActiveEmail()}</span>
            </div>
          </div>
        </div>
        <div class="text-xs text-slate-400 self-center">
          ${msg.receivedAt}
        </div>
      </div>

      <!-- OTP Smart Highlight Box (If OTP found) -->
      ${msg.otp ? `
        <div class="mb-6 p-4 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-[#F4413D]/30 rounded-xl flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-[#F4413D] text-white flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-[#F4413D]">Security OTP Code</span>
              <div class="font-mono text-2xl font-extrabold text-slate-900 tracking-wider">${msg.otp}</div>
            </div>
          </div>
          <button 
            onclick="copyOtpCode('${msg.otp}')"
            class="px-4 py-2 bg-[#F4413D] hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy OTP
          </button>
        </div>
      ` : ''}

      <!-- Partner Verification Link Highlight -->
      ${msg.partnerLink ? `
        <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between flex-wrap gap-2">
          <div class="text-sm font-medium text-blue-900">
            🔗 <strong>Verification Link Detected:</strong>
          </div>
          <a href="${msg.partnerLink}" target="_blank" rel="noopener noreferrer" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1">
            Open Verification Link
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      ` : ''}

      <!-- Message Body -->
      <div class="email-body-content bg-white p-6 rounded-xl border border-slate-200 text-slate-800 leading-relaxed shadow-sm min-h-[160px]">
        ${msg.bodyHtml || `<p class="whitespace-pre-line">${msg.snippet}</p>`}
      </div>

    </div>
  `;
}

// Open Message
window.openMessage = function(id) {
  state.activeMessageId = id;
  renderInboxView();
};

// Close Message View (Back to inbox list)
window.closeMessageView = function() {
  state.activeMessageId = null;
  renderInboxView();
};

// Toggle Star
window.toggleStar = function(id, e) {
  if (e) e.stopPropagation();
  const messages = getActiveMessages();
  const msg = messages.find(m => m.id === id);
  if (msg) {
    msg.isStarred = !msg.isStarred;
    saveStateToStorage();
    renderInboxView();
  }
};

// Toggle Read Status
window.toggleReadStatus = function(id, e) {
  if (e) e.stopPropagation();
  const messages = getActiveMessages();
  const msg = messages.find(m => m.id === id);
  if (msg) {
    msg.isUnread = !msg.isUnread;
    saveStateToStorage();
    renderInboxView();
  }
};

// Delete Single Message
window.deleteSingleMessage = function(id, e) {
  if (e) e.stopPropagation();
  const current = getActiveEmail();
  state.messages[current] = (state.messages[current] || []).filter(m => m.id !== id);
  if (state.activeMessageId === id) {
    state.activeMessageId = null;
  }
  saveStateToStorage();
  renderInboxView();
  showToast('Email deleted.', 'info');
};

// Clear All Messages in Current Inbox
window.clearCurrentInbox = function() {
  const current = getActiveEmail();
  if (confirm('Are you sure you want to delete all messages in this inbox?')) {
    state.messages[current] = [];
    state.activeMessageId = null;
    saveStateToStorage();
    renderInboxView();
    showToast('Inbox cleared.', 'info');
  }
};

// Refresh Timer (15 Seconds Auto Countdown)
function startRefreshTimer() {
  clearInterval(state.timerInterval);
  state.countdown = CONFIG.REFRESH_INTERVAL;

  state.timerInterval = setInterval(() => {
    state.countdown--;
    const timerEl = document.getElementById('refresh-timer-count');
    if (timerEl) {
      timerEl.textContent = `${state.countdown}s`;
    }

    if (state.countdown <= 0) {
      state.countdown = CONFIG.REFRESH_INTERVAL;
      triggerInboxRefresh(false);
    }
  }, 1000);
}

// Manual or Automatic Inbox Refresh
window.triggerInboxRefresh = function(isManual = true) {
  const icon = document.getElementById('refresh-icon');
  if (icon) icon.classList.add('animate-spin');

  // If manual, reset countdown
  if (isManual) {
    state.countdown = CONFIG.REFRESH_INTERVAL;
  }

  // Hook point: Fetch latest messages from Cloudflare Worker API
  // fetch(`${CONFIG.API_ENDPOINT}?email=${encodeURIComponent(getActiveEmail())}`) ...
  setTimeout(() => {
    if (icon) icon.classList.remove('animate-spin');
    renderInboxView();
    if (isManual) {
      showToast('Inbox is up to date!', 'info');
    }
  }, 600);
};

// Simulate an Incoming Test Email (for interactive testing)
window.simulateIncomingEmail = function() {
  const randomCodes = ['739102', '519284', '992014', '381920'];
  const services = [
    { name: 'Instagram', domain: 'mail.instagram.com', sub: 'Confirm your Instagram account' },
    { name: 'Spotify', domain: 'spotify.com', sub: 'Your Spotify login code' },
    { name: 'Steam', domain: 'steampowered.com', sub: 'Your Steam Guard verification code' },
    { name: 'GitHub', domain: 'github.com', sub: 'GitHub verification code: OTP' }
  ];

  const service = services[Math.floor(Math.random() * services.length)];
  const otp = randomCodes[Math.floor(Math.random() * randomCodes.length)];
  const current = getActiveEmail();

  const newMsg = {
    id: 'msg-' + Date.now(),
    from: `${service.name} <security@${service.domain}>`,
    fromName: service.name,
    to: current,
    subject: `${service.sub}: ${otp}`,
    snippet: `Your temporary security code is ${otp}. Please enter it in the app to proceed.`,
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; padding: 10px;">
        <h3 style="color: #0F172A;">${service.name} Verification</h3>
        <p style="color: #475569;">Here is your verification code:</p>
        <div style="background: #F8FAFC; border: 2px dashed #F4413D; padding: 15px; border-radius: 8px; text-align: center; margin: 15px 0;">
          <span style="font-size: 28px; font-weight: 800; color: #F4413D; letter-spacing: 5px;">${otp}</span>
        </div>
        <p style="color: #94A3B8; font-size: 12px;">This is a test notification generated by tempemails.site.</p>
      </div>
    `,
    otp: otp,
    partnerLink: null,
    isUnread: true,
    isStarred: false,
    receivedAt: 'Just now',
    timestamp: Date.now()
  };

  if (!state.messages[current]) state.messages[current] = [];
  state.messages[current].unshift(newMsg);
  saveStateToStorage();
  renderApp();

  // Play audio chime notification
  if (window.AppUtils && window.AppUtils.playNotificationSound) {
    window.AppUtils.playNotificationSound();
  }

  showToast(`New email received from ${service.name}! ✉️`, 'success');
};

// QR Code Modal Trigger
window.openQrModal = function() {
  const modal = document.getElementById('qr-modal');
  const qrImg = document.getElementById('qr-modal-image');
  const email = getActiveEmail();

  if (modal && qrImg && email) {
    // Generate QR Code via free lightweight API or inline SVG
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(email)}`;
    document.getElementById('qr-modal-email').textContent = email;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeQrModal = function() {
  const modal = document.getElementById('qr-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// On DOM Ready
document.addEventListener('DOMContentLoaded', initApp);
