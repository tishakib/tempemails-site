/**
 * tempemails.site - Client Application
 * Handles 5-Email Slots, Gmail-style Inbox, OTP Extraction, and Real-time Refresh
 */

// Configuration
const CONFIG = {
  DOMAIN: 'workspacemail.xyz',
  MAX_INBOXES: 5,
  MAX_CHANGES: 3, // Allowed changes per address
  REFRESH_INTERVAL: 15, // seconds
  STORAGE_KEY_INBOXES: 'tempemails_slots_v1',
  STORAGE_KEY_ACTIVE: 'tempemails_active_index_v1',
  STORAGE_KEY_MESSAGES: 'tempemails_messages_v1',
  STORAGE_KEY_CHANGES: 'tempemails_changes_count_v1',
  API_ENDPOINT: '/api',
  TURNSTILE_ENABLED: true,
  TURNSTILE_SITE_KEY: '0x4AAAAAAFRu_7JO3yDw1SR7'
};

// No demo emails - clean authentic inbox
const DEMO_EMAILS = [];

// Cookie Persistence Helpers (Ensures cross-reload stability in Incognito & Strict Privacy Modes)
function getStorageCookie(name) {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  } catch (e) {}
  return null;
}

function setStorageCookie(name, val, days = 7) {
  try {
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(val)}; expires=${exp}; path=/; SameSite=Lax`;
  } catch (e) {}
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// App State
const state = {
  inboxes: [],
  activeIndex: 0,
  messages: {}, // keyed by email address
  changesCount: {}, // keyed by index or address
  countdown: CONFIG.REFRESH_INTERVAL,
  timerInterval: null,
  activeMessageId: null,
  filterStarredOnly: false,
  isSyncing: false,
  activeSyncEmail: null
};

// Generate Random Clean Human Username
function generateRandomUsername() {
  const firstNames = [
    'alex', 'sarah', 'daniel', 'emma', 'david', 'sophia', 'james', 'olivia', 'liam', 'elena',
    'ryan', 'chloe', 'marcus', 'maya', 'adrian', 'nora', 'lucas', 'mia', 'ethan', 'hannah',
    'noah', 'clara', 'samuel', 'zoey', 'jason', 'lily', 'adam', 'grace', 'victor', 'eva',
    'suha', 'zayd', 'tariq', 'farhan', 'kabir', 'arav', 'nadia', 'arman', 'bilal', 'saif',
    'hasan', 'shakil', 'ayan', 'zoya', 'rehan', 'alina', 'idris', 'samira', 'hamza', 'layla'
  ];
  const lastNames = [
    'wasti', 'miller', 'smith', 'clark', 'brown', 'davis', 'khan', 'ahmed', 'ross', 'hasan',
    'hossain', 'rahman', 'malik', 'taylor', 'wilson', 'johnson', 'walker', 'turner', 'white', 'evans',
    'hall', 'baker', 'cooper', 'wright', 'king', 'scott', 'green', 'adams', 'morris', 'patel'
  ];
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  const sep = Math.random() < 0.6 ? '_' : '.';
  const numSuffix = Math.random() > 0.45 ? String(Math.floor(18 + Math.random() * 81)) : '';
  return `${first}${sep}${last}${numSuffix}`;
}

// Multi-Tier Storage Persistence (localStorage + sessionStorage + 1st-party Cookies)
function loadStateFromStorage() {
  try {
    let savedInboxes = localStorage.getItem(CONFIG.STORAGE_KEY_INBOXES) || 
                       sessionStorage.getItem(CONFIG.STORAGE_KEY_INBOXES) || 
                       getStorageCookie(CONFIG.STORAGE_KEY_INBOXES);
                       
    let savedActive = localStorage.getItem(CONFIG.STORAGE_KEY_ACTIVE) || 
                      sessionStorage.getItem(CONFIG.STORAGE_KEY_ACTIVE) || 
                      getStorageCookie(CONFIG.STORAGE_KEY_ACTIVE);
                      
    let savedMessages = localStorage.getItem(CONFIG.STORAGE_KEY_MESSAGES) || 
                        sessionStorage.getItem(CONFIG.STORAGE_KEY_MESSAGES);
                        
    let savedChanges = localStorage.getItem(CONFIG.STORAGE_KEY_CHANGES) || 
                       sessionStorage.getItem(CONFIG.STORAGE_KEY_CHANGES);

    if (savedInboxes) {
      const parsed = JSON.parse(savedInboxes);
      if (Array.isArray(parsed) && parsed.length > 0) state.inboxes = parsed;
    }
    if (savedActive !== null && savedActive !== undefined) {
      state.activeIndex = parseInt(savedActive, 10) || 0;
    }
    if (savedMessages) state.messages = JSON.parse(savedMessages);
    if (savedChanges) state.changesCount = JSON.parse(savedChanges);
  } catch (err) {
    console.error('Storage parse error:', err);
  }
}

function saveStateToStorage() {
  try {
    const inboxesJson = JSON.stringify(state.inboxes);
    const activeStr = state.activeIndex.toString();
    const activeEmail = state.inboxes[state.activeIndex] || '';
    const msgsJson = JSON.stringify(state.messages);
    const changesJson = JSON.stringify(state.changesCount);

    // 1. Persistent LocalStorage
    localStorage.setItem(CONFIG.STORAGE_KEY_INBOXES, inboxesJson);
    localStorage.setItem(CONFIG.STORAGE_KEY_ACTIVE, activeStr);
    localStorage.setItem(CONFIG.STORAGE_KEY_MESSAGES, msgsJson);
    localStorage.setItem(CONFIG.STORAGE_KEY_CHANGES, changesJson);

    // 2. Tab/SessionStorage (Survives reload inside private/incognito mode)
    sessionStorage.setItem(CONFIG.STORAGE_KEY_INBOXES, inboxesJson);
    sessionStorage.setItem(CONFIG.STORAGE_KEY_ACTIVE, activeStr);
    sessionStorage.setItem(CONFIG.STORAGE_KEY_MESSAGES, msgsJson);
    sessionStorage.setItem(CONFIG.STORAGE_KEY_CHANGES, changesJson);

    // 3. Cookie fallback
    setStorageCookie(CONFIG.STORAGE_KEY_INBOXES, inboxesJson, 7);
    setStorageCookie(CONFIG.STORAGE_KEY_ACTIVE, activeStr, 7);
    if (activeEmail) setStorageCookie('tre_active_inbox_v1', activeEmail, 7);
  } catch (err) {
    console.error('Storage save error:', err);
  }
}

// Initialize Application
async function initApp() {
  // Step 1: Immediately restore from multi-tier storage
  loadStateFromStorage();

  const hwId = window.AppUtils ? window.AppUtils.getDeviceId() : 'browser-client';
  const hasExistingInboxes = Array.isArray(state.inboxes) && state.inboxes.length > 0;
  const activeEmailBefore = hasExistingInboxes ? (state.inboxes[state.activeIndex] || state.inboxes[0]) : '';

  // Step 2: Render immediately if we already have a saved active inbox (Zero wait, zero flash)
  if (hasExistingInboxes) {
    renderApp();
  }

  // Step 3: Fetch dynamic system settings from backend
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
      if (policyMaxInboxes) policyMaxInboxes.textContent = data.max_inboxes_per_user !== undefined ? data.max_inboxes_per_user : 3;
      if (policyMaxChanges) policyMaxChanges.textContent = data.max_email_changes_per_inbox || 3;

      // Handle Cloudflare Turnstile Anti-Bot
      if (data.turnstile_enabled !== undefined) {
        CONFIG.TURNSTILE_ENABLED = data.turnstile_enabled !== false;
      }
      if (data.turnstile_site_key) {
        CONFIG.TURNSTILE_SITE_KEY = data.turnstile_site_key;
      }

      const turnstileWrap = document.getElementById('turnstile-wrapper');
      if (CONFIG.TURNSTILE_ENABLED === false) {
        if (turnstileWrap) turnstileWrap.classList.add('hidden');
      } else {
        if (turnstileWrap) turnstileWrap.classList.remove('hidden');
        renderCloudflareTurnstile(CONFIG.TURNSTILE_SITE_KEY);
      }

      // Inject Google Search Console if provided
      if (data.google_search_console) {
        let gscCode = String(data.google_search_console).trim();
        const match = gscCode.match(/content=["']([^"']+)["']/i);
        if (match) gscCode = match[1];
        gscCode = gscCode.replace(/^google-site-verification=/i, '').trim();

        let meta = document.querySelector('meta[name="google-site-verification"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'google-site-verification';
          document.head.appendChild(meta);
        }
        meta.content = gscCode;
      }
    }
  } catch (err) {
    console.log('Running in offline/local mode');
  }

  // Step 4: Validate and sync session with backend (Never reset active address on reload)
  try {
    const sessionUrl = `/api/inbox/device-session?device_id=${encodeURIComponent(hwId)}&current_address=${encodeURIComponent(activeEmailBefore)}&inboxes=${encodeURIComponent(JSON.stringify(state.inboxes))}`;
    const sessionRes = await fetch(sessionUrl, {
      headers: {
        'x-device-fingerprint': hwId,
        'x-current-address': activeEmailBefore,
        'x-inboxes': JSON.stringify(state.inboxes)
      }
    });

    if (sessionRes.ok) {
      const sessionData = await sessionRes.json();
      if (sessionData.max_inboxes) CONFIG.MAX_INBOXES = sessionData.max_inboxes;
      if (sessionData.max_changes) CONFIG.MAX_CHANGES = sessionData.max_changes;
      if (sessionData.changesCount) state.changesCount = sessionData.changesCount;

      if (!hasExistingInboxes) {
        // First visit ever: assign initial session inboxes if server provided any
        if (sessionData.inboxes && sessionData.inboxes.length > 0) {
          state.inboxes = sessionData.inboxes;
          state.activeIndex = typeof sessionData.activeIndex === 'number' ? sessionData.activeIndex : 0;
          saveStateToStorage();
        }
      } else {
        // Page reload / returning visitor: ALWAYS PRESERVE user's active address
        if (activeEmailBefore && state.inboxes.includes(activeEmailBefore)) {
          state.activeIndex = state.inboxes.indexOf(activeEmailBefore);
        }
        // Seamlessly upgrade empty legacy @tempemails.site inboxes to clean stealth @workspacemail.xyz
        let upgradedAny = false;
        state.inboxes = state.inboxes.map(addr => {
          if (addr && addr.endsWith('@tempemails.site')) {
            const msgs = state.messages[addr] || [];
            if (msgs.length === 0) {
              const newAddr = `${generateRandomUsername()}@${CONFIG.DOMAIN}`;
              state.messages[newAddr] = [];
              delete state.messages[addr];
              upgradedAny = true;
              return newAddr;
            }
          }
          return addr;
        });
        if (upgradedAny) {
          showToast('Updated to active @workspacemail.xyz inbox!', 'info');
        }
        saveStateToStorage();
      }
    }
  } catch (err) {
    console.log('Device session fetch error, preserving local session:', err);
  }

  // Step 5: Fallback if completely empty (First visit without inboxes)
  if (state.inboxes.length === 0) {
    if (!CONFIG.TURNSTILE_ENABLED) {
      const firstEmail = `${generateRandomUsername()}@${CONFIG.DOMAIN}`;
      state.inboxes.push(firstEmail);
      state.activeIndex = 0;
      state.messages[firstEmail] = [];
      saveStateToStorage();
    }
  }

  // Ensure active index is within bounds
  if (state.activeIndex >= state.inboxes.length) {
    state.activeIndex = 0;
  }

  // Ensure message container exists for all inboxes
  state.inboxes.forEach(addr => {
    if (!state.messages[addr]) state.messages[addr] = [];
  });

  renderApp();
  // Fetch messages immediately for active inbox
  triggerInboxRefresh(false);
  // Start continuous silent background auto-sync
  startContinuousAutoSync();
  // Load and render dynamic ads
  loadAndRenderAds();
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
    state.activeSyncEmail = getActiveEmail();
    saveStateToStorage();
    renderApp();
    showToast(`Switched to inbox #${index + 1}`, 'info');
    if (window.triggerInboxRefresh) window.triggerInboxRefresh(false);
  }
};

