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
      const subject = message.headers.get("subject") || "(No Subject)";
      const rawEmail = await new Response(message.raw).text();

      // MIME Parser & Decoder
      const parsed = parseMimeEmail(rawEmail);

      // Extract sender display name
      const fromHeader = message.headers.get("from") || sender;
      const nameMatch = fromHeader.match(/^"?([^"<]+)"?\s*<.*>$/);
      const fromName = nameMatch ? nameMatch[1].trim() : sender.split("@")[0];

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

  // 2. HTTP Fetch Handler (Health Check)
  async fetch(request, env, ctx) {
    return new Response(JSON.stringify({ 
      service: "tempemails.site Email Worker", 
      status: "online", 
      version: "2.0.0",
      timestamp: new Date().toISOString() 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
};

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
      finalHtml: `<p style="white-space: pre-wrap; font-family: sans-serif;">${escapeHtml(normalized)}</p>`,
      snippet: normalized.substring(0, 160),
      otp: null,
      partnerLink: null
    };
  }

  const headerBlock = normalized.substring(0, splitIdx);
  const bodyBlock = normalized.substring(splitIdx + 2);

  function decodeQuotedPrintable(str) {
    return str
      .replace(/=\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  function decodeBase64(str) {
    try {
      const clean = str.replace(/\s+/g, "");
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return str;
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const boundaryMatch = headerBlock.match(/boundary="?([^"\n;]+)"?/i);
  let htmlContent = "";
  let textContent = "";

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const boundaryRegex = new RegExp("--" + boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const parts = bodyBlock.split(boundaryRegex);

    for (const part of parts) {
      if (!part || part.trim() === "" || part.trim() === "--") continue;

      const partSplit = part.indexOf("\n\n");
      if (partSplit === -1) continue;

      const partHeaders = part.substring(0, partSplit);
      let partBody = part.substring(partSplit + 2);

      const isBase64 = /content-transfer-encoding:\s*base64/i.test(partHeaders);
      const isQP = /content-transfer-encoding:\s*quoted-printable/i.test(partHeaders);

      if (isBase64) partBody = decodeBase64(partBody);
      else if (isQP) partBody = decodeQuotedPrintable(partBody);

      if (/content-type:\s*text\/html/i.test(partHeaders)) {
        htmlContent = partBody.trim();
      } else if (/content-type:\s*text\/plain/i.test(partHeaders)) {
        textContent = partBody.trim();
      }
    }
  } else {
    const isBase64 = /content-transfer-encoding:\s*base64/i.test(headerBlock);
    const isQP = /content-transfer-encoding:\s*quoted-printable/i.test(headerBlock);
    let decoded = bodyBlock;

    if (isBase64) decoded = decodeBase64(decoded);
    else if (isQP) decoded = decodeQuotedPrintable(decoded);

    if (/content-type:\s*text\/html/i.test(headerBlock)) {
      htmlContent = decoded.trim();
    } else {
      textContent = decoded.trim();
    }
  }

  // Construct final display HTML
  let finalHtml = "";
  if (htmlContent) {
    // Sanitize script tags
    finalHtml = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  } else if (textContent) {
    // Format plain text nicely: convert line breaks, auto-link URLs
    const escaped = escapeHtml(textContent);
    finalHtml = escaped
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #2563EB; text-decoration: underline; font-weight: 600; word-break: break-all;">$1</a>')
      .replace(/\n/g, "<br>");
  } else {
    finalHtml = '<p style="color: #94A3B8;">(Empty message body)</p>';
  }

  // Clean text snippet
  const cleanBodyText = (textContent || finalHtml.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  const snippet = cleanBodyText.substring(0, 160);

  // Extract OTP strictly from body text (prevents false matches from IP/headers)
  let otp = null;
  const contextOtpMatch = cleanBodyText.match(/(?:code|otp|verification|pin|password|token)[^\w\d]{1,25}(\b\d{4,8}\b)/i);
  if (contextOtpMatch) {
    otp = contextOtpMatch[1];
  } else {
    // Standalone 4-8 digit number
    const standaloneMatch = cleanBodyText.match(/(?:^|\s)(\d{4,8})(?:\s|$|\.)/);
    if (standaloneMatch) {
      otp = standaloneMatch[1];
    }
  }

  // Extract clean verification link from body
  const allLinks = (textContent + " " + htmlContent).match(/https?:\/\/[^\s"'<>\[\]\(\)\\]+/gi) || [];
  const cleanLinks = [...new Set(allLinks.map(l => l.replace(/[.,;]+$/, "")))];
  const partnerLink = cleanLinks.find(l => 
    /verify|confirm|activate|action|token|mode=|auth/i.test(l)
  ) || cleanLinks[0] || null;

  return {
    finalHtml,
    snippet,
    otp,
    partnerLink
  };
}
