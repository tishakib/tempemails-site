// blog_renderer.js
// Shared rendering engine for blog listing and individual article pages

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'October 13, 2026';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'October 13, 2026';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function renderArticleHtml(article, allArticles = []) {
  const canonicalUrl = `https://www.tempemails.site/blog/${article.slug}`;
  const publishDate = article.created_at ? article.created_at.substring(0, 10) : (article.createdAt ? article.createdAt.substring(0, 10) : '2026-10-13');
  const displayDate = formatDisplayDate(article.created_at || article.createdAt);
  const coverImg = article.cover_image || article.coverImage || 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80';
  const fullCoverImage = coverImg.startsWith('http') ? coverImg : ('https://www.tempemails.site' + coverImg);
  const authorName = article.author || 'Shakib Hasan';
  const readTimeStr = article.read_time || article.readTime || '7 min read';
  const contentBody = article.content_html || article.contentHtml || `<p class="lead">${article.summary || ''}</p>`;

  // Pick 3 related articles
  const otherArticles = allArticles.filter(a => a.slug !== article.slug);
  const relatedArticles = otherArticles.slice(0, 3);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} | tempemails.site</title>
  <meta name="description" content="${article.summary}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="index, follow">
  <meta name="google-site-verification" content="_L5-YT0C3h80QPkTQncQ_MDu0QFNbBLnH4ZaQna9FPI">

  <!-- Favicon & Icons -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png">

  <!-- Open Graph / Social Sharing -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${article.title}">
  <meta property="og:description" content="${article.summary}">
  <meta property="og:site_name" content="tempemails.site">
  <meta property="og:image" content="${fullCoverImage}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${article.title}">
  <meta name="twitter:description" content="${article.summary}">
  <meta name="twitter:image" content="${fullCoverImage}">

  <!-- Tailwind CSS & Fonts -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              primary: '#F4413D',
              hover: '#D7302C',
              light: '#FEE2E2',
              subtle: '#FFF5F5',
              navy: '#0F172A',
              slate: '#1E293B'
            }
          }
        }
      }
    };
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/styles.css">

  <!-- Immediate Theme Init (Prevent FOUC) -->
  <script>
    (function(){try{const t=localStorage.getItem('tre_theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();
  </script>

  <!-- Structured Data: BreadcrumbList -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://www.tempemails.site/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Blog",
        "item": "https://www.tempemails.site/blog"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": ${JSON.stringify(article.title)},
        "item": ${JSON.stringify(canonicalUrl)}
      }
    ]
  }
  </script>

  <!-- Structured Data: BlogPosting -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": ${JSON.stringify(article.title)},
    "description": ${JSON.stringify(article.summary)},
    "image": {
      "@type": "ImageObject",
      "url": ${JSON.stringify(fullCoverImage)},
      "width": 1200,
      "height": 630
    },
    "url": ${JSON.stringify(canonicalUrl)},
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": ${JSON.stringify(canonicalUrl)}
    },
    "datePublished": "${publishDate}",
    "dateModified": "${publishDate}",
    "author": {
      "@type": "Person",
      "name": "${authorName}"
    },
    "publisher": {
      "@type": "Organization",
      "name": "tempemails.site",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.tempemails.site/assets/img/logo.png"
      }
    }
  }
  </script>
