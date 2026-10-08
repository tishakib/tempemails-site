/**
 * Audio Chime Synthesizer & Device Fingerprinting
 * Zero-dependency Web Audio API sound generator and device identifier
 */

const AppUtils = {
  // 1. Synthesize a clean, pleasant modern email notification chime (Two-tone marimba chime)
  playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // First tone (E5 ~ 659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0.2, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);

      // Second higher tone (A5 ~ 880 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0, ctx.currentTime);
      gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.55);
    } catch (err) {
      console.warn('Audio playback not permitted or not supported:', err);
    }
  },

  // 2. Deterministic Cross-Browser & Incognito Hardware Device Fingerprinting
  getDeviceId() {
    try {
      const parts = [];

      // 1. Physical Screen Metrics (Independent of browser zoom)
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round((window.screen.width || 0) * dpr);
      const h = Math.round((window.screen.height || 0) * dpr);
      const colorDepth = window.screen.colorDepth || 24;
      parts.push(`SCR:${w}x${h}x${colorDepth}`);

      // 2. Hardware CPU Concurrency
      parts.push(`CPU:${navigator.hardwareConcurrency || 4}`);

      // 3. Timezone & Locale (Matches device system settings)
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const offset = new Date().getTimezoneOffset();
        parts.push(`TZ:${tz}_${offset}`);
      } catch (e) {
        parts.push('TZ:UNKNOWN');
      }

      // 4. Physical GPU / WebGL Hardware Fingerprint (Unmasked Renderer)
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          if (dbg) {
            const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '';
            const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '';
            parts.push(`GPU:${vendor}~${renderer}`);
          }
        }
      } catch (e) {}

      // 5. 2D Canvas Text & Geometry Rasterization (GPU/Font rendering hash)
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial, sans-serif';
          ctx.fillStyle = '#f4413d';
          ctx.fillRect(5, 5, 50, 20);
          ctx.fillStyle = '#0f172a';
          ctx.fillText('TM:2026', 10, 10);
          const dataUrl = canvas.toDataURL();
          // Extract checksum of rasterized pixels
          let cnvSum = 0;
          for (let i = 0; i < dataUrl.length; i++) {
            cnvSum = ((cnvSum << 5) - cnvSum) + dataUrl.charCodeAt(i);
            cnvSum |= 0;
          }
          parts.push(`CNV:${Math.abs(cnvSum).toString(36)}`);
        }
      } catch (e) {}

      // Detect OS family for readable prefix
      let os = 'Device';
      const ua = navigator.userAgent || '';
      if (/Macintosh|Mac OS/i.test(ua)) os = 'Mac';
      else if (/Windows/i.test(ua)) os = 'Win';
      else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
      else if (/Android/i.test(ua)) os = 'Android';
      else if (/Linux/i.test(ua)) os = 'Linux';

      // 6. Deterministic Dual-Hash (No random, no timestamps)
      const rawString = parts.join('||');
      let hashA = 5381;
      let hashB = 52711;
      for (let i = 0; i < rawString.length; i++) {
        const code = rawString.charCodeAt(i);
        hashA = ((hashA << 5) + hashA) ^ code;
        hashB = ((hashB << 5) + hashB) ^ code;
      }

      const codeA = (Math.abs(hashA) >>> 0).toString(36).toUpperCase().padStart(6, '0');
      const codeB = (Math.abs(hashB) >>> 0).toString(36).toUpperCase().padStart(6, '0');
      const deviceId = `${os}-${codeA}${codeB}`;

      try {
        localStorage.setItem('tre_device_fingerprint_v1', deviceId);
      } catch (e) {}

      return deviceId;
    } catch (err) {
      return 'HW-FALLBACK-DEVICE';
    }
  }
};

window.AppUtils = AppUtils;
