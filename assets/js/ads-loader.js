/**
 * tempemails.site - Universal Dynamic Ads Loader
 * High-performance, zero-layout-shift ad injection engine for Adsterra & Google AdSense.
 * Runs seamlessly across all pages: Home, Blog Listing, Articles, About, Contact, FAQ, etc.
 */

(function () {
  'use strict';

  let lastFetchTime = 0;
  let cachedAds = null;

  // Render isolated iframe banner with srcdoc to isolate window.atOptions
  function renderBannerInIframe(container, rawCode, width, height) {
    if (!container || !rawCode || !rawCode.trim()) return;

    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignItems = 'center';
    wrapper.style.width = '100%';
    wrapper.style.overflow = 'hidden';

    const iframe = document.createElement('iframe');
    iframe.style.width = width ? width + 'px' : '100%';
    iframe.style.height = height ? height + 'px' : 'auto';
    iframe.style.minHeight = (height || 50) + 'px';
    iframe.style.maxWidth = '100%';
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.scrolling = 'no';
    iframe.frameBorder = '0';
    iframe.setAttribute('title', 'Sponsored Advertisement');

    const srcdocContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base target="_blank">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
  </style>
</head>
<body>
  ${rawCode}
  <script>
    function notifyHeight() {
      try {
        var h = document.body.scrollHeight || document.documentElement.scrollHeight;
        if (h > 20 && window.frameElement) {
          window.frameElement.style.height = h + 'px';
        }
      } catch(e) {}
    }
    window.addEventListener('load', notifyHeight);
    setTimeout(notifyHeight, 1000);
    setTimeout(notifyHeight, 2500);
  <\/script>
</body>
</html>`;

    iframe.srcdoc = srcdocContent;
    wrapper.appendChild(iframe);
    container.appendChild(wrapper);
  }

  // Render Global Scripts (Popunder & Social Bar) directly on document.body without any hidden wrapper
  function renderGlobalScript(tagId, config) {
    const existing = document.getElementById(tagId);
    if (!config || !config.enabled || !config.code || !config.code.trim()) {
      if (existing) existing.remove();
      return;
    }

    // Deduplicate - do not re-insert identical active script
    if (existing) return;

    const temp = document.createElement('div');
    temp.innerHTML = config.code.trim();
    const scriptTag = temp.querySelector('script');

    const s = document.createElement('script');
    s.id = tagId;
    if (scriptTag) {
      Array.from(scriptTag.attributes).forEach(attr => s.setAttribute(attr.name, attr.value));
      if (scriptTag.src) {
        s.src = scriptTag.src;
      } else {
        s.textContent = scriptTag.textContent;
      }
    } else {
      const match = config.code.match(/https?:\/\/[^\s"']+/);
      if (match) {
        s.src = match[0];
      } else {
        s.textContent = config.code;
      }
    }
    s.async = true;
    document.body.appendChild(s);
  }

  // Helper: Find or create element before footer
  function getOrCreateBottomSlot() {
    let slot = document.getElementById('ad-slot-bottom');
    if (!slot) {
      const footer = document.querySelector('footer');
      if (footer) {
        slot = document.createElement('div');
        slot.id = 'ad-slot-bottom';
        slot.className = 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-center items-center';
        footer.parentNode.insertBefore(slot, footer);
      }
    }
    return slot;
  }

  // Helper: Find or create top slot after header
  function getOrCreateTopSlot() {
    let slot = document.getElementById('ad-slot-top');
    if (!slot) {
      const header = document.querySelector('header');
      if (header) {
        slot = document.createElement('div');
        slot.id = 'ad-slot-top';
        slot.className = 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-1 flex justify-center items-center';
        header.parentNode.insertBefore(slot, header.nextSibling);
      }
    }
    return slot;
  }

  // Load and Render Dynamic Ads
  async function loadAndRenderAds(force = false) {
    const now = Date.now();
    if (!force && cachedAds && (now - lastFetchTime < 5000)) {
      applyAds(cachedAds);
      return cachedAds;
    }

    try {
      const res = await fetch(`/api/ads?_t=${now}`, { cache: 'no-store' });
      if (!res.ok) return;
      const ads = await res.json();
      cachedAds = ads;
      lastFetchTime = now;
      applyAds(ads);
      return ads;
    } catch (e) {
      console.warn('tempemails ads: Network error fetching ads config:', e);
    }
  }

  function applyAds(ads) {
    const topSlot = document.getElementById('ad-slot-top');
    const topDesktop = document.getElementById('ad-slot-top-desktop');
    const topMobile = document.getElementById('ad-slot-top-mobile');
    const middleSlot = document.getElementById('ad-slot-middle');
    const sidebarSlot = document.getElementById('ad-slot-sidebar');
    const sidebarRightSlot = document.getElementById('ad-slot-sidebar-right');
    const bottomSlot = document.getElementById('ad-slot-bottom');

    // If master is disabled or no ads config, cleanly hide all slots
    if (!ads || !ads.master_enabled) {
      [topSlot, topDesktop, topMobile, middleSlot, sidebarSlot, sidebarRightSlot, bottomSlot].forEach(el => {
        if (el) {
          el.classList.add('hidden');
          el.innerHTML = '';
        }
      });
      renderGlobalScript('adsterra-popunder-script', null);
      renderGlobalScript('adsterra-socialbar-script', null);
      return;
    }

    // 1. Top Header Banner (Desktop 728x90, Mobile 320x50)
    let hasTopAd = false;
    const isTopDesktopEnabled = Boolean(ads.top_banner && ads.top_banner.enabled && ads.top_banner.code && ads.top_banner.code.trim());
    const isTopMobileEnabled = Boolean(ads.top_banner_mobile && ads.top_banner_mobile.enabled && ads.top_banner_mobile.code && ads.top_banner_mobile.code.trim());

    if (topDesktop) {
      if (isTopDesktopEnabled) {
        topDesktop.classList.remove('hidden');
        renderBannerInIframe(topDesktop, ads.top_banner.code, 728, 90);
        hasTopAd = true;
      } else {
        topDesktop.classList.add('hidden');
        topDesktop.innerHTML = '';
      }
    }

    if (topMobile) {
      if (isTopMobileEnabled) {
        topMobile.classList.remove('hidden');
        renderBannerInIframe(topMobile, ads.top_banner_mobile.code, 320, 50);
        hasTopAd = true;
      } else if (isTopDesktopEnabled) {
        topMobile.classList.remove('hidden');
        renderBannerInIframe(topMobile, ads.top_banner.code, 728, 90);
        hasTopAd = true;
      } else {
        topMobile.classList.add('hidden');
        topMobile.innerHTML = '';
      }
    }

    // If page doesn't have top-desktop/mobile subslots but has top_banner enabled
    if (!topDesktop && !topMobile && isTopDesktopEnabled) {
      const dynamicTop = getOrCreateTopSlot();
      if (dynamicTop) {
        dynamicTop.classList.remove('hidden');
        renderBannerInIframe(dynamicTop, ads.top_banner.code, 728, 90);
        hasTopAd = true;
      }
    }

    if (topSlot) {
      if (hasTopAd) {
        topSlot.classList.remove('hidden');
      } else {
        topSlot.classList.add('hidden');
        topSlot.innerHTML = '';
      }
    }

    // 2. Middle In-Feed Banner (300x250)
    if (middleSlot) {
      if (ads.middle_banner && ads.middle_banner.enabled && ads.middle_banner.code && ads.middle_banner.code.trim()) {
        middleSlot.classList.remove('hidden');
        renderBannerInIframe(middleSlot, ads.middle_banner.code, 300, 250);
      } else {
        middleSlot.classList.add('hidden');
        middleSlot.innerHTML = '';
      }
    }

    // 3. Left Sidebar Banner (160x600 - Strictly Desktop >= 1280px)
    if (sidebarSlot) {
      if (ads.sidebar_banner && ads.sidebar_banner.enabled && ads.sidebar_banner.code && ads.sidebar_banner.code.trim()) {
        sidebarSlot.classList.add('active-sidebar-ad');
        sidebarSlot.classList.remove('hidden');
        if (window.innerWidth >= 1280) {
          renderBannerInIframe(sidebarSlot, ads.sidebar_banner.code, 160, 600);
        }
      } else {
        sidebarSlot.classList.remove('active-sidebar-ad');
        sidebarSlot.classList.add('hidden');
        sidebarSlot.innerHTML = '';
      }
    }

    // 4. Right Sidebar Banner (160x300 - Strictly Desktop >= 1280px)
    if (sidebarRightSlot) {
      const rightConfig = ads.sidebar_banner_right || ads.sidebar_banner;
      if (rightConfig && rightConfig.enabled && rightConfig.code && rightConfig.code.trim()) {
        sidebarRightSlot.classList.add('active-sidebar-ad');
        sidebarRightSlot.classList.remove('hidden');
        if (window.innerWidth >= 1280) {
          renderBannerInIframe(sidebarRightSlot, rightConfig.code, 160, 300);
        }
      } else {
        sidebarRightSlot.classList.remove('active-sidebar-ad');
        sidebarRightSlot.classList.add('hidden');
        sidebarRightSlot.innerHTML = '';
      }
    }

    // 5. Bottom Leaderboard Banner (468x60 / 728x90)
    const isBottomEnabled = Boolean(ads.bottom_banner && ads.bottom_banner.enabled && ads.bottom_banner.code && ads.bottom_banner.code.trim());
    if (isBottomEnabled) {
      const targetBottom = getOrCreateBottomSlot();
      if (targetBottom) {
        targetBottom.classList.remove('hidden');
        renderBannerInIframe(targetBottom, ads.bottom_banner.code, 468, 60);
      }
    } else if (bottomSlot) {
      bottomSlot.classList.add('hidden');
      bottomSlot.innerHTML = '';
    }

    // 6. Global Popunder & Social Bar (Direct injection into body on ALL pages)
    renderGlobalScript('adsterra-popunder-script', ads.popunder);
    renderGlobalScript('adsterra-socialbar-script', ads.social_bar);
  }

  // Export to window for external callers
  window.loadAndRenderAds = loadAndRenderAds;
  window.renderBannerInIframe = renderBannerInIframe;
  window.renderGlobalScript = renderGlobalScript;

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadAndRenderAds());
  } else {
    loadAndRenderAds();
  }
})();