// Add New Inbox Slot (Up to dynamic max limit, protected by Turnstile)
window.addNewInboxSlot = async function() {
  if (state.inboxes.length >= CONFIG.MAX_INBOXES) {
    showToast(`Maximum ${CONFIG.MAX_INBOXES} inboxes limit reached!`, 'warning');
    return;
  }

  const hwId = window.AppUtils ? window.AppUtils.getDeviceId() : 'browser-client';

  // If Turnstile is active but no token available yet, prompt user
  if (CONFIG.TURNSTILE_ENABLED && !window.turnstileToken) {
    showToast('Please complete the security verification challenge below.', 'info');
    if (window.turnstile && window.turnstileWidgetId !== undefined) {
      window.turnstile.reset(window.turnstileWidgetId);
    }
    const widget = document.getElementById('turnstile-wrapper');
    if (widget) widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const token = window.turnstileToken || '';

  try {
    const res = await fetch('/api/inbox/create', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-device-fingerprint': hwId,
        'cf-turnstile-token': token
      },
      body: JSON.stringify({ device_id: hwId, turnstile_token: token })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      showToast(data.error || 'Failed to create inbox', 'warning');
      if (window.turnstile && window.turnstileWidgetId !== undefined) {
        window.turnstile.reset(window.turnstileWidgetId);
      }
      return;
    }
    if (data.inboxes && Array.isArray(data.inboxes)) {
      state.inboxes = data.inboxes;
      state.activeIndex = state.inboxes.length - 1;
    } else if (data.inbox && data.inbox.address) {
      if (!state.inboxes.includes(data.inbox.address)) {
        state.inboxes.push(data.inbox.address);
      }
      state.activeIndex = state.inboxes.indexOf(data.inbox.address);
    }

    // Token consumed — reset widget for next action
    window.turnstileToken = null;
    if (window.turnstile && window.turnstileWidgetId !== undefined) {
      window.turnstile.reset(window.turnstileWidgetId);
    }
  } catch (e) {
    showToast('Network error while creating inbox slot.', 'warning');
    return;
  }

  const activeEmail = getActiveEmail();
  state.messages[activeEmail] = [];
  state.activeMessageId = null;

  saveStateToStorage();
  renderApp();
  showToast('New inbox created successfully!', 'success');
  triggerInboxRefresh(false);
};

