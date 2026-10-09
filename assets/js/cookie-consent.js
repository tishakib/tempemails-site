/**
 * tempemails.site - Advanced Privacy & Cookie Consent Manager
 * Fully GDPR & ePrivacy Compliant, Zero-Dependency, Multi-Tier Storage
 * Provides Granular Categories: Strictly Necessary, Functional, Analytics
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'tre_cookie_consent_v1';
  const COOKIE_NAME = 'tre_cookie_consent';

  // Helper to read cookie
  function getCookie(name) {
    const matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
    return matches ? decodeURIComponent(matches[1]) : null;
  }

  // Helper to set cookie
  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + (days || 365) * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
  }

  // Retrieve current stored consent
  function getStoredConsent() {
    try {
      const fromLocal = localStorage.getItem(STORAGE_KEY);
      if (fromLocal) return JSON.parse(fromLocal);
    } catch (e) {}

    try {
      const fromCookie = getCookie(COOKIE_NAME);
      if (fromCookie) return JSON.parse(fromCookie);
    } catch (e) {}

    return null;
  }

  // Save consent state to both LocalStorage and Cookie
  function saveConsent(preferences) {
    const consentRecord = {
      version: 1,
      timestamp: new Date().toISOString(),
      necessary: true, // Always required for security, Turnstile & session persistence
      functional: Boolean(preferences.functional),
      analytics: Boolean(preferences.analytics)
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consentRecord));
    } catch (e) {}

    try {
      setCookie(COOKIE_NAME, JSON.stringify(consentRecord), 365);
    } catch (e) {}

    // Dispatch global event for analytics or third-party listeners
    window.dispatchEvent(new CustomEvent('cookie_consent_updated', { detail: consentRecord }));

    // Apply Google Consent Mode if gtag is available
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: consentRecord.analytics ? 'granted' : 'denied',
        functionality_storage: consentRecord.functional ? 'granted' : 'denied',
        security_storage: 'granted'
      });
    }

    return consentRecord;
  }

  // Render HTML UI components into DOM
  function injectConsentUI() {
    if (document.getElementById('tre-cookie-root')) return;

    const root = document.createElement('div');
    root.id = 'tre-cookie-root';
    root.innerHTML = `
      <!-- FLOATING COOKIE CONSENT BANNER -->
      <div id="tre-cookie-banner" class="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-xl z-50 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-2xl rounded-2xl p-5 text-slate-800 transition-all duration-300 transform translate-y-0 hidden">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0 text-xl shadow-xs">
            🍪
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="text-sm font-bold text-slate-900 tracking-tight">We Value Your Privacy & Cookies</h3>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">GDPR Compliant</span>
            </div>
            <p class="text-xs text-slate-600 leading-relaxed mb-3">
              We use necessary cookies and local storage to guarantee secure temporary inbox generation, bot defense via Cloudflare Turnstile, and session persistence across browser tabs. No personal profile data is ever sold.
            </p>
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <button id="tre-cookie-btn-accept-all" class="px-4 py-2 bg-[#F4413D] hover:bg-red-600 active:scale-95 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5">
                <span>Accept All</span>
              </button>
              <button id="tre-cookie-btn-necessary" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-semibold rounded-xl text-xs transition-all">
                <span>Necessary Only</span>
              </button>
              <button id="tre-cookie-btn-customize" class="px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold underline underline-offset-2 transition-colors flex items-center gap-1 ml-auto">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>Customize</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- DETAILED COOKIE PREFERENCES MODAL -->
      <div id="tre-cookie-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-fade-in border border-slate-100">
          
          <button id="tre-cookie-modal-close" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-red-50 text-xl flex items-center justify-center border border-red-100">🍪</div>
            <div>
              <h3 class="text-base font-bold text-slate-900">Cookie & Privacy Preferences</h3>
              <p class="text-xs text-slate-500">Manage how tempemails.site uses cookies and storage</p>
            </div>
          </div>

          <p class="text-xs text-slate-600 leading-relaxed mb-4">
            You can customize your cookie preferences below. Strictly necessary cookies are required to preserve temporary email addresses, protect against automated bots, and ensure security.
          </p>

          <div class="space-y-3 mb-6">
            
            <!-- Category 1: Strictly Necessary -->
            <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-bold text-slate-900">Strictly Necessary & Security</span>
                <span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Always Active</span>
              </div>
              <p class="text-[11px] text-slate-500 leading-relaxed">
                Critical for temporary inbox generation, Cloudflare Turnstile anti-bot verification, and multi-tab session restoration (<code class="font-mono text-[10px] text-slate-700">tre_active_inbox_v1</code>). Cannot be disabled.
              </p>
            </div>

            <!-- Category 2: Functional & Preferences -->
            <div class="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
              <div class="flex items-center justify-between mb-1.5">
                <label for="tre-cookie-opt-functional" class="text-xs font-bold text-slate-900 cursor-pointer">Functional & Experience</label>
                <input type="checkbox" id="tre-cookie-opt-functional" checked class="w-4 h-4 text-[#F4413D] rounded border-slate-300 focus:ring-[#F4413D] cursor-pointer accent-[#F4413D]">
              </div>
              <p class="text-[11px] text-slate-500 leading-relaxed">
                Remembers your UI settings, such as email reader view mode (HTML vs Plain Text), reader window expansion height, and email arrival audio chime.
              </p>
            </div>

            <!-- Category 3: Analytics & Performance -->
            <div class="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
              <div class="flex items-center justify-between mb-1.5">
                <label for="tre-cookie-opt-analytics" class="text-xs font-bold text-slate-900 cursor-pointer">Analytics & Performance</label>
                <input type="checkbox" id="tre-cookie-opt-analytics" class="w-4 h-4 text-[#F4413D] rounded border-slate-300 focus:ring-[#F4413D] cursor-pointer accent-[#F4413D]">
              </div>
              <p class="text-[11px] text-slate-500 leading-relaxed">
                Aggregates anonymous performance telemetry to help us monitor email delivery speed, server availability, and user error rates.
              </p>
            </div>

          </div>

          <!-- Modal Actions -->
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button id="tre-cookie-modal-save" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors">
              Save My Preferences
            </button>
            <button id="tre-cookie-modal-accept-all" class="px-4 py-2 bg-[#F4413D] hover:bg-red-600 text-white font-bold rounded-xl text-xs transition-colors shadow-sm">
              Accept All
            </button>
          </div>

        </div>
      </div>

      <!-- PERSISTENT FLOATING REOPEN BADGE (Subtle icon in corner) -->
      <button id="tre-cookie-reopen-pill" title="Cookie Preferences" aria-label="Cookie Preferences" class="fixed bottom-4 left-4 z-40 bg-white/90 hover:bg-white text-slate-700 hover:text-[#F4413D] border border-slate-200 shadow-lg hover:shadow-xl rounded-full w-9 h-9 flex items-center justify-center text-base transition-all hover:scale-110 hidden">
        🍪
      </button>
    `;

    document.body.appendChild(root);
    setupEvents();
  }

  // Setup click listeners
  function setupEvents() {
    const banner = document.getElementById('tre-cookie-banner');
    const modal = document.getElementById('tre-cookie-modal');
    const reopenPill = document.getElementById('tre-cookie-reopen-pill');

    const btnAcceptAll = document.getElementById('tre-cookie-btn-accept-all');
    const btnNecessary = document.getElementById('tre-cookie-btn-necessary');
    const btnCustomize = document.getElementById('tre-cookie-btn-customize');

    const modalClose = document.getElementById('tre-cookie-modal-close');
    const modalSave = document.getElementById('tre-cookie-modal-save');
    const modalAcceptAll = document.getElementById('tre-cookie-modal-accept-all');

    const optFunctional = document.getElementById('tre-cookie-opt-functional');
    const optAnalytics = document.getElementById('tre-cookie-opt-analytics');

    function closeBanner() {
      if (banner) banner.classList.add('hidden');
      if (reopenPill) reopenPill.classList.remove('hidden');
    }

    function openModal() {
      const consent = getStoredConsent() || { functional: true, analytics: false };
      if (optFunctional) optFunctional.checked = consent.functional !== false;
      if (optAnalytics) optAnalytics.checked = Boolean(consent.analytics);
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      }
    }

    function closeModal() {
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    }

    if (btnAcceptAll) {
      btnAcceptAll.addEventListener('click', function () {
        saveConsent({ functional: true, analytics: true });
        closeBanner();
        if (window.showToast) window.showToast('All cookies accepted.', 'success');
      });
    }

    if (btnNecessary) {
      btnNecessary.addEventListener('click', function () {
        saveConsent({ functional: false, analytics: false });
        closeBanner();
        if (window.showToast) window.showToast('Necessary cookies enabled.', 'info');
      });
    }

    if (btnCustomize) {
      btnCustomize.addEventListener('click', function () {
        openModal();
      });
    }

    if (modalClose) {
      modalClose.addEventListener('click', closeModal);
    }

    if (modalSave) {
      modalSave.addEventListener('click', function () {
        saveConsent({
          functional: optFunctional ? optFunctional.checked : true,
          analytics: optAnalytics ? optAnalytics.checked : false
        });
        closeModal();
        closeBanner();
        if (window.showToast) window.showToast('Cookie preferences saved.', 'success');
      });
    }

    if (modalAcceptAll) {
      modalAcceptAll.addEventListener('click', function () {
        saveConsent({ functional: true, analytics: true });
        closeModal();
        closeBanner();
        if (window.showToast) window.showToast('All cookies accepted.', 'success');
      });
    }

    if (reopenPill) {
      reopenPill.addEventListener('click', openModal);
    }

    // Expose global modal opener for footer links or buttons
    window.openCookieSettingsModal = openModal;
  }

  // Initialize consent check
  function init() {
    injectConsentUI();
    const stored = getStoredConsent();
    const banner = document.getElementById('tre-cookie-banner');
    const reopenPill = document.getElementById('tre-cookie-reopen-pill');

    if (!stored) {
      // First-time visitor: reveal banner with subtle delay for smooth animation
      setTimeout(() => {
        if (banner) banner.classList.remove('hidden');
      }, 400);
    } else {
      // Returning visitor who has already consented: keep banner closed, show subtle floating pill
      if (reopenPill) reopenPill.classList.remove('hidden');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