</head>
<body class="bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col font-sans">

  <!-- HEADER -->
  <header class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <a href="/" class="flex items-center gap-3 group">
        <img src="/assets/img/logo.png" alt="tempemails.site logo" class="w-10 h-10 rounded-xl shadow-xs object-cover border border-slate-200 group-hover:scale-105 transition-transform">
        <div class="flex flex-col">
          <span class="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
            tempemails<span class="text-[#F4413D]">.site</span>
          </span>
          <span class="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Disposable Mail Service</span>
        </div>
      </a>

      <nav class="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
        <a href="/" class="hover:text-slate-900 transition-colors">Home</a>
        <a href="/about" class="hover:text-slate-900 transition-colors">About Us</a>
        <a href="/faq" class="hover:text-slate-900 transition-colors">FAQ</a>
        <a href="/contact" class="hover:text-slate-900 transition-colors">Contact Us</a>
        <a href="/blog" class="text-[#F4413D] font-bold">Blog</a>
      </nav>

      <a href="/" class="px-4 py-2 bg-[#F4413D] hover:bg-red-600 text-white text-xs font-bold rounded-xl shadow-sm transition-colors">
        Open Inbox
      </a>
    </div>
  </header>

  <!-- BREADCRUMB NAVIGATION -->
  <div class="bg-slate-100/70 border-b border-slate-200/80 py-2.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
    <div class="max-w-4xl mx-auto flex items-center gap-2">
      <a href="/" class="hover:text-[#F4413D] transition-colors">Home</a>
      <span>&rsaquo;</span>
      <a href="/blog" class="hover:text-[#F4413D] transition-colors">Blog</a>
      <span>&rsaquo;</span>
      <span class="text-slate-700 font-medium truncate max-w-xs sm:max-w-md">${article.title}</span>
    </div>
  </div>

  <!-- ARTICLE MAIN CONTENT -->
  <main class="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
    <article class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-10 space-y-8">
      
      <!-- Article Header -->
      <header class="border-b border-slate-100 pb-6">
        <div class="flex items-center gap-2 mb-3 flex-wrap">
          <span class="text-xs font-bold uppercase tracking-wider bg-red-50 text-[#F4413D] px-2.5 py-1 rounded-md border border-red-100">
            ${article.category}
          </span>
          <span class="text-slate-300">&bull;</span>
          <span class="text-xs text-slate-500">${displayDate}</span>
          <span class="text-slate-300">&bull;</span>
          <span class="text-xs text-slate-500">${readTimeStr}</span>
          <span class="text-slate-300">&bull;</span>
          <span class="text-xs text-slate-500 font-medium">By ${authorName}</span>
        </div>
        <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
          ${article.title}
        </h1>
        <p class="text-base text-slate-600 mt-3 leading-relaxed">
          ${article.summary}
        </p>
      </header>

      <!-- Featured Cover Image (Real high-res photography / artwork) -->
      <figure class="my-6 rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs bg-slate-900">
        <img src="${coverImg}" alt="${article.title}" width="1200" height="630" class="w-full h-auto max-h-[460px] object-cover transition-transform duration-500 hover:scale-[1.01]" loading="eager" fetchpriority="high">
      </figure>

      <!-- Article Body -->
      <div class="prose prose-slate max-w-none text-slate-700 text-sm sm:text-base leading-relaxed space-y-6">
        ${contentBody}
      </div>

      <!-- Call to Action Banner -->
      <div class="p-6 bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border border-red-200 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 class="font-bold text-slate-900 text-base">Need a free disposable temporary email address?</h3>
          <p class="text-xs text-slate-600 mt-1">Generate up to 5 concurrent inboxes with 1-click OTP extraction on tempemails.site.</p>
        </div>
        <a href="/" class="px-5 py-2.5 bg-[#F4413D] hover:bg-red-600 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0">
          Create Temp Email &rarr;
        </a>
      </div>

      <!-- Related Guides & Articles -->
      ${relatedArticles.length > 0 ? `
      <div class="pt-8 border-t border-slate-100">
        <h3 class="font-bold text-slate-900 text-lg mb-4">Related Privacy & Email Guides</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          ${relatedArticles.map(rel => `
            <a href="/blog/${rel.slug}" class="rounded-xl border border-slate-200 hover:border-[#F4413D]/40 hover:bg-slate-50 transition-all flex flex-col justify-between group overflow-hidden bg-white shadow-2xs">
              <div class="h-32 w-full overflow-hidden bg-slate-900 relative">
                <img src="${rel.cover_image || rel.coverImage}" alt="${rel.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" width="400" height="210">
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
              </div>
              <div class="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-[#F4413D] block mb-1">${rel.category}</span>
                  <h4 class="font-bold text-slate-800 text-xs line-clamp-2 group-hover:text-[#F4413D] transition-colors">${rel.title}</h4>
                </div>
                <span class="text-[11px] mt-3 flex items-center gap-1 font-semibold text-[#F4413D]">Read guide &rarr;</span>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
      ` : ''}

    </article>
  </main>

  <!-- FOOTER -->
  <footer class="bg-white border-t border-slate-200 mt-auto">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        
        <!-- Brand Info -->
        <div class="space-y-4 md:col-span-1">
          <div class="flex items-center gap-3">
            <img src="/assets/img/logo.png" alt="tempemails.site logo" class="w-9 h-9 rounded-xl shadow-xs object-cover border border-slate-200">
            <span class="text-lg font-bold text-slate-900 tracking-tight">tempemails<span class="text-[#F4413D]">.site</span></span>
          </div>
          <p class="text-xs text-slate-500 leading-relaxed">
            The modern, privacy-focused disposable temporary email service. Shielding personal inboxes from spam, tracking, and data breaches worldwide.
          </p>
          <div id="system-status-indicator" class="flex items-center gap-2 text-xs text-slate-500">
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>All systems operational</span>
          </div>
        </div>

        <!-- Navigation -->
        <div>
          <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Navigation</h4>
          <ul class="space-y-2 text-xs text-slate-600">
            <li><a href="/" class="hover:text-[#F4413D] transition-colors">Home</a></li>
            <li><a href="/about" class="hover:text-[#F4413D] transition-colors">About Us</a></li>
            <li><a href="/faq" class="hover:text-[#F4413D] transition-colors">FAQ</a></li>
            <li><a href="/contact" class="hover:text-[#F4413D] transition-colors">Contact Us</a></li>
          </ul>
        </div>

        <!-- Resources & Guides -->
        <div>
          <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Resources & Guides</h4>
          <ul class="space-y-2 text-xs text-slate-600">
            <li><a href="/blog" class="hover:text-[#F4413D] transition-colors font-semibold text-slate-900">Blog &amp; Privacy Articles &rarr;</a></li>
            <li><a href="/blog/what-is-temp-mail" class="hover:text-[#F4413D] transition-colors">What Is Temp Mail?</a></li>
            <li><a href="/blog/how-to-use-temporary-email" class="hover:text-[#F4413D] transition-colors">How to Use Temp Mail</a></li>
            <li><a href="/blog/temporary-email-otp-verification" class="hover:text-[#F4413D] transition-colors">OTP Verification Guide</a></li>
          </ul>
        </div>

        <!-- Legal & Policies -->
        <div>
          <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Legal & Policies</h4>
          <ul class="space-y-2 text-xs text-slate-600">
            <li><a href="/privacy" class="hover:text-[#F4413D] transition-colors">Privacy Policy</a></li>
            <li><a href="/terms" class="hover:text-[#F4413D] transition-colors">Terms of Service</a></li>
            <li><a href="/privacy#cookies" class="hover:text-[#F4413D] transition-colors">Cookie Policy</a></li>
            <li><button type="button" onclick="window.openCookieSettingsModal && window.openCookieSettingsModal()" class="hover:text-[#F4413D] transition-colors flex items-center gap-1 text-left cursor-pointer">🍪 Cookie Preferences</button></li>
          </ul>
        </div>

      </div>

      <!-- Copyright & Controls -->
      <div class="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
        <div class="flex flex-col sm:flex-row items-center gap-2">
          <p>&copy; 2026 tempemails.site. All rights reserved.</p>
          <span class="hidden sm:inline text-slate-300">&bull;</span>
          <p>Privacy-focused ephemeral email architecture</p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <button type="button" onclick="window.openLanguageModal && window.openLanguageModal()" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-[#F4413D] text-slate-700 hover:text-[#F4413D] transition-all shadow-2xs font-medium text-xs cursor-pointer group">
            <span id="footer-lang-flag">🌐</span>
            <span id="footer-lang-name">English</span>
            <svg class="w-3.5 h-3.5 text-slate-400 group-hover:text-[#F4413D] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
          </button>

          <button type="button" onclick="window.toggleDarkMode && window.toggleDarkMode()" id="footer-theme-toggle" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-[#F4413D] text-slate-700 hover:text-[#F4413D] transition-all shadow-2xs font-medium text-xs cursor-pointer">
            <span id="footer-theme-icon">🌙</span>
            <span id="footer-theme-text">Dark Mode</span>
          </button>
        </div>
      </div>
    </div>
  </footer>

  <!-- Privacy & Cookie Consent Manager -->
  <script src="/assets/js/cookie-consent.js"></script>
  <!-- Neural Language Translator & Dark Mode Engine -->
  <script src="/assets/js/translator-theme.js"></script>
</body>
</html>`;
}

