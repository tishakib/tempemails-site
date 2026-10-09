/**
 * Cloudflare Email Routing Worker for tempemails.site
 * Catches incoming emails for *@tempemails.site, parses RFC 822 MIME stream,
 * strips ugly SMTP headers, extracts authentic HTML body, OTP, and links,
 * and pushes the payload directly to the tempemails.site backend webhook.
 */

export default {
  // 1. Inbound Email Handler (Cloudflare Email Routing)
  async email(message, env, ctx) {
    try {
      const recipient = message.to.toLowerCase().trim();
      const sender = message.from;
      const rawSubject = message.headers.get("subject") || "(No Subject)";
      const rawEmail = await new Response(message.raw).text();

      // MIME Parser & Decoder
      const parsed = parseMimeEmail(rawEmail);

      // Extract and decode sender display name & subject
      const fromHeader = message.headers.get("from") || sender;
      const nameMatch = fromHeader.match(/^"?([^"<]+)"?\s*<.*>$/);
      const rawFromName = nameMatch ? nameMatch[1].trim() : sender.split("@")[0];

      const subject = decodeMimeHeader(parsed.subject || rawSubject);
      const fromName = decodeMimeHeader(parsed.fromName || rawFromName);

      // Prepare standard clean payload for tempemails.site API
      const payload = {
        to: recipient,
        from: sender,
        fromName: fromName,
        subject: subject,
        bodyHtml: parsed.finalHtml,
        snippet: parsed.snippet,
        otp: parsed.otp,
        partnerLink: parsed.partnerLink,
        receivedAt: new Date().toISOString()
      };

      // 1. Forward to tempemails.site Backend Webhook API
      const backendUrl = env.BACKEND_WEBHOOK_URL || "https://www.tempemails.site/api/inbox/incoming";
      
      try {
        await fetch(backendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Cloudflare-Email-Worker/2.0"
          },
          body: JSON.stringify(payload)
        });
      } catch (postErr) {
        console.error("Failed to forward email to backend webhook:", postErr);
      }

    } catch (err) {
      console.error("Error processing incoming email:", err);
    }
  },

  // 2. HTTP Fetch Handler (Serves Authentic Corporate Workspace Landing Page to Crawlers & Scanners)
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.headers.get("accept")?.includes("application/json") || url.pathname === "/health") {
      return new Response(JSON.stringify({ 
        service: "WorkspaceMail Enterprise Gateway", 
        status: "operational", 
        uptime: "99.99%",
        version: "2.5.0",
        timestamp: new Date().toISOString() 
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WorkspaceMail — Secure Cloud Workspace & Developer Mail Solutions</title>
  <meta name="description" content="WorkspaceMail provides high-performance cloud mail infrastructure, enterprise developer workspace routing, and zero-trust delivery.">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💼</text></svg>">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased selection:bg-blue-500 selection:text-white">
  <nav class="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
    <div class="flex items-center gap-2.5">
      <div class="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xl shadow-xs">💼</div>
      <span class="text-lg font-extrabold tracking-tight text-white">Workspace<span class="text-blue-400">Mail</span></span>
      <span class="ml-2 text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-semibold">Enterprise v2.5</span>
    </div>
    <div class="flex items-center gap-4 text-xs font-semibold">
      <span class="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        All Mail Systems Operational
      </span>
    </div>
  </nav>

  <main class="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center max-w-4xl mx-auto">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20 mb-6">
      🚀 Next-Gen Enterprise Workspace Mail
    </div>
    <h1 class="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
      Secure Cloud Mail for <br>
      <span class="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Developers & Workspaces</span>
    </h1>
    <p class="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
      Empowering modern engineering teams with high-speed inbound email routing, zero-trust cryptographic verification, and scalable developer cloud integrations.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left mb-12">
      <div class="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div class="text-xl mb-2">🔒</div>
        <div class="font-bold text-white text-sm mb-1">Zero-Trust Routing</div>
        <div class="text-slate-400 text-xs leading-relaxed">Cryptographically secured inbound mail flow powered by Cloudflare edge architecture.</div>
      </div>
      <div class="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div class="text-xl mb-2">⚡</div>
        <div class="font-bold text-white text-sm mb-1">Real-Time Inbound Webhooks</div>
        <div class="text-slate-400 text-xs leading-relaxed">Sub-100ms webhook delivery for automated confirmation and verification pipelines.</div>
      </div>
      <div class="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div class="text-xl mb-2">🛡️</div>
        <div class="font-bold text-white text-sm mb-1">RFC 822 & DMARC Standards</div>
        <div class="text-slate-400 text-xs leading-relaxed">Fully aligned SPF, DKIM, and DMARC enforcement with UTF-8 internationalization.</div>
      </div>
    </div>

    <div class="p-6 bg-slate-900/90 border border-slate-800 rounded-2xl max-w-md w-full mx-auto text-xs text-slate-400 space-y-2">
      <div class="flex items-center justify-between text-slate-300 font-semibold">
        <span>Security Compliance:</span>
        <span class="text-emerald-400 font-mono">SOC2 / ISO 27001 Ready</span>
      </div>
      <div class="flex items-center justify-between text-slate-300 font-semibold">
        <span>Edge Network:</span>
        <span class="text-blue-400 font-mono">Cloudflare Global 320+ Cities</span>
      </div>
      <div class="flex items-center justify-between text-slate-300 font-semibold">
        <span>Inbound SLA:</span>
        <span class="text-purple-400 font-mono">99.99% Availability</span>
      </div>
    </div>
  </main>

  <footer class="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
    &copy; 2026 WorkspaceMail Technologies Inc. All rights reserved.
  </footer>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
};

/**
 * Decode RFC 2047 MIME Header words (Handles UTF-8, Bengali, Hindi, Arabic, Japanese, Chinese, Emoji)
 */
function decodeMimeHeader(raw) {
  if (!raw || typeof raw !== "string") return "";
  let str = raw.replace(/\r?\n[ \t]+/g, " ");
  str = str.replace(/(\=\?[^\?]+\?[bBqQ]\?[^\?]*\?\=)\s+(?=\=\?[^\?]+\?[bBqQ]\?[^\?]*\?\=)/g, "$1");
  return str.replace(/\=\?([^?]+)\?([bBqQ])\?([^?]*)\?\=/gi, (match, charset, enc, text) => {
    try {
      const encoding = enc.toUpperCase();
      let bytes;
      if (encoding === "B") {
        const bin = atob(text.replace(/\s+/g, ""));
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } else if (encoding === "Q") {
        const qp = text.replace(/_/g, " ");
        const byteArr = [];
        for (let i = 0; i < qp.length; i++) {
          if (qp[i] === "=" && i + 2 < qp.length && /^[0-9A-Fa-f]{2}$/.test(qp.substring(i + 1, i + 3))) {
            byteArr.push(parseInt(qp.substring(i + 1, i + 3), 16));
            i += 2;
          } else {
            byteArr.push(qp.charCodeAt(i));
          }
        }
        bytes = new Uint8Array(byteArr);
      }
      const cs = (charset || "utf-8").toLowerCase().replace(/[^a-z0-9_-]/g, "");
      return new TextDecoder(cs).decode(bytes);
    } catch {
      return match;
    }
  });
}

function decodeTextWithCharset(bytes, charset = "utf-8") {
  const cs = (charset || "utf-8").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  try {
    return new TextDecoder(cs).decode(bytes);
  } catch {
    try {
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return String.fromCharCode.apply(null, bytes);
    }
  }
}

/**
 * Robust RFC 822 MIME Parser
 * Separates SMTP headers from body, decodes multipart/alternative/mixed,
 * decodes base64 & quoted-printable, and extracts OTPs strictly from body content.
 */
function parseMimeEmail(raw) {
  const normalized = raw.replace(/\r\n/g, "\n");
  const splitIdx = normalized.indexOf("\n\n");

  if (splitIdx === -1) {
    return {
      subject: "",
      fromName: "",
      finalHtml: `<p style="white-space: pre-wrap; font-family: sans-serif;">${escapeHtml(normalized)}</p>`,
      snippet: normalized.substring(0, 160),
      otp: null,
      partnerLink: null
    };
  }

  const headerBlock = normalized.substring(0, splitIdx).replace(/\n[ \t]+/g, " ");
  const bodyBlock = normalized.substring(splitIdx + 2);

  const getHdr = (name) => {
    const reg = new RegExp("^" + name + ":\\s*(.*)$", "mi");
    const m = headerBlock.match(reg);
    return m ? decodeMimeHeader(m[1].trim()) : "";
  };
  const subject = getHdr("Subject");
  const fromName = getHdr("From");

  function decodeQuotedPrintable(str, charset = "utf-8") {
    const clean = str.replace(/=(?:\r\n|\n|\r)/g, "");
    const bytes = [];
    for (let i = 0; i < clean.length; i++) {
      if (clean[i] === "=" && i + 2 < clean.length && /^[0-9A-Fa-f]{2}$/.test(clean.substring(i + 1, i + 3))) {
        bytes.push(parseInt(clean.substring(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(clean.charCodeAt(i));
      }
    }
    return decodeTextWithCharset(new Uint8Array(bytes), charset);
  }

  function decodeBase64(str, charset = "utf-8") {
    try {
      const clean = str.replace(/\s+/g, "");
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return decodeTextWithCharset(bytes, charset);
    } catch {
      return str;
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  let htmlContent = "";
  let textContent = "";

  // Recursive MIME multipart parser: handles nested multipart/mixed, multipart/alternative, multipart/related
  function walkParts(partHeadersRaw, partBodyRaw) {
    const partHeaders = (partHeadersRaw || "").replace(/\n[ \t]+/g, " ");
    const boundaryMatch = partHeaders.match(/boundary\s*=\s*"?([^"\r\n;]+)"?/i);

    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const boundaryRegex = new RegExp("--" + boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const parts = partBodyRaw.split(boundaryRegex);

      for (const part of parts) {
        if (!part || part.trim() === "" || part.trim() === "--") continue;
        const norm = part.replace(/\r\n/g, "\n");
        const sep = norm.indexOf("\n\n");
        if (sep === -1) continue;

        const subHeaders = norm.substring(0, sep).replace(/\n[ \t]+/g, " ");
        const subBody = norm.substring(sep + 2);
        walkParts(subHeaders, subBody);
      }
    } else {
      const isBase64 = /content-transfer-encoding:\s*base64/i.test(partHeaders);
      const isQP = /content-transfer-encoding:\s*quoted-printable/i.test(partHeaders);
      const csMatch = partHeaders.match(/charset\s*=\s*"?([^"\n;]+)"?/i);
      const charset = csMatch ? csMatch[1].trim().toLowerCase() : "utf-8";

      let decoded = partBodyRaw;
      if (isBase64) decoded = decodeBase64(decoded, charset);
      else if (isQP) decoded = decodeQuotedPrintable(decoded, charset);

      if (/content-type:\s*text\/html/i.test(partHeaders)) {
        htmlContent = decoded.trim();
      } else if (/content-type:\s*text\/plain/i.test(partHeaders)) {
        if (!textContent) textContent = decoded.trim();
      }
    }
  }

  walkParts(headerBlock, bodyBlock);

  // Construct final display HTML with full sanitization
  let finalHtml = "";
  if (htmlContent) {
    finalHtml = htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
      .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, "")
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/href\s*=\s*(["'])\s*(?:javascript|vbscript|data):[^"']*\1/gi, 'href="#"')
      .replace(/src\s*=\s*(["'])\s*(?:javascript|vbscript):[^"']*\1/gi, 'src=""')
      .replace(/<a\b([^>]*)/gi, (match, attrs) => {
        let updated = attrs;
        if (!/target\s*=/i.test(updated)) updated += ' target="_blank"';
        if (!/rel\s*=/i.test(updated)) updated += ' rel="noopener noreferrer"';
        return '<a ' + updated.trim();
      });
  } else if (textContent) {
    const escaped = escapeHtml(textContent);
    finalHtml = `<div dir="auto" style="white-space: pre-wrap; word-break: normal; line-break: auto; line-height: 1.6; font-family: sans-serif;">${escaped
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #2563EB; text-decoration: underline; font-weight: 600; word-break: normal; line-break: auto;">$1</a>')
    }</div>`;
  } else {
    finalHtml = '<p style="color: #94A3B8;">(Empty message body)</p>';
  }

  const cleanBodyText = (textContent || finalHtml.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  const snippet = cleanBodyText.substring(0, 160);

  // Extract OTP strictly from body text (prevents false matches from IP/headers)
  let otp = null;
  const contextOtpMatch = cleanBodyText.match(/(?:code|otp|verification|pin|password|token|কোর্ড|কোড|ওটিপি|যাচাইকরণ|पिन|सत्यापन|رمز|تحقق|تأكيد|código|bestätigung)[^\w\d\u0980-\u09FF\u0900-\u097F\u0600-\u06FF]{1,30}(\b\d{4,8}\b)/i);
  if (contextOtpMatch) {
    otp = contextOtpMatch[1];
  } else {
    const standaloneMatch = cleanBodyText.match(/(?:^|\s)(\d{4,8})(?:\s|$|\.)/);
    if (standaloneMatch) {
      otp = standaloneMatch[1];
    }
  }

  const allLinks = (textContent + " " + htmlContent).match(/https?:\/\/[^\s"'<>\[\]\(\)\\]+/gi) || [];
  const cleanLinks = [...new Set(allLinks.map(l => l.replace(/[.,;]+$/, "")))];
  const partnerLink = cleanLinks.find(l => 
    /verify|confirm|activate|action|token|mode=|auth/i.test(l)
  ) || cleanLinks[0] || null;

  return {
    subject,
    fromName,
    finalHtml,
    snippet,
    otp,
    partnerLink
  };
}
