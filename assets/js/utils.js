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

  // 2. Persistent Hardware Device Fingerprinting
  getDeviceId() {
    let deviceId = localStorage.getItem('tre_device_fingerprint_v1');
    if (deviceId) return deviceId;

    // Build fingerprint components
    const screenRes = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const userAgent = navigator.userAgent;
    const language = navigator.language || 'en';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const cores = navigator.hardwareConcurrency || 4;

    // Detect Device Type
    let deviceType = 'Desktop';
    if (/iPad|tablet|PlayBook/i.test(userAgent)) {
      deviceType = 'Tablet';
    } else if (/Mobile|Android|iPhone|iPod/i.test(userAgent)) {
      deviceType = 'Mobile';
    }

    // Detect OS
    let os = 'Unknown OS';
    if (/Windows/i.test(userAgent)) os = 'Windows';
    else if (/Macintosh|Mac OS/i.test(userAgent)) os = 'macOS';
    else if (/iPhone|iPad/i.test(userAgent)) os = 'iOS';
    else if (/Android/i.test(userAgent)) os = 'Android';
    else if (/Linux/i.test(userAgent)) os = 'Linux';

    // Hash into unique ID
    const raw = `${screenRes}|${userAgent}|${language}|${timezone}|${cores}|${Date.now()}|${Math.random()}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }

    const uniqueCode = Math.abs(hash).toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
    deviceId = `${deviceType}-${os}-${uniqueCode}`;
    localStorage.setItem('tre_device_fingerprint_v1', deviceId);
    return deviceId;
  }
};

window.AppUtils = AppUtils;