// Delete an Inbox Slot (Synced across device browsers)
window.deleteInboxSlot = async function(index, e) {
  if (e) e.stopPropagation();
  if (state.inboxes.length <= 1) {
    showToast('You must keep at least 1 active inbox.', 'warning');
    return;
  }

  const hwId = window.AppUtils ? window.AppUtils.getDeviceId() : 'browser-client';
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

  try {
    await fetch('/api/inbox/delete-slot', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-device-fingerprint': hwId
      },
      body: JSON.stringify({ address: removedEmail, device_id: hwId })
    });
  } catch (err) {}
};

// Randomize / Change Current Active Email (Respects Change Limit & Protected by Turnstile)
window.randomizeCurrentEmail = async function() {
  const current = getActiveEmail();
  const maxChanges = CONFIG.MAX_CHANGES || 3;
  const used = state.changesCount[current] || 0;

  if (used >= maxChanges) {
    showToast(`Maximum ${maxChanges} address changes reached for this inbox.`, 'warning');
    return;
  }

  if (CONFIG.TURNSTILE_ENABLED && !window.turnstileToken) {
    showToast('Please complete the security challenge below to change address.', 'info');
    if (window.turnstile && window.turnstileWidgetId !== undefined) {
      window.turnstile.reset(window.turnstileWidgetId);
    }
    const widget = document.getElementById('turnstile-wrapper');
    if (widget) widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const token = window.turnstileToken || '';
  const hwId = window.AppUtils ? window.AppUtils.getDeviceId() : 'browser-client';
  const changeBtn = document.getElementById('btn-change-email');
  if (changeBtn) changeBtn.classList.add('opacity-50', 'pointer-events-none');

  try {
    const res = await fetch('/api/inbox/change', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-device-fingerprint': hwId,
        'cf-turnstile-token': token
      },
      body: JSON.stringify({ oldAddress: current, device_id: hwId, turnstile_token: token })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      showToast(data.error || 'Failed to change address', 'warning');
      if (window.turnstile && window.turnstileWidgetId !== undefined) {
        window.turnstile.reset(window.turnstileWidgetId);
      }
      if (changeBtn) changeBtn.classList.remove('opacity-50', 'pointer-events-none');
      return;
    }

    const newEmail = data.newAddress || `${generateRandomUsername()}@${CONFIG.DOMAIN}`;
    state.inboxes[state.activeIndex] = newEmail;
    delete state.messages[current];
    delete state.changesCount[current];
    state.changesCount[newEmail] = used + 1;
    state.messages[newEmail] = [];
    state.activeMessageId = null;

    window.turnstileToken = null;
    if (window.turnstile && window.turnstileWidgetId !== undefined) {
      window.turnstile.reset(window.turnstileWidgetId);
    }

    saveStateToStorage();
    renderApp();
    const remaining = data.remainingChanges !== undefined ? data.remainingChanges : Math.max(0, maxChanges - (used + 1));
    showToast(`Email changed! (${remaining} change${remaining === 1 ? '' : 's'} remaining)`, 'success');
    triggerInboxRefresh(false);
  } catch (err) {
    showToast('Network error while changing address.', 'warning');
  } finally {
    if (changeBtn) changeBtn.classList.remove('opacity-50', 'pointer-events-none');
  }
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
        <p class="text-sm text-slate-500 max-w-sm mx-auto mb-4">Send an email to <span class="font-mono font-semibold text-slate-700">${getActiveEmail()}</span> and it will appear here automatically.</p>
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 rounded-full text-xs text-slate-600 font-medium">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live auto-sync active</span>
        </div>
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

// Clean and sanitize email HTML body using DOMPurify with pure JS fallback
function sanitizeClientHtml(html) {
  if (!html || typeof html !== 'string') return '';
  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
    return DOMPurify.sanitize(html, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'applet', 'form', 'meta'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange'],
      ALLOW_DATA_ATTR: false
    });
  }
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*(["'])\s*(?:javascript|vbscript|data):[^"']*\1/gi, 'href="#"')
    .replace(/src\s*=\s*(["'])\s*(?:javascript|vbscript):[^"']*\1/gi, 'src=""');
}

// 4. Render Message Detail View (Isolated Sandboxed Iframe Viewer with Multi-language Fonts)
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

      <!-- Subject Header (Supports Bengali, Indic, Arabic RTL & CJK) -->
      <h2 dir="auto" class="text-xl md:text-2xl font-bold text-slate-900 mb-4" style="word-break: normal; line-break: auto;">${escapeHtml(msg.subject)}</h2>

      <!-- Sender Info Card -->
      <div class="flex items-start justify-between mb-6 pb-4 border-b border-slate-100 flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-[#F4413D] text-white flex items-center justify-center font-bold text-sm shadow-sm">
            ${initials}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span dir="auto" class="font-bold text-slate-900 text-sm md:text-base">${escapeHtml(msg.fromName || msg.from)}</span>
              <span class="text-xs text-slate-400">&lt;${escapeHtml(msg.from)}&gt;</span>
            </div>
            <div class="text-xs text-slate-500">
              to: <span class="font-mono text-slate-700">${escapeHtml(msg.to || getActiveEmail())}</span>
            </div>
          </div>
        </div>
        <div class="text-xs text-slate-400 self-center">
          ${msg.receivedAt}
        </div>
      </div>

      <!-- OTP Smart Highlight Box (If legitimate OTP found) -->
      ${(msg.otp && !msg.otp.startsWith('2607')) ? `
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
          <div class="text-sm font-medium text-blue-900 flex items-center gap-2">
            <span>🔗</span>
            <span><strong>Verification Link Detected:</strong></span>
          </div>
          <a href="${msg.partnerLink}" target="_blank" rel="noopener noreferrer" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors inline-flex items-center gap-1.5">
            Open Verification Link
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      ` : ''}

      <!-- View Controls: Formatted HTML vs Plain Text Toggle & Height Control -->
      <div id="email-view-controls" class="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 flex-wrap gap-2 text-xs">
        <div class="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
          <button id="btn-view-html" onclick="setEmailViewMode('html')" class="px-3 py-1 font-semibold rounded-md bg-white text-slate-800 shadow-sm transition-all">
            Formatted (HTML)
          </button>
          <button id="btn-view-text" onclick="setEmailViewMode('text')" class="px-3 py-1 font-semibold rounded-md text-slate-500 hover:text-slate-800 transition-all">
            Plain Text
          </button>
        </div>
        <button id="btn-toggle-expand" onclick="toggleEmailFrameHeight()" class="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 font-medium">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
          <span>Expand Height</span>
        </button>
      </div>

      <!-- HTML View (Isolated Sandboxed Iframe) -->
      <div id="email-iframe-container" class="w-full">
        <iframe
          id="email-viewer-frame"
          class="w-full border border-slate-200 rounded-xl bg-white shadow-sm transition-all"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          loading="lazy"
          style="width: 100%; min-height: 480px; height: 620px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;"
        ></iframe>
      </div>

      <!-- Plain Text Fallback View -->
      <div id="email-text-container" class="hidden w-full bg-white p-6 rounded-xl border border-slate-200 text-slate-800 leading-relaxed shadow-sm font-sans" dir="auto" style="white-space: pre-wrap; word-break: normal; line-break: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', 'Noto Sans Bengali', 'SolaimanLipi', 'Kalpurush', 'Noto Sans Devanagari', 'Noto Sans Arabic', sans-serif;">
      </div>

    </div>
  `;

  // Initialize and inject secure sandboxed content
  setupEmailViewer(msg);
}

// Secure Email Viewer Setup (Sandboxed Iframe with Typography & DOM Isolation)
function setupEmailViewer(msg) {
  const iframe = document.getElementById('email-viewer-frame');
  const textContainer = document.getElementById('email-text-container');
  if (!iframe) return;

  const rawHtml = msg.bodyHtml || '';
  const snippet = msg.snippet || '';
  const sanitized = sanitizeClientHtml(rawHtml);

  // Check if content has real HTML tags
  const hasHtml = /<[a-z][\s\S]*>/i.test(sanitized) && !/^<p>\s*\(Empty message\)\s*<\/p>$/i.test(sanitized);

  // Populate Plain Text container
  if (textContainer) {
    const rawText = msg.textContent || snippet || sanitized.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    textContainer.innerHTML = escapeHtml(rawText)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-semibold">$1</a>');
  }

  // Construct isolated, sandboxed HTML document for the iframe
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base target="_blank">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;600&family=Noto+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: light; }
    html, body {
      margin: 0;
      padding: 18px;
      background: #ffffff;
      color: #1e293b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', 'Noto Sans Bengali', 'SolaimanLipi', 'Kalpurush', 'Noto Sans Devanagari', 'Noto Sans Arabic', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      overflow-wrap: break-word;
      word-break: normal;
      line-break: auto;
      font-feature-settings: "kern", "liga", "clig";
      -webkit-font-smoothing: antialiased;
    }
    img { max-width: 100% !important; height: auto !important; }
    table { max-width: 100% !important; border-collapse: collapse; }
    a { color: #2563eb; text-decoration: underline; }
    blockquote {
      margin: 0.8em 0;
      padding-left: 1em;
      border-left: 3px solid #cbd5e1;
      color: #64748b;
    }
    pre, code {
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
      font-size: 13px;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
    }
    pre { padding: 12px; overflow-x: auto; white-space: pre-wrap; }
  </style>
</head>
<body dir="auto">
  ${sanitized || `<p style="color: #64748b; font-style: italic;">${escapeHtml(snippet || '(No message content)')}</p>`}
</body>
</html>`;

  iframe.srcdoc = doc;

  // If message has no HTML tags, automatically show plain text view
  if (!hasHtml && textContainer) {
    setEmailViewMode('text');
  }
}

window.setEmailViewMode = function(mode) {
  const iframeContainer = document.getElementById('email-iframe-container');
  const textContainer = document.getElementById('email-text-container');
  const btnHtml = document.getElementById('btn-view-html');
  const btnText = document.getElementById('btn-view-text');

  if (mode === 'html') {
    if (iframeContainer) iframeContainer.classList.remove('hidden');
    if (textContainer) textContainer.classList.add('hidden');
    if (btnHtml) {
      btnHtml.className = 'px-3 py-1 font-semibold rounded-md bg-white text-slate-800 shadow-sm transition-all';
    }
    if (btnText) {
      btnText.className = 'px-3 py-1 font-semibold rounded-md text-slate-500 hover:text-slate-800 transition-all';
    }
  } else {
    if (iframeContainer) iframeContainer.classList.add('hidden');
    if (textContainer) textContainer.classList.remove('hidden');
    if (btnText) {
      btnText.className = 'px-3 py-1 font-semibold rounded-md bg-white text-slate-800 shadow-sm transition-all';
    }
    if (btnHtml) {
      btnHtml.className = 'px-3 py-1 font-semibold rounded-md text-slate-500 hover:text-slate-800 transition-all';
    }
  }
};

window.toggleEmailFrameHeight = function() {
  const frame = document.getElementById('email-viewer-frame');
  const btn = document.getElementById('btn-toggle-expand');
  if (!frame) return;
  const isExpanded = frame.style.height === '1200px';
  if (isExpanded) {
    frame.style.height = '620px';
    if (btn) {
      const span = btn.querySelector('span');
      if (span) span.textContent = 'Expand Height';
    }
  } else {
    frame.style.height = '1200px';
    if (btn) {
      const span = btn.querySelector('span');
      if (span) span.textContent = 'Collapse Height';
    }
  }
};

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
  fetch(`/api/inbox/message?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
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

// Continuous silent background auto-sync (polls every 6s, 5-10s requirement)
function startContinuousAutoSync() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    triggerInboxRefresh(false);
  }, 6000);
}

// Manual or Automatic Inbox Refresh
window.triggerInboxRefresh = async function(isManual = false) {
  const icon = document.getElementById('refresh-icon');
  if (icon && isManual) icon.classList.add('animate-spin');

  const currentEmail = getActiveEmail();
  if (!currentEmail) {
    if (icon && isManual) setTimeout(() => icon.classList.remove('animate-spin'), 300);
    return;
  }

  // Prevent overlapping concurrent polling requests
  if (state.isSyncing) return;
  state.isSyncing = true;
  state.activeSyncEmail = currentEmail;

  try {
    const res = await fetch(`/api/inbox/messages?email=${encodeURIComponent(currentEmail)}`);
    // Discard response if active inbox changed while fetch was in flight
    if (state.activeSyncEmail !== getActiveEmail()) {
      state.isSyncing = false;
      return;
    }

    if (res.ok) {
      const serverMsgs = await res.json();
      const existingMsgs = state.messages[currentEmail] || [];
      const existingIds = new Set(existingMsgs.map(m => m.id));
      let hasNew = false;

      for (const sMsg of serverMsgs) {
        if (!existingIds.has(sMsg.id)) {
          existingMsgs.unshift({
            id: sMsg.id,
            from: sMsg.from,
            fromName: sMsg.from_name || sMsg.fromName || sMsg.from,
            to: sMsg.inbox_address || currentEmail,
            subject: sMsg.subject || '(No Subject)',
            snippet: sMsg.snippet || '',
            bodyHtml: sMsg.body_html || sMsg.bodyHtml || `<p>${sMsg.snippet || ''}</p>`,
            otp: sMsg.otp || null,
            partnerLink: sMsg.partner_link || sMsg.partnerLink || null,
            isUnread: sMsg.is_unread !== false,
            isStarred: false,
            receivedAt: 'Just now',
            timestamp: new Date(sMsg.created_at || Date.now()).getTime()
          });
          hasNew = true;
        }
      }

      if (hasNew) {
        state.messages[currentEmail] = existingMsgs;
        saveStateToStorage();
        if (window.AppUtils && window.AppUtils.playNotificationSound) {
          window.AppUtils.playNotificationSound();
        }
        showToast('New email arrived! ✉️', 'success');
        // Render only when new messages actually arrived, preserving scroll position
        renderInboxView();
      }
    }
  } catch (e) {
    console.warn('Silent sync warning (offline or network glitch):', e);
  } finally {
    state.isSyncing = false;
    if (icon && isManual) {
      setTimeout(() => icon.classList.remove('animate-spin'), 400);
    }
    if (isManual) {
      showToast('Inbox refreshed!', 'info');
      renderInboxView();
    }
  }
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

// Load and Render Dynamic Ads (or completely hide placeholders if disabled)
async function loadAndRenderAds() {
  try {
    const res = await fetch('/api/ads');
    if (!res.ok) return;
    const ads = await res.json();

    const slots = [
      { id: 'ad-slot-top', config: ads.top_banner },
      { id: 'ad-slot-middle', config: ads.middle_banner },
      { id: 'ad-slot-sidebar', config: ads.sidebar_banner },
      { id: 'ad-slot-sidebar-right', config: ads.sidebar_banner },
      { id: 'ad-slot-bottom', config: ads.bottom_banner }
    ];

    slots.forEach(slot => {
      const el = document.getElementById(slot.id);
      if (!el) return;

      const isEnabled = ads.master_enabled && slot.config && slot.config.enabled && slot.config.code && slot.config.code.trim();
      if (!isEnabled) {
        // Completely hide the container - zero placeholder clutter
        el.classList.add('hidden');
        el.innerHTML = '';
      } else {
        // Render custom ad script or HTML banner cleanly
        el.classList.remove('hidden');
        el.innerHTML = `
          <div class="w-full flex flex-col items-center justify-center overflow-hidden">
            <span class="text-[9px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Advertisement</span>
            <div class="ad-rendered-content w-full flex items-center justify-center">
              ${slot.config.code}
            </div>
          </div>
        `;
        // Execute any script tags dynamically
        el.querySelectorAll('script').forEach(oldScript => {
          const newScript = document.createElement('script');
          Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
          newScript.appendChild(document.createTextNode(oldScript.innerHTML));
          oldScript.parentNode.replaceChild(newScript, oldScript);
        });
      }
    });
  } catch (e) {
    ['ad-slot-top', 'ad-slot-middle', 'ad-slot-sidebar', 'ad-slot-sidebar-right', 'ad-slot-bottom'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }
}

// Render Cloudflare Turnstile explicitly and safely
function renderCloudflareTurnstile(siteKey) {
  const box = document.getElementById('cf-turnstile-box');
  if (!box) return;
  const key = (siteKey && siteKey.trim()) ? siteKey.trim() : '0x4AAAAAAFRu_7JO3yDw1SR7';

  function tryMount() {
    if (window.turnstile && document.getElementById('cf-turnstile-box')) {
      try {
        box.innerHTML = '';
        window.turnstileWidgetId = window.turnstile.render('#cf-turnstile-box', {
          sitekey: key,
          theme: 'light',
          size: 'compact',
          action: 'inbox_protection',
          callback: async function(token) {
            window.turnstileToken = token;
            const desc = document.getElementById('turnstile-status-desc');
            if (desc) {
              desc.textContent = 'Human visitor verified successfully.';
              desc.className = 'text-[11px] font-semibold text-emerald-600';
            }
            // If user has zero inboxes yet (first visit ever), automatically create initial inbox!
            if (state.inboxes.length === 0) {
              await createInitialInboxWithTurnstile(token);
            }
          },
          'expired-callback': function() {
            window.turnstileToken = null;
            const desc = document.getElementById('turnstile-status-desc');
            if (desc) {
              desc.textContent = 'Security challenge expired. Renewing challenge...';
              desc.className = 'text-[11px] text-amber-600';
            }
            if (window.turnstile && window.turnstileWidgetId !== undefined) {
              window.turnstile.reset(window.turnstileWidgetId);
            }
          },
          'error-callback': function() {
            console.log('Turnstile challenge error for site key:', key);
            const desc = document.getElementById('turnstile-status-desc');
            if (desc) {
              desc.textContent = 'Cloudflare anti-bot security active.';
            }
          }
        });
        return true;
      } catch (err) {
        console.log('Turnstile render exception:', err);
      }
    }
    return false;
  }

  if (!tryMount()) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (tryMount() || attempts > 25) {
        clearInterval(interval);
      }
    }, 200);
  }
}

// Automatically create initial inbox slot once Turnstile verifies human visitor
async function createInitialInboxWithTurnstile(token) {
  const hwId = window.AppUtils ? window.AppUtils.getDeviceId() : 'browser-client';
  try {
    const res = await fetch('/api/inbox/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': hwId,
        'cf-turnstile-token': token
      },
      body: JSON.stringify({ device_id: hwId, turnstile_token: token })
    });
    const data = await res.json();
    if (res.ok && (data.inbox || data.inboxes)) {
      if (data.inboxes && Array.isArray(data.inboxes)) {
        state.inboxes = data.inboxes;
        state.activeIndex = 0;
      } else if (data.inbox && data.inbox.address) {
        state.inboxes = [data.inbox.address];
        state.activeIndex = 0;
      }
      saveStateToStorage();
      renderApp();
      triggerInboxRefresh(false);
      // Reset Turnstile token and challenge so next action has a fresh challenge ready
      window.turnstileToken = null;
      if (window.turnstile && window.turnstileWidgetId !== undefined) {
        window.turnstile.reset(window.turnstileWidgetId);
      }
    }
  } catch (e) {
    console.error('Initial inbox creation error:', e);
  }
}

// On DOM Ready
document.addEventListener('DOMContentLoaded', initApp);