function renderBlogListingHtml(allArticles = []) {
  const publishedArticles = allArticles.filter(a => a.status !== 'draft');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog &amp; Privacy Guides | tempemails.site</title>
  <meta name="description" content="Read expert guides and tutorials on temporary email addresses, OTP verification, online anonymity, and personal inbox protection against spam and tracking.">
  <link rel="canonical" href="https://www.tempemails.site/blog">
  <meta name="robots" content="index, follow">
  <meta name="google-site-verification" content="_L5-YT0C3h80QPkTQncQ_MDu0QFNbBLnH4ZaQna9FPI">

  <!-- Favicon & Icons -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png">

  <!-- Open Graph / Social Sharing -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://www.tempemails.site/blog">
  <meta property="og:title" content="Blog &amp; Privacy Guides | tempemails.site">
  <meta property="og:description" content="Read expert guides and tutorials on temporary email addresses, OTP verification, online anonymity, and personal inbox protection against spam and tracking.">
  <meta property="og:site_name" content="tempemails.site">
  <meta property="og:image" content="https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&auto=format&fit=crop&q=80">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Blog &amp; Privacy Guides | tempemails.site">
  <meta name="twitter:description" content="Read expert guides and tutorials on temporary email addresses, OTP verification, online anonymity, and personal inbox protection against spam and tracking.">
  <meta name="twitter:image" content="https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&auto=format&fit=crop&q=80">

  <!-- Tailwind CSS & Fonts -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              primary: '#F4413D',
              hover: '#D7302C',
              light: '#FEE2E2',
              subtle: '#FFF5F5',
              navy: '#0F172A',
              slate: '#1E293B'
            }
          }
        }
      }
    };
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/styles.css">

  <!-- Immediate Theme Init (Prevent FOUC) -->
  <script>
    (function(){try{const t=localStorage.getItem('tre_theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();
  </script>

  <!-- Structured Data: BreadcrumbList & CollectionPage -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "tempemails.site Blog & Tech Articles",
    "url": "https://www.tempemails.site/blog",
    "description": "Comprehensive guides and technical tutorials on disposable email, OTP verification, and privacy preservation."
  }
  </script>
</head>
<body class="bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col font-sans">

  <!-- HEADER -->
  <header class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <a href="/" class="flex items-center gap-3 group">
        <img src="/assets/img/logo.png" alt="tempemails.site logo" class="w-10 h-10 rounded-xl shadow-xs object-cover border border-slate-200 group-hover:scale-105 transition-transform">
        <div class="flex flex-col">
          <span class="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
            tempemails<span class="text-[#F4413D]">.site</span>
          </span>
          <span class="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Disposable Mail Service</span>
        </div>
      </a>

      <nav class="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
        <a href="/" class="hover:text-slate-900 transition-colors">Home</a>
        <a href="/about" class="hover:text-slate-900 transition-colors">About Us</a>
        <a href="/faq" class="hover:text-slate-900 transition-colors">FAQ</a>
        <a href="/contact" class="hover:text-slate-900 transition-colors">Contact Us</a>
        <a href="/blog" class="text-[#F4413D] font-bold">Blog</a>
      </nav>

      <a href="/" class="px-4 py-2 bg-[#F4413D] hover:bg-red-600 text-white text-xs font-bold rounded-xl shadow-sm transition-colors">
        Open Inbox
      </a>
    </div>
  </header>

  <!-- BREADCRUMB NAVIGATION -->
  <div class="bg-slate-100/70 border-b border-slate-200/80 py-2.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
    <div class="max-w-6xl mx-auto flex items-center gap-2">
      <a href="/" class="hover:text-[#F4413D] transition-colors">Home</a>
      <span>&rsaquo;</span>
      <span class="text-slate-700 font-medium">Blog</span>
    </div>
  </div>

  <!-- CONTENT -->
  <main class="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
    
    <div class="text-center max-w-2xl mx-auto mb-12">
      <span class="text-xs font-bold uppercase tracking-wider text-[#F4413D]">Articles & Tutorials</span>
      <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1">Privacy, Security &amp; Email Guides</h1>
      <p class="text-slate-600 mt-2 text-sm sm:text-base">
        Explore in-depth technical guides on disposable email, OTP extraction, privacy hygiene, and online account protection.
      </p>
    </div>

    <!-- Article Cards Grid (30 Complete Visual Illustrated Guides) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${publishedArticles.map(b => {
        const coverImg = b.cover_image || b.coverImage || 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80';
        const displayDate = formatDisplayDate(b.created_at || b.createdAt);
        const readTimeStr = b.read_time || b.readTime || '7 min read';
        const authorName = b.author || 'Shakib Hasan';

        return `
        <article class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-all group">
          <a href="/blog/${b.slug}" class="block overflow-hidden h-48 sm:h-52 bg-slate-900 relative">
            <img src="${coverImg}" alt="${b.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" width="400" height="210">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none"></div>
            <span class="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wider bg-slate-900/80 backdrop-blur-md text-[#F4413D] border border-red-500/30 px-2.5 py-1 rounded-md shadow-xs">
              ${b.category}
            </span>
          </a>
          <div class="p-6 flex-1 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2 text-slate-400 text-xs">
                <span>${displayDate}</span>
                <span>${readTimeStr}</span>
              </div>
              <h2 class="font-extrabold text-slate-900 text-lg leading-snug group-hover:text-[#F4413D] transition-colors mb-3">
                <a href="/blog/${b.slug}">${b.title}</a>
              </h2>
              <p class="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
                ${b.summary}
              </p>
            </div>
            <div class="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span class="text-slate-400">By ${authorName}</span>
              <a href="/blog/${b.slug}" class="text-[#F4413D] font-bold group-hover:underline flex items-center gap-1">
                Read guide &rarr;
              </a>
            </div>
          </div>
        </article>
      `}).join('')}
    </div>

  </main>

  <!-- FOOTER -->
  <footer class="bg-white border-t border-slate-200 mt-auto">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        
        <!-- Brand Info -->
        <div class="space-y-4 md:col-span-1">
          <div class="flex items-center gap-3">
            <img src="/assets/img/logo.png" alt="tempemails.site logo" class="w-9 h-9 rounded-xl shadow-xs object-cover border border-slate-200">
            <span class="text-lg font-bold text-slate-900 tracking-tight">tempemails<span class="text-[#F4413D]">.site</span></span>
          </div>
          <p class="text-xs text-slate-500 leading-relaxed">
            The modern, privacy-focused disposable temporary email service. Shielding personal inboxes from spam, tracking, and data breaches worldwide.
          </p>
          <div id="system-status-indicator" class="flex items-center gap-2 text-xs text-slate-500">
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>All systems operational</span>
          </div>
        </div>

        <!-- Navigation -->
        <div>
          <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Navigation</h4>
          <ul class="space-y-2 text-xs text-slate-600">
            <li><a href="/" class="hover:text-[#F4413D] transition-colors">Home</a></li>
            <li><a href="/about" class="hover:text-[#F4413D] transition-colors">About Us</a></li>
            <li><a href="/faq" class="hover:text-[#F4413D] transition-colors">FAQ</a></li>
            <li><a href="/contact" class="hover:text-[#F4413D] transition-colors">Contact Us</a></li>
          </ul>
        </div>

        <!-- Resources & Guides -->
        <div>
          <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Resources & Guides</h4>
          <ul class="space-y-2 text-xs text-slate-600">
            <li><a href="/blog" class="hover:text-[#F4413D] transition-colors font-semibold text-slate-900">Blog &amp; Privacy Articles &rarr;</a></li>
            <li><a href="/blog/what-is-temp-mail" class="hover:text-[#F4413D] transition-colors">What Is Temp Mail?</a></li>
            <li><a href="/blog/how-to-use-temporary-email" class="hover:text-[#F4413D] transition-colors">How to Use Temp Mail</a></li>
            <li><a href="/blog/temporary-email-otp-verification" class="hover:text-[#F4413D] transition-colors">OTP Verification Guide</a></li>
          </ul>
        </div>

        <!-- Legal & Policies -->
        <div>
          <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Legal & Policies</h4>
          <ul class="space-y-2 text-xs text-slate-600">
            <li><a href="/privacy" class="hover:text-[#F4413D] transition-colors">Privacy Policy</a></li>
            <li><a href="/terms" class="hover:text-[#F4413D] transition-colors">Terms of Service</a></li>
            <li><a href="/privacy#cookies" class="hover:text-[#F4413D] transition-colors">Cookie Policy</a></li>
            <li><button type="button" onclick="window.openCookieSettingsModal && window.openCookieSettingsModal()" class="hover:text-[#F4413D] transition-colors flex items-center gap-1 text-left cursor-pointer">🍪 Cookie Preferences</button></li>
          </ul>
        </div>

      </div>

      <!-- Copyright & Controls -->
      <div class="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
        <div class="flex flex-col sm:flex-row items-center gap-2">
          <p>&copy; 2026 tempemails.site. All rights reserved.</p>
          <span class="hidden sm:inline text-slate-300">&bull;</span>
          <p>Privacy-focused ephemeral email architecture</p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <button type="button" onclick="window.openLanguageModal && window.openLanguageModal()" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-[#F4413D] text-slate-700 hover:text-[#F4413D] transition-all shadow-2xs font-medium text-xs cursor-pointer group">
            <span id="footer-lang-flag">🌐</span>
            <span id="footer-lang-name">English</span>
            <svg class="w-3.5 h-3.5 text-slate-400 group-hover:text-[#F4413D] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
          </button>

          <button type="button" onclick="window.toggleDarkMode && window.toggleDarkMode()" id="footer-theme-toggle" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-[#F4413D] text-slate-700 hover:text-[#F4413D] transition-all shadow-2xs font-medium text-xs cursor-pointer">
            <span id="footer-theme-icon">🌙</span>
            <span id="footer-theme-text">Dark Mode</span>
          </button>
        </div>
      </div>
    </div>
  </footer>

  <!-- Privacy & Cookie Consent Manager -->
  <script src="/assets/js/cookie-consent.js"></script>
  <!-- Neural Language Translator & Dark Mode Engine -->
  <script src="/assets/js/translator-theme.js"></script>
</body>
</html>`;
}

module.exports = {
  renderArticleHtml,
  renderBlogListingHtml,
  formatDisplayDate
};
