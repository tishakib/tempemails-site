/**
 * tempemails.site - Advanced Neural Language Translator & OLED Dark Mode Engine
 * Zero-dependency, Real-time DOM Translation, Browser Language Auto-Detection
 * 45+ International Languages with Native Flags, RTL Support & OLED Slate Dark Theme
 */

(function () {
  'use strict';

  // 1. Comprehensive International Languages Map
  const LANGUAGES = {
    'en': { name: 'English', native: 'English', flag: '🇺🇸', region: 'United States / Global' },
    'es': { name: 'Spanish', native: 'Español', flag: '🇪🇸', region: 'Spain / Latin America' },
    'fr': { name: 'French', native: 'Français', flag: '🇫🇷', region: 'France / Canada' },
    'de': { name: 'German', native: 'Deutsch', flag: '🇩🇪', region: 'Germany / Austria / Switzerland' },
    'ar': { name: 'Arabic', native: 'العربية', flag: '🇸🇦', region: 'Saudi Arabia / Middle East', rtl: true },
    'zh-CN': { name: 'Chinese (Simplified)', native: '中文 (简体)', flag: '🇨🇳', region: 'China / Singapore' },
    'zh-TW': { name: 'Chinese (Traditional)', native: '中文 (繁體)', flag: '🇹🇼', region: 'Taiwan / Hong Kong' },
    'nl': { name: 'Dutch', native: 'Nederlands', flag: '🇳🇱', region: 'Netherlands / Belgium' },
    'sv': { name: 'Swedish', native: 'Svenska', flag: '🇸🇪', region: 'Sweden' },
    'ru': { name: 'Russian', native: 'Русский', flag: '🇷🇺', region: 'Russia / CIS' },
    'pt': { name: 'Portuguese', native: 'Português', flag: '🇧🇷', region: 'Brazil / Portugal' },
    'hi': { name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳', region: 'India' },
    'bn': { name: 'Bengali', native: 'বাংলা', flag: '🇧🇩', region: 'Bangladesh / West Bengal' },
    'id': { name: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩', region: 'Indonesia' },
    'tl': { name: 'Filipino', native: 'Filipino (Tagalog)', flag: '🇵🇭', region: 'Philippines' },
    'ca': { name: 'Catalan', native: 'Català', flag: '🇪🇸', region: 'Catalonia / Spain' },
    'hu': { name: 'Hungarian', native: 'Magyar', flag: '🇭🇺', region: 'Hungary' },
    'iw': { name: 'Hebrew', native: 'עברית', flag: '🇮🇱', region: 'Israel', rtl: true },
    'it': { name: 'Italian', native: 'Italiano', flag: '🇮🇹', region: 'Italy / Switzerland' },
    'no': { name: 'Norwegian', native: 'Norsk', flag: '🇳🇴', region: 'Norway' },
    'tr': { name: 'Turkish', native: 'Türkçe', flag: '🇹🇷', region: 'Turkey' },
    'ro': { name: 'Romanian', native: 'Română', flag: '🇷🇴', region: 'Romania / Moldova' },
    'pl': { name: 'Polish', native: 'Polski', flag: '🇵🇱', region: 'Poland' },
    'ja': { name: 'Japanese', native: '日本語', flag: '🇯🇵', region: 'Japan' },
    'ko': { name: 'Korean', native: '한국어', flag: '🇰🇷', region: 'South Korea' },
    'vi': { name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳', region: 'Vietnam' },
    'th': { name: 'Thai', native: 'ไทย', flag: '🇹🇭', region: 'Thailand' },
    'uk': { name: 'Ukrainian', native: 'Українська', flag: '🇺🇦', region: 'Ukraine' },
    'el': { name: 'Greek', native: 'Ελληνικά', flag: '🇬🇷', region: 'Greece / Cyprus' },
    'cs': { name: 'Czech', native: 'Čeština', flag: '🇨🇿', region: 'Czech Republic' },
    'da': { name: 'Danish', native: 'Dansk', flag: '🇩🇰', region: 'Denmark' },
    'fi': { name: 'Finnish', native: 'Suomi', flag: '🇫🇮', region: 'Finland' },
    'ms': { name: 'Malay', native: 'Bahasa Melayu', flag: '🇲🇾', region: 'Malaysia' },
    'fa': { name: 'Persian', native: 'فارسی', flag: '🇮🇷', region: 'Iran / Afghanistan', rtl: true },
    'ur': { name: 'Urdu', native: 'اردو', flag: '🇵🇰', region: 'Pakistan', rtl: true },
    'ta': { name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳', region: 'India / Sri Lanka / Singapore' },
    'te': { name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳', region: 'India' },
    'mr': { name: 'Marathi', native: 'मराठी', flag: '🇮🇳', region: 'India' },
    'sw': { name: 'Swahili', native: 'Kiswahili', flag: '🇰🇪', region: 'Kenya / Tanzania' },
    'sk': { name: 'Slovak', native: 'Slovenčina', flag: '🇸🇰', region: 'Slovakia' },
    'bg': { name: 'Bulgarian', native: 'Български', flag: '🇧🇬', region: 'Bulgaria' },
    'sr': { name: 'Serbian', native: 'Српски', flag: '🇷🇸', region: 'Serbia' },
    'hr': { name: 'Croatian', native: 'Hrvatski', flag: '🇭🇷', region: 'Croatia' },
    'lt': { name: 'Lithuanian', native: 'Lietuvių', flag: '🇱🇹', region: 'Lithuania' },
    'lv': { name: 'Latvian', native: 'Latviešu', flag: '🇱🇻', region: 'Latvia' },
    'et': { name: 'Estonian', native: 'Eesti', flag: '🇪🇪', region: 'Estonia' }
  };

  const COOKIE_NAME = 'googtrans';
  const STORAGE_KEY = 'tre_selected_lang';
  const THEME_KEY = 'tre_theme';

  // Cookie helpers
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = 'expires=' + d.toUTCString();
    const host = window.location.hostname;
    document.cookie = name + '=' + value + ';' + expires + ';path=/;';
    if (host.includes('.')) {
      const parts = host.split('.');
      if (parts.length >= 2) {
        const rootDomain = '.' + parts.slice(-2).join('.');
        document.cookie = name + '=' + value + ';' + expires + ';domain=' + rootDomain + ';path=/;';
      }
    }
  }

  function eraseCookie(name) {
    const host = window.location.hostname;
    document.cookie = name + '=; Max-Age=-99999999; path=/;';
    if (host.includes('.')) {
      const parts = host.split('.');
      if (parts.length >= 2) {
        const rootDomain = '.' + parts.slice(-2).join('.');
        document.cookie = name + '=; Max-Age=-99999999; domain=' + rootDomain + '; path=/;';
      }
    }
  }

  // Get active language code
  function getActiveLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES[stored]) return stored;

    const cookieVal = getCookie(COOKIE_NAME);
    if (cookieVal) {
      const parts = cookieVal.split('/');
      const code = parts[parts.length - 1];
      if (code && LANGUAGES[code]) return code;
    }

    return 'en';
  }

  // Auto-detection based on browser settings for first-time visitors
  function checkBrowserAutoDetect() {
    const hasStored = localStorage.getItem(STORAGE_KEY);
    const hasCookie = getCookie(COOKIE_NAME);
    if (hasStored || hasCookie) return;

    try {
      const navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      let detectedCode = null;

      if (navLang.startsWith('zh')) {
        detectedCode = (navLang.includes('tw') || navLang.includes('hk')) ? 'zh-TW' : 'zh-CN';
      } else {
        const short = navLang.split('-')[0];
        if (LANGUAGES[short] && short !== 'en') {
          detectedCode = short;
        }
      }

      if (detectedCode && LANGUAGES[detectedCode]) {
        console.log('[Language Auto-Detect] Detected browser language:', detectedCode);
        setCookie(COOKIE_NAME, '/en/' + detectedCode, 365);
        localStorage.setItem(STORAGE_KEY, detectedCode);
      }
    } catch (e) {
      console.warn('Auto-detect error:', e);
    }
  }

  // Initialize Dark Mode
  function initTheme() {
    try {
      const storedTheme = localStorage.getItem(THEME_KEY);
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = storedTheme === 'dark' || (!storedTheme && prefersDark);

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      updateThemeUI(isDark);
    } catch (e) {}
  }

  function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch (e) {}
    updateThemeUI(isDark);
  }

  function updateThemeUI(isDark) {
    const icon = document.getElementById('footer-theme-icon');
    const text = document.getElementById('footer-theme-text');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    if (text) text.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  }

  // Initialize Google Translate Element silently
  function initGoogleTranslate() {
    checkBrowserAutoDetect();

    // Create container
    if (!document.getElementById('google_translate_element')) {
      const div = document.createElement('div');
      div.id = 'google_translate_element';
      div.style.display = 'none';
      document.body.appendChild(div);
    }

    // Define global callback
    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement({
        pageLanguage: 'en',
        autoDisplay: false
      }, 'google_translate_element');
    };

    // Load Google Translate script
    const script = document.createElement('script');
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);
  }

  // Update Language UI elements in Footer
  function updateLanguageUI(langCode) {
    const lang = LANGUAGES[langCode] || LANGUAGES['en'];
    const flagEl = document.getElementById('footer-lang-flag');
    const nameEl = document.getElementById('footer-lang-name');

    if (flagEl) flagEl.textContent = lang.flag;
    if (nameEl) nameEl.textContent = lang.native;

    // Handle RTL
    if (lang.rtl) {
      document.documentElement.setAttribute('dir', 'rtl');
    } else {
      document.documentElement.removeAttribute('dir');
    }
  }

  // Switch site language
  function setSiteLanguage(langCode) {
    if (!LANGUAGES[langCode]) langCode = 'en';

    if (langCode === 'en') {
      eraseCookie(COOKIE_NAME);
      localStorage.removeItem(STORAGE_KEY);
      updateLanguageUI('en');
      window.location.reload();
      return;
    }

    localStorage.setItem(STORAGE_KEY, langCode);
    setCookie(COOKIE_NAME, '/en/' + langCode, 365);

    const combo = document.querySelector('.goog-te-combo');
    if (combo) {
      combo.value = langCode;
      combo.dispatchEvent(new Event('change'));
      updateLanguageUI(langCode);
      closeLanguageModal();
    } else {
      window.location.reload();
    }
  }

  // Build Language Modal Markup
  function injectLanguageModal() {
    if (document.getElementById('language-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'language-modal';
    modal.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative border border-slate-200 flex flex-col max-h-[85vh] animate-fade-in">
        <!-- Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🌐</span>
            <div>
              <h3 class="font-extrabold text-slate-900 text-lg">Select Language</h3>
              <p class="text-xs text-slate-500">Real-time neural translation across 45+ international languages</p>
            </div>
          </div>
          <button type="button" onclick="window.closeLanguageModal && window.closeLanguageModal()" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Close">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Search Input -->
        <div class="py-3">
          <div class="relative">
            <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" id="lang-search-input" placeholder="Search language or country (e.g. Spanish, हिन्दी, العربية, বাংলা)..." class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#F4413D] transition-colors">
          </div>
        </div>

        <!-- Language Grid -->
        <div id="language-grid-container" class="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5 py-2">
        </div>

        <!-- Footer -->
        <div class="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Browser auto-detection active</span>
          </span>
          <button type="button" onclick="window.setSiteLanguage && window.setSiteLanguage('en')" class="text-xs font-semibold text-[#F4413D] hover:underline cursor-pointer">
            Reset to English (Default)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Attach search event
    const searchInput = document.getElementById('lang-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        filterLanguageGrid(e.target.value.toLowerCase().trim());
      });
    }

    // Close on click outside
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeLanguageModal();
      }
    });

    // Close on Esc key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeLanguageModal();
      }
    });

    renderLanguageGrid('');
  }

  // Render Language Cards into Grid
  function renderLanguageGrid(query) {
    const container = document.getElementById('language-grid-container');
    if (!container) return;

    const activeCode = getActiveLanguage();
    container.innerHTML = '';

    const entries = Object.entries(LANGUAGES);
    const filtered = entries.filter(([code, item]) => {
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.native.toLowerCase().includes(query) ||
        item.region.toLowerCase().includes(query) ||
        code.toLowerCase().includes(query)
      );
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-8 text-center text-slate-400 text-xs">
          No languages found matching "${query}".
        </div>
      `;
      return;
    }

    filtered.forEach(([code, item]) => {
      const isActive = code === activeCode;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `lang-card text-left p-2.5 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
        isActive
          ? 'bg-red-50/70 border-[#F4413D] text-[#F4413D] font-bold shadow-2xs'
          : 'bg-white border-slate-200 hover:border-[#F4413D]/50 hover:bg-slate-50 text-slate-700'
      }`;
      card.onclick = function () {
        setSiteLanguage(code);
      };

      card.innerHTML = `
        <div class="flex items-center gap-2.5 overflow-hidden">
          <span class="text-xl shrink-0">${item.flag}</span>
          <div class="truncate">
            <div class="text-xs font-bold truncate leading-tight">${item.native}</div>
            <div class="text-[10px] text-slate-400 truncate leading-tight">${item.name}</div>
          </div>
        </div>
        ${isActive ? '<span class="text-[#F4413D] text-sm shrink-0 font-bold">✓</span>' : ''}
      `;

      container.appendChild(card);
    });
  }

  function filterLanguageGrid(query) {
    renderLanguageGrid(query);
  }

  // Modal open/close handlers
  function openLanguageModal() {
    injectLanguageModal();
    const modal = document.getElementById('language-modal');
    if (modal) {
      renderLanguageGrid('');
      const search = document.getElementById('lang-search-input');
      if (search) search.value = '';
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      if (search) setTimeout(() => search.focus(), 50);
    }
  }

  function closeLanguageModal() {
    const modal = document.getElementById('language-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  // Expose global window API
  window.openLanguageModal = openLanguageModal;
  window.closeLanguageModal = closeLanguageModal;
  window.setSiteLanguage = setSiteLanguage;
  window.toggleDarkMode = toggleDarkMode;

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      initGoogleTranslate();
      updateLanguageUI(getActiveLanguage());
    });
  } else {
    initTheme();
    initGoogleTranslate();
    updateLanguageUI(getActiveLanguage());
  }
})();
