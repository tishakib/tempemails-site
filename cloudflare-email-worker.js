/**
 * Cloudflare Email Routing Worker for tempemails.site
 * Catches incoming emails for *@tempemails.site, parses them, extracts OTPs/links,
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

      // Decode Quoted-Printable (e.g. '=3D' to '=', soft line breaks)
      function decodeQuotedPrintable(str) {
        return str
          .replace(/=\r?\n/g, "")
          .replace(/=([0-9A-Fa-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      }

      const decodedEmail = decodeQuotedPrintable(rawEmail);

      // Extract all URLs/links
      const linkMatches = decodedEmail.match(/https?:\/\/[^\s"'<>\[\]\(\)\\]+/gi) || [];
      const cleanLinks = [...new Set(linkMatches.map(l => l.replace(/[.,;]+$/, "")))];

      // Prioritize verification, activation, or confirmation links
      const partnerLink = cleanLinks.find(l => 
        l.includes("verify") || 
        l.includes("confirm") || 
        l.includes("activate") || 
        l.includes("token")
      ) || cleanLinks[0] || null;

      // Extract OTP (4 to 8 digit verification code)
      const otpMatch = decodedEmail.match(/\b\d{4,8}\b/);
      const otp = otpMatch ? otpMatch[0] : null;

      // Extract fromName if present in headers
      const fromHeader = message.headers.get("from") || sender;
      const nameMatch = fromHeader.match(/^"?([^"<]+)"?\s*<.*>$/);
      const fromName = nameMatch ? nameMatch[1].trim() : sender.split("@")[0];

      // Clean snippet preview (strip HTML tags)
      const snippet = decodedEmail
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 160);

      // Prepare standard payload for tempemails.site API
      const payload = {
        to: recipient,
        from: sender,
        fromName: fromName,
        subject: subject,
        bodyHtml: decodedEmail,
        snippet: snippet,
        otp: otp,
        partnerLink: partnerLink,
        receivedAt: new Date().toISOString()
      };

      // 1. Forward to tempemails.site Backend Webhook API
      const backendUrl = env.BACKEND_WEBHOOK_URL || "https://tempemails.site/api/inbox/incoming";
      
      try {
        await fetch(backendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Cloudflare-Email-Worker/1.0"
          },
          body: JSON.stringify(payload)
        });
      } catch (postErr) {
        console.error("Failed to forward email to backend webhook:", postErr);
      }

      // 2. Optional: Store in Cloudflare KV as a 7-day backup
      if (env.EMAILS_KV) {
        const key = `${recipient}:${Date.now()}`;
        await env.EMAILS_KV.put(key, JSON.stringify(payload), {
          expirationTtl: 7 * 24 * 60 * 60 // 7 Days Retention
        });
      }

    } catch (err) {
      console.error("Error processing incoming email:", err);
    }
  },

  // 2. HTTP Fetch Handler (Optional: allow direct API queries to the Worker)
  async fetch(request, env, ctx) {
    return new Response(JSON.stringify({ 
      service: "tempemails.site Email Worker", 
      status: "online", 
      timestamp: new Date().toISOString() 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
};
